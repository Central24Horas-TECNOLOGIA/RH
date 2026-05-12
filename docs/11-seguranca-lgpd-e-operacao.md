# Documentação Conecta C24h - RH

> Gerado a partir da análise do pacote `RH(20).zip`. Esta documentação descreve o sistema existente, seus fluxos, telas, APIs, banco, código, testes, operação e manual do usuário.


## Segurança

- Proteger áreas administrativas com login.
- Limitar rotas públicas ao necessário.
- Não versionar `.env`, secrets, anexos, dumps ou logs sensíveis.
- Usar CORS restrito em produção.
- Reiniciar API após alterar segredo ou variável de ambiente.

## LGPD

O sistema trata dados pessoais de candidatos: nome, telefone, WhatsApp, e-mail, cidade/bairro, currículo, prova, observações e movimentações.

Recomendações:

1. Coletar apenas o necessário.
2. Definir prazo de retenção de CVs.
3. Restringir acesso ao RH autorizado.
4. Fazer backup seguro.
5. Evitar compartilhamento amplo de relatórios com dados pessoais.
6. Criar política para exclusão/anonimização quando necessário.

## Logs

- Registrar erro técnico, horário e endpoint.
- Não gravar token, senha, secret ou corpo completo de currículo.
- Manter logs suficientes para suporte.

## Rotina operacional

### Diária

- Verificar API.
- Verificar frontend.
- Validar caixa de e-mails.
- Conferir espaço em disco.

### Semanal

- Conferir backup.
- Revisar processos abertos antigos.
- Verificar erros recorrentes.
- Limpar dados de teste em homologação.

## Incidentes

| Incidente | Ação |
|---|---|
| API fora | Verificar serviço, venv, porta e logs. |
| SQL fora | Testar ODBC, rede, usuário e permissões. |
| E-mail falha | Validar config.ini, secret, permissões e protocolo. |
| Anexo falha | Conferir caminho e permissões de pasta. |
| Prova não salva | Preservar tela e coletar logs/console. |
