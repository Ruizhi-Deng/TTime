import R from '../../../common/class/R'
import AgentTranslateCallbackVo from '../../../common/class/AgentTranslateCallbackVo'
import { OpenAIStatusEnum } from '../../../common/enums/OpenAIStatusEnum'
import { buildAiRequest, readAiResponse, readAiStream } from '../../../common/utils/aiRequest'
import { findAiPrompt } from '../../../common/utils/aiPrompts'
import { cacheGet } from '../utils/cacheUtil'

const requests = new Map<string, AbortController>()

async function* readChunks(body: ReadableStream<Uint8Array>) {
  const reader = body.getReader()
  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) return
      yield value
    }
  } finally {
    await reader.cancel()
    reader.releaseLock()
  }
}

export const requestAiTranslation = async (info): Promise<void> => {
  const check = info.isTranslateCheckType
  const key = `${check ? 'check' : 'translate'}:${info.id}`
  requests.get(key)?.abort()
  const controller = new AbortController()
  requests.set(key, controller)
  const callback = (code: number, response): void => {
    if (requests.get(key) !== controller) return
    const result = new AgentTranslateCallbackVo(info, response)
    window.api.agentApiTranslateCallback(code === R.ERROR ? R.errorD(result) : R.okD(result))
  }
  if (!check) callback(R.SUCCESS, { code: OpenAIStatusEnum.START })
  try {
    const prompt = findAiPrompt(cacheGet('aiPrompts'), info.aiPromptId)
    const stream = !check && info.stream
    const request = buildAiRequest({ ...info, prompt }, stream)
    const response = await fetch(request.url, {
      method: 'POST',
      headers: request.headers,
      body: JSON.stringify(request.body),
      signal: controller.signal
    })
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${await response.text()}`)
    if (stream) {
      for await (const text of readAiStream(info.type, readChunks(response.body))) {
        callback(R.SUCCESS, { code: OpenAIStatusEnum.ING, content: text })
      }
    } else {
      const text = readAiResponse(info.type, await response.json())
      if (check) {
        callback(R.SUCCESS, { content: text })
        return
      }
      callback(R.SUCCESS, { code: OpenAIStatusEnum.ING, content: text })
    }
    callback(R.SUCCESS, { code: OpenAIStatusEnum.END })
  } catch (error) {
    if (!controller.signal.aborted)
      callback(R.ERROR, { code: OpenAIStatusEnum.ERROR, error: error.message })
  } finally {
    if (requests.get(key) === controller) requests.delete(key)
  }
}
