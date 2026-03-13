@echo off
setlocal EnableDelayedExpansion

echo ========================================
echo AI Guardian Windows Build Script
echo ========================================
echo.

set VERSION=2.0.0
set BUILD_DIR=build
set DIST_DIR=dist

if exist %BUILD_DIR% rmdir /s /q %BUILD_DIR%
mkdir %BUILD_DIR%
mkdir %BUILD_DIR%\windows

echo [1/5] Building Rust backend...
cargo build --release
if errorlevel 1 (
    echo ERROR: Rust build failed!
    exit /b 1
)

echo [2/5] Building Electron frontend...
cd ui
call npm install
call npm run build:renderer
call npm run build:main
if errorlevel 1 (
    echo ERROR: Electron build failed!
    exit /b 1
)
cd ..

echo [3/5] Packaging application...
call npx electron-builder --win --x64
if errorlevel 1 (
    echo ERROR: Electron packaging failed!
    exit /b 1
)

echo [4/5] Copying files...
xcopy /s /e /y ui\release\win-unpacked %BUILD_DIR%\windows\app\*
copy target\release\ai-guardian.exe %BUILD_DIR%\windows\backend\
xcopy /s /e /y driver\windows %BUILD_DIR%\windows\driver\
xcopy /s /e /y config %BUILD_DIR%\windows\config\
xcopy /s /e /y ui\resources %BUILD_DIR%\windows\resources\

echo [5/5] Creating installer...
cd installer\windows
makensis setup.nsi
if errorlevel 1 (
    echo WARNING: NSIS not found, skipping installer creation
    echo You can manually run makensis to create the installer
)
cd ..\..

if exist installer\windows\AI-Guardian-Setup-%VERSION%.exe (
    move installer\windows\AI-Guardian-Setup-%VERSION%.exe %DIST_DIR%\
)

echo.
echo ========================================
echo Build completed successfully!
echo Output: %DIST_DIR%\AI-Guardian-Setup-%VERSION%.exe
echo ========================================
