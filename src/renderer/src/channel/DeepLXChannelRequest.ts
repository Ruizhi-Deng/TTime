import R from '../../../common/class/R'
import AgentTranslateCallbackVo from '../../../common/class/AgentTranslateCallbackVo'
import { buildDeepLXRequest, readDeepLXResponse } from '../../../common/utils/deepLXRequest'

export const requestDeepLXTranslation = async (info): Promise<void> => {
  try {
    const request = buildDeepLXRequest(info)
    const response = await fetch(request.url, {
      method: 'POST',
      headers: request.headers,
      body: JSON.stringify(request.data)
    })
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${await response.text()}`)
    const text = readDeepLXResponse(await response.json())
    window.api.agentApiTranslateCallback(
      R.okD(new AgentTranslateCallbackVo(info, { content: text }))
    )
  } catch (error) {
    window.api.agentApiTranslateCallback(
      R.errorD(new AgentTranslateCallbackVo(info, { error: error.message }))
    )
  }
}
