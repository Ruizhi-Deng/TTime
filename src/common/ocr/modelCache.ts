import { promises as fs, existsSync } from 'fs'
import path from 'path'
import { createHash } from 'crypto'
import axios from 'axios'
import registry from './models.json'

export const ocrLanguages = registry.languages
export const modelPath = (directory: string, id: string): string => {
  const model = registry.models[id]
  return path.join(directory, model.sha256, model.file)
}

export class OcrModelCache {
  private pending = new Map<string, Promise<string>>()

  constructor(
    private directory: string,
    private bundledDirectory: string,
    private download = async (url: string): Promise<Buffer> => {
      const response = await axios.get(url, { responseType: 'arraybuffer', timeout: 60000 })
      return Buffer.from(response.data)
    }
  ) {}

  isReady(language: string): boolean {
    return this.ids(language).every((id) => existsSync(modelPath(this.directory, id)))
  }

  private ids(language: string): string[] {
    const family = registry.languages.find((item) => item.id === language)
    if (!family) throw new Error('请选择可用的 OCR 语言')
    return [
      family.det,
      family.rec,
      registry.classifier,
      ...(language === 'ch' ? ['en_PP-OCRv4_rec_mobile'] : [])
    ]
  }

  async prepare(
    language: string
  ): Promise<{ det: string; rec: string; cls: string; englishRec?: string }> {
    const [det, rec, cls, englishRec] = await Promise.all(
      this.ids(language).map((id) => this.load(id))
    )
    return { det, rec, cls, ...(englishRec ? { englishRec } : {}) }
  }

  private load(id: string): Promise<string> {
    const destination = modelPath(this.directory, id)
    if (existsSync(destination)) return Promise.resolve(destination)
    const pending = this.pending.get(id)
    if (pending) return pending
    const work = this.writeModel(id, destination).finally(() => this.pending.delete(id))
    this.pending.set(id, work)
    return work
  }

  private async writeModel(id: string, destination: string): Promise<string> {
    const model = registry.models[id]
    const bundled = modelPath(this.bundledDirectory, id)
    const bytes = existsSync(bundled) ? await fs.readFile(bundled) : await this.download(model.url)
    if (createHash('sha256').update(bytes).digest('hex') !== model.sha256)
      throw new Error(`OCR 模型校验失败：${model.file}`)
    await fs.mkdir(path.dirname(destination), { recursive: true })
    await fs.writeFile(destination + '.part', bytes)
    await fs.rename(destination + '.part', destination)
    return destination
  }
}
