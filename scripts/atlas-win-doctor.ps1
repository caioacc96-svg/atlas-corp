$ErrorActionPreference = "Stop"

Write-Host "=== Atlas Win Doctor ===" -ForegroundColor Cyan

$NodeExe = (Get-Command node -ErrorAction Stop).Source
$NodeRoot = Split-Path $NodeExe -Parent
$NpmCli = Join-Path $NodeRoot "node_modules\npm\bin\npm-cli.js"

if (!(Test-Path $NpmCli)) {
  throw "npm-cli.js nao encontrado em $NpmCli"
}

Write-Host "Node: $NodeExe" -ForegroundColor Green
& $NodeExe -v
& $NodeExe $NpmCli -v

Write-Host "\nLimpando caches do electron-builder..." -ForegroundColor Cyan
Remove-Item -Recurse -Force "$env:LOCALAPPDATA\electron-builder\Cache\winCodeSign" -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force "$env:LOCALAPPDATA\electron-builder\Cache" -ErrorAction SilentlyContinue

Write-Host "\nAbrindo configuracao de Modo de Desenvolvedor..." -ForegroundColor Cyan
Start-Process "ms-settings:developers"

Write-Host "\nDoctor concluido. Use atlas-win-build.ps1 para install/build/dist." -ForegroundColor Green
