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

& $Python @RunArgs
exit $LASTEXITCODE
