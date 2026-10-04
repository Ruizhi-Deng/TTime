const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const http = require('node:http')
const axios = require('axios')
const { PNG } = require('pngjs')
const { buildSync } = require('esbuild')

function loadSource(file) {
  const code = buildSync({
    entryPoints: [file],
    bundle: true,
    write: false,
    platform: 'node',
    format: 'cjs',
    external: ['axios', 'opencv.js', 'onnxruntime-node', 'clipper-lib']
  }).outputFiles[0].text
  const module = { exports: {} }
  new Function('module', 'exports', 'require', code)(module, module.exports, require)
  return module.exports
}

async function main() {
  const { OcrModelCache, modelPath } = loadSource('src/common/ocr/modelCache.ts')
  const { decodeCtc } = loadSource('src/common/ocr/recognition.ts')
  const { composeOcrResult } = loadSource('src/common/ocr/OcrResult.ts')
  const { PaddleOcr } = loadSource('src/common/ocr/PaddleOcr.ts')
  const registry = require('../src/common/ocr/models.json')
  const characters = ['', 'A', ' ']
  const data = Float32Array.from([0, 1, 0, 0, 1, 0, 1, 0, 0, 0, 0, 1, 0, 1, 0])
  assert.equal(decodeCtc(data, 5, 3, characters).text, 'A A')
  const line = (text, x, y, w = 200, h = 20) => ({
    text,
    confidence: 0.99,
    detectionConfidence: 0.98,
    box: [
      [x, y],
      [x + w, y],
      [x + w, y + h],
      [x, y + h]
    ]
  })
  const synthetic = [
    line('下一行', 10, 40),
    line('中文段落', 10, 10),
    line('New paragraph', 10, 100)
  ]
  assert.equal(
    composeOcrResult(synthetic, 'ch', 400, 200, true).allText,
    '中文段落下一行\nNew paragraph'
  )
  assert.equal(
    composeOcrResult(synthetic, 'ch', 400, 200, false).allText,
    '中文段落\n下一行\nNew paragraph'
  )
  assert.equal(
    composeOcrResult(
      [line('left column', 10, 10), line('right column', 300, 10)],
      'en',
      700,
      100,
      true
    ).paragraphs.length,
    2
  )
  assert.equal(
    composeOcrResult(
      [line('Paragraph', 10, 10), line('1. New list item', 10, 40)],
      'en',
      700,
      100,
      true
    ).paragraphs.length,
    2
  )

  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'ttime-ocr-'))
  const downloaded = []
  const server = http.createServer((request, response) => {
    const id = decodeURIComponent(request.url.slice(1))
    const stream = fs.createReadStream(modelPath(path.resolve('ocr/models'), id))
    stream.on('error', () => {
      response.writeHead(404)
      response.end()
    })
    stream.pipe(response)
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const base = `http://127.0.0.1:${server.address().port}`
  const download = async (url) => {
    const id = Object.keys(registry.models).find((key) => registry.models[key].url === url)
    downloaded.push(id)
    const response = await axios.get(base + '/' + encodeURIComponent(id), {
      responseType: 'arraybuffer',
      proxy: false
    })
    return Buffer.from(response.data)
  }
  const cache = new OcrModelCache(
    path.join(temporary, 'cache'),
    path.join(temporary, 'empty'),
    download
  )
  const engine = new PaddleOcr()
  try {
    assert.equal(cache.isReady('ch'), false)
    const [ch, en] = await Promise.all([
      cache.prepare('ch'),
      cache.prepare('en'),
      cache.prepare('ch')
    ])
    assert.equal(downloaded.length, 5)
    assert.equal(new Set(downloaded).size, 5)
    assert.equal(cache.isReady('ch'), true)
    await new OcrModelCache(path.join(temporary, 'cache'), '', async () => {
      throw Error('unexpected download')
    }).prepare('ch')
    const bundled = new OcrModelCache(path.join(temporary, 'bundled'), 'ocr/models', async () => {
      throw Error('unexpected network')
    })
    await bundled.prepare('ch')
    const invalid = new OcrModelCache(path.join(temporary, 'invalid'), '', async () =>
      Buffer.from('invalid model')
    )
    await assert.rejects(invalid.prepare('ch'), /校验失败/)
    assert.equal(invalid.isReady('ch'), false)
    const result = async (fixture, language, merge) => {
      const image = PNG.sync.read(fs.readFileSync(path.join('scripts/fixtures', fixture)))
      return engine.recognize(image, language, merge)
    }
    await engine.initialize(ch)
    const mixed = await result('ocr-mixed.png', 'ch', true)
    assert.equal(mixed.lines.length, 4)
    assert.match(mixed.allText, /Hello world from OCR/)
    assert.match(mixed.allText, /中文识别测试English words/)
    assert.match(mixed.allText, /Keep spaces between words\./)
    for (const item of mixed.lines) {
      assert.ok(item.confidence > 0.8)
      assert.ok(item.detectionConfidence > 0.5)
      assert.equal(item.box.length, 4)
      assert.ok(item.box.every(([x, y]) => x >= 0 && x < mixed.width && y >= 0 && y < mixed.height))
    }
    // Reuse the active model sessions on the second image.
    const sessions = engine.sessions
    await engine.initialize(ch)
    assert.equal(engine.sessions, sessions)
    await engine.initialize(en)
    const english = await result('ocr-english.png', 'en', false)
    assert.match(english.allText, /DeepSeek translation/)
    assert.match(english.allText, /APIKey and snake_case\./)
    const paragraph = await result('ocr-paragraph.png', 'en', true)
    assert.deepEqual(
      paragraph.paragraphs.map((p) => p.lineIndices),
      [[0, 1], [2]]
    )
    assert.match(paragraph.allText, /paragraph continues on the next line\.\nSecond/)
    const separated = await result('ocr-paragraph.png', 'en', false)
    assert.equal(separated.paragraphs.length, 3)
    const rotated = await result('ocr-rotated.png', 'en', false)
    assert.match(rotated.allText, /APIKey and snake_case\./)
    assert.ok(Math.abs(rotated.lines[0].box[1][1] - rotated.lines[0].box[0][1]) > 30)
    const blank = await engine.recognize(
      { width: 100, height: 100, data: new Uint8Array(40000).fill(255) },
      'en',
      true
    )
    assert.equal(blank.allText, '')
    assert.deepEqual(blank.lines, [])
  } finally {
    await engine.dispose()
    await new Promise((resolve) => server.close(resolve))
    fs.rmSync(temporary, { recursive: true, force: true })
  }
  console.log(
    'Real PP-OCR models, mixed-language spaces, geometry, rotation, paragraphs, session reuse, and model cache checks passed.'
  )
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
