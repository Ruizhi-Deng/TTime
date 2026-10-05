!define APP_NAME "TTime Community"
!define MUI_FINISHPAGE_LINK "项目主页 : https://github.com/Ruizhi-Deng/TTime"
!define MUI_FINISHPAGE_LINK_LOCATION "https://github.com/Ruizhi-Deng/TTime"

; 开机自启配置必须在 BUILD_UNINSTALLER 这里面加载 否则打包时会报错
!ifndef BUILD_UNINSTALLER
  ; 添加开机自启配置
  Function AutoStartup
      WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "${APP_NAME}" "$INSTDIR\${APP_NAME}.exe"
  FunctionEnd

  !define MUI_FINISHPAGE_SHOWREADME
  !define MUI_FINISHPAGE_SHOWREADME_TEXT "开机自启"
  !define MUI_FINISHPAGE_SHOWREADME_FUNCTION AutoStartup
!endif

; 安装时触发
!macro customInstall
  ; 检测 Microsoft Visual C++ 2015-2022 x64 Runtime。
  ; VC_redist.x64.exe 下载来源：https://aka.ms/vs/17/release/VC_redist.x64.exe
  ; 当前内置安装包为 14.34，因此已安装 14.34 或更高版本时都应直接复用。
  ;
  ; Microsoft 将 v14 Runtime 的版本写入：
  ; HKLM\SOFTWARE\Microsoft\VisualStudio\14.0\VC\Runtimes\x64
  ; 32 位 NSIS 在 64 位 Windows 上会自动访问对应的 Wow6432Node 视图。
  ;
  ; 不再枚举 Installer\Dependencies 中的 14.34/14.35/... bundle 名称，
  ; 否则每次微软发布新 minor 版本都会把新版本误判成“未安装”。
  SetRegView 32
  ReadRegDWORD $R0 HKLM "SOFTWARE\Microsoft\VisualStudio\14.0\VC\Runtimes\x64" "Installed"
  ReadRegDWORD $R1 HKLM "SOFTWARE\Microsoft\VisualStudio\14.0\VC\Runtimes\x64" "Major"
  ReadRegDWORD $R2 HKLM "SOFTWARE\Microsoft\VisualStudio\14.0\VC\Runtimes\x64" "Minor"
  SetRegView lastused

  StrCpy $R3 "0"
  ${If} $R0 == 1
    ${If} $R1 > 14
      StrCpy $R3 "1"
    ${ElseIf} $R1 == 14
      ${If} $R2 >= 34
        StrCpy $R3 "1"
      ${EndIf}
    ${EndIf}
  ${EndIf}

  ${If} $R3 != 1
    ; 仅在确实缺少所需 Runtime 时静默安装，避免较新版本触发“设置失败”弹窗。
    File /oname=$PLUGINSDIR\VC_redist.x64.exe "${BUILD_RESOURCES_DIR}\VC_redist.x64.exe"
    ExecWait '"$PLUGINSDIR\VC_redist.x64.exe" /install /quiet /norestart' $R4

    ; 0 = 成功，3010 = 成功但建议重启，1638 = 已存在其他兼容版本。
    ; 1638 作为兜底兼容：即使注册表布局发生变化，也不要向用户显示误导性的失败窗口。
    ${If} $R4 != 0
    ${AndIf} $R4 != 3010
    ${AndIf} $R4 != 1638
      MessageBox MB_ICONEXCLAMATION|MB_OK "Microsoft Visual C++ 运行库安装失败（错误码：$R4）。TTime 可能无法正常启动，请手动安装最新的 Visual C++ 2015-2022 Redistributable (x64)。"
    ${EndIf}
  ${EndIf}

; 安装时删除开机自启配置 防止如果用户前一个版本是开机自启的
; 但是覆盖安装新版本时选择不开机自启 最后开启自启逻辑还在 导致安装时即使设置的关闭开机自启 但应用启动时还是开启自启状态的
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "${APP_NAME}"
!macroend

; 卸载时删除开机自启配置
!macro customUnInstall
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "${APP_NAME}"
!macroend

; 选择的安装路径尾部自动追加应用名称
Function .onVerifyInstDir
  StrLen $0 "\${APP_NAME}"
  StrCpy $1 "$INSTDIR" "" -$0
  StrCmp $1 "\${APP_NAME}" +2 0
  StrCpy $INSTDIR "$INSTDIR\${APP_NAME}"
FunctionEnd
