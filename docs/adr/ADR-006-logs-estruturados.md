# ADR-006 — Logs estruturados

**Status:** aceito em 24/06/2026.

Logs são JSON em stdout com timestamp UTC, serviço, ambiente, versão, `request_id`,
usuário, ação e status. O coletor é responsabilidade da plataforma, não da aplicação.
