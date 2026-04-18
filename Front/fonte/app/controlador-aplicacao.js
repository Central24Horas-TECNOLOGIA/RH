import { useEffect, useMemo, useState } from '../infraestrutura-react.js';
import { montarHashDaTela, obterTelaPorHash } from '../rotas.js';
import {
  baixarBlob,
  gerarIdResultado,
  sanitizarNomeArquivo,
} from '../utilitarios.js';
import {
  adicionarPreAnaliseAoProcesso,
  atualizarPreAnaliseCv,
  atualizarProcesso,
  atualizarStatusCandidato,
  analisarCvProcesso,
  criarCandidatoNoProcesso,
  criarProcesso,
  encerrarProcesso,
  excluirPreAnaliseCv,
  invalidarCacheApi,
  lerAnalisesCandidatos,
  lerArquivosResposta,
  lerBancoTalentos,
  lerCandidatosProcessos,
  lerDetalheAnaliseCandidato,
  lerDetalheProcesso,
  lerHistorico,
  lerPreAnalisesCv,
  lerProcessos,
  removerBancoTalentos,
  salvarArquivoResposta,
  salvarHistorico,
  usarCandidatoDoBancoTalentos,
} from '../servico-api.js';
import { montarProvaPorBlueprint, resolverBlueprintProva } from '../perguntas.js';
import {
  baixarPacoteDaProva,
  converterBase64ParaUint8Array,
  finalizarProva,
  montarPayloadGabarito,
  montarResumoRegrasDoCandidato,
} from '../regras-prova.js';

const CHAVE_ESTADO = 'rh_react_state_v1';
const USUARIO_RH = 'rh';
export const SENHA_RH = '1234';
export const TAMANHO_RECENTES = 6;
export const TAMANHO_HISTORICO = 10;
export const TAMANHO_ANALISE = 5;
export const TAMANHO_DETALHE_PROCESSO = 5;

/**
 * @typedef {import('../../src/types/models').ApplicationState} ApplicationState
 */

export function criarEstadoInicial() {
  return {
    autenticado: false,
    candidato: {
      id_processo: '',
      role: '',
      level: '',
      track: '',
      time: 40,
      name: '',
    },
    processoSelecionado: '',
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
    salvandoResultado: false,
    resultadoSalvo: false,
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
    console.warn('Nao foi possivel restaurar o estado salvo:', error);
    return criarEstadoInicial();
  }
}

export function persistirEstado(estado) {
  try {
    sessionStorage.setItem(
      CHAVE_ESTADO,
      JSON.stringify({
        ...estado,
        salvandoResultado: false,
      }),
    );
  } catch (error) {
    console.warn('Nao foi possivel persistir o estado da aplicacao:', error);
  }
}

export function limparEstadoPersistido() {
  try {
    sessionStorage.removeItem(CHAVE_ESTADO);
  } catch (error) {
    console.warn('Nao foi possivel limpar o estado persistido:', error);
  }
}

export function navegarParaTela(tela) {
  window.location.hash = montarHashDaTela(tela);
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
    'Estagiário': 'ESTG',
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
    const status =
      String(candidato.status_candidato || '').trim() || 'Em analise';
    mapa[idTeste] = {
      status,
      processId: idProcesso,
      label: idProcesso ? `${status} • ${idProcesso}` : status,
    };
  });

  bancoTalentos.forEach((candidato) => {
    const idTeste = String(candidato.id_teste || '').trim();
    if (!idTeste) return;

    const existente = mapa[idTeste];
    const statusExistente = String(existente?.status || '').trim();

    if (!existente || statusExistente === 'Em analise' || !statusExistente) {
      const idProcesso = String(candidato.id_processo || '').trim();
      mapa[idTeste] = {
        status: 'Banco de talentos',
        processId: idProcesso,
        label: idProcesso
          ? `Banco de talentos • ${idProcesso}`
          : 'Banco de talentos',
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
  if (idProcessoHistorico) return `Em analise • ${idProcessoHistorico}`;
  return 'Processo individual';
}

export function lerJsonSeguro(texto, fallback = null) {
  try {
    return JSON.parse(texto);
  } catch (error) {
    return fallback;
  }
}

export async function carregarDetalhesProva(idTeste) {
  const [historico, arquivos, mapaStatus] = await Promise.all([
    lerHistorico(),
    lerArquivosResposta().catch(() => ({})),
    construirMapaStatusAtual(),
  ]);

  const linha = (Array.isArray(historico) ? historico : []).find(
    (item) =>
      String(item.id_teste || '').trim() === String(idTeste || '').trim(),
  );

  if (!linha) {
    throw new Error('Prova nao encontrada.');
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
    throw new Error('A biblioteca JSZip nao foi carregada.');
  }

  const arquivos = await lerArquivosResposta();
  const salvo = arquivos[idTeste];

  if (!salvo?.content) {
    throw new Error('Prova nao encontrada para este registro.');
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

  const irParaTelaProtegida = (tela) => {
    if (!estado.autenticado && tela !== 'screen-login') {
      navegarParaTela('screen-login');
      return;
    }

    navegarParaTela(tela);
  };

  const irParaMenu = () => {
    if (!estado.autenticado) {
      navegarParaTela('screen-login');
      return;
    }

    navegarParaTela('screen-menu');
  };

  const fazerLogin = async (usuario, senha) => {
    if (usuario === USUARIO_RH && senha === SENHA_RH) {
      atualizarEstado((anterior) => ({
        ...anterior,
        autenticado: true,
      }));
      navegarParaTela('screen-menu');
      return { ok: true };
    }

    return { ok: false, mensagem: 'Usuario ou senha invalidos.' };
  };

  const sair = () => {
    limparEstadoPersistido();
    setEstado(criarEstadoInicial());
    navegarParaTela('screen-login');
  };

  const iniciarNovoFluxo = () => {
    atualizarEstado((anterior) => ({
      ...anterior,
      candidato: {
        ...anterior.candidato,
        id_processo: '',
        role: '',
        level: '',
        track: '',
        time: 40,
        name: '',
      },
      processoSelecionado: '',
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
      salvandoResultado: false,
      resultadoSalvo: false,
    }));

    navegarParaTela('screen-config');
  };

  const configurarFluxo = ({ role, level, track, time, processId }) => {
    const resolvedProcessId = processId === 'PROCESSO_UNICO' ? '' : processId;

    atualizarEstado((anterior) => ({
      ...anterior,
      candidato: {
        ...anterior.candidato,
        id_processo: resolvedProcessId,
        role,
        level,
        time,
        track: track || 'automatico',
      },
      processoSelecionado: processId,
    }));

    navegarParaTela('screen-candidate');
  };

  const atualizarNomeCandidato = (name) => {
    atualizarEstado((anterior) => ({
      ...anterior,
      candidato: {
        ...anterior.candidato,
        name,
      },
    }));
  };

  const iniciarProva = (nomeCandidato) => {
    const nome = String(nomeCandidato || '').trim();
    if (!nome || !blueprint) {
      return {
        ok: false,
        mensagem: 'Informe o nome do candidato para iniciar a prova.',
      };
    }

    const questoes = montarProvaPorBlueprint(blueprint);
    const tempoMinutos = Number(estado.candidato.time || 40);
    const timestampTermino = Date.now() + tempoMinutos * 60 * 1000;

    atualizarEstado((anterior) => ({
      ...anterior,
      candidato: {
        ...anterior.candidato,
        name: nome,
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
      resultadoSalvo: false,
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

  const encerrarProva = (statusFinalizacao = 'Finalizado') => {
    if (!blueprint) return;

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
      resultados: resultadoFinal.resultados,
      totalScore: resultadoFinal.totalScore,
      totalMax: resultadoFinal.totalMax,
      notaFinalPonderada: resultadoFinal.notaFinalPonderada,
      resumoEtapas: resultadoFinal.resumoEtapas,
      pendenciasManuais: resultadoFinal.pendenciasManuais,
    }));

    navegarParaTela('screen-thanks');
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

    atualizarEstado((anterior) => ({
      ...anterior,
      salvandoResultado: true,
    }));

    try {
      const idResultado = estado.idResultadoAtual || gerarIdResultado();
      const agora = new Date();
      const processoVinculado =
        estado.candidato.id_processo || estado.processoSelecionado || '';

      let statusInicialCandidato = 'Em analise';

      if (processoVinculado) {
        const processos = await lerProcessos();
        const processo = processos.find(
          (item) =>
            String(item.id_processo || '').trim() ===
            String(processoVinculado).trim(),
        );

        const usaNotaCorte = Number(processo?.usa_nota_corte || 0) === 1;
        const notaCorte = Number(processo?.nota_corte || 0);

        if (
          usaNotaCorte &&
          !Number.isNaN(notaCorte) &&
          Number(estado.notaFinalPonderada || 0) < notaCorte
        ) {
          statusInicialCandidato = 'Eliminado pela nota de corte';
        }
      }

      const linhaHistorico = {
        id_teste: idResultado,
        nome_candidato: estado.candidato.name,
        id_processo: processoVinculado,
        vaga: estado.candidato.role,
        nivel: estado.candidato.level,
        trilha: blueprint.label,
        pontuacao_final: estado.notaFinalPonderada.toFixed(1).replace('.', ','),
        pontuacao_bruta: `${estado.totalScore}/${estado.totalMax}`,
        tempo_minutos: estado.candidato.time,
        data_iso: agora.toISOString(),
        data_exibicao: agora.toLocaleString('pt-BR'),
        status: estado.statusFinalizacao || 'Finalizado',
        etapas_json: JSON.stringify(estado.resumoEtapas || []),
      };

      await salvarHistorico(linhaHistorico);
      await salvarArquivoResposta({
        recordId: idResultado,
        payload: JSON.stringify(
          montarPayloadGabarito({
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
          }),
        ),
      });
      await criarCandidatoNoProcesso({
        id_processo: processoVinculado,
        id_teste: idResultado,
        nome_candidato: estado.candidato.name,
        vaga: estado.candidato.role,
        status_candidato: statusInicialCandidato,
        pontuacao_final: estado.notaFinalPonderada.toFixed(1).replace('.', ','),
        data_prova: agora.toISOString(),
        origem: 'Prova',
      });

      atualizarEstado((anterior) => ({
        ...anterior,
        idResultadoAtual: idResultado,
        salvandoResultado: false,
        resultadoSalvo: true,
      }));

      invalidarCacheApi('historico', 'gabaritos', 'candidatos-processos');
      return { ok: true };
    } catch (error) {
      atualizarEstado((anterior) => ({
        ...anterior,
        salvandoResultado: false,
      }));
      return {
        ok: false,
        mensagem:
          'Nao foi possivel salvar a prova no servidor. Verifique a API e tente novamente.',
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
    sair,
    irParaMenu,
    irParaTelaProtegida,
    iniciarNovoFluxo,
    configurarFluxo,
    atualizarNomeCandidato,
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
  adicionarPreAnaliseAoProcesso,
  atualizarPreAnaliseCv,
  atualizarProcesso,
  atualizarStatusCandidato,
  analisarCvProcesso,
  criarProcesso,
  encerrarProcesso,
  excluirPreAnaliseCv,
  lerAnalisesCandidatos,
  lerBancoTalentos,
  lerCandidatosProcessos,
  lerDetalheAnaliseCandidato,
  lerDetalheProcesso,
  lerHistorico,
  lerPreAnalisesCv,
  lerProcessos,
  removerBancoTalentos,
  usarCandidatoDoBancoTalentos,
};


