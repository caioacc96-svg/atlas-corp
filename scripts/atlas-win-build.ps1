$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $ProjectRoot

$NodeExe = (Get-Command node -ErrorAction Stop).Source
$NodeRoot = Split-Path $NodeExe -Parent
$NpmCli = Join-Path $NodeRoot "node_modules\npm\bin\npm-cli.js"

if (!(Test-Path $NpmCli)) {
  throw "npm-cli.js nao encontrado em $NpmCli"
}

function Invoke-Npm {
  param([string[]]$Args,[string]$Label)
  Write-Host "`n=== $Label ===" -ForegroundColor Cyan
  cmd /d /c "`"$NodeExe`" `"$NpmCli`" $($Args -join ' ')"
  if ($LASTEXITCODE -ne 0) {
    throw "Falha em '$Label' com exit code $LASTEXITCODE"
  }
}

Remove-Item -Recurse -Force "$env:LOCALAPPDATA\electron-builder\Cache\winCodeSign" -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force "$env:LOCALAPPDATA\electron-builder\Cache" -ErrorAction SilentlyContinue

Invoke-Npm -Args @('install') -Label 'npm install'
Invoke-Npm -Args @('run','build') -Label 'npm run build'
Invoke-Npm -Args @('run','dist') -Label 'npm run dist'

$UnpackedExe = Join-Path $ProjectRoot 'release\win-unpacked\Atlas Corp.exe'
if (Test-Path $UnpackedExe) {
  Write-Host "`nAbrindo: $UnpackedExe" -ForegroundColor Green
  Start-Process $UnpackedExe
} else {
  Write-Host "`nwin-unpacked nao encontrado em: $UnpackedExe" -ForegroundColor Yellow
}
