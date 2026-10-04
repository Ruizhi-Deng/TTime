import languageList from '../aiLanguageList'

export default {
  name: 'DeepSeek',
  isKey: true,
  isOneAppKey: true,
  keyRequired: true,
  defaultInfo: {
    model: '',
    requestUrl: 'https://api.deepseek.com/chat/completions',
    aiPromptId: 'translate',
    stream: true,
    requestArguments: ''
  },
  languageList
}
