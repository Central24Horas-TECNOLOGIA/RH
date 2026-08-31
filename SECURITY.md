# Política de Segurança — Conecta

## Versões suportadas

O Conecta é um sistema interno de implantação contínua (não uma biblioteca versionada por linhas de suporte paralelas). Correções de segurança são aplicadas sempre à versão mais recente em produção — não há suporte retroativo a versões antigas.

## Como reportar uma vulnerabilidade

Se você encontrar uma vulnerabilidade de segurança no Conecta (exposição de dado pessoal, falha de autenticação/autorização, injeção, etc.):

1. **Não abra uma issue pública** no repositório descrevendo a vulnerabilidade em detalhe.
2. Reporte diretamente à equipe responsável pelo Conecta (Central24Horas — `Central24horas@central24horas.com.br`), descrevendo: passo a passo para reproduzir, impacto observado/esperado, e se há evidência de exploração real.
3. A equipe confirma o recebimento e investiga; achados confirmados entram no [Master Findings Registry](docs/connecta-evolution/02-findings/03_MASTER_FINDINGS.md) do programa de evolução do produto, com prioridade conforme severidade (`SEC-*`).
4. Vulnerabilidades críticas/altas (exposição de dado pessoal, bypass de autenticação/autorização) são tratadas como prioridade máxima — ver [runbook de incidentes](docs/operacao/incidentes.md).

## O que já existe hoje

Este projeto já roda, a cada PR, scan automatizado de:
- dependências Python (`pip-audit`);
- código Python (`bandit`);
- segredos commitados (`gitleaks`);
- vulnerabilidades de código (`CodeQL`).

Ver `.github/workflows/security.yml`.
