# Deploy e rollback

## Deploy

1. Execute CI e security scan.
2. Aplique migrations em HML e valide os fluxos críticos.
3. Publique imagens com a mesma versão imutável.
4. Em PROD, faça backup verificado e aplique migrations aditivas.
5. Suba `compose.prod.yml` e aguarde `/ready`.

## Rollback

Defina `APP_VERSION` para a versão anterior e execute novamente o Compose. Não remova
colunas no calor do incidente. Use scripts `.rollback.sql` apenas após avaliação do DBA.
