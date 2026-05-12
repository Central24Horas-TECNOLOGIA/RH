# Documentação Conecta C24h - RH

> Gerado a partir da análise do pacote `RH(20).zip`. Esta documentação descreve o sistema existente, seus fluxos, telas, APIs, banco, código, testes, operação e manual do usuário.


## Fluxo macro

```mermaid
flowchart TD
    A[Usuário acessa Front/index.html] --> B{Autenticado?}
    B -- Não --> C[Login]
    C --> D[POST /auth/login]
    D --> E[Painel RH]
    B -- Sim --> E
    E --> F[Processos]
    E --> G[Caixa de e-mails]
    E --> H[Histórico/Provas]
    E --> I[Entrevistas]
    E --> J[Banco de talentos]
    E --> K[Análise]
```

## Processo seletivo

```mermaid
sequenceDiagram
    actor RH
    participant Front
    participant API
    participant Repo
    participant DB
    RH->>Front: Preenche novo processo
    Front->>API: POST /processes
    API->>Repo: Cria processo
    Repo->>DB: INSERT processos_seletivos
    DB-->>Repo: OK
    Repo-->>API: Processo criado
    API-->>Front: success=true
```

## Candidatura pública

```mermaid
sequenceDiagram
    actor RH
    actor Candidato
    participant Front
    participant API
    participant DB
    RH->>Front: Gera link público
    Front->>API: POST /processos/{id}/gerar-link-candidatura
    API->>DB: Atualiza slug/link
    Candidato->>Front: Acessa #/candidatar/{slug}
    Front->>API: GET /public/candidatura/{slug}
    Candidato->>Front: Envia dados + CV
    Front->>API: POST /public/candidatura/{slug}/enviar
    API->>DB: Registra candidato, metadata e anexo
```

## Análise de CV

```mermaid
flowchart TD
    A[CV recebido] --> B{Origem}
    B --> C[E-mail]
    B --> D[Candidatura pública]
    B --> E[Upload/análise manual]
    C --> F[Extração de texto/dados]
    D --> F
    E --> F
    F --> G[Score e classificação]
    G --> H{Decisão RH}
    H -- Usar --> I[Adicionar ao processo]
    H -- Guardar --> J[Banco de talentos]
    H -- Não usar --> K[Ignorar/Ocultar]
```

## Prova

```mermaid
stateDiagram-v2
    [*] --> Configuracao
    Configuracao --> DadosCandidato
    DadosCandidato --> Execucao
    Execucao --> ValidacaoEntrega
    ValidacaoEntrega --> Finalizacao
    Finalizacao --> Resultado
    Resultado --> HistoricoSalvo
    HistoricoSalvo --> [*]
```

## Entrevistas

```mermaid
sequenceDiagram
    actor RH
    participant Front
    participant API
    participant DB
    RH->>Front: Cria slot
    Front->>API: POST /interview-slots
    API->>DB: INSERT entrevista_slots
    RH->>Front: Agenda candidato
    Front->>API: POST /interviews
    API->>DB: INSERT entrevistas_agendadas
```

## Casos de uso

```mermaid
flowchart LR
    RH((RH)) --> UC1[Autenticar]
    RH --> UC2[Gerenciar processos]
    RH --> UC3[Gerenciar candidatos]
    RH --> UC4[Analisar CV]
    RH --> UC5[Agendar entrevistas]
    RH --> UC6[Consultar histórico]
    RH --> UC7[Gerar relatórios]
    Candidato((Candidato)) --> UC8[Enviar candidatura pública]
    Candidato --> UC9[Realizar prova]
    TI((Suporte/TI)) --> UC10[Configurar ambiente]
    TI --> UC11[Manter API/Banco]
```

## ER funcional simplificado

```mermaid
erDiagram
    processos_seletivos ||--o{ candidatos_processos : possui
    candidatos_processos ||--o{ entrevistas_agendadas : agenda
    candidatos_processos ||--o{ candidatos_movimentacoes : movimenta
    historico_provas ||--o{ gabaritos : possui
    historico_provas ||--o{ candidatos_metadata : complementa
    candidatos_metadata ||--o{ candidatos_anexos : possui
    processos_seletivos ||--o{ cv_pre_analises : recebe
    email_inbox_items ||--o{ cv_pre_analises : gera
    banco_talentos ||--o{ candidatos_processos : reaproveita
    entrevista_slots ||--o{ entrevistas_agendadas : ocupa
```
