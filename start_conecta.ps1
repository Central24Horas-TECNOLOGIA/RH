param(
    [string]$BindHost = "",
    [int]$Port = 0,
    [switch]$Reload
)

$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$VenvPython = Join-Path $ProjectRoot ".venv\Scripts\python.exe"
$Python = if (Test-Path -LiteralPath $VenvPython) { $VenvPython } else { "python" }

$RunArgs = @((Join-Path $ProjectRoot "run.py"))

if ($BindHost) {
    $RunArgs += "--host"
    $RunArgs += $BindHost
}

if ($Port -gt 0) {
    $RunArgs += "--port"
    $RunArgs += [string]$Port
}

if ($Reload) {
    $RunArgs += "--reload"
}

Write-Host ""
Write-Host "Conecta/RH - API e Front unificados"
$DisplayHost = if ($BindHost -and $BindHost -ne "0.0.0.0") { $BindHost } else { "127.0.0.1" }
$DisplayPort = if ($Port -gt 0) { $Port } else { 8000 }
Write-Host ("Acesse: http://{0}:{1}" -f $DisplayHost, $DisplayPort)
Write-Host ""

& $Python @RunArgs
exit $LASTEXITCODE
