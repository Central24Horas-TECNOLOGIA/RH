#!/usr/bin/env sh
set -eu

environment="${1:?informe dev, hml ou prod}"
database="${2:?informe o banco}"
expected="Conecta_$(printf '%s' "$environment" | tr '[:lower:]' '[:upper:]')"

[ "$database" = "$expected" ] || {
  echo "Banco '$database' não corresponde ao ambiente '$environment' (esperado: '$expected')." >&2
  exit 1
}

echo "Ambiente e banco validados: $environment -> $database"
