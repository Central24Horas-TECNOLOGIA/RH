import type {
  HistoryRecord,
  Process,
  ProcessCandidate,
  SavedAnswerPayload,
  StageSummary,
  TalentBankCandidate,
} from './models';

export interface SaveAnswerFileRequest {
  recordId: string;
  payload: string;
}

export interface SaveHistoryRequest extends HistoryRecord {}

export interface CreateProcessRequest extends Process {}

export interface UpdateProcessRequest {
  quantidade_vagas: number;
  data_encerramento: string;
  operacao: string;
  trilha: string;
  usa_nota_corte: number;
  nota_corte: number | null;
  status: string;
  link_agendamento: string;
}

export interface CreateProcessCandidateRequest {
  id_processo: string;
  id_teste: string;
  nome_candidato: string;
  vaga: string;
  status_candidato: string;
  pontuacao_final: string;
  data_prova: string;
  origem: string;
}

export interface UpdateCandidateStatusRequest {
  status_candidato: string;
  data_movimentacao?: string;
}

export interface UseTalentBankCandidateRequest {
  id_processo: string;
}

export interface SavedAnswerFileRecord {
  content: string;
}

export type SavedAnswerFilesResponse = Record<string, SavedAnswerFileRecord>;

export interface PaginatedHistoryResponse {
  items: HistoryRecord[];
  page: number;
  page_size: number;
  total_items: number;
  total_pages: number;
}

export interface ProcessDetailResponse {
  processo: Process | null;
  resumo: {
    total: number;
    aprovados: number;
    eliminados: number;
    banco: number;
    analise: number;
  } | null;
  candidatos: ProcessCandidate[];
}

export interface CvPreAnalysisItem {
  id_pre_analise: number;
  id_processo: string;
  nome_candidato?: string;
  email?: string;
  telefone?: string;
  whatsapp?: string;
  palavras_chave?: string;
  score_final?: number;
  classificacao?: string;
  classificacao_slug?: string;
  problemas?: string;
  texto_extraido?: string;
  nome_arquivo?: string;
  mime_type?: string;
  arquivo_original_base64?: string;
  ja_adicionado_ao_processo?: number;
  criado_em?: string;
}

export interface PaginatedCvPreAnalysisResponse {
  items: CvPreAnalysisItem[];
  page: number;
  total_pages: number;
  total_items: number;
}

export interface UpdateCvPreAnalysisRequest {
  nome_candidato?: string;
  email?: string;
  telefone?: string;
  whatsapp?: string;
}

export interface CandidateAnalyticsListItem {
  id_teste: string;
  id_processo: string;
  nome_candidato: string;
  vaga: string;
  nota_final: string | number;
  afinidade_percentual: string | number;
  recomendacao: string;
  status_candidato: string;
}

export interface CandidateAnalyticsChartItem {
  label: string;
  obtained: number;
  expected: number;
}

export interface CandidateAnalyticsDetail {
  id_teste: string;
  id_processo: string;
  nome_candidato: string;
  vaga: string;
  nota_final: string | number;
  afinidade_percentual: string | number;
  recomendacao: string;
  parecer_final?: string;
  ressalvas?: string[];
  grafico?: CandidateAnalyticsChartItem[];
  analise_texto?: {
    overall?: number;
  };
}

export interface SaveResultCompositePayload {
  historico: HistoryRecord;
  gabarito: SavedAnswerPayload;
  candidatoProcesso: CreateProcessCandidateRequest;
}

export interface PipelineCard {
  id_registro: number;
  id_processo: string;
  id_teste: string;
  nome_candidato: string;
  vaga: string;
  status_candidato: string;
  pontuacao_final?: string | number;
  data_prova?: string;
  origem?: string;
  etapa_pipeline: string;
  status_processo?: string;
  tags?: string[];
  habilidades?: string[];
  observacao_rh?: string;
  status_entrevista?: string;
  data_entrevista?: string;
  link_entrevista?: string;
  id_entrevista?: number;
}

export interface PipelineCardCreateRequest {
  id_processo: string;
  nome_candidato: string;
  vaga?: string;
  etapa_pipeline?: string;
}

export interface PipelineCardMoveRequest {
  etapa_pipeline: string;
  data_movimentacao?: string;
}

export interface DashboardRecentState {
  recentes: HistoryRecord[];
  candidatosAnalise: ProcessCandidate[];
  bancoTalentos: TalentBankCandidate[];
  processos: Process[];
  resumoEtapas: StageSummary[];
}

export interface CandidateProfileUpdateRequest {
  nome_candidato?: string;
  habilidades: string[];
  tags: string[];
  observacao_rh: string;
}

export interface InterviewItem {
  id_entrevista: number;
  id_processo: string;
  id_registro: number;
  id_teste: string;
  nome_candidato: string;
  vaga: string;
  data_entrevista: string;
  status_entrevista: string;
  link_agendamento?: string;
  link_agendamento_processo?: string;
  observacoes_rh?: string;
  mensagem_base?: string;
  tags?: string[];
  habilidades?: string[];
  observacao_candidato_rh?: string;
}

export interface InterviewCreateRequest {
  id_registro: number;
  id_processo?: string;
  data_entrevista: string;
  status_entrevista?: string;
  link_agendamento?: string;
  observacoes_rh?: string;
}

export interface InterviewUpdateRequest {
  data_entrevista?: string;
  status_entrevista?: string;
  link_agendamento?: string;
  observacoes_rh?: string;
}
