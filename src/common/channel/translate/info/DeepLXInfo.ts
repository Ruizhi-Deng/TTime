import DeepLInfo from './DeepLInfo'

export default {
  name: 'DeepLX',
  isKey: true,
  isOneAppKey: true,
  keyRequired: false,
  defaultInfo: { requestUrl: 'http://127.0.0.1:1188/translate' },
  languageList: DeepLInfo.languageList
}
