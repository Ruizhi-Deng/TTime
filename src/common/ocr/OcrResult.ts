export type OcrPoint = [number, number]
export type OcrBox = [OcrPoint, OcrPoint, OcrPoint, OcrPoint]

export interface OcrLine {
  text: string
  confidence: number
  detectionConfidence: number
  box: OcrBox
}

export interface OcrParagraph {
  text: string
  lineIndices: number[]
}

export interface OcrResult {
  language: string
  width: number
  height: number
  lines: OcrLine[]
  paragraphs: OcrParagraph[]
  allText: string
}

const bounds = (line: OcrLine) => {
  const x = line.box.map((point) => point[0])
  const y = line.box.map((point) => point[1])
  return {
    left: Math.min(...x),
    right: Math.max(...x),
    top: Math.min(...y),
    bottom: Math.max(...y)
  }
}

export const sortOcrLines = (lines: OcrLine[]): OcrLine[] => {
  const ordered = [...lines].sort((a, b) => bounds(a).top - bounds(b).top)
  const rows: OcrLine[][] = []
  for (const line of ordered) {
    const b = bounds(line)
    const row = rows.find((items) => {
      const r = bounds(items[0])
      const overlap = Math.min(b.bottom, r.bottom) - Math.max(b.top, r.top)
      return overlap > Math.min(b.bottom - b.top, r.bottom - r.top) * 0.5
    })
    if (row) row.push(line)
    else rows.push([line])
  }
  return rows.flatMap((row) => row.sort((a, b) => bounds(a).left - bounds(b).left))
}

const joinText = (left: string, right: string): string => {
  if (/\s$/.test(left) || /^\s/.test(right)) return left + right
  const cjk = /[\u3000-\u9fff]$/
  if (cjk.test(left) && /^[\u3000-\u9fff]/.test(right)) return left + right
  return left + ' ' + right
}

export const composeOcrResult = (
  input: OcrLine[],
  language: string,
  width: number,
  height: number,
  merge: boolean
): OcrResult => {
  const lines = sortOcrLines(input)
  const paragraphs: OcrParagraph[] = []
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index]
    const previous = lines[index - 1]
    let continues = false
    if (merge && previous) {
      const a = bounds(previous)
      const b = bounds(line)
      const size = Math.min(a.bottom - a.top, b.bottom - b.top)
      const verticalGap = b.top - a.bottom
      const horizontalGap = b.left - a.right
      const sameRow = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > size * 0.5
      const aligned = Math.abs(a.left - b.left) < size * 1.5
      const similarSize = Math.max(a.bottom - a.top, b.bottom - b.top) < size * 1.4
      const listStart = /^(?:[-•●▪]|\d+[.)、])\s?/.test(line.text)
      const rotated = Math.abs(line.box[1][1] - line.box[0][1]) > size * 0.3
      const previousRotated = Math.abs(previous.box[1][1] - previous.box[0][1]) > size * 0.3
      continues =
        !rotated &&
        !previousRotated &&
        similarSize &&
        !listStart &&
        ((sameRow && horizontalGap >= 0 && horizontalGap < size * 1.5) ||
          (!sameRow && aligned && verticalGap >= 0 && verticalGap < size * 0.7))
    }
    if (continues) {
      const paragraph = paragraphs[paragraphs.length - 1]
      paragraph.text = joinText(paragraph.text, line.text)
      paragraph.lineIndices.push(index)
    } else paragraphs.push({ text: line.text, lineIndices: [index] })
  }
  return {
    language,
    width,
    height,
    lines,
    paragraphs,
    allText: paragraphs.map((p) => p.text).join('\n')
  }
}
