import TranslateAgent from '../product/translate/TranslateAgent'
import ITranslateAgentInterface from '../product/translate/ITranslateAgentInterface'
import GlobalWin from '../../GlobalWin'
import TranslateChannelFactory from '../factory/TranslateChannelFactory'
import R from '../../../../common/class/R'

export default class AiChannel extends TranslateAgent implements ITranslateAgentInterface {
  apiTranslateCallback(res: R): void {
    const { request: info, response: data } = res.data as any
    GlobalWin.mainWinSend(
      TranslateChannelFactory.callbackName(info.type),
      R.okCIT(data.code, info, res.code === R.ERROR ? data.error : data.content || '')
    )
  }

  apiTranslateCheckCallback(res: R): void {
    const { request: info, response: data } = res.data as any
    GlobalWin.setWin.webContents.send(
      'api-check-translate-callback-event',
      info.type,
      res.code === R.ERROR ? R.errorMD(data.error, info.responseData) : R.okD(info.responseData)
    )
  }
}
