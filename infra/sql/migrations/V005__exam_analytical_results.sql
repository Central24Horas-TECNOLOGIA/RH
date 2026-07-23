/*
  Conecta Provas - modulo analitico de correcao e resultados.

  Migracao estritamente aditiva e idempotente. A nota oficial permanece em
  dbo.resultados_provas; nenhum objeto oficial e renomeado ou reinterpretado.
*/
SET XACT_ABORT ON;
SET NOCOUNT ON;

BEGIN TRY
    BEGIN TRANSACTION;

    IF OBJECT_ID('dbo.categorias_analiticas', 'U') IS NULL
    BEGIN
        CREATE TABLE dbo.categorias_analiticas (
            id_categoria INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_categorias_analiticas PRIMARY KEY,
            chave NVARCHAR(120) NOT NULL,
            nome NVARCHAR(180) NOT NULL,
            descricao NVARCHAR(500) NULL,
            ativo BIT NOT NULL CONSTRAINT DF_categorias_analiticas_ativo DEFAULT 1,
            sistema BIT NOT NULL CONSTRAINT DF_categorias_analiticas_sistema DEFAULT 1,
            ordem INT NOT NULL CONSTRAINT DF_categorias_analiticas_ordem DEFAULT 0,
            criado_em DATETIME2(3) NOT NULL CONSTRAINT DF_categorias_analiticas_criado DEFAULT SYSUTCDATETIME(),
            atualizado_em DATETIME2(3) NOT NULL CONSTRAINT DF_categorias_analiticas_atualizado DEFAULT SYSUTCDATETIME(),
            CONSTRAINT UQ_categorias_analiticas_chave UNIQUE (chave)
        );
    END;

    IF OBJECT_ID('dbo.configuracoes_analiticas_processos', 'U') IS NULL
    BEGIN
        CREATE TABLE dbo.configuracoes_analiticas_processos (
            id_configuracao BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_configuracoes_analiticas_processos PRIMARY KEY,
            id_processo NVARCHAR(120) NOT NULL,
            id_processo_ref NVARCHAR(220) NOT NULL,
            versao INT NOT NULL,
            status_configuracao NVARCHAR(30) NOT NULL CONSTRAINT DF_config_analitica_status DEFAULT N'Ativa',
            algoritmo_versao NVARCHAR(40) NOT NULL,
            amostra_minima INT NOT NULL CONSTRAINT DF_config_analitica_amostra DEFAULT 5,
            limiar_execucao_baixo DECIMAL(5,2) NOT NULL CONSTRAINT DF_config_analitica_baixo DEFAULT 30,
            limiar_execucao_alto DECIMAL(5,2) NOT NULL CONSTRAINT DF_config_analitica_alto DEFAULT 70,
            criado_por NVARCHAR(180) NULL,
            atualizado_por NVARCHAR(180) NULL,
            criado_em DATETIME2(3) NOT NULL CONSTRAINT DF_config_analitica_criado DEFAULT SYSUTCDATETIME(),
            atualizado_em DATETIME2(3) NOT NULL CONSTRAINT DF_config_analitica_atualizado DEFAULT SYSUTCDATETIME(),
            CONSTRAINT CK_config_analitica_status CHECK (status_configuracao IN (N'Ativa', N'Arquivada')),
            CONSTRAINT CK_config_analitica_amostra CHECK (amostra_minima >= 2 AND amostra_minima <= 1000),
            CONSTRAINT CK_config_analitica_limites CHECK (
                limiar_execucao_baixo >= 0 AND limiar_execucao_baixo <= 100 AND
                limiar_execucao_alto >= 0 AND limiar_execucao_alto <= 100 AND
                limiar_execucao_baixo < limiar_execucao_alto
            ),
            CONSTRAINT UQ_config_analitica_processo_versao UNIQUE (id_processo_ref, versao)
        );
    END;

    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('dbo.configuracoes_analiticas_processos') AND name = 'UX_config_analitica_ativa')
        CREATE UNIQUE INDEX UX_config_analitica_ativa
            ON dbo.configuracoes_analiticas_processos(id_processo_ref)
            WHERE status_configuracao = N'Ativa';

    IF OBJECT_ID('dbo.pesos_analiticos_processos', 'U') IS NULL
    BEGIN
        CREATE TABLE dbo.pesos_analiticos_processos (
            id_peso BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_pesos_analiticos_processos PRIMARY KEY,
            id_configuracao BIGINT NOT NULL,
            categoria_chave NVARCHAR(120) NOT NULL,
            peso DECIMAL(9,6) NOT NULL,
            obrigatoria BIT NOT NULL CONSTRAINT DF_pesos_analiticos_obrigatoria DEFAULT 1,
            criado_em DATETIME2(3) NOT NULL CONSTRAINT DF_pesos_analiticos_criado DEFAULT SYSUTCDATETIME(),
            atualizado_em DATETIME2(3) NOT NULL CONSTRAINT DF_pesos_analiticos_atualizado DEFAULT SYSUTCDATETIME(),
            CONSTRAINT FK_pesos_config_analitica FOREIGN KEY (id_configuracao) REFERENCES dbo.configuracoes_analiticas_processos(id_configuracao),
            CONSTRAINT FK_pesos_categoria_analitica FOREIGN KEY (categoria_chave) REFERENCES dbo.categorias_analiticas(chave),
            CONSTRAINT UQ_pesos_analiticos_config_categoria UNIQUE (id_configuracao, categoria_chave),
            CONSTRAINT CK_pesos_analiticos_valor CHECK (peso >= 0 AND peso <= 1)
        );
    END;

    IF OBJECT_ID('dbo.mapeamentos_categorias_analiticas', 'U') IS NULL
    BEGIN
        CREATE TABLE dbo.mapeamentos_categorias_analiticas (
            id_mapeamento BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_mapeamentos_categorias_analiticas PRIMARY KEY,
            id_configuracao BIGINT NOT NULL,
            origem_tipo NVARCHAR(20) NOT NULL,
            origem_chave NVARCHAR(180) NOT NULL,
            categoria_chave NVARCHAR(120) NOT NULL,
            ativo BIT NOT NULL CONSTRAINT DF_mapeamento_categoria_ativo DEFAULT 1,
            criado_por NVARCHAR(180) NULL,
            criado_em DATETIME2(3) NOT NULL CONSTRAINT DF_mapeamento_categoria_criado DEFAULT SYSUTCDATETIME(),
            atualizado_em DATETIME2(3) NOT NULL CONSTRAINT DF_mapeamento_categoria_atualizado DEFAULT SYSUTCDATETIME(),
            CONSTRAINT FK_mapeamento_config_analitica FOREIGN KEY (id_configuracao) REFERENCES dbo.configuracoes_analiticas_processos(id_configuracao),
            CONSTRAINT FK_mapeamento_categoria_analitica FOREIGN KEY (categoria_chave) REFERENCES dbo.categorias_analiticas(chave),
            CONSTRAINT UQ_mapeamento_categoria_origem UNIQUE (id_configuracao, origem_tipo, origem_chave),
            CONSTRAINT CK_mapeamento_categoria_tipo CHECK (origem_tipo IN (N'Etapa', N'Questao'))
        );
    END;

    IF OBJECT_ID('dbo.perfis_ideais_analiticos', 'U') IS NULL
    BEGIN
        CREATE TABLE dbo.perfis_ideais_analiticos (
            id_perfil_ideal BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_perfis_ideais_analiticos PRIMARY KEY,
            id_configuracao BIGINT NOT NULL,
            categoria_chave NVARCHAR(120) NOT NULL,
            valor_ideal DECIMAL(5,2) NOT NULL,
            peso_distancia DECIMAL(9,6) NULL,
            criado_em DATETIME2(3) NOT NULL CONSTRAINT DF_perfis_ideais_criado DEFAULT SYSUTCDATETIME(),
            atualizado_em DATETIME2(3) NOT NULL CONSTRAINT DF_perfis_ideais_atualizado DEFAULT SYSUTCDATETIME(),
            CONSTRAINT FK_perfil_ideal_config_analitica FOREIGN KEY (id_configuracao) REFERENCES dbo.configuracoes_analiticas_processos(id_configuracao),
            CONSTRAINT FK_perfil_ideal_categoria_analitica FOREIGN KEY (categoria_chave) REFERENCES dbo.categorias_analiticas(chave),
            CONSTRAINT UQ_perfil_ideal_config_categoria UNIQUE (id_configuracao, categoria_chave),
            CONSTRAINT CK_perfil_ideal_valor CHECK (valor_ideal >= 0 AND valor_ideal <= 100),
            CONSTRAINT CK_perfil_ideal_peso CHECK (peso_distancia IS NULL OR (peso_distancia >= 0 AND peso_distancia <= 1))
        );
    END;

    IF OBJECT_ID('dbo.analise_sessoes_etapas', 'U') IS NULL
    BEGIN
        CREATE TABLE dbo.analise_sessoes_etapas (
            id_sessao BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_analise_sessoes_etapas PRIMARY KEY,
            id_prova INT NOT NULL,
            id_teste NVARCHAR(120) NOT NULL,
            etapa_chave NVARCHAR(120) NOT NULL,
            iniciada_em DATETIME2(3) NULL,
            finalizada_em DATETIME2(3) NULL,
            status_etapa NVARCHAR(30) NOT NULL CONSTRAINT DF_analise_sessao_status DEFAULT N'Iniciada',
            tempo_ativo_segundos DECIMAL(12,3) NULL,
            ultima_questao_indice INT NULL,
            telemetria_versao NVARCHAR(40) NOT NULL CONSTRAINT DF_analise_sessao_versao DEFAULT N'1.0',
            criado_em DATETIME2(3) NOT NULL CONSTRAINT DF_analise_sessao_criado DEFAULT SYSUTCDATETIME(),
            atualizado_em DATETIME2(3) NOT NULL CONSTRAINT DF_analise_sessao_atualizado DEFAULT SYSUTCDATETIME(),
            CONSTRAINT UQ_analise_sessao_prova_etapa UNIQUE (id_prova, etapa_chave),
            CONSTRAINT CK_analise_sessao_status CHECK (status_etapa IN (N'Iniciada', N'Concluida', N'Interrompida', N'Expirada', N'Cancelada')),
            CONSTRAINT CK_analise_sessao_tempo CHECK (tempo_ativo_segundos IS NULL OR tempo_ativo_segundos >= 0)
        );
    END;

    IF OBJECT_ID('dbo.analise_metricas_respostas', 'U') IS NULL
    BEGIN
        CREATE TABLE dbo.analise_metricas_respostas (
            id_metrica BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_analise_metricas_respostas PRIMARY KEY,
            id_prova INT NOT NULL,
            id_teste NVARCHAR(120) NOT NULL,
            questao_indice INT NOT NULL,
            questao_id NVARCHAR(180) NULL,
            etapa_chave NVARCHAR(120) NULL,
            categoria_chave NVARCHAR(120) NULL,
            primeiro_acesso_em DATETIME2(3) NULL,
            ultima_alteracao_em DATETIME2(3) NULL,
            tempo_ativo_segundos DECIMAL(12,3) NULL,
            quantidade_alteracoes INT NOT NULL CONSTRAINT DF_analise_metrica_alteracoes DEFAULT 0,
            ordem_resposta INT NULL,
            tamanho_resposta_final INT NULL,
            evento_colagem BIT NOT NULL CONSTRAINT DF_analise_metrica_colagem DEFAULT 0,
            quantidade_colagens INT NOT NULL CONSTRAINT DF_analise_metrica_qtd_colagens DEFAULT 0,
            tamanho_colagem_aproximado INT NULL,
            telemetria_versao NVARCHAR(40) NOT NULL CONSTRAINT DF_analise_metrica_versao DEFAULT N'1.0',
            criado_em DATETIME2(3) NOT NULL CONSTRAINT DF_analise_metrica_criado DEFAULT SYSUTCDATETIME(),
            atualizado_em DATETIME2(3) NOT NULL CONSTRAINT DF_analise_metrica_atualizado DEFAULT SYSUTCDATETIME(),
            CONSTRAINT UQ_analise_metrica_prova_questao UNIQUE (id_prova, questao_indice),
            CONSTRAINT CK_analise_metrica_indices CHECK (questao_indice >= 0 AND quantidade_alteracoes >= 0 AND quantidade_colagens >= 0),
            CONSTRAINT CK_analise_metrica_tempo CHECK (tempo_ativo_segundos IS NULL OR tempo_ativo_segundos >= 0)
        );
    END;

    IF OBJECT_ID('dbo.analise_excel_detalhes', 'U') IS NULL
    BEGIN
        CREATE TABLE dbo.analise_excel_detalhes (
            id_detalhe_excel BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_analise_excel_detalhes PRIMARY KEY,
            id_prova INT NOT NULL,
            questao_indice INT NOT NULL,
            item_chave NVARCHAR(180) NOT NULL,
            item_rotulo NVARCHAR(300) NULL,
            status_item NVARCHAR(40) NULL,
            pontuacao DECIMAL(9,3) NULL,
            pontuacao_maxima DECIMAL(9,3) NULL,
            confianca DECIMAL(5,2) NULL,
            celula_esperada NVARCHAR(180) NULL,
            celula_encontrada NVARCHAR(180) NULL,
            valor_esperado NVARCHAR(500) NULL,
            valor_encontrado NVARCHAR(500) NULL,
            formula_encontrada NVARCHAR(1000) NULL,
            metodo_identificado NVARCHAR(120) NULL,
            tolerancia_utilizada DECIMAL(12,6) NULL,
            justificativa NVARCHAR(1000) NULL,
            gabarito_versao NVARCHAR(80) NOT NULL CONSTRAINT DF_analise_excel_gabarito DEFAULT N'legado',
            algoritmo_versao NVARCHAR(40) NOT NULL CONSTRAINT DF_analise_excel_algoritmo DEFAULT N'exam-analytics-1.0.0',
            detalhes_json NVARCHAR(MAX) NULL,
            analisado_em DATETIME2(3) NOT NULL CONSTRAINT DF_analise_excel_analisado DEFAULT SYSUTCDATETIME(),
            CONSTRAINT UQ_analise_excel_item UNIQUE (id_prova, questao_indice, item_chave),
            CONSTRAINT CK_analise_excel_json CHECK (detalhes_json IS NULL OR ISJSON(detalhes_json) = 1)
        );
    END;

    IF COL_LENGTH('dbo.analise_excel_detalhes', 'valor_esperado') IS NULL
        ALTER TABLE dbo.analise_excel_detalhes ADD valor_esperado NVARCHAR(500) NULL;
    IF COL_LENGTH('dbo.analise_excel_detalhes', 'valor_encontrado') IS NULL
        ALTER TABLE dbo.analise_excel_detalhes ADD valor_encontrado NVARCHAR(500) NULL;
    IF COL_LENGTH('dbo.analise_excel_detalhes', 'formula_encontrada') IS NULL
        ALTER TABLE dbo.analise_excel_detalhes ADD formula_encontrada NVARCHAR(1000) NULL;

    IF OBJECT_ID('dbo.analise_texto_detalhes', 'U') IS NULL
    BEGIN
        CREATE TABLE dbo.analise_texto_detalhes (
            id_detalhe_texto BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_analise_texto_detalhes PRIMARY KEY,
            id_prova INT NOT NULL,
            questao_indice INT NOT NULL,
            quantidade_caracteres INT NOT NULL,
            quantidade_palavras INT NOT NULL,
            quantidade_palavras_unicas INT NOT NULL,
            quantidade_sentencas INT NOT NULL,
            quantidade_paragrafos INT NOT NULL,
            media_palavras_sentenca DECIMAL(9,3) NULL,
            riqueza_lexical DECIMAL(9,6) NULL,
            indice_legibilidade DECIMAL(9,3) NULL,
            ocorrencias_ortograficas INT NULL,
            taxa_ocorrencias_palavra DECIMAL(9,6) NULL,
            indicadores_estrutura_json NVARCHAR(MAX) NOT NULL CONSTRAINT DF_analise_texto_estrutura DEFAULT N'{}',
            aderencia_termos_json NVARCHAR(MAX) NOT NULL CONSTRAINT DF_analise_texto_termos DEFAULT N'{}',
            ortografia_status NVARCHAR(40) NOT NULL CONSTRAINT DF_analise_texto_ortografia DEFAULT N'Indisponivel',
            gabarito_versao NVARCHAR(80) NOT NULL CONSTRAINT DF_analise_texto_gabarito DEFAULT N'legado',
            metrica_versao NVARCHAR(40) NOT NULL,
            analisado_em DATETIME2(3) NOT NULL CONSTRAINT DF_analise_texto_analisado DEFAULT SYSUTCDATETIME(),
            CONSTRAINT UQ_analise_texto_questao UNIQUE (id_prova, questao_indice),
            CONSTRAINT CK_analise_texto_json CHECK (ISJSON(indicadores_estrutura_json) = 1 AND ISJSON(aderencia_termos_json) = 1),
            CONSTRAINT CK_analise_texto_contagens CHECK (
                quantidade_caracteres >= 0 AND quantidade_palavras >= 0 AND quantidade_palavras_unicas >= 0 AND
                quantidade_sentencas >= 0 AND quantidade_paragrafos >= 0
            )
        );
    END;

    IF OBJECT_ID('dbo.analise_jobs_provas', 'U') IS NULL
    BEGIN
        CREATE TABLE dbo.analise_jobs_provas (
            id_job BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_analise_jobs_provas PRIMARY KEY,
            id_prova INT NOT NULL,
            id_teste NVARCHAR(120) NOT NULL,
            id_processo NVARCHAR(120) NOT NULL,
            id_processo_ref NVARCHAR(220) NOT NULL,
            tipo_job NVARCHAR(40) NOT NULL CONSTRAINT DF_analise_job_tipo DEFAULT N'Consolidar',
            etapa_chave NVARCHAR(120) NULL,
            motivo NVARCHAR(120) NULL,
            chave_idempotencia NVARCHAR(260) NOT NULL,
            status_job NVARCHAR(30) NOT NULL CONSTRAINT DF_analise_job_status DEFAULT N'Pendente',
            prioridade INT NOT NULL CONSTRAINT DF_analise_job_prioridade DEFAULT 100,
            tentativas INT NOT NULL CONSTRAINT DF_analise_job_tentativas DEFAULT 0,
            max_tentativas INT NOT NULL CONSTRAINT DF_analise_job_max DEFAULT 5,
            disponivel_em DATETIME2(3) NOT NULL CONSTRAINT DF_analise_job_disponivel DEFAULT SYSUTCDATETIME(),
            bloqueado_por NVARCHAR(180) NULL,
            bloqueado_em DATETIME2(3) NULL,
            codigo_erro NVARCHAR(80) NULL,
            ultimo_erro NVARCHAR(1000) NULL,
            algoritmo_versao NVARCHAR(40) NOT NULL CONSTRAINT DF_analise_job_algoritmo DEFAULT N'exam-analytics-1.0.0',
            gabarito_versao NVARCHAR(80) NOT NULL CONSTRAINT DF_analise_job_gabarito DEFAULT N'legado',
            criado_em DATETIME2(3) NOT NULL CONSTRAINT DF_analise_job_criado DEFAULT SYSUTCDATETIME(),
            iniciado_em DATETIME2(3) NULL,
            finalizado_em DATETIME2(3) NULL,
            atualizado_em DATETIME2(3) NOT NULL CONSTRAINT DF_analise_job_atualizado DEFAULT SYSUTCDATETIME(),
            CONSTRAINT UQ_analise_job_idempotencia UNIQUE (chave_idempotencia),
            CONSTRAINT CK_analise_job_status CHECK (status_job IN (N'Pendente', N'Processando', N'Concluido', N'Falhou', N'Cancelado')),
            CONSTRAINT CK_analise_job_tentativas CHECK (tentativas >= 0 AND max_tentativas BETWEEN 1 AND 20)
        );
    END;

    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('dbo.analise_jobs_provas') AND name = 'IX_analise_jobs_reserva')
        CREATE INDEX IX_analise_jobs_reserva ON dbo.analise_jobs_provas(status_job, prioridade, disponivel_em, id_job) INCLUDE (id_prova, id_processo_ref, tentativas, max_tentativas);

    IF OBJECT_ID('dbo.resultados_analiticos_categorias', 'U') IS NULL
    BEGIN
        CREATE TABLE dbo.resultados_analiticos_categorias (
            id_resultado_categoria BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_resultados_analiticos_categorias PRIMARY KEY,
            id_prova INT NOT NULL,
            id_teste NVARCHAR(120) NOT NULL,
            id_processo NVARCHAR(120) NOT NULL,
            id_processo_ref NVARCHAR(220) NOT NULL,
            id_configuracao BIGINT NULL,
            categoria_chave NVARCHAR(120) NOT NULL,
            categoria_nome NVARCHAR(180) NOT NULL,
            score_bruto DECIMAL(12,4) NULL,
            pontuacao_maxima DECIMAL(12,4) NULL,
            nota_oficial_normalizada DECIMAL(7,3) NULL,
            componentes_esperados INT NOT NULL CONSTRAINT DF_resultado_categoria_esperados DEFAULT 0,
            componentes_concluidos INT NOT NULL CONSTRAINT DF_resultado_categoria_concluidos DEFAULT 0,
            status_completude NVARCHAR(40) NOT NULL CONSTRAINT DF_resultado_categoria_completude DEFAULT N'Pendente',
            completo BIT NOT NULL,
            comparavel BIT NOT NULL,
            assinatura_comparabilidade CHAR(64) NULL,
            gabarito_versao NVARCHAR(80) NOT NULL CONSTRAINT DF_resultado_categoria_gabarito DEFAULT N'legado',
            percentil DECIMAL(7,3) NULL,
            z_score DECIMAL(12,6) NULL,
            posicao_densa INT NULL,
            tamanho_amostra INT NULL,
            amostra_pequena BIT NOT NULL CONSTRAINT DF_resultado_categoria_amostra DEFAULT 1,
            algoritmo_versao NVARCHAR(40) NOT NULL,
            configuracao_versao INT NULL,
            calculado_em DATETIME2(3) NOT NULL CONSTRAINT DF_resultado_categoria_calculado DEFAULT SYSUTCDATETIME(),
            CONSTRAINT UQ_resultado_categoria_prova UNIQUE (id_prova, categoria_chave),
            CONSTRAINT CK_resultado_categoria_nota CHECK (nota_oficial_normalizada IS NULL OR (nota_oficial_normalizada >= 0 AND nota_oficial_normalizada <= 100)),
            CONSTRAINT CK_resultado_categoria_percentil CHECK (percentil IS NULL OR (percentil >= 0 AND percentil <= 100))
        );
    END;

    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('dbo.resultados_analiticos_categorias') AND name = 'IX_resultado_categoria_coorte')
        CREATE INDEX IX_resultado_categoria_coorte
            ON dbo.resultados_analiticos_categorias(id_processo_ref, categoria_chave, assinatura_comparabilidade, completo, comparavel)
            INCLUDE (id_prova, nota_oficial_normalizada, percentil, posicao_densa, tamanho_amostra);

    IF OBJECT_ID('dbo.resultados_analiticos_processos', 'U') IS NULL
    BEGIN
        CREATE TABLE dbo.resultados_analiticos_processos (
            id_resultado_analitico BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_resultados_analiticos_processos PRIMARY KEY,
            id_prova INT NOT NULL,
            id_teste NVARCHAR(120) NOT NULL,
            id_registro INT NULL,
            id_processo NVARCHAR(120) NOT NULL,
            id_processo_ref NVARCHAR(220) NOT NULL,
            nome_candidato NVARCHAR(220) NOT NULL,
            vaga NVARCHAR(220) NULL,
            status_prova NVARCHAR(80) NULL,
            status_correcao_oficial NVARCHAR(80) NULL,
            nota_oficial DECIMAL(7,3) NULL,
            id_configuracao BIGINT NULL,
            configuracao_versao INT NULL,
            assinatura_comparabilidade CHAR(64) NULL,
            completo BIT NOT NULL,
            comparavel BIT NOT NULL,
            status_analitico NVARCHAR(40) NOT NULL,
            motivo_indisponibilidade NVARCHAR(500) NULL,
            score_analitico DECIMAL(7,3) NULL,
            percentil_geral DECIMAL(7,3) NULL,
            posicao_densa INT NULL,
            ranking_status NVARCHAR(30) NOT NULL CONSTRAINT DF_resultado_analitico_ranking DEFAULT N'Indisponivel',
            tamanho_amostra INT NULL,
            amostra_pequena BIT NOT NULL CONSTRAINT DF_resultado_analitico_amostra DEFAULT 1,
            aderencia_perfil DECIMAL(7,3) NULL,
            indicador_execucao NVARCHAR(80) NULL,
            correcao_manual_pendente BIT NOT NULL CONSTRAINT DF_resultado_analitico_manual DEFAULT 0,
            notas_oficiais_json NVARCHAR(MAX) NOT NULL CONSTRAINT DF_resultado_analitico_notas DEFAULT N'{}',
            categorias_json NVARCHAR(MAX) NOT NULL CONSTRAINT DF_resultado_analitico_categorias DEFAULT N'[]',
            etapas_json NVARCHAR(MAX) NOT NULL CONSTRAINT DF_resultado_analitico_etapas DEFAULT N'[]',
            alertas_json NVARCHAR(MAX) NOT NULL CONSTRAINT DF_resultado_analitico_alertas DEFAULT N'[]',
            explicacoes_json NVARCHAR(MAX) NOT NULL CONSTRAINT DF_resultado_analitico_explicacoes DEFAULT N'[]',
            gabarito_versao NVARCHAR(80) NOT NULL CONSTRAINT DF_resultado_analitico_gabarito DEFAULT N'legado',
            algoritmo_versao NVARCHAR(40) NOT NULL,
            fonte_atualizada_em DATETIME2(3) NULL,
            calculado_em DATETIME2(3) NOT NULL CONSTRAINT DF_resultado_analitico_calculado DEFAULT SYSUTCDATETIME(),
            atualizado_em DATETIME2(3) NOT NULL CONSTRAINT DF_resultado_analitico_atualizado DEFAULT SYSUTCDATETIME(),
            CONSTRAINT UQ_resultado_analitico_prova UNIQUE (id_prova),
            CONSTRAINT UQ_resultado_analitico_candidato_processo UNIQUE (id_processo_ref, id_teste),
            CONSTRAINT CK_resultado_analitico_status CHECK (status_analitico IN (N'Pendente', N'Parcial', N'Calculado', N'Invalido', N'Cancelado')),
            CONSTRAINT CK_resultado_analitico_json CHECK (
                ISJSON(notas_oficiais_json) = 1 AND ISJSON(categorias_json) = 1 AND ISJSON(etapas_json) = 1 AND ISJSON(alertas_json) = 1 AND ISJSON(explicacoes_json) = 1
            ),
            CONSTRAINT CK_resultado_analitico_scores CHECK (
                (nota_oficial IS NULL OR (nota_oficial >= 0 AND nota_oficial <= 100)) AND
                (score_analitico IS NULL OR (score_analitico >= 0 AND score_analitico <= 100)) AND
                (percentil_geral IS NULL OR (percentil_geral >= 0 AND percentil_geral <= 100)) AND
                (aderencia_perfil IS NULL OR (aderencia_perfil >= 0 AND aderencia_perfil <= 100))
            )
        );
    END;

    IF OBJECT_ID('dbo.historico_resultados_analiticos', 'U') IS NULL
    BEGIN
        CREATE TABLE dbo.historico_resultados_analiticos (
            id_historico BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_historico_resultados_analiticos PRIMARY KEY,
            id_prova INT NOT NULL,
            id_teste NVARCHAR(120) NOT NULL,
            id_processo_ref NVARCHAR(220) NOT NULL,
            id_configuracao BIGINT NULL,
            configuracao_versao INT NULL,
            algoritmo_versao NVARCHAR(40) NOT NULL,
            motivo NVARCHAR(120) NULL,
            chave_snapshot CHAR(64) NOT NULL,
            snapshot_json NVARCHAR(MAX) NOT NULL,
            arquivado_em DATETIME2(3) NOT NULL CONSTRAINT DF_historico_resultado_arquivado DEFAULT SYSUTCDATETIME(),
            CONSTRAINT UQ_historico_resultado_snapshot UNIQUE (chave_snapshot),
            CONSTRAINT CK_historico_resultado_json CHECK (ISJSON(snapshot_json) = 1)
        );
        CREATE INDEX IX_historico_resultado_prova ON dbo.historico_resultados_analiticos(id_prova, arquivado_em DESC);
    END;

    IF OBJECT_ID('dbo.historico_correcoes_manuais_provas', 'U') IS NULL
    BEGIN
        CREATE TABLE dbo.historico_correcoes_manuais_provas (
            id_historico_correcao BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_historico_correcoes_manuais_provas PRIMARY KEY,
            id_prova INT NOT NULL,
            id_teste NVARCHAR(120) NOT NULL,
            id_processo_ref NVARCHAR(220) NOT NULL,
            valores_anteriores_json NVARCHAR(MAX) NOT NULL,
            valores_novos_json NVARCHAR(MAX) NOT NULL,
            justificativa NVARCHAR(1000) NULL,
            alterado_por NVARCHAR(180) NULL,
            alterado_em DATETIME2(3) NOT NULL CONSTRAINT DF_historico_correcao_alterado DEFAULT SYSUTCDATETIME(),
            CONSTRAINT CK_historico_correcao_json CHECK (ISJSON(valores_anteriores_json) = 1 AND ISJSON(valores_novos_json) = 1)
        );
        CREATE INDEX IX_historico_correcao_prova ON dbo.historico_correcoes_manuais_provas(id_prova, alterado_em DESC);
    END;

    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('dbo.resultados_analiticos_processos') AND name = 'IX_resultado_analitico_lista')
        CREATE INDEX IX_resultado_analitico_lista
            ON dbo.resultados_analiticos_processos(id_processo_ref, status_analitico, score_analitico DESC, nome_candidato)
            INCLUDE (id_prova, id_teste, nota_oficial, posicao_densa, aderencia_perfil, indicador_execucao, tamanho_amostra);

    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('dbo.resultados_analiticos_processos') AND name = 'IX_resultado_analitico_ranking')
        CREATE INDEX IX_resultado_analitico_ranking
            ON dbo.resultados_analiticos_processos(id_processo_ref, posicao_densa, atualizado_em DESC)
            INCLUDE (id_teste, nome_candidato, score_analitico, percentil_geral, comparavel, ranking_status);

    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('dbo.resultados_analiticos_processos') AND name = 'IX_resultado_analitico_aderencia')
        CREATE INDEX IX_resultado_analitico_aderencia
            ON dbo.resultados_analiticos_processos(id_processo_ref, aderencia_perfil)
            INCLUDE (id_teste, status_analitico, score_analitico, posicao_densa, atualizado_em);

    COMMIT TRANSACTION;
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
    THROW;
END CATCH;
