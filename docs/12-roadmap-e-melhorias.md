# Documentação Conecta C24h - RH

> Gerado a partir da análise do pacote `RH(20).zip`. Esta documentação descreve o sistema existente, seus fluxos, telas, APIs, banco, código, testes, operação e manual do usuário.


## Curto prazo

1. Padronizar status de candidato em todas as telas.
2. Melhorar heurística de identificação de nome em CV.
3. Criar confirmação forte para exclusão de e-mails.
4. Criar rotina de limpeza de dados de teste.
5. Exibir timeline/movimentações do candidato de forma mais clara.

## Médio prazo

1. Implementar autenticação Microsoft/SSO.
2. Criar perfis de acesso: RH, supervisor, direção e suporte.
3. Criar ficha consolidada do candidato para exportação.
4. Melhorar dashboards/funil de processos.
5. Parametrizar templates de WhatsApp/e-mail.

## Longo prazo

1. Portal do candidato.
2. Integração documental com SharePoint/OneDrive.
3. Auditoria completa por usuário.
4. Termos/consentimento LGPD.
5. Separação mais forte entre homologação e produção.

## Dívidas técnicas observadas

- Dados privados aparecem dentro da árvore do projeto; o ideal é isolar armazenamento operacional.
- Existem fachadas de compatibilidade úteis, mas que devem ser simplificadas no futuro.
- A ausência de build simplifica operação, mas exige atenção aos imports e módulos JS.
