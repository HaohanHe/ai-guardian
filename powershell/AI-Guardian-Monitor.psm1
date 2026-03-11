# AI Guardian PowerShell Monitor
# 自动加载到 PowerShell profile，监控所有命令

$GuardianUrl = "http://localhost:3456"
$GuardianToken = $env:AI_GUARDIAN_TOKEN
$AlertThreshold = 70
$SilentMode = $true

# 获取 Token
function Get-GuardianToken {
    if ($GuardianToken) { return $GuardianToken }
    
    # 尝试从文件读取
    $tokenFile = Join-Path $env:USERPROFILE ".ai-guardian-token"
    if (Test-Path $tokenFile) {
        return Get-Content $tokenFile -Raw
    }
    
    return $null
}

# 发送命令到 Guardian 评估
function Invoke-GuardianEvaluate {
    param(
        [string]$Command
    )
    
    $token = Get-GuardianToken
    if (-not $token) { return $null }
    
    try {
        $headers = @{
            "Authorization" = "Bearer $token"
            "Content-Type" = "application/json"
        }
        
        $body = @{
            command = $Command
        } | ConvertTo-Json
        
        $response = Invoke-RestMethod -Uri "$GuardianUrl/api/evaluate" -Method POST -Headers $headers -Body $body -ErrorAction SilentlyContinue
        
        return $response
    } catch {
        return $null
    }
}

# 显示告警
function Show-GuardianAlert {
    param(
        [string]$Command,
        [int]$RiskScore,
        [string]$Reason,
        [string[]]$Alternatives
    )
    
    Write-Host ""
    Write-Host "╔══════════════════════════════════════════════════════════════╗" -ForegroundColor Red
    Write-Host "║           ⚠️  AI GUARDIAN SECURITY ALERT  ⚠️                 ║" -ForegroundColor Red
    Write-Host "╠══════════════════════════════════════════════════════════════╣" -ForegroundColor Red
    Write-Host "║ Risk Score: $RiskScore/100                                       " -ForegroundColor Yellow
    Write-Host "║ Command: $Command" -ForegroundColor Yellow
    Write-Host "║ Reason: $Reason" -ForegroundColor Yellow
    Write-Host "╠══════════════════════════════════════════════════════════════╣" -ForegroundColor Red
    Write-Host "║ Safer Alternatives:                                          " -ForegroundColor Green
    foreach ($alt in $Alternatives) {
        Write-Host "║   • $alt" -ForegroundColor Green
    }
    Write-Host "╚══════════════════════════════════════════════════════════════╝" -ForegroundColor Red
    Write-Host ""
}

# 命令预检查钩子
function Invoke-GuardianPreCheck {
    param(
        [string]$Command
    )
    
    # 跳过空命令
    if ([string]::IsNullOrWhiteSpace($Command)) { return $true }
    
    # 跳过安全命令
    $safePatterns = @(
        '^ls$', '^dir$', '^cd\s', '^pwd$', '^echo\s', '^cat\s', '^type\s',
        '^clear$', '^cls$', '^date$', '^time$', '^whoami$', '^hostname$',
        '^git\sstatus', '^git\slog', '^git\sdiff', '^npm\slist',
        '^node\s--version', '^npm\s--version', '^python\s--version'
    )
    
    foreach ($pattern in $safePatterns) {
        if ($Command -match $pattern) { return $true }
    }
    
    # 评估命令
    $result = Invoke-GuardianEvaluate -Command $Command
    
    if (-not $result) { return $true }  # Guardian 不可用时放行
    
    $riskScore = $result.riskScore
    
    # 高危命令处理
    if ($riskScore -ge 71) {
        Show-GuardianAlert -Command $Command -RiskScore $riskScore -Reason $result.reason -Alternatives $result.alternatives
        
        # 询问用户
        Write-Host "Do you want to proceed anyway? (y/N): " -NoNewline -ForegroundColor Yellow
        $response = Read-Host
        
        if ($response -ne 'y' -and $response -ne 'Y') {
            Write-Host "Command blocked by AI Guardian." -ForegroundColor Red
            return $false
        }
    }
    # 中等风险静默记录
    elseif ($riskScore -ge 31 -and -not $SilentMode) {
        Write-Host "[AI Guardian] Medium risk detected ($riskScore/100): $Command" -ForegroundColor Yellow
    }
    
    return $true
}

# 创建包装函数
$originalInvokeCommand = $ExecutionContext.InvokeCommand

# Hook 命令执行
$ExecutionContext.InvokeCommand = {
    param([string]$Command, [object[]]$Arguments)
    
    # 预检查
    $allowed = Invoke-GuardianPreCheck -Command $Command
    
    if (-not $allowed) {
        return
    }
    
    # 执行原命令
    & $originalInvokeCommand $Command @Arguments
}

# Hook Invoke-Expression
$script:originalInvokeExpression = Get-Command Invoke-Expression -CommandType Cmdlet

function Invoke-Expression {
    param([string]$Command)
    
    # 预检查
    $allowed = Invoke-GuardianPreCheck -Command $Command
    
    if (-not $allowed) {
        return
    }
    
    # 执行原命令
    & $script:originalInvokeExpression $Command
}

# 启动消息
Write-Host ""
Write-Host "╔══════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║           🛡️  AI GUARDIAN PROTECTION ACTIVE  🛡️              ║" -ForegroundColor Cyan
Write-Host "╠══════════════════════════════════════════════════════════════╣" -ForegroundColor Cyan
Write-Host "║  Terminal monitoring enabled                                 ║" -ForegroundColor Green
Write-Host "║  Auto-blocking: High-risk commands (71+ score)              ║" -ForegroundColor Green
Write-Host "║  Silent mode: $SilentMode                                      " -ForegroundColor Green
Write-Host "╚══════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# 导出函数
Export-ModuleMember -Function Invoke-GuardianPreCheck, Invoke-GuardianEvaluate, Show-GuardianAlert
