import { ElectronAPI } from '@electron-toolkit/preload'

declare global {

  interface api {
    windowHeightChangeEvent
    updateTranslateContentEvent
    clearAllTranslateContentEvent
    pageHeightChangeEvent
    openSetPageEvent
    alwaysOnTopEvent
    windowHeightChangeMaxEvent
    logInfoEvent
    logErrorEvent
    screenshotEndNotifyEvent
    winShowEvent
    winShowByInputEvent
    apiUniteTranslate
    showMsgEvent
    updateTranslateServiceEvent
    updateTranslateServiceNotify
    apiTranslateResultMsgCallbackEvent
    agentApiTranslateCallback
    agentApiOcr
    agentApiOcrCallback
    updateCacheEvent
    winFontSizeNotify
    winSizeUpdate
  }

  interface Window {
    electron: ElectronAPI
    api: api
  }

}
