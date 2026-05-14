# 08 — Backend

## Componentes centrais

| Arquivo/pasta | Função |
| --- | --- |
| `api/app.py` | Entry point para Uvicorn |
| `api/rh_api/main.py` | Cria app, middlewares, handlers e routers |
| `api/rh_api/config.py` | Lê configurações |
| `api/rh_api/db.py` | Conecta ao SQL Server |
| `api/rh_api/auth.py` | Geração/validação de token |
| `api/rh_api/dependencies.py` | Dependências injetáveis |
| `api/rh_api/logging_config.py` | Configuração de logs |

## Repositories

| Repository | Responsabilidade |
| --- | --- |
| `analytics.py` | Métricas, relatórios e análise de candidatos |
| `base.py` | Funções comuns de acesso e mapeamento |
| `bootstrap.py` | Criação/ajuste de schema complementar |
| `communications.py` | Comunicação/aprovação/mensagens |
| `cv_analysis.py` | Análise e pré-análise de CV |
| `email_inbox.py` | Caixa de e-mail e anexos |
| `history.py` | Histórico de provas/gabaritos |
| `interviews.py` | Slots e entrevistas |
| `pipeline.py` | Pipeline de candidatos |
| `processes.py` | Processos e candidatos no processo |
| `profiles.py` | Perfil do candidato |
| `public_candidacy.py` | Candidatura pública |
| `talent_bank.py` | Banco de talentos |

## Services

| Service | Responsabilidade |
| --- | --- |
| `process_flow.py` | Normalização de status e travas de fluxo |
| `cv.py` | Extração, limpeza, pontuação e análise de CV |
| `email_inbox_service.py` | Leitura/decodificação de e-mail e anexos |
| `interviews.py` | Status e mensagem de entrevista |
| `pipeline.py` | Conversão status x etapa de pipeline |
| `public_candidacy.py` | Slugs, URL pública e validação de upload |
| `public_job_texts.py` | Textos públicos da vaga |
| `analytics.py` | Qualidade/análise textual e relatório |

## Configuração

O carregamento segue esta prioridade:

1. Variáveis de ambiente já existentes.
2. `.env` em `api/` ou na raiz do projeto.
3. `config.ini` indicado por `RH_CONFIG_INI`.
4. `config.ini` na raiz do projeto ou pasta superior.
5. Defaults internos de desenvolvimento.

## E-mail Microsoft 365

Variáveis seguras esperadas:

```env
RH_EMAIL_INBOX_ENABLED=true
RH_EMAIL_INBOX_PROVIDER=microsoft365
RH_EMAIL_INBOX_PROTOCOL=imap
RH_EMAIL_INBOX_AUTH_MODE=oauth2
RH_EMAIL_INBOX_IMAP_HOST=outlook.office365.com
RH_EMAIL_INBOX_IMAP_PORT=993
RH_EMAIL_INBOX_ADDRESS=recrutamentoc24h@central24horas.com.br
RH_EMAIL_INBOX_USERNAME=recrutamentoc24h@central24horas.com.br
RH_EMAIL_INBOX_TENANT_ID=SEU_TENANT_ID
RH_EMAIL_INBOX_CLIENT_ID=SEU_CLIENT_ID
RH_EMAIL_INBOX_CLIENT_SECRET_ENV=RH_EMAIL_CLIENT_SECRET
RH_EMAIL_INBOX_SCOPES=https://outlook.office365.com/.default
RH_EMAIL_INBOX_ATTACHMENTS_DIR=C:\ConectaRH\email_attachments
```

O segredo real deve ser cadastrado no Windows:

```powershell
setx RH_EMAIL_CLIENT_SECRET "VALOR_DO_SECRET"
```

Depois, reinicie a API/serviço para reler a variável.

## Execução local

```powershell
cd CAMINHO\RH
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r apiequirements.txt
uvicorn api.app:app --host 127.0.0.1 --port 8010 --reload
```

## Pontos de atenção

1. O arquivo `api/requirements.txt` aparenta estar em UTF-16. Em Windows o pip pode lidar, mas é recomendável validar encoding se houver erro de instalação.
2. `pyodbc` exige driver ODBC instalado no Windows, não basta instalar o pacote Python.
3. A API tenta ajustar schema no startup; erros nesse ponto precisam ser vistos no log.
4. Em produção, reduza CORS e troque usuário/senha padrão.
