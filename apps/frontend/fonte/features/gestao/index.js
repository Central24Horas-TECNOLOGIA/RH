import {
  html,
  useEffect,
  useMemo,
  useState,
} from '../../infraestrutura-react.js';
import {
  OPCOES_OPERACOES,
  OPCOES_VAGAS_PROVA,
  OPCOES_TRILHAS_PROCESSO,
  OPCOES_VAGAS_PROCESSO,
  SUGESTOES_NIVEL_POR_VAGA,
  montarProvaPorBlueprint,
  resolverBlueprintProva,
} from '../../perguntas.js';
import {
  NIVEIS_PERSONALIZACAO,
  TIPOS_ATENDIMENTO_PERSONALIZACAO,
  gerarPersonalizacaoProva,
  inferirPerfilAtendimentoPersonalizacao,
} from '../prova/services/personalizacao-inteligente.js';
import {
  TAMANHO_ANALISE,
  TAMANHO_HISTORICO,
  TAMANHO_RECENTES,
  atualizarStatusCandidato,
  abrirFichaCandidatoDaProva,
  baixarCvCandidato,
  baixarPacoteHistorico,
  carregarDetalhesProva,
  construirMapaStatusAtual,
  criarProcesso,
  lerAnalisesCandidatos,
  lerBancoTalentos,
  lerCandidatosProcessos,
  lerDetalheAnaliseCandidato,
  lerHistorico,
  lerHistoricoPaginado,
  lerEntrevistas,
  lerProcessos,
  montarIdProcesso,
  obterClasseSituacaoAtual,
  obterRegrasFormularioProcesso,
  obterRotuloSituacaoAtual,
  atualizarPerfilCandidato,
  baixarAnexoEmailRecebido,
  baixarRelatorioCandidatos,
  baixarRelatorioProcessos,
  analisarCvEmailRecebidoGeral,
  enviarEmailRecebidoBancoTalentos,
  ignorarEmailRecebido,
  lerDetalheEmailRecebido,
  excluirEmailRecebido,
  lerEmailsRecebidos,
  removerBancoTalentos,
  usarCandidatoDoBancoTalentos,
  vincularEmailRecebidoProcesso,
  lerRelatorioCandidatos,
  lerRelatorioProcessos,
} from '../../app/controlador-aplicacao.js';
import {
  baixarBlob,
  formatarDataParaInput,
  formatarNotaAnalise,
  formatarPercentualAfinidade,
  formatarPontuacaoDetalhada,
  obterItensPaginados,
} from '../../utilitarios.js';
import { abrirBlobEmNovaGuia } from '../../shared/browser-utils.js';
import {
  formatarDataHora,
  obterClasseAderencia,
  obterClasseStatusEntrevista,
} from '../../shared/helpers-visuais.js';
import { AcaoSair } from '../../shared/components/actions.js';
import { TabelaVazia } from '../../shared/components/empty-table-row.js';
import {
  getCandidateActionState,
  getCandidateVisibleStatus,
  isProcessClosed,
} from '../../shared/process-flow.js';
import { obterTourLogin } from '../../shared/tour-config.js';
import {
  obterChaveProcesso,
  obterReferenciaProcessoDoCandidato,
  obterReferenciaProcesso,
} from '../../shared/process-reference.js';
import {
  quebrarListaTexto,
  validarFormularioProcesso,
  validarPerfilCandidato,
} from '../../shared/validacoes.js';
import { BlocoFiltro, CampoFiltro } from './components/filtros.js';
import {
  EmptyState,
  GrupoPaginacao,
  LoadingState,
  MetricGrid,
  ModalDetalhesProva,
  ModalPadrao,
  PageIntro,
  PainelRh,
  SectionCard,
} from '../../ui/componentes-compartilhados.js';
import { BotaoAjudaTour, TourGuiado } from '../../ui/tour-guiado.js';

const MENSAGEM_EMAIL_NAO_CONFIGURADO =
  'Caixa de e-mail corporativa ainda não configurada. Informe TENANT_ID, CLIENT_ID e CLIENT_SECRET no servidor.';

const OPCOES_NIVEL_PROVA_PROCESSO = [
  { value: '1', label: 'Nível 1' },
  { value: '2', label: 'Nível 2' },
  { value: '3', label: 'Nível 3' },
  { value: '4', label: 'Nível 4' },
  { value: '5', label: 'Nível 5' },
  { value: 'personalizado', label: 'Personalizado' },
];

const OPCOES_AREAS_PROVA_PROCESSO = [
  'Atendimento',
  'Administrativo',
  'Operação',
  'Comercial',
  'Financeiro',
  'RH',
  'TI',
  'Suporte Técnico',
  'Planejamento',
  'Estágio',
  'Gestão',
];

const OPCOES_TOM_PROVA_PROCESSO = [
  'Formal',
  'Corporativo',
  'Humanizado',
  'Técnico',
  'Simples e objetivo',
  'Atendimento ao cliente',
  'Operacional',
];

const OPCAO_OUTRO_PROCESSO = 'Outro';

function normalizarTextoPainel(valor) {
  return String(valor || '').trim();
}

function normalizarBuscaPainel(valor) {
  return normalizarTextoPainel(valor)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function normalizarTrilhaProvaProcesso(valor) {
  const chave = normalizarBuscaPainel(valor);
  if (!chave) return '';
  if (chave.includes('atendimento')) return 'operacao';
  if (chave.includes('comercial')) return 'comercial';
  if (chave.includes('financeiro')) return 'financeiro';
  if (chave.includes('rh')) return 'rh';
  if (chave.includes('ti') || chave.includes('suporte tecnico')) return 'ti';
  if (chave.includes('adm') || chave.includes('administrativo') || chave.includes('gestao')) return 'adm';
  if (chave.includes('operacao') || chave.includes('padrao')) return 'operacao';
  return chave;
}

function normalizarNivelProvaProcesso(valor) {
  const texto = normalizarTextoPainel(valor);
  if (!texto) return '';
  const chave = normalizarBuscaPainel(texto);
  const numero = chave.match(/[1-5]/)?.[0];
  if (numero) return numero;
  if (chave.includes('basico') || chave.includes('junior') || chave.includes('aprendiz')) return '1';
  if (chave.includes('intermediario') || chave.includes('pleno')) return '3';
  if (chave.includes('avancado') || chave.includes('senior') || chave.includes('supervisor')) return '4';
  return texto;
}

function obterOpcaoVagaProvaProcesso(vaga) {
  const chave = normalizarBuscaPainel(vaga);
  if (!chave) return null;
  return (
    OPCOES_VAGAS_PROVA.find((item) => normalizarBuscaPainel(item.label) === chave) ||
    OPCOES_VAGAS_PROVA.find((item) => {
      const label = normalizarBuscaPainel(item.label);
      return label && (chave.includes(label) || label.includes(chave));
    }) ||
    null
  );
}

function montarOpcoesComValorProcesso(opcoes = [], valor = '') {
  const atual = normalizarTextoPainel(valor);
  if (!atual || opcoes.some((opcao) => normalizarBuscaPainel(opcao) === normalizarBuscaPainel(atual))) {
    return opcoes;
  }
  return [atual, ...opcoes];
}

function lerValoresMultiselectProcesso(event) {
  return Array.from(event.target.selectedOptions || [])
    .map((opcao) => normalizarTextoPainel(opcao.value))
    .filter(Boolean);
}

function montarListaComOutroProcesso(lista = [], outro = '') {
  return [
    ...lista.filter((item) => item !== OPCAO_OUTRO_PROCESSO),
    normalizarTextoPainel(outro),
  ].filter(Boolean);
}

function montarEtapasBlueprintProcesso(blueprint) {
  return (blueprint?.stages || []).map((stage) => ({
    key: stage.key || '',
    label: stage.label || stage.key || 'Etapa',
    weight: Number(stage.weight || 0),
    questionCount:
      typeof stage.questions === 'function'
        ? stage.questions().length
        : Array.isArray(stage.questions)
          ? stage.questions.length
          : 0,
  }));
}

function obterCategoriasQuestoesProcesso(questoes = []) {
  return Array.from(
    new Set(
      questoes
        .map((questao) => questao.stage || questao.category || questao.stageKey)
        .filter(Boolean),
    ),
  );
}

function inferirPerfilOperacaoProcesso(formulario = {}) {
  const base = normalizarBuscaPainel([
    formulario.operacao,
    formulario.areaProva,
    formulario.vaga,
  ].join(' '));
  if (base.includes('davita') || base.includes('endoview') || base.includes('saude')) {
    return 'atendimento_saude';
  }
  if (base.includes('suporte') || base.includes('ti') || base.includes('tecnico')) {
    return 'suporte_ti';
  }
  if (base.includes('financeiro') || base.includes('administrativo') || base.includes('backoffice')) {
    return 'backoffice';
  }
  if (base.includes('rh')) return 'rh_dp';
  return 'call_center';
}

function formatarDataResumoProcesso(valor) {
  if (!valor) return '-';
  const data = new Date(`${valor}T00:00:00`);
  if (Number.isNaN(data.getTime())) return valor;
  return data.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function mascararEmailContato(valor) {
  const texto = String(valor || '').trim();
  if (!texto) return '-';
  const [usuario, dominio] = texto.split('@');
  if (!usuario || !dominio) return '***';
  const prefixoUsuario = usuario.slice(0, Math.min(2, usuario.length));
  const partesDominio = dominio.split('.');
  const dominioBase = partesDominio.shift() || '';
  const sufixoDominio = partesDominio.length ? `.${partesDominio.join('.')}` : '';
  return `${prefixoUsuario}${'*'.repeat(Math.max(3, usuario.length - prefixoUsuario.length))}@${dominioBase.slice(0, 1)}***${sufixoDominio}`;
}

function mascararTelefoneContato(valor) {
  const digitos = String(valor || '').replace(/\D/g, '');
  if (!digitos) return '-';
  if (digitos.length <= 4) return '****';
  const ultimos = digitos.slice(-4);
  const ddd = digitos.length >= 10 ? `(${digitos.slice(-11, -9)}) ` : '';
  return `${ddd}*****-${ultimos}`;
}

function obterIntervaloPaginacao(paginacao) {
  const total = Number(paginacao?.totalItens || 0);
  if (!total) return '0-0';

  const inicio = (Number(paginacao.paginaAtual || 1) - 1) * Number(paginacao.tamanhoPagina || paginacao.itens?.length || 1) + 1;
  const fim = Math.min(total, inicio + Number(paginacao.itens?.length || 0) - 1);
  return `${inicio}-${fim}`;
}

function PaginacaoCompacta({
  paginacao,
  onChange,
  label,
  onVerTodos = null,
}) {
  const totalPaginas = Math.max(1, Number(paginacao?.totalPaginas || 1));
  const paginaAtual = Math.min(
    Math.max(1, Number(paginacao?.paginaAtual || 1)),
    totalPaginas,
  );
  const paginas = Array.from({ length: totalPaginas }, (_, indice) => indice + 1);

  return html`
    <footer class="c24-pagination">
      <span>${label}</span>
      <div class="c24-pagination-actions">
        <button
          type="button"
          class="c24-page-btn"
          aria-label="Página anterior"
          disabled=${paginaAtual <= 1}
          onClick=${() => onChange(paginaAtual - 1)}
        >
          <span class="material-symbols-outlined">chevron_left</span>
        </button>
        ${paginas.map(
          (pagina) => html`
            <button
              key=${pagina}
              type="button"
              class=${`c24-page-btn ${pagina === paginaAtual ? 'is-active' : ''}`}
              onClick=${() => onChange(pagina)}
            >
              ${pagina}
            </button>
          `,
        )}
        <button
          type="button"
          class="c24-page-btn"
          aria-label="Próxima página"
          disabled=${paginaAtual >= totalPaginas}
          onClick=${() => onChange(paginaAtual + 1)}
        >
          <span class="material-symbols-outlined">chevron_right</span>
        </button>
        ${onVerTodos
          ? html`
              <button type="button" class="c24-page-link" onClick=${onVerTodos}>
                Ver todos
              </button>
            `
          : null}
      </div>
    </footer>
  `;
}

function obterClasseStatusEmail(status) {
  const texto = normalizarTextoPainel(status).toLowerCase();
  if (texto.includes('banco')) return 'is-talent';
  if (texto.includes('vinculado') || texto.includes('analisado')) return 'is-highlight';
  if (texto.includes('erro') || texto.includes('ignorado')) return 'is-eliminated';
  if (texto.includes('sem anexo')) return 'is-pending';
  return 'is-analysis';
}

function obterClasseAlertaEmail(payload) {
  const status = normalizarTextoPainel(payload?.status).toLowerCase();
  if (status === 'error' || payload?.error) return 'alert-danger';
  if (payload && payload.configured === false) return 'alert-warning';
  return 'alert-info';
}

function formatarPartesDataHoraEmail(valor) {
  if (!valor) return { data: '-', hora: '' };
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return { data: String(valor), hora: '' };
  return {
    data: data.toLocaleDateString('pt-BR'),
    hora: data.toLocaleTimeString('pt-BR'),
  };
}

function SecaoCurriculosRecebidosEmail({ modo = 'resumo', controlador = null } = {}) {
  const compacto = modo !== 'completo';
  const [aberta, setAberta] = useState(true);
  const [carregando, setCarregando] = useState(true);
  const [payloadEmail, setPayloadEmail] = useState(null);
  const [emails, setEmails] = useState([]);
  const [processosAbertos, setProcessosAbertos] = useState([]);
  const [selecoesProcesso, setSelecoesProcesso] = useState({});
  const [acaoEmAndamento, setAcaoEmAndamento] = useState('');
  const [detalheEmail, setDetalheEmail] = useState(null);
  const [mostrarIgnorados, setMostrarIgnorados] = useState(false);
  const [paginaAtual, setPaginaAtual] = useState(1);
  const [tamanhoPagina, setTamanhoPagina] = useState(compacto ? 2 : 10);
  const [filtroTexto, setFiltroTexto] = useState('');
  const [idsSelecionados, setIdsSelecionados] = useState([]);

  const paginacaoEmails = useMemo(
    () => obterItensPaginados(emails, paginaAtual, tamanhoPagina),
    [emails, paginaAtual, tamanhoPagina],
  );

  const itensSelecionados = useMemo(() => {
    const selecionados = new Set(idsSelecionados.map(String));
    return emails.filter((item) => selecionados.has(String(item.id)));
  }, [emails, idsSelecionados]);

  const idsPaginaAtual = useMemo(
    () => paginacaoEmails.itens.map((item) => String(item.id)),
    [paginacaoEmails.itens],
  );

  const todosDaPaginaSelecionados = idsPaginaAtual.length > 0 && idsPaginaAtual.every(
    (id) => idsSelecionados.includes(id),
  );

  const carregarEmails = async () => {
    setCarregando(true);
    try {
      const [resultadoEmails, resultadoProcessos] = await Promise.allSettled([
        lerEmailsRecebidos({
          limite: compacto ? 30 : 80,
          mostrarIgnorados,
          query: filtroTexto.trim(),
          apenasComAnexos: true,
          refresh: true,
        }),
        lerProcessos(true),
      ]);

      if (resultadoEmails.status === 'fulfilled') {
        const payload = resultadoEmails.value || {};
        setPayloadEmail(payload);
        setEmails(Array.isArray(payload.items) ? payload.items : []);
      } else {
        setPayloadEmail({
          configured: false,
          message:
            resultadoEmails.reason?.message || MENSAGEM_EMAIL_NAO_CONFIGURADO,
        });
        setEmails([]);
      }

      if (resultadoProcessos.status === 'fulfilled') {
        setProcessosAbertos(
          (Array.isArray(resultadoProcessos.value)
            ? resultadoProcessos.value
            : []
          ).filter((processo) => !isProcessClosed(processo)),
        );
      } else {
        setProcessosAbertos([]);
      }
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    setPaginaAtual(1);
    carregarEmails();
  }, [mostrarIgnorados, tamanhoPagina]);

  useEffect(() => {
    const idsDisponiveis = new Set(emails.map((item) => String(item.id)));
    setIdsSelecionados((atuais) => atuais.filter((id) => idsDisponiveis.has(id)));
  }, [emails]);

  const registrarErroAcao = (error, fallback) => {
    setPayloadEmail((atual) => ({
      ...(atual || {}),
      configured: atual?.configured !== false,
      status: 'error',
      message: error?.message || fallback,
    }));
  };

  const executarAcao = async (chave, acao) => {
    setAcaoEmAndamento(chave);
    try {
      await acao();
      await carregarEmails();
    } finally {
      setAcaoEmAndamento('');
    }
  };

  const analisarEmail = async (item) => {
    if (!item?.possui_anexo) {
      registrarErroAcao(null, 'Este e-mail não possui anexo de currículo.');
      return;
    }
    try {
      await executarAcao(`analisar:${item.id}`, () =>
        analisarCvEmailRecebidoGeral(item.id),
      );
    } catch (error) {
      registrarErroAcao(error, 'Não foi possível analisar o CV recebido.');
    }
  };

  const vincularEmail = async (item) => {
    const idProcesso = selecoesProcesso[item.id] || '';
    if (!idProcesso) {
      registrarErroAcao(null, 'Selecione um processo aberto para vincular.');
      return;
    }
    try {
      await executarAcao(`vincular:${item.id}`, () =>
        vincularEmailRecebidoProcesso(item.id, { id_processo: idProcesso }),
      );
      setSelecoesProcesso((anteriores) => ({ ...anteriores, [item.id]: '' }));
    } catch (error) {
      registrarErroAcao(error, 'Não foi possível vincular este candidato.');
    }
  };

  const enviarParaBanco = async (item) => {
    try {
      await executarAcao(`banco:${item.id}`, () =>
        enviarEmailRecebidoBancoTalentos(item.id),
      );
    } catch (error) {
      registrarErroAcao(
        null,
        'Não foi possível enviar o candidato para o Banco de Talentos. Verifique os dados do candidato e tente novamente.',
      );
    }
  };

  const abrirCvEmail = async (item) => {
    if (!item?.possui_anexo) {
      registrarErroAcao(null, 'Este e-mail não possui anexo de currículo.');
      return;
    }
    try {
      setAcaoEmAndamento(`cv:${item.id}`);
      const anexo = Array.isArray(item.anexos) ? item.anexos[0] : null;
      const resposta = await baixarAnexoEmailRecebido(item.id, anexo?.id || '');
      abrirBlobEmNovaGuia(resposta.blob);
      await carregarEmails();
    } catch (error) {
      registrarErroAcao(error, 'Não foi possível abrir o CV recebido.');
    } finally {
      setAcaoEmAndamento('');
    }
  };

  const ignorarEmail = async (item) => {
    try {
      await executarAcao(`ignorar:${item.id}`, () =>
        ignorarEmailRecebido(item.id),
      );
    } catch (error) {
      registrarErroAcao(error, 'Não foi possível ignorar este e-mail.');
    }
  };

  const excluirEmail = async (item) => {
    const confirmar = window.confirm(
      `Deseja excluir este e-mail?\n\nAssunto: ${item.assunto || 'Sem assunto'}\n\nEsta ação remove o e-mail da caixa configurada quando o IMAP permitir e também oculta o item no sistema.`,
    );

    if (!confirmar) return;

    try {
      await executarAcao(`excluir:${item.id}`, () =>
        excluirEmailRecebido(item.id),
      );
    } catch (error) {
      registrarErroAcao(error, 'Não foi possível excluir este e-mail.');
    }
  };

  const alternarSelecaoEmail = (item) => {
    const id = String(item.id);
    setIdsSelecionados((atuais) => (
      atuais.includes(id)
        ? atuais.filter((itemId) => itemId !== id)
        : [...atuais, id]
    ));
  };

  const alternarSelecaoPagina = () => {
    setIdsSelecionados((atuais) => {
      if (todosDaPaginaSelecionados) {
        return atuais.filter((id) => !idsPaginaAtual.includes(id));
      }
      return [...new Set([...atuais, ...idsPaginaAtual])];
    });
  };

  const ignorarEmailsSelecionados = async () => {
    if (!itensSelecionados.length) return;
    try {
      await executarAcao('ignorar:massa', () => Promise.all(
        itensSelecionados.map((item) => ignorarEmailRecebido(item.id)),
      ));
      setIdsSelecionados([]);
    } catch (error) {
      registrarErroAcao(error, 'Não foi possível ignorar os e-mails selecionados.');
    }
  };

  const excluirEmailsSelecionados = async () => {
    if (!itensSelecionados.length) return;
    const quantidade = itensSelecionados.length;
    const confirmar = window.confirm(
      `Deseja excluir ${quantidade === 1 ? 'este e-mail' : `os ${quantidade} e-mails selecionados`}?\n\nEsta ação remove os e-mails da caixa configurada quando o IMAP permitir e também oculta os itens no sistema.`,
    );
    if (!confirmar) return;

    try {
      await executarAcao('excluir:massa', () => Promise.all(
        itensSelecionados.map((item) => excluirEmailRecebido(item.id)),
      ));
      setIdsSelecionados([]);
    } catch (error) {
      registrarErroAcao(error, 'Não foi possível excluir os e-mails selecionados.');
    }
  };

  const abrirDetalhesEmail = async (item) => {
    try {
      const resposta = await lerDetalheEmailRecebido(item.id);
      setDetalheEmail(resposta?.item || item);
    } catch (error) {
      setDetalheEmail(item);
      registrarErroAcao(error, 'Não foi possível carregar os detalhes do e-mail.');
    }
  };

  const enviarFiltro = (event) => {
    event.preventDefault();
    setPaginaAtual(1);
    carregarEmails();
  };

  const itemSelecionado = itensSelecionados.length === 1 ? itensSelecionados[0] : null;

  return html`
    <div class=${`mailbox-layout ${compacto ? 'is-compact' : 'is-full'} ${itensSelecionados.length ? 'has-selection' : ''}`}>
      <${SectionCard}
        className=${`mailbox-card ${compacto ? 'mailbox-card-compact' : 'mailbox-card-full'}`}
        title=${compacto ? 'Caixa de E-mail' : ''}
        actions=${html`
          <div class=${`mailbox-toolbar rh-email-panel-actions ${compacto ? 'mailbox-toolbar-compact' : 'mailbox-toolbar-full'}`}>
            ${!compacto
              ? html`
                  <form class="mailbox-filter-form" onSubmit=${enviarFiltro}>
                    <label class="email-search-control">
                      <span class="material-symbols-outlined">search</span>
                      <input
                        class="form-control form-control-sm rh-email-filter-input email-filter-input"
                        aria-label="Filtrar e-mails"
                        placeholder="Filtrar por assunto, remetente, nome ou vaga"
                        value=${filtroTexto}
                        onInput=${(event) => setFiltroTexto(event.target.value)}
                      />
                    </label>
                    <button
                      type="submit"
                      class="btn btn-outline-primary btn-sm rh-action-btn email-toolbar-btn"
                      disabled=${carregando}
                    >
                      <span class="material-symbols-outlined">filter_alt</span>
                      Filtrar
                    </button>
                  </form>
                `
              : controlador
                ? html`
                    <button
                      type="button"
                      class="btn btn-outline-primary btn-sm rh-action-btn email-toolbar-btn"
                      onClick=${() => controlador.irParaTelaProtegida('screen-email-inbox')}
                    >
                      <span class="material-symbols-outlined">mail</span>
                      Abrir caixa completa
                    </button>
                  `
                : null}

            <div class="mailbox-toolbar-options">
              <label class="form-check rh-email-toggle-ignored">
                <input
                  class="form-check-input"
                  type="checkbox"
                  checked=${mostrarIgnorados}
                  onChange=${(event) => setMostrarIgnorados(event.target.checked)}
                />
                <span class="form-check-label">Mostrar ignorados/excluídos</span>
              </label>

              <label class="email-page-size-label">
                <span class="visually-hidden">Itens por página</span>
                <select
                  class="form-select form-select-sm rh-email-page-size email-page-size"
                  value=${String(tamanhoPagina)}
                  onChange=${(event) => setTamanhoPagina(Number(event.target.value) || 5)}
                >
                  <option value="2">2</option>
                  <option value="3">3</option>
                  <option value="5">5</option>
                  <option value="10">10</option>
                </select>
              </label>

              <button
                type="button"
                class="btn btn-outline-primary btn-sm rh-action-btn email-toolbar-btn"
                disabled=${carregando}
                onClick=${carregarEmails}
              >
                <span class="material-symbols-outlined">refresh</span>
                ${carregando ? 'Atualizando...' : 'Atualizar'}
              </button>

              ${compacto
                ? html`
                    <button
                      type="button"
                      class="btn btn-outline-secondary btn-sm rh-action-btn email-toolbar-btn"
                      onClick=${() => setAberta((valor) => !valor)}
                    >
                      <span class="material-symbols-outlined">${aberta ? 'expand_less' : 'expand_more'}</span>
                      ${aberta ? 'Recolher' : 'Expandir'}
                    </button>
                  `
                : null}
            </div>
          </div>
        `}
        tourId="home-email-inbox"
      >
        ${aberta
          ? html`
              ${payloadEmail && !payloadEmail.configured
                ? html`
                    <div class="alert alert-warning mailbox-config-alert">
                      <span class="material-symbols-outlined">error</span>
                      <div>
                        <strong>Caixa de e-mail corporativa ainda não configurada.</strong>
                        <span>Informe TENANT_ID, CLIENT_ID e CLIENT_SECRET no servidor.</span>
                      </div>
                    </div>
                  `
                : payloadEmail?.message
                  ? html`<div class=${`alert ${obterClasseAlertaEmail(payloadEmail)}`}>${payloadEmail.message}</div>`
                  : null}

              <div class="table-responsive email-table-shell">
                <table class="table align-middle rh-modern-history-table rh-email-inbox-table email-table">
                  <thead>
                    <tr>
                      ${compacto
                        ? null
                        : html`
                            <th class="email-select-cell">
                              <input
                                class="form-check-input"
                                type="checkbox"
                                aria-label="Selecionar e-mails desta página"
                                checked=${todosDaPaginaSelecionados}
                                onChange=${alternarSelecaoPagina}
                              />
                            </th>
                          `}
                      <th>Data</th>
                      <th>Remetente</th>
                      <th>Assunto</th>
                      ${compacto
                        ? null
                        : html`
                            <th>Nome detectado</th>
                            <th>Vaga detectada</th>
                            <th>Contato detectado</th>
                          `}
                      <th>Anexo/CV</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${paginacaoEmails.itens.length
                      ? paginacaoEmails.itens.map((item) => {
                          const dataHora = formatarPartesDataHoraEmail(item.data_recebimento);
                          const selecionado = idsSelecionados.includes(String(item.id));
                          return html`
                            <tr key=${item.id} class=${`email-row ${selecionado ? 'is-selected' : ''}`}>
                              ${compacto
                                ? null
                                : html`
                                    <td class="email-select-cell" data-label="Selecionar">
                                      <input
                                        class="form-check-input"
                                        type="checkbox"
                                        aria-label=${`Selecionar e-mail ${item.assunto || 'sem assunto'}`}
                                        checked=${selecionado}
                                        onChange=${() => alternarSelecaoEmail(item)}
                                      />
                                    </td>
                                  `}
                              <td class="email-date-cell" data-label="Data">
                                <span>${dataHora.data}</span>
                                <small>${dataHora.hora}</small>
                              </td>
                              <td class="email-sender-cell" data-label="Remetente">
                                <strong>${item.remetente_nome || item.remetente || 'Remetente não informado'}</strong>
                                ${item.remetente_email
                                  ? html`<small>${item.remetente_email}</small>`
                                  : null}
                              </td>
                              <td class="email-subject-cell" data-label="Assunto">
                                <div>${item.assunto || 'Sem assunto'}</div>
                              </td>
                              ${compacto
                                ? null
                                : html`
                                    <td data-label="Nome detectado">${item.nome_detectado || '-'}</td>
                                    <td data-label="Vaga detectada">${item.vaga_detectada || 'Não identificado'}</td>
                                    <td class="email-contact-cell" data-label="Contato detectado">
                                      <div>${item.telefone_detectado || 'Não identificado'}</div>
                                      <small>${item.email_detectado || '-'}</small>
                                    </td>
                                  `}
                              <td class="email-attachment-cell" data-label="Anexo/CV">
                                ${item.possui_anexo ? item.nome_anexo || 'Anexo recebido' : 'Sem anexo'}
                              </td>
                              <td class="email-status-cell" data-label="Status">
                                <span class=${`process-candidate-status-badge email-status-pill ${obterClasseStatusEmail(item.status)}`}>
                                  ${item.status || 'Recebido'}
                                </span>
                              </td>
                            </tr>
                          `;
                        })
                      : html`
                          <tr class="email-empty-row">
                            <td class="text-center text-muted py-4" colSpan=${compacto ? 5 : 9}>
                              <span class="material-symbols-outlined">inbox</span>
                              <span>${carregando ? 'Carregando currículos recebidos.' : 'Nenhum currículo recebido por e-mail para listar.'}</span>
                            </td>
                          </tr>
                        `}
                  </tbody>
                </table>
              </div>

              ${compacto
                ? html`
                    <${PaginacaoCompacta}
                      paginacao=${{ ...paginacaoEmails, tamanhoPagina }}
                      onChange=${setPaginaAtual}
                      label=${`Mostrando ${obterIntervaloPaginacao({ ...paginacaoEmails, tamanhoPagina })} de ${paginacaoEmails.totalItens} e-mail(s)`}
                    />
                  `
                : html`
                    <div class="email-pagination-row">
                      <small>Exibindo ${paginacaoEmails.itens.length} de ${paginacaoEmails.totalItens} e-mail(s).</small>
                      <${GrupoPaginacao}
                        paginaAtual=${paginacaoEmails.paginaAtual}
                        totalPaginas=${paginacaoEmails.totalPaginas}
                        onChange=${setPaginaAtual}
                      />
                    </div>
                  `}
            `
          : null}
      </${SectionCard}>

      ${!compacto && itensSelecionados.length
        ? html`
            <aside class="email-quick-actions" aria-live="polite">
              <header>
                <div>
                  <h3>Ações rápidas</h3>
                  <span>${itensSelecionados.length} ${itensSelecionados.length === 1 ? 'item selecionado' : 'itens selecionados'}</span>
                </div>
                <button
                  type="button"
                  class="email-quick-actions-close"
                  aria-label="Fechar ações rápidas"
                  onClick=${() => setIdsSelecionados([])}
                >
                  <span class="material-symbols-outlined">close</span>
                </button>
              </header>

              ${itemSelecionado
                ? html`
                    <div class="email-quick-actions-list">
                      <button type="button" onClick=${() => abrirDetalhesEmail(itemSelecionado)}>
                        <span class="material-symbols-outlined">mail</span>
                        Ver e-mail
                      </button>
                      <button
                        type="button"
                        disabled=${!itemSelecionado.possui_anexo || acaoEmAndamento === `cv:${itemSelecionado.id}` || !controlador?.possuiPermissao?.('candidatos.baixar_curriculo')}
                        onClick=${() => abrirCvEmail(itemSelecionado)}
                      >
                        <span class="material-symbols-outlined">description</span>
                        Ver CV
                      </button>
                      <button
                        type="button"
                        disabled=${!itemSelecionado.possui_anexo || acaoEmAndamento === `analisar:${itemSelecionado.id}` || !controlador?.possuiPermissao?.('candidatos.avaliar_curriculo')}
                        onClick=${() => analisarEmail(itemSelecionado)}
                      >
                        <span class="material-symbols-outlined">auto_awesome</span>
                        Analisar CV
                      </button>

                      <div class="email-quick-process-action">
                        <select
                          class="form-select form-select-sm"
                          aria-label="Processo para vínculo"
                          value=${selecoesProcesso[itemSelecionado.id] || ''}
                          onChange=${(event) => setSelecoesProcesso((anteriores) => ({
                            ...anteriores,
                            [itemSelecionado.id]: event.target.value,
                          }))}
                        >
                          <option value="">Selecione o processo</option>
                          ${processosAbertos.map((processo) => html`
                            <option key=${obterChaveProcesso(processo)} value=${obterReferenciaProcesso(processo)}>
                              ${processo.id_processo || processo.vaga || 'Processo'}
                            </option>
                          `)}
                        </select>
                        <button
                          type="button"
                          disabled=${!selecoesProcesso[itemSelecionado.id] || acaoEmAndamento === `vincular:${itemSelecionado.id}` || !controlador?.possuiPermissao?.('candidatos.criar')}
                          onClick=${() => vincularEmail(itemSelecionado)}
                        >
                          <span class="material-symbols-outlined">link</span>
                          Vincular ao processo
                        </button>
                      </div>

                      ${controlador?.possuiPermissao?.('candidatos.mover_etapa')
                        ? html`
                            <button
                              type="button"
                              disabled=${acaoEmAndamento === `banco:${itemSelecionado.id}`}
                              onClick=${() => enviarParaBanco(itemSelecionado)}
                            >
                              <span class="material-symbols-outlined">group</span>
                              Banco de Talentos
                            </button>
                          `
                        : null}
                    </div>
                  `
                : null}

              <div class="email-quick-actions-danger">
                ${controlador?.possuiPermissao?.('candidatos.mover_etapa')
                  ? html`
                      <button
                        type="button"
                        class="is-danger"
                        disabled=${!!acaoEmAndamento}
                        onClick=${itemSelecionado ? () => ignorarEmail(itemSelecionado) : ignorarEmailsSelecionados}
                      >
                        <span class="material-symbols-outlined">visibility_off</span>
                        Ignorar
                      </button>
                    `
                  : null}
                ${controlador?.possuiPermissao?.('candidatos.excluir')
                  ? html`
                      <button
                        type="button"
                        class="is-danger"
                        disabled=${!!acaoEmAndamento}
                        onClick=${itemSelecionado ? () => excluirEmail(itemSelecionado) : excluirEmailsSelecionados}
                      >
                        <span class="material-symbols-outlined">delete</span>
                        Excluir
                      </button>
                    `
                  : null}
              </div>
            </aside>
          `
        : null}

      <${ModalPadrao}
        aberto=${!!detalheEmail}
        titulo=${`E-mail recebido | ${detalheEmail?.assunto || 'Sem assunto'}`}
        subtitulo=${detalheEmail?.remetente || 'Remetente não informado'}
        onClose=${() => setDetalheEmail(null)}
      >
        <div class="rh-details-body">
          <div class="row g-3">
            <div class="col-md-6">
              <label class="form-label">Data de recebimento</label>
              <div>${formatarDataHora(detalheEmail?.data_recebimento)}</div>
            </div>
            <div class="col-md-6">
              <label class="form-label">Anexo/CV</label>
              <div>${detalheEmail?.nome_anexo || 'Sem anexo'}</div>
            </div>
            <div class="col-md-4">
              <label class="form-label">Nome detectado</label>
              <div>${detalheEmail?.nome_detectado || '-'}</div>
            </div>
            <div class="col-md-4">
              <label class="form-label">Telefone detectado</label>
              <div>${detalheEmail?.telefone_detectado || '-'}</div>
            </div>
            <div class="col-md-4">
              <label class="form-label">E-mail detectado</label>
              <div>${detalheEmail?.email_detectado || '-'}</div>
            </div>
            <div class="col-12">
              <label class="form-label">Corpo do e-mail</label>
              <pre class="rh-email-body-preview">${detalheEmail?.corpo || detalheEmail?.resumo_corpo || ''}</pre>
            </div>
          </div>
        </div>
        <footer class="rh-modal-footer">
          <button
            type="button"
            class="btn btn-outline-secondary"
            onClick=${() => setDetalheEmail(null)}
          >
            Fechar
          </button>
        </footer>
      </${ModalPadrao}>
    </div>
  `;
}

export function TelaLogin({ controlador }) {
  const [usuario, setUsuario] = useState('');
  const [senha, setSenha] = useState('');
  const [mensagemErro, setMensagemErro] = useState('');
  const [tourReopenSignal, setTourReopenSignal] = useState(0);
  const tourLogin = obterTourLogin();

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
        <div class="rh-login-hero" data-tour-id="login-hero">
          <div class="rh-login-hero-badge">Sistema Interno RH</div>
          <h1 class="rh-login-hero-title">Plataforma de provas, processos e análise.</h1>
          <p class="rh-login-hero-text">
            Um fluxo único para aplicação de provas, acompanhamento de candidatos,
            banco de talentos e análise operacional.
          </p>
          <div class="rh-login-hero-points">
            <span>Histórico consolidado</span>
            <span>Processos seletivos</span>
            <span>Análise de candidatos</span>
          </div>
        </div>

        <div
          class="rh-login-panel rh-login-panel-modern"
          data-tour-id="login-panel"
        >
          <div class="rh-login-brand-block rh-login-brand-block-centered">
            <img
              alt="Central 24h"
              class="rh-login-brand-image"
              src="estilos/logo_conecta_padrao.png"
            />
          </div>

          <div class="rh-login-copy-block">
            <h2 class="rh-login-welcome-title">Acesso ao ambiente RH</h2>
            <p class="rh-login-welcome-text">
              Entre com as credenciais para continuar.
            </p>
          </div>

          <div class="mb-3">
            <label class="form-label rh-login-label">Login</label>
            <div class="rh-login-input-wrap">
              <span class="material-symbols-outlined rh-login-input-icon">
                alternate_email
              </span>
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
                Ambiente restrito
              </button>
            </div>
            <div class="rh-login-input-wrap">
              <span class="material-symbols-outlined rh-login-input-icon">
                lock
              </span>
              <input
                class="form-control rh-login-input rh-login-input-modern"
                placeholder="••••••••"
                value=${senha}
                onInput=${(event) => setSenha(event.target.value)}
                type="password"
              />
            </div>
          </div>

          ${mensagemErro
      ? html`<div class="alert alert-danger mb-3">${mensagemErro}</div>`
      : null}

          <button
            class="btn rh-login-btn rh-login-btn-modern w-100"
            data-tour-id="login-submit"
            onClick=${enviar}
          >
            <span>Acessar sistema</span>
            <span class="material-symbols-outlined">arrow_forward</span>
          </button>

          <div class="rh-login-help-row">
            <${BotaoAjudaTour}
              compact=${true}
              label="Ver orientações"
              onClick=${() => setTourReopenSignal((valor) => valor + 1)}
            />
          </div>

          <div class="rh-login-footer-meta">
            <span>© 2026 Central 24h</span>
            <span>Privacidade</span>
            <span>Termos</span>
            <span>Suporte</span>
          </div>
        </div>
      </div>

      <${TourGuiado}
        screenId="screen-login"
        userId=""
        steps=${tourLogin.steps}
        reopenSignal=${tourReopenSignal}
      />
    </section>
  `;
}

export function TelaInicio({ controlador }) {
  const [carregando, setCarregando] = useState(true);
  const [recentes, setRecentes] = useState([]);
  const [processos, setProcessos] = useState([]);
  const [candidatosProcessos, setCandidatosProcessos] = useState([]);
  const [entrevistas, setEntrevistas] = useState([]);
  const [paginaRecentes, setPaginaRecentes] = useState(1);
  const [detalheAberto, setDetalheAberto] = useState(null);

  const carregar = async () => {
    setCarregando(true);
    try {
      const [
        resultadoHistorico,
        resultadoProcessos,
        resultadoCandidatos,
        resultadoEntrevistas,
      ] =
        await Promise.allSettled([
          lerHistorico(),
          lerProcessos(true),
          lerCandidatosProcessos(true),
          lerEntrevistas(),
        ]);
      const historico =
        resultadoHistorico.status === 'fulfilled'
          ? resultadoHistorico.value
          : [];
      const ordenado = (Array.isArray(historico) ? historico : [])
        .sort((a, b) =>
          String(b.data_iso || '').localeCompare(String(a.data_iso || '')),
        )
        .slice(0, TAMANHO_RECENTES);
      setRecentes(ordenado);
      setProcessos(
        resultadoProcessos.status === 'fulfilled' &&
          Array.isArray(resultadoProcessos.value)
          ? resultadoProcessos.value
          : [],
      );
      setCandidatosProcessos(
        resultadoCandidatos.status === 'fulfilled' &&
          Array.isArray(resultadoCandidatos.value)
          ? resultadoCandidatos.value
          : [],
      );
      setEntrevistas(
        resultadoEntrevistas.status === 'fulfilled' &&
          Array.isArray(resultadoEntrevistas.value)
          ? resultadoEntrevistas.value
          : [],
      );
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregar();
  }, []);

  const processosAtivos = useMemo(
    () => (Array.isArray(processos) ? processos : []).filter(
      (processo) => !isProcessClosed(processo.status),
    ),
    [processos],
  );

  const processosAndamento = useMemo(
    () =>
      processosAtivos
        .slice(0, 4)
        .map((processo) => {
          const referencia = obterReferenciaProcesso(processo);
          const idProcesso = String(processo.id_processo || '').trim();
          const candidatosVinculados = (Array.isArray(candidatosProcessos)
            ? candidatosProcessos
            : []
          ).filter((candidato) => {
            const referenciaCandidato = obterReferenciaProcessoDoCandidato(candidato);
            const idCandidato = String(candidato.id_processo || '').trim();
            return (
              (referencia && referenciaCandidato === referencia) ||
              (idProcesso && idCandidato === idProcesso)
            );
          });
          const candidatosAtivos = candidatosVinculados.filter(
            (candidato) => getCandidateVisibleStatus(candidato) !== 'Banco de Talentos',
          );
          const aprovados = Number(processo.vagas_preenchidas || 0) || candidatosVinculados.filter(
            (candidato) => getCandidateVisibleStatus(candidato) === 'Aprovado',
          ).length;
          const totalVagas = Number(processo.quantidade_vagas || 0);
          const percentual = totalVagas > 0
            ? Math.min(100, Math.round((aprovados / totalVagas) * 100))
            : Math.min(100, candidatosAtivos.length * 10);

          return {
            id: referencia || idProcesso || processo.vaga,
            nome: processo.nome_processo || processo.id_processo || processo.vaga || 'Processo',
            candidatos: candidatosAtivos.length,
            percentual,
          };
        }),
    [processosAtivos, candidatosProcessos],
  );

  const recentesPaginados = useMemo(
    () => obterItensPaginados(recentes, paginaRecentes, 3),
    [recentes, paginaRecentes],
  );

  const hojeIso = formatarDataParaInput(new Date());
  const entrevistasHoje = useMemo(
    () =>
      (Array.isArray(entrevistas) ? entrevistas : []).filter(
        (item) => formatarDataParaInput(item.data_entrevista) === hojeIso,
      ),
    [entrevistas, hojeIso],
  );
  const candidatosEmAnalise = useMemo(
    () =>
      (Array.isArray(candidatosProcessos) ? candidatosProcessos : []).filter(
        (candidato) =>
          normalizarTextoPainel(getCandidateVisibleStatus(candidato))
            .toLowerCase()
            .includes('analise'),
      ),
    [candidatosProcessos],
  );
  const alertasOperacionais = useMemo(
    () =>
      (Array.isArray(entrevistas) ? entrevistas : []).filter((item) => {
        const status = normalizarTextoPainel(item.status_entrevista).toLowerCase();
        return status.includes('falt') || status.includes('cancel');
      }),
    [entrevistas],
  );
  const candidatosAtivosResumo = useMemo(
    () =>
      (Array.isArray(candidatosProcessos) ? candidatosProcessos : []).filter((candidato) => {
        const status = normalizarTextoPainel(getCandidateVisibleStatus(candidato)).toLowerCase();
        return (
          !status.includes('banco') &&
          !status.includes('elimin') &&
          !status.includes('reprov') &&
          !status.includes('desist')
        );
      }),
    [candidatosProcessos],
  );
  const contratacoesResumo = useMemo(
    () =>
      (Array.isArray(candidatosProcessos) ? candidatosProcessos : []).filter(
        (candidato) => getCandidateVisibleStatus(candidato) === 'Aprovado',
      ),
    [candidatosProcessos],
  );
  const pendenciasResumo =
    candidatosEmAnalise.length + alertasOperacionais.length;
  const indicadoresPainel = useMemo(
    () => [
      {
        icon: 'groups',
        label: 'Candidatos ativos',
        value: candidatosAtivosResumo.length,
        helper: 'Em acompanhamento',
        variant: 'is-home is-blue',
      },
      {
        icon: 'folder_open',
        label: 'Processos abertos',
        value: processosAtivos.length,
        helper: 'Abertos agora',
        variant: 'is-home is-green',
      },
      {
        icon: 'calendar_month',
        label: 'Entrevistas hoje',
        value: entrevistasHoje.length,
        helper: 'Agenda do dia',
        variant: 'is-home is-yellow',
      },
      {
        icon: 'warning',
        label: 'Pendências',
        value: pendenciasResumo,
        helper: pendenciasResumo ? 'Requer atenção' : 'Sem alertas',
        variant: 'is-home is-red',
      },
      {
        icon: 'star',
        label: 'Contratações',
        value: contratacoesResumo.length,
        helper: 'Aprovados',
        variant: 'is-home is-blue',
      },
    ],
    [
      candidatosAtivosResumo.length,
      contratacoesResumo.length,
      entrevistasHoje.length,
      pendenciasResumo,
      processosAtivos.length,
    ],
  );
  const notificacoesDia = useMemo(() => {
    const processoRecente = processosAtivos[0];
    const candidatoAprovado = (Array.isArray(candidatosProcessos)
      ? candidatosProcessos
      : []
    ).find((candidato) => getCandidateVisibleStatus(candidato) === 'Aprovado');
    const notificacoes = [];

    if (candidatoAprovado) {
      notificacoes.push({
        icon: 'check_circle',
        variant: 'is-success',
        text: `Candidato aprovado para ${candidatoAprovado.vaga || 'vaga aberta'}`,
      });
    }

    if (processoRecente) {
      notificacoes.push({
        icon: 'folder_open',
        variant: 'is-info',
        text: `Processo seletivo aberto para ${processoRecente.vaga || processoRecente.id_processo || 'vaga'}`,
      });
    }

    if (alertasOperacionais.length) {
      notificacoes.push({
        icon: 'cancel',
        variant: 'is-danger',
        text: `${alertasOperacionais.length} alerta(s) de entrevista`,
      });
    }

    if (entrevistasHoje.length) {
      notificacoes.push({
        icon: 'groups',
        variant: 'is-purple',
        text: `${entrevistasHoje.length} candidatos agendados para hoje`,
      });
    }

    return notificacoes;
  }, [alertasOperacionais.length, candidatosProcessos, entrevistasHoje.length, processosAtivos]);

  return html`
    <${PainelRh}
      screenId="screen-menu"
      navAtiva="screen-menu"
      subtituloMarca="Plataforma de Recrutamento e Seleção"
      placeholderBusca="Buscar candidatos, processos, vagas ou provas..."
      controlador=${controlador}
      acaoPrimaria=${{
      label: 'Gerar prova',
      icon: 'assignment_add',
      permissao: 'provas.enviar',
      onClick: () => {
        try {
          sessionStorage.setItem('rh_open_generated_exam_modal_v1', '1');
        } catch (error) {
          // Navegacao ainda funciona se o navegador bloquear sessionStorage.
        }
        controlador.irParaTelaProtegida('screen-generated-exams');
      },
    }}
      acoesTopo=${html`<${AcaoSair} controlador=${controlador} />`}
    >
      <${PageIntro}
        title="Olá, RH!"
        description="Panorama geral do recrutamento hoje."
        actions=${html`
          <button
            type="button"
            class="btn btn-outline-secondary rh-action-btn c24-top-refresh-btn"
            onClick=${carregar}
          >
            <span class="material-symbols-outlined">refresh</span>
            Atualizar
          </button>
        `}
      />

      <${SectionCard}
        title="Acessos rápidos"
        className="home-quick-card"
        tourId="home-shortcuts"
      >
        <div class="home-quick-grid">
          ${[
            {
              label: 'Nova vaga',
              icon: 'work',
              permissao: 'vagas.criar',
              onClick: () => controlador.irParaTelaProtegida('screen-process-create'),
            },
            {
              label: 'Adicionar candidato',
              icon: 'person_add',
              permissao: 'candidatos.criar',
              onClick: () => controlador.irParaTelaProtegida('screen-candidates'),
            },
            {
              label: 'Agendar entrevista',
              icon: 'calendar_month',
              permissao: 'entrevistas.visualizar',
              onClick: () => controlador.irParaTelaProtegida('screen-interviews'),
            },
            {
              label: 'Enviar e-mail',
              icon: 'send',
              permissao: 'candidatos.criar',
              onClick: () => controlador.irParaTelaProtegida('screen-email-inbox'),
            },
            {
              label: 'Relatórios',
              icon: 'bar_chart',
              permissao: 'relatorios.visualizar',
              onClick: () => controlador.irParaTelaProtegida('screen-analysis-candidates'),
            },
            {
              label: 'Mais opções',
              icon: 'more_horiz',
              permissao: 'configuracoes.visualizar',
              onClick: () => controlador.irParaTelaProtegida('screen-settings'),
            },
          ]
            .filter((item) => !item.permissao || controlador.possuiPermissao(item.permissao))
            .map(
              (item) => html`
                <button
                  key=${item.label}
                  type="button"
                  class="home-quick-action"
                  onClick=${item.onClick}
                >
                  <span class="material-symbols-outlined">${item.icon}</span>
                  <strong>${item.label}</strong>
                </button>
              `,
            )}
        </div>
      </${SectionCard}>

      <${SectionCard}
        title="Resumo do dia"
        className="day-summary-card compact-dashboard-card"
      >
        <div class="day-summary-layout">
          <div class="day-summary-stats">
            ${[
              ...indicadoresPainel,
              {
                icon: 'notifications',
                label: 'Notificações do dia',
                value: notificacoesDia.length,
                variant: 'is-blue',
              },
            ].map(
              (item) => html`
                <article class=${`day-stat-card ${item.variant || ''}`} key=${item.label}>
                  <span class="material-symbols-outlined">${item.icon}</span>
                  <div>
                    <strong>${item.value}</strong>
                    <span>${item.label}</span>
                  </div>
                </article>
              `,
            )}
          </div>
        </div>
      </${SectionCard}>

      <div class="home-dashboard-grid home-dashboard-main-grid">
        <div class="home-dashboard-stack home-dashboard-stack--left">
          <${SectionCard}
            title="Entrevistas agendadas"
            className="processes-today-card compact-dashboard-card"
          >
            ${entrevistasHoje.length
              ? html`
                  <div class="processes-today-list">
                    ${entrevistasHoje.slice(0, 5).map(
                      (item) => html`
                        <article class="processes-today-item" key=${`${item.id_entrevista || item.id_slot || item.nome_candidato}-${item.data_entrevista}`}>
                          <span class="material-symbols-outlined">event_available</span>
                          <div>
                            <strong>${item.nome_candidato || 'Entrevista'}</strong>
                            <small>${item.vaga || item.id_processo || 'Processo'} • ${formatarDataHora(item.data_entrevista)}</small>
                          </div>
                          <span class=${`rh-status-pill ${obterClasseStatusEntrevista(item.status_entrevista)}`}>
                            ${item.status_entrevista || 'Agendada'}
                          </span>
                        </article>
                      `,
                    )}
                  </div>
                `
              : html`
                  <div class="home-empty-state">
                    <span class="material-symbols-outlined">calendar_month</span>
                    <h3>Nenhuma entrevista hoje</h3>
                    <p>As entrevistas agendadas para hoje aparecerão aqui.</p>
                  </div>
                `}
          </${SectionCard}>

          <${SecaoCurriculosRecebidosEmail} modo="resumo" controlador=${controlador} />
        </div>

        <div class="home-dashboard-stack home-dashboard-stack--right">
          <${SectionCard}
            title="Provas recentes"
            className="recent-records-card compact-dashboard-card"
            tourId="home-recent"
            actions=${html`
              <button
                type="button"
                class="btn btn-outline-secondary btn-sm"
                onClick=${() => controlador.irParaTelaProtegida('screen-history')}
              >
                Ver todos
              </button>
            `}
          >
            ${carregando
              ? html`<div class="alert alert-secondary">Carregando provas recentes...</div>`
              : recentes.length
                ? html`
                    <div class="rh-recent-grid">
                      ${recentesPaginados.itens.map(
                        (item) => html`
                          <button
                            key=${item.id_teste}
                            type="button"
                            class="rh-recent-card"
                            onClick=${async () =>
                              setDetalheAberto(
                                await carregarDetalhesProva(item.id_teste),
                              )}
                          >
                            <div class="rh-recent-avatar-wrap">
                              <span class="rh-recent-avatar">
                                ${String(item.nome_candidato || 'T')
                                  .trim()
                                  .slice(0, 1)
                                  .toUpperCase()}
                              </span>
                            </div>
                            <div class="rh-recent-card-body">
                              <strong>${item.nome_candidato || '-'}</strong>
                              <span>${item.vaga || '-'}</span>
                              <span>${item.data_exibicao || '-'}</span>
                            </div>
                            <span class="material-symbols-outlined">arrow_forward</span>
                          </button>
                        `,
                      )}
                    </div>
                    <${PaginacaoCompacta}
                      paginacao=${{ ...recentesPaginados, tamanhoPagina: 3 }}
                      onChange=${setPaginaRecentes}
                      label=${`Mostrando ${obterIntervaloPaginacao({
                        ...recentesPaginados,
                        tamanhoPagina: 3,
                      })} de ${recentesPaginados.totalItens}`}
                    />
                  `
                : html`
                    <${EmptyState}
                      title="Nenhum registro salvo"
                      text="Assim que uma prova for concluída e salva, ela aparecerá aqui."
                    />
                  `}
          </${SectionCard}>

          <${SectionCard}
            title="Processos em andamento"
            className="process-progress-card compact-dashboard-card"
          >
            ${processosAndamento.length
              ? html`
                  <div class="process-progress-list active-process-list">
                    ${processosAndamento.map(
                      (item) => html`
                        <article class="process-progress-item active-process-card" key=${item.id}>
                          <div class="active-process-info">
                            <strong>${item.nome}</strong>
                            <div class="active-process-meta">
                              <span>${item.candidatos} candidatos</span>
                              <span>${item.percentual}% preenchido</span>
                            </div>
                            <div class="active-process-progress" aria-hidden="true">
                              <span style=${{ width: `${item.percentual}%` }}></span>
                            </div>
                          </div>
                          <div class="active-process-actions">
                            <button
                              type="button"
                              class="btn-soft-primary"
                              onClick=${() => controlador.irParaTelaProtegida('screen-processes')}
                            >
                              Ver processos
                            </button>
                          </div>
                        </article>
                      `,
                    )}
                  </div>
                `
              : html`
                  <${EmptyState}
                    title="Nenhum processo em andamento"
                    text="Os processos abertos aparecerão aqui assim que forem cadastrados."
                  />
                `}
          </${SectionCard}>
        </div>
      </div>

      <${ModalDetalhesProva}
        detalhe=${detalheAberto}
        onClose=${() => setDetalheAberto(null)}
        onDownload=${() =>
      baixarPacoteHistorico(
        detalheAberto?.linha?.id_teste,
        detalheAberto?.linha?.nome_candidato || 'candidato',
      )}
        onCandidateDetails=${async () => {
          try {
            await abrirFichaCandidatoDaProva(detalheAberto);
          } catch (error) {
            window.alert('Não foi possível localizar a ficha deste candidato.');
          }
        }}
      />
    </${PainelRh}>
  `;
}

export function TelaCaixaEmail({ controlador }) {
  return html`
    <${PainelRh}
      screenId="screen-email-inbox"
      navAtiva="screen-email-inbox"
      subtituloMarca="Central 24h"
      placeholderBusca="Caixa de e-mail"
      controlador=${controlador}
      acoesTopo=${html`<${AcaoSair} controlador=${controlador} />`}
    >
      <${PageIntro}
        kicker="Currículos recebidos"
        title="Caixa de E-mail"
        description=""
      />

      <${SecaoCurriculosRecebidosEmail}
        modo="completo"
        controlador=${controlador}
      />
    </${PainelRh}>
  `;
}

export function TelaHistorico({ controlador }) {
  const [carregando, setCarregando] = useState(true);
  const [linhas, setLinhas] = useState([]);
  const [pagina, setPagina] = useState(1);
  const [paginacao, setPaginacao] = useState({
    paginaAtual: 1,
    totalPaginas: 1,
    totalItens: 0,
  });
  const [filtros, setFiltros] = useState({ nome: '', vaga: '', data: '' });
  const [detalheAberto, setDetalheAberto] = useState(null);
  const [mapaStatus, setMapaStatus] = useState({});

  useEffect(() => {
    (async () => {
      setCarregando(true);
      try {
        const [historico, statusAtual] = await Promise.all([
          lerHistoricoPaginado({
            pagina,
            tamanho: TAMANHO_HISTORICO,
            nome: filtros.nome,
            vaga: filtros.vaga,
            data: filtros.data,
          }),
          construirMapaStatusAtual(),
        ]);
        setLinhas(Array.isArray(historico?.items) ? historico.items : []);
        setPaginacao({
          paginaAtual: historico?.page || pagina,
          totalPaginas: historico?.total_pages || 1,
          totalItens: historico?.total_items || 0,
        });
        setMapaStatus(statusAtual);
      } finally {
        setCarregando(false);
      }
    })();
  }, [filtros, pagina]);

  return html`
    <${PainelRh}
      screenId="screen-history"
      navAtiva="screen-history"
      subtituloMarca="Histórico de provas"
      placeholderBusca="Consulta do histórico de avaliações"
      controlador=${controlador}
      acaoPrimaria=${{
      label: 'Iniciar teste',
      permissao: 'provas.enviar',
      onClick: () => controlador.iniciarNovoFluxo(),
    }}
      acoesTopo=${html`<${AcaoSair} controlador=${controlador} />`}
    >
      <${PageIntro}
        kicker="Console • Histórico"
        title="Histórico de exames"
        description="Consulte resultados salvos com filtros por candidato, vaga e data."
      />

      <${BlocoFiltro} tourId="history-filters">
        <div class="rh-filter-grid">
          <${CampoFiltro} label="Candidato" icon="person_search">
            <input
              class="form-control"
              placeholder="Pesquisar por nome..."
              value=${filtros.nome}
              onInput=${(event) => {
      setPagina(1);
      setFiltros({ ...filtros, nome: event.target.value });
    }}
            />
          </${CampoFiltro}>

          <${CampoFiltro} label="Vaga" icon="work">
            <input
              class="form-control"
              placeholder="Pesquisar por vaga..."
              value=${filtros.vaga}
              onInput=${(event) => {
      setPagina(1);
      setFiltros({ ...filtros, vaga: event.target.value });
    }}
            />
          </${CampoFiltro}>

          <${CampoFiltro} label="Data" icon="calendar_month">
            <input
              class="form-control"
              type="date"
              value=${filtros.data}
              onInput=${(event) => {
      setPagina(1);
      setFiltros({ ...filtros, data: event.target.value });
    }}
            />
          </${CampoFiltro}>
        </div>
      </${BlocoFiltro}>

      <${SectionCard}
        title="Resultados salvos"
        description="Tabela consolidada com status atualizado e ações de consulta."
        tourId="history-results"
      >
        <div class="table-responsive">
          <table class="table align-middle rh-modern-history-table">
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
      ? html`<${TabelaVazia} colunas=${7} texto="Carregando histórico..." />`
      : linhas.length
        ? linhas.map(
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
                            <div class="d-flex justify-content-end gap-2 flex-wrap">
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
        : html`
                      <${TabelaVazia}
                        colunas=${7}
                        texto="Nenhum registro encontrado para os filtros informados."
                      />
                    `}
            </tbody>
          </table>
        </div>

        <${GrupoPaginacao}
          paginaAtual=${paginacao.paginaAtual}
          totalPaginas=${paginacao.totalPaginas}
          onChange=${setPagina}
        />
      </${SectionCard}>

      <${ModalDetalhesProva}
        detalhe=${detalheAberto}
        onClose=${() => setDetalheAberto(null)}
        onDownload=${() =>
      baixarPacoteHistorico(
        detalheAberto?.linha?.id_teste,
        detalheAberto?.linha?.nome_candidato || 'candidato',
      )}
        onCandidateDetails=${async () => {
          try {
            await abrirFichaCandidatoDaProva(detalheAberto);
          } catch (error) {
            window.alert('Não foi possível localizar a ficha deste candidato.');
          }
        }}
      />
    </${PainelRh}>
  `;
}

export function TelaCriarProcesso({ controlador }) {
  const [formulario, setFormulario] = useState({
    vaga: '',
    quantidade: 1,
    dataEncerramento: '',
    operacao: '',
    trilha: '',
    usaNotaCorte: false,
    notaCorte: '',
    areaProva: '',
    nivelProva: '',
    tempoTotal: 40,
    tipoProva: 'Processo seletivo',
    observacoesInternas: '',
    personalizacaoInteligente: false,
    clientesPersonalizacao: [],
    clienteOutro: '',
    tiposAtendimento: [],
    tipoAtendimentoOutro: '',
    nivelPersonalizacao: 'situacional',
    tomProva: 'Humanizado',
    situacaoPraticaOperacao: '',
  });
  const [etapaAtual, setEtapaAtual] = useState(1);
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  const regras = obterRegrasFormularioProcesso(formulario.vaga);
  const trilhaEfetiva = regras.trilhaFixa || formulario.trilha;
  const trilhaBlueprint = normalizarTrilhaProvaProcesso(
    formulario.areaProva || trilhaEfetiva,
  );

  useEffect(() => {
    if (regras.trilhaFixa && formulario.trilha !== regras.trilhaFixa) {
      setFormulario((anterior) => ({ ...anterior, trilha: regras.trilhaFixa }));
    }
  }, [regras.trilhaFixa, formulario.trilha]);

  useEffect(() => {
    if (!formulario.vaga) return;
    const opcao = obterOpcaoVagaProvaProcesso(formulario.vaga);
    const areaSugerida = normalizarTextoPainel(opcao?.track || trilhaEfetiva || '');
    const nivelSugerido = normalizarNivelProvaProcesso(
      SUGESTOES_NIVEL_POR_VAGA[formulario.vaga] || opcao?.level || '',
    );
    setFormulario((anterior) => ({
      ...anterior,
      areaProva: anterior.areaProva || areaSugerida,
      nivelProva: anterior.nivelProva || nivelSugerido,
      trilha: anterior.trilha || normalizarTrilhaProvaProcesso(areaSugerida),
    }));
  }, [formulario.vaga]);

  const blueprint = useMemo(() => {
    if (!formulario.vaga || !formulario.nivelProva) return null;
    return resolverBlueprintProva(
      formulario.vaga,
      formulario.nivelProva,
      trilhaBlueprint,
    );
  }, [formulario.vaga, formulario.nivelProva, trilhaBlueprint]);

  const questoes = useMemo(
    () => (blueprint ? montarProvaPorBlueprint(blueprint) : []),
    [blueprint],
  );
  const etapasProva = useMemo(
    () => montarEtapasBlueprintProcesso(blueprint),
    [blueprint],
  );
  const categoriasProva = useMemo(
    () => obterCategoriasQuestoesProcesso(questoes),
    [questoes],
  );
  const opcoesAreasProva = useMemo(
    () => montarOpcoesComValorProcesso(OPCOES_AREAS_PROVA_PROCESSO, formulario.areaProva),
    [formulario.areaProva],
  );
  const opcoesNiveisProva = useMemo(() => {
    if (
      !formulario.nivelProva ||
      OPCOES_NIVEL_PROVA_PROCESSO.some(
        (opcao) =>
          normalizarBuscaPainel(opcao.value) === normalizarBuscaPainel(formulario.nivelProva),
      )
    ) {
      return OPCOES_NIVEL_PROVA_PROCESSO;
    }
    return [
      { value: formulario.nivelProva, label: formulario.nivelProva },
      ...OPCOES_NIVEL_PROVA_PROCESSO,
    ];
  }, [formulario.nivelProva]);
  const opcoesOperacoesPersonalizacao = useMemo(
    () =>
      Array.from(
        new Set(
          [
            ...OPCOES_OPERACOES,
            formulario.operacao,
            'CRF / Flamengo',
            'Davita',
            'Endoview',
            'Newe Seguros',
            'Central24Horas',
          ]
            .map((item) => normalizarTextoPainel(item))
            .filter(Boolean),
        ),
      ),
    [formulario.operacao],
  );

  const atualizarCampo = (campo, valor) => {
    setFormulario((anterior) => ({
      ...anterior,
      [campo]: valor,
      ...(campo === 'vaga'
        ? {
            areaProva: '',
            nivelProva: '',
          }
        : {}),
      ...(campo === 'areaProva'
        ? { trilha: normalizarTrilhaProvaProcesso(valor) || anterior.trilha }
        : {}),
    }));
    setErro('');
  };

  const montarDadosPersonalizacao = () => {
    const clientes = montarListaComOutroProcesso(
      formulario.clientesPersonalizacao,
      formulario.clienteOutro,
    );
    const tiposAtendimento = montarListaComOutroProcesso(
      formulario.tiposAtendimento,
      formulario.tipoAtendimentoOutro,
    );

    return {
      enabled: Boolean(formulario.personalizacaoInteligente),
      clientes,
      tiposAtendimento,
      operacao: clientes.join(', '),
      tipo_atendimento: tiposAtendimento,
      nivel_personalizacao: formulario.nivelPersonalizacao,
      tom_prova: normalizarTextoPainel(formulario.tomProva),
      situacao_pratica: normalizarTextoPainel(formulario.situacaoPraticaOperacao),
      situacao_pratica_operacao: normalizarTextoPainel(formulario.situacaoPraticaOperacao),
    };
  };

  const montarConfiguracaoPersonalizacao = (personalizacao) => ({
    operacao: personalizacao.operacao,
    cliente: personalizacao.operacao,
    clientesOperacoes: personalizacao.clientes,
    vaga: formulario.vaga,
    area: formulario.areaProva,
    trilha: trilhaBlueprint,
    nivelProva: formulario.nivelProva,
    perfilOperacao: inferirPerfilAtendimentoPersonalizacao({
      clientes: personalizacao.clientes,
      tipos: personalizacao.tiposAtendimento,
      area: formulario.areaProva,
      vaga: formulario.vaga,
    }) || inferirPerfilOperacaoProcesso(formulario),
    tiposAtendimento: personalizacao.tiposAtendimento,
    nivelPersonalizacao: personalizacao.nivel_personalizacao,
    tomProva: formulario.tomProva,
    situacaoPratica: formulario.situacaoPraticaOperacao,
    usuario:
      controlador?.estado?.nomeUsuarioAutenticado ||
      controlador?.estado?.usuarioAutenticado ||
      'RH',
  });

  const validarEtapaDadosProcesso = () =>
    validarFormularioProcesso(
      {
        vaga: formulario.vaga,
        quantidade: formulario.quantidade,
        dataEncerramento: formulario.dataEncerramento,
        operacao: formulario.operacao,
        trilha: trilhaEfetiva,
        usaNotaCorte: formulario.usaNotaCorte,
        notaCorte: formulario.notaCorte,
      },
      regras,
    );

  const validarEtapaProva = () => {
    if (
      !formulario.areaProva ||
      !formulario.nivelProva ||
      !Number(formulario.tempoTotal) ||
      !blueprint ||
      !questoes.length
    ) {
      return 'Selecione área/trilha, nível e tempo com uma configuração de prova válida.';
    }
    if (formulario.personalizacaoInteligente) {
      const personalizacao = montarDadosPersonalizacao();
      if (!personalizacao.clientes.length) {
        return 'Selecione ao menos um Cliente/Operação para personalizar a prova.';
      }
      if (!personalizacao.tiposAtendimento.length) {
        return 'Selecione ao menos um tipo de atendimento para personalizar a prova.';
      }
    }
    return '';
  };

  const montarConfiguracaoProva = () => {
    const personalizacao = montarDadosPersonalizacao();
    const configuracaoPersonalizacao = formulario.personalizacaoInteligente
      ? montarConfiguracaoPersonalizacao(personalizacao)
      : null;
    const resultadoPersonalizacao = formulario.personalizacaoInteligente
      ? gerarPersonalizacaoProva(questoes, configuracaoPersonalizacao)
      : null;
    const questoesSnapshot = resultadoPersonalizacao?.questoes?.length
      ? resultadoPersonalizacao.questoes
      : questoes;
    const configuradaEm = new Date().toISOString();

    return {
      versao: 1,
      origem: 'processo_seletivo',
      status: 'configurada',
      configurada_em: configuradaEm,
      vaga: formulario.vaga,
      area: formulario.areaProva,
      area_prova: formulario.areaProva,
      nivel: formulario.nivelProva,
      tempo_total: Number(formulario.tempoTotal || 40),
      tempo_minutos: Number(formulario.tempoTotal || 40),
      tipo_prova: formulario.tipoProva,
      quantidade_questoes: questoesSnapshot.length,
      etapas: etapasProva,
      categorias: categoriasProva,
      questoes_snapshot: questoesSnapshot,
      observacoes_internas_rh: formulario.observacoesInternas,
      tom_prova: formulario.tomProva,
      situacao_pratica_operacao: formulario.situacaoPraticaOperacao,
      personalizacao,
      configuracao: {
        blueprint_key: blueprint?.key || '',
        blueprint_label: blueprint?.label || formulario.areaProva || '',
        area_prova: formulario.areaProva,
        area: formulario.areaProva,
        trilha_blueprint: trilhaBlueprint,
        setor_cliente: formulario.personalizacaoInteligente
          ? personalizacao.operacao
          : formulario.operacao,
        operacao: formulario.personalizacaoInteligente
          ? personalizacao.operacao
          : formulario.operacao,
        personalizacao_inteligente: Boolean(formulario.personalizacaoInteligente),
        personalizacao: formulario.personalizacaoInteligente
          ? {
              ...personalizacao,
              operacao: personalizacao.operacao,
              setor_cliente: personalizacao.operacao,
              tom_prova: formulario.tomProva,
              situacao_pratica_operacao: formulario.situacaoPraticaOperacao,
              tipos_atendimento: personalizacao.tiposAtendimento,
              perfil_operacao: configuracaoPersonalizacao?.perfilOperacao,
              nivel_personalizacao: configuracaoPersonalizacao?.nivelPersonalizacao,
              historico: resultadoPersonalizacao?.historico || null,
              alertas: resultadoPersonalizacao?.alertas || [],
            }
          : {
              enabled: false,
              opcional: true,
              mensagem: 'Prova padrão configurada para este processo seletivo.',
            },
        entrevista_obrigatoria: false,
      },
    };
  };

  const avancar = () => {
    const mensagemErro = etapaAtual === 1 ? validarEtapaDadosProcesso() : validarEtapaProva();
    if (mensagemErro) {
      setErro(mensagemErro);
      return;
    }
    setErro('');
    setEtapaAtual((etapa) => Math.min(3, etapa + 1));
  };

  const criar = async () => {
    const mensagemErro = validarEtapaDadosProcesso() || validarEtapaProva();
    if (mensagemErro) {
      setErro(mensagemErro);
      return;
    }

    setErro('');
    setSalvando(true);

    try {
      const configuracaoProva = montarConfiguracaoProva();
      await criarProcesso({
        id_processo: montarIdProcesso(formulario.vaga),
        vaga: formulario.vaga,
        quantidade_vagas: Number(formulario.quantidade),
        vagas_preenchidas: 0,
        data_encerramento: formulario.dataEncerramento,
        operacao: formulario.operacao,
        trilha: trilhaEfetiva,
        usa_nota_corte: formulario.usaNotaCorte ? 1 : 0,
        nota_corte: formulario.usaNotaCorte
          ? Number(formulario.notaCorte)
          : null,
        status: 'Aberto',
        data_criacao: new Date().toISOString(),
        link_agendamento: '',
        configuracao_prova_json: JSON.stringify(configuracaoProva),
        prova_configurada_em: configuracaoProva.configurada_em,
      });

      controlador.irParaTelaProtegida('screen-processes');
    } catch (error) {
      setErro(error?.message || 'Não foi possível criar o processo.');
    } finally {
      setSalvando(false);
    }
  };

  return html`
    <${PainelRh}
      screenId="screen-process-create"
      navAtiva="screen-process-create"
      subtituloMarca="Novo processo seletivo"
      placeholderBusca="Cadastro de novo processo"
      controlador=${controlador}
      acaoPrimaria=${{
      label: 'Ver processos',
      onClick: () => controlador.irParaTelaProtegida('screen-processes'),
    }}
      acoesTopo=${html`<${AcaoSair} controlador=${controlador} />`}
    >
      <${PageIntro}
        kicker="Console • Novo processo"
        title=${`Etapa ${etapaAtual}: ${
    etapaAtual === 1
      ? 'Dados do Processo'
      : etapaAtual === 2
        ? 'Configuração da Prova'
        : 'Publicação'
  }`}
        description="Cadastre a vaga e configure a prova vinculada ao processo seletivo."
      />

      <div class="process-create-shell">
        <div class="process-create-stepper" aria-label="Etapas do processo seletivo">
          ${[
            ['1', 'Dados do Processo'],
            ['2', 'Configuração da Prova'],
            ['3', 'Publicação'],
          ].map(([numero, label], indice) => {
    const etapa = indice + 1;
    return html`
              <div class=${`process-create-step ${etapaAtual === etapa ? 'is-active' : ''} ${etapaAtual > etapa ? 'is-done' : ''}`} key=${numero}>
                <span>${etapaAtual > etapa ? html`<i class="material-symbols-outlined">check</i>` : numero}</span>
                <strong>${label}</strong>
              </div>
            `;
  })}
        </div>

        <div class="process-create-grid">
          <div class="process-create-main">
            ${etapaAtual === 1
      ? html`
                  <section class="process-create-card" tour-id="process-create-form">
                    <div class="process-create-section-title">
                      <span class="material-symbols-outlined">work</span>
                      <h2>Informações da Vaga</h2>
                    </div>
                    <div class="process-create-form-grid">
                      <label class="process-create-field is-wide">
                        <span>Vaga do processo</span>
                        <select value=${formulario.vaga} onChange=${(event) => atualizarCampo('vaga', event.target.value)}>
                          <option value="">Selecione...</option>
                          ${OPCOES_VAGAS_PROCESSO.map(
        (opcao) => html`<option key=${opcao.label} value=${opcao.label}>${opcao.label}</option>`,
      )}
                        </select>
                      </label>
                      <label class="process-create-field">
                        <span>Quantidade de vagas</span>
                        <input type="number" min="1" value=${formulario.quantidade} onInput=${(event) => atualizarCampo('quantidade', event.target.value)} />
                      </label>
                      <label class="process-create-field">
                        <span>Data de encerramento</span>
                        <input type="date" value=${formulario.dataEncerramento} onInput=${(event) => atualizarCampo('dataEncerramento', event.target.value)} />
                      </label>
                      <label class="process-create-field">
                        <span>Operação / Cliente</span>
                        <select value=${formulario.operacao} onChange=${(event) => atualizarCampo('operacao', event.target.value)}>
                          <option value="">Selecione...</option>
                          ${OPCOES_OPERACOES.map(
        (operacao) => html`<option key=${operacao} value=${operacao}>${operacao}</option>`,
      )}
                        </select>
                      </label>
                      <label class="process-create-field">
                        <span>Área / Trilha</span>
                        <select disabled=${!!regras.trilhaFixa} value=${trilhaEfetiva} onChange=${(event) => atualizarCampo('trilha', event.target.value)}>
                          <option value="">Selecione...</option>
                          ${OPCOES_TRILHAS_PROCESSO.map(
        (opcao) => html`<option key=${opcao.value} value=${opcao.value}>${opcao.label}</option>`,
      )}
                        </select>
                      </label>
                    </div>
                  </section>
                  <section class="process-create-card">
                    <div class="process-create-section-title">
                      <span class="material-symbols-outlined">rule</span>
                      <h2>Critérios de Avaliação</h2>
                    </div>
                    <div class="process-cutoff-panel">
                      <label class="process-switch-row">
                        <input type="checkbox" checked=${formulario.usaNotaCorte} onChange=${(event) => atualizarCampo('usaNotaCorte', event.target.checked)} />
                        <span class="process-switch-visual"></span>
                        <span>
                          <strong>Ativar nota de corte</strong>
                          <small>Candidatos abaixo da nota serão desclassificados automaticamente.</small>
                        </span>
                      </label>
                      <label class="process-create-field process-cutoff-score">
                        <span>Nota mínima</span>
                        <input type="number" min="4" max="10" step="0.1" disabled=${!formulario.usaNotaCorte} value=${formulario.notaCorte} onInput=${(event) => atualizarCampo('notaCorte', event.target.value)} />
                      </label>
                    </div>
                  </section>
                `
      : null}

            ${etapaAtual === 2
      ? html`
                  <section class="process-create-card">
                    <div class="process-create-section-title">
                      <span class="material-symbols-outlined">settings_applications</span>
                      <h2>Dados da Prova</h2>
                    </div>
                    <div class="process-create-form-grid">
                      <label class="process-create-field">
                        <span>Área / Trilha</span>
                        <select value=${formulario.areaProva} onChange=${(event) => atualizarCampo('areaProva', event.target.value)}>
                          <option value="">Selecione...</option>
                          ${opcoesAreasProva.map(
        (opcao) => html`<option key=${opcao} value=${opcao}>${opcao}</option>`,
      )}
                        </select>
                      </label>
                      <label class="process-create-field">
                        <span>Nível da prova</span>
                        <select value=${formulario.nivelProva} onChange=${(event) => atualizarCampo('nivelProva', event.target.value)}>
                          <option value="">Selecione...</option>
                          ${opcoesNiveisProva.map(
        (opcao) => html`<option key=${opcao.value} value=${opcao.value}>${opcao.label}</option>`,
      )}
                        </select>
                      </label>
                      <label class="process-create-field">
                        <span>Tempo total</span>
                        <input type="number" min="1" max="300" value=${formulario.tempoTotal} onInput=${(event) => atualizarCampo('tempoTotal', event.target.value)} />
                      </label>
                      <label class="process-create-field">
                        <span>Tipo de prova</span>
                        <select value=${formulario.tipoProva} onChange=${(event) => atualizarCampo('tipoProva', event.target.value)}>
                          <option>Processo seletivo</option>
                          <option>Triagem técnica</option>
                          <option>Avaliação operacional</option>
                        </select>
                      </label>
                      <label class="process-create-field is-wide">
                        <span>Observações internas</span>
                        <textarea rows="3" value=${formulario.observacoesInternas} onInput=${(event) => atualizarCampo('observacoesInternas', event.target.value)}></textarea>
                      </label>
                    </div>
                    <div class="process-blueprint-preview">
                      <span class="material-symbols-outlined">fact_check</span>
                      <div>
                        <strong>${blueprint?.label || 'Blueprint não selecionado'}</strong>
                        <small>${questoes.length ? `${questoes.length} questões em ${etapasProva.length} etapa(s)` : 'Escolha vaga, trilha e nível para montar a prova.'}</small>
                      </div>
                    </div>
                  </section>

                  <section class="process-create-card">
                    <div class="process-create-section-title">
                      <span class="material-symbols-outlined">palette</span>
                      <h2>Personalização</h2>
                    </div>
                    <label class="process-personalization-toggle">
                      <input type="checkbox" checked=${formulario.personalizacaoInteligente} onChange=${(event) => atualizarCampo('personalizacaoInteligente', event.target.checked)} />
                      <span>
                        <strong>Personalizar prova por operação/cliente</strong>
                        <small>Opcional. A prova padrão permanece disponível se esta opção ficar desmarcada.</small>
                      </span>
                    </label>
                    ${formulario.personalizacaoInteligente
        ? html`
                          <div class="process-create-form-grid mt-3">
                            <label class="process-create-field">
                              <span>Cliente/Operação</span>
                              <select multiple value=${formulario.clientesPersonalizacao} onChange=${(event) => atualizarCampo('clientesPersonalizacao', lerValoresMultiselectProcesso(event))}>
                                ${[...opcoesOperacoesPersonalizacao, OPCAO_OUTRO_PROCESSO].map(
            (opcao) => html`<option key=${opcao} value=${opcao} selected=${formulario.clientesPersonalizacao.includes(opcao)}>${opcao}</option>`,
          )}
                              </select>
                            </label>
                            <label class="process-create-field">
                              <span>Tipo de atendimento</span>
                              <select multiple value=${formulario.tiposAtendimento} onChange=${(event) => atualizarCampo('tiposAtendimento', lerValoresMultiselectProcesso(event))}>
                                ${[...TIPOS_ATENDIMENTO_PERSONALIZACAO, OPCAO_OUTRO_PROCESSO].map(
            (opcao) => html`<option key=${opcao} value=${opcao} selected=${formulario.tiposAtendimento.includes(opcao)}>${opcao}</option>`,
          )}
                              </select>
                            </label>
                            ${formulario.clientesPersonalizacao.includes(OPCAO_OUTRO_PROCESSO)
            ? html`
                                  <label class="process-create-field">
                                    <span>Outro cliente/operação</span>
                                    <input value=${formulario.clienteOutro} onInput=${(event) => atualizarCampo('clienteOutro', event.target.value)} />
                                  </label>
                                `
            : null}
                            ${formulario.tiposAtendimento.includes(OPCAO_OUTRO_PROCESSO)
            ? html`
                                  <label class="process-create-field">
                                    <span>Outro tipo de atendimento</span>
                                    <input value=${formulario.tipoAtendimentoOutro} onInput=${(event) => atualizarCampo('tipoAtendimentoOutro', event.target.value)} />
                                  </label>
                                `
            : null}
                            <label class="process-create-field">
                              <span>Nível de personalização</span>
                              <select value=${formulario.nivelPersonalizacao} onChange=${(event) => atualizarCampo('nivelPersonalizacao', event.target.value)}>
                                ${NIVEIS_PERSONALIZACAO.map(
            (nivel) => html`<option key=${nivel.id} value=${nivel.id}>${nivel.label}: ${nivel.descricao}</option>`,
          )}
                              </select>
                            </label>
                            <label class="process-create-field">
                              <span>Tom da prova</span>
                              <select value=${formulario.tomProva} onChange=${(event) => atualizarCampo('tomProva', event.target.value)}>
                                ${OPCOES_TOM_PROVA_PROCESSO.map(
            (opcao) => html`<option key=${opcao} value=${opcao}>${opcao}</option>`,
          )}
                              </select>
                            </label>
                            <label class="process-create-field is-wide">
                              <span>Situação prática da operação</span>
                              <textarea rows="3" value=${formulario.situacaoPraticaOperacao} placeholder="Ex.: candidato atuará com atendimento receptivo em operação de saúde." onInput=${(event) => atualizarCampo('situacaoPraticaOperacao', event.target.value)}></textarea>
                            </label>
                          </div>
                        `
        : null}
                  </section>
                `
      : null}

            ${etapaAtual === 3
      ? html`
                  <section class="process-create-card">
                    <div class="process-create-section-title">
                      <span class="material-symbols-outlined">publish</span>
                      <h2>Publicação / Finalização</h2>
                    </div>
                    <div class="process-final-review">
                      ${[
        ['Vaga', formulario.vaga || '-'],
        ['Quantidade', `${formulario.quantidade || 0} vaga(s)`],
        ['Encerramento', formatarDataResumoProcesso(formulario.dataEncerramento)],
        ['Operação', formulario.operacao || '-'],
        ['Área / Trilha', trilhaEfetiva || '-'],
        ['Nota de corte', formulario.usaNotaCorte ? formulario.notaCorte || '-' : 'Não ativada'],
        ['Prova', blueprint?.label || '-'],
        ['Tempo', `${formulario.tempoTotal || 0} min`],
        ['Personalização', formulario.personalizacaoInteligente ? 'Ativada' : 'Não ativada'],
      ].map(
        ([label, value]) => html`
                          <span key=${label}>
                            <strong>${label}</strong>
                            ${value}
                          </span>
                        `,
      )}
                    </div>
                    <div class="process-blueprint-preview is-ready">
                      <span class="material-symbols-outlined">check_circle</span>
                      <div>
                        <strong>Prova configurada para o processo</strong>
                        <small>Ao publicar, esta configuração fica disponível para liberar prova aos candidatos deste processo.</small>
                      </div>
                    </div>
                  </section>
                `
      : null}
          </div>

          <aside class="process-create-summary">
            <h3><span class="material-symbols-outlined">info</span>Resumo do processo</h3>
            <dl>
              <div><dt>Vaga</dt><dd>${formulario.vaga || '-'}</dd></div>
              <div><dt>Quantidade</dt><dd>${String(formulario.quantidade || 0).padStart(2, '0')} vaga(s)</dd></div>
              <div><dt>Encerramento</dt><dd>${formatarDataResumoProcesso(formulario.dataEncerramento)}</dd></div>
              <div><dt>Cliente</dt><dd>${formulario.operacao || '-'}</dd></div>
              <div><dt>Prova</dt><dd>${blueprint?.label || '-'}</dd></div>
              <div><dt>Questões</dt><dd>${questoes.length || '-'}</dd></div>
            </dl>
            <div class="process-create-summary-note">
              <span class="material-symbols-outlined">verified</span>
              A prova configurada aqui fica vinculada ao processo seletivo.
            </div>
          </aside>
        </div>

        ${erro ? html`<div class="alert alert-danger mt-3">${erro}</div>` : null}

        <footer class="process-create-actions">
          <button
            type="button"
            class="btn btn-outline-secondary"
            disabled=${salvando}
            onClick=${() =>
      etapaAtual > 1
        ? setEtapaAtual((etapa) => etapa - 1)
        : controlador.irParaTelaProtegida('screen-processes')}
          >
            <span class="material-symbols-outlined">arrow_back</span>
            Voltar
          </button>
          <div>
            <button
              type="button"
              class="btn btn-outline-secondary"
              disabled=${salvando}
              onClick=${() => controlador.irParaTelaProtegida('screen-processes')}
            >
              Cancelar
            </button>
            ${etapaAtual < 3
      ? html`
                  <button type="button" class="btn btn-primary" disabled=${salvando} onClick=${avancar}>
                    Próximo passo
                    <span class="material-symbols-outlined">arrow_forward</span>
                  </button>
                `
      : html`
                  <button type="button" class="btn btn-primary" disabled=${salvando} onClick=${criar}>
                    ${salvando ? 'Publicando...' : 'Publicar processo'}
                    <span class="material-symbols-outlined">check</span>
                  </button>
                `}
          </div>
        </footer>
      </div>
    </${PainelRh}>
  `;
}

export function TelaBancoTalentos({ controlador }) {
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [linhas, setLinhas] = useState([]);
  const [processosAbertos, setProcessosAbertos] = useState([]);
  const [candidatoParaUtilizar, setCandidatoParaUtilizar] = useState(null);
  const [processoSelecionadoUso, setProcessoSelecionadoUso] = useState('');
  const [perfilEdicao, setPerfilEdicao] = useState(null);
  const [formularioPerfil, setFormularioPerfil] = useState({
    tags: '',
    habilidades: '',
    observacao_rh: '',
  });
  const [filtros, setFiltros] = useState({
    busca: '',
    habilidade: '',
    tag: '',
  });

  const carregar = async () => {
    setCarregando(true);
    setErro('');

    try {
      const [banco, processos] = await Promise.all([
        lerBancoTalentos({
          forcar: true,
          search: filtros.busca,
          skill: filtros.habilidade,
          tag: filtros.tag,
        }),
        lerProcessos(true),
      ]);

      setLinhas(Array.isArray(banco) ? banco : []);
      setProcessosAbertos(
        (Array.isArray(processos) ? processos : []).filter(
          (processo) => !isProcessClosed(processo),
        ),
      );
    } catch (error) {
      setErro(
        error?.message || 'Não foi possível carregar o banco de talentos.',
      );
      setLinhas([]);
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregar();
  }, [filtros.busca, filtros.habilidade, filtros.tag]);

  const abrirCurriculo = async (candidato) => {
    if (!candidato?.id_teste || !candidato?.cv_disponivel) {
      window.alert('Não há currículo disponível para este candidato.');
      return;
    }

    try {
      const arquivo = await baixarCvCandidato(candidato.id_teste);
      const tipo = String(arquivo?.contentType || '').toLowerCase();
      if (tipo.includes('pdf')) {
        abrirBlobEmNovaGuia(arquivo.blob);
        return;
      }

      baixarBlob(arquivo.filename || 'curriculo', arquivo.blob);
    } catch (error) {
      setErro(
        error?.message || 'Não foi possível abrir o currículo do candidato.',
      );
    }
  };

  const remover = async (idBanco) => {
    if (!window.confirm('Deseja eliminar este candidato do banco de talentos?')) {
      return;
    }

    setSalvando(true);
    setErro('');
    try {
      await removerBancoTalentos(idBanco);
      await carregar();
    } catch (error) {
      setErro(
        error?.message || 'Não foi possível remover o candidato do banco.',
      );
    } finally {
      setSalvando(false);
    }
  };

  const abrirEdicaoPerfil = (candidato) => {
    setPerfilEdicao(candidato);
    setFormularioPerfil({
      tags: Array.isArray(candidato.tags) ? candidato.tags.join(', ') : '',
      habilidades: Array.isArray(candidato.habilidades)
        ? candidato.habilidades.join(', ')
        : '',
      observacao_rh: candidato.observacao_rh || '',
    });
  };

  const salvarPerfil = async () => {
    if (!perfilEdicao) return;

    const mensagemErro = validarPerfilCandidato(formularioPerfil);
    if (mensagemErro) {
      setErro(mensagemErro);
      return;
    }

    setSalvando(true);
    setErro('');

    try {
      await atualizarPerfilCandidato(perfilEdicao.id_teste, {
        nome_candidato: perfilEdicao.nome_candidato,
        tags: quebrarListaTexto(formularioPerfil.tags),
        habilidades: quebrarListaTexto(formularioPerfil.habilidades),
        observacao_rh: formularioPerfil.observacao_rh,
      });
      setPerfilEdicao(null);
      await carregar();
    } catch (error) {
      setErro(error?.message || 'Não foi possível atualizar o perfil RH.');
    } finally {
      setSalvando(false);
    }
  };

  const confirmarUso = async () => {
    if (!candidatoParaUtilizar || !processoSelecionadoUso) {
      window.alert('Selecione um processo antes de continuar.');
      return;
    }

    const confirmar = window.confirm(
      `Deseja realmente utilizar o candidato ${candidatoParaUtilizar?.nome_candidato || ''} no processo ${processoSelecionadoUso}?`,
    );
    if (!confirmar) return;

    setSalvando(true);
    setErro('');

    try {
      const processoSelecionado = processosAbertos.find(
        (processo) => obterReferenciaProcesso(processo) === processoSelecionadoUso,
      );
      await usarCandidatoDoBancoTalentos(candidatoParaUtilizar.id_banco, {
        id_processo: processoSelecionado?.id_processo || '',
        id_processo_ref: processoSelecionadoUso,
      });

      setCandidatoParaUtilizar(null);
      setProcessoSelecionadoUso('');
      await carregar();
    } catch (error) {
      setErro(
        error?.message || 'Não foi possível reutilizar o candidato selecionado.',
      );
    } finally {
      setSalvando(false);
    }
  };

  return html`
    <${PainelRh}
      screenId="screen-talent-bank"
      navAtiva="screen-talent-bank"
      subtituloMarca="Banco de talentos"
      placeholderBusca="Reaproveitamento de candidatos"
      controlador=${controlador}
      acoesTopo=${html`<${AcaoSair} controlador=${controlador} />`}
    >
      <${PageIntro}
        kicker="Console • Banco de talentos"
        title="Banco de talentos"
        description=""
      />

      ${erro ? html`<div class="rh-inline-alert">${erro}</div>` : null}

      <${SectionCard}
        title="Filtros"
        description=""
        tourId="talent-filters"
      >
        <div class="rh-filter-grid rh-filter-grid--wide">
          <div class="rh-filter-field">
            <label>Busca por nome</label>
            <input
              class="form-control"
              placeholder="Nome, vaga ou processo"
              value=${filtros.busca}
              onInput=${(event) =>
      setFiltros({ ...filtros, busca: event.target.value })}
            />
          </div>
          <div class="rh-filter-field">
            <label>Habilidade</label>
            <input
              class="form-control"
              placeholder="Excel, Atendimento, TI..."
              value=${filtros.habilidade}
              onInput=${(event) =>
      setFiltros({ ...filtros, habilidade: event.target.value })}
            />
          </div>
          <div class="rh-filter-field">
            <label>Tag</label>
            <input
              class="form-control"
              placeholder="Prioritário, Boa aderência..."
              value=${filtros.tag}
              onInput=${(event) =>
      setFiltros({ ...filtros, tag: event.target.value })}
            />
          </div>
        </div>
      </${SectionCard}>

      <${SectionCard}
        title="Lista atual"
        description="Reaproveitamento, perfil RH e filtros avançados funcionando sobre dados persistidos."
        tourId="talent-table"
      >
        ${carregando
      ? html`
              <${LoadingState}
                titulo="Carregando banco de talentos"
                descricao="Buscando candidatos, tags e observações persistidas."
              />
            `
      : html`
              <div class="table-responsive">
                <table class="table align-middle rh-modern-history-table">
                  <thead>
                    <tr>
                      <th>Processo</th>
                      <th>Candidato</th>
                      <th>Cidade</th>
                      <th>Bairro</th>
                      <th>Vaga</th>
                      <th>Nota</th>
                      <th>Habilidades / tags</th>
                      <th>Observações RH</th>
                      <th>Entrevista</th>
                      <th>CV</th>
                      <th class="text-end">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${linhas.length
          ? linhas.map(
            (linha) => html`
                            <tr key=${linha.id_banco}>
                              <td>${linha.id_processo || '-'}</td>
                              <td>
                                <strong>${linha.nome_candidato || '-'}</strong>
                                <div class="small text-muted mt-1">
                                  ${formatarDataHora(linha.data_movimentacao)}
                                </div>
                              </td>
                              <td>${linha.cidade || '-'}</td>
                              <td>${linha.bairro || '-'}</td>
                              <td>${linha.vaga || '-'}</td>
                              <td>${linha.pontuacao_final || '-'}</td>
                              <td>
                                <div class="rh-cell-stack">
                                  <div class="rh-chip-wrap">
                                    ${(linha.habilidades || []).map(
              (item) => html`
                                        <span key=${item} class="rh-chip is-skill">${item}</span>
                                      `,
            )}
                                    ${(linha.tags || []).map(
              (item) => html`
                                        <span key=${item} class="rh-chip">${item}</span>
                                      `,
            )}
                                  </div>
                                  <small>${linha.origem || '-'}</small>
                                </div>
                              </td>
                              <td>${linha.observacao_rh || 'Sem observações.'}</td>
                              <td>
                                ${linha.status_entrevista
                ? html`
                                      <div class="rh-cell-stack">
                                        <span
                                          class=${`rh-status-pill ${obterClasseStatusEntrevista(linha.status_entrevista)}`}
                                        >
                                          ${linha.status_entrevista}
                                        </span>
                                        <small>${formatarDataHora(linha.data_entrevista)}</small>
                                      </div>
                                    `
                : 'Não agendada'}
                              </td>
                              <td>
                                ${linha.cv_disponivel
                ? html`
                                      <button
                                        type="button"
                                        class="btn btn-sm btn-outline-secondary"
                                        onClick=${() => abrirCurriculo(linha)}
                                      >
                                        Ver CV
                                      </button>
                                    `
                : 'Sem CV'}
                              </td>
                              <td class="text-end">
                                <div class="d-flex justify-content-end gap-2 flex-wrap">
                                  <button
                                    type="button"
                                    class="btn btn-sm btn-outline-secondary"
                                    onClick=${() => abrirEdicaoPerfil(linha)}
                                  >
                                    Perfil RH
                                  </button>
                                  <button
                                    type="button"
                                    class="btn btn-sm btn-outline-danger"
                                    disabled=${salvando}
                                    onClick=${() => remover(linha.id_banco)}
                                  >
                                    Eliminar
                                  </button>
                                  <button
                                    type="button"
                                    class="btn btn-sm btn-outline-primary"
                                    onClick=${() => {
                setCandidatoParaUtilizar(linha);
                setProcessoSelecionadoUso('');
              }}
                                  >
                                    Utilizar
                                  </button>
                                </div>
                              </td>
                            </tr>
                          `,
          )
          : html`
                          <${TabelaVazia}
                            colunas=${11}
                            texto="Nenhum candidato no banco de talentos."
                          />
                        `}
                  </tbody>
                </table>
              </div>
            `}
      </${SectionCard}>

      <${ModalPadrao}
        aberto=${!!candidatoParaUtilizar}
        titulo="Utilizar candidato"
        subtitulo="Selecione o processo aberto e confirme a reutilização."
        onClose=${() => {
      setCandidatoParaUtilizar(null);
      setProcessoSelecionadoUso('');
    }}
      >
        <div class="rh-details-body">
          <label class="form-label">Processo aberto</label>
          <select
            class="form-select"
            value=${processoSelecionadoUso}
            onChange=${(event) => setProcessoSelecionadoUso(event.target.value)}
          >
            <option value="">Selecione...</option>
              ${processosAbertos.map(
      (processo) => html`
                <option key=${obterChaveProcesso(processo)} value=${obterReferenciaProcesso(processo)}>
                  ${processo.id_processo} • ${processo.vaga} •
                  ${processo.operacao || processo.trilha || '-'}
                </option>
              `,
    )}
          </select>
        </div>
        <footer class="rh-modal-footer">
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
          <button
            type="button"
            class="btn btn-primary"
            disabled=${salvando}
            onClick=${confirmarUso}
          >
            Confirmar utilização
          </button>
        </footer>
      </${ModalPadrao}>

      <${ModalPadrao}
        aberto=${!!perfilEdicao}
        titulo="Perfil RH do candidato"
        subtitulo="Cadastre habilidades, tags e observações persistidas para reutilização futura."
        onClose=${() => setPerfilEdicao(null)}
      >
        ${perfilEdicao
      ? html`
              <div class="rh-details-body">
                <div class="row g-3">
                  <div class="col-md-12">
                    <label class="form-label">Candidato</label>
                    <input
                      class="form-control"
                      readonly
                      value=${perfilEdicao.nome_candidato || ''}
                    />
                  </div>
                  <div class="col-md-12">
                    <label class="form-label">Habilidades</label>
                    <input
                      class="form-control"
                      placeholder="Excel, Atendimento, Administrativo..."
                      value=${formularioPerfil.habilidades}
                      onInput=${(event) =>
          setFormularioPerfil({
            ...formularioPerfil,
            habilidades: event.target.value,
          })}
                    />
                  </div>
                  <div class="col-md-12">
                    <label class="form-label">Tags</label>
                    <input
                      class="form-control"
                      placeholder="Prioritário, Boa aderência..."
                      value=${formularioPerfil.tags}
                      onInput=${(event) =>
          setFormularioPerfil({
            ...formularioPerfil,
            tags: event.target.value,
          })}
                    />
                  </div>
                  <div class="col-md-12">
                    <label class="form-label">Observação RH</label>
                    <textarea
                      class="form-control"
                      rows="5"
                      value=${formularioPerfil.observacao_rh}
                      onInput=${(event) =>
          setFormularioPerfil({
            ...formularioPerfil,
            observacao_rh: event.target.value,
          })}
                    ></textarea>
                  </div>
                </div>
              </div>
              <footer class="rh-modal-footer">
                <button
                  type="button"
                  class="btn btn-outline-secondary"
                  onClick=${() => setPerfilEdicao(null)}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  class="btn btn-primary"
                  disabled=${salvando}
                  onClick=${salvarPerfil}
                >
                  ${salvando ? 'Salvando...' : 'Salvar perfil'}
                </button>
              </footer>
            `
      : null}
      </${ModalPadrao}>
    </${PainelRh}>
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
      <${EmptyState}
        title="Sem dados para o gráfico"
        text="Não há informações suficientes para exibir a comparação."
      />
    `;
  }

  return html`
    <div class="rh-analysis-chart">
      ${dados.map(
    (item, indice) => html`
          <div key=${indice} class="rh-analysis-chart-row">
            <div class="rh-analysis-chart-label">${item.label || '-'}</div>
            <div class="rh-analysis-chart-bars">
              <div class="rh-analysis-chart-bar-track">
                <div
                  class="rh-analysis-chart-bar is-obtained"
                  style=${{
        width: `${(Number(item?.obtained || 0) / maiorValor) * 100}%`,
      }}
                ></div>
              </div>
              <div class="rh-analysis-chart-bar-track">
                <div
                  class="rh-analysis-chart-bar is-expected"
                  style=${{
        width: `${(Number(item?.expected || 0) / maiorValor) * 100}%`,
      }}
                ></div>
              </div>
            </div>
            <div class="rh-analysis-chart-value">
              ${formatarNotaAnalise(item?.obtained || 0)} x
              ${formatarNotaAnalise(item?.expected || 0)}
            </div>
          </div>
        `,
  )}
    </div>
  `;
}

export function TelaAnaliseCandidatos({ controlador }) {
  const [linhas, setLinhas] = useState([]);
  const [pagina, setPagina] = useState(1);
  const [relatorioAtivo, setRelatorioAtivo] = useState('processos');
  const [carregandoRelatorio, setCarregandoRelatorio] = useState(false);
  const [relatorioProcessos, setRelatorioProcessos] = useState([]);
  const [relatorioCandidatos, setRelatorioCandidatos] = useState([]);
  const [filtrosRelatorio, setFiltrosRelatorio] = useState({
    dataInicial: '',
    dataFinal: '',
    status: '',
    processo: '',
  });
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

  const carregarRelatorios = async () => {
    setCarregandoRelatorio(true);
    try {
      const [processos, candidatos] = await Promise.all([
        lerRelatorioProcessos(filtrosRelatorio),
        lerRelatorioCandidatos(filtrosRelatorio),
      ]);
      setRelatorioProcessos(Array.isArray(processos) ? processos : []);
      setRelatorioCandidatos(Array.isArray(candidatos) ? candidatos : []);
    } finally {
      setCarregandoRelatorio(false);
    }
  };

  const baixarRelatorioAtivo = async () => {
    const arquivo =
      relatorioAtivo === 'processos'
        ? await baixarRelatorioProcessos(filtrosRelatorio)
        : await baixarRelatorioCandidatos(filtrosRelatorio);
    baixarBlob(arquivo.filename || 'relatorio.csv', arquivo.blob);
  };

  useEffect(() => {
    carregarAnalises();
    carregarRelatorios();
  }, []);

  const filtrado = useMemo(
    () =>
      linhas.filter((linha) => {
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
          if (!Number.isNaN(notaMinima)) {
            matchNota = notaAtual >= notaMinima;
          }
        }

        return matchProcesso && matchCandidato && matchVaga && matchNota;
      }),
    [linhas, filtros],
  );

  const paginado = obterItensPaginados(filtrado, pagina, TAMANHO_ANALISE);
  const detalheEstadoAcoes = useMemo(
    () => getCandidateActionState(detalhe || {}, detalhe?.status_processo || ''),
    [detalhe],
  );

  const aplicarAcao = async (statusCandidato) => {
    if (!detalhe?.id_teste) return;
    if (detalheEstadoAcoes.processClosed) {
      window.alert('O processo seletivo deste candidato está encerrado e não permite novas movimentações.');
      return;
    }
    if (
      statusCandidato === 'Aprovado' &&
      !detalheEstadoAcoes.canApprove
    ) {
      window.alert('A aprovação não está disponível para o status atual deste candidato.');
      return;
    }
    if (
      statusCandidato === 'Eliminado' &&
      !detalheEstadoAcoes.canEliminate
    ) {
      window.alert('A eliminação não está disponível para o status atual deste candidato.');
      return;
    }
    if (
      statusCandidato === 'Banco de talentos' &&
      !detalheEstadoAcoes.canSendToTalentBank
    ) {
      window.alert('O envio para banco de talentos não está disponível para o status atual deste candidato.');
      return;
    }

    const candidatosProcesso = await lerCandidatosProcessos(true);
    const vinculo = candidatosProcesso.find(
      (item) =>
        String(item.id_teste || '').trim() ===
        String(detalhe.id_teste || '').trim(),
    );

    if (!vinculo) {
      window.alert(
        'Não foi possível localizar o vínculo do candidato com o processo.',
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
      placeholderBusca="Inteligência analítica do RH"
      controlador=${controlador}
      mostrarAtalhos=${false}
      acoesTopo=${html`<${AcaoSair} controlador=${controlador} />`}
    >
      <${PageIntro}
        kicker="Console • Relatórios"
        title="Relatórios e análise por candidato"
        description="Exporte processos e candidatos por período, mantendo a análise individual disponível para consulta operacional."
      />

      <${SectionCard}
        title="Relatórios exportáveis"
        description="Os dados são gerados sob demanda pela API, sem criar arquivo permanente no servidor."
        actions=${html`
          <button
            type="button"
            class="btn btn-outline-secondary"
            disabled=${carregandoRelatorio}
            onClick=${carregarRelatorios}
          >
            Atualizar
          </button>
          <button
            type="button"
            class="btn btn-primary"
            disabled=${carregandoRelatorio}
            onClick=${baixarRelatorioAtivo}
          >
            Exportar CSV
          </button>
        `}
      >
        <div class="d-flex gap-2 flex-wrap mb-3">
          <button
            type="button"
            class=${`btn ${relatorioAtivo === 'processos' ? 'btn-primary' : 'btn-outline-primary'}`}
            onClick=${() => setRelatorioAtivo('processos')}
          >
            Relatório de Processos
          </button>
          <button
            type="button"
            class=${`btn ${relatorioAtivo === 'candidatos' ? 'btn-primary' : 'btn-outline-primary'}`}
            onClick=${() => setRelatorioAtivo('candidatos')}
          >
            Relatório de Candidatos
          </button>
        </div>

        <div class="rh-filter-grid rh-filter-grid--wide mb-4">
          <div class="rh-filter-field">
            <label>Data inicial</label>
            <input
              class="form-control"
              type="date"
              value=${filtrosRelatorio.dataInicial}
              onInput=${(event) =>
      setFiltrosRelatorio({
        ...filtrosRelatorio,
        dataInicial: event.target.value,
      })}
            />
          </div>
          <div class="rh-filter-field">
            <label>Data final</label>
            <input
              class="form-control"
              type="date"
              value=${filtrosRelatorio.dataFinal}
              onInput=${(event) =>
      setFiltrosRelatorio({
        ...filtrosRelatorio,
        dataFinal: event.target.value,
      })}
            />
          </div>
          <div class="rh-filter-field">
            <label>Status candidato</label>
            <select
              class="form-select"
              value=${filtrosRelatorio.status}
              disabled=${relatorioAtivo !== 'candidatos'}
              onChange=${(event) =>
      setFiltrosRelatorio({
        ...filtrosRelatorio,
        status: event.target.value,
      })}
            >
              <option value="">Todos</option>
              <option value="Aprovado">Aprovado</option>
              <option value="Eliminado">Eliminado/Reprovado</option>
              <option value="Banco de talentos">Banco de Talentos</option>
              <option value="Analise">Em andamento</option>
            </select>
          </div>
          <div class="rh-filter-field">
            <label>Processo</label>
            <input
              class="form-control"
              value=${filtrosRelatorio.processo}
              disabled=${relatorioAtivo !== 'candidatos'}
              onInput=${(event) =>
      setFiltrosRelatorio({
        ...filtrosRelatorio,
        processo: event.target.value,
      })}
            />
          </div>
        </div>

        ${relatorioAtivo === 'processos'
      ? html`
              <div class="table-responsive">
                <table class="table align-middle rh-modern-history-table">
                  <thead>
                    <tr>
                      <th>Processo</th>
                      <th>Vaga</th>
                      <th>Vagas</th>
                      <th>Aprovados</th>
                      <th>Eliminados/Reprovados</th>
                      <th>Abertura</th>
                      <th>Encerramento</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${relatorioProcessos.length
          ? relatorioProcessos.slice(0, 12).map(
            (linha) => html`
                            <tr key=${`${linha.nome_relatorio_processo}-${linha.data_abertura}`}>
                              <td>${linha.nome_relatorio_processo || '-'}</td>
                              <td>${linha.vaga || '-'}</td>
                              <td>${linha.quantidade_vagas ?? '-'}</td>
                              <td>${linha.quantidade_aprovados ?? 0}</td>
                              <td>${linha.quantidade_eliminados_reprovados ?? 0}</td>
                              <td>${formatarDataHora(linha.data_abertura)}</td>
                              <td>${linha.data_encerramento || '-'}</td>
                              <td>${linha.status_processo || '-'}</td>
                            </tr>
                          `,
          )
          : html`<${TabelaVazia} colunas=${8} texto="Nenhum processo no período." />`}
                  </tbody>
                </table>
              </div>
            `
      : html`
              <div class="table-responsive">
                <table class="table align-middle rh-modern-history-table">
                  <thead>
                    <tr>
                      <th>Candidato</th>
                      <th>Processo</th>
                      <th>Vaga</th>
                      <th>Origem</th>
                      <th>Movimentações</th>
                      <th>Nota</th>
                      <th>Status</th>
                      <th>Classificação RH</th>
                      <th>Justificativa RH</th>
                      <th>CV</th>
                      <th>Última movimentação</th>
                      <th>Aprovação</th>
                      <th>Eliminação/Reprovação</th>
                      <th>Motivo eliminação</th>
                      <th>Etapa eliminação</th>
                      <th>Banco</th>
                      <th>Contato</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${relatorioCandidatos.length
          ? relatorioCandidatos.slice(0, 12).map(
            (linha) => html`
                            <tr key=${`${linha.nome_candidato}-${linha.processo}-${linha.status}`}>
                              <td>${linha.nome_candidato || '-'}</td>
                              <td>${linha.processo || '-'}</td>
                              <td>${linha.vaga || '-'}</td>
                              <td>${linha.origem_inicial || '-'}</td>
                              <td>${linha.movimentacoes || '-'}</td>
                              <td>${linha.nota_prova || 'Sem prova'}</td>
                              <td>
                                <span class=${`rh-status-pill ${obterClasseStatusEntrevista(linha.status_atual || linha.status)}`}>
                                  ${linha.status_atual || linha.status || '-'}
                                </span>
                              </td>
                              <td>${linha.classificacao_rh || '-'}</td>
                              <td>${linha.justificativa_observacoes_rh || linha.observacao_rh || '-'}</td>
                              <td>
                                <div>${linha.cv_disponivel || '-'}</div>
                                <div class="small text-muted">${linha.cv_arquivo || linha.cv_classificacao || '-'}</div>
                              </td>
                              <td>${formatarDataHora(linha.data_movimentacao)}</td>
                              <td>${formatarDataHora(linha.data_aprovacao)}</td>
                              <td>${formatarDataHora(linha.data_eliminacao_reprovacao)}</td>
                              <td>${linha.motivo_eliminacao || (String(linha.status_atual || linha.status || '').toLowerCase().includes('eliminado') ? 'Motivo não informado' : '-')}</td>
                              <td>${linha.etapa_eliminacao || '-'}</td>
                              <td>${formatarDataHora(linha.data_banco_talentos)}</td>
                              <td>
                                <div>${mascararEmailContato(linha.email)}</div>
                                <div class="small text-muted">${mascararTelefoneContato(linha.telefone)}</div>
                              </td>
                            </tr>
                          `,
          )
          : html`<${TabelaVazia} colunas=${17} texto="Nenhum candidato no período." />`}
                  </tbody>
                </table>
              </div>
            `}
      </${SectionCard}>

      <${BlocoFiltro} tourId="analysis-filters">
        <div class="rh-filter-grid rh-filter-grid--wide">
          <${CampoFiltro} label="Processo" icon="folder_managed">
            <input
              class="form-control"
              value=${filtros.processo}
              onInput=${(event) => {
      setPagina(1);
      setFiltros({ ...filtros, processo: event.target.value });
    }}
            />
          </${CampoFiltro}>
          <${CampoFiltro} label="Candidato" icon="person_search">
            <input
              class="form-control"
              value=${filtros.candidato}
              onInput=${(event) => {
      setPagina(1);
      setFiltros({ ...filtros, candidato: event.target.value });
    }}
            />
          </${CampoFiltro}>
          <${CampoFiltro} label="Vaga" icon="work">
            <input
              class="form-control"
              value=${filtros.vaga}
              onInput=${(event) => {
      setPagina(1);
      setFiltros({ ...filtros, vaga: event.target.value });
    }}
            />
          </${CampoFiltro}>
          <${CampoFiltro} label="Nota mínima" icon="star">
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
          </${CampoFiltro}>
        </div>
      </${BlocoFiltro}>

      <${SectionCard}
        title="Ranking analítico"
        description="O modal de detalhe respeita o status atual do candidato e bloqueia movimentações em processo encerrado."
        tourId="analysis-ranking"
      >
        <div class="table-responsive">
          <table class="table align-middle rh-modern-history-table">
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
                          <span class=${obterClasseAderencia(linha.recomendacao)}>
                            ${linha.recomendacao || '-'}
                          </span>
                        </td>
                        <td>${getCandidateVisibleStatus(linha) || '-'}</td>
                        <td class="text-end">
                          <button
                            type="button"
                            class="btn btn-sm btn-outline-primary"
                            onClick=${async () =>
            setDetalhe(
              await lerDetalheAnaliseCandidato(linha.id_teste),
            )}
                          >
                            Detalhes
                          </button>
                        </td>
                      </tr>
                    `,
      )
      : html`
                    <${TabelaVazia}
                      colunas=${8}
                      texto="Nenhuma análise disponível."
                    />
                  `}
            </tbody>
          </table>
        </div>

        <${GrupoPaginacao}
          paginaAtual=${paginado.paginaAtual}
          totalPaginas=${paginado.totalPaginas}
          onChange=${setPagina}
        />
      </${SectionCard}>

      <${ModalPadrao}
        aberto=${!!detalhe}
        titulo=${`Análise do candidato • ${detalhe?.nome_candidato || 'Candidato'}`}
        subtitulo="Comparativo analítico entre desempenho e expectativa da vaga."
        onClose=${() => setDetalhe(null)}
      >
        ${detalhe
      ? html`
              <div class="rh-details-body">
                <${MetricGrid}
                  items=${[
          { label: 'Processo', value: detalhe.id_processo || '-' },
          { label: 'Candidato', value: detalhe.nome_candidato || '-' },
          { label: 'Vaga', value: detalhe.vaga || '-' },
          {
            label: 'Nota final',
            value: formatarNotaAnalise(detalhe.nota_final),
          },
          {
            label: 'Afinidade',
            value: `${formatarPercentualAfinidade(
              detalhe.afinidade_percentual,
            )}%`,
          },
          {
            label: 'Recomendação',
            value: html`
                        <span class=${obterClasseAderencia(detalhe.recomendacao)}>
                          ${detalhe.recomendacao || '-'}
                        </span>
                      `,
          },
          {
            label: 'Status atual',
            value: getCandidateVisibleStatus(detalhe) || '-',
          },
          {
            label: 'Processo',
            value: detalhe.status_processo || 'Aberto',
          },
        ]}
                />

                <${SectionCard}
                  title="Etapas comparadas"
                  className="rh-section-card--flat"
                >
                  <${GraficoComparativoAnalise} itens=${detalhe.grafico || []} />
                </${SectionCard}>

                <${SectionCard}
                  title="Observações"
                  className="rh-section-card--flat"
                >
                  <div class="rh-detail-list">
                    <div>
                      Nota textual geral:
                      ${formatarNotaAnalise(
          detalhe?.analise_texto?.overall || 0,
        )}
                    </div>
                    ${(detalhe.ressalvas || []).map(
          (item, indice) => html`<div key=${indice}>${item}</div>`,
        )}
                    <div>${detalhe.parecer_final || '-'}</div>
                  </div>
                </${SectionCard}>
              </div>

              <footer class="rh-modal-footer">
                <div class="rh-modal-footer-actions">
                  ${detalheEstadoAcoes.canApprove
          ? html`
                        <button
                          type="button"
                          class="btn btn-outline-success"
                          onClick=${() => aplicarAcao('Aprovado')}
                        >
                          Aprovar
                        </button>
                      `
          : null}
                  ${detalheEstadoAcoes.canEliminate
          ? html`
                        <button
                          type="button"
                          class="btn btn-outline-danger"
                          onClick=${() => aplicarAcao('Eliminado')}
                        >
                          Eliminar
                        </button>
                      `
          : null}
                  ${detalheEstadoAcoes.canSendToTalentBank
          ? html`
                        <button
                          type="button"
                          class="btn btn-outline-secondary"
                          onClick=${() => aplicarAcao('Banco de talentos')}
                        >
                          Banco de talentos
                        </button>
                      `
          : null}
                  ${!detalheEstadoAcoes.canApprove &&
          !detalheEstadoAcoes.canEliminate &&
          !detalheEstadoAcoes.canSendToTalentBank
          ? html`
                        <span class="text-muted">
                          ${isProcessClosed(detalhe?.status_processo)
              ? 'Processo encerrado: sem movimentações.'
              : 'Sem ações operacionais para o status atual.'}
                        </span>
                      `
          : null}
                </div>
                <button
                  type="button"
                  class="btn btn-primary"
                  onClick=${() => setDetalhe(null)}
                >
                  Fechar
                </button>
              </footer>
            `
      : null}
      </${ModalPadrao}>
    </${PainelRh}>
  `;
}
