const assert = require('node:assert/strict')
const vm = require('node:vm')
const { buildSync } = require('esbuild')

function loadSource(entryPoint, globals = {}) {
  const code = buildSync({
    entryPoints: [entryPoint],
    bundle: true,
    write: false,
    platform: 'node',
    format: 'cjs'
  }).outputFiles[0].text
  const module = { exports: {} }
  vm.runInNewContext(code, { module, exports: module.exports, require, ...globals })
  return module.exports
}

const clone = (value) => JSON.parse(JSON.stringify(value))

const stores = { config: { translateHistoryStatus: 'Y' }, historyRecord: {} }
const api = {
  cacheGet: (type, key) => clone(stores[type][key] ?? null),
  cacheSet: (type, key, value) => {
    stores[type][key] = clone(value)
  }
}
const history = loadSource('src/renderer/src/utils/translateRecordUtil.ts', { window: { api } })
history.updateTranslateRecord({
  requestId: 'not-recorded',
  translateServiceId: 'openai',
  translateList: ['hello']
})
assert.deepEqual(stores.historyRecord.translateRecordList, [])
const records = Array.from({ length: 45 }, (_, index) => ({
  requestId: String(index),
  translateContent: 'original ' + index,
  translateServiceRecordList: [{ translateServiceId: 'openai', translateStatus: false }]
}))
history.updateTranslateRecordList(records)
history.updateTranslateRecord({
  requestId: '44',
  translateServiceId: 'openai',
  translateList: ['updated result']
})
assert.equal(history.getTranslateRecordSize(), 45)
assert.equal(history.getTranslateRecordList().length, 45)
assert.equal(history.getTranslateRecordList()[0].translateContent, 'original 0')
assert.deepEqual(
  history.getTranslateRecordList()[44].translateServiceRecordList[0].translateVo.translateList,
  ['updated result']
)
assert.equal(
  history.getTranslateRecordList()[43].translateServiceRecordList[0].translateStatus,
  false
)
assert.deepEqual(stores.config, { translateHistoryStatus: 'Y' })
history.updateTranslateRecordList(
  history.getTranslateRecordList().filter((record) => record.requestId !== '44')
)
assert.equal(history.getTranslateRecordSize(), 44)
console.log('Local history checks passed.')
