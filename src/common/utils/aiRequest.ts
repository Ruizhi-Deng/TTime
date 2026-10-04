import TranslateServiceEnum from '../enums/TranslateServiceEnum'
import { AiPrompt, buildPromptMessages } from './aiPrompts'

export const aiServiceTypes = [
  TranslateServiceEnum.OPEN_AI,
  TranslateServiceEnum.DEEP_SEEK,
  TranslateServiceEnum.GEMINI,
  TranslateServiceEnum.ZHIPU
]

export interface AiRequestInfo {
  type: string
  model: string
  requestUrl: string
  appKey: string
  prompt: AiPrompt
  translateContent: string
  languageType: string
  languageResultType: string
}

export const buildAiRequest = (info: AiRequestInfo, stream: boolean) => {
  const messages = buildPromptMessages(
    info.prompt,
    info.translateContent,
    info.languageType,
    info.languageResultType
  )
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (info.type === TranslateServiceEnum.GEMINI) {
    headers['x-goog-api-key'] = info.appKey
    const system = messages.find((message) => message.role === 'system')
    return {
      url: `${info.requestUrl.replace(/\/$/, '')}/models/${encodeURIComponent(info.model)}:${
        stream ? 'streamGenerateContent?alt=sse' : 'generateContent'
      }`,
      headers,
      body: {
        ...(system ? { systemInstruction: { parts: [{ text: system.content }] } } : {}),
        contents: [{ role: 'user', parts: [{ text: messages[messages.length - 1].content }] }]
      }
    }
  }
  if (info.appKey) headers.Authorization = `Bearer ${info.appKey}`
  return {
    url: info.requestUrl,
    headers,
    body: {
      model: info.model,
      messages,
      stream
    }
  }
}

export const readAiResponse = (type: string, data): string => {
  if (data.error) throw new Error(typeof data.error === 'string' ? data.error : data.error.message)
  let text: string
  if (type === TranslateServiceEnum.GEMINI) {
    text = data.candidates?.[0]?.content?.parts
      ?.filter((part) => !part.thought)
      .map((part) => part.text || '')
      .join('')
  } else text = data.choices[0].message.content
  if (!text) throw new Error('服务未返回文本结果')
  return text
}

const readChunk = (type: string, data): { text: string; done: boolean } => {
  if (data.error) throw new Error(typeof data.error === 'string' ? data.error : data.error.message)
  if (type === TranslateServiceEnum.GEMINI) {
    const candidate = data.candidates?.[0]
    return {
      text:
        candidate?.content?.parts
          ?.filter((part) => !part.thought)
          .map((part) => part.text || '')
          .join('') || '',
      done: Boolean(candidate?.finishReason)
    }
  }
  const choice = data.choices[0]
  return { text: choice?.delta?.content || '', done: Boolean(choice?.finish_reason) }
}

export async function* readAiStream(
  type: string,
  chunks: AsyncIterable<Uint8Array>
): AsyncGenerator<string> {
  const decoder = new TextDecoder()
  let buffer = ''
  let eventData: string[] = []
  let completed = false
  let receivedText = false
  const consumeLine = (line: string): { text: string; done: boolean } | undefined => {
    if (line.startsWith('data:')) eventData.push(line.slice(5).trimStart())
    if (line !== '' || eventData.length === 0) return
    const payload = eventData.join('\n')
    eventData = []
    return payload === '[DONE]' ? { text: '', done: true } : readChunk(type, JSON.parse(payload))
  }
  for await (const chunk of chunks) {
    buffer += decoder.decode(chunk, { stream: true })
    let newline: number
    while ((newline = buffer.indexOf('\n')) !== -1) {
      const line = buffer.slice(0, newline).replace(/\r$/, '')
      buffer = buffer.slice(newline + 1)
      const result = consumeLine(line)
      if (result?.text) {
        receivedText = true
        yield result.text
      }
      if (result?.done) {
        completed = true
        break
      }
    }
    if (completed) break
  }
  if (!completed) {
    buffer += decoder.decode()
    consumeLine(buffer.replace(/\r$/, ''))
    const event = consumeLine('')
    if (event?.text) {
      receivedText = true
      yield event.text
    }
    completed = event?.done === true
  }
  if (!completed) throw new Error('流式响应提前结束')
  if (!receivedText) throw new Error('服务未返回文本结果')
}
