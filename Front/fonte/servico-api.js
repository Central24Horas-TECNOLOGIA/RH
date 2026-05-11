/**
 * @typedef {import('./types/api').SaveAnswerFileRequest} SaveAnswerFileRequest
 * @typedef {import('./types/api').UpdateCandidateStatusRequest} UpdateCandidateStatusRequest
 * @typedef {import('./types/models').HistoryRecord} HistoryRecord
 * @typedef {import('./types/models').Process} Process
 */


import { requisitar, invalidarCacheApi } from './services/api/core.js';

export async function criarBancoTalentos(dadosCandidato) {
  const resultado = await requisitar('/talent-bank', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(dadosCandidato || {}),
  });

  invalidarCacheApi(
    'banco-talentos',
    'candidatos-processos',
    'processos',
    'pipeline-candidatos',
  );
  return resultado;
}

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
  analisarCvCandidatoInscrito,
  analisarCvEmailRecebido,
  analisarCvEmailRecebidoGeral,
  analisarCvProcesso,
  atualizarPerfilCandidato,
  atualizarPreAnaliseCv,
  atualizarProcesso,
  atualizarStatusCandidato,
  atualizarStatusCandidatoAvulso,
  baixarCvCandidato,
  baixarAnexoEmailRecebido,
  criarCandidatoNoProcesso,
  criarProcesso,
  desativarLinkPublicoCandidatura,
  encerrarProcesso,
  excluirPreAnaliseCv,
  enviarEmailRecebidoBancoTalentos,
  gerarLinkPublicoCandidatura,
  enviarPreAnaliseParaBancoTalentos,
  enviarEmailAprovacao,
  ignorarEmailRecebido,
  lerBancoTalentos,
  lerCandidatosProcessos,
  lerDetalheProcesso,
  lerDetalheEmailRecebido,
  lerEmailsRecebidos,
  lerEmailsRecebidosProcesso,
  lerPreAnalisesCv,
  lerProcessos,
  limparListaPreAnalisesCv,
  registrarWhatsappAprovacao,
  removerBancoTalentos,
  usarCandidatoDoBancoTalentos,
  vincularEmailRecebidoProcesso,
} from './services/api/processes.js';
export {
  enviarCandidaturaPublica,
  lerPaginaPublicaCandidatura,
} from './services/api/public-candidacy.js';
export {
  baixarRelatorioCandidatos,
  baixarRelatorioProcessos,
  lerAnalisesCandidatos,
  lerDetalheAnaliseCandidato,
  lerRelatorioCandidatos,
  lerRelatorioProcessos,
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
  atualizarSlotEntrevista,
  criarSlotsEntrevista,
  excluirSlotEntrevista,
  lerEntrevistas,
  lerSlotsEntrevista,
} from './services/api/interviews.js';
