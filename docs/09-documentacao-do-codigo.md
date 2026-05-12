# Documentação Conecta C24h - RH

> Gerado a partir da análise do pacote `RH(20).zip`. Esta documentação descreve o sistema existente, seus fluxos, telas, APIs, banco, código, testes, operação e manual do usuário.


## Estrutura

```text
RH/
├─ Front/       # frontend
├─ api/         # backend FastAPI
├─ data/        # dados/legados/anexos
├─ docs/        # documentação existente
└─ tests        # testes dentro de api/tests
```

## Responsabilidades

| Área | Responsabilidade |
|---|---|
| `Front/estilos` | CSS e imagens. |
| `Front/Exames` | Planilhas de prova. |
| `Front/fonte/app` | Bootstrap, tela atual e controlador. |
| `Front/fonte/features` | Telas de negócio. |
| `Front/fonte/services/api` | Cliente HTTP. |
| `Front/fonte/shared` | Helpers, validações e componentes pequenos. |
| `Front/fonte/ui` | Layout, busca, tour, feedback e modais. |
| `api/rh_api/routers` | Endpoints. |
| `api/rh_api/schemas` | Contratos Pydantic. |
| `api/rh_api/services` | Regras auxiliares. |
| `api/rh_api/repositories` | Persistência e SQL. |

## Arquivos e itens principais

| Arquivo | Funções/classes/exportações |
|---|---|
| `api/rh_api/__init__.py` | arquivo de apoio/configuração |
| `api/rh_api/auth.py` | classe `AuthenticatedUser`, função `_b64encode`, função `_b64decode`, função `_sign`, função `authenticate_credentials`, função `validate_access_token` |
| `api/rh_api/config.py` | função `_load_dotenv`, função `_load_runtime_ini`, função `_ini_value`, função `_ini_bool`, função `_split_csv`, função `_read_bool_env`, classe `Settings`, função `get_settings` |
| `api/rh_api/db.py` | função `_bool_to_connection_value`, função `build_connection_string`, função `get_connection` |
| `api/rh_api/dependencies.py` | função `get_repository`, função `get_current_user` |
| `api/rh_api/logging_config.py` | função `configure_logging` |
| `api/rh_api/main.py` | função `_serialize_validation_value`, função `_serialize_validation_error`, função `_get_validation_message`, função `create_app` |
| `api/rh_api/repositories/__init__.py` | arquivo de apoio/configuração |
| `api/rh_api/repositories/analytics.py` | função `_parse_date_filter`, função `_coerce_datetime`, função `_in_date_range`, função `_format_report_value`, função `_csv_bytes`, função `_report_filename`, classe `AnalyticsRepositoryMixin` |
| `api/rh_api/repositories/base.py` | classe `BaseRepository` |
| `api/rh_api/repositories/bootstrap.py` | função `ensure_cv_pre_analises_table`, função `ensure_pipeline_columns`, função `ensure_candidate_approval_columns`, função `ensure_process_columns`, função `ensure_candidate_metadata_table`, função `ensure_candidate_metadata_columns`, função `ensure_candidate_attachments_table`, função `ensure_email_inbox_items_table`, função `ensure_candidate_movements_table`, função `ensure_interviews_table`, função `ensure_interview_slots_table`, função `_ensure_process_reference_column` |
| `api/rh_api/repositories/communications.py` | função `_decode_header_value`, função `_extract_first_email`, função `_attachment_extension`, função `_safe_email_item_id`, função `_email_candidate_id`, função `_parse_metadata_datetime`, classe `CommunicationRepositoryMixin` |
| `api/rh_api/repositories/cv_analysis.py` | classe `CvAnalysisRepositoryMixin` |
| `api/rh_api/repositories/db_repository.py` | classe `DatabaseRepository` |
| `api/rh_api/repositories/email_inbox.py` | função `_parse_datetime`, função `_format_datetime`, função `_friendly_detected`, classe `EmailInboxRepositoryMixin` |
| `api/rh_api/repositories/history.py` | arquivo de apoio/configuração |
| `api/rh_api/repositories/interviews.py` | classe `InterviewRepositoryMixin` |
| `api/rh_api/repositories/pipeline.py` | classe `PipelineRepositoryMixin` |
| `api/rh_api/repositories/processes.py` | classe `ProcessRepositoryMixin` |
| `api/rh_api/repositories/profiles.py` | classe `CandidateProfileRepositoryMixin` |
| `api/rh_api/repositories/public_candidacy.py` | classe `PublicCandidacyRepositoryMixin` |
| `api/rh_api/repositories/talent_bank.py` | classe `TalentBankRepositoryMixin` |
| `api/rh_api/routers/analytics.py` | função `get_candidate_analytics`, função `get_candidate_analytics_detail`, função `get_process_report`, função `export_process_report`, função `get_candidate_report`, função `export_candidate_report` |
| `api/rh_api/routers/auth.py` | função `login`, função `me`, função `logout` |
| `api/rh_api/routers/email_inbox.py` | função `get_email_inbox_status`, função `list_email_inbox_messages`, função `get_email_inbox_message`, função `download_email_inbox_attachments`, função `analyze_email_inbox_cv`, função `link_email_inbox_to_process`, função `send_email_inbox_to_talent_bank`, função `ignore_email_inbox_item`, função `delete_email_inbox_item`, função `get_primary_email_inbox_attachment`, função `get_email_inbox_attachment` |
| `api/rh_api/routers/history.py` | função `_build_safe_payload_preview`, função `get_history`, função `save_history`, função `get_answer_files`, função `save_answer_file` |
| `api/rh_api/routers/interviews.py` | função `get_interviews`, função `get_interview_slots`, função `create_interview_slots`, função `update_interview_slot`, função `delete_interview_slot`, função `create_interview`, função `update_interview` |
| `api/rh_api/routers/pipeline.py` | função `get_candidate_pipeline`, função `create_candidate_pipeline_card`, função `move_candidate_pipeline_card`, função `delete_candidate_pipeline_card` |
| `api/rh_api/routers/processes.py` | função `get_processes`, função `create_process`, função `update_process`, função `close_process`, função `get_process_candidates`, função `create_process_candidate`, função `update_process_candidate_status`, função `record_approval_whatsapp`, função `send_approval_email`, função `get_talent_bank`, função `create_talent_bank_candidate`, função `delete_talent_bank_candidate` |
| `api/rh_api/routers/public_candidacy.py` | função `get_public_application`, função `submit_public_application` |
| `api/rh_api/routers/system.py` | função `root`, função `debug_gabaritos_columns`, função `debug_historico_provas_columns` |
| `api/rh_api/schemas/auth.py` | classe `LoginRequest`, classe `LoginResponse`, classe `SessionResponse` |
| `api/rh_api/schemas/common.py` | classe `BaseSchema`, classe `SuccessResponse`, classe `ErrorResponse` |
| `api/rh_api/schemas/history.py` | classe `HistoryRecordRequest`, classe `AnswerFileRequest` |
| `api/rh_api/schemas/interviews.py` | arquivo de apoio/configuração |
| `api/rh_api/schemas/pipeline.py` | classe `PipelineCardCreateRequest`, classe `PipelineCardMoveRequest` |
| `api/rh_api/schemas/processes.py` | classe `ProcessCreateRequest`, classe `ProcessUpdateRequest`, classe `ProcessCandidateCreateRequest`, classe `ProcessCandidateStatusUpdateRequest`, classe `StandaloneCandidateStatusUpdateRequest`, classe `TalentBankUseRequest`, classe `TalentBankCreateRequest`, classe `CvPreAnalysisUpdateRequest`, classe `CandidateProfileUpdateRequest` |
| `api/rh_api/services/analytics.py` | função `clean_analysis_text`, função `extract_analysis_text`, função `score_text_quality`, função `build_stage_expectation`, função `build_analysis_from_payload` |
| `api/rh_api/services/cv.py` | classe `CvTextExtractionError`, função `normalize_cv_text`, função `extract_email`, função `extract_phone`, função `extract_whatsapp`, função `is_valid_candidate_name`, função `_clean_candidate_name`, função `is_valid_email`, função `sanitize_phone`, função `is_valid_phone`, função `extract_education_strength`, função `has_experience_content` |
| `api/rh_api/services/email_inbox_service.py` | classe `EmailInboxUnavailable`, função `_decode_header_value`, função `_first_email`, função `_first_sender_name`, função `_attachment_extension`, função `_clean_filename`, função `_looks_like_person_name`, função `_strip_cv_words`, função `_parse_message_datetime`, função `_iso_datetime`, classe `EmailInboxService` |
| `api/rh_api/services/helpers.py` | função `rows_to_dicts`, função `normalize_text`, função `normalize_compare_text`, função `parse_float_br`, função `safe_json_loads`, função `normalize_string_list` |
| `api/rh_api/services/interviews.py` | função `normalize_interview_status`, função `format_interview_datetime`, função `split_interview_datetime`, função `build_interview_message` |
| `api/rh_api/services/pipeline.py` | função `normalize_pipeline_stage`, função `infer_pipeline_stage`, função `map_pipeline_stage_to_status`, função `build_pipeline_update_payload` |
| `api/rh_api/services/process_flow.py` | função `normalize_process_status`, função `is_process_closed`, função `canonicalize_candidate_status`, função `get_candidate_visible_status`, função `is_terminal_candidate_status`, função `is_active_candidate_status`, função `status_allows_final_decision`, função `status_allows_interview_scheduling`, função `map_cv_classification_to_status`, função `build_process_closed_message`, função `build_candidate_status_action_label`, função `build_approved_candidate_locked_message` |
| `api/rh_api/services/public_candidacy.py` | classe `ValidatedPublicCvUpload`, função `slugify_public_text`, função `generate_public_token`, função `build_public_process_slug`, função `resolve_public_frontend_base_url`, função `normalize_public_application_base_url`, função `resolve_public_candidate_base_url`, função `build_public_application_url`, função `_public_config_items_from_json`, função `resolve_public_process_description`, função `resolve_public_process_requirements`, função `resolve_public_process_responsibilities` |
| `api/rh_api/services/public_job_texts.py` | função `_resolve_job_key`, função `get_default_public_job_texts` |
| `Front/fonte/aplicacao.js` | arquivo de apoio/configuração |
| `Front/fonte/app/aplicacao-raiz.js` | `resolverTelaProtegida`, `Aplicacao` |
| `Front/fonte/app/controlador-aplicacao.js` | `TAMANHO_RECENTES`, `TAMANHO_HISTORICO`, `TAMANHO_ANALISE`, `TAMANHO_DETALHE_PROCESSO`, `criarEstadoInicial`, `hidratarEstado`, `persistirEstado`, `limparEstadoPersistido`, `navegarParaTela`, `usarTelaAtual`, `obterRegrasFormularioProcesso`, `obterAbreviacaoVaga` |
| `Front/fonte/dados-excel/dados.js` | `DADOS_EXCEL_BASE` |
| `Front/fonte/dados-excel/mailing.js` | `MAILING_EXCEL_BASE` |
| `Front/fonte/features/candidatos/index.js` | `normalizarTexto`, `candidatoEstaAprovado`, `obterEstadoAcoesCentral`, `possuiReferenciaProcessoReal`, `candidatoPodeAtrelar`, `renderizarAcoesCandidatoCentral`, `renderizarAcoesRapidasDetalhe`, `montarChaveCandidato`, `obterNotaCandidato`, `obterContatoPrincipal`, `obterClassificacaoCandidato`, `obterDataCandidato` |
| `Front/fonte/features/entrevistas/index.js` | `hojeIsoLocal`, `normalizarTexto`, `formatarHorarioSlot`, `obterSlotDisponivel`, `obterClasseStatusSlot`, `formatarOcupacaoSlot`, `TelaEntrevistas` |
| `Front/fonte/features/gestao/components/filtros.js` | `BlocoFiltro`, `CampoFiltro` |
| `Front/fonte/features/gestao/index.js` | `normalizarTextoPainel`, `obterClasseStatusEmail`, `obterClasseAlertaEmail`, `SecaoCurriculosRecebidosEmail`, `TelaLogin`, `TelaInicio`, `TelaCaixaEmail`, `TelaHistorico`, `TelaCriarProcesso`, `TelaBancoTalentos`, `GraficoComparativoAnalise`, `TelaAnaliseCandidatos` |
| `Front/fonte/features/infraestrutura-react.js` | arquivo de apoio/configuração |
| `Front/fonte/features/pipeline/index.js` | `indiceEtapa`, `obterEstadoAcoesCard`, `TelaPipelineCandidatos` |
| `Front/fonte/features/processos/components/section-toggle.js` | `CabecalhoSecaoColapsavel` |
| `Front/fonte/features/processos/index.js` | `normalizarTextoComparacao`, `obterNotaProvaCandidato`, `formatarOrigemCandidato`, `montarFormularioCandidato`, `candidatoTemProvaSalva`, `montarItensPublicosPadrao`, `normalizarItensPublicos`, `serializarItensPublicos`, `isPreAnaliseNaoQualificada`, `isPreAnaliseUtilizavelDireto`, `lerProblemasCv`, `montarCandidatoDeFluxo` |
| `Front/fonte/features/processos/state.js` | `CHAVE_PROCESSO_DETALHE`, `CHAVE_PIPELINE_PROCESSO`, `CHAVE_PIPELINE_CANDIDATO` |
| `Front/fonte/features/processos-estado.js` | arquivo de apoio/configuração |
| `Front/fonte/features/prova/index.js` | `normalizarTexto`, `montarIdentificadorCandidatoAgendado`, `deduplicarCandidatosAgendados`, `ModalAcessoAdministrativo`, `TelaConfiguracao`, `TelaCandidato`, `TelaProva`, `TelaConclusao`, `TelaResultado` |
| `Front/fonte/features/prova/services/excel-base-data.js` | `obterDadosBaseExcel` |
| `Front/fonte/features/public-candidacy/index.js` | `quebrarTextoEmLinhas`, `TelaCandidaturaPublica` |
| `Front/fonte/features/tela-entrevistas.js` | arquivo de apoio/configuração |
| `Front/fonte/features/tela-pipeline.js` | arquivo de apoio/configuração |
| `Front/fonte/features/telas-gestao.js` | arquivo de apoio/configuração |
| `Front/fonte/features/telas-processos.js` | arquivo de apoio/configuração |
| `Front/fonte/features/telas-prova.js` | arquivo de apoio/configuração |
| `Front/fonte/infraestrutura-react.js` | arquivo de apoio/configuração |
| `Front/fonte/logger.js` | `escrever`, `criarLogger` |
| `Front/fonte/perguntas.js` | `wordQ`, `mcqQ`, `excelExternalQ`, `wordBasicPool`, `wordBasicLevel3Pool`, `wordAdvancedPool`, `generalBasicPool`, `generalAdvPeoplePool`, `generalAdvancedPool`, `techTiBasicPool`, `techRhBasicPool`, `techAdmBasicPool` |
| `Front/fonte/principal.js` | `renderizarFalhaInicializacao`, `iniciarAplicacao` |
| `Front/fonte/regras-prova.js` | `obterBibliotecaXlsx`, `criarResultadoPontuacao`, `criarResultadoChecklist`, `resumirConclusaoChecklist`, `possuiValidacaoExcelImplementada`, `obterPlanilha`, `obterValorCelula`, `obterCelula`, `celulaTemDados`, `planilhaTemAutofiltro`, `adicionarLinhas`, `converterMatrizParaPlanilha` |
| `Front/fonte/rotas.js` | `ROTAS_POR_TELA`, `TELAS_POR_ROTA`, `obterRotaPorTela`, `obterTelaPorHash`, `montarHashDaTela`, `obterSlugCandidaturaPorHash`, `montarHashCandidatura` |
| `Front/fonte/services/api/analytics.js` | `lerAnalisesCandidatos`, `lerDetalheAnaliseCandidato`, `montarParametrosRelatorio`, `lerRelatorioProcessos`, `baixarRelatorioProcessos`, `lerRelatorioCandidatos`, `baixarRelatorioCandidatos` |
| `Front/fonte/services/api/auth.js` | `fazerLoginApi`, `verificarSessaoApi`, `encerrarSessaoApi` |
| `Front/fonte/services/api/core.js` | `URL_PUBLICA_BASE_CANDIDATURA`, `EVENTO_AUTENTICACAO_EXPIRADA`, `lerCache`, `gravarCache`, `lerSessaoAutenticacao`, `salvarSessaoAutenticacao`, `limparSessaoAutenticacao`, `possuiSessaoAutenticada`, `notificarSessaoExpirada`, `lerMensagemErro`, `executarRequisicao`, `extrairNomeArquivo` |
| `Front/fonte/services/api/history.js` | `lerHistorico`, `lerHistoricoPaginado`, `salvarHistorico`, `lerArquivosResposta`, `salvarArquivoResposta` |
| `Front/fonte/services/api/interviews.js` | `lerEntrevistas`, `lerSlotsEntrevista`, `criarSlotsEntrevista`, `atualizarSlotEntrevista`, `excluirSlotEntrevista`, `agendarEntrevista`, `atualizarEntrevista` |
| `Front/fonte/services/api/pipeline.js` | `lerPipelineCandidatos`, `criarCardPipeline`, `moverCardPipeline`, `excluirCardPipeline` |
| `Front/fonte/services/api/processes.js` | `lerProcessos`, `criarProcesso`, `atualizarProcesso`, `encerrarProcesso`, `lerCandidatosProcessos`, `criarCandidatoNoProcesso`, `atualizarStatusCandidato`, `atualizarStatusCandidatoAvulso`, `lerBancoTalentos`, `removerBancoTalentos`, `criarBancoTalentos`, `atualizarPerfilCandidato` |
| `Front/fonte/services/api/public-candidacy.js` | `lerPaginaPublicaCandidatura`, `enviarCandidaturaPublica` |
| `Front/fonte/servico-api.js` | `criarBancoTalentos` |
| `Front/fonte/shared/browser-utils.js` | `copiarTexto`, `toDatetimeLocal`, `montarUrlPublicaCandidatura`, `obterBasePublicaCandidatura`, `abrirBlobEmNovaGuia` |
| `Front/fonte/shared/components/actions.js` | `AcaoSair` |
| `Front/fonte/shared/components/approval-modal.js` | `DOCUMENTOS_APROVACAO_PADRAO`, `formatarDataComparecimento`, `montarListaDocumentos`, `montarMensagemAprovacaoPadrao`, `atualizarDocumentosNaMensagem`, `atualizarDataNaMensagem`, `validarAnexoAprovacao`, `lerArquivoComoBase64`, `ModalAprovacaoCandidato` |
| `Front/fonte/shared/components/empty-table-row.js` | `TabelaVazia` |
| `Front/fonte/shared/helpers-visuais.js` | `formatarTempoRestante`, `formatarNotaVisual`, `obterClasseEtapaResultado`, `obterClasseStatusProcesso`, `obterClasseStatusEntrevista`, `formatarDataHora`, `montarDescricaoFluxo`, `obterClasseAderencia`, `montarResumoAnaliticoCv` |
| `Front/fonte/shared/process-flow.js` | `normalizeCompareText`, `normalizeProcessStatus`, `isProcessClosed`, `canonicalizeCandidateStatus`, `getCandidateVisibleStatus`, `isTerminalCandidateStatus`, `isActiveCandidateStatus`, `isStandaloneCandidate`, `getCandidateActionState`, `getCandidateFlowGroup`, `getPipelineStageLabel` |
| `Front/fonte/shared/process-reference.js` | `normalizarValor`, `obterReferenciaProcesso`, `obterIdVisualProcesso`, `obterChaveProcesso`, `mesmoProcesso`, `encontrarProcessoPorReferencia`, `montarPayloadProcessoSelecionado`, `obterReferenciaProcessoDoCandidato` |
| `Front/fonte/shared/tour-config.js` | `montarSeletor`, `obterTourDaTela`, `obterTourLogin` |
| `Front/fonte/shared/validacoes.js` | `normalizarTexto`, `quebrarListaTexto`, `validarFormularioProcesso`, `validarCardPipeline`, `validarFormularioEntrevista`, `validarPerfilCandidato` |
| `Front/fonte/ui/busca-global.js` | `CHAVE_REQUISITO_BUSCA`, `normalizarBusca`, `montarTextoBusca`, `carregarIndiceBuscaGlobal`, `filtrarResultados`, `rotuloTipo`, `selecionarResultado`, `BuscaGlobalTopbar` |
| `Front/fonte/ui/componentes-compartilhados.js` | arquivo de apoio/configuração |
| `Front/fonte/ui/components/exam-fields.js` | `escaparHtml`, `normalizarConteudoRichText`, `limparHtmlVazio`, `EditorTextoRich`, `PerguntaMultipla`, `PerguntaExcel` |
| `Front/fonte/ui/components/feedback.js` | `BotaoPaginacao`, `GrupoPaginacao`, `MetricGrid`, `EmptyState`, `LoadingState` |
| `Front/fonte/ui/components/layout.js` | `BarraLateral`, `PageIntro`, `SectionCard`, `PainelRh` |
| `Front/fonte/ui/components/modals.js` | `ModalPadrao`, `ModalDetalhesProva` |
| `Front/fonte/ui/tour-guiado.js` | `montarChaveTour`, `clamp`, `calcularPosicao`, `BotaoAjudaTour`, `TourGuiado` |
| `Front/fonte/utilitarios.js` | `sanitizarNomeArquivo`, `removerHtml`, `escaparHtml`, `textoMaiusculoSeguro`, `contarFrases`, `contarItensListaNoHtml`, `formatarDataParaInput`, `obterItensPaginados`, `construirModeloPaginacao`, `formatarNotaAnalise`, `formatarPercentualAfinidade`, `formatarNotaDetalhe` |

## Inventário de arquivos relevantes

- `.edge-dom-inicio.html`
- `.env`
- `.env.example`
- `.gitignore`
- `.uvicorn.err.log`
- `.uvicorn.out.log`
- `Front/Exames/exame_avancado.xlsx`
- `Front/Exames/exame_avancado_nvl2.xlsx`
- `Front/Exames/exame_basico.xlsx`
- `Front/Exames/exame_medio.xlsx`
- `Front/README.md`
- `Front/debug-artifacts/exame_basico_resolvido.xlsx`
- `Front/estilos/Conexa_logo_branca.png`
- `Front/estilos/Fundo-azul.png`
- `Front/estilos/base.css`
- `Front/estilos/estilos.css`
- `Front/estilos/fundo-login.png`
- `Front/estilos/fundo-rh.png`
- `Front/estilos/layout.css`
- `Front/estilos/logo-central24.jpg`
- `Front/estilos/logo-conecta-c24h-branca.png`
- `Front/estilos/logo-conecta-c24h.png`
- `Front/estilos/logo-conexa.png`
- `Front/estilos/logo_conecta_branco.png`
- `Front/estilos/logo_conecta_padrao.png`
- `Front/estilos/print.css`
- `Front/estilos/screens.css`
- `Front/estilos/tokens.css`
- `Front/fonte/aplicacao.js`
- `Front/fonte/app/aplicacao-raiz.js`
- `Front/fonte/app/controlador-aplicacao.js`
- `Front/fonte/dados-excel/dados.js`
- `Front/fonte/dados-excel/mailing.js`
- `Front/fonte/features/candidatos/index.js`
- `Front/fonte/features/entrevistas/index.js`
- `Front/fonte/features/gestao/components/filtros.js`
- `Front/fonte/features/gestao/index.js`
- `Front/fonte/features/infraestrutura-react.js`
- `Front/fonte/features/pipeline/index.js`
- `Front/fonte/features/processos/components/section-toggle.js`
- `Front/fonte/features/processos/index.js`
- `Front/fonte/features/processos/state.js`
- `Front/fonte/features/processos-estado.js`
- `Front/fonte/features/prova/index.js`
- `Front/fonte/features/prova/services/excel-base-data.js`
- `Front/fonte/features/public-candidacy/index.js`
- `Front/fonte/features/tela-entrevistas.js`
- `Front/fonte/features/tela-pipeline.js`
- `Front/fonte/features/telas-gestao.js`
- `Front/fonte/features/telas-processos.js`
- `Front/fonte/features/telas-prova.js`
- `Front/fonte/infraestrutura-react.js`
- `Front/fonte/logger.js`
- `Front/fonte/perguntas.js`
- `Front/fonte/principal.js`
- `Front/fonte/regras-prova.js`
- `Front/fonte/rotas.js`
- `Front/fonte/services/api/analytics.js`
- `Front/fonte/services/api/auth.js`
- `Front/fonte/services/api/core.js`
- `Front/fonte/services/api/history.js`
- `Front/fonte/services/api/interviews.js`
- `Front/fonte/services/api/pipeline.js`
- `Front/fonte/services/api/processes.js`
- `Front/fonte/services/api/public-candidacy.js`
- `Front/fonte/servico-api.js`
- `Front/fonte/shared/browser-utils.js`
- `Front/fonte/shared/components/actions.js`
- `Front/fonte/shared/components/approval-modal.js`
- `Front/fonte/shared/components/empty-table-row.js`
- `Front/fonte/shared/helpers-visuais.js`
- `Front/fonte/shared/process-flow.js`
- `Front/fonte/shared/process-reference.js`
- `Front/fonte/shared/tour-config.js`
- `Front/fonte/shared/validacoes.js`
- `Front/fonte/types/api.ts`
- `Front/fonte/types/models.ts`
- `Front/fonte/types/runtime.d.ts`
- `Front/fonte/ui/busca-global.js`
- `Front/fonte/ui/componentes-compartilhados.js`
- `Front/fonte/ui/components/exam-fields.js`
- `Front/fonte/ui/components/feedback.js`
- `Front/fonte/ui/components/layout.js`
- `Front/fonte/ui/components/modals.js`
- `Front/fonte/ui/tour-guiado.js`
- `Front/fonte/utilitarios.js`
- `Front/index.html`
- `Front/runtime-config.js`
- `Front/tsconfig.json`
- `README.md`
- `api/.idea/workspace.xml`
- `api/README.md`
- `api/app.py`
- `api/debug_db_schema.py`
- `api/requirements.txt`
- `api/rh_api/__init__.py`
- `api/rh_api/auth.py`
- `api/rh_api/config.py`
- `api/rh_api/db.py`
- `api/rh_api/dependencies.py`
- `api/rh_api/logging_config.py`
- `api/rh_api/main.py`
- `api/rh_api/repositories/__init__.py`
- `api/rh_api/repositories/analytics.py`
- `api/rh_api/repositories/base.py`
- `api/rh_api/repositories/bootstrap.py`
- `api/rh_api/repositories/communications.py`
- `api/rh_api/repositories/cv_analysis.py`
- `api/rh_api/repositories/db_repository.py`
- `api/rh_api/repositories/email_inbox.py`
- `api/rh_api/repositories/history.py`
- `api/rh_api/repositories/interviews.py`
- `api/rh_api/repositories/pipeline.py`
- `api/rh_api/repositories/processes.py`
- `api/rh_api/repositories/profiles.py`
- `api/rh_api/repositories/public_candidacy.py`
- `api/rh_api/repositories/talent_bank.py`
- `api/rh_api/routers/analytics.py`
- `api/rh_api/routers/auth.py`
- `api/rh_api/routers/email_inbox.py`
- `api/rh_api/routers/history.py`
- `api/rh_api/routers/interviews.py`
- `api/rh_api/routers/pipeline.py`
- `api/rh_api/routers/processes.py`
- `api/rh_api/routers/public_candidacy.py`
- `api/rh_api/routers/system.py`
- `api/rh_api/schemas/auth.py`
- `api/rh_api/schemas/common.py`
- `api/rh_api/schemas/history.py`
- `api/rh_api/schemas/interviews.py`
- `api/rh_api/schemas/pipeline.py`
- `api/rh_api/schemas/processes.py`
- `api/rh_api/services/analytics.py`
- `api/rh_api/services/cv.py`
- `api/rh_api/services/email_inbox_service.py`
- `api/rh_api/services/helpers.py`
- `api/rh_api/services/interviews.py`
- `api/rh_api/services/pipeline.py`
- `api/rh_api/services/process_flow.py`
- `api/rh_api/services/public_candidacy.py`
- `api/rh_api/services/public_job_texts.py`
- `api/tests/__init__.py`
- `api/tests/conftest.py`
- `api/tests/test_auth_and_pipeline.py`
- `api/tests/test_cv_extraction.py`
- `api/tests/test_history_and_process_rules.py`
- `api/tests/test_interview_schema.py`
- `api/tests/test_public_candidacy.py`
- `data/README.md`
- `data/legacy/access/rh_provas.accdb`
- `docs/README.md`
- `docs/arquitetura.md`
- `docs/entrega-pagina-publica-cv.md`
- `docs/estrutura-do-projeto.md`
- `docs/guia-de-manutencao.md`
- `docs/guia-para-novo-mantenedor.md`
- `docs/legacy/01-visao-geral.md`
- `docs/legacy/02-requisitos.md`
- `docs/legacy/03-regras-de-negocio.md`
- `docs/legacy/04-fluxos-do-sistema.md`
- `docs/legacy/05-arquitetura.md`
- `docs/legacy/06-banco-de-dados.md`
- `docs/legacy/07-api.md`
- `docs/legacy/08-manual-usuario-rh.md`
- `docs/legacy/09-manual-administrador-suporte.md`
- `docs/legacy/10-implantacao.md`
- `docs/legacy/11-manutencao.md`
- `docs/legacy/12-testes.md`
- `docs/legacy/13-changelog.md`
- `docs/legacy/14-seguranca.md`
- `docs/legacy/15-codigo-e-readme-tecnico.md`
- `docs/legacy/README.md`
- `docs/testes.md`
- `pytest.ini`
- `requirements.txt`

## Como alterar com segurança

### Tela
1. Localize a tela em `Front/fonte/features`.
2. Ajuste JS/HTML renderizado.
3. Ajuste CSS em `Front/estilos`.
4. Teste rota por hash.

### Endpoint
1. Criar/alterar schema.
2. Criar/alterar router.
3. Aplicar regra em service quando necessário.
4. Persistir via repository.
5. Expor chamada no frontend.
6. Criar teste.

### Banco
1. Verificar tabela atual.
2. Atualizar bootstrap com alteração incremental.
3. Atualizar repository.
4. Testar em homologação.

## Pontos críticos

- `Front/fonte/app/controlador-aplicacao.js`: estado e orquestração do frontend.
- `Front/fonte/servico-api.js`: fachada de compatibilidade da API no frontend.
- `api/rh_api/main.py`: configuração da FastAPI, CORS, handlers e routers.
- `api/rh_api/config.py`: leitura de `.env`, `config.ini` e variáveis.
- `api/rh_api/repositories/bootstrap.py`: evolução de schema.
- `api/rh_api/repositories/db_repository.py`: fachada legada; evitar colocar regra nova nela quando existir repository específico.
