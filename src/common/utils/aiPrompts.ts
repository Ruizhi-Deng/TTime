export interface AiPrompt {
  id: string
  name: string
  systemPrompt: string
  userPrompt: string
}

export const defaultAiPrompts: AiPrompt[] = [
  {
    id: 'translate',
    name: '翻译',
    systemPrompt:
      'You are a professional translator. Return only the translated text, preserving its meaning and formatting.',
    userPrompt: 'Translate the following text from {{source}} into {{target}}:\n\n{{text}}'
  },
  {
    id: 'polish',
    name: '润色',
    systemPrompt:
      'Polish the text for clarity and natural wording. Preserve its meaning. Return only the polished text.',
    userPrompt: 'Polish this text in {{source}}:\n\n{{text}}'
  },
  {
    id: 'summarize',
    name: '总结',
    systemPrompt: 'Summarize the text concisely and accurately.',
    userPrompt: 'Summarize this text in {{source}}:\n\n{{text}}'
  },
  {
    id: 'analyze',
    name: '分析',
    systemPrompt: 'Explain the meaning and grammar of the provided text.',
    userPrompt: 'Analyze this text in {{source}}:\n\n{{text}}'
  },
  {
    id: 'code',
    name: '解释代码',
    systemPrompt:
      'Explain the provided code, regex or script concisely. Point out errors when present.',
    userPrompt: 'Explain this code in {{source}}:\n\n{{text}}'
  }
]

export const buildPromptMessages = (
  prompt: AiPrompt,
  text: string,
  source: string,
  target: string
) => {
  const values = { text, source, target }
  const render = (template: string): string =>
    template.replace(/\{\{\s*(text|source|target)\s*\}\}/g, (_, key) => values[key])
  const messages: Array<{ role: string; content: string }> = []
  if (prompt.systemPrompt.trim())
    messages.push({ role: 'system', content: render(prompt.systemPrompt) })
  messages.push({ role: 'user', content: render(prompt.userPrompt) })
  return messages
}

export const findAiPrompt = (prompts: AiPrompt[], id: string): AiPrompt => {
  const prompt = prompts.find((item) => item.id === id)
  if (!prompt) throw new Error('请选择可用的本地提示词')
  return prompt
}
