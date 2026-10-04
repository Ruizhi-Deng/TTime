export const buildDeepLXRequest = (info) => ({
  url: info.requestUrl,
  headers: {
    'Content-Type': 'application/json',
    ...(info.appKey ? { Authorization: `Bearer ${info.appKey}` } : {})
  },
  data: {
    text: info.translateContent,
    source_lang: info.languageType === 'auto' ? 'AUTO' : info.languageType,
    target_lang: info.languageResultType
  }
})

export const readDeepLXResponse = (response): string => {
  if (response.code !== 200) throw new Error(response.message || `DeepLX ${response.code}`)
  if (typeof response.data !== 'string') throw new Error('DeepLX 未返回文本结果')
  return response.data
}
