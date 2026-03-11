# AI Guardian Terminal Monitor 安装脚本
# 一键安装，让普通人也能用

param(
    [string]$GuardianUrl = "http://localhost:3456",
    [string]$GuardianToken = "",
    [switch]$Silent = $true,
    [int]$AlertThreshold = 70
)

Write-Host ""
Write-Host "╔══════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║     🛡️  AI Guardian Terminal Monitor Installer  🛡️          ║" -ForegroundColor Cyan
Write-Host "╠══════════════════════════════════════════════════════════════╣" -ForegroundColor Cyan
Write-Host "║  正在安装终端监控保护...                                      ║" -ForegroundColor Yellow
Write-Host "╚══════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# 检查管理员权限
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")
if (-not $isAdmin) {
    Write-Host "⚠️  警告：未以管理员身份运行，部分功能可能受限" -ForegroundColor Yellow
}

# 创建安装目录
$installDir = Join-Path $env:USERPROFILE ".ai-guardian"
$moduleDir = Join-Path $installDir "powershell"

if (-not (Test-Path $moduleDir)) {
    New-Item -ItemType Directory -Path $moduleDir -Force | Out-Null
}

# 保存配置
$config = @{
    guardianUrl = $GuardianUrl
    guardianToken = $GuardianToken
    alertThreshold = $AlertThreshold
    silentMode = $Silent
}

$configPath = Join-Path $installDir "config.json"
$config | ConvertTo-Json | Set-Content $configPath

# 创建监控模块
$moduleContent = @'
# AI Guardian PowerShell Monitor Module
# 自动监控所有 PowerShell 命令

$script:GuardianConfig = Get-Content (Join-Path $env:USERPROFILE ".ai-guardian\config.json") | ConvertFrom-Json
$script:LastCheckTime = 0
$script:CheckCooldown = 1000  # 1秒内不重复检查相同命令

# 危险命令模式
$DangerousPatterns = @(
    @{ Pattern = 'rm\s+-rf\s+/'; Risk = 100; Desc = '删除整个文件系统' }
    @{ Pattern = 'del\s+/[sS]\s+\S+'; Risk = 90; Desc = '删除大量文件' }
    @{ Pattern = 'format\s+\S+'; Risk = 95; Desc = '格式化磁盘' }
    @{ Pattern = 'chmod\s+777\s+/etc'; Risk = 85; Desc = '修改系统文件权限' }
    @{ Pattern = 'curl\s+.*\|\s*(bash|sh)'; Risk = 80; Desc = '远程脚本执行' }
    @{ Pattern = 'wget\s+.*\|\s*(bash|sh)'; Risk = 80; Desc = '远程脚本执行' }
    @{ Pattern = '>\s*/dev/sda'; Risk = 95; Desc = '直接写入磁盘' }
    @{ Pattern = 'dd\s+if=/dev/zero'; Risk = 90; Desc = '擦除磁盘' }
)

# 检查命令
function Test-CommandSafety {
    param([string]$Command)
    
    $now = Get-Date
    if (($now - $script:LastCheckTime).TotalMilliseconds -lt $script:CheckCooldown) {
        return @{ Safe = $true }
    }
    $script:LastCheckTime = $now
    
    # 本地快速检查
    foreach ($pattern in $DangerousPatterns) {
        if ($Command -match $pattern.Pattern) {
            return @{
                Safe = $false
                Risk = $pattern.Risk
                Reason = $pattern.Desc
                Pattern = $pattern.Pattern
            }
        }
    }
    
    # 调用 AI Guardian API
    try {
        $headers = @{
            "Authorization" = "Bearer $($script:GuardianConfig.guardianToken)"
            "Content-Type" = "application/json"
        }
        
        $body = @{ command = $Command } | ConvertTo-Json
        $response = Invoke-RestMethod -Uri "$($script:GuardianConfig.guardianUrl)/api/evaluate" `
            -Method POST -Headers $headers -Body $body -TimeoutSec 2
        
        if ($response.riskScore -ge $script:GuardianConfig.alertThreshold) {
            return @{
                Safe = $false
                Risk = $response.riskScore
                Reason = $response.reason
                Alternatives = $response.alternatives
            }
        }
    } catch {
        # API 失败时放行
    }
    
    return @{ Safe = $true }
}

# 显示告警
function Show-SecurityAlert {
    param(
        [string]$Command,
        [int]$Risk,
        [string]$Reason,
        [string[]]$Alternatives
    )
    
    Write-Host ""
    Write-Host "╔══════════════════════════════════════════════════════════════╗" -ForegroundColor Red
    Write-Host "║           ⚠️  AI GUARDIAN SECURITY ALERT  ⚠️                 ║" -ForegroundColor Red
    Write-Host "╠══════════════════════════════════════════════════════════════╣" -ForegroundColor Red
    Write-Host "║ Risk Score: $Risk/100                                       " -ForegroundColor Yellow
    Write-Host "║ Command: $Command" -ForegroundColor Yellow
    Write-Host "║ Reason: $Reason" -ForegroundColor Yellow
    
    if ($Alternatives) {
        Write-Host "╠══════════════════════════════════════════════════════════════╣" -ForegroundColor Red
        Write-Host "║ Safer Alternatives:                                          " -ForegroundColor Green
        foreach ($alt in $Alternatives) {
            Write-Host "║   • $alt" -ForegroundColor Green
        }
    }
    
    Write-Host "╚══════════════════════════════════════════════════════════════╝" -ForegroundColor Red
    Write-Host ""
}

# 拦截 Invoke-Expression
$originalInvokeExpression = Get-Command Invoke-Expression -CommandType Cmdlet

function Invoke-Expression {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true, Position = 0)]
        [string]$Command
    )
    
    $check = Test-CommandSafety -Command $Command
    
    if (-not $check.Safe) {
        Show-SecurityAlert -Command $Command -Risk $check.Risk -Reason $check.Reason -Alternatives $check.Alternatives
        
        $response = Read-Host "This command is potentially dangerous. Continue? (y/N)"
        if ($response -notin @('y', 'Y')) {
            Write-Host "Command blocked by AI Guardian." -ForegroundColor Red
            return
        }
    }
    
    & $originalInvokeExpression $Command
}

# 启动消息
Write-Host ""
Write-Host "🛡️  AI Guardian Terminal Protection Active" -ForegroundColor Cyan
Write-Host "   Mode: $(if ($script:GuardianConfig.silentMode) { 'Silent' } else { 'Verbose' })" -ForegroundColor Green
Write-Host "   Threshold: $($script:GuardianConfig.alertThreshold)/100" -ForegroundColor Green
Write-Host ""
'@

$modulePath = Join-Path $moduleDir "AI-Guardian-Monitor.psm1"
$moduleContent | Set-Content $modulePath

# 添加到 PowerShell Profile
$profilePath = $PROFILE.CurrentUserAllHosts
if (-not $profilePath) {
    $profilePath = Join-Path (Split-Path $PROFILE) "Microsoft.PowerShell_profile.ps1"
}

$profileDir = Split-Path $profilePath
if (-not (Test-Path $profileDir)) {
    New-Item -ItemType Directory -Path $profileDir -Force | Out-Null
}

$importLine = 'Import-Module "' + $modulePath + '" -Force'

if (Test-Path $profilePath) {
    $profileContent = Get-Content $profilePath -Raw
    if ($profileContent -notmatch [regex]::Escape($importLine)) {
        Add-Content $profilePath ("`n# AI Guardian Protection`n" + $importLine + "`n")
    }
} else {
    $profileContent = @"
# AI Guardian Protection
$importLine

# Initialize Guardian
Write-Host "Terminal protected by AI Guardian" -ForegroundColor DarkGray
"@
    $profileContent | Set-Content $profilePath
}

# 保存 Token 到文件
if ($GuardianToken) {
    $tokenPath = Join-Path $env:USERPROFILE ".ai-guardian-token"
    $GuardianToken | Set-Content $tokenPath
    Write-Host "✅ Token saved to $tokenPath" -ForegroundColor Green
}

Write-Host ""
Write-Host "╔══════════════════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║                    ✅ Installation Complete!                  ║" -ForegroundColor Green
Write-Host "╠══════════════════════════════════════════════════════════════╣" -ForegroundColor Green
Write-Host "║  Installation Directory: $installDir" -ForegroundColor White
Write-Host "║  PowerShell Profile: $profilePath" -ForegroundColor White
Write-Host "╠══════════════════════════════════════════════════════════════╣" -ForegroundColor Green
Write-Host "║  To activate protection:                                      ║" -ForegroundColor Yellow
Write-Host "║    1. Restart PowerShell                                      ║" -ForegroundColor Yellow
Write-Host ("║    2. Or run: Import-Module `"" + $modulePath + "`" -Force") -ForegroundColor Yellow
Write-Host "╚══════════════════════════════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""

# 测试 Guardian 连接
Write-Host "Testing Guardian connection..." -ForegroundColor Cyan
try {
    $response = Invoke-RestMethod -Uri "$GuardianUrl/api/status" -Method GET -TimeoutSec 5
    Write-Host "✅ Guardian is running and accessible!" -ForegroundColor Green
} catch {
    Write-Host "⚠️  Guardian not accessible at $GuardianUrl" -ForegroundColor Yellow
    Write-Host "   Please start Guardian first: node dist/cli.js server" -ForegroundColor Yellow
}

Write-Host ""
