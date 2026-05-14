# 10 — Manual do administrador/suporte

## Pré-requisitos

- Windows Server ou estação Windows autorizada.
- Python compatível com o projeto.
- SQL Server/SQL Server Express acessível.
- Driver ODBC do SQL Server instalado.
- Acesso ao banco `RH_Provas_C24H` ou equivalente configurado.
- Permissão na caixa Microsoft 365 de currículos, se e-mail estiver ativo.

## Instalação backend

```powershell
cd C:\Caminho\RH
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r apiequirements.txt
```

Se o `requirements.txt` falhar por encoding, recrie o arquivo em UTF-8 com os mesmos pacotes ou instale os pacotes principais manualmente.

## Configuração `.env`

Baseie-se em `.env.example`, mas não versionar o `.env` real.

Exemplo seguro:

```env
RH_APP_ENV=development
RH_LOG_LEVEL=INFO
RH_SQL_SERVER=192.168.5.62\SQLEXPRESS
RH_SQL_DATABASE=RH_Provas_C24H
RH_SQL_DRIVER=ODBC Driver 18 for SQL Server
RH_SQL_TRUSTED_CONNECTION=true
RH_SQL_ENCRYPT=no
RH_SQL_TRUST_SERVER_CERTIFICATE=true
RH_AUTH_USER=rh.local
RH_AUTH_PASSWORD=senha-forte
RH_AUTH_TOKEN_SECRET=segredo-grande-aleatorio
RH_AUTH_TOKEN_TTL_MINUTES=480
```

## Configuração do segredo de e-mail

O client secret não deve ficar em arquivo.

```powershell
setx RH_EMAIL_CLIENT_SECRET "COLE_O_SECRET_AQUI"
```

Depois feche e abra o terminal/serviço novamente.

## Subir API

```powershell
uvicorn api.app:app --host 127.0.0.1 --port 8010 --reload
```

Para rede interna, se necessário:

```powershell
uvicorn api.app:app --host 0.0.0.0 --port 8010
```

## Subir frontend local

```powershell
cd C:\Caminho\RH
python -m http.server 5500
```

Acessar:

```text
http://127.0.0.1:5500/Front/index.html#/login
```

## Checklist de diagnóstico

### API não sobe

1. Verificar `.venv` ativado.
2. Verificar `uvicorn` instalado.
3. Verificar porta em uso.
4. Verificar import error no terminal.
5. Verificar `pyodbc` e driver ODBC.

### Erro de banco

1. Testar conexão com SQL Server Management Studio.
2. Confirmar servidor/instância.
3. Confirmar nome do banco.
4. Confirmar driver ODBC 17/18.
5. Confirmar autenticação integrada ou usuário/senha.
6. Checar se o banco tem as tabelas esperadas.

### Caixa de e-mail não carrega

1. Conferir `RH_EMAIL_INBOX_ENABLED=true`.
2. Conferir mailbox, tenant, client ID e secret.
3. Confirmar permissões no Microsoft 365.
4. Reiniciar API após `setx`.
5. Verificar pasta de anexos e permissão de escrita.

### Frontend não chama API

1. Conferir `runtime-config.js`.
2. Conferir porta da API.
3. Conferir CORS.
4. Abrir console do navegador.
5. Testar endpoint raiz da API no navegador.

## Backup

Fazer backup de:

- banco SQL Server;
- pasta `data/private/`;
- `.env`/`config.ini` em cofre interno;
- anexos de e-mail;
- arquivos de prova se forem alterados.

## Boas práticas de manutenção

1. Alterar primeiro em ambiente de teste.
2. Fazer backup antes de mexer no banco.
3. Não editar arquivos em duplicidade sem saber qual é o ativo.
4. Documentar toda mudança de regra.
5. Testar o fluxo completo afetado, não só a tela alterada.
