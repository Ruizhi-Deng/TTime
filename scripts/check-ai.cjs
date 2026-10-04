const assert = require('node:assert/strict')
const http = require('node:http')
const vm = require('node:vm')
const { TextDecoder, TextEncoder } = require('node:util')
const { ReadableStream } = require('node:stream/web')
const { buildSync } = require('esbuild')

const clone = (value) => JSON.parse(JSON.stringify(value))
function loadSource(entryPoint, globals = {}) {
  const code = buildSync({
    entryPoints: [entryPoint],
    bundle: true,
    write: false,
    platform: 'node',
    format: 'cjs'
  }).outputFiles[0].text
  const module = { exports: {} }
  vm.runInNewContext(code, {
    module,
    exports: module.exports,
    require,
    AbortController,
    TextDecoder,
    console,
    ...globals
  })
  return module.exports
}

function localFetch(url, options) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      url,
      { method: options.method, headers: options.headers, signal: options.signal },
      (response) => {
        const pieces = []
        const done = new Promise((finish, fail) => {
          response.on('data', (chunk) => pieces.push(chunk))
          response.on('end', () => finish(Buffer.concat(pieces).toString()))
          response.on('error', fail)
        })
        // The stream branch consumes body; JSON/text branches consume done.
        done.catch(() => {})
        const body = new ReadableStream({
          start(controller) {
            response.on('data', (chunk) => controller.enqueue(chunk))
            response.on('end', () => controller.close())
            response.on('error', (error) => controller.error(error))
          },
          cancel() {
            response.destroy()
          }
        })
        resolve({
          ok: response.statusCode >= 200 && response.statusCode < 300,
          status: response.statusCode,
          body,
          text: () => done,
          json: async () => JSON.parse(await done)
        })
      }
    )
    req.on('error', reject)
    req.end(options.body)
  })
}

async function main() {
  const prompts = loadSource('src/common/utils/aiPrompts.ts')
  const parser = loadSource('src/common/utils/aiRequest.ts')
  const deeplx = loadSource('src/common/utils/deepLXRequest.ts')
  const textWithVariables = 'line 1\n{{target}} 🐱'
  const messages = clone(
    prompts.buildPromptMessages(prompts.defaultAiPrompts[0], textWithVariables, 'English', '中文')
  )
  assert.ok(messages[1].content.endsWith(textWithVariables))
  assert.throws(() => prompts.findAiPrompt(prompts.defaultAiPrompts, 'missing'), /提示词/)

  async function collect(type, text) {
    const bytes = new TextEncoder().encode(text)
    async function* chunks() {
      for (let i = 0; i < bytes.length; i++) yield bytes.subarray(i, i + 1)
    }
    const result = []
    for await (const piece of parser.readAiStream(type, chunks())) result.push(piece)
    return result.join('')
  }
  assert.equal(
    await collect(
      'OpenAI',
      ': ping\r\n\r\ndata: {"choices":[{"delta":{"content":"猫🐱"}}]}\r\n\r\ndata: [DONE]\r\n\r\n'
    ),
    '猫🐱'
  )
  assert.equal(
    await collect(
      'OpenAI',
      'data: {"choices": [\ndata: {"delta":{"content":"two lines"}}]}\n\ndata: [DONE]'
    ),
    'two lines'
  )
  assert.equal(
    await collect(
      'Ollama',
      '{"message":{"content":"猫"},"done":false}\n{"message":{"content":"🐱"},"done":true}'
    ),
    '猫🐱'
  )
  assert.equal(
    await collect(
      'Gemini',
      'data: {"candidates":[{"content":{"parts":[{"text":"hidden","thought":true},{"text":"visible"}]},"finishReason":"STOP"}]}\n\n'
    ),
    'visible'
  )
  await assert.rejects(
    collect('OpenAI', 'data: {"choices":[{"delta":{"content":"partial"}}]}\n\n'),
    /提前结束/
  )
  await assert.rejects(collect('OpenAI', 'data: {"error":{"message":"bad key"}}\n\n'), /bad key/)
  await assert.rejects(collect('OpenAI', 'data: [DONE]\n\n'), /文本结果/)
  assert.equal(deeplx.readDeepLXResponse({ code: 200, data: '翻译' }), '翻译')
  assert.throws(() => deeplx.readDeepLXResponse({ code: 429, message: 'rate limit' }), /rate limit/)

  const calls = []
  let slowSeen
  const sawSlow = new Promise((resolve) => {
    slowSeen = resolve
  })
  const server = http.createServer(async (req, res) => {
    let raw = ''
    for await (const piece of req) raw += piece
    const body = JSON.parse(raw)
    calls.push({ url: req.url, headers: req.headers, body })
    if (req.url === '/error') {
      res.writeHead(401)
      res.end('bad key')
      return
    }
    if (req.url === '/translate') {
      res.end(JSON.stringify({ code: 200, data: 'DeepLX result' }))
      return
    }
    const ollama = req.url === '/api/chat'
    const gemini = req.url.startsWith('/gemini/models/')
    const stream = gemini ? req.url.includes('streamGenerateContent') : body.stream
    const content = `result:${body.model || 'native'}`
    const answer = () => {
      if (!stream) {
        res.end(
          JSON.stringify(
            ollama
              ? { message: { content } }
              : gemini
              ? { candidates: [{ content: { parts: [{ text: content }] } }] }
              : { choices: [{ message: { content } }] }
          )
        )
        return
      }
      if (ollama) res.end(JSON.stringify({ message: { content }, done: true }) + '\n')
      else if (gemini)
        res.end(
          'data: ' +
            JSON.stringify({
              candidates: [{ content: { parts: [{ text: content }] }, finishReason: 'STOP' }]
            }) +
            '\n\n'
        )
      else
        res.end(
          'data: ' + JSON.stringify({ choices: [{ delta: { content } }] }) + '\n\ndata: [DONE]\n\n'
        )
    }
    res.setHeader('Content-Type', stream && !ollama ? 'text/event-stream' : 'application/json')
    if (body.model === 'slow') {
      slowSeen()
      setTimeout(() => {
        if (!res.destroyed) answer()
      }, 50)
    } else answer()
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const base = `http://127.0.0.1:${server.address().port}`
  const events = []
  const api = {
    cacheGet: () => clone(prompts.defaultAiPrompts),
    agentApiTranslateCallback: (event) => events.push(clone(event))
  }
  const transport = loadSource('src/renderer/src/channel/AiChannelRequest.ts', {
    window: { api },
    fetch: localFetch
  })
  const info = (type, id, model = 'model', stream = true) => ({
    type,
    id,
    requestId: 'request-' + id,
    model,
    requestUrl: base + '/chat?custom=yes',
    appKey: id + '-key',
    aiPromptId: 'translate',
    stream,
    translateContent: 'input',
    languageType: 'English',
    languageResultType: '中文'
  })
  try {
    await Promise.all(
      ['OpenAI', 'DeepSeek', 'Zhipu', 'AzureOpenAI'].map((type) =>
        transport.requestAiTranslation(info(type, type))
      )
    )
    await Promise.all([
      transport.requestAiTranslation(info('OpenAI', 'a', 'model-a')),
      transport.requestAiTranslation(info('OpenAI', 'b', 'model-b'))
    ])
    for (const id of ['OpenAI', 'DeepSeek', 'Zhipu', 'AzureOpenAI', 'a', 'b']) {
      const own = events.filter((event) => event.data.request.id === id)
      assert.deepEqual(
        own.map((event) => event.data.response.code),
        [0, 2, 1]
      )
      assert.ok(own.every((event) => event.data.request.requestId === 'request-' + id))
    }
    assert.equal(
      events.find((event) => event.data.request.id === 'a' && event.data.response.content).data
        .response.content,
      'result:model-a'
    )
    assert.equal(
      events.find((event) => event.data.request.id === 'b' && event.data.response.content).data
        .response.content,
      'result:model-b'
    )
    assert.equal(
      calls.find((call) => call.headers['api-key']).headers['api-key'],
      'AzureOpenAI-key'
    )
    assert.equal(
      calls.find((call) => call.body.model === 'model-a').headers.authorization,
      'Bearer a-key'
    )
    assert.ok(
      calls
        .filter((call) => call.url.startsWith('/chat'))
        .every((call) => call.url === '/chat?custom=yes')
    )

    await transport.requestAiTranslation({
      ...info('Ollama', 'local'),
      appKey: '',
      requestUrl: base + '/api/chat'
    })
    assert.equal(calls.find((call) => call.url === '/api/chat').headers.authorization, undefined)
    await transport.requestAiTranslation({
      ...info('Gemini', 'gemini'),
      requestUrl: base + '/gemini'
    })
    assert.equal(
      calls.find((call) => call.url.startsWith('/gemini')).headers['x-goog-api-key'],
      'gemini-key'
    )
    assert.ok(calls.find((call) => call.url.startsWith('/gemini')).body.systemInstruction)
    await transport.requestAiTranslation(info('OpenAI', 'non-stream', 'custom', false))
    await transport.requestAiTranslation({
      ...info('Ollama', 'local-json', 'local-model', false),
      appKey: '',
      requestUrl: base + '/api/chat'
    })
    await transport.requestAiTranslation({
      ...info('Gemini', 'gemini-json', 'gemini-model', false),
      requestUrl: base + '/gemini'
    })
    const lx = loadSource('src/renderer/src/channel/DeepLXChannelRequest.ts', {
      window: { api },
      fetch: localFetch
    })
    await lx.requestDeepLXTranslation({
      ...info('DeepLX', 'lx'),
      appKey: '',
      requestUrl: base + '/translate'
    })
    const lxCall = calls.find((call) => call.url === '/translate')
    assert.equal(lxCall.body.text, 'input')
    assert.equal(lxCall.headers.authorization, undefined)
    assert.equal(
      events.find((event) => event.data.request.id === 'lx').data.response.content,
      'DeepLX result'
    )
    await transport.requestAiTranslation({ ...info('OpenAI', 'check'), isTranslateCheckType: true })
    assert.equal(events.filter((event) => event.data.request.id === 'check').length, 1)
    assert.equal(
      calls.find((call) => call.headers.authorization === 'Bearer check-key').body.stream,
      false
    )

    const slow = transport.requestAiTranslation(info('OpenAI', 'same', 'slow'))
    await sawSlow
    await transport.requestAiTranslation(info('OpenAI', 'same', 'fast'))
    await slow
    assert.ok(
      !events.some((event) => event.data.request.model === 'slow' && event.data.response.code !== 0)
    )
    await transport.requestAiTranslation({ ...info('OpenAI', 'bad'), requestUrl: base + '/error' })
    const failed = events.filter((event) => event.data.request.id === 'bad')
    assert.deepEqual(
      failed.map((event) => event.data.response.code),
      [0, -1]
    )
    assert.match(failed[1].data.response.error, /401.*bad key/)
  } finally {
    await new Promise((resolve) => server.close(resolve))
  }
  console.log(
    'AI protocols, UTF-8 streams, prompts, HTTP errors, concurrent instances, and cancellation checks passed.'
  )
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
