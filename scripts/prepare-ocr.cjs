const path = require('node:path')
const { buildSync } = require('esbuild')
const code = buildSync({
  entryPoints: ['src/common/ocr/modelCache.ts'],
  bundle: true,
  write: false,
  platform: 'node',
  format: 'cjs',
  external: ['axios']
}).outputFiles[0].text
const m = { exports: {} }
new Function('module', 'exports', 'require', code)(m, m.exports, require)
const directory = path.resolve('ocr/models')
const axios = require('axios')
const proxyUrl = process.env.HTTPS_PROXY || process.env.HTTP_PROXY
const agent = proxyUrl ? require('https-proxy-agent')(proxyUrl) : undefined
const cache = new m.exports.OcrModelCache(directory, directory, async (url) => {
  const response = await axios.get(url, {
    responseType: 'arraybuffer',
    timeout: 60000,
    proxy: false,
    httpsAgent: agent
  })
  return Buffer.from(response.data)
})
Promise.all(['ch', 'en'].map((language) => cache.prepare(language)))
  .then(() => console.log('Pinned Chinese/English OCR models are ready.'))
  .catch((error) => {
    console.error(error.message)
    process.exitCode = 1
  })
