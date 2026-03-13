param(
    [switch]$Force
)

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

$DriverName = "AiGuardianDriver"

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

function Stop-DriverService {
    Write-Log "Stopping driver service..."
    
    $service = Get-Service -Name $DriverName -ErrorAction SilentlyContinue
    
    if (-not $service) {
        Write-Log "Driver service not found" "WARN"
        return $true
    }
    
    if ($service.Status -eq "Running") {
        $result = sc.exe stop $DriverName 2>&1
        Start-Sleep -Seconds 2
        
        if ($LASTEXITCODE -eq 0) {
            Write-Log "Driver stopped successfully" "SUCCESS"
        } else {
            Write-Log "Failed to stop driver: $result" "WARN"
        }
    }
    
    return $true
}

function Remove-DriverService {
    Write-Log "Removing driver service..."
    
    $result = sc.exe delete $DriverName 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Log "Driver service removed" "SUCCESS"
        return $true
    } else {
        Write-Log "Failed to remove service: $result" "WARN"
        return $false
    }
}

function Uninstall-Driver {
    Write-Log "Uninstalling driver from driver store..."
    
    $drivers = pnputil /enum-drivers | Select-String "AiGuardian" -Context 0,3
    
    if (-not $drivers) {
        Write-Log "Driver not found in driver store" "WARN"
        return $true
    }
    
    $drivers | ForEach-Object {
        $oemInf = ($_ -split "\s+")[1]
        if ($oemInf -match "oem\d+\.inf") {
            Write-Log "Removing $oemInf..."
            $result = pnputil /delete-driver $oemInf /force 2>&1
            if ($LASTEXITCODE -eq 0) {
                Write-Log "Removed $oemInf" "SUCCESS"
            } else {
                Write-Log "Failed to remove $oemInf : $result" "WARN"
            }
        }
    }
    
    return $true
}

function Disable-TestSigning {
    Write-Log "Checking test signing mode..."
    
    $currentStatus = bcdedit /enum | Select-String "testsigning"
    
    if ($currentStatus -match "Yes") {
        if (-not $Force) {
            $response = Read-Host "Disable test signing mode? (y/n)"
            if ($response -ne "y") {
                Write-Log "Keeping test signing mode enabled"
                return $true
            }
        }
        
        $result = bcdedit /set testsigning off 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Log "Test signing disabled" "SUCCESS"
        } else {
            Write-Log "Failed to disable test signing: $result" "WARN"
        }
    } else {
        Write-Log "Test signing is already disabled"
    }
    
    return $true
}

function Remove-Certificate {
    Write-Log "Removing driver certificate..."
    
    $cert = Get-ChildItem -Path Cert:\LocalMachine\My | Where-Object { 
        $_.Subject -match "AI Guardian Driver" 
    } | Select-Object -First 1
    
    if ($cert) {
        $store = New-Object System.Security.Cryptography.X509Certificates.X509Store("My", "LocalMachine")
        $store.Open("ReadWrite")
        $store.Remove($cert)
        $store.Close()
        Write-Log "Certificate removed from My store" "SUCCESS"
    }
    
    $rootCert = Get-ChildItem -Path Cert:\LocalMachine\Root | Where-Object { 
        $_.Subject -match "AI Guardian Driver" 
    } | Select-Object -First 1
    
    if ($rootCert) {
        $store = New-Object System.Security.Cryptography.X509Certificates.X509Store("Root", "LocalMachine")
        $store.Open("ReadWrite")
        $store.Remove($rootCert)
        $store.Close()
        Write-Log "Certificate removed from Trusted Root" "SUCCESS"
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  AI Guardian Driver Uninstaller" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

if (-not (Test-Administrator)) {
    Write-Log "This script requires Administrator privileges" "ERROR"
    Write-Log "Please run PowerShell as Administrator and try again"
    exit 1
}

if (-not $Force) {
    $response = Read-Host "Are you sure you want to uninstall the driver? (y/n)"
    if ($response -ne "y") {
        Write-Log "Uninstall cancelled"
        exit 0
    }
}

Stop-DriverService
Remove-DriverService
Uninstall-Driver
Remove-Certificate

if (-not $Force) {
    Disable-TestSigning
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  Driver uninstalled successfully!" -ForegroundColor Green
Write-Host "  A system restart may be required" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
