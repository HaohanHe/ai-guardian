@echo off
chcp 65001 >nul
echo ==========================================
echo AI Guardian Windows Driver Build Script
echo ==========================================
echo.

REM 检查管理员权限
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo [错误] 需要管理员权限运行此脚本
    echo 请右键点击，选择"以管理员身份运行"
    pause
    exit /b 1
)

REM 设置环境变量
set DRIVER_NAME=AiGuardianDriver
set BUILD_DIR=%~dp0\build
set DRIVER_SRC=%~dp0\%DRIVER_NAME%

REM 检查 Visual Studio 环境
where cl.exe >nul 2>&1
if %errorLevel% neq 0 (
    echo [信息] 正在初始化 Visual Studio 环境...
    
    REM 尝试查找 VS2022
    if exist "C:\Program Files\Microsoft Visual Studio\2022\Enterprise\VC\Auxiliary\Build\vcvars64.bat" (
        call "C:\Program Files\Microsoft Visual Studio\2022\Enterprise\VC\Auxiliary\Build\vcvars64.bat"
    ) else if exist "C:\Program Files\Microsoft Visual Studio\2022\Professional\VC\Auxiliary\Build\vcvars64.bat" (
        call "C:\Program Files\Microsoft Visual Studio\2022\Professional\VC\Auxiliary\Build\vcvars64.bat"
    ) else if exist "C:\Program Files\Microsoft Visual Studio\2022\Community\VC\Auxiliary\Build\vcvars64.bat" (
        call "C:\Program Files\Microsoft Visual Studio\2022\Community\VC\Auxiliary\Build\vcvars64.bat"
    ) else if exist "C:\Program Files (x86)\Microsoft Visual Studio\2019\Enterprise\VC\Auxiliary\Build\vcvars64.bat" (
        call "C:\Program Files (x86)\Microsoft Visual Studio\2019\Enterprise\VC\Auxiliary\Build\vcvars64.bat"
    ) else if exist "C:\Program Files (x86)\Microsoft Visual Studio\2019\Professional\VC\Auxiliary\Build\vcvars64.bat" (
        call "C:\Program Files (x86)\Microsoft Visual Studio\2019\Professional\VC\Auxiliary\Build\vcvars64.bat"
    ) else if exist "C:\Program Files (x86)\Microsoft Visual Studio\2019\Community\VC\Auxiliary\Build\vcvars64.bat" (
        call "C:\Program Files (x86)\Microsoft Visual Studio\2019\Community\VC\Auxiliary\Build\vcvars64.bat"
    ) else (
        echo [错误] 未找到 Visual Studio 环境
        echo 请安装 Visual Studio 2019 或 2022，并包含 "C++ 桌面开发" 和 "Windows Driver Kit"
        pause
        exit /b 1
    )
)

echo [信息] 使用编译器:
cl.exe 2>&1 | findstr "Microsoft"
echo.

REM 创建构建目录
if not exist "%BUILD_DIR%" mkdir "%BUILD_DIR%"
cd /d "%BUILD_DIR%"

echo [信息] 编译驱动...
echo.

REM 编译驱动
cl.exe ^
    /c ^
    /W4 ^
    /O2 ^
    /D UNICODE ^
    /D _UNICODE ^
    /D _AMD64_ ^
    /D AMD64 ^
    /I"%WindowsSdkDir%Include\%WindowsSDKVersion%km\crt" ^
    /I"%WindowsSdkDir%Include\%WindowsSDKVersion%km" ^
    /I"%WindowsSdkDir%Include\wdf\kmdf\1.33" ^
    "%DRIVER_SRC%\%DRIVER_NAME%.c" ^
    /Fo"%BUILD_DIR%\%DRIVER_NAME%.obj"

if %errorLevel% neq 0 (
    echo [错误] 编译失败
    pause
    exit /b 1
)

echo [信息] 链接驱动...
echo.

REM 链接驱动
link.exe ^
    /MACHINE:X64 ^
    /DRIVER ^
    /NODEFAULTLIB ^
    /ENTRY:DriverEntry ^
    /SUBSYSTEM:NATIVE ^
    /RELEASE ^
    /OUT:"%BUILD_DIR%\%DRIVER_NAME%.sys" ^
    "%BUILD_DIR%\%DRIVER_NAME%.obj" ^
    ntoskrnl.lib ^
    hal.lib ^
    fltMgr.lib

if %errorLevel% neq 0 (
    echo [错误] 链接失败
    pause
    exit /b 1
)

echo [信息] 复制 INF 文件...
copy "%DRIVER_SRC%\%DRIVER_NAME%.inf" "%BUILD_DIR%\" >nul

echo.
echo ==========================================
echo [成功] 驱动构建完成！
echo ==========================================
echo.
echo 输出文件:
echo   - %BUILD_DIR%\%DRIVER_NAME%.sys
echo   - %BUILD_DIR%\%DRIVER_NAME%.inf
echo.
echo 安装驱动:
echo   1. 运行 scripts\install-driver.ps1 (管理员权限)
echo   2. 或使用: sc create AiGuardianDriver binPath= %%CD%%\%DRIVER_NAME%.sys type= filesys
echo.

pause
