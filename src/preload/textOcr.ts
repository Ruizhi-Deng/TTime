import { ipcRenderer } from 'electron'
import { PaddleOcr } from '../common/ocr/PaddleOcr'

const engine = new PaddleOcr()
let latestRequestId = 0
let queue = Promise.resolve()

const imageData = async (base64: string): Promise<ImageData> => {
  const image = new Image()
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve()
    image.onerror = () => reject(new Error('无法读取 OCR 图片'))
    image.src = base64
  })
  const canvas = document.createElement('canvas')
  canvas.width = image.naturalWidth
  canvas.height = image.naturalHeight
  const context = canvas.getContext('2d')!
  context.fillStyle = '#fff'
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.drawImage(image, 0, 0)
  return context.getImageData(0, 0, canvas.width, canvas.height)
}

ipcRenderer.on('local-ocr', (_event, job) => {
  latestRequestId = job.requestId
  // Inference sessions and OpenCV memory belong to one job at a time.
  queue = queue.then(async () => {
    if (job.requestId !== latestRequestId) return
    try {
      await engine.initialize(job.models)
      const result = await engine.recognize(await imageData(job.image), job.language, job.merge)
      if (job.requestId === latestRequestId)
        await ipcRenderer.invoke('local-ocr-result', job.requestId, result)
    } catch (error: any) {
      if (job.requestId === latestRequestId)
        await ipcRenderer.invoke('local-ocr-error', job.requestId, error.message)
    }
  })
})
