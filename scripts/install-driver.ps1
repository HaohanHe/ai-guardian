# AI Guardian Windows Driver Installation Script
# 必须以管理员权限运行

param(
    [string]$DriverPath = "$PSScriptRoot\..\driver\windows\AiGuardianDriver\AiGuardianDriver.sys",
    [switch]$Uninstall = $false
)

function Test-Admin {
    $currentPrincipal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
    return $currentPrincipal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Install-Driver {
    Write-Host "Installing AI Guardian Driver..." -ForegroundColor Cyan
    
    # 检查驱动文件是否存在
    if (-not (Test-Path $DriverPath)) {
        Write-Error "Driver file not found: $DriverPath"
        exit 1
    }
    
    # 复制驱动到系统目录
    $systemDriverPath = "C:\Windows\System32\drivers\AiGuardianDriver.sys"
    Write-Host "Copying driver to system directory..." -ForegroundColor Yellow
    Copy-Item -Path $DriverPath -Destination $systemDriverPath -Force
    
    # 创建服务
    Write-Host "Creating driver service..." -ForegroundColor Yellow
    $result = sc.exe create AiGuardianDriver binPath= $systemDriverPath type= filesys start= demand error= normal DisplayName= "AI Guardian Driver"
    
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Failed to create driver service"
        exit 1
    }
    
    # 启动服务
    Write-Host "Starting driver service..." -ForegroundColor Yellow
    $result = sc.exe start AiGuardianDriver
    
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Failed to start driver service"
        exit 1
    }
    
    Write-Host "AI Guardian Driver installed successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "To verify installation, run:" -ForegroundColor Cyan
    Write-Host "  sc.exe query AiGuardianDriver" -ForegroundColor White
}

function Uninstall-Driver {
    Write-Host "Uninstalling AI Guardian Driver..." -ForegroundColor Cyan
    
    # 停止服务
    Write-Host "Stopping driver service..." -ForegroundColor Yellow
    $null = sc.exe stop AiGuardianDriver
    
    # 删除服务
    Write-Host "Deleting driver service..." -ForegroundColor Yellow
    $result = sc.exe delete AiGuardianDriver
    
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Failed to delete driver service"
        exit 1
    }
    
    # 删除驱动文件
    $systemDriverPath = "C:\Windows\System32\drivers\AiGuardianDriver.sys"
    if (Test-Path $systemDriverPath) {
        Write-Host "Removing driver file..." -ForegroundColor Yellow
        Remove-Item -Path $systemDriverPath -Force
    }
    
    Write-Host "AI Guardian Driver uninstalled successfully!" -ForegroundColor Green
}

# 主程序
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  AI Guardian Driver Installer" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 检查管理员权限
if (-not (Test-Admin)) {
    Write-Error "This script must be run as Administrator!"
    Write-Host "Please run PowerShell as Administrator and try again." -ForegroundColor Yellow
    exit 1
}

if ($Uninstall) {
    Uninstall-Driver
} else {
    Install-Driver
}

Write-Host ""
