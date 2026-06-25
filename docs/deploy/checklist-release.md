# Checklist de release

- [ ] Versão semântica e changelog atualizados.
- [ ] Testes, lint, build e scans aprovados.
- [ ] Nenhum segredo, dump, backup ou dado pessoal no diff.
- [ ] Migration e rollback revisados pelo DBA.
- [ ] Backup de PROD criado e verificado.
- [ ] Imagem testada em HML é a mesma promovida para PROD.
- [ ] `/health`, `/ready` e fluxos críticos validados.
- [ ] Responsável e janela de rollback definidos.
