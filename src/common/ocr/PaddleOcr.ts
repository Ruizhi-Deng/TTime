import { readFileSync } from 'fs'
import { OcrBox, OcrLine, composeOcrResult } from './OcrResult'
import { decodeCtc, modelCharacters } from './recognition'

const cv = require('opencv.js')
const ort = require('onnxruntime-node')
const Clipper = require('clipper-lib')

export interface OcrImage {
  width: number
  height: number
  data: Uint8ClampedArray | Uint8Array
}

const orderBox = (points: Array<[number, number]>): OcrBox => {
  const sorted = [...points].sort((a, b) => a[0] - b[0])
  const left = sorted.slice(0, 2).sort((a, b) => a[1] - b[1])
  const right = sorted.slice(2).sort((a, b) => a[1] - b[1])
  return [left[0], right[0], right[1], left[1]]
}

const minimumBox = (contour): { box: OcrBox; size: number } => {
  const rectangle = cv.minAreaRect(contour)
  const angle = (rectangle.angle * Math.PI) / 180
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  const points = [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1]
  ].map(([x, y]) => {
    const dx = (x * rectangle.size.width) / 2
    const dy = (y * rectangle.size.height) / 2
    return [rectangle.center.x + dx * cos - dy * sin, rectangle.center.y + dx * sin + dy * cos] as [
      number,
      number
    ]
  })
  return { box: orderBox(points), size: Math.min(rectangle.size.width, rectangle.size.height) }
}

const distance = (a, b): number => Math.hypot(a[0] - b[0], a[1] - b[1])

const boxScore = (box: OcrBox, data: Float32Array, width: number, height: number): number => {
  const left = Math.max(0, Math.floor(Math.min(...box.map((p) => p[0]))))
  const right = Math.min(width - 1, Math.ceil(Math.max(...box.map((p) => p[0]))))
  const top = Math.max(0, Math.floor(Math.min(...box.map((p) => p[1]))))
  const bottom = Math.min(height - 1, Math.ceil(Math.max(...box.map((p) => p[1]))))
  let total = 0
  let count = 0
  for (let y = top; y <= bottom; y++)
    for (let x = left; x <= right; x++) {
      const cross = box.map((a, index) => {
        const b = box[(index + 1) % 4]
        return (b[0] - a[0]) * (y + 0.5 - a[1]) - (b[1] - a[1]) * (x + 0.5 - a[0])
      })
      if (cross.every((v) => v >= 0) || cross.every((v) => v <= 0)) {
        total += data[y * width + x]
        count++
      }
    }
  return count ? total / count : 0
}

const unclipBox = (box: OcrBox): OcrBox | undefined => {
  const precision = 1024
  const polygon = box.map(([x, y]) => ({
    X: Math.round(x * precision),
    Y: Math.round(y * precision)
  }))
  const area = Math.abs(Clipper.Clipper.Area(polygon))
  const perimeter =
    box.reduce((sum, p, index) => sum + distance(p, box[(index + 1) % 4]), 0) * precision
  const offset = new Clipper.ClipperOffset()
  offset.AddPath(polygon, Clipper.JoinType.jtRound, Clipper.EndType.etClosedPolygon)
  const expanded = new Clipper.Paths()
  offset.Execute(expanded, (area * 1.6) / perimeter)
  if (expanded.length !== 1) return
  const points = expanded[0].flatMap((p) => [p.X / precision, p.Y / precision])
  const contour = cv.matFromArray(points.length / 2, 1, cv.CV_32FC2, points)
  try {
    const result = minimumBox(contour)
    return result.size >= 5 ? result.box : undefined
  } finally {
    contour.delete()
  }
}

export const detectionBoxes = (
  data: Float32Array,
  width: number,
  height: number,
  imageWidth: number,
  imageHeight: number
): Array<{ box: OcrBox; confidence: number }> => {
  const bitmap = cv.matFromArray(
    height,
    width,
    cv.CV_8UC1,
    Uint8Array.from(data, (value) => (value > 0.3 ? 255 : 0))
  )
  const kernel = cv.Mat.ones(2, 2, cv.CV_8U)
  const contours = new cv.MatVector()
  const hierarchy = new cv.Mat()
  const boxes: Array<{ box: OcrBox; confidence: number }> = []
  try {
    cv.dilate(bitmap, bitmap, kernel)
    cv.findContours(bitmap, contours, hierarchy, cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE)
    for (let index = 0; index < Math.min(contours.size(), 1000); index++) {
      const contour = contours.get(index)
      try {
        const result = minimumBox(contour)
        if (result.size < 3) continue
        const confidence = boxScore(result.box, data, width, height)
        if (confidence < 0.5) continue
        const expanded = unclipBox(result.box)
        if (!expanded) continue
        const box = expanded.map(([x, y]) => [
          Math.max(0, Math.min(imageWidth - 1, (x * imageWidth) / width)),
          Math.max(0, Math.min(imageHeight - 1, (y * imageHeight) / height))
        ]) as OcrBox
        boxes.push({ box, confidence })
      } finally {
        contour.delete()
      }
    }
  } finally {
    bitmap.delete()
    kernel.delete()
    contours.delete()
    hierarchy.delete()
  }
  return boxes
}

const imageTensor = (
  image,
  height: number,
  width: number,
  mean: number[],
  std: number[],
  resizedWidth = width
) => {
  const resized = new cv.Mat()
  const bgr = new cv.Mat()
  try {
    cv.resize(image, resized, new cv.Size(resizedWidth, height), 0, 0, cv.INTER_LINEAR)
    cv.cvtColor(resized, bgr, cv.COLOR_RGBA2BGR)
    const data = new Float32Array(3 * height * width)
    for (let y = 0; y < height; y++)
      for (let x = 0; x < resizedWidth; x++)
        for (let channel = 0; channel < 3; channel++)
          data[channel * height * width + y * width + x] =
            (bgr.data[(y * resizedWidth + x) * 3 + channel] / 255 - mean[channel]) / std[channel]
    return new ort.Tensor('float32', data, [1, 3, height, width])
  } finally {
    resized.delete()
    bgr.delete()
  }
}

const cropBox = (image, box: OcrBox) => {
  const width = Math.max(
    1,
    Math.round(Math.max(distance(box[0], box[1]), distance(box[2], box[3])))
  )
  const height = Math.max(
    1,
    Math.round(Math.max(distance(box[0], box[3]), distance(box[1], box[2])))
  )
  const source = cv.matFromArray(4, 1, cv.CV_32FC2, box.flat())
  const target = cv.matFromArray(4, 1, cv.CV_32FC2, [
    0,
    0,
    width - 1,
    0,
    width - 1,
    height - 1,
    0,
    height - 1
  ])
  const transform = cv.getPerspectiveTransform(source, target)
  const result = new cv.Mat()
  try {
    cv.warpPerspective(
      image,
      result,
      transform,
      new cv.Size(width, height),
      cv.INTER_CUBIC,
      cv.BORDER_REPLICATE
    )
    if (height / width >= 1.5) {
      cv.transpose(result, result)
      cv.flip(result, result, 0)
    }
    return result
  } finally {
    source.delete()
    target.delete()
    transform.delete()
  }
}

// Keep the active family resident; switching families releases the preceding sessions.
export class PaddleOcr {
  private models?: { det: string; rec: string; cls: string; englishRec?: string }
  private sessions?: { det; rec; cls; englishRec? }
  private characters: string[] = []
  private englishCharacters: string[] = []

  async initialize(models: {
    det: string
    rec: string
    cls: string
    englishRec?: string
  }): Promise<void> {
    if (this.models?.rec === models.rec && this.models?.det === models.det) return
    if (this.sessions)
      await Promise.all(Object.values(this.sessions).map((session) => session.release()))
    this.sessions = undefined
    this.models = undefined
    const [det, rec, cls] = await Promise.all(
      [models.det, models.rec, models.cls].map((file) =>
        ort.InferenceSession.create(file, {
          executionProviders: ['cpu'],
          intraOpNumThreads: 2,
          interOpNumThreads: 1
        })
      )
    )
    this.sessions = { det, rec, cls }
    if (models.englishRec) {
      this.sessions.englishRec = await ort.InferenceSession.create(models.englishRec, {
        executionProviders: ['cpu'],
        intraOpNumThreads: 2,
        interOpNumThreads: 1
      })
      this.englishCharacters = modelCharacters(readFileSync(models.englishRec))
    }
    this.characters = modelCharacters(readFileSync(models.rec))
    this.models = models
  }

  async dispose(): Promise<void> {
    if (this.sessions)
      await Promise.all(Object.values(this.sessions).map((session) => session.release()))
    this.sessions = undefined
    this.models = undefined
  }

  private async run(session, tensor) {
    const result = await session.run({ [session.inputNames[0]]: tensor })
    return result[session.outputNames[0]]
  }

  private async recognizeEnglishSpans(crop, recognized, steps: number): Promise<string> {
    const glyphs = recognized.glyphs
    let text = ''
    let index = 0
    while (index < glyphs.length) {
      if (!/^[\x20-\x7e]$/.test(glyphs[index].character)) {
        text += glyphs[index++].character
        continue
      }
      const start = index
      while (index < glyphs.length && /^[\x20-\x7e]$/.test(glyphs[index].character)) index++
      const original = glyphs
        .slice(start, index)
        .map((glyph) => glyph.character)
        .join('')
      if ((original.match(/[a-zA-Z]/g) || []).length < 3 || original.includes(' ')) {
        text += original
        continue
      }
      const left =
        start === 0
          ? 0
          : Math.floor(((glyphs[start - 1].end + glyphs[start].start) / 2 / steps) * crop.cols)
      const right =
        index === glyphs.length
          ? crop.cols
          : Math.ceil(((glyphs[index - 1].end + glyphs[index].start) / 2 / steps) * crop.cols)
      const region = crop.roi(new cv.Rect(left, 0, Math.max(1, right - left), crop.rows))
      try {
        const width = Math.max(8, Math.ceil((48 * region.cols) / region.rows))
        const output = await this.run(
          this.sessions!.englishRec,
          imageTensor(region, 48, width, [0.5, 0.5, 0.5], [0.5, 0.5, 0.5])
        )
        const english = decodeCtc(
          output.data,
          output.dims[1],
          output.dims[2],
          this.englishCharacters
        )
        text += english.confidence >= 0.5 ? english.text : original
      } finally {
        region.delete()
      }
    }
    return text
  }

  async recognize(input: OcrImage, language: string, merge: boolean) {
    const sessions = this.sessions!
    const image = cv.matFromArray(input.height, input.width, cv.CV_8UC4, input.data)
    const lines: OcrLine[] = []
    try {
      const scale = Math.min(2, 1280 / Math.max(input.width, input.height))
      const height = Math.max(32, Math.round((input.height * scale) / 32) * 32)
      const width = Math.max(32, Math.round((input.width * scale) / 32) * 32)
      const detected = await this.run(
        sessions.det,
        imageTensor(image, height, width, [0.485, 0.456, 0.406], [0.229, 0.224, 0.225])
      )
      const boxes = detectionBoxes(
        detected.data,
        detected.dims[3],
        detected.dims[2],
        input.width,
        input.height
      )
      for (const { box, confidence } of boxes) {
        const crop = cropBox(image, box)
        try {
          const clsWidth = Math.min(192, Math.ceil((48 * crop.cols) / crop.rows))
          const orientation = await this.run(
            sessions.cls,
            imageTensor(crop, 48, 192, [0.5, 0.5, 0.5], [0.5, 0.5, 0.5], clsWidth)
          )
          if (orientation.data[1] > 0.9) cv.flip(crop, crop, -1)
          const recWidth = Math.max(8, Math.ceil((48 * crop.cols) / crop.rows))
          const output = await this.run(
            sessions.rec,
            imageTensor(crop, 48, recWidth, [0.5, 0.5, 0.5], [0.5, 0.5, 0.5])
          )
          const recognized = decodeCtc(output.data, output.dims[1], output.dims[2], this.characters)
          if (language === 'ch')
            recognized.text = await this.recognizeEnglishSpans(crop, recognized, output.dims[1])
          if (recognized.text && recognized.confidence >= 0.5)
            lines.push({
              text: recognized.text,
              confidence: recognized.confidence,
              box,
              detectionConfidence: confidence
            })
        } finally {
          crop.delete()
        }
      }
    } finally {
      image.delete()
    }
    return composeOcrResult(lines, language, input.width, input.height, merge)
  }
}
