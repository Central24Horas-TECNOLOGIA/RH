/**
 * @typedef {import('./types/api').SaveAnswerFileRequest} SaveAnswerFileRequest
 * @typedef {import('./types/api').UpdateCandidateStatusRequest} UpdateCandidateStatusRequest
 * @typedef {import('./types/models').HistoryRecord} HistoryRecord
 * @typedef {import('./types/models').Process} Process
 */

export {
  EVENTO_AUTENTICACAO_EXPIRADA,
  invalidarCacheApi,
  limparSessaoAutenticacao,
  lerSessaoAutenticacao,
  possuiSessaoAutenticada,
  salvarSessaoAutenticacao,
} from './services/api/core.js';
export {
  encerrarSessaoApi,
  fazerLoginApi,
  verificarSessaoApi,
} from './services/api/auth.js';
export {
  lerArquivosResposta,
  lerHistorico,
  lerHistoricoPaginado,
  salvarArquivoResposta,
  salvarHistorico,
} from './services/api/history.js';
export {
  adicionarPreAnaliseAoProcesso,
  analisarCvProcesso,
  atualizarPerfilCandidato,
  atualizarPreAnaliseCv,
  atualizarProcesso,
  atualizarStatusCandidato,
  baixarCvCandidato,
  criarCandidatoNoProcesso,
  criarProcesso,
  desativarLinkPublicoCandidatura,
  encerrarProcesso,
  excluirPreAnaliseCv,
  gerarLinkPublicoCandidatura,
  lerBancoTalentos,
  lerCandidatosProcessos,
  lerDetalheProcesso,
  lerPreAnalisesCv,
  lerProcessos,
  removerBancoTalentos,
  usarCandidatoDoBancoTalentos,
} from './services/api/processes.js';
export {
  enviarCandidaturaPublica,
  lerPaginaPublicaCandidatura,
} from './services/api/public-candidacy.js';
export {
  lerAnalisesCandidatos,
  lerDetalheAnaliseCandidato,
} from './services/api/analytics.js';
export {
  criarCardPipeline,
  excluirCardPipeline,
  lerPipelineCandidatos,
  moverCardPipeline,
} from './services/api/pipeline.js';
export {
  agendarEntrevista,
  atualizarEntrevista,
  lerEntrevistas,
} from './services/api/interviews.js';
