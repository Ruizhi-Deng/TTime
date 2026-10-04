import languageList from '../aiLanguageList'

export default {
  name: 'Gemini',
  isKey: true,
  isOneAppKey: true,
  keyRequired: true,
  defaultInfo: {
    model: '',
    requestUrl: 'https://generativelanguage.googleapis.com/v1beta',
    aiPromptId: 'translate',
    stream: true,
    requestArguments: ''
  },
  languageList
}
