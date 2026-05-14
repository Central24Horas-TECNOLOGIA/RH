# 11 — Diagramas UML e fluxos

Todos os diagramas abaixo estão em Mermaid. No GitHub, muitos deles renderizam automaticamente em arquivos Markdown. No VS Code, use uma extensão Mermaid para visualizar.

## 1. Diagrama de casos de uso

```mermaid
flowchart TB
    RH[Colaborador RH]
    Admin[Administrador/Suporte]
    Candidato[Candidato]
    Sistema[Conecta C24h]

    RH --> UC1[Gerenciar processos]
    RH --> UC2[Analisar currículos]
    RH --> UC3[Vincular candidato]
    RH --> UC4[Agendar entrevistas]
    RH --> UC5[Aplicar/consultar prova]
    RH --> UC6[Aprovar ou eliminar candidato]
    RH --> UC7[Consultar relatórios]
    RH --> UC8[Gerenciar banco de talentos]

    Admin --> UA1[Configurar API e banco]
    Admin --> UA2[Configurar caixa de e-mail]
    Admin --> UA3[Manter ambiente]

    Candidato --> UC9[Enviar candidatura pública quando habilitada]

    UC1 --> Sistema
    UC2 --> Sistema
    UC3 --> Sistema
    UC4 --> Sistema
    UC5 --> Sistema
    UC6 --> Sistema
    UC7 --> Sistema
    UC8 --> Sistema
    UC9 --> Sistema
    UA1 --> Sistema
    UA2 --> Sistema
    UA3 --> Sistema
```

## 2. Diagrama de componentes

```mermaid
flowchart LR
    subgraph Browser[Navegador]
        UI[Front/index.html]
        State[Controlador JS]
        ApiClient[services/api]
    end

    subgraph Backend[FastAPI]
        Routers[routers]
        Schemas[schemas]
        Services[services]
        Repos[repositories]
        Config[config.py]
    end

    subgraph Infra[Infraestrutura]
        SQL[(SQL Server)]
        Files[(CVs/anexos)]
        Mail[Microsoft 365]
    end

    UI --> State
    State --> ApiClient
    ApiClient --> Routers
    Routers --> Schemas
    Routers --> Services
    Services --> Repos
    Repos --> SQL
    Services --> Files
    Services --> Mail
    Config --> Routers
    Config --> Repos
```

## 3. Fluxo de currículo recebido por e-mail

```mermaid
sequenceDiagram
    actor RH
    participant Front as Frontend
    participant API as FastAPI
    participant Email as Email Inbox Service
    participant CV as Serviço de CV
    participant DB as SQL Server

    RH->>Front: Abre Caixa de E-mail
    Front->>API: GET /email-inbox/messages
    API->>Email: Lista mensagens/anexos
    Email-->>API: Mensagens normalizadas
    API-->>Front: Lista de e-mails

    RH->>Front: Clica em Analisar CV
    Front->>API: POST /email-inbox/messages/{id}/analyze-cv
    API->>Email: Obtém anexo
    API->>CV: Extrai texto e pontua
    CV-->>API: Nome, contatos, score, classificação
    API->>DB: Salva pré-análise/metadados
    API-->>Front: Resultado da análise

    RH->>Front: Vincula a processo
    Front->>API: POST /email-inbox/messages/{id}/link-process
    API->>DB: Cria/atualiza candidato no processo
    API-->>Front: Confirma vínculo
```

## 4. Fluxo de processo seletivo

```mermaid
stateDiagram-v2
    [*] --> Aberto
    Aberto --> RecebendoCandidatos: currículos/vínculos
    RecebendoCandidatos --> Triagem: analisar CV
    Triagem --> Entrevista: qualificado/agendado
    Triagem --> BancoTalentos: não usado agora
    Triagem --> Eliminado: reprovado
    Entrevista --> Aprovado: decisão positiva
    Entrevista --> Eliminado: decisão negativa
    Entrevista --> BancoTalentos: reaproveitar futuro
    Aprovado --> Encerrado: vagas preenchidas/fechamento
    Eliminado --> Encerrado: processo fechado
    BancoTalentos --> Encerrado: processo fechado
    Aberto --> Encerrado: encerramento manual
    Encerrado --> [*]
```

## 5. Estado do candidato

```mermaid
stateDiagram-v2
    [*] --> Analise
    Analise --> Qualificado: CV aprovado/decisão RH
    Analise --> NaoQualificado: CV fraco
    Qualificado --> Agendado: entrevista marcada
    Agendado --> Confirmado
    Agendado --> Reagendado
    Confirmado --> Compareceu
    Confirmado --> Faltou
    Reagendado --> Confirmado
    Compareceu --> Aprovado
    Compareceu --> Eliminado
    Compareceu --> BancoTalentos
    NaoQualificado --> BancoTalentos: decisão RH
    NaoQualificado --> Eliminado
    Faltou --> Eliminado
    Aprovado --> [*]
    Eliminado --> [*]
    BancoTalentos --> [*]
```

## 6. Fluxo de entrevista e slot

```mermaid
sequenceDiagram
    actor RH
    participant Front as Frontend
    participant API as FastAPI
    participant Repo as InterviewsRepository
    participant DB as SQL Server

    RH->>Front: Cria slot
    Front->>API: POST /interview-slots
    API->>Repo: Validar e inserir slot
    Repo->>DB: INSERT entrevista_slots
    DB-->>Repo: OK
    API-->>Front: Slot criado

    RH->>Front: Agenda candidato
    Front->>API: POST /interviews
    API->>Repo: Confere slot/capacidade
    Repo->>DB: INSERT entrevistas_agendadas
    Repo->>DB: Atualiza status do candidato
    API-->>Front: Entrevista agendada
```

## 7. Diagrama de classes lógico do backend

```mermaid
classDiagram
    class FastAPIApp {
      +create_app()
      +include_router()
      +exception_handlers()
    }

    class Router {
      +receber_http()
      +validar_payload()
      +retornar_json()
    }

    class Service {
      +normalizar_dados()
      +aplicar_regras()
      +montar_payload()
    }

    class Repository {
      +executar_sql()
      +mapear_linha()
      +persistir()
    }

    class Settings {
      +sql_server
      +sql_database
      +auth_user
      +email_config
    }

    class SQLServer {
      +tabelas()
      +views_logicas()
    }

    FastAPIApp --> Router
    Router --> Service
    Service --> Repository
    Repository --> SQLServer
    Settings --> FastAPIApp
    Settings --> Repository
```

## 8. DER lógico

```mermaid
erDiagram
    PROCESSOS_SELETIVOS ||--o{ CANDIDATOS_PROCESSOS : possui
    HISTORICO_PROVAS ||--o{ CANDIDATOS_PROCESSOS : referencia
    CANDIDATOS_PROCESSOS ||--o{ ENTREVISTAS_AGENDADAS : agenda
    ENTREVISTA_SLOTS ||--o{ ENTREVISTAS_AGENDADAS : ocupa
    PROCESSOS_SELETIVOS ||--o{ ENTREVISTA_SLOTS : abre
    PROCESSOS_SELETIVOS ||--o{ CV_PRE_ANALISES : recebe
    EMAIL_INBOX_ITEMS ||--o{ CV_PRE_ANALISES : gera
    HISTORICO_PROVAS ||--o{ CANDIDATOS_METADATA : tem
    HISTORICO_PROVAS ||--o{ CANDIDATOS_ANEXOS : anexa
    HISTORICO_PROVAS ||--o{ BANCO_TALENTOS : alimenta
    CANDIDATOS_PROCESSOS ||--o{ CANDIDATOS_MOVIMENTACOES : registra
```
