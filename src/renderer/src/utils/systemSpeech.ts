type SpeechLanguage = 'zh-CN' | 'en-US'

// 在中英文混排时优先选择中文声音，确保汉字不会交给英语声音。
export const getSpeechLanguage = (text: string): SpeechLanguage => {
  return /\p{Script=Han}/u.test(text) ? 'zh-CN' : 'en-US'
}

export const selectSpeechVoice = (
  voices: SpeechSynthesisVoice[],
  language: SpeechLanguage
): SpeechSynthesisVoice | undefined => {
  const target = language.toLowerCase()
  const prefix = target.split('-')[0]
  const normalize = (voice: SpeechSynthesisVoice): string => voice.lang.replace('_', '-').toLowerCase()
  const candidates = voices.filter((voice) => normalize(voice).split('-')[0] === prefix)
  const score = (voice: SpeechSynthesisVoice): number => {
    return (normalize(voice) === target ? 100 : 0) + (voice.localService ? 10 : 0) + (voice.default ? 1 : 0)
  }
  return candidates.sort((a, b) => score(b) - score(a))[0]
}

const loadVoices = (synth: SpeechSynthesis): Promise<SpeechSynthesisVoice[]> => {
  const voices = synth.getVoices()
  if (voices.length > 0) return Promise.resolve(voices)
  return new Promise((resolve) => {
    const finish = (): void => {
      clearTimeout(timeout)
      synth.removeEventListener('voiceschanged', onVoicesChanged)
      resolve(synth.getVoices())
    }
    const onVoicesChanged = (): void => {
      if (synth.getVoices().length > 0) finish()
    }
    const timeout = setTimeout(finish, 1500)
    synth.addEventListener('voiceschanged', onVoicesChanged)
    // 覆盖首次读取和注册监听之间声音列表已经就绪的情况。
    onVoicesChanged()
  })
}

let requestId = 0
let activeUtterance: SpeechSynthesisUtterance | null = null

export const playSystemSpeech = async (
  text: string,
  onError: (message: string) => void
): Promise<void> => {
  const currentRequest = ++requestId
  try {
    const synth = window.speechSynthesis
    synth.cancel()
    activeUtterance = null
    if (!text.trim()) return

    const language = getSpeechLanguage(text)
    const voices = await loadVoices(synth)
    // 连续点击时，仅播放最后一次请求。
    if (currentRequest !== requestId) return
    const voice = selectSpeechVoice(voices, language)
    if (!voice) {
      const name = language === 'zh-CN' ? '中文' : '英语'
      onError(`没有可用的${name}系统语音，请检查系统语音设置`)
      return
    }

    const msg = new SpeechSynthesisUtterance(text)
    msg.lang = voice.lang.replace('_', '-')
    msg.voice = voice
    activeUtterance = msg
    msg.onend = (): void => {
      if (activeUtterance === msg) activeUtterance = null
    }
    msg.onerror = (event): void => {
      if (activeUtterance === msg) activeUtterance = null
      if (currentRequest !== requestId || event.error === 'canceled' || event.error === 'interrupted') return
      onError(`系统语音播放失败：${event.error}`)
    }
    synth.speak(msg)
  } catch (error) {
    if (currentRequest === requestId) {
      activeUtterance = null
      onError(`系统语音播放失败：${error instanceof Error ? error.message : String(error)}`)
    }
  }
}
