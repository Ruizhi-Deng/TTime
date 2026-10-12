const assert = require('node:assert/strict')
const vm = require('node:vm')
const { buildSync } = require('esbuild')

const code = buildSync({
  entryPoints: ['src/renderer/src/utils/systemSpeech.ts'],
  bundle: true,
  write: false,
  platform: 'browser',
  format: 'cjs'
}).outputFiles[0].text

const voice = (name, lang, localService = true, isDefault = false) => ({
  name, lang, localService, default: isDefault
})
const chinese = voice('Huihui', 'zh-CN', true, true)
const english = voice('Mark', 'en-US')

function setup(initialVoices = []) {
  const module = { exports: {} }
  let voices = initialVoices
  const listeners = new Set()
  const timers = new Set()
  const spoken = []
  const errors = []
  const synth = {
    getVoices: () => voices,
    cancel: () => {},
    speak: utterance => spoken.push(utterance),
    addEventListener: (_event, listener) => listeners.add(listener),
    removeEventListener: (_event, listener) => listeners.delete(listener)
  }
  class Utterance {
    constructor(text) { this.text = text }
  }
  vm.runInNewContext(code, {
    module, exports: module.exports,
    window: { speechSynthesis: synth }, SpeechSynthesisUtterance: Utterance,
    setTimeout: callback => { timers.add(callback); return callback },
    clearTimeout: callback => timers.delete(callback)
  })
  return {
    ...module.exports, spoken, errors, listeners, timers,
    play: text => module.exports.playSystemSpeech(text, message => errors.push(message)),
    setVoices: next => {
      voices = next
      for (const listener of [...listeners]) listener()
    },
    expire: () => { for (const callback of [...timers]) callback() }
  }
}

async function main() {
  const g = setup([english, chinese])
  assert.equal(g.getSpeechLanguage('你好，世界。'), 'zh-CN')
  assert.equal(g.getSpeechLanguage('Hello world'), 'en-US')
  assert.equal(g.getSpeechLanguage('Robot 控制测试 123'), 'zh-CN')
  await g.play('你好，世界。')
  assert.equal(g.spoken[0].voice, chinese)
  assert.equal(g.spoken[0].lang, 'zh-CN')
  await g.play('Hello world')
  assert.equal(g.spoken[1].voice, english)
  assert.equal(g.spoken[1].lang, 'en-US')

  // A default voice in another language must never override the text language.
  const wrongDefault = voice('English default', 'en-US', true, true)
  const traditional = voice('Traditional', 'zh-TW', true, true)
  assert.equal(g.selectSpeechVoice([wrongDefault, traditional, chinese], 'zh-CN'), chinese)
  assert.equal(g.selectSpeechVoice([wrongDefault, traditional], 'zh-CN'), traditional)
  assert.equal(g.selectSpeechVoice([voice('Remote', 'en-US', false, true), english], 'en-US'), english)
  assert.equal(g.selectSpeechVoice([voice('Underscore locale', 'zh_CN')], 'zh-CN').lang, 'zh_CN')

  const loading = setup()
  const ready = loading.play('你好')
  loading.setVoices([english, chinese])
  await ready
  assert.equal(loading.spoken[0].voice, chinese)
  assert.equal(loading.listeners.size, 0)
  assert.equal(loading.timers.size, 0)

  // A superseded request must not start after asynchronous voice loading.
  const overlapping = setup()
  const first = overlapping.play('Hello')
  const second = overlapping.play('你好')
  overlapping.setVoices([english, chinese])
  await Promise.all([first, second])
  assert.equal(overlapping.spoken.length, 1)
  assert.equal(overlapping.spoken[0].text, '你好')

  const missing = setup([english])
  await missing.play('你好')
  assert.equal(missing.spoken.length, 0)
  assert.match(missing.errors[0], /没有可用的中文/)
  const empty = setup()
  const timeout = empty.play('Hello')
  empty.expire()
  await timeout
  assert.equal(empty.spoken.length, 0)
  assert.match(empty.errors[0], /没有可用的英语/)
  assert.equal(empty.listeners.size, 0)
  assert.equal(empty.timers.size, 0)

  g.spoken[1].onerror({ error: 'synthesis-failed' })
  assert.match(g.errors[0], /synthesis-failed/)
  const errorCount = g.errors.length
  g.spoken[0].onerror({ error: 'interrupted' })
  assert.equal(g.errors.length, errorCount)
  await g.play('  ')
  assert.equal(g.spoken.length, 2)
  console.log('System speech language, voice loading, cancellation, and error checks passed.')
}
main().catch(error => { console.error(error); process.exitCode = 1 })
