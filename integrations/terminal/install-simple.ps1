# AI Guardian Terminal Monitor - Simple Installer
param(
    [string]$GuardianUrl = "http://localhost:3456",
    [string]$GuardianToken = "",
    [switch]$Silent = $true
)

Write-Host "Installing AI Guardian Terminal Monitor..." -ForegroundColor Cyan

# Create directory
$installDir = "$env:USERPROFILE\.ai-guardian"
$moduleDir = "$installDir\powershell"
New-Item -ItemType Directory -Path $moduleDir -Force | Out-Null

# Save config
$config = @{
    guardianUrl = $GuardianUrl
    guardianToken = $GuardianToken
    alertThreshold = 70
    silentMode = $Silent
} | ConvertTo-Json

$config | Set-Content "$installDir\config.json"

# Create module
$moduleContent = @'
$script:Config = Get-Content "$env:USERPROFILE\.ai-guardian\config.json" | ConvertFrom-Json

function Test-CommandSafety($Command) {
    $dangerous = @(
        @{ Pattern = 'rm\s+-rf\s+/'; Risk = 100; Desc = 'Delete entire filesystem' }
        @{ Pattern = 'del\s+/[sS]'; Risk = 90; Desc = 'Delete mass files' }
        @{ Pattern = 'format\s+'; Risk = 95; Desc = 'Format disk' }
    )
    
    foreach ($d in $dangerous) {
        if ($Command -match $d.Pattern) {
            return @{ Safe = $false; Risk = $d.Risk; Reason = $d.Desc }
        }
    }
    
    try {
        $headers = @{ "Authorization" = "Bearer $($script:Config.guardianToken)"; "Content-Type" = "application/json" }
        $body = @{ command = $Command } | ConvertTo-Json
        $response = Invoke-RestMethod -Uri "$($script:Config.guardianUrl)/api/evaluate" -Method POST -Headers $headers -Body $body -TimeoutSec 2
        if ($response.riskScore -ge $script:Config.alertThreshold) {
            return @{ Safe = $false; Risk = $response.riskScore; Reason = $response.reason }
        }
    } catch {}
    
    return @{ Safe = $true }
}

function Show-Alert($Command, $Risk, $Reason) {
    Write-Host "`n╔══════════════════════════════════════════════════════════════╗" -ForegroundColor Red
    Write-Host "║           SECURITY ALERT                                     ║" -ForegroundColor Red
    Write-Host "╠══════════════════════════════════════════════════════════════╣" -ForegroundColor Red
    Write-Host "║ Risk: $Risk/100" -ForegroundColor Yellow
    Write-Host "║ Command: $Command" -ForegroundColor Yellow
    Write-Host "║ Reason: $Reason" -ForegroundColor Yellow
    Write-Host "╚══════════════════════════════════════════════════════════════╝" -ForegroundColor Red
}

$originalInvokeExpression = Get-Command Invoke-Expression -CommandType Cmdlet
function Invoke-Expression {
    param([Parameter(Mandatory=$true)][string]$Command)
    $check = Test-CommandSafety $Command
    if (-not $check.Safe) {
        Show-Alert $Command $check.Risk $check.Reason
        $response = Read-Host "Continue? (y/N)"
        if ($response -notin @('y','Y')) {
            Write-Host "Blocked by AI Guardian." -ForegroundColor Red
            return
        }
    }
    & $originalInvokeExpression $Command
}

Write-Host "`nAI Guardian Terminal Protection Active" -ForegroundColor Green
'@

$moduleContent | Set-Content "$moduleDir\AI-Guardian-Monitor.psm1"

# Add to profile
$profilePath = $PROFILE.CurrentUserAllHosts
if (-not $profilePath) {
    $profilePath = "$env:USERPROFILE\Documents\PowerShell\Microsoft.PowerShell_profile.ps1"
}
$profileDir = Split-Path $profilePath
if (-not (Test-Path $profileDir)) {
    New-Item -ItemType Directory -Path $profileDir -Force | Out-Null
}

$importLine = "Import-Module `"$moduleDir\AI-Guardian-Monitor.psm1`" -Force"
if (Test-Path $profilePath) {
    $content = Get-Content $profilePath -Raw -ErrorAction SilentlyContinue
    if ($content -notlike "*$importLine*") {
        Add-Content $profilePath "`n# AI Guardian`n$importLine`n"
    }
} else {
    Set-Content $profilePath "# AI Guardian`n$importLine`n"
}

# Save token
if ($GuardianToken) {
    $GuardianToken | Set-Content "$env:USERPROFILE\.ai-guardian-token"
}

Write-Host "`nInstallation Complete!" -ForegroundColor Green
Write-Host "Installation Directory: $installDir" -ForegroundColor White
Write-Host "PowerShell Profile: $profilePath" -ForegroundColor White
Write-Host "`nTo activate: Restart PowerShell or run:" -ForegroundColor Yellow
Write-Host "  Import-Module `"$moduleDir\AI-Guardian-Monitor.psm1`" -Force" -ForegroundColor Yellow

# Test connection
Write-Host "`nTesting Guardian connection..." -ForegroundColor Cyan
try {
    Invoke-RestMethod -Uri "$GuardianUrl/api/status" -Method GET -TimeoutSec 3 | Out-Null
    Write-Host "Guardian is running!" -ForegroundColor Green
} catch {
    Write-Host "Warning: Guardian not accessible. Start it with: node dist/cli.js server" -ForegroundColor Yellow
}

Write-Host ""
