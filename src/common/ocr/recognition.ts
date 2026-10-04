// ONNX metadata contains the recognition alphabet used by RapidOCR's exported models.
export const modelCharacters = (bytes: Uint8Array): string[] => {
  const decoder = new TextDecoder()
  const fields = (message: Uint8Array): Array<{ id: number; bytes: Uint8Array }> => {
    let offset = 0
    const integer = (): number => {
      let result = 0
      let shift = 0
      let value: number
      do {
        value = message[offset++]
        result += (value & 127) * 2 ** shift
        shift += 7
      } while (value & 128)
      return result
    }
    const result: Array<{ id: number; bytes: Uint8Array }> = []
    while (offset < message.length) {
      const tag = integer()
      const wire = tag & 7
      if (wire === 2) {
        const length = integer()
        result.push({ id: tag >>> 3, bytes: message.subarray(offset, offset + length) })
        offset += length
      } else if (wire === 0) integer()
      else if (wire === 1) offset += 8
      else if (wire === 5) offset += 4
      else throw new Error('不支持的 ONNX 数据字段')
    }
    return result
  }
  for (const entry of fields(bytes).filter((field) => field.id === 14)) {
    const values = fields(entry.bytes)
    if (decoder.decode(values.find((field) => field.id === 1)!.bytes) === 'character') {
      const alphabet = decoder
        .decode(values.find((field) => field.id === 2)!.bytes)
        .replace(/\n$/, '')
        .split('\n')
      return ['', ...alphabet, ' ']
    }
  }
  throw new Error('OCR 模型缺少字符表')
}

export const decodeCtc = (
  data: Float32Array,
  steps: number,
  classes: number,
  characters: string[]
) => {
  if (classes !== characters.length) throw new Error('OCR 模型字符表与输出不一致')
  let text = ''
  let confidence = 0
  let count = 0
  let previous = -1
  const glyphs: Array<{ character: string; start: number; end: number }> = []
  for (let step = 0; step < steps; step++) {
    let best = 0
    for (let index = 1; index < classes; index++)
      if (data[step * classes + index] > data[step * classes + best]) best = index
    if (best !== 0 && best !== previous) {
      text += characters[best]
      confidence += data[step * classes + best]
      count++
      glyphs.push({ character: characters[best], start: step, end: step + 1 })
    } else if (best !== 0 && best === previous) {
      glyphs[glyphs.length - 1].end = step + 1
    }
    previous = best
  }
  return { text, confidence: count ? confidence / count : 0, glyphs }
}
