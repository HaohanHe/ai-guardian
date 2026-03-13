!include "MUI2.nsh"
!include "FileFunc.nsh"
!include "LogicLib.nsh"
!include "x64.nsh"

!define PRODUCT_NAME "AI Guardian"
!define PRODUCT_VERSION "2.0.0"
!define PRODUCT_PUBLISHER "AI Guardian Team"
!define PRODUCT_WEB_SITE "https://github.com/HaohanHe/ai-guardian"
!define PRODUCT_UNINST_KEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\${PRODUCT_NAME}"
!define PRODUCT_UNINST_ROOT_KEY "HKLM"

!define MUI_ABORTWARNING
!define MUI_ICON "${NSISDIR}\Contrib\Graphics\Icons\modern-install.ico"
!define MUI_UNICON "${NSISDIR}\Contrib\Graphics\Icons\modern-uninstall.ico"

!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_LICENSE "..\LICENSE"
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH

!insertmacro MUI_UNPAGE_INSTFILES

Name "${PRODUCT_NAME} ${PRODUCT_VERSION}"
OutFile "AI-Guardian-Setup-${PRODUCT_VERSION}.exe"
InstallDir "$PROGRAMFILES64\AI Guardian"
InstallDirRegKey HKLM "Software\${PRODUCT_NAME}" "Install_Dir"
ShowInstDetails show
ShowUnInstDetails show

Function .onInit
    ${If} ${RunningX64}
        StrCpy $INSTDIR "$PROGRAMFILES64\AI Guardian"
    ${Else}
        StrCpy $INSTDIR "$PROGRAMFILES32\AI Guardian"
    ${EndIf}
    
    ClearErrors
    UserInfo::GetName
    IfErrors noAdmin
    Pop $0
    UserInfo::GetAccountType
    Pop $1
    StrCmp $1 "Admin" +3
    MessageBox MB_OK|MB_ICONSTOP "需要管理员权限才能安装 AI Guardian"
    Abort
    noAdmin:
FunctionEnd

Section "MainSection" SEC01
    SetOutPath "$INSTDIR"
    SetOverwrite ifnewer
    
    File /r "..\ui\release\win-unpacked\*.*"
    
    SetOutPath "$INSTDIR\backend"
    File "..\target\release\ai-guardian.exe"
    
    SetOutPath "$INSTDIR\driver"
    File /r "..\driver\windows\*.*"
    
    SetOutPath "$INSTDIR\config"
    File "..\config\default.yaml"
    
    SetOutPath "$INSTDIR\resources\icons"
    File "..\ui\resources\icons\*.*"
    
    CreateDirectory "$INSTDIR\logs"
    CreateDirectory "$INSTDIR\data"
    
    CreateDirectory "$SMPROGRAMS\AI Guardian"
    CreateShortCut "$SMPROGRAMS\AI Guardian\AI Guardian.lnk" "$INSTDIR\AI Guardian.exe"
    CreateShortCut "$SMPROGRAMS\AI Guardian\Uninstall.lnk" "$INSTDIR\uninst.exe"
    CreateShortCut "$DESKTOP\AI Guardian.lnk" "$INSTDIR\AI Guardian.exe"
SectionEnd

Section "Driver" SEC02
    MessageBox MB_YESNO|MB_ICONQUESTION \
        "是否安装内核驱动？$\n$\n\
        驱动提供系统级防护，可以拦截危险操作。$\n\
        安装驱动需要管理员权限和测试签名模式。$\n$\n\
        是否继续？" \
        /SD IDYES IDYES InstallDriver IDNO SkipDriver
    
    InstallDriver:
        DetailPrint "正在安装内核驱动..."
        
        nsExec::ExecToStack '"$INSTDIR\driver\install-driver.ps1"'
        Pop $0
        Pop $1
        
        ${If} $0 != 0
            MessageBox MB_OK|MB_ICONWARNING \
                "驱动安装失败。$\n$\n\
                错误信息: $1$\n$\n\
                您可以稍后手动安装驱动。"
        ${Else}
            MessageBox MB_OK|MB_ICONINFORMATION \
                "驱动安装成功！$\n$\n\
                某些功能可能需要重启系统才能生效。"
        ${EndIf}
    
    SkipDriver:
SectionEnd

Section "AutoStart" SEC03
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Run" \
        "AI Guardian" '"$INSTDIR\AI Guardian.exe" --minimized'
SectionEnd

Section -Post
    WriteUninstaller "$INSTDIR\uninst.exe"
    
    WriteRegStr ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}" "DisplayName" "$(^Name)"
    WriteRegStr ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}" "UninstallString" "$INSTDIR\uninst.exe"
    WriteRegStr ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}" "DisplayIcon" "$INSTDIR\AI Guardian.exe"
    WriteRegStr ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}" "DisplayVersion" "${PRODUCT_VERSION}"
    WriteRegStr ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}" "URLInfoAbout" "${PRODUCT_WEB_SITE}"
    WriteRegStr ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}" "Publisher" "${PRODUCT_PUBLISHER}"
    
    ${GetSize} "$INSTDIR" "/S=0K" $0 $1 $2
    IntFmt $0 "0x%08X" $0
    WriteRegDWORD ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}" "EstimatedSize" "$0"
SectionEnd

Function un.onUninstSuccess
    HideWindow
    MessageBox MB_ICONINFORMATION|MB_OK "$(^Name) 已成功从您的计算机中移除。"
FunctionEnd

Function un.onInit
    MessageBox MB_ICONQUESTION|MB_YESNO|MB_DEFBUTTON2 \
        "您确定要完全移除 $(^Name) 及其所有组件？" \
        /SD IDYES IDYES NoAbort
    Abort
    NoAbort:
FunctionEnd

Section Uninstall
    DetailPrint "正在停止 AI Guardian 服务..."
    nsExec::ExecToStack 'taskkill /F /IM "AI Guardian.exe"'
    nsExec::ExecToStack 'taskkill /F /IM "ai-guardian.exe"'
    
    DetailPrint "正在卸载内核驱动..."
    nsExec::ExecToStack 'powershell -ExecutionPolicy Bypass -File "$INSTDIR\driver\uninstall-driver.ps1"'
    
    Delete "$INSTDIR\*.*"
    Delete "$INSTDIR\backend\*.*"
    Delete "$INSTDIR\driver\*.*"
    Delete "$INSTDIR\config\*.*"
    Delete "$INSTDIR\resources\icons\*.*"
    
    RMDir /r "$INSTDIR\resources"
    RMDir /r "$INSTDIR\backend"
    RMDir /r "$INSTDIR\driver"
    RMDir /r "$INSTDIR\config"
    RMDir /r "$INSTDIR\logs"
    RMDir /r "$INSTDIR\data"
    RMDir "$INSTDIR"
    
    Delete "$SMPROGRAMS\AI Guardian\*.*"
    RMDir "$SMPROGRAMS\AI Guardian"
    Delete "$DESKTOP\AI Guardian.lnk"
    
    DeleteRegKey ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}"
    DeleteRegKey HKLM "Software\${PRODUCT_NAME}"
    DeleteRegValue HKLM "Software\Microsoft\Windows\CurrentVersion\Run" "AI Guardian"
    
    SetAutoClose true
SectionEnd
