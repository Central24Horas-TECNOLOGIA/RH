/**
 * @typedef {import('./types/api').SaveAnswerFileRequest} SaveAnswerFileRequest
 * @typedef {import('./types/api').UpdateCandidateStatusRequest} UpdateCandidateStatusRequest
 * @typedef {import('./types/models').HistoryRecord} HistoryRecord
 * @typedef {import('./types/models').Process} Process
 */


import { requisitar, invalidarCacheApi } from './services/api/core.js';

export async function criarBancoTalentos(dadosCandidato) {
  const { id_banco, ...payload } = dadosCandidato || {};
  const resultado = await requisitar('/talent-bank', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
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
  acessarProvaPorCodigo,
  acessarProvaPorEmail,
  acessarProvaPorTelefone,
  cancelarProvaGerada,
  confirmarDadosConectaProvas,
  criarProvaGerada,
  finalizarConectaProvas,
  iniciarConectaProvas,
  lerProvaGerada,
  lerSessaoConectaProvas,
  listarProvasGeradas,
  marcarRevisaoConectaProvas,
  reabrirProvaGerada,
  recalcularScoreProva,
  registrarDecisaoRhProva,
  salvarAvaliacaoManualProva,
  salvarRespostasConectaProvas,
} from './services/api/generated-exams.js';
export {
  adicionarPreAnaliseAoProcesso,
  analisarCvCandidatoInscrito,
  analisarCvEmailRecebido,
  analisarCvEmailRecebidoGeral,
  analisarCvProcesso,
  atualizarAnotacaoDossieProcesso,
  atualizarFichaCandidato,
  atualizarPerfilCandidato,
  atualizarPreAnaliseCv,
  atualizarProcesso,
  atualizarStatusCandidato,
  atualizarStatusCandidatoAvulso,
  baixarCvCandidato,
  baixarAnexoEmailRecebido,
  criarCandidatoNoProcesso,
  criarAnotacaoDossieProcesso,
  criarProcesso,
  desativarLinkPublicoCandidatura,
  dispensarPreAnaliseCv,
  encerrarProcesso,
  excluirPreAnaliseCv,
  enviarEmailRecebidoBancoTalentos,
  gerarLinkPublicoCandidatura,
  enviarPreAnaliseParaBancoTalentos,
  enviarEmailAprovacao,
  ignorarEmailRecebido,
  lerBancoTalentos,
  lerAnotacoesDossieProcesso,
  lerCandidatosProcessos,
  lerDetalheProcesso,
  lerDetalheEmailRecebido,
  lerEmailsRecebidos,
  lerEmailsRecebidosProcesso,
  lerFichaCandidato,
  lerPreAnalisesCv,
  lerProcessos,
  limparListaPreAnalisesCv,
  registrarWhatsappAprovacao,
  registrarWhatsappContatoManual,
  removerBancoTalentos,
  uploadCvCandidato,
  usarCandidatoDoBancoTalentos,
  excluirEmailRecebido,
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
export {
  alterarStatusUsuario,
  atualizarItemConfiguracao,
  atualizarPermissoesPerfil,
  atualizarUsuario,
  baixarLogsAuditoria,
  criarItemConfiguracao,
  criarUsuario,
  desativarItemConfiguracao,
  excluirUsuario,
  listarCatalogoConfiguracoes,
  listarLogsAuditoria,
  listarPerfis,
  listarPermissoes,
  listarUsuarios,
  redefinirSenhaUsuario,
  registrarSolicitacaoLgpd,
} from './services/api/settings.js';
