import languageList from '../aiLanguageList'

export default {
  name: '智谱 GLM',
  isKey: true,
  isOneAppKey: true,
  keyRequired: true,
  defaultInfo: {
    model: '',
    requestUrl: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
    aiPromptId: 'translate',
    stream: true,
    requestArguments: ''
  },
  languageList
}
