import languageList from '../aiLanguageList'

export default {
  name: 'Ollama',
  isKey: true,
  isOneAppKey: true,
  keyRequired: false,
  defaultInfo: {
    model: '',
    requestUrl: 'http://127.0.0.1:11434/api/chat',
    aiPromptId: 'translate',
    stream: true
  },
  languageList
}
