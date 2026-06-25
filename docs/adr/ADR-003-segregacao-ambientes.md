# ADR-003 — Segregação DEV/HML/PROD

**Status:** aceito em 24/06/2026.

Cada ambiente possui banco, rede, variáveis e volumes próprios. A aplicação bloqueia
DEV/HML quando o alvo contém a identificação de `Conecta_PROD`. Seeds são recusados
fora de DEV/HML.
