import { app, ipcMain } from 'electron'
import path from 'path'
import axios from 'axios'
import { OcrModelCache } from '../../common/ocr/modelCache'
import { injectAgent } from '../utils/RequestUtil'

const directory = path.join(app.getPath('userData'), 'ocr-models')
const bundledDirectory = app.isPackaged
  ? path.join(process.resourcesPath, 'app.asar.unpacked', 'ocr', 'models')
  : path.join(app.getAppPath(), 'ocr', 'models')

export const localOcrModels = new OcrModelCache(directory, bundledDirectory, async (url) => {
  const options = { responseType: 'arraybuffer' as const, timeout: 60000, proxy: false as const }
  await injectAgent(options)
  const response = await axios.get(url, options)
  return Buffer.from(response.data)
})

ipcMain.handle('local-ocr-model-status', (_event, language: string) => ({
  ready: localOcrModels.isReady(language),
  directory
}))

ipcMain.handle('prepare-local-ocr-models', async (_event, language: string) => {
  try {
    await localOcrModels.prepare(language)
    return { ready: true, directory }
  } catch (error: any) {
    return { ready: false, error: error.message, directory }
  }
})
