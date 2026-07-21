param(
    [string]$AppRoot = $null
)

if (-not $AppRoot) {
    $AppRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
}

if (-not $AppRoot -or $AppRoot -eq '') {
    Write-Host "Error: Unable to determine app root directory."
    exit 1
}

$ErrorActionPreference = 'Continue'

$startupKey = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run'
$startupName = 'TrustGateTMCompanion'

try {
    Remove-ItemProperty -Path $startupKey -Name $startupName -ErrorAction SilentlyContinue
    Write-Host "Startup entry removed."
} catch {
    Write-Host "Note: Could not remove startup entry."
}

$shortcutNames = @(
    'TrustGate TM Companion.lnk',
    'TrustGateTMCompanion.lnk'
)

$shortcutDirs = @(
    (Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs'),
    (Join-Path $env:USERPROFILE 'Desktop')
)

foreach ($dir in $shortcutDirs) {
    if (-not (Test-Path $dir)) { continue }
    foreach ($name in $shortcutNames) {
        $shortcutPath = Join-Path $dir $name
        if (Test-Path $shortcutPath) {
            Remove-Item $shortcutPath -Force -ErrorAction SilentlyContinue
            Write-Host "Removed shortcut: $shortcutPath"
        }
    }
}

if (Test-Path $AppRoot) {
    Remove-Item $AppRoot -Recurse -Force -ErrorAction SilentlyContinue
    Write-Host "Removed app folder: $AppRoot"
}

Write-Host "TrustGate TM Companion uninstalled successfully."
