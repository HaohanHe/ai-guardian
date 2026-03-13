param(
    [switch]$Force,
    [switch]$SkipTestSign
)

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

$DriverName = "AiGuardianDriver"
$DriverPath = Split-Path -Parent $MyInvocation.MyCommand.Path
$InfFile = Join-Path $DriverPath "AiGuardianDriver.inf"
$SysFile = Join-Path $DriverPath "AiGuardianDriver.sys"
$CertFile = Join-Path $DriverPath "AiGuardianDriver.cer"

function Write-Log {
    param([string]$Message, [string]$Level = "INFO")
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $color = switch ($Level) {
        "ERROR" { "Red" }
        "WARN" { "Yellow" }
        "SUCCESS" { "Green" }
        default { "White" }
    }
    Write-Host "[$timestamp] [$Level] $Message" -ForegroundColor $color
}

function Test-Administrator {
    $currentUser = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($currentUser)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Enable-TestSigning {
    Write-Log "Enabling test signing mode..."
    
    $currentStatus = bcdedit /enum | Select-String "testsigning"
    if ($currentStatus -match "Yes") {
        Write-Log "Test signing already enabled" "SUCCESS"
        return $true
    }
    
    $result = bcdedit /set testsigning on 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Log "Test signing enabled successfully" "SUCCESS"
        return $true
    } else {
        Write-Log "Failed to enable test signing: $result" "ERROR"
        return $false
    }
}

function New-SelfSignedCertificate {
    Write-Log "Creating self-signed certificate for driver..."
    
    $cert = Get-ChildItem -Path Cert:\LocalMachine\My | Where-Object { 
        $_.Subject -match "AI Guardian Driver" 
    } | Select-Object -First 1
    
    if ($cert) {
        Write-Log "Certificate already exists: $($cert.Thumbprint)" "SUCCESS"
        return $cert
    }
    
    $certParams = @{
        Subject = "CN=AI Guardian Driver"
        Type = "CodeSigningCert"
        KeySpec = "Signature"
        KeyUsage = "DigitalSignature"
        KeyExportPolicy = "Exportable"
        KeyLength = 2048
        ValidFrom = (Get-Date)
        ValidTo = (Get-Date).AddYears(10)
        CertStoreLocation = "Cert:\LocalMachine\My"
    }
    
    try {
        $cert = New-SelfSignedCertificate @certParams
        Write-Log "Certificate created: $($cert.Thumbprint)" "SUCCESS"
        return $cert
    } catch {
        Write-Log "Failed to create certificate: $_" "ERROR"
        return $null
    }
}

function Add-CertificateToTrustedRoot {
    param($Cert)
    
    Write-Log "Adding certificate to Trusted Root..."
    
    try {
        $store = New-Object System.Security.Cryptography.X509Certificates.X509Store("Root", "LocalMachine")
        $store.Open("ReadWrite")
        $store.Add($Cert)
        $store.Close()
        Write-Log "Certificate added to Trusted Root" "SUCCESS"
        return $true
    } catch {
        Write-Log "Failed to add certificate to Trusted Root: $_" "ERROR"
        return $false
    }
}

function Sign-Driver {
    param($Cert, $SysFile)
    
    Write-Log "Signing driver file..."
    
    if (-not (Test-Path $SysFile)) {
        Write-Log "Driver file not found: $SysFile" "ERROR"
        return $false
    }
    
    $signtool = Get-ChildItem "C:\Program Files (x86)\Windows Kits\*\bin\*\x64\signtool.exe" -ErrorAction SilentlyContinue | 
                Select-Object -First 1
    
    if (-not $signtool) {
        Write-Log "signtool.exe not found. Please install Windows SDK." "ERROR"
        return $false
    }
    
    $result = & $signtool.FullName sign /fd SHA256 /a /n "AI Guardian Driver" $SysFile 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Log "Driver signed successfully" "SUCCESS"
        return $true
    } else {
        Write-Log "Failed to sign driver: $result" "ERROR"
        return $false
    }
}

function Install-Driver {
    Write-Log "Installing driver..."
    
    if (-not (Test-Path $InfFile)) {
        Write-Log "INF file not found: $InfFile" "ERROR"
        return $false
    }
    
    $result = pnputil /add-driver $InfFile /install 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Log "Driver installed successfully" "SUCCESS"
        return $true
    } else {
        Write-Log "Failed to install driver: $result" "ERROR"
        return $false
    }
}

function Start-DriverService {
    Write-Log "Starting driver service..."
    
    $service = Get-Service -Name $DriverName -ErrorAction SilentlyContinue
    
    if (-not $service) {
        Write-Log "Creating driver service..."
        $result = sc.exe create $DriverName type= kernel binPath= $SysFile 2>&1
        if ($LASTEXITCODE -ne 0) {
            Write-Log "Failed to create service: $result" "ERROR"
            return $false
        }
    }
    
    $result = sc.exe start $DriverName 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Log "Driver started successfully" "SUCCESS"
        return $true
    } else {
        Write-Log "Failed to start driver: $result" "ERROR"
        return $false
    }
}

function Test-DriverStatus {
    Write-Log "Checking driver status..."
    
    $service = Get-Service -Name $DriverName -ErrorAction SilentlyContinue
    
    if ($service) {
        Write-Log "Driver service status: $($service.Status)"
        return $service.Status -eq "Running"
    }
    
    Write-Log "Driver service not found"
    return $false
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  AI Guardian Driver Installer" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

if (-not (Test-Administrator)) {
    Write-Log "This script requires Administrator privileges" "ERROR"
    Write-Log "Please run PowerShell as Administrator and try again"
    exit 1
}

if (-not $SkipTestSign) {
    if (-not (Enable-TestSigning)) {
        Write-Log "Test signing is required for unsigned drivers" "WARN"
        Write-Log "Use -SkipTestSign to skip this step if driver is properly signed"
        if (-not $Force) {
            $response = Read-Host "Enable test signing mode? (y/n)"
            if ($response -ne "y") {
                Write-Log "Installation cancelled"
                exit 1
            }
        }
        Enable-TestSigning
    }
}

$cert = New-SelfSignedCertificate
if ($cert) {
    Add-CertificateToTrustedRoot -Cert $cert
    Sign-Driver -Cert $cert -SysFile $SysFile
}

if (-not (Install-Driver)) {
    Write-Log "Driver installation failed" "ERROR"
    exit 1
}

if (-not (Start-DriverService)) {
    Write-Log "Driver service start failed" "WARN"
    Write-Log "A system restart may be required"
}

if (Test-DriverStatus) {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "  Driver installed successfully!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
} else {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Yellow
    Write-Host "  Driver installed with warnings" -ForegroundColor Yellow
    Write-Host "  A system restart may be required" -ForegroundColor Yellow
    Write-Host "========================================" -ForegroundColor Yellow
    Write-Host ""
}
