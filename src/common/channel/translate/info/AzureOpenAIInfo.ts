import languageList from '../aiLanguageList'

export default {
  name: 'Azure OpenAI',
  isKey: true,
  isOneAppKey: true,
  keyRequired: true,
  defaultInfo: {
    model: '',
    requestUrl: '',
    aiPromptId: 'translate',
    stream: true
  },
  languageList
}
