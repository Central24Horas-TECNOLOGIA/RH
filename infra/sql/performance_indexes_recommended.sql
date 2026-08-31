/*
  Conecta - indices recomendados para performance de listagens e filtros.

  Uso:
  1. Aplicar primeiro em HML.
  2. Medir planos de execucao e impacto em escrita.
  3. Promover para producao somente apos validacao.

  O script e idempotente e nao remove dados, tabelas, constraints ou indices existentes.
*/

IF OBJECT_ID('dbo.processos_seletivos', 'U') IS NOT NULL
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM sys.indexes
        WHERE name = 'IX_processos_status_data'
          AND object_id = OBJECT_ID('dbo.processos_seletivos')
    )
        CREATE INDEX IX_processos_status_data
            ON dbo.processos_seletivos (status, data_criacao DESC)
            INCLUDE (id_processo, id_processo_ref, vaga, operacao);

    IF NOT EXISTS (
        SELECT 1 FROM sys.indexes
        WHERE name = 'IX_processos_operacao_vaga'
          AND object_id = OBJECT_ID('dbo.processos_seletivos')
    )
        CREATE INDEX IX_processos_operacao_vaga
            ON dbo.processos_seletivos (operacao, vaga)
            INCLUDE (id_processo, id_processo_ref, status, data_criacao);
END;

IF OBJECT_ID('dbo.candidatos_processos', 'U') IS NOT NULL
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM sys.indexes
        WHERE name = 'IX_candidatos_processos_processo_status'
          AND object_id = OBJECT_ID('dbo.candidatos_processos')
    )
        CREATE INDEX IX_candidatos_processos_processo_status
            ON dbo.candidatos_processos (id_processo, id_processo_ref, status_candidato)
            INCLUDE (id_registro, id_teste, nome_candidato, vaga, data_prova, etapa_pipeline);

    IF NOT EXISTS (
        SELECT 1 FROM sys.indexes
        WHERE name = 'IX_candidatos_processos_teste'
          AND object_id = OBJECT_ID('dbo.candidatos_processos')
    )
        CREATE INDEX IX_candidatos_processos_teste
            ON dbo.candidatos_processos (id_teste)
            INCLUDE (id_registro, id_processo, id_processo_ref, status_candidato, vaga);

    IF NOT EXISTS (
        SELECT 1 FROM sys.indexes
        WHERE name = 'IX_candidatos_processos_pipeline_data'
          AND object_id = OBJECT_ID('dbo.candidatos_processos')
    )
        CREATE INDEX IX_candidatos_processos_pipeline_data
            ON dbo.candidatos_processos (etapa_pipeline, data_atualizacao_pipeline DESC)
            INCLUDE (id_registro, id_teste, id_processo, id_processo_ref, status_candidato);
END;

IF OBJECT_ID('dbo.banco_talentos', 'U') IS NOT NULL
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM sys.indexes
        WHERE name = 'IX_banco_talentos_data'
          AND object_id = OBJECT_ID('dbo.banco_talentos')
    )
        CREATE INDEX IX_banco_talentos_data
            ON dbo.banco_talentos (data_movimentacao DESC)
            INCLUDE (id_banco, id_teste, nome_candidato, vaga, id_processo, id_processo_ref);

    IF NOT EXISTS (
        SELECT 1 FROM sys.indexes
        WHERE name = 'IX_banco_talentos_teste'
          AND object_id = OBJECT_ID('dbo.banco_talentos')
    )
        CREATE INDEX IX_banco_talentos_teste
            ON dbo.banco_talentos (id_teste)
            INCLUDE (id_banco, nome_candidato, vaga, data_movimentacao);
END;

IF OBJECT_ID('dbo.entrevistas_agendadas', 'U') IS NOT NULL
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM sys.indexes
        WHERE name = 'IX_entrevistas_processo_data'
          AND object_id = OBJECT_ID('dbo.entrevistas_agendadas')
    )
        CREATE INDEX IX_entrevistas_processo_data
            ON dbo.entrevistas_agendadas (id_processo, id_processo_ref, data_entrevista)
            INCLUDE (id_entrevista, id_teste, status_entrevista);

    IF NOT EXISTS (
        SELECT 1 FROM sys.indexes
        WHERE name = 'IX_entrevistas_status_data'
          AND object_id = OBJECT_ID('dbo.entrevistas_agendadas')
    )
        CREATE INDEX IX_entrevistas_status_data
            ON dbo.entrevistas_agendadas (status_entrevista, data_entrevista)
            INCLUDE (id_entrevista, id_processo, id_processo_ref, id_teste);
END;

IF OBJECT_ID('dbo.provas_geradas', 'U') IS NOT NULL
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM sys.indexes
        WHERE name = 'IX_provas_geradas_processo_status'
          AND object_id = OBJECT_ID('dbo.provas_geradas')
    )
        CREATE INDEX IX_provas_geradas_processo_status
            ON dbo.provas_geradas (id_processo, id_processo_ref, status)
            INCLUDE (id_prova, id_teste, id_registro, gerada_em, finalizada_em);

    IF NOT EXISTS (
        SELECT 1 FROM sys.indexes
        WHERE name = 'IX_provas_geradas_teste_data'
          AND object_id = OBJECT_ID('dbo.provas_geradas')
    )
        CREATE INDEX IX_provas_geradas_teste_data
            ON dbo.provas_geradas (id_teste, atualizado_em DESC)
            INCLUDE (id_prova, id_registro, id_processo, id_processo_ref, status);
END;

IF OBJECT_ID('dbo.resultados_provas', 'U') IS NOT NULL
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM sys.indexes
        WHERE name = 'IX_resultados_provas_prova_data'
          AND object_id = OBJECT_ID('dbo.resultados_provas')
    )
        CREATE INDEX IX_resultados_provas_prova_data
            ON dbo.resultados_provas (id_prova, atualizado_em DESC)
            INCLUDE (id_resultado, nota_final_prova);
END;

IF OBJECT_ID('dbo.usuarios', 'U') IS NOT NULL
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM sys.indexes
        WHERE name = 'IX_usuarios_perfil_status'
          AND object_id = OBJECT_ID('dbo.usuarios')
    )
        CREATE INDEX IX_usuarios_perfil_status
            ON dbo.usuarios (perfil_id, status)
            INCLUDE (id_usuario, nome, email, login);
END;
