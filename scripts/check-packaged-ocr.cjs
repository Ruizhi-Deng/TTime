const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { createHash } = require('node:crypto')
const asar = require('asar')
const registry = require('../src/common/ocr/models.json')

const resources = path.resolve('dist/win-unpacked/resources')
const archive = path.join(resources, 'app.asar')
const ids = new Set([registry.classifier, 'en_PP-OCRv4_rec_mobile'])
for (const language of registry.languages.filter((item) => ['ch', 'en'].includes(item.id))) {
  ids.add(language.det)
  ids.add(language.rec)
}
for (const id of ids) {
  const model = registry.models[id]
  const relative = `ocr/models/${model.sha256}/${model.file}`
  assert.equal(asar.getFileInfo(archive, relative).unpacked, true)
  const bytes = fs.readFileSync(path.join(resources, 'app.asar.unpacked', relative))
  assert.equal(createHash('sha256').update(bytes).digest('hex'), model.sha256)
}
const metadata = JSON.parse(asar.extractFile(archive, 'package.json').toString())
assert.equal(metadata.dependencies['onnxruntime-node'], '1.16.3')
assert.equal(metadata.dependencies.wordsninja, undefined)
console.log(
  'Packaged Chinese/English OCR models are unpacked, verified, and ready for offline use.'
)
