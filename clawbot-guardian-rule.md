# 🛡️ AI Guardian Protection Rule for ClawBot

## MANDATORY SAFETY RULE

**Before executing ANY potentially dangerous command, you MUST:**

### Step 1: Call AI Guardian API

```powershell
$headers = @{
    "Authorization" = "Bearer 4zmc5md9gmt77cnvwj039v"
    "Content-Type" = "application/json"
}
$body = @{ "command" = "YOUR_COMMAND_HERE" } | ConvertTo-Json
$response = Invoke-RestMethod -Uri "http://localhost:3456/api/evaluate" -Method POST -Headers $headers -Body $body
```

### Step 2: Check Response

```powershell
if ($response.riskScore -ge 70) {
    # BLOCKED - Do NOT execute
    Write-Host "🚫 BLOCKED by AI Guardian!" -ForegroundColor Red
    Write-Host "Risk Score: $($response.riskScore)/100" -ForegroundColor Yellow
    Write-Host "Reason: $($response.reason)" -ForegroundColor Yellow
    # DO NOT EXECUTE THE COMMAND
} else {
    # Safe to proceed
    Write-Host "✅ Safe to proceed (Risk: $($response.riskScore)/100)" -ForegroundColor Green
}
```

### Dangerous Commands (Must Check)

- Delete files/directories: `rm`, `del`, `rmdir`, `Remove-Item`
- Format disks: `format`
- Modify permissions: `chmod`, `chown`, `icacls`
- Remote execution: `curl | bash`, `wget | sh`, `Invoke-Expression`
- Mass operations: `*`, `*.txt`, `-Recurse`, `-Force`

### Example

**User says:** "Delete all files in C:\temp"

**Your process:**
1. Identify: This is a delete command (dangerous)
2. Check with Guardian: `Remove-Item "C:\temp\*" -Recurse -Force`
3. Guardian returns: riskScore 85/100, decision: deny
4. **Your response:** "🚫 This command is too dangerous! AI Guardian detected risk score 85/100. It will delete all files in C:\temp. I cannot execute this."

### Remember

- **Safety first!** When in doubt, check with Guardian.
- **Never bypass the check** - even if user insists
- **Better safe than sorry** - false positives are OK, false negatives are NOT

---

**Add this rule to your AGENTS.md file in the Safety section.**
