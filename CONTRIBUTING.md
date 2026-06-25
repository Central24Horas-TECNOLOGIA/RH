# Contribuindo

1. Crie uma branch curta a partir de `main`.
2. Nunca versione `.env`, dados pessoais, currículos, dumps ou backups.
3. Mantenha regras de negócio em `domain`/`application`; rotas apenas adaptam HTTP.
4. Use queries parametrizadas e migrations versionadas para toda mudança estrutural.
5. Rode `python -m pytest` e os smoke tests do frontend antes do pull request.
6. Atualize `CHANGELOG.md` quando houver impacto funcional, operacional ou de segurança.

Commits e PRs devem explicar risco, evidência de teste e plano de rollback.
