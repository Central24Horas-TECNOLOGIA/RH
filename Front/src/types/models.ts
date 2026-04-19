export type ScreenId =
  | 'screen-login'
  | 'screen-menu'
  | 'screen-history'
  | 'screen-processes'
  | 'screen-candidate-pipeline'
  | 'screen-process-create'
  | 'screen-process-details'
  | 'screen-talent-bank'
  | 'screen-config'
  | 'screen-candidate'
  | 'screen-exam'
  | 'screen-thanks'
  | 'screen-result'
  | 'screen-analysis-candidates';

export type RouteId =
  | 'login'
  | 'inicio'
  | 'historico'
  | 'processos'
  | 'pipeline-candidatos'
  | 'novo-processo'
  | 'detalhes-processo'
  | 'banco-talentos'
  | 'configuracao'
  | 'candidato'
  | 'prova'
  | 'conclusao'
  | 'resultado'
  | 'analise-candidatos';

export type CandidateTrack =
  | ''
  | 'automatico'
  | 'Automatico'
  | 'operacao'
  | 'ti'
  | 'rh'
  | 'adm'
  | 'TI'
  | 'RH';

export interface Candidate {
  id_processo: string;
  role: string;
  level: string;
  track: CandidateTrack | string;
  time: number;
  name: string;
}

export interface Process {
  id_processo: string;
  nome_processo?: string;
  vaga: string;
  quantidade_vagas: number;
  vagas_preenchidas?: number;
  data_encerramento: string;
  operacao?: string;
  trilha?: string;
  usa_nota_corte?: number | boolean;
  nota_corte?: number | null;
  status?: string;
  data_criacao?: string;
}

export interface ProcessCandidate {
  id_registro: number;
  id_processo: string;
  id_teste: string;
  nome_candidato: string;
  vaga: string;
  pontuacao_final?: string | number;
  status_candidato: string;
  data_prova?: string;
  data_movimentacao?: string;
  origem?: string;
}

export interface TalentBankCandidate {
  id_banco: number;
  id_processo: string;
  id_teste: string;
  nome_candidato: string;
  vaga: string;
  pontuacao_final?: string | number;
  data_movimentacao?: string;
  origem?: string;
}

export interface HistoryRecord {
  id_teste: string;
  nome_candidato: string;
  id_processo: string;
  vaga: string;
  nivel: string;
  trilha: string;
  pontuacao_final: string;
  pontuacao_bruta: string;
  tempo_minutos: number;
  data_iso: string;
  data_exibicao: string;
  status: string;
  etapas_json?: string;
}

export interface StageSummary {
  key: string;
  label: string;
  weight: number;
  rawScore: number;
  rawMax: number;
  questionCount: number;
  pendings: number;
  percent: number;
  weightedScore: number;
}

export interface ResultItem {
  score: number;
  max: number;
  notes: string[];
  pendingManual: boolean;
  completedTasks: string[];
}

export interface ManualPendingItem {
  q?: Question;
  idx?: number;
  result?: ResultItem;
  answer?: CandidateAnswer | null;
  title?: string;
  notes?: string[];
  completedTasks?: string[];
  answerKey?: string[];
}

export interface WordQuestionExpected {
  titleText?: string;
  titleBold?: boolean;
  titleCenter?: boolean;
  minTextLength?: number;
  minSentences?: number;
  requiresList?: boolean;
  minListItems?: number;
  anyBold?: boolean;
}

export interface BaseQuestion {
  stageKey: string;
  stage: string;
  title: string;
  description: string;
  points: number;
  stageWeight?: number;
}

export interface WordQuestion extends BaseQuestion {
  type: 'word';
  expected: WordQuestionExpected;
}

export interface MultipleChoiceQuestion extends BaseQuestion {
  type: 'multiple';
  options: string[];
  answer?: number;
  correctIndex?: number;
}

export interface ExcelQuestion extends BaseQuestion {
  type: 'excel_external';
  taskId: string;
}

export type Question = WordQuestion | MultipleChoiceQuestion | ExcelQuestion;

export interface WordAnswer {
  type: 'word';
  content: string;
}

export interface MultipleChoiceAnswer {
  type: 'multiple';
  selected: number | null;
}

export interface ExcelValidation {
  score: number;
  max: number;
  notes?: string[];
  pendingManual?: boolean;
  completedTasks?: string[];
}

export interface ExcelAnswer {
  type: 'excel_external';
  uploaded: boolean;
  uploadedArrayBuffer?: ArrayBuffer;
  filename?: string;
  statusText?: string;
  statusClass?: string;
  validation: ExcelValidation | null;
}

export type CandidateAnswer =
  | WordAnswer
  | MultipleChoiceAnswer
  | ExcelAnswer
  | null;

export interface UploadedFilePayload {
  questionIndex: number;
  taskId: string;
  filename: string;
  contentBase64: string;
}

export interface SavedAnswerPayload {
  id_teste: string;
  candidate: Candidate;
  blueprint?: ExamBlueprint | null;
  stageSummary: StageSummary[];
  totalScore: number;
  totalMax: number;
  weightedFinalScore: number;
  rhObservation: string;
  generatedAt: string;
  textContent: string;
  uploadedFiles: UploadedFilePayload[];
}

export interface ExamStageBlueprint {
  key: string;
  weight: number;
  questions: Question[] | (() => Question[]);
}

export interface ExamBlueprint {
  level: string;
  label: string;
  stages: ExamStageBlueprint[];
}

export interface RouteStatusMapItem {
  status: string;
  processId: string;
  label: string;
}

export interface ApplicationState {
  autenticado: boolean;
  validandoSessao: boolean;
  usuarioAutenticado: string;
  candidato: Candidate;
  processoSelecionado: string;
  questoes: Question[];
  indiceAtual: number;
  respostas: CandidateAnswer[];
  timestampTermino: number | null;
  segundosRestantes: number;
  provaFinalizada: boolean;
  resultados: ResultItem[];
  totalScore: number;
  totalMax: number;
  notaFinalPonderada: number;
  resumoEtapas: StageSummary[];
  pendenciasManuais: ManualPendingItem[];
  idResultadoAtual: string | null;
  observacaoRh: string;
  statusFinalizacao: string;
  salvandoResultado: boolean;
  resultadoSalvo: boolean;
}

