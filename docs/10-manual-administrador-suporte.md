# 10 - Manual do administrador/suporte

## Pre-requisitos

- Windows Server ou estacao Windows autorizada.
- Python compativel com o projeto.
- SQL Server/SQL Server Express acessivel.
- Driver ODBC do SQL Server instalado.
- Acesso ao banco `RH_Provas_C24H` ou equivalente configurado.
- Permissao na caixa Microsoft 365 de curriculos, se e-mail estiver ativo.

## Instalacao

```powershell
cd C:\Caminho\RH
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

## Configuracao `.env`

Baseie-se em `.env.example`, mas nunca versione o `.env` real.

Exemplo seguro:

```env
RH_APP_ENV=development
RH_LOG_LEVEL=INFO
RH_SERVER_HOST=127.0.0.1
RH_SERVER_PORT=8010
RH_SERVE_FRONTEND=true
RH_SQL_SERVER=SERVIDOR_SQL,1433
RH_SQL_DATABASE=RH_Provas_C24H
RH_SQL_DRIVER=ODBC Driver 18 for SQL Server
RH_SQL_TRUSTED_CONNECTION=false
RH_SQL_USERNAME=
RH_SQL_PASSWORD=
RH_SQL_ENCRYPT=no
RH_SQL_TRUST_SERVER_CERTIFICATE=true
RH_AUTH_USER=rh.local
RH_AUTH_PASSWORD=senha-forte
RH_AUTH_TOKEN_SECRET=segredo-grande-aleatorio
RH_AUTH_TOKEN_TTL_MINUTES=480
```

## Segredos de e-mail

Secrets de e-mail nao devem ficar em documentacao nem commits.

```powershell
setx RH_EMAIL_CLIENT_SECRET "COLE_O_SECRET_AQUI"
```

Depois feche e abra o terminal ou reinicie o servico.

## Subir sistema local

```powershell
.\.venv\Scripts\python.exe run.py
```

Com reload apenas em desenvolvimento:

```powershell
.\.venv\Scripts\python.exe run.py --reload
```

Acesse:

```text
http://127.0.0.1:8000
```

## Subir no servidor interno

```powershell
$env:RH_APP_ENV="server"
$env:RH_SERVER_HOST="0.0.0.0"
$env:RH_SERVER_PORT="8010"
.\.venv\Scripts\python.exe run.py --no-reload
```

Se o servidor for `192.168.5.62`, libere firewall e acesse:

```text
http://192.168.5.62:8010
```

## Checklist de diagnostico

### Sistema nao sobe

1. Verificar `.venv` e Python.
2. Verificar `uvicorn` instalado.
3. Verificar porta em uso.
4. Verificar import error no terminal.
5. Verificar `pyodbc` e driver ODBC.

### Erro de banco

1. Testar conexao com SQL Server Management Studio.
2. Confirmar servidor/instancia.
3. Confirmar nome do banco.
4. Confirmar driver ODBC 17/18.
5. Confirmar autenticacao integrada ou usuario/senha.
6. Checar se o banco tem as tabelas esperadas.

### Caixa de e-mail nao carrega

1. Conferir `RH_EMAIL_INBOX_ENABLED=true`.
2. Conferir mailbox, tenant, client ID e secret.
3. Confirmar permissoes no Microsoft 365.
4. Reiniciar sistema apos `setx`.
5. Verificar pasta de anexos e permissao de escrita.

### Frontend nao chama API

1. Conferir `http://127.0.0.1:8000/runtime-config.js`.
2. Conferir console do navegador.
3. Conferir `RH_FRONTEND_API_BASE_URL`; para mesma origem deve ficar vazio.
4. Conferir CORS apenas se houver frontend externo.
5. Testar `http://127.0.0.1:8000/api/status`.

## Backup

Fazer backup de:

- banco SQL Server;
- pasta `data/private/`;
- segredos do `.env` em cofre interno;
- anexos de e-mail;
- arquivos de prova se forem alterados.

## Boas praticas de manutencao

1. Alterar primeiro em ambiente de teste.
2. Fazer backup antes de mexer no banco.
3. Nao editar arquivos em duplicidade sem saber qual e o ativo.
4. Documentar toda mudanca de regra.
5. Testar o fluxo completo afetado, nao so a tela alterada.
