import { useEffect, useMemo, useState } from '../infraestrutura-react.js';
import { montarHashDaTela, obterTelaPorHash } from '../rotas.js';
import {
  baixarBlob,
  gerarIdResultado,
  sanitizarNomeArquivo,
} from '../utilitarios.js';
import {
  EVENTO_AUTENTICACAO_EXPIRADA,
  agendarEntrevista,
  adicionarPreAnaliseAoProcesso,
  analisarCvCandidatoInscrito,
  analisarCvEmailRecebido,
  analisarCvEmailRecebidoGeral,
  atualizarEntrevista,
  atualizarAnotacaoDossieProcesso,
  atualizarFichaCandidato,
  atualizarSlotEntrevista,
  atualizarPerfilCandidato,
  atualizarPreAnaliseCv,
  atualizarProcesso,
  atualizarStatusCandidato,
  atualizarStatusCandidatoAvulso,
  analisarCvProcesso,
  baixarAnexoEmailRecebido,
  baixarCvCandidato,
  criarCandidatoNoProcesso,
  criarAnotacaoDossieProcesso,
  criarCardPipeline,
  criarSlotsEntrevista,
  criarProcesso,
  desativarLinkPublicoCandidatura,
  encerrarSessaoApi,
  encerrarProcesso,
  excluirCardPipeline,
  excluirPreAnaliseCv,
  excluirSlotEntrevista,
  enviarEmailRecebidoBancoTalentos,
  enviarPreAnaliseParaBancoTalentos,
  enviarEmailAprovacao,
  fazerLoginApi,
  gerarLinkPublicoCandidatura,
  invalidarCacheApi,
  baixarRelatorioCandidatos,
  baixarRelatorioProcessos,
  ignorarEmailRecebido,
  lerAnalisesCandidatos,
  lerAnotacoesDossieProcesso,
  lerArquivosResposta,
  lerBancoTalentos,
  lerCandidatosProcessos,
  lerDetalheAnaliseCandidato,
  lerDetalheEmailRecebido,
  lerDetalheProcesso,
  lerEmailsRecebidos,
  lerEmailsRecebidosProcesso,
  lerEntrevistas,
  lerFichaCandidato,
  lerHistorico,
  lerHistoricoPaginado,
  lerPipelineCandidatos,
  lerSessaoAutenticacao,
  limparSessaoAutenticacao,
  lerPreAnalisesCv,
  lerRelatorioCandidatos,
  lerRelatorioProcessos,
  lerProcessos,
  lerSlotsEntrevista,
  limparListaPreAnalisesCv,
  moverCardPipeline,
  registrarWhatsappAprovacao,
  registrarWhatsappContatoManual,
  vincularEmailRecebidoProcesso,
  possuiSessaoAutenticada,
  removerBancoTalentos,
  salvarArquivoResposta,
  salvarHistorico,
  usarCandidatoDoBancoTalentos,
  excluirEmailRecebido,
  verificarSessaoApi,
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
} from '../servico-api.js';
import { criarLogger } from '../logger.js';
import {
  montarProvaPorBlueprint,
  resolverBlueprintProva,
} from '../perguntas.js';
import {
  baixarPacoteDaProva,
  converterBase64ParaUint8Array,
  finalizarProva,
  montarResumoHistoricoDaProva,
  montarPayloadGabarito,
  montarResumoRegrasDoCandidato,
  validarEntregaObrigatoriaDaProva,
} from '../regras-prova.js';
import {
  CANDIDATE_STATUS_ANALYSIS,
  CANDIDATE_STATUS_ELIMINATED,
  CANDIDATE_STATUS_TALENT_BANK,
  CANDIDATE_STATUS_WITHDREW,
  canonicalizeCandidateStatus,
  getCandidateVisibleStatus,
} from '../shared/process-flow.js';
import { encontrarProcessoPorReferencia } from '../shared/process-reference.js';

const CHAVE_ESTADO = 'rh_react_state_v1';
export const TAMANHO_RECENTES = 6;
export const TAMANHO_HISTORICO = 10;
export const TAMANHO_ANALISE = 5;
export const TAMANHO_DETALHE_PROCESSO = 5;
export const MENSAGEM_ACESSO_NEGADO =
  'Você não possui permissão para acessar esta área ou executar esta ação.';
export const PERMISSOES_TELAS = {
  'screen-menu': 'inicio.visualizar',
  'screen-email-inbox': 'candidatos.criar',
  'screen-history': 'candidatos.consultar_historico',
  'screen-process-create': 'vagas.criar',
  'screen-processes': 'vagas.visualizar',
  'screen-processes-open': 'vagas.visualizar',
  'screen-processes-closed': 'vagas.visualizar',
  'screen-process-decisions': 'vagas.visualizar',
  'screen-candidates': 'candidatos.visualizar',
  'screen-candidate-pipeline': 'candidatos.mover_etapa',
  'screen-process-details': 'processos.visualizar',
  'screen-interviews': 'entrevistas.visualizar',
  'screen-analysis-candidates': 'relatorios.visualizar',
  'screen-talent-bank': 'candidatos.visualizar',
  'screen-settings': 'configuracoes.visualizar',
  'screen-config': 'provas.enviar',
  'screen-candidate': 'provas.enviar',
  'screen-exam': 'provas.enviar',
  'screen-result': 'provas.visualizar',
  'screen-thanks': 'provas.enviar',
};
const logger = criarLogger('controlador-aplicacao');

function validarEmailContatoCandidato(email) {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(email || '').trim());
}

function validarWhatsappContatoCandidato(valor) {
  const digitos = String(valor || '').replace(/\D/g, '');
  return digitos.length >= 10 && digitos.length <= 13;
}

/**
 * @typedef {import('../types/models').ApplicationState} ApplicationState
 */

export function criarEstadoInicial() {
  const sessao = lerSessaoAutenticacao();
  const autenticado = Boolean(sessao.token);

  return {
    autenticado,
    validandoSessao: autenticado,
    usuarioAutenticado: sessao.usuario || '',
    nomeUsuarioAutenticado: sessao.nome || sessao.usuario || '',
    emailUsuarioAutenticado: sessao.email || '',
    perfilUsuario: sessao.perfil || '',
    perfilUsuarioNome: sessao.perfil_nome || '',
    nivelPerfilUsuario: sessao.nivel || '',
    permissoesUsuario: Array.isArray(sessao.permissoes) ? sessao.permissoes : [],
    avisoAcessoNegado: '',
    barraLateralRecolhida: false,
    candidato: {
      id_processo: '',
      id_processo_ref: '',
      id_registro: '',
      id_entrevista: '',
      id_teste: '',
      role: '',
      level: '',
      track: '',
      time: 40,
      name: '',
      email: '',
      whatsapp: '',
      contatoConfirmado: false,
    },
    processoSelecionado: '',
    personalizacaoProva: {
      enabled: false,
      status: 'Não personalizada',
      questoes: [],
      historico: null,
    },
    questoes: [],
    indiceAtual: 0,
    respostas: [],
    timestampTermino: null,
    segundosRestantes: 0,
    provaFinalizada: false,
    resultados: [],
    totalScore: 0,
    totalMax: 0,
    notaFinalPonderada: 0,
    resumoEtapas: [],
    pendenciasManuais: [],
    idResultadoAtual: null,
    observacaoRh: '',
    statusFinalizacao: 'Finalizado',
    modoFinalizacao: 'normal',
    excelNaoEnviadoConfirmado: false,
    salvandoResultado: false,
    resultadoSalvo: false,
    acessoRhLiberadoAposProva: false,
  };
}

export function hidratarEstado() {
  try {
    const bruto = sessionStorage.getItem(CHAVE_ESTADO);
    if (!bruto) {
      return criarEstadoInicial();
    }

    const salvo = JSON.parse(bruto);
    const estado = {
      ...criarEstadoInicial(),
      ...salvo,
      candidato: {
        ...criarEstadoInicial().candidato,
        ...(salvo?.candidato || {}),
      },
      personalizacaoProva: {
        ...criarEstadoInicial().personalizacaoProva,
        ...(salvo?.personalizacaoProva || {}),
      },
      autenticado: criarEstadoInicial().autenticado,
      validandoSessao: criarEstadoInicial().validandoSessao,
      usuarioAutenticado: criarEstadoInicial().usuarioAutenticado,
      salvandoResultado: false,
    };

    if (estado.timestampTermino) {
      estado.segundosRestantes = Math.max(
        0,
        Math.floor((Number(estado.timestampTermino) - Date.now()) / 1000),
      );
    }

    return estado;
  } catch (error) {
    logger.warn('Não foi possível restaurar o estado salvo.', error);
    return criarEstadoInicial();
  }
}

export function persistirEstado(estado) {
  try {
    const {
      autenticado: _autenticado,
      validandoSessao: _validandoSessao,
      usuarioAutenticado: _usuarioAutenticado,
      nomeUsuarioAutenticado: _nomeUsuarioAutenticado,
      emailUsuarioAutenticado: _emailUsuarioAutenticado,
      perfilUsuario: _perfilUsuario,
      perfilUsuarioNome: _perfilUsuarioNome,
      nivelPerfilUsuario: _nivelPerfilUsuario,
      permissoesUsuario: _permissoesUsuario,
      avisoAcessoNegado: _avisoAcessoNegado,
      ...estadoPersistivel
    } = estado;

    sessionStorage.setItem(
      CHAVE_ESTADO,
      JSON.stringify({
        ...estadoPersistivel,
        salvandoResultado: false,
      }),
    );
  } catch (error) {
    logger.warn('Não foi possível persistir o estado da aplicação.', error);
  }
}

export function limparEstadoPersistido() {
  try {
    sessionStorage.removeItem(CHAVE_ESTADO);
  } catch (error) {
    logger.warn('Não foi possível limpar o estado persistido.', error);
  }
}

export function navegarParaTela(tela, opcoes = {}) {
  const hash = montarHashDaTela(tela);
  if (opcoes?.replace) {
    const url = `${window.location.pathname}${window.location.search}${hash}`;
    window.history.replaceState(null, '', url);
    const evento =
      typeof HashChangeEvent === 'function'
        ? new HashChangeEvent('hashchange')
        : new Event('hashchange');
    window.dispatchEvent(evento);
    return;
  }

  window.location.hash = hash;
}

export function usarTelaAtual(autenticado) {
  const [telaAtual, setTelaAtual] = useState(() =>
    obterTelaPorHash(window.location.hash),
  );

  useEffect(() => {
    if (!window.location.hash) {
      navegarParaTela(autenticado ? 'screen-menu' : 'screen-login');
    }
  }, [autenticado]);

  useEffect(() => {
    const handleHashChange = () =>
      setTelaAtual(obterTelaPorHash(window.location.hash));
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  return telaAtual;
}

export function obterRegrasFormularioProcesso(vaga) {
  const vagaSegura = String(vaga || '').trim();

  if (vagaSegura === 'Operador' || vagaSegura === 'Supervisor') {
    return { exigeOperacao: true, exigeTrilha: false, trilhaFixa: '' };
  }

  if (vagaSegura === 'Control Desk') {
    return { exigeOperacao: false, exigeTrilha: false, trilhaFixa: '' };
  }

  if (vagaSegura === 'Estagiario' || vagaSegura === 'Estagiário') {
    return { exigeOperacao: false, exigeTrilha: true, trilhaFixa: '' };
  }

  if (vagaSegura === 'Analista' || vagaSegura === 'TI') {
    return { exigeOperacao: false, exigeTrilha: false, trilhaFixa: 'TI' };
  }

  if (vagaSegura === 'Jovem Aprendiz') {
    return { exigeOperacao: true, exigeTrilha: false, trilhaFixa: '' };
  }

  return { exigeOperacao: false, exigeTrilha: false, trilhaFixa: '' };
}

function obterAbreviacaoVaga(vaga) {
  const mapa = {
    'Jovem Aprendiz': 'JV.AP',
    Supervisor: 'SUP',
    Operador: 'OPR',
    Analista: 'ANL',
    Estagiario: 'ESTG',
    Estagiário: 'ESTG',
    Outros: 'OUT',
    'Control Desk': 'CTRL',
    Planejamento: 'PLAN',
    TI: 'TI',
  };

  return mapa[String(vaga || '').trim()] || 'OUT';
}

export function montarIdProcesso(vaga) {
  return `PROC.${obterAbreviacaoVaga(vaga)}`;
}

export function obterClasseSituacaoAtual(rotulo) {
  const normalizado = String(rotulo || '')
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  if (normalizado.includes('APROVADO')) return 'is-finished';
  if (normalizado.includes('ELIMINADO')) return 'is-unsaved';
  return 'is-neutral';
}

export async function construirMapaStatusAtual() {
  const [candidatosProcesso, bancoTalentos] = await Promise.all([
    lerCandidatosProcessos().catch(() => []),
    lerBancoTalentos().catch(() => []),
  ]);

  const mapa = {};

  candidatosProcesso.forEach((candidato) => {
    const idTeste = String(candidato.id_teste || '').trim();
    if (!idTeste) return;

    const idProcesso = String(candidato.id_processo || '').trim();
    const idProcessoRef = String(
      candidato.id_processo_ref || candidato.id_processo || '',
    ).trim();
    const status = getCandidateVisibleStatus(candidato);
    mapa[idTeste] = {
      status,
      processId: idProcessoRef,
      label: idProcesso ? `${status} • ${idProcesso}` : status,
    };
  });

  bancoTalentos.forEach((candidato) => {
    const idTeste = String(candidato.id_teste || '').trim();
    if (!idTeste) return;

    const existente = mapa[idTeste];
    const statusExistente = canonicalizeCandidateStatus(existente?.status);

    if (
      !existente ||
      statusExistente === CANDIDATE_STATUS_ANALYSIS ||
      !statusExistente
    ) {
      const idProcesso = String(candidato.id_processo || '').trim();
      const idProcessoRef = String(
        candidato.id_processo_ref || candidato.id_processo || '',
      ).trim();
      mapa[idTeste] = {
        status: CANDIDATE_STATUS_TALENT_BANK,
        processId: idProcessoRef,
        label: idProcesso
          ? `${CANDIDATE_STATUS_TALENT_BANK} • ${idProcesso}`
          : CANDIDATE_STATUS_TALENT_BANK,
      };
    }
  });

  return mapa;
}

export function obterRotuloSituacaoAtual(linha, mapaStatus) {
  const idTeste = String(linha?.id_teste || '').trim();
  const idProcessoHistorico = String(linha?.id_processo || '').trim();
  const mapeado = mapaStatus?.[idTeste];

  if (mapeado?.label) return mapeado.label;
  if (idProcessoHistorico)
    return `${CANDIDATE_STATUS_ANALYSIS} • ${idProcessoHistorico}`;
  return 'Processo individual';
}

export function lerJsonSeguro(texto, fallback = null) {
  try {
    return JSON.parse(texto);
  } catch (error) {
    return fallback;
  }
}

export async function carregarDetalhesProva(idTeste, idProcessoRef = '') {
  const [historico, arquivos, mapaStatus] = await Promise.all([
    lerHistorico(),
    lerArquivosResposta().catch(() => ({})),
    construirMapaStatusAtual(),
  ]);

  const linhasMesmoId = (Array.isArray(historico) ? historico : []).filter(
    (item) =>
      String(item.id_teste || '').trim() === String(idTeste || '').trim(),
  );
  const processoFiltro = String(idProcessoRef || '').trim();
  const linha = processoFiltro
    ? linhasMesmoId.find((item) => {
      const ref = String(item.id_processo_ref || item.id_processo || '').trim();
      return (
        ref === processoFiltro ||
        ref === processoFiltro.split('@@', 1)[0] ||
        ref.split('@@', 1)[0] === processoFiltro.split('@@', 1)[0]
      );
    })
    : linhasMesmoId[0];

  if (!linha) {
    throw new Error('Prova não encontrada.');
  }

  const arquivoSalvo = arquivos[idTeste];
  const payload = arquivoSalvo?.content
    ? lerJsonSeguro(arquivoSalvo.content, null)
    : null;
  const etapasHistorico = linha.etapas_json
    ? lerJsonSeguro(linha.etapas_json, [])
    : [];

  return {
    linha,
    payload,
    resumoEtapas: Array.isArray(payload?.stageSummary)
      ? payload.stageSummary
      : Array.isArray(etapasHistorico)
        ? etapasHistorico
        : [],
    situacaoAtual: obterRotuloSituacaoAtual(linha, mapaStatus),
  };
}

export async function baixarPacoteHistorico(
  idTeste,
  nomeCandidato = 'candidato',
) {
  if (!window.JSZip) {
    throw new Error('A biblioteca JSZip não foi carregada.');
  }

  const arquivos = await lerArquivosResposta();
  const salvo = arquivos[idTeste];

  if (!salvo?.content) {
    throw new Error('Prova não encontrada para este registro.');
  }

  const payload = lerJsonSeguro(salvo.content, null);
  const zip = new window.JSZip();
  const nomeBase = `${sanitizarNomeArquivo(nomeCandidato)}_${sanitizarNomeArquivo(idTeste)}`;
  zip.file(`gabarito_${nomeBase}.txt`, payload?.textContent || salvo.content);

  (payload?.uploadedFiles || []).forEach((arquivo) => {
    const bytes = converterBase64ParaUint8Array(arquivo.contentBase64);
    if (!bytes) return;

    zip.file(
      `excel_respondido_${sanitizarNomeArquivo(arquivo.filename || arquivo.taskId || 'anexo.xlsx')}`,
      bytes,
    );
  });

  const blob = await zip.generateAsync({ type: 'blob' });
  baixarBlob(`prova_${nomeBase}.zip`, blob);
}

export function useControladorAplicacao() {
  const [estado, setEstado] = useState(() => hidratarEstado());
  const blueprint = useMemo(() => {
    if (!estado.candidato?.role || !estado.candidato?.level) {
      return null;
    }

    return resolverBlueprintProva(
      estado.candidato.role,
      estado.candidato.level,
      estado.candidato.track || '',
    );
  }, [estado.candidato]);

  useEffect(() => {
    persistirEstado(estado);
  }, [estado]);

  useEffect(() => {
    let ativo = true;

    const validarSessao = async () => {
      if (!possuiSessaoAutenticada()) {
        if (!ativo) return;

        setEstado((anterior) => ({
          ...anterior,
          autenticado: false,
          validandoSessao: false,
          usuarioAutenticado: '',
          nomeUsuarioAutenticado: '',
          emailUsuarioAutenticado: '',
          perfilUsuario: '',
          perfilUsuarioNome: '',
          nivelPerfilUsuario: '',
          permissoesUsuario: [],
          avisoAcessoNegado: '',
        }));
        return;
      }

      try {
        const sessao = await verificarSessaoApi();
        if (!ativo) return;

        setEstado((anterior) => ({
          ...anterior,
          autenticado: true,
          validandoSessao: false,
          usuarioAutenticado:
            sessao?.usuario || lerSessaoAutenticacao().usuario,
          nomeUsuarioAutenticado:
            sessao?.nome || lerSessaoAutenticacao().nome || sessao?.usuario || '',
          emailUsuarioAutenticado:
            sessao?.email || lerSessaoAutenticacao().email || '',
          perfilUsuario: sessao?.perfil || lerSessaoAutenticacao().perfil || '',
          perfilUsuarioNome:
            sessao?.perfil_nome || lerSessaoAutenticacao().perfil_nome || '',
          nivelPerfilUsuario: sessao?.nivel || lerSessaoAutenticacao().nivel || '',
          permissoesUsuario: Array.isArray(sessao?.permissoes)
            ? sessao.permissoes
            : lerSessaoAutenticacao().permissoes || [],
          avisoAcessoNegado: '',
        }));
      } catch (error) {
        if (!ativo) return;

        limparEstadoPersistido();
        setEstado(criarEstadoInicial());
        navegarParaTela('screen-login', { replace: true });
      }
    };

    validarSessao();

    const aoExpirarSessao = () => {
      limparEstadoPersistido();
      setEstado(criarEstadoInicial());
      navegarParaTela('screen-login', { replace: true });
    };

    window.addEventListener(EVENTO_AUTENTICACAO_EXPIRADA, aoExpirarSessao);

    return () => {
      ativo = false;
      window.removeEventListener(EVENTO_AUTENTICACAO_EXPIRADA, aoExpirarSessao);
    };
  }, []);

  const telaAtual = usarTelaAtual(estado.autenticado);

  useEffect(() => {
    document.body.dataset.screen = telaAtual;
  }, [telaAtual]);

  useEffect(() => {
    if (
      !estado.timestampTermino ||
      estado.provaFinalizada ||
      !estado.questoes.length
    ) {
      return undefined;
    }

    const intervalo = window.setInterval(() => {
      setEstado((anterior) => {
        if (
          !anterior.timestampTermino ||
          anterior.provaFinalizada ||
          !anterior.questoes.length
        ) {
          return anterior;
        }

        const segundosRestantes = Math.max(
          0,
          Math.floor((Number(anterior.timestampTermino) - Date.now()) / 1000),
        );

        if (segundosRestantes <= 0) {
          const blueprintAtual = resolverBlueprintProva(
            anterior.candidato.role,
            anterior.candidato.level,
            anterior.candidato.track || '',
          );
          const resultadoFinal = finalizarProva({
            questoes: anterior.questoes,
            respostas: anterior.respostas,
            blueprint: blueprintAtual,
          });

          navegarParaTela('screen-thanks');

          return {
            ...anterior,
            segundosRestantes: 0,
            provaFinalizada: true,
            timestampTermino: null,
            statusFinalizacao: 'Encerrado automaticamente',
            modoFinalizacao: 'normal',
            excelNaoEnviadoConfirmado: true,
            resultados: resultadoFinal.resultados,
            totalScore: resultadoFinal.totalScore,
            totalMax: resultadoFinal.totalMax,
            notaFinalPonderada: resultadoFinal.notaFinalPonderada,
            resumoEtapas: resultadoFinal.resumoEtapas,
            pendenciasManuais: resultadoFinal.pendenciasManuais,
          };
        }

        return {
          ...anterior,
          segundosRestantes,
        };
      });
    }, 1000);

    return () => window.clearInterval(intervalo);
  }, [estado.timestampTermino, estado.provaFinalizada, estado.questoes.length]);

  const atualizarEstado = (atualizador) => {
    setEstado((anterior) =>
      typeof atualizador === 'function' ? atualizador(anterior) : atualizador,
    );
  };

  const possuiPermissao = (permissao) => {
    if (!permissao) return true;
    return (estado.permissoesUsuario || []).includes(permissao);
  };

  const possuiAlgumaPermissao = (...permissoes) =>
    permissoes.some((permissao) => possuiPermissao(permissao));

  const podeAcessarTela = (tela) => {
    const permissao = PERMISSOES_TELAS[tela];
    return !permissao || possuiPermissao(permissao);
  };

  const registrarAcessoNegado = (mensagem = MENSAGEM_ACESSO_NEGADO) => {
    atualizarEstado((anterior) => ({
      ...anterior,
      avisoAcessoNegado: mensagem,
    }));
  };

  const limparAcessoNegado = () => {
    if (!estado.avisoAcessoNegado) return;
    atualizarEstado((anterior) => ({
      ...anterior,
      avisoAcessoNegado: '',
    }));
  };

  const irParaTelaProtegida = (tela) => {
    if (!estado.autenticado && tela !== 'screen-login') {
      navegarParaTela('screen-login');
      return;
    }

    if (!podeAcessarTela(tela)) {
      registrarAcessoNegado();
      navegarParaTela('screen-forbidden');
      return;
    }

    limparAcessoNegado();
    navegarParaTela(tela);
  };

  const irParaMenu = () => {
    if (!estado.autenticado) {
      navegarParaTela('screen-login');
      return;
    }

    navegarParaTela('screen-menu');
  };

  const alternarBarraLateral = () => {
    atualizarEstado((anterior) => ({
      ...anterior,
      barraLateralRecolhida: !anterior.barraLateralRecolhida,
    }));
  };

  const fazerLogin = async (usuario, senha) => {
    try {
      const sessao = await fazerLoginApi(usuario, senha);
      atualizarEstado((anterior) => ({
        ...anterior,
        autenticado: true,
        validandoSessao: false,
        usuarioAutenticado: sessao?.usuario || usuario,
        nomeUsuarioAutenticado: sessao?.nome || sessao?.usuario || usuario,
        emailUsuarioAutenticado: sessao?.email || '',
        perfilUsuario: sessao?.perfil || '',
        perfilUsuarioNome: sessao?.perfil_nome || '',
        nivelPerfilUsuario: sessao?.nivel || '',
        permissoesUsuario: Array.isArray(sessao?.permissoes)
          ? sessao.permissoes
          : [],
        avisoAcessoNegado: '',
      }));
      navegarParaTela('screen-menu');
      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        mensagem: error?.message || 'Usuário ou senha inválidos.',
      };
    }
  };

  const autenticarAcessoAdministrativo = async (usuario, senha) => {
    try {
      const sessao = await fazerLoginApi(usuario, senha);
      atualizarEstado((anterior) => ({
        ...anterior,
        autenticado: true,
        validandoSessao: false,
        usuarioAutenticado: sessao?.usuario || usuario,
        nomeUsuarioAutenticado: sessao?.nome || sessao?.usuario || usuario,
        emailUsuarioAutenticado: sessao?.email || '',
        perfilUsuario: sessao?.perfil || '',
        perfilUsuarioNome: sessao?.perfil_nome || '',
        nivelPerfilUsuario: sessao?.nivel || '',
        permissoesUsuario: Array.isArray(sessao?.permissoes)
          ? sessao.permissoes
          : [],
        avisoAcessoNegado: '',
        acessoRhLiberadoAposProva: true,
      }));
      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        mensagem: error?.message || 'Usuário ou senha inválidos.',
      };
    }
  };

  const sair = () => {
    encerrarSessaoApi().catch(() => null);
    limparSessaoAutenticacao();
    limparEstadoPersistido();
    setEstado(criarEstadoInicial());
    navegarParaTela('screen-login', { replace: true });
  };

  const exigirNovoLogin = () => {
    sair();
  };

  const iniciarNovoFluxo = () => {
    if (!possuiPermissao('provas.enviar')) {
      registrarAcessoNegado();
      navegarParaTela('screen-forbidden');
      return;
    }

    atualizarEstado((anterior) => ({
      ...anterior,
      candidato: {
        ...anterior.candidato,
        id_processo: '',
        id_processo_ref: '',
        id_registro: '',
        id_entrevista: '',
        id_teste: '',
        role: '',
        level: '',
        track: '',
        time: 40,
        name: '',
        email: '',
        whatsapp: '',
        contatoConfirmado: false,
      },
      processoSelecionado: '',
      personalizacaoProva: {
        enabled: false,
        status: 'Não personalizada',
        questoes: [],
        historico: null,
      },
      questoes: [],
      indiceAtual: 0,
      respostas: [],
      timestampTermino: null,
      segundosRestantes: 0,
      provaFinalizada: false,
      resultados: [],
      totalScore: 0,
      totalMax: 0,
      notaFinalPonderada: 0,
      resumoEtapas: [],
      pendenciasManuais: [],
      idResultadoAtual: null,
      observacaoRh: '',
      statusFinalizacao: 'Finalizado',
      modoFinalizacao: 'normal',
      excelNaoEnviadoConfirmado: false,
      salvandoResultado: false,
      resultadoSalvo: false,
      acessoRhLiberadoAposProva: false,
    }));

    navegarParaTela('screen-config');
  };

  const configurarFluxo = ({
    role,
    level,
    track,
    time,
    processId,
    scheduledCandidate = null,
    personalizacaoProva = null,
  }) => {
    const resolvedProcessRef = processId === 'PROCESSO_UNICO' ? '' : processId;
    const resolvedProcessId = resolvedProcessRef
      ? String(resolvedProcessRef).split('@@', 1)[0]
      : '';

    atualizarEstado((anterior) => ({
      ...anterior,
      candidato: {
        ...anterior.candidato,
        id_processo: resolvedProcessId,
        id_processo_ref: resolvedProcessRef,
        id_registro: scheduledCandidate?.id_registro || '',
        id_entrevista: scheduledCandidate?.id_entrevista || '',
        id_teste: scheduledCandidate?.id_teste || '',
        role,
        level,
        time,
        track: track || 'automatico',
        name:
          scheduledCandidate?.nome_candidato || anterior.candidato.name || '',
        email: scheduledCandidate?.email || anterior.candidato.email || '',
        whatsapp:
          scheduledCandidate?.whatsapp ||
          scheduledCandidate?.telefone ||
          anterior.candidato.whatsapp ||
          '',
        contatoConfirmado: false,
      },
      processoSelecionado: resolvedProcessRef,
      personalizacaoProva: personalizacaoProva || {
        enabled: false,
        status: 'Não personalizada',
        questoes: [],
        historico: null,
      },
    }));

    navegarParaTela('screen-candidate');
  };

  const atualizarNomeCandidato = (name) => {
    atualizarEstado((anterior) => ({
      ...anterior,
      candidato: {
        ...anterior.candidato,
        name,
        contatoConfirmado: false,
      },
    }));
  };

  const atualizarDadosContatoCandidato = (dadosContato = {}) => {
    atualizarEstado((anterior) => ({
      ...anterior,
      candidato: {
        ...anterior.candidato,
        name:
          dadosContato.name !== undefined
            ? dadosContato.name
            : anterior.candidato.name,
        email:
          dadosContato.email !== undefined
            ? dadosContato.email
            : anterior.candidato.email,
        whatsapp:
          dadosContato.whatsapp !== undefined
            ? dadosContato.whatsapp
            : anterior.candidato.whatsapp,
        contatoConfirmado: false,
      },
    }));
  };

  const confirmarDadosContatoCandidato = async (dadosContato = {}) => {
    const nome = String(
      dadosContato.name !== undefined
        ? dadosContato.name
        : estado.candidato.name || '',
    ).trim();
    const email = String(
      dadosContato.email !== undefined
        ? dadosContato.email
        : estado.candidato.email || '',
    ).trim();
    const whatsapp = String(
      dadosContato.whatsapp !== undefined
        ? dadosContato.whatsapp
        : estado.candidato.whatsapp || '',
    ).trim();

    if (!nome) {
      return {
        ok: false,
        mensagem: 'Informe o nome do candidato para iniciar a prova.',
      };
    }
    if (!validarEmailContatoCandidato(email)) {
      return {
        ok: false,
        mensagem: 'Informe um e-mail válido antes de iniciar a prova.',
      };
    }
    if (!validarWhatsappContatoCandidato(whatsapp)) {
      return {
        ok: false,
        mensagem: 'Informe um WhatsApp válido antes de iniciar a prova.',
      };
    }

    atualizarEstado((anterior) => ({
      ...anterior,
      candidato: {
        ...anterior.candidato,
        name: nome,
        email,
        whatsapp,
        contatoConfirmado: true,
      },
    }));

    if (estado.candidato.id_teste) {
      await atualizarFichaCandidato(estado.candidato.id_teste, {
        nome_candidato: nome,
        email,
        whatsapp,
        telefone: whatsapp,
      });
    }

    return { ok: true, dados: { name: nome, email, whatsapp } };
  };

  const iniciarProva = (nomeCandidato, dadosContatoConfirmados = null) => {
    const nome = String(nomeCandidato || '').trim();
    const email = String(
      dadosContatoConfirmados?.email ?? estado.candidato.email ?? '',
    ).trim();
    const whatsapp = String(
      dadosContatoConfirmados?.whatsapp ?? estado.candidato.whatsapp ?? '',
    ).trim();
    const contatoConfirmado =
      Boolean(dadosContatoConfirmados) ||
      Boolean(estado.candidato.contatoConfirmado);

    if (!nome || !blueprint) {
      return {
        ok: false,
        mensagem: 'Informe o nome do candidato para iniciar a prova.',
      };
    }
    if (!contatoConfirmado) {
      return {
        ok: false,
        mensagem: 'Confirme nome, e-mail e WhatsApp antes de iniciar a prova.',
      };
    }
    if (!validarEmailContatoCandidato(email)) {
      return {
        ok: false,
        mensagem: 'Informe um e-mail válido antes de iniciar a prova.',
      };
    }
    if (!validarWhatsappContatoCandidato(whatsapp)) {
      return {
        ok: false,
        mensagem: 'Informe um WhatsApp válido antes de iniciar a prova.',
      };
    }

    const questoesPersonalizadas = estado.personalizacaoProva?.enabled
      ? estado.personalizacaoProva.questoes
      : null;
    const questoes = Array.isArray(questoesPersonalizadas) &&
      questoesPersonalizadas.length
      ? questoesPersonalizadas
      : montarProvaPorBlueprint(blueprint);
    const tempoMinutos = Number(estado.candidato.time || 40);
    const timestampTermino = Date.now() + tempoMinutos * 60 * 1000;

    atualizarEstado((anterior) => ({
      ...anterior,
      candidato: {
        ...anterior.candidato,
        name: nome,
        email,
        whatsapp,
        contatoConfirmado: true,
      },
      questoes,
      respostas: new Array(questoes.length).fill(null),
      indiceAtual: 0,
      timestampTermino,
      segundosRestantes: tempoMinutos * 60,
      provaFinalizada: false,
      resultados: [],
      totalScore: 0,
      totalMax: 0,
      notaFinalPonderada: 0,
      resumoEtapas: [],
      pendenciasManuais: [],
      idResultadoAtual: null,
      observacaoRh: '',
      statusFinalizacao: 'Finalizado',
      modoFinalizacao: 'normal',
      excelNaoEnviadoConfirmado: false,
      resultadoSalvo: false,
      acessoRhLiberadoAposProva: false,
    }));

    navegarParaTela('screen-exam');
    return { ok: true };
  };

  const atualizarResposta = (indice, resposta) => {
    atualizarEstado((anterior) => {
      const respostas = [...anterior.respostas];
      respostas[indice] = resposta;
      return {
        ...anterior,
        respostas,
      };
    });
  };

  const definirIndiceAtual = (indice) => {
    atualizarEstado((anterior) => ({
      ...anterior,
      indiceAtual: indice,
    }));
  };

  const encerrarProva = (statusFinalizacao = 'Finalizado', opcoes = {}) => {
    if (!blueprint) return;

    const modoDesistencia = opcoes?.modo === 'desistencia';
    if (!modoDesistencia) {
      const validacaoFinalizacao = validarEntregaObrigatoriaDaProva({
        questoes: estado.questoes,
        respostas: estado.respostas,
      });
      if (
        !validacaoFinalizacao?.ok &&
        !(
          validacaoFinalizacao?.tipo === 'excel_nao_enviado' &&
          opcoes?.permitirExcelZero
        )
      ) {
        return validacaoFinalizacao;
      }
    }

    const resultadoFinal = finalizarProva({
      questoes: estado.questoes,
      respostas: estado.respostas,
      blueprint,
    });

    atualizarEstado((anterior) => ({
      ...anterior,
      provaFinalizada: true,
      timestampTermino: null,
      segundosRestantes: 0,
      statusFinalizacao,
      modoFinalizacao: modoDesistencia ? 'desistencia' : 'normal',
      excelNaoEnviadoConfirmado:
        Boolean(opcoes?.permitirExcelZero) || anterior.excelNaoEnviadoConfirmado,
      resultados: resultadoFinal.resultados,
      totalScore: resultadoFinal.totalScore,
      totalMax: resultadoFinal.totalMax,
      notaFinalPonderada: resultadoFinal.notaFinalPonderada,
      resumoEtapas: resultadoFinal.resumoEtapas,
      pendenciasManuais: resultadoFinal.pendenciasManuais,
    }));

    navegarParaTela('screen-thanks');
    return { ok: true };
  };

  const atualizarObservacaoRh = (observacaoRh) => {
    atualizarEstado((anterior) => ({
      ...anterior,
      observacaoRh,
    }));
  };

  const salvarResultado = async () => {
    if (estado.salvandoResultado || estado.resultadoSalvo || !blueprint) {
      return null;
    }

    const modoDesistencia = estado.modoFinalizacao === 'desistencia';
    if (!modoDesistencia) {
      const validacaoFinalizacao = validarEntregaObrigatoriaDaProva({
        questoes: estado.questoes,
        respostas: estado.respostas,
      });
      if (
        !validacaoFinalizacao?.ok &&
        !(
          validacaoFinalizacao?.tipo === 'excel_nao_enviado' &&
          estado.excelNaoEnviadoConfirmado
        )
      ) {
        return validacaoFinalizacao;
      }
    }

    atualizarEstado((anterior) => ({
      ...anterior,
      salvandoResultado: true,
    }));

    try {
      const idResultado =
        estado.idResultadoAtual ||
        estado.candidato.id_teste ||
        gerarIdResultado();
      const agora = new Date();
      const processoSelecionadoNormalizado =
        estado.processoSelecionado === 'PROCESSO_UNICO'
          ? ''
          : estado.processoSelecionado || '';

      const processoVinculado =
        estado.candidato.id_processo_ref ||
        processoSelecionadoNormalizado ||
        '';

      const processoVinculadoBaseBruto =
        estado.candidato.id_processo ||
        (processoVinculado ? String(processoVinculado).split('@@', 1)[0] : '');

      const processoVinculadoBase =
        processoVinculadoBaseBruto === 'PROCESSO_UNICO'
          ? ''
          : processoVinculadoBaseBruto;

      let statusInicialCandidato = modoDesistencia
        ? CANDIDATE_STATUS_WITHDREW
        : CANDIDATE_STATUS_ANALYSIS;

      if (processoVinculado && !modoDesistencia) {
        const processos = await lerProcessos();
        const processo =
          encontrarProcessoPorReferencia(processos, processoVinculado) ||
          processos.find(
            (item) =>
              String(item.id_processo || '').trim() ===
              String(processoVinculadoBase).trim(),
          );

        const usaNotaCorte = Number(processo?.usa_nota_corte || 0) === 1;
        const notaCorte = Number(processo?.nota_corte || 0);

        if (
          usaNotaCorte &&
          !Number.isNaN(notaCorte) &&
          Number(estado.notaFinalPonderada || 0) < notaCorte
        ) {
          statusInicialCandidato = CANDIDATE_STATUS_ELIMINATED;
        }
      }

      const payloadGabarito = montarPayloadGabarito({
        idResultado,
        candidato: estado.candidato,
        blueprint,
        resumoEtapas: estado.resumoEtapas,
        totalScore: estado.totalScore,
        totalMax: estado.totalMax,
        notaFinalPonderada: estado.notaFinalPonderada,
        observacaoRh: estado.observacaoRh,
        questoes: estado.questoes,
        respostas: estado.respostas,
        resultados: estado.resultados,
        personalizacaoProva: estado.personalizacaoProva,
      });

      const linhaHistorico = {
        id_teste: idResultado,
        nome_candidato: estado.candidato.name,
        id_processo: processoVinculadoBase,
        id_processo_ref: processoVinculado,
        vaga: estado.candidato.role,
        nivel: estado.candidato.level,
        trilha: blueprint.label,
        pontuacao_final: estado.notaFinalPonderada.toFixed(1).replace('.', ','),
        pontuacao_bruta: `${estado.totalScore}/${estado.totalMax}`,
        arquivo_gabarito: montarResumoHistoricoDaProva({
          questoes: estado.questoes,
          respostas: estado.respostas,
          totalScore: estado.totalScore,
          totalMax: estado.totalMax,
        }),
        tempo_minutos: estado.candidato.time,
        data_iso: agora.toISOString(),
        data_exibicao: agora.toLocaleString('pt-BR'),
        status: estado.statusFinalizacao || 'Finalizado',
        etapas_json: JSON.stringify(estado.resumoEtapas || []),
      };

      await salvarHistorico(linhaHistorico);
      await salvarArquivoResposta({
        recordId: idResultado,
        payload: JSON.stringify(payloadGabarito),
      });
      if (processoVinculadoBase || processoVinculado) {
        await criarCandidatoNoProcesso({
          id_registro: estado.candidato.id_registro || null,
          id_entrevista: estado.candidato.id_entrevista || null,
          id_processo: processoVinculadoBase,
          id_processo_ref: processoVinculado,
          id_teste: idResultado,
          nome_candidato: estado.candidato.name,
          vaga: estado.candidato.role,
          status_candidato: statusInicialCandidato,
          pontuacao_final: estado.notaFinalPonderada
            .toFixed(1)
            .replace('.', ','),
          data_prova: agora.toISOString(),
          origem: 'Prova',
          etapa_pipeline: modoDesistencia ? 'Reprovado' : undefined,
        });
      }

      if (estado.candidato.email || estado.candidato.whatsapp) {
        try {
          await atualizarFichaCandidato(idResultado, {
            nome_candidato: estado.candidato.name,
            email: estado.candidato.email,
            whatsapp: estado.candidato.whatsapp,
            telefone: estado.candidato.whatsapp,
          });
        } catch (contactError) {
          logger.warn(
            'A prova foi salva, mas os dados de contato não foram sincronizados com a ficha.',
            contactError,
          );
        }
      }

      atualizarEstado((anterior) => ({
        ...anterior,
        idResultadoAtual: idResultado,
        salvandoResultado: false,
        resultadoSalvo: true,
        candidato: {
          ...anterior.candidato,
          id_teste: idResultado,
        },
      }));

      invalidarCacheApi(
        'historico',
        'gabaritos',
        'candidatos-processos',
        'pipeline-candidatos',
      );
      return { ok: true };
    } catch (error) {
      atualizarEstado((anterior) => ({
        ...anterior,
        salvandoResultado: false,
      }));
      return {
        ok: false,
        mensagem:
          error?.message ||
          'Não foi possível salvar a prova no servidor. Verifique a API e tente novamente.',
      };
    }
  };

  const baixarPacoteAtual = async () =>
    baixarPacoteDaProva({
      candidato: estado.candidato,
      questoes: estado.questoes,
      respostas: estado.respostas,
      resultados: estado.resultados,
      notaFinalPonderada: estado.notaFinalPonderada,
      observacaoRh: estado.observacaoRh,
    });

  return {
    estado,
    blueprint,
    regrasCandidato: montarResumoRegrasDoCandidato(blueprint, estado.candidato),
    fazerLogin,
    autenticarAcessoAdministrativo,
    sair,
    exigirNovoLogin,
    alternarBarraLateral,
    possuiPermissao,
    possuiAlgumaPermissao,
    podeAcessarTela,
    registrarAcessoNegado,
    irParaMenu,
    irParaTelaProtegida,
    iniciarNovoFluxo,
    configurarFluxo,
    atualizarNomeCandidato,
    atualizarDadosContatoCandidato,
    confirmarDadosContatoCandidato,
    iniciarProva,
    atualizarResposta,
    definirIndiceAtual,
    encerrarProva,
    atualizarObservacaoRh,
    salvarResultado,
    baixarPacoteAtual,
  };
}

export {
  agendarEntrevista,
  adicionarPreAnaliseAoProcesso,
  analisarCvCandidatoInscrito,
  analisarCvEmailRecebido,
  analisarCvEmailRecebidoGeral,
  atualizarEntrevista,
  atualizarAnotacaoDossieProcesso,
  atualizarFichaCandidato,
  atualizarSlotEntrevista,
  atualizarPerfilCandidato,
  atualizarPreAnaliseCv,
  atualizarProcesso,
  atualizarStatusCandidato,
  analisarCvProcesso,
  baixarAnexoEmailRecebido,
  baixarCvCandidato,
  baixarRelatorioCandidatos,
  baixarRelatorioProcessos,
  criarCardPipeline,
  criarAnotacaoDossieProcesso,
  criarSlotsEntrevista,
  criarProcesso,
  desativarLinkPublicoCandidatura,
  encerrarProcesso,
  excluirCardPipeline,
  excluirPreAnaliseCv,
  excluirSlotEntrevista,
  enviarEmailAprovacao,
  enviarEmailRecebidoBancoTalentos,
  enviarPreAnaliseParaBancoTalentos,
  gerarLinkPublicoCandidatura,
  ignorarEmailRecebido,
  lerAnalisesCandidatos,
  lerAnotacoesDossieProcesso,
  lerBancoTalentos,
  lerCandidatosProcessos,
  lerDetalheAnaliseCandidato,
  lerDetalheEmailRecebido,
  lerDetalheProcesso,
  lerEmailsRecebidos,
  lerEmailsRecebidosProcesso,
  lerEntrevistas,
  lerFichaCandidato,
  lerHistorico,
  lerHistoricoPaginado,
  lerPipelineCandidatos,
  lerPreAnalisesCv,
  lerRelatorioCandidatos,
  lerRelatorioProcessos,
  lerProcessos,
  lerSlotsEntrevista,
  limparListaPreAnalisesCv,
  moverCardPipeline,
  registrarWhatsappAprovacao,
  registrarWhatsappContatoManual,
  removerBancoTalentos,
  excluirEmailRecebido,
  usarCandidatoDoBancoTalentos,
  vincularEmailRecebidoProcesso,
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
};
