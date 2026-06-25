# Endpoints operacionais

- `GET /health`: liveness da aplicação; não consulta dependências.
- `GET /ready`: readiness; retorna 503 quando o SQL Server não responde.
- `GET /version`: serviço, versão e ambiente.
- `GET /metrics`: metadado Prometheus interno.

O contrato completo é publicado pela própria aplicação em `/docs` e `/openapi.json`.
