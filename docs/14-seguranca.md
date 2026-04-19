# 14 - Seguranca

## Controle de acesso

- A API protege rotas sensiveis com Bearer token.
- `HTTPBearer` e usado para extrair credencial.
- Tokens invalidos, expirados ou ausentes retornam `401`.

## Autenticacao

- Credenciais locais sao definidas em variaveis de ambiente.
- O token usa assinatura HMAC SHA-256.
- O payload do token carrega usuario e expiracao.

## Armazenamento de credenciais

- Usuario e senha nao devem ser fixados no codigo.
- O `.env` deve ser restrito ao ambiente local autorizado.
- O `RH_AUTH_TOKEN_SECRET` deve ser privado e trocado em caso de exposicao.

## Dados pessoais

O sistema trata dados pessoais e sensiveis de candidatos, incluindo:

- nome
- e-mail
- telefone
- historico de desempenho
- observacoes de RH
- curriculos enviados

## Cuidados com LGPD e privacidade interna

- Manter acesso restrito a equipe autorizada.
- Evitar exportacoes desnecessarias.
- Nao compartilhar payloads de prova ou CV fora do contexto operacional.
- Registrar somente o necessario em observacoes livres.

## Logs

- Logs atuais ficam em stdout.
- Evitar incluir senha ou token em log.
- Monitorar falhas de autenticacao e erros de banco.

## Banco de dados

- O backend usa conexao Windows com `Trusted_Connection=yes`.
- O usuario do Windows deve ter privilegios minimos necessarios.
- DDL complementar ocorre de forma controlada na inicializacao.

## Backup

Recomendacoes:

- Realizar backup regular do SQL Server.
- Garantir backup antes de alteracoes estruturais.
- Manter historico de restauracao testado.

## Resiliencia

- Deadlock do SQL Server tem retry baixo e resposta padronizada.
- Falhas de banco nao devem expor stack trace para o frontend.

## Navegador

- O tour guiado usa `localStorage`, que nao deve armazenar dados sensiveis; apenas flags de visita.
- O token de autenticacao atual e mantido em `sessionStorage`, o que reduz persistencia entre sessoes do navegador.
