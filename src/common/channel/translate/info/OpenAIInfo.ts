import languageList from '../aiLanguageList'

export default {
  name: 'OpenAI',
  isKey: true,
  isOneAppKey: true,
  keyRequired: false,
  defaultInfo: {
    model: '',
    requestUrl: 'https://api.openai.com/v1/chat/completions',
    aiPromptId: 'translate',
    stream: true,
    requestArguments: ''
  },
  languageList
}
