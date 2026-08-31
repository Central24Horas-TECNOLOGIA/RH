# Documentação Conecta C24h

Este diretório concentra a documentação técnica, operacional e histórica do
projeto.

## Índice atual

- [arquitetura/](arquitetura/): decisões e evolução arquitetural;
- [adr/](adr/): registros de decisão;
- [api/](api/): operação e contratos da API;
- [deploy/](deploy/): release e rollback;
- [seguranca/](seguranca/): perfis, permissões e controles;
- [operacao/](operacao/): incidentes, backup e restauração;
- [case-tecnico-plataforma-recrutamento.md](case-tecnico-plataforma-recrutamento.md):
  case técnico público e anonimizado da plataforma de apoio ao recrutamento;
- [performance-cache-loading.md](performance-cache-loading.md): cache, TTL,
  paginação, Loading Spinner, índices SQL e roteiro de testes;
- [RELATORIO_ORGANIZACAO_CONECTA.md](RELATORIO_ORGANIZACAO_CONECTA.md):
  auditoria e resultado da consolidação de 24/06/2026;
- [legacy/](legacy/): documentação histórica que não define caminhos atuais.

A estrutura executável oficial está descrita no [README da raiz](../README.md).
Documentos históricos podem citar `api/`, `Front/` ou `fonte/`; os caminhos
atuais equivalentes são `apps/backend/` e `apps/frontend/`.

> **Nota (achado DOC-001 do [programa de evolução do Conecta](connecta-evolution/README.md))**: os arquivos numerados `docs/01-*.md` a `docs/13-*.md` na raiz deste diretório (fora de `legacy/`) não estão neste índice porque seu conteúdo não foi revalidado contra o código atual — podem estar desatualizados da mesma forma que `legacy/`, mas ainda não foram formalmente arquivados. Até essa revalidação acontecer, trate-os com a mesma cautela de `legacy/`: confira contra o código antes de confiar no conteúdo.
