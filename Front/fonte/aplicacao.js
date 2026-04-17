import {
  html,
  useEffect,
  useMemo,
  useRef,
  useState,
} from './infraestrutura-react.js';

import { montarHashDaTela, obterTelaPorHash } from './rotas.js';
import {
  baixarBlob,
  construirModeloPaginacao,
  formatarDataParaInput,
  formatarNotaAnalise,
  formatarPercentualAfinidade,
  formatarPontuacaoDetalhada,
  gerarIdResultado,
  obterItensPaginados,
  sanitizarNomeArquivo,
} from './utilitarios.js';
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
} from './servico-api.js';
import {
  SUGESTOES_NIVEL_POR_VAGA,
  ROTULOS_ETAPAS,
  montarProvaPorBlueprint,
  resolverBlueprintProva,
} from './perguntas.js';
import {
  baixarModeloExcel,
  baixarPacoteDaProva,
  converterBase64ParaUint8Array,
  finalizarProva,
  montarPayloadGabarito,
  montarResumoRegrasDoCandidato,
  obterCapacidadesDaTarefa,
  validarArquivoExcel,
} from './regras-prova.js';

const CHAVE_ESTADO = 'rh_react_state_v1';
const USUARIO_RH = 'rh';
const SENHA_RH = '1234';
const TAMANHO_RECENTES = 6;
const TAMANHO_HISTORICO = 10;
const TAMANHO_ANALISE = 5;
const TAMANHO_DETALHE_PROCESSO = 5;

function criarEstadoInicial() {
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

function hidratarEstado() {
  try {
    const bruto = sessionStorage.getItem(CHAVE_ESTADO);
    if (!bruto) return criarEstadoInicial();

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
    console.warn('Não foi possível restaurar o estado salvo:', error);
    return criarEstadoInicial();
  }
}

function persistirEstado(estado) {
  try {
    sessionStorage.setItem(
      CHAVE_ESTADO,
      JSON.stringify({
        ...estado,
        salvandoResultado: false,
      }),
    );
  } catch (error) {
    console.warn('Não foi possível persistir o estado da aplicação:', error);
  }
}

function limparEstadoPersistido() {
  try {
    sessionStorage.removeItem(CHAVE_ESTADO);
  } catch (error) {
    console.warn('Não foi possível limpar o estado persistido:', error);
  }
}

function navegarParaTela(tela) {
  window.location.hash = montarHashDaTela(tela);
}

function usarTelaAtual(autenticado) {
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

function obterRegrasFormularioProcesso(vaga) {
  const vagaSegura = String(vaga || '').trim();

  if (vagaSegura === 'Operador' || vagaSegura === 'Supervisor') {
    return { exigeOperacao: true, exigeTrilha: false, trilhaFixa: '' };
  }
  if (vagaSegura === 'Control Desk') {
    return { exigeOperacao: false, exigeTrilha: false, trilhaFixa: '' };
  }
  if (vagaSegura === 'Estagiário') {
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
    Estagiário: 'ESTG',
    Outros: 'OUT',
    'Control Desk': 'CTRL',
    Planejamento: 'PLAN',
    TI: 'TI',
  };

  return mapa[String(vaga || '').trim()] || 'OUT';
}

function montarIdProcesso(vaga) {
  return `PROC.${obterAbreviacaoVaga(vaga)}`;
}

function obterClasseSituacaoAtual(rotulo) {
  const normalizado = String(rotulo || '')
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  if (normalizado.includes('APROVADO')) return 'is-finished';
  if (normalizado.includes('ELIMINADO')) return 'is-unsaved';
  if (normalizado.includes('BANCO DE TALENTOS')) return 'is-neutral';
  if (normalizado.includes('ANALISE')) return 'is-neutral';
  return 'is-neutral';
}

async function construirMapaStatusAtual() {
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
      String(candidato.status_candidato || '').trim() || 'Em análise';
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

    if (
      !existente ||
      statusExistente === 'Em análise' ||
      statusExistente === ''
    ) {
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

function obterRotuloSituacaoAtual(linha, mapaStatus) {
  const idTeste = String(linha?.id_teste || '').trim();
  const idProcessoHistorico = String(linha?.id_processo || '').trim();
  const mapeado = mapaStatus?.[idTeste];

  if (mapeado?.label) return mapeado.label;
  if (idProcessoHistorico) return `Em análise • ${idProcessoHistorico}`;
  return 'Processo individual';
}

function BotaoPaginacao({ pagina, ativa, onClick }) {
  return html`
    <button
      type="button"
      class=${`btn ${ativa ? 'btn-primary' : 'btn-outline-secondary'} btn-sm`}
      onClick=${onClick}
    >
      ${pagina}
    </button>
  `;
}

function GrupoPaginacao({ paginaAtual, totalPaginas, onChange }) {
  const itens = construirModeloPaginacao(paginaAtual, totalPaginas);
  return html`
    <div class="d-flex justify-content-center gap-2 flex-wrap mt-4">
      ${itens.map(
        (item) => html`
          <${BotaoPaginacao}
            key=${item.pagina}
            pagina=${item.pagina}
            ativa=${item.ativa}
            onClick=${() => onChange(item.pagina)}
          />
        `,
      )}
    </div>
  `;
}

function ModalPadrao({
  aberto,
  titulo,
  subtitulo,
  onClose,
  children,
  className = '',
}) {
  if (!aberto) return null;

  return html`
    <div
      class="rh-details-overlay"
      onClick=${(event) => event.target === event.currentTarget && onClose()}
    >
      <div
        class=${`rh-details-dialog ${className}`.trim()}
        role="dialog"
        aria-modal="true"
      >
        <div class="rh-details-header">
          <div>
            <h3 class="rh-details-title">${titulo}</h3>
            ${subtitulo
              ? html`<p class="rh-details-subtitle mb-0">${subtitulo}</p>`
              : null}
          </div>
          <button
            type="button"
            class="btn rh-details-close-btn"
            aria-label="Fechar"
            onClick=${onClose}
          >
            X
          </button>
        </div>
        ${children}
      </div>
    </div>
  `;
}

function BarraLateral({
  navAtiva,
  subtituloMarca,
  controlador,
  mostrarAtalhos = true,
}) {
  const itens = [
    { tela: 'screen-menu', icone: 'home', label: 'Página Inicial' },
    { tela: 'screen-history', icone: 'history', label: 'Histórico' },
    {
      tela: 'screen-processes',
      icone: 'folder_managed',
      label: 'Gerenciar processos',
    },
    {
      tela: 'screen-analysis-candidates',
      icone: 'analytics',
      label: 'Análise por candidato',
    },
    { tela: 'screen-talent-bank', icone: 'group', label: 'Banco de talentos' },
  ];

  return html`
    <aside class="rh-modern-sidebar">
      <div class="rh-modern-sidebar-brand">
        <button
          type="button"
          class="rh-modern-logo-btn"
          aria-label="Voltar para a página principal"
          onClick=${() => controlador.irParaMenu()}
        >
          <img
            alt="Logo Central 24 Horas"
            class="rh-modern-logo"
            src="estilos/logo-central24.jpg"
          />
        </button>
        <div>
          <div class="rh-modern-brand-title">Conexa</div>
          <div class="rh-modern-brand-subtitle">${subtituloMarca}</div>
        </div>
      </div>
      <nav class="rh-modern-nav">
        ${itens.map(
          (item) => html`
            <button
              key=${item.tela}
              type="button"
              class=${`rh-modern-nav-btn ${navAtiva === item.tela ? 'is-active' : ''}`}
              onClick=${() => controlador.irParaTelaProtegida(item.tela)}
            >
              <span class="material-symbols-outlined">${item.icone}</span>
              <span>${item.label}</span>
            </button>
          `,
        )}
      </nav>
      ${mostrarAtalhos
        ? html`
            <div class="d-flex flex-column gap-2">
              <button
                type="button"
                class="rh-modern-cta-btn"
                onClick=${() =>
                  controlador.irParaTelaProtegida('screen-process-create')}
              >
                <span class="material-symbols-outlined">playlist_add</span>
                <span>Iniciar processo</span>
              </button>
              <button
                type="button"
                class="rh-modern-cta-btn"
                onClick=${() => controlador.iniciarNovoFluxo()}
              >
                <span class="material-symbols-outlined">play_circle</span>
                <span>Iniciar teste</span>
              </button>
            </div>
          `
        : null}
    </aside>
  `;
}

function PainelRh({
  screenId,
  navAtiva,
  subtituloMarca,
  placeholderBusca,
  controlador,
  acaoPrimaria,
  acoesTopo = null,
  mostrarAtalhos = true,
  children,
}) {
  return html`
    <section class="active screen" id=${screenId}>
      <div class="rh-modern-shell rh-modern-shell-history">
        <${BarraLateral}
          navAtiva=${navAtiva}
          subtituloMarca=${subtituloMarca}
          controlador=${controlador}
          mostrarAtalhos=${mostrarAtalhos}
        />
        <div class="rh-modern-main">
          <header class="rh-modern-topbar">
            <div class="rh-modern-topbar-left">
              <div class="rh-modern-search-shell">
                <span class="material-symbols-outlined">search</span>
                <input type="text" readonly value=${placeholderBusca} />
              </div>
            </div>
            <div class="rh-modern-topbar-actions">
              ${acaoPrimaria
                ? html`
                    <button
                      type="button"
                      class="btn btn-primary rh-modern-primary-btn"
                      onClick=${acaoPrimaria.onClick}
                    >
                      ${acaoPrimaria.label}
                    </button>
                  `
                : null}
              ${acoesTopo}
            </div>
          </header>
          <main class="rh-modern-page">${children}</main>
        </div>
      </div>
    </section>
  `;
}

function useControladorAplicacao() {
  const [estado, setEstado] = useState(() => hidratarEstado());
  const blueprint = useMemo(() => {
    if (!estado.candidato?.role || !estado.candidato?.level) return null;
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

    return { ok: false, mensagem: 'Usuário ou senha inválidos.' };
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
        track: track || 'automático',
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
    if (estado.salvandoResultado || estado.resultadoSalvo || !blueprint) return;

    atualizarEstado((anterior) => ({
      ...anterior,
      salvandoResultado: true,
    }));

    try {
      const idResultado = estado.idResultadoAtual || gerarIdResultado();
      const agora = new Date();
      const processoVinculado =
        estado.candidato.id_processo || estado.processoSelecionado || '';

      let statusInicialCandidato = 'Em análise';

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

function lerJsonSeguro(texto, fallback = null) {
  try {
    return JSON.parse(texto);
  } catch (error) {
    return fallback;
  }
}

async function carregarDetalhesProva(idTeste) {
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

async function baixarPacoteHistorico(idTeste, nomeCandidato = 'candidato') {
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

function ModalDetalhesProva({ detalhe, onClose, onDownload }) {
  if (!detalhe) return null;

  const { linha, payload, resumoEtapas, situacaoAtual } = detalhe;

  return html`
    <${ModalPadrao}
      aberto=${true}
      titulo=${`Detalhes da prova • ${linha.nome_candidato || 'Candidato'}`}
      subtitulo="Informações completas registradas até o momento."
      onClose=${onClose}
    >
      <div class="rh-details-body">
        <section class="rh-details-section">
          <h4 class="rh-details-section-title">Resumo geral</h4>
          <div class="rh-details-grid">
            <div class="rh-detail-card">
              <span class="rh-detail-label">Candidato</span>
              <span class="rh-detail-value"
                >${payload?.candidate?.name ||
                linha.nome_candidato ||
                '-'}</span
              >
            </div>
            <div class="rh-detail-card">
              <span class="rh-detail-label">Vaga</span>
              <span class="rh-detail-value"
                >${payload?.candidate?.role || linha.vaga || '-'}</span
              >
            </div>
            <div class="rh-detail-card">
              <span class="rh-detail-label">Nível</span>
              <span class="rh-detail-value"
                >${payload?.candidate?.level || linha.nivel || '-'}</span
              >
            </div>
            <div class="rh-detail-card">
              <span class="rh-detail-label">Data</span>
              <span class="rh-detail-value">${linha.data_exibicao || '-'}</span>
            </div>
            <div class="rh-detail-card">
              <span class="rh-detail-label">Nota final</span>
              <span class="rh-detail-value"
                >${formatarPontuacaoDetalhada(
                  linha.pontuacao_final,
                  payload?.weightedFinalScore,
                )}</span
              >
            </div>
            <div class="rh-detail-card rh-detail-card--status">
              <span class="rh-detail-label">Situação atual</span>
              <span
                class=${`rh-status-pill ${obterClasseSituacaoAtual(situacaoAtual)}`}
              >
                ${situacaoAtual}
              </span>
            </div>
          </div>
        </section>

        <section class="rh-details-section">
          <h4 class="rh-details-section-title">Notas por etapa</h4>
          ${resumoEtapas?.length
            ? html`
                <div class="rh-detail-stage-grid">
                  ${resumoEtapas.map(
                    (etapa, indice) => html`
                      <div class="rh-detail-stage-card" key=${indice}>
                        <div class="rh-detail-stage-top">
                          <div class="rh-detail-stage-name">
                            ${etapa.label || '-'}
                          </div>
                          <span class="rh-detail-stage-weight"
                            >Peso ${etapa.weight ?? '-'}%</span
                          >
                        </div>
                        <div class="rh-detail-stage-score">
                          ${etapa.rawScore ?? 0}/${etapa.rawMax ?? 0}
                        </div>
                        <div class="rh-detail-stage-meta">
                          Aproveitamento:
                          ${((etapa.percent || 0) * 100).toFixed(1)}%<br />
                          Nota ponderada:
                          ${Number(etapa.weightedScore || 0).toFixed(1)}
                        </div>
                      </div>
                    `,
                  )}
                </div>
              `
            : html`
                <div class="alert alert-secondary mb-0">
                  Esta prova possui apenas o resumo salvo no histórico.
                </div>
              `}
        </section>

        <section class="rh-details-section">
          <h4 class="rh-details-section-title">Registro completo</h4>
          ${payload?.textContent
            ? html`<pre class="rh-detail-log">${payload.textContent}</pre>`
            : html`
                <div class="alert alert-secondary mb-0">
                  Esta prova não possui gabarito detalhado salvo para consulta.
                </div>
              `}
        </section>
      </div>
      <div class="rh-details-footer">
        <div class="rh-details-footer-actions">
          <button
            type="button"
            class="btn btn-outline-secondary"
            onClick=${() => window.print()}
          >
            Imprimir resultado
          </button>
          <button
            type="button"
            class="btn btn-outline-primary"
            onClick=${onDownload}
          >
            Baixar prova
          </button>
        </div>
        <button type="button" class="btn btn-primary" onClick=${onClose}>
          Fechar
        </button>
      </div>
    <//>
  `;
}

function TelaLogin({ controlador }) {
  const [usuario, setUsuario] = useState('');
  const [senha, setSenha] = useState('');
  const [mensagemErro, setMensagemErro] = useState('');

  const enviar = async () => {
    const resultado = await controlador.fazerLogin(
      usuario.trim(),
      senha.trim(),
    );
    if (!resultado.ok) {
      setMensagemErro(resultado.mensagem);
    }
  };

  return html`
    <section class="active screen" id="screen-login">
      <div class="rh-login-page">
        <div class="rh-login-panel rh-login-panel-modern">
          <div class="rh-login-brand-block rh-login-brand-block-centered">
            <img
              alt="Central 24 horas"
              class="rh-login-brand-image"
              src="estilos/logo-conexa.png"
            />
          </div>
          <div class="rh-login-copy-block">
            <h2 class="rh-login-welcome-title">Bem-vindo</h2>
            <p class="rh-login-welcome-text">
              Acesse sua plataforma com elegância e foco.
            </p>
          </div>
          <div class="mb-3">
            <label class="form-label rh-login-label">Login</label>
            <div class="rh-login-input-wrap">
              <span class="material-symbols-outlined rh-login-input-icon"
                >alternate_email</span
              >
              <input
                class="form-control rh-login-input rh-login-input-modern"
                placeholder="nome@empresa.com.br"
                value=${usuario}
                onInput=${(event) => setUsuario(event.target.value)}
                type="text"
              />
            </div>
          </div>
          <div class="mb-2">
            <div class="rh-login-label-row">
              <label class="form-label rh-login-label mb-0">Senha</label>
              <button class="rh-login-link-btn" tabindex="-1" type="button">
                Esqueceu a senha?
              </button>
            </div>
            <div class="rh-login-input-wrap">
              <span class="material-symbols-outlined rh-login-input-icon"
                >lock</span
              >
              <input
                class="form-control rh-login-input rh-login-input-modern"
                placeholder="••••••••"
                value=${senha}
                onInput=${(event) => setSenha(event.target.value)}
                type="password"
              />
              <span
                class="material-symbols-outlined rh-login-input-icon rh-login-input-icon-right"
                >visibility</span
              >
            </div>
          </div>
          ${mensagemErro
            ? html`<div class="alert alert-danger mb-3">${mensagemErro}</div>`
            : null}
          <button
            class="btn rh-login-btn rh-login-btn-modern w-100"
            onClick=${enviar}
          >
            <span>Acessar</span>
            <span class="material-symbols-outlined">arrow_forward</span>
          </button>
          <div class="rh-login-footer-meta">
            <span>© 2026 Central 24 Horas</span>
            <span>Privacidade</span>
            <span>Termos</span>
            <span>Suporte</span>
          </div>
        </div>
      </div>
    </section>
  `;
}

function TelaInicio({ controlador }) {
  const [carregando, setCarregando] = useState(true);
  const [recentes, setRecentes] = useState([]);
  const [detalheAberto, setDetalheAberto] = useState(null);

  const carregar = async () => {
    setCarregando(true);
    try {
      const historico = await lerHistorico();
      const ordenado = (Array.isArray(historico) ? historico : [])
        .sort((a, b) =>
          String(b.data_iso || '').localeCompare(String(a.data_iso || '')),
        )
        .slice(0, TAMANHO_RECENTES);
      setRecentes(ordenado);
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregar();
  }, []);

  return html`
    <${PainelRh}
      screenId="screen-menu"
      navAtiva="screen-menu"
      subtituloMarca="Central 24 horas"
      placeholderBusca="Pesquisar provas salvas"
      controlador=${controlador}
      acaoPrimaria=${{
        label: 'Iniciar teste',
        onClick: () => controlador.iniciarNovoFluxo(),
      }}
      acoesTopo=${html`
        <button
          type="button"
          class="btn btn-outline-secondary rh-modern-secondary-btn"
          onClick=${() => controlador.sair()}
        >
          Sair
        </button>
      `}
    >
      <section class="rh-modern-pagehead">
        <div>
          <p class="rh-modern-kicker">Página Inicial</p>
          <h3 class="rh-modern-title">Últimas Provas</h3>
          <p class="rh-modern-description">
            Visualize rapidamente os seis testes mais recentes salvos no
            sistema.
          </p>
          <br />
          <button
            type="button"
            class="btn btn-outline-secondary btn-sm"
            onClick=${carregar}
          >
            Atualizar
          </button>
        </div>
      </section>

      ${carregando
        ? html`<div class="alert alert-secondary">
            Carregando provas recentes...
          </div>`
        : recentes.length
          ? html`
              <div class="rh-recent-grid rh-modern-recent-grid">
                ${recentes.map(
                  (item) => html`
                    <button
                      key=${item.id_teste}
                      type="button"
                      class="rh-modern-history-panel"
                      onClick=${async () =>
                        setDetalheAberto(
                          await carregarDetalhesProva(item.id_teste),
                        )}
                    >
                      <div class="rh-modern-history-panel-icon">
                        <span
                          class="material-symbols-outlined rh-icone-inicio-destaque"
                        >
                          person
                        </span>
                      </div>
                      <div>
                        <strong>${item.nome_candidato || '-'}</strong>
                        <span
                          >${item.vaga || '-'} •
                          ${item.data_exibicao || '-'}</span
                        >
                      </div>
                      <span class="material-symbols-outlined"
                        >arrow_forward</span
                      >
                    </button>
                  `,
                )}
              </div>
            `
          : html`<div class="rh-inline-alert">
              Nenhuma prova salva até o momento.
            </div>`}

      <button
        class="rh-modern-history-panel"
        type="button"
        onClick=${() => controlador.irParaTelaProtegida('screen-history')}
      >
        <div class="rh-modern-history-panel-icon">
          <span class="material-symbols-outlined rh-icone-inicio-destaque">
            assignment
          </span>
        </div>
        <div>
          <strong>Ver histórico completo</strong>
          <span
            >Acesse os resultados paginados e filtre por candidato, vaga ou
            data.</span
          >
        </div>
        <span class="material-symbols-outlined">arrow_forward</span>
      </button>

      <${ModalDetalhesProva}
        detalhe=${detalheAberto}
        onClose=${() => setDetalheAberto(null)}
        onDownload=${() =>
          baixarPacoteHistorico(
            detalheAberto?.linha?.id_teste,
            detalheAberto?.linha?.nome_candidato || 'candidato',
          )}
      />
    <//>
  `;
}

function TelaHistorico({ controlador }) {
  const [carregando, setCarregando] = useState(true);
  const [linhas, setLinhas] = useState([]);

  const [pagina, setPagina] = useState(1);
  const [filtros, setFiltros] = useState({ nome: '', vaga: '', data: '' });
  const [detalheAberto, setDetalheAberto] = useState(null);
  const [mapaStatus, setMapaStatus] = useState({});

  useEffect(() => {
    (async () => {
      setCarregando(true);
      try {
        const [historico, statusAtual] = await Promise.all([
          lerHistorico(),
          construirMapaStatusAtual(),
        ]);
        setLinhas(Array.isArray(historico) ? historico : []);
        setMapaStatus(statusAtual);
      } finally {
        setCarregando(false);
      }
    })();
  }, []);

  const filtrado = useMemo(() => {
    return linhas
      .filter((linha) => {
        const matchNome =
          !filtros.nome ||
          String(linha.nome_candidato || '')
            .toLowerCase()
            .includes(filtros.nome.toLowerCase());
        const matchVaga =
          !filtros.vaga ||
          String(linha.vaga || '')
            .toLowerCase()
            .includes(filtros.vaga.toLowerCase());
        const matchData =
          !filtros.data ||
          formatarDataParaInput(linha.data_iso || linha.data_exibicao) ===
            filtros.data;
        return matchNome && matchVaga && matchData;
      })
      .sort((a, b) =>
        String(b.data_iso || '').localeCompare(String(a.data_iso || '')),
      );
  }, [linhas, filtros]);

  const paginado = obterItensPaginados(filtrado, pagina, TAMANHO_HISTORICO);

  return html`
    <${PainelRh}
      screenId="screen-history"
      navAtiva="screen-history"
      subtituloMarca="Página Inicial"
      placeholderBusca="Pesquisar no histórico"
      controlador=${controlador}
      acaoPrimaria=${{
        label: 'Iniciar teste',
        onClick: () => controlador.iniciarNovoFluxo(),
      }}
      acoesTopo=${html`
        <button
          type="button"
          class="btn btn-outline-secondary rh-modern-secondary-btn"
          onClick=${() => controlador.sair()}
        >
          Sair
        </button>
      `}
    >
      <section class="rh-modern-pagehead rh-modern-pagehead-history">
        <div>
          <p class="rh-modern-kicker">Console • Histórico de exames</p>
          <h2 class="rh-modern-title">Histórico</h2>
          <p class="rh-modern-description">
            Consulte provas salvas por candidato, vaga e data, com paginação de
            10 resultados por página.
          </p>
        </div>
      </section>

      <section class="rh-modern-filter-card">
        <div class="rh-modern-filter-grid">
          <div class="rh-modern-filter-field">
            <label>Candidato</label>
            <div class="rh-modern-input-shell">
              <span class="material-symbols-outlined">person_search</span>
              <input
                class="form-control"
                placeholder="Pesquisar por nome..."
                value=${filtros.nome}
                onInput=${(event) => {
                  setPagina(1);
                  setFiltros({ ...filtros, nome: event.target.value });
                }}
              />
            </div>
          </div>
          <div class="rh-modern-filter-field">
            <label>Cargo / vaga</label>
            <div class="rh-modern-input-shell">
              <span class="material-symbols-outlined">work</span>
              <input
                class="form-control"
                placeholder="Pesquisar por vaga..."
                value=${filtros.vaga}
                onInput=${(event) => {
                  setPagina(1);
                  setFiltros({ ...filtros, vaga: event.target.value });
                }}
              />
            </div>
          </div>
          <div class="rh-modern-filter-field">
            <label>Data</label>
            <div class="rh-modern-input-shell">
              <span class="material-symbols-outlined">calendar_month</span>
              <input
                class="form-control"
                type="date"
                value=${filtros.data}
                onInput=${(event) => {
                  setPagina(1);
                  setFiltros({ ...filtros, data: event.target.value });
                }}
              />
            </div>
          </div>
        </div>
      </section>

      <section class="rh-modern-table-card">
        <div class="table-responsive rh-history-table-wrap">
          <table
            class="table align-middle history-table rh-modern-history-table"
          >
            <thead>
              <tr>
                <th>Candidato</th>
                <th>Vaga</th>
                <th>Nível</th>
                <th>Data</th>
                <th>Nota</th>
                <th>Status</th>
                <th class="text-end">Ações</th>
              </tr>
            </thead>
            <tbody>
              ${carregando
                ? html`<tr>
                    <td colspan="7" class="text-center text-muted py-4">
                      Carregando histórico...
                    </td>
                  </tr>`
                : paginado.itens.length
                  ? paginado.itens.map(
                      (linha) => html`
                        <tr key=${linha.id_teste}>
                          <td>${linha.nome_candidato || '-'}</td>
                          <td>${linha.vaga || '-'}</td>
                          <td>${linha.nivel || '-'}</td>
                          <td>${linha.data_exibicao || '-'}</td>
                          <td>
                            ${formatarPontuacaoDetalhada(
                              linha.pontuacao_final,
                              '',
                            )}
                          </td>
                          <td>
                            <span
                              class=${`rh-status-pill ${obterClasseSituacaoAtual(obterRotuloSituacaoAtual(linha, mapaStatus))}`}
                            >
                              ${obterRotuloSituacaoAtual(linha, mapaStatus)}
                            </span>
                          </td>
                          <td class="text-end">
                            <div
                              class="d-flex gap-2 flex-wrap justify-content-end"
                            >
                              <button
                                type="button"
                                class="btn btn-sm btn-outline-primary"
                                onClick=${async () =>
                                  setDetalheAberto(
                                    await carregarDetalhesProva(linha.id_teste),
                                  )}
                              >
                                Detalhes
                              </button>
                              <button
                                type="button"
                                class="btn btn-sm btn-outline-success"
                                onClick=${() =>
                                  baixarPacoteHistorico(
                                    linha.id_teste,
                                    linha.nome_candidato || 'candidato',
                                  )}
                              >
                                Baixar prova
                              </button>
                            </div>
                          </td>
                        </tr>
                      `,
                    )
                  : html`<tr>
                      <td colspan="7" class="text-center text-muted py-4">
                        Nenhum registro encontrado.
                      </td>
                    </tr>`}
            </tbody>
          </table>
        </div>
        <${GrupoPaginacao}
          paginaAtual=${paginado.paginaAtual}
          totalPaginas=${paginado.totalPaginas}
          onChange=${setPagina}
        />
      </section>

      <${ModalDetalhesProva}
        detalhe=${detalheAberto}
        onClose=${() => setDetalheAberto(null)}
        onDownload=${() =>
          baixarPacoteHistorico(
            detalheAberto?.linha?.id_teste,
            detalheAberto?.linha?.nome_candidato || 'candidato',
          )}
      />
    <//>
  `;
}

function TelaCriarProcesso({ controlador }) {
  const [formulario, setFormulario] = useState({
    vaga: '',
    quantidade: 1,
    dataEncerramento: '',
    operacao: '',
    trilha: '',
    usaNotaCorte: false,
    notaCorte: '',
  });
  const [erro, setErro] = useState('');

  const regras = obterRegrasFormularioProcesso(formulario.vaga);

  useEffect(() => {
    if (regras.trilhaFixa && formulario.trilha !== regras.trilhaFixa) {
      setFormulario((anterior) => ({ ...anterior, trilha: regras.trilhaFixa }));
    }
  }, [regras.trilhaFixa, formulario.trilha]);

  const criar = async () => {
    if (
      !formulario.vaga ||
      !formulario.quantidade ||
      !formulario.dataEncerramento
    ) {
      setErro(
        'Preencha a vaga, a quantidade de vagas e a data de encerramento.',
      );
      return;
    }
    if (regras.exigeOperacao && !formulario.operacao) {
      setErro('Para essa vaga, é obrigatório informar a operação.');
      return;
    }
    if (regras.exigeTrilha && !formulario.trilha) {
      setErro('Para essa vaga, é obrigatório informar a trilha.');
      return;
    }
    if (formulario.usaNotaCorte) {
      const nota = Number(formulario.notaCorte);
      if (
        !formulario.notaCorte ||
        Number.isNaN(nota) ||
        nota < 4 ||
        nota > 10
      ) {
        setErro('A nota de corte deve estar entre 4 e 10.');
        return;
      }
    }

    setErro('');
    await criarProcesso({
      id_processo: montarIdProcesso(formulario.vaga),
      vaga: formulario.vaga,
      quantidade_vagas: Number(formulario.quantidade),
      vagas_preenchidas: 0,
      data_encerramento: formulario.dataEncerramento,
      operacao: formulario.operacao,
      trilha: regras.trilhaFixa || formulario.trilha,
      usa_nota_corte: formulario.usaNotaCorte ? 1 : 0,
      nota_corte: formulario.usaNotaCorte ? Number(formulario.notaCorte) : null,
      status: 'Aberto',
      data_criacao: new Date().toISOString(),
    });

    controlador.irParaTelaProtegida('screen-processes');
  };

  return html`
    <${PainelRh}
      screenId="screen-process-create"
      navAtiva="screen-process-create"
      subtituloMarca="Novo processo seletivo"
      placeholderBusca="Iniciar processo seletivo"
      controlador=${controlador}
      acaoPrimaria=${{
        label: 'Gerenciar processos',
        onClick: () => controlador.irParaTelaProtegida('screen-processes'),
      }}
      acoesTopo=${html`
        <button
          type="button"
          class="btn btn-outline-secondary rh-modern-secondary-btn"
          onClick=${() => controlador.sair()}
        >
          Sair
        </button>
      `}
    >
      <section class="rh-modern-pagehead rh-modern-pagehead-history">
        <div>
          <p class="rh-modern-kicker">Console • Processo seletivo</p>
          <h2 class="rh-modern-title">Iniciar Processo Seletivo</h2>
          <p class="rh-modern-description">
            Cadastre um novo processo seletivo sem alterar o fluxo de provas já
            existente.
          </p>
        </div>
      </section>
      <section class="rh-modern-table-card">
        <div class="row g-3">
          <div class="col-md-6">
            <label class="form-label">Vaga do processo</label>
            <select
              class="form-select rh-flow-input"
              value=${formulario.vaga}
              onChange=${(event) =>
                setFormulario({ ...formulario, vaga: event.target.value })}
            >
              <option value="">Selecione...</option>
              <option>Jovem Aprendiz</option>
              <option>Operador</option>
              <option>Estagiário</option>
              <option>Supervisor</option>
              <option>Control Desk</option>
              <option>Planejamento</option>
              <option>TI</option>
              <option>Analista</option>
              <option>Outros</option>
            </select>
          </div>
          <div class="col-md-3">
            <label class="form-label">Quantidade de vagas</label>
            <input
              class="form-control rh-flow-input"
              type="number"
              min="1"
              value=${formulario.quantidade}
              onInput=${(event) =>
                setFormulario({
                  ...formulario,
                  quantidade: event.target.value,
                })}
            />
          </div>
          <div class="col-md-3">
            <label class="form-label">Data de encerramento</label>
            <input
              class="form-control rh-flow-input"
              type="date"
              value=${formulario.dataEncerramento}
              onInput=${(event) =>
                setFormulario({
                  ...formulario,
                  dataEncerramento: event.target.value,
                })}
            />
          </div>
          <div class="col-md-6">
            <label class="form-label">Operação</label>
            <select
              class="form-select rh-flow-input"
              value=${formulario.operacao}
              onChange=${(event) =>
                setFormulario({ ...formulario, operacao: event.target.value })}
            >
              <option value="">Selecione...</option>
              <option>CRF</option>
              <option>DAVITA</option>
              <option>NEWE</option>
              <option>BRAVA</option>
              <option>ENDOVIEW</option>
            </select>
          </div>
          <div class="col-md-6">
            <label class="form-label">Trilha</label>
            <select
              class="form-select rh-flow-input"
              disabled=${!!regras.trilhaFixa}
              value=${regras.trilhaFixa || formulario.trilha}
              onChange=${(event) =>
                setFormulario({ ...formulario, trilha: event.target.value })}
            >
              <option value="">Selecione...</option>
              <option value="RH">RH</option>
              <option value="TI">TI</option>
            </select>
          </div>
          <div class="col-md-6">
            <label class="form-label d-block mb-2">Ativar nota de corte</label>
            <label class="rh-cutoff-toggle">
              <input
                type="checkbox"
                checked=${formulario.usaNotaCorte}
                onChange=${(event) =>
                  setFormulario({
                    ...formulario,
                    usaNotaCorte: event.target.checked,
                  })}
              />
              <span class="rh-cutoff-toggle-slider"></span>
            </label>
          </div>
          <div class="col-md-6">
            <label class="form-label">Definir nota de corte</label>
            <input
              class="form-control rh-flow-input"
              type="number"
              min="4"
              max="10"
              step="0.1"
              disabled=${!formulario.usaNotaCorte}
              value=${formulario.notaCorte}
              onInput=${(event) =>
                setFormulario({ ...formulario, notaCorte: event.target.value })}
            />
          </div>
        </div>
        ${erro
          ? html`<div class="alert alert-danger mt-4">${erro}</div>`
          : null}
        <div
          class="d-flex justify-content-between align-items-center flex-wrap gap-2 mt-4 pt-3 border-top"
        >
          <button
            type="button"
            class="btn btn-outline-secondary rh-soft-btn"
            onClick=${() => controlador.irParaTelaProtegida('screen-processes')}
          >
            Voltar
          </button>
          <button
            type="button"
            class="btn btn-success btn-lg rh-primary-cta"
            onClick=${criar}
          >
            Criar processo
          </button>
        </div>
      </section>
    <//>
  `;
}

function TelaBancoTalentos({ controlador }) {
  const [linhas, setLinhas] = useState([]);
  const [processosAbertos, setProcessosAbertos] = useState([]);
  const [candidatoParaUtilizar, setCandidatoParaUtilizar] = useState(null);
  const [processoSelecionadoUso, setProcessoSelecionadoUso] = useState('');

  const carregar = async () => {
    const [banco, processos] = await Promise.all([
      lerBancoTalentos(true),
      lerProcessos(true),
    ]);

    setLinhas(Array.isArray(banco) ? banco : []);
    setProcessosAbertos(
      (Array.isArray(processos) ? processos : []).filter(
        (processo) => String(processo.status || '').trim() !== 'Encerrado',
      ),
    );
  };

  useEffect(() => {
    carregar();
  }, []);

  const remover = async (idBanco) => {
    if (!window.confirm('Deseja eliminar este candidato do banco de talentos?'))
      return;
    await removerBancoTalentos(idBanco);
    carregar();
  };

  const utilizar = async (linha) => {
    if (!processosAbertos.length) {
      window.alert('Não há processo aberto no momento.');
      return;
    }

    setCandidatoParaUtilizar(linha);
    setProcessoSelecionadoUso('');
  };

  return html`
    <${PainelRh}
      screenId="screen-talent-bank"
      navAtiva="screen-talent-bank"
      subtituloMarca="Banco de talentos"
      placeholderBusca="Banco de talentos"
      controlador=${controlador}
      acoesTopo=${html`
        <button
          type="button"
          class="btn btn-outline-secondary rh-modern-secondary-btn"
          onClick=${() => controlador.sair()}
        >
          Sair
        </button>
      `}
    >
      <section class="rh-modern-pagehead rh-modern-pagehead-history">
        <div>
          <p class="rh-modern-kicker">Console • Reaproveitamento</p>
          <h2 class="rh-modern-title">Banco de talentos</h2>
          <p class="rh-modern-description">
            Consulte candidatos marcados para futuras oportunidades.
          </p>
        </div>
      </section>
      <section class="rh-modern-table-card">
        <div class="table-responsive">
          <table
            class="table align-middle history-table rh-modern-history-table"
          >
            <thead>
              <tr>
                <th>Processo</th>
                <th>Candidato</th>
                <th>Vaga</th>
                <th>Nota</th>
                <th>Data</th>
                <th>Origem</th>
                <th class="text-end">Ações</th>
              </tr>
            </thead>
            <tbody>
              ${
                linhas.length
                  ? linhas.map(
                      (linha) => html`
                        <tr key=${linha.id_banco}>
                          <td>${linha.id_processo || '-'}</td>
                          <td>${linha.nome_candidato || '-'}</td>
                          <td>${linha.vaga || '-'}</td>
                          <td>${linha.pontuacao_final || '-'}</td>
                          <td>${linha.data_movimentacao || '-'}</td>
                          <td>${linha.origem || '-'}</td>
                          <td class="text-end">
                            <div
                              class="d-flex justify-content-end gap-2 flex-wrap"
                            >
                              <button
                                type="button"
                                class="btn btn-sm btn-outline-danger"
                                onClick=${() => remover(linha.id_banco)}
                              >
                                Eliminar candidato
                              </button>
                              <button
                                type="button"
                                class="btn btn-sm btn-outline-primary"
                                onClick=${() => utilizar(linha)}
                              >
                                Utilizar candidato
                              </button>
                            </div>
                          </td>
                        </tr>
                      `,
                    )
                  : html`<tr>
                      <td colspan="7" class="text-center text-muted py-4">
                        Nenhum candidato no banco de talentos.
                      </td>
                    </tr>`
              }
            </tbody>
          </table>
        </div>
      </section>
            <${ModalPadrao}
        aberto=${!!candidatoParaUtilizar}
        titulo="Utilizar candidato"
        subtitulo="Selecione o processo aberto e confirme a ação."
        onClose=${() => {
          setCandidatoParaUtilizar(null);
          setProcessoSelecionadoUso('');
        }}
      >
        <div class="rh-details-body">
          <div class="mb-3">
            <label class="form-label">Processo aberto</label>
            <select
              class="form-select"
              value=${processoSelecionadoUso}
              onChange=${(event) => setProcessoSelecionadoUso(event.target.value)}
            >
              <option value="">Selecione...</option>
              ${processosAbertos.map(
                (processo) => html`
                  <option
                    key=${processo.id_processo}
                    value=${processo.id_processo}
                  >
                    ${processo.id_processo} • ${processo.vaga} •
                    ${processo.operacao || processo.trilha || '-'}
                  </option>
                `,
              )}
            </select>
          </div>
        </div>
        <div class="rh-details-footer">
          <div class="rh-details-footer-actions">
            <button
              type="button"
              class="btn btn-outline-secondary"
              onClick=${() => {
                setCandidatoParaUtilizar(null);
                setProcessoSelecionadoUso('');
              }}
            >
              Cancelar
            </button>
          </div>
          <button
            type="button"
            class="btn btn-primary"
            onClick=${async () => {
              if (!processoSelecionadoUso) {
                window.alert('Selecione um processo antes de continuar.');
                return;
              }

              const confirmar = window.confirm(
                `Deseja realmente utilizar o candidato ${candidatoParaUtilizar?.nome_candidato || ''} no processo ${processoSelecionadoUso}?`,
              );
              if (!confirmar) return;

              await usarCandidatoDoBancoTalentos(
                candidatoParaUtilizar.id_banco,
                {
                  id_processo: processoSelecionadoUso,
                },
              );

              setCandidatoParaUtilizar(null);
              setProcessoSelecionadoUso('');
              await carregar();
            }}
          >
            Confirmar utilização
          </button>
        </div>
      </${ModalPadrao}>
    <//>
  `;
}

function GraficoComparativoAnalise({ itens = [] }) {
  const dados = Array.isArray(itens) ? itens : [];
  const maiorValor = Math.max(
    1,
    ...dados.flatMap((item) => [
      Number(item?.obtained || 0),
      Number(item?.expected || 0),
    ]),
  );

  if (!dados.length) {
    return html`
      <div class="alert alert-secondary mb-0">
        Não há dados suficientes para exibir o gráfico comparativo.
      </div>
    `;
  }

  return html`
    <div class="rh-analysis-chart">
      <div class="rh-analysis-chart-header">
        <div class="rh-analysis-chart-legend">
          <span class="rh-analysis-legend-item">
            <span
              class="rh-analysis-legend-color"
              style=${{ background: '#173c8c' }}
            ></span>
            <span>Candidato</span>
          </span>
          <span class="rh-analysis-legend-item">
            <span
              class="rh-analysis-legend-color"
              style=${{ background: '#f0a33a' }}
            ></span>
            <span>Expectativa da vaga</span>
          </span>
        </div>
      </div>

      <div class="rh-analysis-chart-body">
        ${dados.map((item, indice) => {
          const obtained = Number(item?.obtained || 0);
          const expected = Number(item?.expected || 0);
          const obtainedWidth = `${Math.max(0, (obtained / maiorValor) * 100)}%`;
          const expectedWidth = `${Math.max(0, (expected / maiorValor) * 100)}%`;

          return html`
            <div class="rh-analysis-chart-row" key=${indice}>
              <div class="rh-analysis-chart-label">${item?.label || '-'}</div>

              <div class="rh-analysis-chart-bars">
                <div class="rh-analysis-chart-bar-group">
                  <div class="rh-analysis-chart-bar-track">
                    <div
                      class="rh-analysis-chart-bar is-obtained"
                      style=${{ width: obtainedWidth }}
                    ></div>
                  </div>
                  <div class="rh-analysis-chart-value">
                    ${formatarNotaAnalise(obtained)}
                  </div>
                </div>

                <div class="rh-analysis-chart-bar-group">
                  <div class="rh-analysis-chart-bar-track">
                    <div
                      class="rh-analysis-chart-bar is-expected"
                      style=${{ width: expectedWidth }}
                    ></div>
                  </div>
                  <div class="rh-analysis-chart-value">
                    ${formatarNotaAnalise(expected)}
                  </div>
                </div>
              </div>
            </div>
          `;
        })}
      </div>
    </div>
  `;
}

function obterClasseAderencia(recomendacao) {
  const texto = String(recomendacao || '')
    .trim()
    .toLowerCase();

  if (texto === 'forte aderência' || texto === 'forte aderencia') {
    return 'rh-aderencia-tag is-strong';
  }

  if (texto === 'boa aderência' || texto === 'boa aderencia') {
    return 'rh-aderencia-tag is-medium';
  }

  return 'rh-aderencia-tag is-low';
}

function TelaAnaliseCandidatos({ controlador }) {
  const [linhas, setLinhas] = useState([]);
  const [pagina, setPagina] = useState(1);
  const [filtros, setFiltros] = useState({
    processo: '',
    candidato: '',
    vaga: '',
    nota: '',
  });
  const [detalhe, setDetalhe] = useState(null);

  const carregarAnalises = async () => {
    const dados = await lerAnalisesCandidatos();
    setLinhas(Array.isArray(dados) ? dados : []);
  };

  useEffect(() => {
    carregarAnalises();
  }, []);

  const filtrado = useMemo(() => {
    return linhas.filter((linha) => {
      const matchProcesso =
        !filtros.processo ||
        String(linha.id_processo || '')
          .toLowerCase()
          .includes(filtros.processo.toLowerCase());
      const matchCandidato =
        !filtros.candidato ||
        String(linha.nome_candidato || '')
          .toLowerCase()
          .includes(filtros.candidato.toLowerCase());
      const matchVaga =
        !filtros.vaga ||
        String(linha.vaga || '')
          .toLowerCase()
          .includes(filtros.vaga.toLowerCase());

      let matchNota = true;
      if (filtros.nota) {
        const notaMinima = Number(String(filtros.nota).replace(',', '.'));
        const notaAtual = Number(
          String(linha.nota_final || 0).replace(',', '.'),
        );
        if (!Number.isNaN(notaMinima)) matchNota = notaAtual >= notaMinima;
      }

      return matchProcesso && matchCandidato && matchVaga && matchNota;
    });
  }, [linhas, filtros]);

  const paginado = obterItensPaginados(filtrado, pagina, TAMANHO_ANALISE);

  const aplicarAcao = async (statusCandidato) => {
    if (!detalhe?.id_teste) return;

    const candidatosProcesso = await lerCandidatosProcessos(true);
    const vinculo = candidatosProcesso.find(
      (item) =>
        String(item.id_teste || '').trim() ===
        String(detalhe.id_teste || '').trim(),
    );

    if (!vinculo) {
      window.alert(
        'Nao foi possivel localizar o vinculo do candidato com o processo.',
      );
      return;
    }

    await atualizarStatusCandidato(vinculo.id_registro, {
      status_candidato: statusCandidato,
      data_movimentacao: new Date().toISOString(),
    });

    await carregarAnalises();
    setDetalhe(await lerDetalheAnaliseCandidato(detalhe.id_teste));
  };

  return html`
    <${PainelRh}
      screenId="screen-analysis-candidates"
      navAtiva="screen-analysis-candidates"
      subtituloMarca="Análise por candidato"
      placeholderBusca="Análise por candidato"
      controlador=${controlador}
      mostrarAtalhos=${false}
      acoesTopo=${html`
        <button
          type="button"
          class="btn btn-outline-secondary rh-modern-secondary-btn"
          onClick=${() => controlador.sair()}
        >
          Sair
        </button>
      `}
    >
      <section class="rh-modern-pagehead rh-modern-pagehead-history">
        <div>
          <p class="rh-modern-kicker">Console • Inteligência analítica</p>
          <h2 class="rh-modern-title">Análise por candidato</h2>
          <p class="rh-modern-description">
            Consulte a aderência do candidato à vaga com base no desempenho por
            etapa.
          </p>
        </div>
      </section>

      <section class="rh-modern-filter-card mb-4">
        <div class="rh-modern-filter-grid">
          <div class="rh-modern-filter-field">
            <label>Processo</label>
            <div class="rh-modern-input-shell">
              <span class="material-symbols-outlined">folder_managed</span>
              <input
                class="form-control"
                value=${filtros.processo}
                onInput=${(event) => {
                  setPagina(1);
                  setFiltros({ ...filtros, processo: event.target.value });
                }}
              />
            </div>
          </div>
          <div class="rh-modern-filter-field">
            <label>Candidato</label>
            <div class="rh-modern-input-shell">
              <span class="material-symbols-outlined">person_search</span>
              <input
                class="form-control"
                value=${filtros.candidato}
                onInput=${(event) => {
                  setPagina(1);
                  setFiltros({ ...filtros, candidato: event.target.value });
                }}
              />
            </div>
          </div>
          <div class="rh-modern-filter-field">
            <label>Vaga</label>
            <div class="rh-modern-input-shell">
              <span class="material-symbols-outlined">work</span>
              <input
                class="form-control"
                value=${filtros.vaga}
                onInput=${(event) => {
                  setPagina(1);
                  setFiltros({ ...filtros, vaga: event.target.value });
                }}
              />
            </div>
          </div>
          <div class="rh-modern-filter-field">
            <label>Nota mínima</label>
            <div class="rh-modern-input-shell">
              <span class="material-symbols-outlined">star</span>
              <input
                class="form-control"
                type="number"
                step="0.1"
                min="0"
                max="10"
                value=${filtros.nota}
                onInput=${(event) => {
                  setPagina(1);
                  setFiltros({ ...filtros, nota: event.target.value });
                }}
              />
            </div>
          </div>
        </div>
      </section>

      <section class="rh-modern-table-card">
        <div class="table-responsive">
          <table
            class="table align-middle history-table rh-modern-history-table"
          >
            <thead>
              <tr>
                <th>Processo</th>
                <th>Candidato</th>
                <th>Vaga</th>
                <th>Nota</th>
                <th>Afinidade</th>
                <th>Recomendação</th>
                <th>Status</th>
                <th class="text-end">Ações</th>
              </tr>
            </thead>
            <tbody>
              ${paginado.itens.length
                ? paginado.itens.map(
                    (linha) => html`
                      <tr key=${linha.id_teste}>
                        <td>${linha.id_processo || '-'}</td>
                        <td>${linha.nome_candidato || '-'}</td>
                        <td>${linha.vaga || '-'}</td>
                        <td>${formatarNotaAnalise(linha.nota_final)}</td>
                        <td>
                          ${formatarPercentualAfinidade(
                            linha.afinidade_percentual,
                          )}%
                        </td>
                        <td>
                          <span
                            class=${obterClasseAderencia(linha.recomendacao)}
                          >
                            ${linha.recomendacao || '-'}
                          </span>
                        </td>
                        <td>${linha.status_candidato || '-'}</td>
                        <td class="text-end">
                          <button
                            type="button"
                            class="btn btn-sm btn-outline-primary"
                            onClick=${async () =>
                              setDetalhe(
                                await lerDetalheAnaliseCandidato(
                                  linha.id_teste,
                                ),
                              )}
                          >
                            Detalhes
                          </button>
                        </td>
                      </tr>
                    `,
                  )
                : html`<tr>
                    <td colspan="8" class="text-center text-muted py-4">
                      Nenhuma análise disponível.
                    </td>
                  </tr>`}
            </tbody>
          </table>
        </div>
        <${GrupoPaginacao}
          paginaAtual=${paginado.paginaAtual}
          totalPaginas=${paginado.totalPaginas}
          onChange=${setPagina}
        />
      </section>

      ${detalhe
        ? html`
            <${ModalPadrao}
              aberto=${true}
              titulo=${`Análise do candidato • ${detalhe.nome_candidato || 'Candidato'}`}
              subtitulo="Comparativo analítico entre desempenho e exigência da vaga."
              onClose=${() => setDetalhe(null)}
            >
              <div class="rh-details-body">
                <section class="rh-details-section">
                  <h4 class="rh-details-section-title">Resumo analítico</h4>
                  <div class="rh-details-grid">
                    <div class="rh-detail-card">
                      <span class="rh-detail-label">Processo</span
                      ><span class="rh-detail-value"
                        >${detalhe.id_processo || '-'}</span
                      >
                    </div>
                    <div class="rh-detail-card">
                      <span class="rh-detail-label">Candidato</span
                      ><span class="rh-detail-value"
                        >${detalhe.nome_candidato || '-'}</span
                      >
                    </div>
                    <div class="rh-detail-card">
                      <span class="rh-detail-label">Vaga</span
                      ><span class="rh-detail-value"
                        >${detalhe.vaga || '-'}</span
                      >
                    </div>
                    <div class="rh-detail-card">
                      <span class="rh-detail-label">Nota final</span
                      ><span class="rh-detail-value"
                        >${formatarNotaAnalise(detalhe.nota_final)}</span
                      >
                    </div>
                    <div class="rh-detail-card">
                      <span class="rh-detail-label">Afinidade</span
                      ><span class="rh-detail-value"
                        >${formatarPercentualAfinidade(
                          detalhe.afinidade_percentual,
                        )}%</span
                      >
                    </div>
                    <div class="rh-detail-card">
                      <span class="rh-detail-label">Recomendação</span>
                      <span class=${obterClasseAderencia(detalhe.recomendacao)}>
                        ${detalhe.recomendacao || '-'}
                      </span>
                    </div>
                    <div class="rh-detail-card">
                      <span class="rh-detail-label">Parecer final</span
                      ><span class="rh-detail-value"
                        >${detalhe.parecer_final || '-'}</span
                      >
                    </div>
                  </div>
                </section>
                <section class="rh-details-section">
                  <h4 class="rh-details-section-title">Etapas comparadas</h4>

                  <div class="mb-4">
                    <${GraficoComparativoAnalise}
                      itens=${detalhe.grafico || []}
                    />
                  </div>

                  <!--<div class="rh-detail-stage-grid">
                    ${(detalhe.grafico || []).map(
                    (item, indice) => html`
                      <div class="rh-detail-stage-card" key=${indice}>
                        <div class="rh-detail-stage-name">
                          ${item.label || '-'}
                        </div>
                        <div class="rh-detail-stage-score">
                          ${formatarNotaAnalise(item.obtained)} x
                          ${formatarNotaAnalise(item.expected)}
                        </div>
                        <div class="rh-detail-stage-meta">
                          Candidato x expectativa da vaga
                        </div>
                      </div>
                    `,
                  )}
                  </div>-->
                </section>
                <section class="rh-details-section">
                  <h4 class="rh-details-section-title">Observações</h4>
                  <div class="rh-result-pending-list">
                    <div>
                      Nota textual geral:
                      ${formatarNotaAnalise(
                        detalhe?.analise_texto?.overall || 0,
                      )}
                    </div>
                    ${(detalhe.ressalvas || []).map(
                      (item, indice) => html`<div key=${indice}>${item}</div>`,
                    )}
                  </div>
                </section>
              </div>
              <div class="rh-details-footer">
                <div class="rh-details-footer-actions d-flex gap-2 flex-wrap">
                  <button
                    type="button"
                    class="btn btn-outline-success"
                    onClick=${() => aplicarAcao('Aprovado')}
                  >
                    Aprovar candidato
                  </button>
                  <button
                    type="button"
                    class="btn btn-outline-danger"
                    onClick=${() => aplicarAcao('Eliminado')}
                  >
                    Eliminar candidato
                  </button>
                  <button
                    type="button"
                    class="btn btn-outline-secondary"
                    onClick=${() => aplicarAcao('Banco de talentos')}
                  >
                    Banco de talentos
                  </button>
                </div>
                <button
                  type="button"
                  class="btn btn-primary"
                  onClick=${() => setDetalhe(null)}
                >
                  Fechar
                </button>
              </div>
            <//>
          `
        : null}
    <//>
  `;
}

// Formata pequenos trechos visuais compartilhados entre as telas finais.
function formatarTempoRestante(segundosTotais) {
  const total = Math.max(0, Number(segundosTotais || 0));
  const minutos = String(Math.floor(total / 60)).padStart(2, '0');
  const segundos = String(total % 60).padStart(2, '0');
  return `${minutos}:${segundos}`;
}

function formatarNotaVisual(valor, casas = 1) {
  const numero = Number(valor || 0);
  return Number.isFinite(numero)
    ? numero.toLocaleString('pt-BR', {
        minimumFractionDigits: casas,
        maximumFractionDigits: casas,
      })
    : '0,0';
}

function obterClasseEtapaResultado(percentual) {
  const percent = Number(percentual || 0);
  if (percent >= 0.7) return 'good';
  if (percent >= 0.4) return 'warn';
  return 'bad';
}

function obterClasseStatusProcesso(status) {
  const valor = String(status || '').trim();
  if (valor === 'Aprovado') return 'is-approved';
  if (valor === 'Eliminado') return 'is-eliminated';
  if (valor === 'Banco de talentos') return 'is-talent';
  return 'is-analysis';
}

function montarDescricaoFluxo(blueprint) {
  if (!blueprint?.stages?.length) {
    return 'Selecione a vaga para visualizar a trilha.';
  }

  return blueprint.stages
    .map(
      (etapa) => `${ROTULOS_ETAPAS[etapa.key] || 'Etapa'} (${etapa.weight}%)`,
    )
    .join(' -> ');
}

// Componente de editor rico usado nas questoes discursivas.
function EditorTextoRich({ valor, onChange }) {
  const editorRef = useRef(null);

  useEffect(() => {
    const editor = editorRef.current;
    const proximoValor = valor || '';

    if (editor && editor.innerHTML !== proximoValor) {
      editor.innerHTML = proximoValor;
    }
  }, [valor]);

  const executarComando = (comando) => {
    document.execCommand(comando, false, null);
    const editor = editorRef.current;
    if (editor) {
      editor.focus();
      onChange(editor.innerHTML || '');
    }
  };

  return html`
    <div class="card border-0 bg-light">
      <div class="card-body">
        <div class="toolbar d-flex flex-wrap gap-2 mb-3">
          <button
            type="button"
            class="btn btn-outline-secondary"
            onClick=${() => executarComando('bold')}
          >
            <strong>B</strong>
          </button>
          <button
            type="button"
            class="btn btn-outline-secondary"
            onClick=${() => executarComando('italic')}
          >
            <em>I</em>
          </button>
          <button
            type="button"
            class="btn btn-outline-secondary"
            onClick=${() => executarComando('underline')}
          >
            <u>U</u>
          </button>
          <button
            type="button"
            class="btn btn-outline-secondary"
            onClick=${() => executarComando('justifyLeft')}
          >
            Esq
          </button>
          <button
            type="button"
            class="btn btn-outline-secondary"
            onClick=${() => executarComando('justifyCenter')}
          >
            Centro
          </button>
          <button
            type="button"
            class="btn btn-outline-secondary"
            onClick=${() => executarComando('insertUnorderedList')}
          >
            Lista
          </button>
        </div>
        <div
          ref=${editorRef}
          class="word-editor"
          contenteditable=${true}
          suppressContentEditableWarning=${true}
          spellcheck=${false}
          onInput=${(event) => onChange(event.currentTarget.innerHTML || '')}
        ></div>
      </div>
    </div>
  `;
}

// Renderiza perguntas objetivas mantendo o visual original da prova.
function PerguntaMultipla({ questao, resposta, onChange }) {
  const selecionado = resposta?.selected;

  return html`
    <div class="card border-0 bg-light">
      <div class="card-body">
        ${questao.options.map(
          (opcao, indice) => html`
            <div class="form-check mb-3" key=${`${questao.title}-${indice}`}>
              <input
                class="form-check-input"
                type="radio"
                name="mcq"
                id=${`opcao-${indice}`}
                value=${indice}
                checked=${selecionado === indice}
                onChange=${() => onChange(indice)}
              />
              <label class="form-check-label" for=${`opcao-${indice}`}>
                <span class="exam-option-letter"
                  >${String.fromCharCode(65 + indice)}</span
                >
                <span class="exam-option-text">${opcao}</span>
              </label>
            </div>
          `,
        )}
      </div>
    </div>
  `;
}

// Centraliza o envio e a validacao dos arquivos de Excel.
function PerguntaExcel({ questao, resposta, nomeCandidato, onChange }) {
  const inputRef = useRef(null);
  const [processando, setProcessando] = useState(false);

  const baixarArquivoBase = async () => {
    try {
      await baixarModeloExcel(questao.taskId, nomeCandidato || 'candidato');
    } catch (error) {
      window.alert(
        error?.message ||
          'Nao foi possivel localizar o arquivo-base da prova de Excel.',
      );
    }
  };

  const processarUpload = async (event) => {
    const arquivo = event.target.files?.[0];
    if (!arquivo) return;

    setProcessando(true);

    try {
      const respostaValidada = await validarArquivoExcel(
        questao.taskId,
        arquivo,
        questao.points,
      );
      onChange(respostaValidada);
    } catch (error) {
      onChange({
        type: 'excel_external',
        uploaded: false,
        validation: null,
        statusText: 'Nao foi possivel ler o arquivo enviado.',
        statusClass: 'excel-status-error',
      });
    } finally {
      setProcessando(false);
      if (event.target) event.target.value = '';
    }
  };

  return html`
    <div class="excel-card">
      <div class="row g-3">
        <div class="col-lg-7">
          <div class="excel-step mb-3">
            <h4 class="h6 fw-bold">Como funciona esta etapa</h4>
            <ol class="mb-0">
              <li>Baixe a planilha desta etapa.</li>
              <li>Abra no LibreOffice Calc ou Excel.</li>
              <li>Realize todas as atividades descritas.</li>
              <li>Salve o arquivo e envie abaixo.</li>
            </ol>
          </div>
          <div class="d-flex flex-wrap gap-2 mb-3">
            <button
              type="button"
              class="btn btn-success"
              onClick=${baixarArquivoBase}
            >
              Baixar arquivo .xlsx
            </button>
          </div>
          <div class="excel-step">
            <h4 class="h6 fw-bold">O que sera testado neste arquivo</h4>
            <ul class="muted-list">
              ${obterCapacidadesDaTarefa(questao.taskId).map(
                (item, indice) => html`<li key=${indice}>${item}</li>`,
              )}
            </ul>
          </div>
        </div>
        <div class="col-lg-5">
          <div class="excel-upload-box">
            <label class="form-label fw-semibold"
              >Enviar arquivo respondido</label
            >
            <input
              ref=${inputRef}
              class="upload-hidden-input"
              type="file"
              accept=".xlsx,.xlsm"
              onChange=${processarUpload}
            />
            <div class="d-grid gap-2">
              <button
                type="button"
                class="btn btn-outline-secondary"
                disabled=${processando}
                onClick=${() => inputRef.current?.click()}
              >
                ${processando ? 'Processando arquivo...' : 'Selecionar arquivo'}
              </button>
            </div>
            <span class="upload-file-name">
              ${resposta?.filename
                ? `Arquivo selecionado: ${resposta.filename}`
                : 'Nenhum arquivo selecionado.'}
            </span>
            <div class=${`${resposta?.statusClass || 'text-muted'} mt-2`}>
              ${resposta?.statusText || 'Nenhum arquivo enviado ainda.'}
            </div>
            ${resposta?.validation?.completedTasks?.length
              ? html`
                  <div class="small text-muted mt-3">
                    ${resposta.validation.completedTasks.map(
                      (item, indice) => html`<div key=${indice}>${item}</div>`,
                    )}
                  </div>
                `
              : null}
            <div class="small text-muted mt-2">
              Formatos aceitos: .xlsx e .xlsm
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

// Tela de gestao dos processos seletivos com modais em React.
function TelaProcessos({ controlador }) {
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [processos, setProcessos] = useState([]);
  const [candidatos, setCandidatos] = useState([]);
  const [filtros, setFiltros] = useState({
    vaga: '',
    operacao: '',
    notaCorte: '',
    status: '',
  });
  const [blocos, setBlocos] = useState({
    abertos: true,
    encerrados: false,
    candidatos: false,
  });
  const [detalhes, setDetalhes] = useState({ idProcesso: '', pagina: 1 });
  const [edicao, setEdicao] = useState(null);
  const [processoParaEncerrar, setProcessoParaEncerrar] = useState('');

  const carregar = async () => {
    setCarregando(true);
    setErro('');

    try {
      // Carrega os blocos de dados separadamente para a tela nao ficar vazia
      // quando apenas uma das consultas falhar temporariamente.
      const [resultadoProcessos, resultadoCandidatos] =
        await Promise.allSettled([
          lerProcessos(true),
          lerCandidatosProcessos(true),
        ]);

      const mensagensErro = [];

      if (resultadoProcessos.status === 'fulfilled') {
        setProcessos(
          Array.isArray(resultadoProcessos.value)
            ? resultadoProcessos.value
            : [],
        );
      } else {
        setProcessos([]);
        mensagensErro.push(
          resultadoProcessos.reason?.message ||
            'Nao foi possivel carregar os processos seletivos.',
        );
      }

      if (resultadoCandidatos.status === 'fulfilled') {
        setCandidatos(
          Array.isArray(resultadoCandidatos.value)
            ? resultadoCandidatos.value
            : [],
        );
      } else {
        setCandidatos([]);
        mensagensErro.push(
          resultadoCandidatos.reason?.message ||
            'Nao foi possivel carregar os candidatos vinculados aos processos.',
        );
      }

      if (mensagensErro.length) {
        setErro(mensagensErro.join(' '));
      }
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregar();
  }, []);

  const processosAbertos = useMemo(() => {
    return processos
      .filter(
        (processo) => String(processo.status || '').trim() !== 'Encerrado',
      )
      .filter((processo) => {
        const vaga = String(processo.vaga || '').toLowerCase();
        const operacao = String(processo.operacao || '').toLowerCase();
        const usaNota = Number(processo.usa_nota_corte || 0) ? 'sim' : 'nao';
        const status = String(processo.status || '').toLowerCase();

        const matchVaga =
          !filtros.vaga || vaga.includes(filtros.vaga.toLowerCase());
        const matchOperacao =
          !filtros.operacao ||
          operacao.includes(filtros.operacao.toLowerCase());
        const matchNota = !filtros.notaCorte || usaNota === filtros.notaCorte;
        const matchStatus =
          !filtros.status || status.includes(filtros.status.toLowerCase());

        return matchVaga && matchOperacao && matchNota && matchStatus;
      });
  }, [filtros, processos]);

  const processosEncerrados = useMemo(
    () =>
      processos.filter(
        (processo) => String(processo.status || '').trim() === 'Encerrado',
      ),
    [processos],
  );

  const candidatosEmAnalise = useMemo(
    () =>
      candidatos.filter(
        (candidato) =>
          String(candidato.status_candidato || '').trim() === 'Em análise',
      ),
    [candidatos],
  );

  const detalhesProcesso = useMemo(() => {
    if (!detalhes.idProcesso) return null;

    const processo = processos.find(
      (item) =>
        String(item.id_processo || '').trim() ===
        String(detalhes.idProcesso || '').trim(),
    );

    const candidatosDoProcesso = candidatos.filter(
      (item) =>
        String(item.id_processo || '').trim() ===
        String(detalhes.idProcesso || '').trim(),
    );

    const paginado = obterItensPaginados(
      candidatosDoProcesso,
      detalhes.pagina,
      TAMANHO_DETALHE_PROCESSO,
    );

    return {
      processo,
      candidatos: candidatosDoProcesso,
      paginado,
      resumo: {
        total: candidatosDoProcesso.length,
        aprovados: candidatosDoProcesso.filter(
          (item) => String(item.status_candidato || '').trim() === 'Aprovado',
        ).length,
        eliminados: candidatosDoProcesso.filter(
          (item) => String(item.status_candidato || '').trim() === 'Eliminado',
        ).length,
        banco: candidatosDoProcesso.filter(
          (item) =>
            String(item.status_candidato || '').trim() === 'Banco de talentos',
        ).length,
        analise: candidatosDoProcesso.filter(
          (item) => String(item.status_candidato || '').trim() === 'Em análise',
        ).length,
      },
    };
  }, [candidatos, detalhes, processos]);

  const atualizarStatus = async (registro, statusCandidato, idProcesso) => {
    const processo = processos.find(
      (item) =>
        String(item.id_processo || '').trim() === String(idProcesso).trim(),
    );

    if (
      statusCandidato === 'Aprovado' &&
      Number(processo?.quantidade_vagas || 0) === 1
    ) {
      const confirmar = window.confirm(
        'Este processo possui apenas 1 vaga. Ao aprovar o candidato, o processo pode ser encerrado automaticamente. Deseja continuar?',
      );
      if (!confirmar) return;
    }

    await atualizarStatusCandidato(registro, {
      status_candidato: statusCandidato,
      data_movimentacao: new Date().toISOString(),
    });

    await carregar();

    if (detalhes.idProcesso) {
      setDetalhes((anterior) => ({ ...anterior, idProcesso }));
    }
  };

  const salvarEdicao = async () => {
    if (
      !edicao?.id_processo ||
      !edicao.quantidade_vagas ||
      !edicao.data_encerramento
    ) {
      setErro('Preencha os campos obrigatorios para editar o processo.');
      return;
    }

    await atualizarProcesso(edicao.id_processo, {
      quantidade_vagas: Number(edicao.quantidade_vagas),
      data_encerramento: edicao.data_encerramento,
      operacao: edicao.operacao || '',
      trilha: edicao.trilha || '',
      usa_nota_corte: Number(edicao.usa_nota_corte || 0),
      nota_corte:
        edicao.nota_corte !== '' && edicao.nota_corte !== null
          ? Number(edicao.nota_corte)
          : null,
      status: edicao.status || 'Aberto',
    });

    setEdicao(null);
    await carregar();
  };

  const confirmarEncerramento = async () => {
    if (!processoParaEncerrar) return;
    await encerrarProcesso(processoParaEncerrar);
    setProcessoParaEncerrar('');
    await carregar();
  };

  return html`
    <${PainelRh}
      screenId="screen-processes"
      navAtiva="screen-processes"
      subtituloMarca="Processos seletivos"
      placeholderBusca="Gerenciar processos seletivos"
      controlador=${controlador}
      acaoPrimaria=${{
        label: 'Iniciar processo',
        onClick: () => controlador.irParaTelaProtegida('screen-process-create'),
      }}
      acoesTopo=${html`
        <button
          type="button"
          class="btn btn-outline-secondary rh-modern-secondary-btn"
          onClick=${() => controlador.sair()}
        >
          Sair
        </button>
      `}
    >
      <section class="rh-modern-pagehead rh-modern-pagehead-history">
        <div>
          <p class="rh-modern-kicker">Console • Processos seletivos</p>
          <h2 class="rh-modern-title">Gerenciar processos</h2>
          <p class="rh-modern-description">
            Acompanhe vagas, candidatos e status do processo em um so lugar.
          </p>
        </div>
      </section>

      ${erro ? html`<div class="rh-inline-alert">${erro}</div>` : null}

      <section class="rh-modern-table-card mb-4">
        <div
          class="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2"
        >
          <button
            type="button"
            class="btn btn-link text-decoration-none p-0 d-flex align-items-center gap-2"
            onClick=${() => setBlocos({ ...blocos, abertos: !blocos.abertos })}
          >
            <span class="material-symbols-outlined">
              ${blocos.abertos ? 'expand_less' : 'expand_more'}
            </span>
            <h3 class="h5 mb-0">Processos abertos</h3>
          </button>
        </div>

        ${blocos.abertos
          ? html`
              <div class="row g-3 mb-3">
                <div class="col-md-3">
                  <label class="form-label">Vaga</label>
                  <input
                    class="form-control"
                    value=${filtros.vaga}
                    placeholder="Filtrar por vaga"
                    onInput=${(event) =>
                      setFiltros({ ...filtros, vaga: event.target.value })}
                  />
                </div>
                <div class="col-md-3">
                  <label class="form-label">Operacao</label>
                  <input
                    class="form-control"
                    value=${filtros.operacao}
                    placeholder="Filtrar por operacao"
                    onInput=${(event) =>
                      setFiltros({ ...filtros, operacao: event.target.value })}
                  />
                </div>
                <div class="col-md-3">
                  <label class="form-label">Nota de corte</label>
                  <select
                    class="form-select"
                    value=${filtros.notaCorte}
                    onChange=${(event) =>
                      setFiltros({ ...filtros, notaCorte: event.target.value })}
                  >
                    <option value="">Todos</option>
                    <option value="sim">Sim</option>
                    <option value="nao">Nao</option>
                  </select>
                </div>
                <div class="col-md-3">
                  <label class="form-label">Status</label>
                  <select
                    class="form-select"
                    value=${filtros.status}
                    onChange=${(event) =>
                      setFiltros({ ...filtros, status: event.target.value })}
                  >
                    <option value="">Todos</option>
                    <option value="aberto">Aberto</option>
                    <option value="encerrado">Encerrado</option>
                  </select>
                </div>
              </div>

              <div class="table-responsive">
                <table
                  class="table align-middle history-table rh-modern-history-table"
                >
                  <thead>
                    <tr>
                      <th>Processo</th>
                      <th>Vaga</th>
                      <th>Operacao</th>
                      <th>Trilha</th>
                      <th>Nota de corte</th>
                      <th>Valor corte</th>
                      <th>Vagas</th>
                      <th>Encerramento</th>
                      <th>Status</th>
                      <th class="text-end">Acoes</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${carregando
                      ? html`<tr>
                          <td colspan="10" class="text-center text-muted py-4">
                            Carregando processos...
                          </td>
                        </tr>`
                      : processosAbertos.length
                        ? processosAbertos.map(
                            (processo) => html`
                              <tr key=${processo.id_processo}>
                                <td>${processo.id_processo || '-'}</td>
                                <td>${processo.vaga || '-'}</td>
                                <td>${processo.operacao || '-'}</td>
                                <td>${processo.trilha || '-'}</td>
                                <td>
                                  ${Number(processo.usa_nota_corte || 0)
                                    ? 'Sim'
                                    : 'Nao'}
                                </td>
                                <td>${processo.nota_corte || '-'}</td>
                                <td>
                                  ${`${processo.vagas_preenchidas || 0}/${processo.quantidade_vagas || 0}`}
                                </td>
                                <td>${processo.data_encerramento || '-'}</td>
                                <td>
                                  <span class="rh-status-pill is-finished"
                                    >${processo.status || '-'}</span
                                  >
                                </td>
                                <td class="text-end">
                                  <div
                                    class="d-flex justify-content-end gap-2 flex-wrap"
                                  >
                                    <button
                                      type="button"
                                      class="btn btn-sm btn-outline-secondary"
                                      onClick=${() =>
                                        setEdicao({
                                          ...processo,
                                          data_encerramento:
                                            formatarDataParaInput(
                                              processo.data_encerramento,
                                            ),
                                        })}
                                    >
                                      Editar
                                    </button>
                                    <button
                                      type="button"
                                      class="btn btn-sm btn-outline-primary"
                                      onClick=${() => {
                                        sessionStorage.setItem(
                                          'rh_processo_detalhe_atual',
                                          String(
                                            processo.id_processo || '',
                                          ).trim(),
                                        );
                                        controlador.irParaTelaProtegida(
                                          'screen-process-details',
                                        );
                                      }}
                                    >
                                      Detalhes
                                    </button>
                                    <button
                                      type="button"
                                      class="btn btn-sm btn-outline-danger"
                                      onClick=${() =>
                                        setProcessoParaEncerrar(
                                          processo.id_processo,
                                        )}
                                    >
                                      Encerrar
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            `,
                          )
                        : html`<tr>
                            <td
                              colspan="10"
                              class="text-center text-muted py-4"
                            >
                              Nenhum processo aberto encontrado.
                            </td>
                          </tr>`}
                  </tbody>
                </table>
              </div>
            `
          : null}
      </section>

      <section class="rh-modern-table-card mb-4">
        <div
          class="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2"
        >
          <button
            type="button"
            class="btn btn-link text-decoration-none p-0 d-flex align-items-center gap-2"
            onClick=${() =>
              setBlocos({ ...blocos, encerrados: !blocos.encerrados })}
          >
            <span class="material-symbols-outlined">
              ${blocos.encerrados ? 'expand_less' : 'expand_more'}
            </span>
            <h3 class="h5 mb-0">Processos encerrados</h3>
          </button>
        </div>

        ${blocos.encerrados
          ? html`
              <div class="table-responsive">
                <table
                  class="table align-middle history-table rh-modern-history-table"
                >
                  <thead>
                    <tr>
                      <th>Processo</th>
                      <th>Vaga</th>
                      <th>Operacao</th>
                      <th>Trilha</th>
                      <th>Nota de corte</th>
                      <th>Valor corte</th>
                      <th>Vagas</th>
                      <th>Encerramento</th>
                      <th>Status</th>
                      <th class="text-end">Acoes</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${processosEncerrados.length
                      ? processosEncerrados.map(
                          (processo) => html`
                            <tr key=${processo.id_processo}>
                              <td>${processo.id_processo || '-'}</td>
                              <td>${processo.vaga || '-'}</td>
                              <td>${processo.operacao || '-'}</td>
                              <td>${processo.trilha || '-'}</td>
                              <td>
                                ${Number(processo.usa_nota_corte || 0)
                                  ? 'Sim'
                                  : 'Nao'}
                              </td>
                              <td>${processo.nota_corte || '-'}</td>
                              <td>
                                ${`${processo.vagas_preenchidas || 0}/${processo.quantidade_vagas || 0}`}
                              </td>
                              <td>${processo.data_encerramento || '-'}</td>
                              <td>
                                <span class="rh-status-pill is-unsaved"
                                  >${processo.status || '-'}</span
                                >
                              </td>
                              <td class="text-end">
                                <button
                                  type="button"
                                  class="btn btn-sm btn-outline-primary"
                                  onClick=${() => {
                                    sessionStorage.setItem(
                                      'rh_processo_detalhe_atual',
                                      String(processo.id_processo || '').trim(),
                                    );
                                    controlador.irParaTelaProtegida(
                                      'screen-process-details',
                                    );
                                  }}
                                >
                                  Detalhes
                                </button>
                              </td>
                            </tr>
                          `,
                        )
                      : html`<tr>
                          <td colspan="10" class="text-center text-muted py-4">
                            Nenhum processo encerrado.
                          </td>
                        </tr>`}
                  </tbody>
                </table>
              </div>
            `
          : null}
      </section>

      <section class="rh-modern-table-card">
        <div
          class="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2"
        >
          <button
            type="button"
            class="btn btn-link text-decoration-none p-0 d-flex align-items-center gap-2"
            onClick=${() =>
              setBlocos({ ...blocos, candidatos: !blocos.candidatos })}
          >
            <span class="material-symbols-outlined">
              ${blocos.candidatos ? 'expand_less' : 'expand_more'}
            </span>
            <h3 class="h5 mb-0">Candidatos por processo</h3>
          </button>
        </div>

        ${blocos.candidatos
          ? html`
              <div class="table-responsive">
                <table
                  class="table align-middle history-table rh-modern-history-table"
                >
                  <thead>
                    <tr>
                      <th>Processo</th>
                      <th>Candidato</th>
                      <th>Vaga</th>
                      <th>Nota</th>
                      <th>Status</th>
                      <th class="text-end">Acoes</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${candidatosEmAnalise.length
                      ? candidatosEmAnalise.map(
                          (candidato) => html`
                            <tr key=${candidato.id_registro}>
                              <td>${candidato.id_processo || '-'}</td>
                              <td>${candidato.nome_candidato || '-'}</td>
                              <td>${candidato.vaga || '-'}</td>
                              <td>${candidato.pontuacao_final || '-'}</td>
                              <td>${candidato.status_candidato || '-'}</td>
                              <td class="text-end">
                                <div
                                  class="d-flex justify-content-end gap-2 flex-wrap"
                                >
                                  <button
                                    type="button"
                                    class="btn btn-sm btn-outline-success"
                                    onClick=${() =>
                                      atualizarStatus(
                                        candidato.id_registro,
                                        'Aprovado',
                                        candidato.id_processo,
                                      )}
                                  >
                                    Aprovar
                                  </button>
                                  <button
                                    type="button"
                                    class="btn btn-sm btn-outline-danger"
                                    onClick=${() =>
                                      atualizarStatus(
                                        candidato.id_registro,
                                        'Eliminado',
                                        candidato.id_processo,
                                      )}
                                  >
                                    Eliminar
                                  </button>
                                  <button
                                    type="button"
                                    class="btn btn-sm btn-outline-secondary"
                                    onClick=${() =>
                                      atualizarStatus(
                                        candidato.id_registro,
                                        'Banco de talentos',
                                        candidato.id_processo,
                                      )}
                                  >
                                    Banco de talentos
                                  </button>
                                </div>
                              </td>
                            </tr>
                          `,
                        )
                      : html`<tr>
                          <td colspan="6" class="text-center text-muted py-4">
                            Nenhum candidato em analise vinculado a processo.
                          </td>
                        </tr>`}
                  </tbody>
                </table>
              </div>
            `
          : null}
      </section>

      <${ModalPadrao}
        aberto=${!!detalhesProcesso}
        titulo=${`Detalhes do processo • ${detalhesProcesso?.processo?.id_processo || ''}`}
        subtitulo="Gerencie os candidatos vinculados a este processo."
        onClose=${() => setDetalhes({ idProcesso: '', pagina: 1 })}
      >
        ${detalhesProcesso
          ? html`
              <div class="rh-details-body">
                <div class="process-summary-grid">
                  <div class="process-summary-card">
                    <span class="process-summary-label">Total</span>
                    <span class="process-summary-value"
                      >${detalhesProcesso.resumo.total}</span
                    >
                  </div>
                  <div class="process-summary-card is-approved">
                    <span class="process-summary-label">Aprovados</span>
                    <span class="process-summary-value"
                      >${detalhesProcesso.resumo.aprovados}</span
                    >
                  </div>
                  <div class="process-summary-card is-eliminated">
                    <span class="process-summary-label">Eliminados</span>
                    <span class="process-summary-value"
                      >${detalhesProcesso.resumo.eliminados}</span
                    >
                  </div>
                  <div class="process-summary-card is-talent">
                    <span class="process-summary-label">Banco de talentos</span>
                    <span class="process-summary-value"
                      >${detalhesProcesso.resumo.banco}</span
                    >
                  </div>
                  <div class="process-summary-card is-analysis">
                    <span class="process-summary-label">Em analise</span>
                    <span class="process-summary-value"
                      >${detalhesProcesso.resumo.analise}</span
                    >
                  </div>
                </div>

                ${detalhesProcesso.candidatos.length
                  ? html`
                      <div class="table-responsive mt-4">
                        <table
                          class="table align-middle history-table rh-modern-history-table"
                        >
                          <thead>
                            <tr>
                              <th>Candidato</th>
                              <th>Vaga</th>
                              <th>Nota</th>
                              <th>Status</th>
                              <th class="text-end">Acoes</th>
                            </tr>
                          </thead>
                          <tbody>
                            ${detalhesProcesso.paginado.itens.map(
                              (candidato) => html`
                                <tr key=${candidato.id_registro}>
                                  <td>${candidato.nome_candidato || '-'}</td>
                                  <td>${candidato.vaga || '-'}</td>
                                  <td>${candidato.pontuacao_final || '-'}</td>
                                  <td>
                                    <span
                                      class=${`process-candidate-status-badge ${obterClasseStatusProcesso(candidato.status_candidato)}`}
                                    >
                                      ${candidato.status_candidato || '-'}
                                    </span>
                                  </td>
                                  <td class="text-end">
                                    <div class="process-action-stack">
                                      <button
                                        type="button"
                                        class="btn btn-sm btn-outline-success process-action-btn"
                                        onClick=${() =>
                                          atualizarStatus(
                                            candidato.id_registro,
                                            'Aprovado',
                                            candidato.id_processo,
                                          )}
                                      >
                                        Aprovado
                                      </button>
                                      <button
                                        type="button"
                                        class="btn btn-sm btn-outline-danger process-action-btn"
                                        onClick=${() =>
                                          atualizarStatus(
                                            candidato.id_registro,
                                            'Eliminado',
                                            candidato.id_processo,
                                          )}
                                      >
                                        Eliminado
                                      </button>
                                      <button
                                        type="button"
                                        class="btn btn-sm btn-outline-secondary process-action-btn"
                                        onClick=${() =>
                                          atualizarStatus(
                                            candidato.id_registro,
                                            'Banco de talentos',
                                            candidato.id_processo,
                                          )}
                                      >
                                        Banco de talentos
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              `,
                            )}
                          </tbody>
                        </table>
                      </div>

                      <${GrupoPaginacao}
                        paginaAtual=${detalhesProcesso.paginado.paginaAtual}
                        totalPaginas=${detalhesProcesso.paginado.totalPaginas}
                        onChange=${(pagina) =>
                          setDetalhes((anterior) => ({ ...anterior, pagina }))}
                      />
                    `
                  : html`
                      <div class="alert alert-secondary mb-0 mt-4">
                        Nao ha candidatos vinculados a este processo.
                      </div>
                    `}
              </div>
            `
          : null}
      <//>

      <${ModalPadrao}
        aberto=${!!edicao}
        titulo="Editar processo"
        subtitulo="Altere as informacoes do processo seletivo."
        onClose=${() => setEdicao(null)}
      >
        ${edicao
          ? html`
              <div class="rh-details-body">
                <div class="row g-3">
                  <div class="col-md-6">
                    <label class="form-label">Vaga</label>
                    <input
                      class="form-control"
                      readonly
                      value=${edicao.vaga || ''}
                    />
                  </div>
                  <div class="col-md-3">
                    <label class="form-label">Quantidade de vagas</label>
                    <input
                      class="form-control"
                      type="number"
                      min="1"
                      value=${edicao.quantidade_vagas || 0}
                      onInput=${(event) =>
                        setEdicao({
                          ...edicao,
                          quantidade_vagas: event.target.value,
                        })}
                    />
                  </div>
                  <div class="col-md-3">
                    <label class="form-label">Data de encerramento</label>
                    <input
                      class="form-control"
                      type="date"
                      value=${edicao.data_encerramento || ''}
                      onInput=${(event) =>
                        setEdicao({
                          ...edicao,
                          data_encerramento: event.target.value,
                        })}
                    />
                  </div>
                  <div class="col-md-6">
                    <label class="form-label">Operacao</label>
                    <input
                      class="form-control"
                      value=${edicao.operacao || ''}
                      onInput=${(event) =>
                        setEdicao({ ...edicao, operacao: event.target.value })}
                    />
                  </div>
                  <div class="col-md-6">
                    <label class="form-label">Trilha</label>
                    <input
                      class="form-control"
                      value=${edicao.trilha || ''}
                      onInput=${(event) =>
                        setEdicao({ ...edicao, trilha: event.target.value })}
                    />
                  </div>
                </div>
              </div>
              <div class="rh-details-footer">
                <div class="rh-details-footer-actions">
                  <button
                    type="button"
                    class="btn btn-outline-secondary"
                    onClick=${() => setEdicao(null)}
                  >
                    Cancelar
                  </button>
                </div>
                <button
                  type="button"
                  class="btn btn-primary"
                  onClick=${salvarEdicao}
                >
                  Salvar alteracoes
                </button>
              </div>
            `
          : null}
      <//>

      <${ModalPadrao}
        aberto=${!!processoParaEncerrar}
        titulo="Encerrar processo"
        subtitulo="Essa acao move o processo para a lista de encerrados."
        onClose=${() => setProcessoParaEncerrar('')}
        className="rh-confirm-dialog"
      >
        <div class="rh-details-body">
          <div class="alert alert-warning mb-0">
            Deseja realmente encerrar o processo ${processoParaEncerrar || ''}?
          </div>
        </div>
        <div class="rh-details-footer">
          <div class="rh-details-footer-actions">
            <button
              type="button"
              class="btn btn-outline-secondary"
              onClick=${() => setProcessoParaEncerrar('')}
            >
              Cancelar
            </button>
          </div>
          <button
            type="button"
            class="btn btn-danger"
            onClick=${confirmarEncerramento}
          >
            Encerrar processo
          </button>
        </div>
      <//>
    <//>
  `;
}

function TelaDetalhesProcesso({ controlador }) {
  const [carregando, setCarregando] = useState(true);
  const [resultadoAnaliseSelecionado, setResultadoAnaliseSelecionado] =
    useState(null);
  const [erro, setErro] = useState('');
  const [processo, setProcesso] = useState(null);
  const [resumo, setResumo] = useState(null);
  const [candidatos, setCandidatos] = useState([]);
  const [preAnalises, setPreAnalises] = useState([]);
  const [paginaPreAnalises, setPaginaPreAnalises] = useState(1);
  const [totalPaginasPreAnalises, setTotalPaginasPreAnalises] = useState(1);
  const [arquivoCv, setArquivoCv] = useState(null);
  const [guardarCvOriginal, setGuardarCvOriginal] = useState(false);
  const [analisandoCv, setAnalisandoCv] = useState(false);
  const [preAnaliseSelecionada, setPreAnaliseSelecionada] = useState(null);
  const [visualizacaoCv, setVisualizacaoCv] = useState(null);

  const idProcesso = sessionStorage.getItem('rh_processo_detalhe_atual') || '';

  const carregar = async (pagina = 1) => {
    if (!idProcesso) {
      setErro('Processo não identificado.');
      setCarregando(false);
      return;
    }

    setCarregando(true);
    setErro('');

    try {
      const [detalhe, listaPreAnalises] = await Promise.all([
        lerDetalheProcesso(idProcesso),
        lerPreAnalisesCv(idProcesso, pagina, 5),
      ]);

      setProcesso(detalhe?.processo || null);
      setResumo(detalhe?.resumo || null);
      setCandidatos(
        (Array.isArray(detalhe?.candidatos) ? detalhe.candidatos : []).filter(
          (item) => String(item?.status_candidato || '').trim() !== 'Eliminado',
        ),
      );
      setPreAnalises(
        Array.isArray(listaPreAnalises?.items) ? listaPreAnalises.items : [],
      );
      setPaginaPreAnalises(Number(listaPreAnalises?.page || 1));
      setTotalPaginasPreAnalises(Number(listaPreAnalises?.total_pages || 1));
    } catch (error) {
      setErro(
        error.message || 'Não foi possível carregar o detalhe do processo.',
      );
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregar(1);
  }, []);

  const atualizarStatus = async (idRegistro, status) => {
    const statusSeguro = String(status || '').trim();

    if (statusSeguro === 'Eliminado') {
      const confirmar = window.confirm(
        'Deseja realmente eliminar este candidato? Após confirmar, ele sairá da lista desta tela.',
      );
      if (!confirmar) return;
    }

    try {
      await atualizarStatusCandidato(idRegistro, {
        status_candidato: statusSeguro,
      });
      await carregar(paginaPreAnalises);
    } catch (error) {
      alert(error.message || 'Não foi possível atualizar o status.');
    }
  };

  const enviarCv = async () => {
    if (!arquivoCv) {
      alert('Selecione um CV antes de analisar.');
      return;
    }

    try {
      setAnalisandoCv(true);

      const formData = new FormData();
      formData.append('arquivo', arquivoCv);
      formData.append('guardar_cv_original', guardarCvOriginal ? '1' : '0');

      await analisarCvProcesso(idProcesso, formData);
      setArquivoCv(null);
      await carregar(1);
    } catch (error) {
      alert(error.message || 'Não foi possível analisar o CV.');
    } finally {
      setAnalisandoCv(false);
    }
  };

  const salvarEdicao = async () => {
    if (!preAnaliseSelecionada) return;

    try {
      await atualizarPreAnaliseCv(preAnaliseSelecionada.id_pre_analise, {
        nome_candidato: preAnaliseSelecionada.nome_candidato,
        email: preAnaliseSelecionada.email,
        telefone: preAnaliseSelecionada.telefone,
        whatsapp: preAnaliseSelecionada.whatsapp,
      });

      setPreAnaliseSelecionada(null);
      await carregar(paginaPreAnalises);
    } catch (error) {
      alert(error.message || 'Não foi possível salvar a edição.');
    }
  };

  const excluirPreAnalise = async (idPreAnalise) => {
    if (!window.confirm('Deseja excluir esta pré-análise?')) return;

    try {
      await excluirPreAnaliseCv(idPreAnalise);
      await carregar(paginaPreAnalises);
    } catch (error) {
      alert(error.message || 'Não foi possível excluir a pré-análise.');
    }
  };

  const incluirNoProcesso = async (idPreAnalise) => {
    try {
      await adicionarPreAnaliseAoProcesso(idPreAnalise);
      await carregar(paginaPreAnalises);
    } catch (error) {
      alert(error.message || 'Não foi possível adicionar ao processo.');
    }
  };

  if (carregando) {
    return html`
      <${PainelRh}
        screenId="screen-process-details"
        navAtiva="screen-processes"
        subtituloMarca="Detalhes do processo"
        placeholderBusca="Detalhes do processo"
        controlador=${controlador}
        acaoPrimaria=${{
          label: 'Gerenciar processos',
          onClick: () => controlador.irParaTelaProtegida('screen-processes'),
        }}
        acoesTopo=${html`
          <button
            type="button"
            class="btn btn-outline-secondary rh-modern-secondary-btn"
            onClick=${() => controlador.sair()}
          >
            Sair
          </button>
        `}
      >
        <div class="alert alert-info">Carregando detalhes do processo...</div>
      <//>
    `;
  }

  return html`
  <${PainelRh}
    screenId="screen-process-details"
    navAtiva="screen-processes"
    subtituloMarca="Detalhes do processo"
    placeholderBusca="Detalhes do processo"
    controlador=${controlador}
    acaoPrimaria=${{
      label: 'Gerenciar processos',
      onClick: () => controlador.irParaTelaProtegida('screen-processes'),
    }}
    acoesTopo=${html`
      <button
        type="button"
        class="btn btn-outline-secondary rh-modern-secondary-btn"
        onClick=${() => controlador.sair()}
      >
        Sair
      </button>
    `}
  >
    <section class="rh-modern-pagehead rh-modern-pagehead-history">
      <div>
        <p class="rh-modern-kicker">Console • Processo seletivo</p>
        <h2 class="rh-modern-title">Detalhes do Processo</h2>
        <p class="rh-modern-description">
          Consulte o processo, a lista de candidatos e a pré-análise de CV.
        </p>
      </div>
    </section>

    ${erro ? html`<div class="alert alert-danger">${erro}</div>` : null}

    <section class="rh-modern-table-card p-4 mb-4">
      <div class="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
        <div>
          <h2 class="mb-1">Detalhes do Processo</h2>
          <div class="text-muted">
            ${processo?.id_processo || '-'} • ${processo?.vaga || '-'}
          </div>
        </div>
        <button
          type="button"
          class="btn btn-outline-secondary"
          onClick=${() => controlador.irParaTelaProtegida('screen-processes')}
        >
          Voltar
        </button>
      </div>

      ${erro ? html`<div class="alert alert-danger">${erro}</div>` : null}

      <div class="row g-3 mb-4">
        <div class="col-md-4"><div class="process-summary-card"><span class="process-summary-label">Nome</span><span class="process-summary-value process-summary-value-text">${processo?.nome_processo || '-'}</span></div></div>
        <div class="col-md-4"><div class="process-summary-card"><span class="process-summary-label">Vaga</span><span class="process-summary-value process-summary-value-text">${processo?.vaga || '-'}</span></div></div>
        <div class="col-md-4"><div class="process-summary-card"><span class="process-summary-label">Operação</span><span class="process-summary-value process-summary-value-text">${processo?.operacao || '-'}</span></div></div>
        <div class="col-md-4"><div class="process-summary-card"><span class="process-summary-label">Trilha</span><span class="process-summary-value process-summary-value-text">${processo?.trilha || '-'}</span></div></div>
        <div class="col-md-4"><div class="process-summary-card"><span class="process-summary-label">Nota de corte</span><span class="process-summary-value process-summary-value-text">${Number(processo?.usa_nota_corte || 0) ? processo?.nota_corte || '-' : 'Não'}</span></div></div>
        <div class="col-md-4"><div class="process-summary-card"><span class="process-summary-label">Vagas</span><span class="process-summary-value">${processo?.quantidade_vagas || 0}</span></div></div>
        <div class="col-md-4"><div class="process-summary-card"><span class="process-summary-label">Encerramento</span><span class="process-summary-value process-summary-value-text">${processo?.data_encerramento || '-'}</span></div></div>
      </div>

      <div class="process-summary-grid mb-4">
        <div class="process-summary-card"><span class="process-summary-label">Total</span><span class="process-summary-value">${resumo?.total || 0}</span></div>
        <div class="process-summary-card is-approved"><span class="process-summary-label">Aprovados</span><span class="process-summary-value">${resumo?.aprovados || 0}</span></div>
        <div class="process-summary-card is-eliminated"><span class="process-summary-label">Eliminados</span><span class="process-summary-value">${resumo?.eliminados || 0}</span></div>
        <div class="process-summary-card is-talent"><span class="process-summary-label">Banco de talentos</span><span class="process-summary-value">${resumo?.banco || 0}</span></div>
        <div class="process-summary-card is-analysis"><span class="process-summary-label">Em análise</span><span class="process-summary-value">${resumo?.analise || 0}</span></div>
      </div>

      <div class="rh-modern-table-card p-4 mb-4">
        <div class="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
          <h4 class="mb-0">Pré-análise de CV</h4>
        </div>

        <div class="row g-3 align-items-end">
          <div class="col-md-6">
            <label class="form-label">Adicionar CV</label>
            <input
              type="file"
              class="form-control"
              accept=".pdf,.doc,.docx,.txt"
              onChange=${(event) => setArquivoCv(event.target.files?.[0] || null)}
            />
          </div>
          <div class="col-md-3">
            <div class="form-check mt-4">
              <input
                class="form-check-input"
                type="checkbox"
                id="guardarCvOriginal"
                checked=${guardarCvOriginal}
                onChange=${(event) => setGuardarCvOriginal(!!event.target.checked)}
              />
              <label class="form-check-label" for="guardarCvOriginal">
                Guardar CV original no banco
              </label>
            </div>
          </div>
          <div class="col-md-3">
            <button
              type="button"
              class="btn btn-primary w-100"
              onClick=${enviarCv}
              disabled=${analisandoCv}
            >
              ${analisandoCv ? 'Analisando...' : 'Analisar CV'}
            </button>
          </div>
        </div>

        <div class="table-responsive mt-4">
          <table class="table align-middle rh-modern-history-table">
            <thead>
              <tr>
                <th>Nome</th>
                <th>E-mail</th>
                <th>Telefone</th>
                <th>Classificação</th>
                <th>Score</th>
                <th class="text-end">Ações</th>
              </tr>
            </thead>
            <tbody>
              ${
                preAnalises.length
                  ? preAnalises.map(
                      (item) => html`
                        <tr key=${item.id_pre_analise}>
                          <td>${item.nome_candidato || '-'}</td>
                          <td>${item.email || '-'}</td>
                          <td>${item.telefone || item.whatsapp || '-'}</td>
                          <td>
                            <span
                              class=${`cv-classification-badge ${item.classificacao_slug || ''}`}
                              >${item.classificacao || '-'}</span
                            >
                          </td>
                          <td>${item.score_final ?? '-'}</td>
                          <td class="text-end">
                            <div
                              class="d-flex justify-content-end gap-2 flex-wrap"
                            >
                              <button
                                type="button"
                                class="btn btn-sm btn-outline-secondary"
                                onClick=${() =>
                                  setPreAnaliseSelecionada({ ...item })}
                              >
                                Editar
                              </button>
                              <button
                                type="button"
                                class="btn btn-sm btn-outline-dark"
                                onClick=${() =>
                                  setResultadoAnaliseSelecionado(item)}
                              >
                                Resultado da Análise
                              </button>
                              <button
                                type="button"
                                class="btn btn-sm btn-outline-info"
                                onClick=${() => setVisualizacaoCv(item)}
                              >
                                Ver CV
                              </button>
                              ${Number(item.ja_adicionado_ao_processo || 0) !==
                              1
                                ? html`
                                    <button
                                      type="button"
                                      class="btn btn-sm btn-outline-success"
                                      onClick=${() =>
                                        incluirNoProcesso(item.id_pre_analise)}
                                    >
                                      Adicionar ao processo
                                    </button>
                                  `
                                : null}
                              <button
                                type="button"
                                class="btn btn-sm btn-outline-danger"
                                onClick=${() =>
                                  excluirPreAnalise(item.id_pre_analise)}
                              >
                                Excluir
                              </button>
                            </div>
                          </td>
                        </tr>
                      `,
                    )
                  : html`<tr>
                      <td colspan="6" class="text-center text-muted py-4">
                        Nenhuma pré-análise encontrada.
                      </td>
                    </tr>`
              }
            </tbody>
          </table>
        </div>

        <${GrupoPaginacao}
          paginaAtual=${paginaPreAnalises}
          totalPaginas=${totalPaginasPreAnalises}
          onChange=${(pagina) => carregar(pagina)}
        />
      </div>

      <div class="rh-modern-table-card p-4">
        <h4 class="mb-3">Candidatos no processo</h4>
        <div class="table-responsive">
          <table class="table align-middle rh-modern-history-table">
            <thead>
              <tr>
                <th>Candidato</th>
                <th>Vaga</th>
                <th>Nota</th>
                <th>Status</th>
                <th class="text-end">Ações</th>
              </tr>
            </thead>
            <tbody>
              ${
                candidatos.length
                  ? candidatos.map(
                      (candidato) => html`
                        <tr key=${candidato.id_registro}>
                          <td>${candidato.nome_candidato || '-'}</td>
                          <td>${candidato.vaga || '-'}</td>
                          <td>${candidato.pontuacao_final || '-'}</td>
                          <td>${candidato.status_candidato || '-'}</td>
                          <td class="text-end">
                            <div
                              class="d-flex justify-content-end gap-2 flex-wrap"
                            >
                              <button
                                type="button"
                                class="btn btn-sm btn-outline-success"
                                onClick=${() =>
                                  atualizarStatus(
                                    candidato.id_registro,
                                    'Aprovado',
                                  )}
                              >
                                Aprovar
                              </button>
                              <button
                                type="button"
                                class="btn btn-sm btn-outline-danger"
                                onClick=${() =>
                                  atualizarStatus(
                                    candidato.id_registro,
                                    'Eliminado',
                                  )}
                              >
                                Eliminar
                              </button>
                              <button
                                type="button"
                                class="btn btn-sm btn-outline-secondary"
                                onClick=${() =>
                                  atualizarStatus(
                                    candidato.id_registro,
                                    'Banco de talentos',
                                  )}
                              >
                                Banco de talentos
                              </button>
                            </div>
                          </td>
                        </tr>
                      `,
                    )
                  : html`<tr>
                      <td colspan="5" class="text-center text-muted py-4">
                        Nenhum candidato vinculado a este processo.
                      </td>
                    </tr>`
              }
            </tbody>
          </table>
        </div>
      </div>

      <${ModalPadrao}
        aberto=${!!preAnaliseSelecionada}
        titulo="Editar pré-cadastro"
        subtitulo="Ajuste as informações extraídas do CV antes de seguir."
        onClose=${() => setPreAnaliseSelecionada(null)}
      >
        ${
          preAnaliseSelecionada
            ? html`
                <div class="rh-details-body">
                  <div class="row g-3">
                    <div class="col-md-6">
                      <label class="form-label">Nome</label>
                      <input
                        class="form-control"
                        value=${preAnaliseSelecionada.nome_candidato || ''}
                        onInput=${(e) =>
                          setPreAnaliseSelecionada({
                            ...preAnaliseSelecionada,
                            nome_candidato: e.target.value,
                          })}
                      />
                    </div>
                    <div class="col-md-6">
                      <label class="form-label">E-mail</label>
                      <input
                        class="form-control"
                        value=${preAnaliseSelecionada.email || ''}
                        onInput=${(e) =>
                          setPreAnaliseSelecionada({
                            ...preAnaliseSelecionada,
                            email: e.target.value,
                          })}
                      />
                    </div>
                    <div class="col-md-6">
                      <label class="form-label">Telefone</label>
                      <input
                        class="form-control"
                        value=${preAnaliseSelecionada.telefone || ''}
                        onInput=${(e) =>
                          setPreAnaliseSelecionada({
                            ...preAnaliseSelecionada,
                            telefone: e.target.value,
                          })}
                      />
                    </div>
                    <div class="col-md-6">
                      <label class="form-label">WhatsApp</label>
                      <input
                        class="form-control"
                        value=${preAnaliseSelecionada.whatsapp || ''}
                        onInput=${(e) =>
                          setPreAnaliseSelecionada({
                            ...preAnaliseSelecionada,
                            whatsapp: e.target.value,
                          })}
                      />
                    </div>
                  </div>
                  <div class="d-flex justify-content-end gap-2 mt-4">
                    <button
                      type="button"
                      class="btn btn-outline-secondary"
                      onClick=${() => setPreAnaliseSelecionada(null)}
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      class="btn btn-primary"
                      onClick=${salvarEdicao}
                    >
                      Salvar
                    </button>
                  </div>
                </div>
              `
            : null
        }
      </${ModalPadrao}>

      <${ModalPadrao}
        aberto=${!!visualizacaoCv}
        titulo="Visualização do CV"
        subtitulo="Texto bruto extraído do currículo."
        onClose=${() => setVisualizacaoCv(null)}
        className="cv-preview-dialog"
      >
        ${
          visualizacaoCv
            ? html`
                <div class="rh-details-body">
                  <div class="cv-preview-box">
                    ${visualizacaoCv.texto_extraido || 'Sem conteúdo extraído.'}
                  </div>
                  ${visualizacaoCv.arquivo_original_base64
                    ? html`
                        <div class="mt-3 text-end">
                          <button
                            type="button"
                            class="btn btn-outline-primary"
                            onClick=${() => {
                              const link = document.createElement('a');
                              link.href = `data:${visualizacaoCv.mime_type || 'application/octet-stream'};base64,${visualizacaoCv.arquivo_original_base64}`;
                              link.download =
                                visualizacaoCv.nome_arquivo || 'cv';
                              link.click();
                            }}
                          >
                            Baixar original
                          </button>
                        </div>
                      `
                    : null}
                </div>
              `
            : null
        }
      </${ModalPadrao}>
      <${ModalPadrao}
  aberto=${!!resultadoAnaliseSelecionado}
  titulo="Resultado da Análise"
  subtitulo="Resumo analítico da classificação automática do CV."
  onClose=${() => setResultadoAnaliseSelecionado(null)}
>
  ${
    resultadoAnaliseSelecionado
      ? html`
          <div class="rh-details-body">
            <div class="row g-3 mb-3">
              <div class="col-md-4">
                <div class="process-summary-card">
                  <span class="process-summary-label">Score</span>
                  <span class="process-summary-value">
                    ${resultadoAnaliseSelecionado.score_final ?? '-'}
                  </span>
                </div>
              </div>
              <div class="col-md-8">
                <div class="process-summary-card">
                  <span class="process-summary-label">Classificação</span>
                  <span
                    class=${`cv-classification-badge ${resultadoAnaliseSelecionado.classificacao_slug || ''}`}
                  >
                    ${resultadoAnaliseSelecionado.classificacao || '-'}
                  </span>
                </div>
              </div>
            </div>

            <div class="process-summary-card mb-3">
              <span class="process-summary-label"
                >Palavras-chave identificadas</span
              >
              <div class="cv-preview-box">
                ${(() => {
                  try {
                    const palavras = JSON.parse(
                      resultadoAnaliseSelecionado.palavras_chave || '[]',
                    );
                    return Array.isArray(palavras) && palavras.length
                      ? palavras.join(', ')
                      : 'Nenhuma palavra-chave relevante foi identificada.';
                  } catch (e) {
                    return (
                      resultadoAnaliseSelecionado.palavras_chave ||
                      'Nenhuma palavra-chave relevante foi identificada.'
                    );
                  }
                })()}
              </div>
            </div>

            <div class="process-summary-card mb-3">
              <span class="process-summary-label"
                >Pontos observados pelo sistema</span
              >
              <div class="cv-preview-box">
                ${(() => {
                  try {
                    const problemas = JSON.parse(
                      resultadoAnaliseSelecionado.problemas || '[]',
                    );
                    return Array.isArray(problemas) && problemas.length
                      ? problemas.join('\n')
                      : 'Nenhum problema crítico foi apontado.';
                  } catch (e) {
                    return (
                      resultadoAnaliseSelecionado.problemas ||
                      'Nenhum problema crítico foi apontado.'
                    );
                  }
                })()}
              </div>
            </div>

            <div class="process-summary-card">
              <span class="process-summary-label">Resumo analítico</span>
              <div class="cv-preview-box">
                ${montarResumoAnaliticoCv(resultadoAnaliseSelecionado)}
              </div>
            </div>
          </div>
        `
      : null
  }
</${ModalPadrao}>
  </section>
  <//>
`;
}

function montarResumoAnaliticoCv(item) {
  const score = Number(item?.score_final || 0);
  const classificacao = String(item?.classificacao || '').trim();

  let palavras = [];
  let problemas = [];
  let pontosFortes = [];
  let educationStrength = '';
  let experienceStrength = '';

  try {
    const payloadProblemas = JSON.parse(item?.problemas || '{}');

    if (Array.isArray(payloadProblemas)) {
      problemas = payloadProblemas;
    } else {
      problemas = Array.isArray(payloadProblemas?.problemas)
        ? payloadProblemas.problemas
        : [];
      pontosFortes = Array.isArray(payloadProblemas?.pontos_fortes)
        ? payloadProblemas.pontos_fortes
        : [];
      educationStrength = payloadProblemas?.education_strength || '';
      experienceStrength = payloadProblemas?.experience_strength || '';
    }
  } catch (e) {
    problemas = [];
  }
  try {
    problemas = JSON.parse(item?.problemas || '[]');
  } catch (e) {
    problemas = [];
  }

  const partes = [];
  partes.push(
    `O candidato foi classificado como "${classificacao}" com score ${score}.`,
  );

  if (palavras.length) {
    partes.push(
      `O sistema identificou aderência por meio das seguintes palavras-chave: ${palavras.join(', ')}.`,
    );
  } else {
    partes.push(
      'O sistema encontrou pouca ou nenhuma aderência por palavras-chave relevantes.',
    );
  }

  if (pontosFortes.length) {
    partes.push(`Pontos fortes identificados: ${pontosFortes.join(' ')}`);
  }

  if (problemas.length) {
    partes.push(
      `Os principais pontos de atenção foram: ${problemas.join(' ')}`,
    );
  } else {
    partes.push(
      'Não foram identificados problemas críticos na leitura automática do currículo.',
    );
  }

  if (educationStrength) {
    partes.push(`Análise de educação/formação: ${educationStrength}.`);
  }

  if (experienceStrength) {
    partes.push(`Análise de experiência profissional: ${experienceStrength}.`);
  }
  if (score >= 7) {
    partes.push(
      'Por isso, o currículo foi considerado com forte aderência ao processo.',
    );
  } else if (score >= 4.5) {
    partes.push(
      'Por isso, o currículo foi considerado razoavelmente aderente ao processo.',
    );
  } else {
    partes.push(
      'Por isso, o currículo foi considerado pouco aderente ao processo.',
    );
  }

  return partes.join('\n\n');
}

// Tela de configuracao do fluxo da prova.
function TelaConfiguracao({ controlador }) {
  const [processosAbertos, setProcessosAbertos] = useState([]);
  const [erro, setErro] = useState('');
  const [formulario, setFormulario] = useState(() => ({
    processo:
      controlador.estado.processoSelecionado ||
      (controlador.estado.candidato.id_processo
        ? controlador.estado.candidato.id_processo
        : ''),
    vaga: controlador.estado.candidato.role || '',
    nivel: controlador.estado.candidato.level || '',
    trilha:
      controlador.estado.candidato.track &&
      controlador.estado.candidato.track !== 'automático'
        ? controlador.estado.candidato.track
        : '',
    tempo: controlador.estado.candidato.time || 40,
  }));

  useEffect(() => {
    (async () => {
      try {
        const lista = await lerProcessos(true);
        const abertos = (Array.isArray(lista) ? lista : []).filter(
          (processo) => String(processo.status || '').trim() !== 'Encerrado',
        );
        setProcessosAbertos(abertos);
      } catch (error) {
        setErro(
          error?.message ||
            'Nao foi possivel carregar os processos seletivos abertos.',
        );
      }
    })();
  }, []);

  useEffect(() => {
    const nivelSugerido = SUGESTOES_NIVEL_POR_VAGA[formulario.vaga];
    if (nivelSugerido && !formulario.nivel) {
      setFormulario((anterior) => ({ ...anterior, nivel: nivelSugerido }));
    }
  }, [formulario.vaga, formulario.nivel]);

  const blueprint = useMemo(() => {
    if (!formulario.vaga || !formulario.nivel) return null;
    return resolverBlueprintProva(
      formulario.vaga,
      formulario.nivel,
      formulario.trilha || '',
    );
  }, [formulario]);

  const prosseguir = () => {
    if (!formulario.vaga || !formulario.nivel || !formulario.tempo) {
      setErro('Preencha os campos da configuracao para prosseguir.');
      return;
    }

    if (!formulario.processo) {
      setErro('Selecione o processo seletivo para prosseguir.');
      return;
    }

    setErro('');
    controlador.configurarFluxo({
      role: formulario.vaga,
      level: formulario.nivel,
      track: formulario.trilha || '',
      time: Number(formulario.tempo),
      processId: formulario.processo,
    });
  };

  return html`
    <${PainelRh}
      screenId="screen-config"
      navAtiva="screen-config"
      subtituloMarca="Configuracao da prova"
      placeholderBusca="Configuracao da prova"
      controlador=${controlador}
      acaoPrimaria=${{
        label: 'Iniciar teste',
        onClick: () => controlador.iniciarNovoFluxo(),
      }}
      acoesTopo=${html`
        <button
          type="button"
          class="btn btn-outline-secondary rh-modern-secondary-btn"
          onClick=${() => controlador.sair()}
        >
          Sair
        </button>
      `}
    >
      <section class="rh-modern-pagehead rh-modern-pagehead-history">
        <div>
          <p class="rh-modern-kicker">Console • Configuracao</p>
          <h2 class="rh-modern-title">Configuracao da Prova</h2>
          <p class="rh-modern-description">
            Selecione o perfil da vaga, o nivel e a trilha da avaliacao para
            prosseguir.
          </p>
        </div>
      </section>

      <section class="rh-modern-table-card">
        <div class="row g-3">
          <div class="col-md-6">
            <label class="form-label">Processo seletivo</label>
            <select
              class="form-select rh-flow-input"
              value=${formulario.processo}
              onChange=${(event) =>
                setFormulario({ ...formulario, processo: event.target.value })}
            >
              <option value="">Selecione...</option>
              <option value="PROCESSO_UNICO">Processo Unico</option>
              ${processosAbertos.map(
                (processo) => html`
                  <option
                    key=${processo.id_processo}
                    value=${processo.id_processo}
                  >
                    ${`${processo.id_processo} • ${processo.vaga} • ${processo.operacao || processo.trilha || '-'} • ${processo.data_encerramento || '-'}`}
                  </option>
                `,
              )}
            </select>
          </div>

          <div class="col-md-6">
            <label class="form-label">Perfil da vaga</label>
            <select
              class="form-select rh-flow-input"
              value=${formulario.vaga}
              onChange=${(event) =>
                setFormulario({ ...formulario, vaga: event.target.value })}
            >
              <option value="">Selecione...</option>
              <option>Jovem Aprendiz</option>
              <option>Operador</option>
              <option>Estagiário</option>
              <option>Supervisor</option>
              <option>Control Desk</option>
              <option>Planejamento</option>
              <option>TI</option>
              <option>Analista</option>
              <option>Outros</option>
            </select>
          </div>

          <div class="col-md-6">
            <label class="form-label">Nivel da prova</label>
            <select
              class="form-select rh-flow-input"
              value=${formulario.nivel}
              onChange=${(event) =>
                setFormulario({ ...formulario, nivel: event.target.value })}
            >
              <option value="">Selecione...</option>
              <option value="1">Nivel 1 - Jovem Aprendiz</option>
              <option value="2">Nivel 2 - Operador / Estagiario</option>
              <option value="3">
                Nivel 3 - Supervisor / Control Desk / Planejamento
              </option>
              <option value="4">Nivel 4 - TI / Analista / Outros</option>
            </select>
          </div>

          <div class="col-md-6">
            <label class="form-label">Area / Trilha</label>
            <select
              class="form-select rh-flow-input"
              value=${formulario.trilha}
              onChange=${(event) =>
                setFormulario({ ...formulario, trilha: event.target.value })}
            >
              <option value="">Automatico</option>
              <option value="operacao">Operacao</option>
              <option value="ti">TI</option>
              <option value="rh">RH</option>
              <option value="adm">ADM / Gestao</option>
            </select>
          </div>

          <div class="col-md-6">
            <label class="form-label">Tempo total (minutos)</label>
            <input
              class="form-control rh-flow-input"
              type="number"
              min="5"
              max="180"
              value=${formulario.tempo}
              onInput=${(event) =>
                setFormulario({ ...formulario, tempo: event.target.value })}
            />
          </div>
        </div>

        <div class="rh-flow-preview mt-4">
          <div class="rh-flow-preview-icon">
            <span class="material-symbols-outlined">info</span>
          </div>
          <div>
            <div class="fw-semibold mb-1">
              ${blueprint?.label || 'Fluxo que sera aplicado'}
            </div>
            <div class="text-muted small">
              ${montarDescricaoFluxo(blueprint)}
            </div>
          </div>
        </div>

        ${erro
          ? html`<div class="alert alert-danger mt-4">${erro}</div>`
          : null}

        <div
          class="d-flex justify-content-between align-items-center flex-wrap gap-2 mt-4 pt-3 border-top"
        >
          <button
            type="button"
            class="btn btn-outline-secondary rh-soft-btn"
            onClick=${() => controlador.irParaMenu()}
          >
            Voltar ao menu
          </button>
          <button
            type="button"
            class="btn btn-success btn-lg rh-primary-cta"
            onClick=${prosseguir}
          >
            Prosseguir teste
          </button>
        </div>
      </section>
    <//>
  `;
}

// Tela de orientacoes antes do inicio da prova.
function TelaCandidato({ controlador }) {
  const [nome, setNome] = useState(controlador.estado.candidato.name || '');
  const [erro, setErro] = useState('');

  useEffect(() => {
    setNome(controlador.estado.candidato.name || '');
  }, [controlador.estado.candidato.name]);

  const iniciar = () => {
    controlador.atualizarNomeCandidato(nome);
    const resultado = controlador.iniciarProva(nome);
    if (!resultado.ok) {
      setErro(resultado.mensagem);
      return;
    }

    setErro('');
  };

  return html`
    <section class="active screen" id="screen-candidate">
      <div class="row justify-content-center">
        <div class="col-12 col-xl-11">
          <div class="card app-card rh-flow-card rh-candidate-wide-card">
            <div class="card-body p-4 p-md-5">
              <div
                class="d-flex justify-content-between align-items-start flex-wrap gap-3 mb-4"
              >
                <div>
                  <h2 class="h3 fw-bold mb-1">Instrucoes ao Candidato</h2>
                  <p class="text-muted mb-0">
                    Por favor, preencha seus dados e leia atentamente as
                    instrucoes abaixo antes de iniciar.
                  </p>
                </div>
                <button
                  type="button"
                  class="btn btn-outline-secondary rh-soft-btn"
                  onClick=${() =>
                    controlador.irParaTelaProtegida('screen-config')}
                >
                  Voltar
                </button>
              </div>

              <div class="row g-4 align-items-start">
                <div class="col-lg-4">
                  <div class="rh-candidate-side-card mb-3">
                    <label
                      class="form-label small text-uppercase fw-bold text-muted mb-2"
                    >
                      Nome completo
                    </label>
                    <div class="rh-candidate-name-shell">
                      <input
                        class="form-control rh-flow-input"
                        placeholder="Ex: Joao Augusto da Silva"
                        value=${nome}
                        onInput=${(event) => {
                          setNome(event.target.value);
                          controlador.atualizarNomeCandidato(
                            event.target.value,
                          );
                        }}
                        type="text"
                      />
                      <span class="material-symbols-outlined">badge</span>
                    </div>
                  </div>

                  <div class="rh-candidate-side-card rh-candidate-summary-card">
                    <h3 class="h6 fw-bold mb-3">
                      Etapas e o que sera avaliado
                    </h3>
                    <div class="text-muted small">
                      <ul class="candidate-summary-list">
                        ${(controlador.regrasCandidato || []).map(
                          (item) => html`
                            <li key=${item.key}>
                              <strong>${item.label}</strong><br />
                              <span>${item.description}</span>
                            </li>
                          `,
                        )}
                      </ul>
                    </div>
                  </div>
                </div>

                <div class="col-lg-8">
                  <div class="rh-candidate-main-card">
                    <h3 class="h5 fw-bold mb-3">
                      Regras e orientacoes da prova
                    </h3>
                    <ul class="mb-0 rules-list">
                      <li>Leia atentamente cada questao antes de responder.</li>
                      <li>
                        A estrutura da avaliacao segue o perfil da vaga
                        selecionada pelo RH.
                      </li>
                      <li>
                        Algumas etapas incluem exercicios praticos,
                        especialmente no Excel.
                      </li>
                      <li>
                        Quando houver planilha, faca o download, realize a
                        atividade e envie o arquivo novamente pelo sistema.
                      </li>
                      <li>
                        Certifique-se de salvar corretamente o documento antes
                        do envio.
                      </li>
                      <li>
                        O sistema registra automaticamente o andamento da prova
                        ate o encerramento.
                      </li>
                      <li>
                        Revise as respostas sempre que possivel antes de
                        prosseguir para a proxima etapa.
                      </li>
                      <li>
                        Ao finalizar, o resultado ficara disponivel para analise
                        do RH.
                      </li>
                      <li>
                        Em caso de dificuldade tecnica, avise imediatamente o
                        responsavel pela aplicacao.
                      </li>
                    </ul>
                  </div>
                </div>
              </div>

              ${erro
                ? html`<div class="alert alert-danger mt-4">${erro}</div>`
                : null}

              <div class="rh-candidate-footer mt-4">
                <div class="rh-candidate-disclaimer">
                  <span class="material-symbols-outlined">info</span>
                  <span>
                    Ao clicar em iniciar, voce declara que leu e concorda com
                    todos os termos e regras citados acima.
                  </span>
                </div>
                <div class="d-flex gap-2 flex-wrap">
                  <button
                    type="button"
                    class="btn btn-outline-secondary rh-soft-btn"
                    onClick=${() =>
                      controlador.irParaTelaProtegida('screen-config')}
                  >
                    Voltar
                  </button>
                  <button
                    type="button"
                    class="btn btn-success btn-lg rh-primary-cta"
                    onClick=${iniciar}
                  >
                    Iniciar prova
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  `;
}

// Tela principal da prova com navegacao entre questoes.
function TelaProva({ controlador }) {
  const [confirmarEncerramento, setConfirmarEncerramento] = useState(false);
  const indiceAtual = controlador.estado.indiceAtual;
  const questaoAtual = controlador.estado.questoes[indiceAtual];
  const respostaAtual = controlador.estado.respostas[indiceAtual] || null;

  if (!questaoAtual) {
    return html`
      <section class="active screen" id="screen-exam">
        <div class="container py-5">
          <div class="alert alert-warning mb-0">
            Nenhuma questao foi carregada para esta prova.
          </div>
        </div>
      </section>
    `;
  }

  const progresso =
    ((indiceAtual + 1) / Math.max(1, controlador.estado.questoes.length)) * 100;

  const voltar = () => {
    if (indiceAtual > 0) {
      controlador.definirIndiceAtual(indiceAtual - 1);
    }
  };

  const avancar = () => {
    if (indiceAtual < controlador.estado.questoes.length - 1) {
      controlador.definirIndiceAtual(indiceAtual + 1);
      return;
    }

    controlador.encerrarProva('Finalizado');
  };

  const atualizarRespostaDiscursiva = (conteudo) =>
    controlador.atualizarResposta(indiceAtual, {
      type: 'word',
      content: conteudo,
    });

  const atualizarRespostaObjetiva = (selected) =>
    controlador.atualizarResposta(indiceAtual, {
      type: 'multiple',
      selected,
    });

  return html`
    <section class="active screen" id="screen-exam">
      <${ModalPadrao}
        aberto=${confirmarEncerramento}
        titulo="Confirmar encerramento"
        subtitulo="Tem certeza de que deseja encerrar a prova agora?"
        onClose=${() => setConfirmarEncerramento(false)}
        className="rh-confirm-dialog"
      >
        <div class="rh-details-body">
          <div class="alert alert-warning mb-0">
            Ao confirmar, a prova sera finalizada imediatamente e o candidato
            seguira para a tela de conclusao.
          </div>
        </div>
        <div class="rh-details-footer">
          <div class="rh-details-footer-actions">
            <button
              type="button"
              class="btn btn-outline-secondary"
              onClick=${() => setConfirmarEncerramento(false)}
            >
              Continuar prova
            </button>
          </div>
          <button
            type="button"
            class="btn btn-danger"
            onClick=${() => {
              setConfirmarEncerramento(false);
              controlador.encerrarProva('Encerrado pelo candidato');
            }}
          >
            Encerrar prova
          </button>
        </div>
      <//>

      <div class="exam-screen-shell">
        <header class="exam-screen-header">
          <div class="exam-screen-header-inner">
            <div class="exam-screen-brand">
              <img
                alt="Central 24 Horas"
                class="exam-screen-logo"
                src="estilos/logo-central24.jpg"
              />
              <div class="exam-screen-brand-copy">
                <span class="exam-screen-caption">Prova em andamento</span>
                <div class="exam-screen-candidate">
                  Candidato:
                  <strong>${controlador.estado.candidato.name || ''}</strong>
                </div>
              </div>
            </div>

            <div class="exam-screen-toolbar">
              <span class="exam-stage-badge">${questaoAtual.stage}</span>
              <div class="exam-timer-shell">
                <span class="material-symbols-outlined">timer</span>
                <div>
                  ${formatarTempoRestante(controlador.estado.segundosRestantes)}
                </div>
              </div>
            </div>
          </div>

          <div class="exam-progress-track">
            <div
              class="exam-progress-fill"
              style=${{ width: `${progresso}%` }}
            ></div>
          </div>
        </header>

        <div class="exam-screen-content">
          <div class="exam-question-card">
            <span class="exam-question-kicker">
              ${`Questao ${indiceAtual + 1} de ${controlador.estado.questoes.length}`}
            </span>
            <h3 class="exam-question-title">${questaoAtual.title}</h3>
            <p class="exam-question-description">${questaoAtual.description}</p>
          </div>

          <div class="exam-dynamic-area">
            ${questaoAtual.type === 'word'
              ? html`
                  <${EditorTextoRich}
                    valor=${respostaAtual?.content || ''}
                    onChange=${atualizarRespostaDiscursiva}
                  />
                `
              : null}
            ${questaoAtual.type === 'multiple'
              ? html`
                  <${PerguntaMultipla}
                    questao=${questaoAtual}
                    resposta=${respostaAtual}
                    onChange=${atualizarRespostaObjetiva}
                  />
                `
              : null}
            ${questaoAtual.type === 'excel_external'
              ? html`
                  <${PerguntaExcel}
                    questao=${questaoAtual}
                    resposta=${respostaAtual}
                    nomeCandidato=${controlador.estado.candidato.name}
                    onChange=${(resposta) =>
                      controlador.atualizarResposta(indiceAtual, resposta)}
                  />
                `
              : null}
          </div>
        </div>

        <footer class="exam-screen-footer">
          <div class="exam-screen-footer-actions">
            <button
              type="button"
              class="btn exam-nav-btn exam-nav-btn-secondary"
              disabled=${indiceAtual === 0}
              onClick=${voltar}
            >
              Anterior
            </button>
            <button
              type="button"
              class="btn exam-nav-btn exam-nav-btn-ghost"
              disabled=${true}
            >
              Revisar depois
            </button>
          </div>

          <div class="exam-screen-footer-actions">
            <button
              type="button"
              class="btn exam-nav-btn exam-nav-btn-danger"
              onClick=${() => setConfirmarEncerramento(true)}
            >
              Encerrar agora
            </button>
            <button
              type="button"
              class="btn exam-nav-btn exam-nav-btn-primary"
              onClick=${avancar}
            >
              ${indiceAtual === controlador.estado.questoes.length - 1
                ? 'Finalizar'
                : 'Proxima'}
            </button>
          </div>
        </footer>
      </div>
    </section>
  `;
}

// Tela intermediaria de conclusao e registro do resultado.
function TelaConclusao({ controlador }) {
  const [alertaSalvar, setAlertaSalvar] = useState('');
  const [tipoSalvar, setTipoSalvar] = useState('info');
  const [senha, setSenha] = useState('');
  const [erroAdmin, setErroAdmin] = useState('');

  useEffect(() => {
    if (controlador.estado.resultadoSalvo) {
      setTipoSalvar('success');
      setAlertaSalvar('Resultado salvo com sucesso.');
    }
  }, [controlador.estado.resultadoSalvo]);

  const salvar = async () => {
    setTipoSalvar('info');
    setAlertaSalvar('Salvando resultado no sistema...');

    const retorno = await controlador.salvarResultado();
    if (!retorno?.ok) {
      setTipoSalvar('danger');
      setAlertaSalvar(
        retorno?.mensagem ||
          'Nao foi possivel salvar a prova no servidor. Verifique a API e tente novamente.',
      );
      return;
    }

    setTipoSalvar('success');
    setAlertaSalvar('Resultado salvo com sucesso.');
  };

  const acessarResultado = () => {
    if (senha.trim() !== SENHA_RH) {
      setErroAdmin('Senha invalida.');
      return;
    }

    setErroAdmin('');
    navegarParaTela('screen-result');
  };

  return html`
    <section class="active screen" id="screen-thanks">
      <div class="rh-finish-screen">
        <div class="rh-finish-shell">
          <div class="rh-finish-badge">Concluido</div>
          <div class="rh-finish-icon-wrap">
            <div class="rh-finish-icon">OK</div>
          </div>
          <h2 class="rh-finish-title">Avaliacao Finalizada com Sucesso</h2>
          <p class="rh-finish-subtitle">
            Parabens por completar a etapa tecnica. Seus dados foram processados
            e os registros estao seguros no sistema da Central 24 horas.
          </p>

          <div class="rh-finish-info-grid">
            <article
              class="rh-finish-info-card rh-finish-info-card-save is-required"
            >
              <div class="rh-finish-info-icon is-blue">
                <span class="material-symbols-outlined">task_alt</span>
              </div>
              <h3>Finalizacao obrigatoria</h3>
              <p>
                Para concluir corretamente esta avaliacao, e obrigatorio salvar
                o resultado no sistema. Somente apos esse registro a prova sera
                considerada finalizada.
              </p>
              <button
                type="button"
                class="btn rh-finish-save-btn"
                disabled=${controlador.estado.salvandoResultado ||
                controlador.estado.resultadoSalvo}
                onClick=${salvar}
              >
                ${controlador.estado.salvandoResultado
                  ? 'Salvando...'
                  : controlador.estado.resultadoSalvo
                    ? 'Resultado salvo'
                    : 'Salvar resultado'}
              </button>
              <div class="rh-finish-required-note">
                Esta etapa e obrigatoria para registrar a prova na plataforma.
              </div>
            </article>

            <article class="rh-finish-info-card is-soft">
              <div class="rh-finish-info-icon is-gold">
                <span class="material-symbols-outlined">trending_up</span>
              </div>
              <h3>Proximos passos</h3>
              <p>
                O RH da empresa recebera uma notificacao agora mesmo. O status
                da candidatura sera atualizado apos a analise interna.
              </p>
            </article>
          </div>

          ${alertaSalvar
            ? html`<div
                class=${`alert rh-finish-alert alert-${tipoSalvar} mt-3`}
                role="alert"
              >
                ${alertaSalvar}
              </div>`
            : null}

          <div class="d-flex justify-content-center mt-3 no-print">
            <button
              type="button"
              class="btn btn-outline-secondary rh-soft-btn"
              onClick=${() => controlador.irParaMenu()}
            >
              Retornar ao menu
            </button>
          </div>

          <div class="rh-finish-access-card no-print">
            <div class="rh-finish-access-icon">
              <span class="material-symbols-outlined">lock</span>
            </div>
            <div class="rh-finish-access-title">Acesso Restrito RH</div>
            <p class="rh-finish-access-text">
              Insira a credencial de seguranca para acessar o resultado
              detalhado.
            </p>
            <div class="rh-finish-access-form">
              <input
                class="form-control"
                type="password"
                placeholder="Senha de acesso"
                value=${senha}
                onInput=${(event) => setSenha(event.target.value)}
              />
              <button
                type="button"
                class="btn rh-finish-access-btn"
                onClick=${acessarResultado}
              >
                Acessar
              </button>
            </div>
            ${erroAdmin
              ? html`<div class="alert alert-danger mt-3 mb-0">
                  ${erroAdmin}
                </div>`
              : null}
            <div class="rh-finish-access-footnote">
              EDA AVALIACAO 360 • AUTENTICACAO CRIPTOGRAFADA
            </div>
          </div>

          <div class="rh-finish-footer-note">
            © 2026 P.R - C24H. Todos os direitos reservados.
          </div>
        </div>
      </div>
    </section>
  `;
}

// Tela final do RH com consolidacao completa da prova.
function TelaResultado({ controlador }) {
  const estado = controlador.estado;
  const dataGeracao = new Date().toLocaleString('pt-BR');
  const identificador = estado.idResultadoAtual || 'Nao salvo';

  return html`
    <section class="active screen" id="screen-result">
      <div class="rh-result-screen">
        <aside class="rh-result-sidebar no-print">
          <div class="rh-result-sidebar-title">
            <span class="material-symbols-outlined">assignment_turned_in</span>
            <div>
              <strong>Avaliacao Tecnica</strong>
              <span>${`ID: ${identificador}`}</span>
            </div>
          </div>
          <nav class="rh-result-nav">
            <button type="button" class="rh-result-nav-btn is-active">
              Pontuacao
            </button>
          </nav>
          <button
            type="button"
            class="btn rh-result-export-btn"
            onClick=${() => window.print()}
          >
            Imprimir resultado
          </button>
        </aside>

        <div class="rh-result-main">
          <div class="rh-result-topnav no-print">
            <div class="rh-result-topnav-links">
              <span class="is-active">Avaliacoes</span>
            </div>
            <div class="rh-result-topnav-actions">
              <button
                type="button"
                class="btn btn-primary"
                onClick=${() => controlador.baixarPacoteAtual()}
              >
                Baixar prova
              </button>
              <button
                type="button"
                class="btn btn-outline-secondary"
                onClick=${() => controlador.irParaMenu()}
              >
                Menu principal
              </button>
            </div>
          </div>

          <div class="rh-result-content card app-card">
            <div class="card-body p-4 p-md-4">
              <div class="print-page print-page-1">
                <div class="rh-result-header">
                  <div>
                    <h2 class="rh-result-title">Resultado da Avaliacao</h2>
                    <p class="rh-result-subtitle">
                      Relatorio detalhado consolidado em ${dataGeracao}
                    </p>
                  </div>
                  <span class="rh-result-status-badge no-print">
                    ${estado.statusFinalizacao || 'Finalizado'}
                  </span>
                </div>

                <div class="rh-result-summary-grid">
                  <div class="rh-result-candidate-card">
                    <div class="rh-result-candidate-name">
                      ${estado.candidato.name || '-'}
                    </div>
                    <div class="rh-result-candidate-role">
                      ${estado.candidato.role || '-'}
                    </div>
                    <div class="rh-result-candidate-meta">
                      <span class="rh-result-meta-pill"
                        >${`ID ${identificador}`}</span
                      >
                      <span class="rh-result-meta-pill">
                        ${`${estado.candidato.level || '-'} • ${controlador.blueprint?.label || '-'}`}
                      </span>
                      <span class="rh-result-meta-pill">
                        ${estado.candidato.id_processo || 'Processo Individual'}
                      </span>
                    </div>
                  </div>
                  <div class="rh-result-score-card">
                    <div class="rh-result-score-label">Nota Final</div>
                    <div class="rh-result-score-value">
                      ${formatarNotaVisual(estado.notaFinalPonderada, 2)}
                    </div>
                  </div>
                </div>

                <div class="rh-result-body-grid">
                  <section class="rh-result-stage-panel">
                    <div class="rh-result-panel-head">
                      <h3>Pontuacao por Etapa</h3>
                      <span>Peso Total: 100%</span>
                    </div>
                    <div class="row g-3">
                      ${(estado.resumoEtapas || []).map(
                        (etapa) => html`
                          <div class="col-md-6" key=${etapa.key}>
                            <div
                              class="result-item h-100 rh-stage-result-card"
                              style=${{
                                '--stage-progress': `${Math.max(
                                  8,
                                  Math.min(
                                    100,
                                    Number(etapa.percent || 0) * 100,
                                  ),
                                )}%`,
                              }}
                            >
                              <div
                                class="d-flex justify-content-between align-items-center gap-2 mb-1"
                              >
                                <div class="text-muted">${etapa.label}</div>
                                <span class="weight-badge"
                                  >${`Peso ${etapa.weight}%`}</span
                                >
                              </div>
                              <div class="fw-bold">
                                ${`${etapa.questionCount} item(ns) avaliados`}
                              </div>
                              <div
                                class=${`mt-2 stage-card-score ${obterClasseEtapaResultado(etapa.percent)} fs-5`}
                              >
                                ${`${etapa.rawScore}/${etapa.rawMax}`}
                              </div>
                              <div class="small text-muted mt-1">
                                ${`Aproveitamento: ${formatarNotaVisual(
                                  Number(etapa.percent || 0) * 100,
                                  1,
                                )}% • Nota ponderada: ${formatarNotaVisual(
                                  etapa.weightedScore,
                                  2,
                                )}`}
                              </div>
                              ${etapa.pendings
                                ? html`<div class="small text-muted mt-2">
                                    ${`Pendencias de revisao: ${etapa.pendings}`}
                                  </div>`
                                : null}
                            </div>
                          </div>
                        `,
                      )}
                    </div>
                  </section>

                  <aside class="rh-result-side-stack">
                    <section class="rh-result-note-card">
                      <h3>Observacoes do RH</h3>
                      <p>
                        <textarea
                          class="form-control"
                          rows="6"
                          placeholder="Digite aqui observacoes sobre desempenho, postura, tempo, comportamento, pontos fortes e pontos de atencao."
                          value=${estado.observacaoRh || ''}
                          onInput=${(event) =>
                            controlador.atualizarObservacaoRh(
                              event.target.value,
                            )}
                        ></textarea>
                      </p>
                    </section>

                    <section class="rh-result-pending-card">
                      <h3>Pendencias</h3>
                      <div class="rh-result-pending-list">
                        ${(estado.pendenciasManuais || []).length
                          ? (estado.pendenciasManuais || []).map(
                              (item, indice) => html`
                                <div key=${indice} class="mb-3">
                                  <strong
                                    >${item.title ||
                                    item.q?.title ||
                                    'Item para revisao'}</strong
                                  >
                                  ${item.completedTasks?.length
                                    ? html`
                                        <div class="small text-muted mt-2">
                                          ${item.completedTasks.map(
                                            (linha, indiceLinha) =>
                                              html`<div key=${indiceLinha}>
                                                ${linha}
                                              </div>`,
                                          )}
                                        </div>
                                      `
                                    : null}
                                  ${item.answerKey?.length
                                    ? html`
                                        <div class="small text-muted mt-2">
                                          ${item.answerKey.map(
                                            (linha, indiceLinha) =>
                                              html`<div key=${indiceLinha}>
                                                ${linha}
                                              </div>`,
                                          )}
                                        </div>
                                      `
                                    : null}
                                  ${item.notes?.length
                                    ? html`
                                        <div class="small text-muted mt-2">
                                          ${item.notes.map(
                                            (linha, indiceLinha) =>
                                              html`<div key=${indiceLinha}>
                                                ${linha}
                                              </div>`,
                                          )}
                                        </div>
                                      `
                                    : null}
                                </div>
                              `,
                            )
                          : html`<div class="text-muted">
                              Nenhuma pendencia.
                            </div>`}
                      </div>
                    </section>

                    <button
                      type="button"
                      class="btn rh-result-contract-btn no-print"
                      onClick=${() => controlador.baixarPacoteAtual()}
                    >
                      Baixar prova
                    </button>
                  </aside>
                </div>

                <section class="rh-result-competency-card">
                  <div>
                    <h3>Analise de Competencias</h3>
                    <p>
                      O candidato apresenta desempenho consolidado nas etapas
                      aplicadas, permitindo uma leitura clara de execucao,
                      raciocinio e aderencia ao perfil selecionado.
                    </p>
                  </div>
                </section>
              </div>

              <div class="print-only-result">
                <div class="print-sheet-topbar">${dataGeracao}</div>
                <div class="print-sheet-title-row">
                  <div>
                    <h1>Resultado da Avaliacao</h1>
                    <p>Resumo final da prova</p>
                  </div>
                </div>
                <div class="print-sheet-meta">
                  <div>${`Candidato(a): ${estado.candidato.name || '-'}`}</div>
                  <div>${`Vaga: ${estado.candidato.role || '-'}`}</div>
                  <div>
                    ${`Nivel da prova: ${estado.candidato.level || '-'} • ${controlador.blueprint?.label || '-'}`}
                  </div>
                  <div>
                    ${`Nota final: ${formatarNotaVisual(estado.notaFinalPonderada, 2)}`}
                  </div>
                </div>
                <div class="print-sheet-divider"></div>
                <h2 class="print-sheet-section-title">Pontuacao por Etapa</h2>
                <div class="print-stage-grid">
                  ${(estado.resumoEtapas || []).map(
                    (etapa) => html`
                      <div class="print-stage-card" key=${etapa.key}>
                        <div class="print-stage-title">${etapa.label}</div>
                        <div class="print-stage-score">
                          ${`${etapa.rawScore}/${etapa.rawMax}`}
                        </div>
                        <div class="print-stage-meta">
                          ${`Peso: ${etapa.weight}%`}<br />
                          ${`Aproveitamento: ${formatarNotaVisual(
                            Number(etapa.percent || 0) * 100,
                            1,
                          )}%`}<br />
                          ${`Nota ponderada: ${formatarNotaVisual(etapa.weightedScore, 2)}`}
                        </div>
                      </div>
                    `,
                  )}
                </div>
                <div class="print-sheet-divider print-gap-top"></div>
                <h2 class="print-sheet-section-title">
                  Pendencias para revisao do RH
                </h2>
                <div class="print-manual-box">
                  ${(estado.pendenciasManuais || []).length
                    ? (estado.pendenciasManuais || []).map(
                        (item, indice) => html`
                          <div key=${indice} class="mb-3">
                            <strong
                              >${item.title ||
                              item.q?.title ||
                              'Item para revisao'}</strong
                            >
                            ${item.notes?.length
                              ? html`
                                  <div class="small text-muted">
                                    ${item.notes.join(' | ')}
                                  </div>
                                `
                              : null}
                          </div>
                        `,
                      )
                    : html`<div>Nenhuma pendencia.</div>`}
                </div>
                <div class="print-sheet-divider print-gap-top"></div>
                <h2 class="print-sheet-section-title">Observacao do RH</h2>
                <div class="print-observation-note">
                  ${(estado.observacaoRh || '').trim() ||
                  'Anotacoes sobre desempenho, postura, tempo, etc.'}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  `;
}

function resolverTelaProtegida(telaAtual, controlador) {
  const { estado, blueprint } = controlador;

  if (!estado.autenticado) {
    return 'screen-login';
  }

  if (telaAtual === 'screen-login') {
    return 'screen-menu';
  }

  if (telaAtual === 'screen-candidate' && !blueprint) {
    return 'screen-config';
  }

  if (telaAtual === 'screen-exam' && !estado.questoes.length) {
    return estado.candidato.role ? 'screen-candidate' : 'screen-config';
  }

  if (
    (telaAtual === 'screen-thanks' || telaAtual === 'screen-result') &&
    !estado.provaFinalizada
  ) {
    if (estado.questoes.length) return 'screen-exam';
    return 'screen-menu';
  }

  return telaAtual;
}

// Componente raiz com roteamento em hash e protecao de fluxo.
export function Aplicacao() {
  const controlador = useControladorAplicacao();
  const telaAtual = usarTelaAtual(controlador.estado.autenticado);
  const telaResolvida = resolverTelaProtegida(telaAtual, controlador);

  useEffect(() => {
    if (telaResolvida !== telaAtual) {
      navegarParaTela(telaResolvida);
    }
  }, [telaAtual, telaResolvida]);

  if (!controlador.estado.autenticado || telaResolvida === 'screen-login') {
    return html`<${TelaLogin} controlador=${controlador} />`;
  }

  if (telaResolvida === 'screen-menu') {
    return html`<${TelaInicio} controlador=${controlador} />`;
  }

  if (telaResolvida === 'screen-history') {
    return html`<${TelaHistorico} controlador=${controlador} />`;
  }

  if (telaResolvida === 'screen-process-create') {
    return html`<${TelaCriarProcesso} controlador=${controlador} />`;
  }

  if (telaResolvida === 'screen-processes') {
    return html`<${TelaProcessos} controlador=${controlador} />`;
  }

  if (telaResolvida === 'screen-process-details') {
    return html`<${TelaDetalhesProcesso} controlador=${controlador} />`;
  }

  if (telaResolvida === 'screen-talent-bank') {
    return html`<${TelaBancoTalentos} controlador=${controlador} />`;
  }

  if (telaResolvida === 'screen-analysis-candidates') {
    return html`<${TelaAnaliseCandidatos} controlador=${controlador} />`;
  }

  if (telaResolvida === 'screen-config') {
    return html`<${TelaConfiguracao} controlador=${controlador} />`;
  }

  if (telaResolvida === 'screen-candidate') {
    return html`<${TelaCandidato} controlador=${controlador} />`;
  }

  if (telaResolvida === 'screen-exam') {
    return html`<${TelaProva} controlador=${controlador} />`;
  }

  if (telaResolvida === 'screen-thanks') {
    return html`<${TelaConclusao} controlador=${controlador} />`;
  }

  return html`<${TelaResultado} controlador=${controlador} />`;
}
