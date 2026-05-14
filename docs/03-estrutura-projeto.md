# 03 — Estrutura do projeto

## Estrutura principal

```text
RH/
├── Front/
│   ├── index.html
│   ├── runtime-config.js
│   ├── estilos/
│   ├── Exames/
│   └── fonte/
│       ├── app/
│       ├── features/
│       ├── services/api/
│       ├── shared/
│       ├── ui/
│       ├── types/
│       ├── perguntas.js
│       ├── regras-prova.js
│       └── rotas.js
├── api/
│   ├── app.py
│   ├── requirements.txt
│   ├── rh_api/
│   │   ├── main.py
│   │   ├── config.py
│   │   ├── db.py
│   │   ├── auth.py
│   │   ├── routers/
│   │   ├── schemas/
│   │   ├── services/
│   │   └── repositories/
│   └── tests/
├── data/
│   ├── legacy/
│   └── private/
├── docs/
├── .env.example
├── requirements.txt
└── pytest.ini
```

## Pastas do frontend

| Caminho | Responsabilidade |
| --- | --- |
| `Front/index.html` | Entrada da aplicação no navegador |
| `Front/runtime-config.js` | Configuração de runtime do frontend |
| `Front/estilos/` | CSS, logos e imagens visuais |
| `Front/Exames/` | Arquivos Excel usados como base/apoio de provas |
| `Front/fonte/app/` | Inicialização, tela raiz e controlador central |
| `Front/fonte/features/gestao/` | Login, início, histórico, banco de talentos, análise e caixa de e-mail |
| `Front/fonte/features/processos/` | Lista, criação/edição e detalhes de processos |
| `Front/fonte/features/entrevistas/` | Slots e entrevistas |
| `Front/fonte/features/prova/` | Fluxo de prova, candidato, exame, conclusão e resultado |
| `Front/fonte/services/api/` | Funções JS que chamam os endpoints |
| `Front/fonte/shared/` | Helpers, validações, componentes pequenos e referência de processo |
| `Front/fonte/ui/` | Layout geral, menu lateral, busca e tour guiado |

## Pastas do backend

| Caminho | Responsabilidade |
| --- | --- |
| `api/app.py` | Entry point do Uvicorn |
| `api/rh_api/main.py` | Criação da aplicação FastAPI e registro de routers |
| `api/rh_api/config.py` | Leitura de `.env`, `config.ini` e variáveis de ambiente |
| `api/rh_api/db.py` | Conexão SQL Server via ODBC |
| `api/rh_api/auth.py` | Tokens e autenticação |
| `api/rh_api/routers/` | Endpoints HTTP |
| `api/rh_api/schemas/` | Modelos Pydantic de entrada/saída |
| `api/rh_api/services/` | Regras auxiliares e normalizações |
| `api/rh_api/repositories/` | Consultas SQL e persistência |
| `api/tests/` | Testes automatizados |

## Arquivos duplicados/legados

Foram encontrados arquivos `fonte/` também na raiz, além de `Front/fonte/`. Como `Front/index.html` importa `Front/fonte/principal.js`, a pasta `Front/fonte/` deve ser tratada como caminho ativo do frontend. A pasta `fonte/` pode ser cópia legada/espelho e não deve ser editada sem confirmar o servidor estático usado em produção.

## Dados privados

A pasta `data/private/` contém anexos, CVs e metadados. Ela não deve ir para GitHub público e precisa ser protegida em backup, permissões NTFS e compartilhamento de rede.
