import { ElectronAPI } from '@electron-toolkit/preload'

declare global {

  interface api {
    updateTranslateShortcutKeyEvent
    getSystemTypeEvent
    closeSetWinEvent
    localOcrModelStatus
    prepareLocalOcrModels
    autoLaunchEvent
    updateTranslateServiceNotify
    apiUniteTranslateCheck
    apiCheckTranslateCallbackEvent
    apiUniteAgentCheck
    apiUniteAgentCheckCallbackEvent
    apiUniteOcrCheck
    apiCheckOcrCallbackEvent
    getVersionEvent
    agentUpdateEvent
    alwaysOnTopAllowEscStatusNotify
    openDirectoryDialog
    openDirectoryDialogCallback
    updateConfigInfoPath
    setWinFocusEvent
    winFontSizeNotify
    winShowEvent
  }

  interface Window {
    electron: ElectronAPI
    api: api
  }

}
