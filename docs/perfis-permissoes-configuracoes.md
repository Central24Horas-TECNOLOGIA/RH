# Perfis, Permissoes e Configuracoes

## Perfis

O Conecta RH passa a trabalhar com quatro perfis padrao:

- Estagiario: operacao principal do processo seletivo.
- DP: documentacao/admissao e substituicao operacional do processo seletivo.
- Gestor: decisao, aprovacao, analise e acompanhamento.
- Administrador: controle total do sistema.

A matriz granular fica centralizada em `api/rh_api/rbac.py` e e aplicada tanto no token de sessao quanto nos guards das rotas.

## Backend

O bootstrap cria e atualiza as tabelas de seguranca e configuracao sem apagar dados existentes:

- `usuarios`
- `perfis`
- `permissoes`
- `perfil_permissoes`
- `logs_auditoria`
- `configuracoes_sistema`
- `configuracoes_lgpd`
- `motivos_eliminacao`
- `status_candidatos`
- `modelos_email`
- `documentos_tipos`
- `documentos_pacotes`
- `etapas`
- `trilhas`
- `provas`
- `questoes`
- `notificacoes_regras`

O login tenta autenticar pelo banco e mantem fallback compativel com `RH_AUTH_USER`/`RH_AUTH_PASSWORD`. O usuario inicial do `.env` e semeado como Administrador quando ainda nao existe na tabela `usuarios`.

## APIs novas

- `GET /settings/security/roles`
- `GET /settings/security/permissions`
- `GET /settings/users`
- `POST /settings/users`
- `PUT /settings/users/{id_usuario}`
- `POST /settings/users/{id_usuario}/password`
- `POST /settings/users/{id_usuario}/status`
- `DELETE /settings/users/{id_usuario}`
- `GET /settings/audit-logs`
- `GET /settings/audit-logs/export`
- `GET /settings/catalog`
- `POST /settings/catalog/{tipo}`
- `PUT /settings/catalog/{tipo}/{id_item}`
- `DELETE /settings/catalog/{tipo}/{id_item}`
- `POST /settings/lgpd/requests`

## Frontend

A sessao agora armazena perfil, nivel e permissoes. O menu lateral, atalhos e botoes principais usam essas permissoes antes de exibir acoes sensiveis.

A nova tela `#/configuracoes` centraliza:

- Usuarios.
- Perfis e matriz de permissoes.
- Regras reutilizaveis do sistema.
- Logs de auditoria.

A tela antiga `#/configuracao` continua existindo como fluxo operacional de preparacao de prova.

## Logs

Acoes criticas e tentativas negadas geram registros em `logs_auditoria` sempre que a rota passa pelo backend com usuario autenticado. O registro inclui usuario, perfil, modulo, acao, entidade, valores quando aplicavel, justificativa e origem quando disponivel.

## Como testar por perfil

1. Entre como Administrador e acesse `#/configuracoes`.
2. Crie usuarios para Estagiario, DP e Gestor.
3. Valide que Estagiario ve operacao seletiva e nao ve Configuracoes.
4. Valide que DP ve operacao seletiva e documentacao, mas nao gestao de usuarios.
5. Valide que Gestor ve analise/aprovacao e nao gestao administrativa global.
6. Valide que Administrador ve todas as telas e consegue criar, editar, bloquear, desbloquear, desativar e redefinir senha.
7. Tente chamar uma rota sem permissao com token de perfil limitado e confirme retorno `403`.
8. Confira `#/configuracoes` > Logs para as acoes criticas e tentativas negadas.
