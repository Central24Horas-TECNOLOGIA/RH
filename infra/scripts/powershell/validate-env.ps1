param(
    [Parameter(Mandatory = $true)][ValidateSet('dev', 'hml', 'prod')][string]$Environment,
    [Parameter(Mandatory = $true)][string]$Database
)

$expected = "Conecta_$($Environment.ToUpperInvariant())"
if ($Database -ne $expected) {
    throw "Banco '$Database' não corresponde ao ambiente '$Environment' (esperado: '$expected')."
}

Write-Host "Ambiente e banco validados: $Environment -> $Database"
