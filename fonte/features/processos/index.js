import {
  html,
  useEffect,
  useMemo,
  useState,
} from '../../infraestrutura-react.js';
import {
  TAMANHO_DETALHE_PROCESSO,
  agendarEntrevista,
  adicionarPreAnaliseAoProcesso,
  analisarCvCandidatoInscrito,
  analisarCvEmailRecebido,
  atualizarEntrevista,
  atualizarPerfilCandidato,
  atualizarPreAnaliseCv,
  atualizarProcesso,
  atualizarStatusCandidato,
  analisarCvProcesso,
  baixarPacoteHistorico,
  baixarCvCandidato,
  carregarDetalhesProva,
  desativarLinkPublicoCandidatura,
  encerrarProcesso,
  excluirPreAnaliseCv,
  enviarPreAnaliseParaBancoTalentos,
  enviarEmailAprovacao,
  gerarLinkPublicoCandidatura,
  lerEmailsRecebidosProcesso,
  lerCandidatosProcessos,
  lerDetalheProcesso,
  lerEntrevistas,
  lerPreAnalisesCv,
  lerProcessos,
  lerSlotsEntrevista,
  limparListaPreAnalisesCv,
  registrarWhatsappAprovacao,
} from '../../app/controlador-aplicacao.js';
import {
  baixarBlob,
  formatarDataParaInput,
  obterItensPaginados,
} from '../../utilitarios.js';
import {
  formatarDataHora,
  montarResumoAnaliticoCv,
  obterClasseStatusEntrevista,
  obterClasseStatusProcesso,
} from '../../shared/helpers-visuais.js';
import {
  abrirBlobEmNovaGuia,
  copiarTexto,
  montarUrlPublicaCandidatura,
  obterBasePublicaCandidatura,
  toDatetimeLocal,
} from '../../shared/browser-utils.js';
import { AcaoSair } from '../../shared/components/actions.js';
import {
  DOCUMENTOS_APROVACAO_PADRAO,
  ModalAprovacaoCandidato,
  atualizarDocumentosNaMensagem,
} from '../../shared/components/approval-modal.js';
import {
  ModalEdicaoEntrevista,
} from '../../shared/components/interview-edit-modal.js';
import { TabelaVazia } from '../../shared/components/empty-table-row.js';
import {
  CANDIDATE_STATUS_APPROVED,
  CANDIDATE_STATUS_ANALYSIS,
  CANDIDATE_STATUS_ELIMINATED,
  CANDIDATE_STATUS_TALENT_BANK,
  canonicalizeCandidateStatus,
  getCandidateActionState,
  isActiveCandidateStatus,
  isProcessClosed,
} from '../../shared/process-flow.js';
import {
  validarFormularioEntrevista,
  validarFormularioProcesso,
} from '../../shared/validacoes.js';
import {
  encontrarProcessoPorReferencia,
  obterChaveProcesso,
  obterReferenciaProcesso,
  obterReferenciaProcessoDoCandidato,
} from '../../shared/process-reference.js';
import { CHAVE_PROCESSO_DETALHE } from './state.js';
import { CabecalhoSecaoColapsavel } from './components/section-toggle.js';
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

const MENSAGEM_CANDIDATO_APROVADO_BLOQUEADO =
  'Este candidato já foi aprovado. Para alterar sua situação, será necessário um novo cadastro ou atualização manual.';
const AVISO_URL_PUBLICA_NAO_CONFIGURADA =
  'URL pública ainda não configurada. Defina PUBLIC_CANDIDATE_BASE_URL no servidor para liberar inscrições externas.';
const EXIBIR_PAGINA_PUBLICA_CANDIDATURA = false;
const EXIBIR_CANDIDATOS_INSCRITOS = false;
const MOTIVOS_ELIMINACAO = [
  'Eliminado pela nota de corte',
  'Eliminado na entrevista',
  'Candidato não compareceu',
  'Optou por não prosseguir',
];
const ETAPAS_ELIMINACAO_ENTREVISTA = [
  'Com o Gestor do RH',
  'Com Supervisor',
  'Com Gestor da Área',
];
const REQUISITOS_PUBLICOS_PADRAO = [
  'Ensino médio completo ou formação compatível com a vaga.',
  'Experiência anterior em atividades relacionadas será considerada um diferencial.',
  'Boa comunicação verbal e escrita.',
  'Organização, responsabilidade e postura profissional.',
  'Facilidade para aprender sistemas, processos internos e rotinas operacionais.',
  'Disponibilidade para cumprir a jornada e os horários definidos pelo RH.',
];
const RESPONSABILIDADES_PUBLICAS_PADRAO = [
  'Executar as atividades da função conforme orientação da liderança.',
  'Atender demandas internas e externas com cordialidade, clareza e agilidade.',
  'Registrar informações de forma correta nos sistemas e controles definidos.',
  'Cumprir procedimentos, prazos, políticas internas e orientações do processo.',
  'Apoiar a equipe na manutenção da qualidade e continuidade das operações.',
];

function normalizarTextoComparacao(valor) {
  return String(valor || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function obterNotaProvaCandidato(candidato) {
  return (
    candidato?.nota_prova ||
    candidato?.pontuacao_final ||
    candidato?.nota_final ||
    candidato?.nota_exibicao ||
    ''
  );
}

function formatarOrigemCandidato(candidato) {
  const rotulo = String(candidato?.origem_rotulo || '').trim();
  if (rotulo) return rotulo;

  const origem = normalizarTextoComparacao(candidato?.origem);
  if (!origem) return 'Processo Único';
  if (origem.includes('pagina') && (origem.includes('candidatura') || origem.includes('inscricao'))) {
    return 'Página de inscrição';
  }
  if (origem.includes('pre analise') || origem.includes('pre-analise') || origem.includes('analise direta')) {
    return 'Análise direta do CV';
  }
  if (origem.includes('banco') && origem.includes('talento')) return 'Banco de Talentos';
  if (origem.includes('recebimento') && origem.includes('email')) return 'Recebimento de e-mail';
  if (origem.includes('processo unico') || origem.includes('processo_unico') || origem === 'prova') {
    return 'Processo Único';
  }
  return String(candidato?.origem || '-').trim() || '-';
}

function formatarDataCurta(valor) {
  const texto = String(valor || '').trim();
  if (!texto) return '-';
  const data = new Date(texto);
  if (Number.isNaN(data.getTime())) return texto;
  return data.toLocaleDateString('pt-BR');
}

function formatarHoraCurta(valor) {
  const data = new Date(String(valor || '').trim());
  if (Number.isNaN(data.getTime())) return '-';
  return data.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function obterValorDataHoraSlot(slot, campos) {
  const campoEncontrado = campos.find((campo) => String(slot?.[campo] || '').trim());
  const valor = String(slot?.[campoEncontrado] || '').trim();
  const data = String(slot?.data || slot?.date || '').trim();

  if (data && /^\d{2}:\d{2}/.test(valor)) {
    return `${data}T${valor}`;
  }

  return valor;
}

function obterIdSlotEntrevista(slot) {
  return slot?.id_slot ?? slot?.slot_id ?? slot?.id ?? '';
}

function obterDataInicioSlotEntrevista(slot) {
  const inicio = obterValorDataHoraSlot(slot, ['inicio', 'start_time', 'horario']);
  if (!inicio) return null;

  const data = new Date(inicio);
  return Number.isNaN(data.getTime()) ? null : data;
}

function obterDataFimSlotEntrevista(slot) {
  const fim = obterValorDataHoraSlot(slot, ['fim', 'end_time', 'hora_fim']);
  if (!fim) return null;

  const data = new Date(fim);
  return Number.isNaN(data.getTime()) ? null : data;
}

function obterVagasDisponiveisSlotEntrevista(slot) {
  return Number(
    slot?.disponiveis ??
      slot?.vagas_restantes ??
      slot?.available_slots ??
      slot?.capacity ??
      slot?.capacidade ??
      1,
  );
}

function obterMotivoEliminacao(candidato) {
  return String(candidato?.motivo_eliminacao || '').trim() || 'Motivo não informado';
}

function montarFormularioCandidato(candidato) {
  return {
    nome_candidato: candidato?.nome_candidato || '',
    email: candidato?.email || '',
    telefone: candidato?.telefone || '',
    whatsapp: candidato?.whatsapp || '',
    cidade: candidato?.cidade || '',
    bairro: candidato?.bairro || '',
  };
}

function candidatoTemProvaSalva(candidato) {
  const idTeste = String(candidato?.id_teste || '').trim();
  if (candidato?.prova_disponivel || candidato?.id_teste_prova) {
    return Boolean(idTeste || candidato?.id_teste_prova);
  }
  const origem = normalizarTextoComparacao(candidato?.origem);
  const nota = String(obterNotaProvaCandidato(candidato) || '').trim();

  return Boolean(
    idTeste &&
    !idTeste.toUpperCase().startsWith('CV-') &&
    nota &&
    (origem.includes('prova') || !origem.includes('pre-analise')),
  );
}

function montarItensPublicosPadrao(textos) {
  return textos.map((texto) => ({ texto, visivel: true }));
}

function normalizarItensPublicos(valor, chave, textosPadrao) {
  const bruto = String(valor || '').trim();
  if (!bruto) return montarItensPublicosPadrao(textosPadrao);

  try {
    const parsed = JSON.parse(bruto);
    const lista = Array.isArray(parsed) ? parsed : parsed?.[chave];
    if (!Array.isArray(lista)) return montarItensPublicosPadrao(textosPadrao);
    return lista
      .map((item) => {
        if (typeof item === 'string') return { texto: item.trim(), visivel: true };
        return {
          texto: String(item?.texto || '').trim(),
          visivel: item?.visivel !== false,
        };
      })
      .filter((item) => item.texto);
  } catch (error) {
    const linhas = bruto
      .split(/\r?\n+/)
      .map((item) => item.trim())
      .filter(Boolean);
    return linhas.length
      ? montarItensPublicosPadrao(linhas)
      : montarItensPublicosPadrao(textosPadrao);
  }
}

function serializarItensPublicos(chave, itens) {
  return JSON.stringify({
    [chave]: (itens || []).map((item) => ({
      texto: String(item.texto || '').trim(),
      visivel: item.visivel !== false,
    })),
  });
}

function isPreAnaliseNaoQualificada(item) {
  const valor = normalizarTextoComparacao(item?.classificacao || item?.classificacao_slug);
  return valor === 'nao qualificado' || valor === 'nao-qualificado';
}

function isPreAnaliseUtilizavelDireto(item) {
  return !isPreAnaliseNaoQualificada(item);
}

function lerProblemasCv(item) {
  try {
    const dados = JSON.parse(item?.problemas || '{}');
    return dados && typeof dados === 'object' ? dados : {};
  } catch (error) {
    return {};
  }
}

function montarCandidatoDeFluxo(candidato, processoStatus = '') {
  const estadoAcoes = getCandidateActionState(candidato, processoStatus);

  return {
    ...candidato,
    status_fluxo: estadoAcoes.visibleStatus,
    status_processo: processoStatus || candidato.status_processo || '',
    acoes_fluxo: estadoAcoes,
  };
}

function renderizarAcoesDoCandidato({
  candidato,
  onAtualizarStatus,
  onAprovar,
  onAgendarEntrevista,
  onEditar,
}) {
  const estadoAcoes = candidato.acoes_fluxo || getCandidateActionState(candidato);
  const botoes = [];

  if (
    !estadoAcoes.processClosed &&
    estadoAcoes.isActive &&
    typeof onAgendarEntrevista === 'function'
  ) {
    botoes.push(
      html`
        <button
          type="button"
          class="btn btn-sm btn-outline-primary rh-action-btn"
          title="Agendar entrevista"
          onClick=${() => onAgendarEntrevista(candidato)}
        >
          <span class="material-symbols-outlined">event</span>
          Entrevista
        </button>
      `,
    );
  }

  if (estadoAcoes.canApprove) {
    botoes.push(
      html`
        <button
          type="button"
          class="btn btn-sm btn-outline-success rh-action-btn"
          title="Aprovar candidato"
          onClick=${() =>
          typeof onAprovar === 'function'
            ? onAprovar(candidato)
            : onAtualizarStatus(candidato, 'Aprovado')}
        >
          <span class="material-symbols-outlined">check_circle</span>
          Aprovar
        </button>
      `,
    );
  }

  if (estadoAcoes.canEliminate) {
    botoes.push(
      html`
        <button
          type="button"
          class="btn btn-sm btn-outline-danger rh-action-btn"
          title="Eliminar candidato"
          onClick=${() => onAtualizarStatus(candidato, 'Eliminado')}
        >
          <span class="material-symbols-outlined">cancel</span>
          Eliminar
        </button>
      `,
    );
  }

  if (estadoAcoes.canSendToTalentBank) {
    botoes.push(
      html`
        <button
          type="button"
          class="btn btn-sm btn-outline-secondary rh-action-btn"
          title="Enviar para Banco de Talentos"
          onClick=${() => onAtualizarStatus(candidato, 'Banco de Talentos')}
        >
          <span class="material-symbols-outlined">inventory_2</span>
          Banco
        </button>
      `,
    );
  }

  if (estadoAcoes.canEdit && typeof onEditar === 'function') {
    botoes.push(
      html`
        <button
          type="button"
          class="btn btn-sm btn-outline-secondary rh-action-btn"
          title="Editar dados do candidato"
          onClick=${() => onEditar(candidato)}
        >
          <span class="material-symbols-outlined">edit</span>
          Editar
        </button>
      `,
    );
  }

  if (!botoes.length) {
    return html`
      <span class="text-muted">
        ${estadoAcoes.processClosed
        ? 'Processo encerrado. Movimentações não são permitidas.'
        : 'Sem ações disponíveis'}
      </span>
    `;
  }

  return html`<div class="rh-action-cluster">${botoes}</div>`;
}

function SecaoDetalheExpansivel({
  aberto,
  titulo,
  description,
  tourId = '',
  onToggle,
  children,
}) {
  return html`
    <${SectionCard} tourId=${tourId}>
      <div class="rh-section-card-header">
        <div>
          <${CabecalhoSecaoColapsavel}
            aberto=${aberto}
            titulo=${titulo}
            onClick=${onToggle}
          />
          ${description
      ? html`<p class="rh-section-card-description">${description}</p>`
      : null}
        </div>
      </div>
      ${aberto ? html`<div class="mt-3">${children}</div>` : null}
    </${SectionCard}>
  `;
}

export function TelaProcessos({ controlador }) {
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
  const [edicao, setEdicao] = useState(null);
  const [processoParaEncerrar, setProcessoParaEncerrar] = useState('');
  const [aprovacaoSelecionada, setAprovacaoSelecionada] = useState(null);
  const [salvandoAprovacao, setSalvandoAprovacao] = useState(false);

  const carregar = async () => {
    setCarregando(true);
    setErro('');

    try {
      const [resultadoProcessos, resultadoCandidatos] =
        await Promise.allSettled([
          lerProcessos(true),
          lerCandidatosProcessos(true),
        ]);

      const mensagensErro = [];

      if (resultadoProcessos.status === 'fulfilled') {
        setProcessos(
          Array.isArray(resultadoProcessos.value) ? resultadoProcessos.value : [],
        );
      } else {
        setProcessos([]);
        mensagensErro.push(
          resultadoProcessos.reason?.message ||
          'Não foi possível carregar os processos seletivos.',
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
          'Não foi possível carregar os candidatos vinculados.',
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

  const processosAbertos = useMemo(
    () =>
      processos
        .filter((processo) => String(processo.status || '').trim() !== 'Encerrado')
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
          const matchNota =
            !filtros.notaCorte || usaNota === filtros.notaCorte;
          const matchStatus =
            !filtros.status || status.includes(filtros.status.toLowerCase());

          return matchVaga && matchOperacao && matchNota && matchStatus;
        }),
    [filtros, processos],
  );

  const processosEncerrados = useMemo(
    () =>
      processos.filter(
        (processo) => String(processo.status || '').trim() === 'Encerrado',
      ),
    [processos],
  );

  const processosPorId = useMemo(
    () =>
      processos.reduce((acc, processo) => {
        const referencia = obterReferenciaProcesso(processo);
        if (referencia) {
          acc[referencia] = processo;
        }
        return acc;
      }, {}),
    [processos],
  );

  const candidatosComFluxo = useMemo(
    () =>
      candidatos.map((candidato) => {
        const processo =
          processosPorId[obterReferenciaProcessoDoCandidato(candidato)];
        return montarCandidatoDeFluxo(candidato, processo?.status || '');
      }),
    [candidatos, processosPorId],
  );

  const candidatosComDecisaoPendente = useMemo(
    () =>
      candidatosComFluxo.filter(
        (candidato) =>
          candidato.acoes_fluxo?.canApprove ||
          candidato.acoes_fluxo?.canEliminate ||
          candidato.acoes_fluxo?.canSendToTalentBank,
      ),
    [candidatosComFluxo],
  );

  const resumo = useMemo(
    () => ({
      totalProcessos: processos.length,
      abertos: processosAbertos.length,
      encerrados: processosEncerrados.length,
      candidatosComDecisaoPendente: candidatosComDecisaoPendente.length,
    }),
    [
      processos.length,
      processosAbertos.length,
      processosEncerrados.length,
      candidatosComDecisaoPendente.length,
    ],
  );

  const atualizarStatus = async (
    registro,
    statusCandidato,
    idProcesso,
    dadosAprovacao = {},
  ) => {
    const processo = encontrarProcessoPorReferencia(processos, idProcesso);
    const candidatoAtual = candidatos.find(
      (item) => Number(item.id_registro || 0) === Number(registro || 0),
    );
    const statusAtual = canonicalizeCandidateStatus(
      candidatoAtual?.status_fluxo || candidatoAtual?.status_candidato,
    );

    if (statusAtual === CANDIDATE_STATUS_APPROVED) {
      window.alert(MENSAGEM_CANDIDATO_APROVADO_BLOQUEADO);
      return;
    }

    if (isProcessClosed(processo)) {
      window.alert('O processo seletivo está encerrado e não permite novas movimentações.');
      return;
    }

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
      ...(statusCandidato === CANDIDATE_STATUS_APPROVED ? dadosAprovacao : {}),
    });

    await carregar();
  };

  const abrirAprovacao = (candidato) => {
    const processo = encontrarProcessoPorReferencia(
      processos,
      obterReferenciaProcessoDoCandidato(candidato),
    );
    const estadoAcoes = candidato?.acoes_fluxo || getCandidateActionState(candidato);

    if (estadoAcoes.processClosed || isProcessClosed(processo)) {
      window.alert('Processo encerrado. Movimentações não são permitidas.');
      return;
    }

    if (!estadoAcoes.canApprove) {
      window.alert('A aprovação não está disponível para o status atual deste candidato.');
      return;
    }

    setAprovacaoSelecionada({ candidato, processo });
  };

  const confirmarAprovacao = async (dadosAprovacao) => {
    if (!aprovacaoSelecionada?.candidato) return;

    setSalvandoAprovacao(true);
    try {
      const candidato = aprovacaoSelecionada.candidato;
      await atualizarStatus(
        candidato.id_registro,
        CANDIDATE_STATUS_APPROVED,
        obterReferenciaProcessoDoCandidato(candidato),
        dadosAprovacao,
      );
      setAprovacaoSelecionada(null);
    } finally {
      setSalvandoAprovacao(false);
    }
  };

  const salvarEdicao = async () => {
    const mensagemErro = validarFormularioProcesso(
      {
        vaga: edicao?.vaga,
        quantidade: edicao?.quantidade_vagas,
        dataEncerramento: edicao?.data_encerramento,
        operacao: edicao?.operacao,
        trilha: edicao?.trilha,
        usaNotaCorte: Number(edicao?.usa_nota_corte || 0) === 1,
        notaCorte: edicao?.nota_corte,
        linkAgendamento: edicao?.link_agendamento || '',
      },
      { exigeOperacao: false, exigeTrilha: false, trilhaFixa: '' },
    );
    if (mensagemErro || !obterReferenciaProcesso(edicao)) {
      setErro(mensagemErro || 'Preencha os campos obrigatorios para editar o processo.');
      return;
    }

    await atualizarProcesso(obterReferenciaProcesso(edicao), {
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
      link_agendamento: edicao.link_agendamento || '',
      observacoes_publicas_vaga: edicao.observacoes_publicas_vaga || '',
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

  const abrirDetalhe = (processo) => {
    sessionStorage.setItem(
      CHAVE_PROCESSO_DETALHE,
      obterReferenciaProcesso(processo),
    );
    controlador.irParaTelaProtegida('screen-process-details');
  };

  const processoSelecionadoParaEncerramento = useMemo(
    () => encontrarProcessoPorReferencia(processos, processoParaEncerrar),
    [processoParaEncerrar, processos],
  );

  return html`
    <${PainelRh}
      screenId="screen-processes"
      navAtiva="screen-processes"
      subtituloMarca="Processos seletivos"
      placeholderBusca="Gerenciamento de processos e candidatos"
      controlador=${controlador}
      acaoPrimaria=${{
      label: 'Novo processo',
      onClick: () => controlador.irParaTelaProtegida('screen-process-create'),
    }}
      acoesTopo=${html`<${AcaoSair} controlador=${controlador} />`}
    >
      <${PageIntro}
        kicker="Console • Processos"
        title="Gestão de processos seletivos"
        description="Controle processos abertos, acompanhe as etapas do RH e conclua apenas as ações que ainda estão pendentes."
      />

      ${erro ? html`<div class="rh-inline-alert">${erro}</div>` : null}

      <${SectionCard}
        title="Visão executiva"
        description="Indicadores rápidos para acompanhamento operacional."
      >
        <${MetricGrid}
          items=${[
      { label: 'Processos totais', value: resumo.totalProcessos },
      { label: 'Abertos', value: resumo.abertos, variant: 'is-approved' },
      { label: 'Encerrados', value: resumo.encerrados, variant: 'is-eliminated' },
      {
        label: 'Decisões pendentes',
        value: resumo.candidatosComDecisaoPendente,
        variant: 'is-analysis',
      },
    ]}
        />
      </${SectionCard}>

      <${SectionCard}
        title="Filtros"
        description="Aplicados somente na lista de processos abertos."
        tourId="process-filters"
      >
        <div class="rh-filter-grid rh-filter-grid--wide">
          <div class="rh-filter-field">
            <label>Vaga</label>
            <input
              class="form-control"
              value=${filtros.vaga}
              placeholder="Filtrar por vaga"
              onInput=${(event) =>
      setFiltros({ ...filtros, vaga: event.target.value })}
            />
          </div>
          <div class="rh-filter-field">
            <label>Operação</label>
            <input
              class="form-control"
              value=${filtros.operacao}
              placeholder="Filtrar por operação"
              onInput=${(event) =>
      setFiltros({ ...filtros, operacao: event.target.value })}
            />
          </div>
          <div class="rh-filter-field">
            <label>Nota de corte</label>
            <select
              class="form-select"
              value=${filtros.notaCorte}
              onChange=${(event) =>
      setFiltros({ ...filtros, notaCorte: event.target.value })}
            >
              <option value="">Todos</option>
              <option value="sim">Sim</option>
              <option value="nao">Não</option>
            </select>
          </div>
          <div class="rh-filter-field">
            <label>Status</label>
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
      </${SectionCard}>

      <${SectionCard}
        title=""
        tourId="process-open-table"
        actions=${html`
          <${CabecalhoSecaoColapsavel}
            aberto=${blocos.abertos}
            titulo="Processos abertos"
            onClick=${() => setBlocos({ ...blocos, abertos: !blocos.abertos })}
          />
        `}
      >
        ${blocos.abertos
      ? html`
              <div class="table-responsive">
                <table class="table align-middle rh-modern-history-table">
                  <thead>
                    <tr>
                      <th>Processo</th>
                      <th>Vaga</th>
                      <th>Operação</th>
                      <th>Trilha</th>
                      <th>Nota de corte</th>
                      <th>Valor corte</th>
                      <th>Vagas</th>
                      <th>Encerramento</th>
                      <th>Link legado</th>
                      <th>Status</th>
                      <th class="text-end">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${carregando
          ? html`<${TabelaVazia} colunas=${11} texto="Carregando processos..." />`
          : processosAbertos.length
            ? processosAbertos.map(
              (processo) => html`
                              <tr key=${obterChaveProcesso(processo)}>
                                <td>${processo.id_processo || '-'}</td>
                                <td>${processo.vaga || '-'}</td>
                                <td>${processo.operacao || '-'}</td>
                                <td>${processo.trilha || '-'}</td>
                                <td>${Number(processo.usa_nota_corte || 0) ? 'Sim' : 'Não'}</td>
                                <td>${processo.nota_corte || '-'}</td>
                                <td>
                                  <div>${`${processo.vagas_preenchidas || 0}/${processo.quantidade_vagas || 0}`}</div>
                                  <small class="text-muted">
                                    ${Number(processo.candidatos_concorrendo ?? processo.quantidade_candidatos ?? 0)}
                                    concorrendo
                                  </small>
                                </td>
                                <td>${processo.data_encerramento || '-'}</td>
                                <td>
                                  ${processo.link_agendamento
                  ? html`
                                        <a
                                          href=${processo.link_agendamento}
                                          target="_blank"
                                          rel="noreferrer"
                                          class="rh-link-inline"
                                        >
                                          Abrir
                                        </a>
                                      `
                  : 'Não informado'}
                                </td>
                                <td>
                                  <span class="rh-status-pill is-finished">
                                    ${processo.status || '-'}
                                  </span>
                                </td>
                                <td class="text-end">
                                  <div class="d-flex justify-content-end gap-2 flex-wrap">
                                    <button
                                      type="button"
                                      class="btn btn-sm btn-outline-secondary"
                                      onClick=${() =>
                  setEdicao({
                    ...processo,
                    data_encerramento: formatarDataParaInput(
                      processo.data_encerramento,
                    ),
                  })}
                                    >
                                      Editar
                                    </button>
                                    <button
                                      type="button"
                                      class="btn btn-sm btn-outline-primary"
                                      onClick=${() => abrirDetalhe(processo)}
                                    >
                                      Detalhes
                                    </button>
                                    <button
                                      type="button"
                                      class="btn btn-sm btn-outline-danger"
                                      onClick=${() =>
                  setProcessoParaEncerrar(
                    obterReferenciaProcesso(processo),
                  )}
                                    >
                                      Encerrar
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            `,
            )
            : html`
                            <${TabelaVazia}
                              colunas=${11}
                              texto="Nenhum processo aberto encontrado."
                            />
                          `}
                  </tbody>
                </table>
              </div>
            `
      : null}
      </${SectionCard}>

      <${SectionCard}
        title=""
        actions=${html`
          <${CabecalhoSecaoColapsavel}
            aberto=${blocos.encerrados}
            titulo="Processos encerrados"
            onClick=${() =>
        setBlocos({ ...blocos, encerrados: !blocos.encerrados })}
          />
        `}
      >
        ${blocos.encerrados
      ? html`
              <div class="table-responsive">
                <table class="table align-middle rh-modern-history-table">
                  <thead>
                    <tr>
                      <th>Processo</th>
                      <th>Vaga</th>
                      <th>Operação</th>
                      <th>Trilha</th>
                      <th>Nota de corte</th>
                      <th>Valor corte</th>
                      <th>Vagas</th>
                      <th>Encerramento</th>
                      <th>Link legado</th>
                      <th>Status</th>
                      <th class="text-end">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${processosEncerrados.length
          ? processosEncerrados.map(
            (processo) => html`
                              <tr key=${obterChaveProcesso(processo)}>
                              <td>${processo.id_processo || '-'}</td>
                              <td>${processo.vaga || '-'}</td>
                              <td>${processo.operacao || '-'}</td>
                              <td>${processo.trilha || '-'}</td>
                              <td>${Number(processo.usa_nota_corte || 0) ? 'Sim' : 'Não'}</td>
                              <td>${processo.nota_corte || '-'}</td>
                              <td>
                                ${`${processo.vagas_preenchidas || 0}/${processo.quantidade_vagas || 0}`}
                              </td>
                              <td>${processo.data_encerramento || '-'}</td>
                              <td>
                                ${processo.link_agendamento
                ? html`
                                      <a
                                        href=${processo.link_agendamento}
                                        target="_blank"
                                        rel="noreferrer"
                                        class="rh-link-inline"
                                      >
                                        Abrir
                                      </a>
                                    `
                : 'Não informado'}
                              </td>
                              <td>
                                <span class="rh-status-pill is-unsaved">
                                  ${processo.status || '-'}
                                </span>
                              </td>
                              <td class="text-end">
                                <button
                                  type="button"
                                  class="btn btn-sm btn-outline-primary"
                                  onClick=${() => abrirDetalhe(processo)}
                                >
                                  Detalhes
                                </button>
                              </td>
                            </tr>
                          `,
          )
          : html`
                          <${TabelaVazia}
                            colunas=${11}
                            texto="Nenhum processo encerrado."
                          />
                        `}
                  </tbody>
                </table>
              </div>
            `
      : null}
      </${SectionCard}>

      <${SectionCard}
        title=""
        actions=${html`
          <${CabecalhoSecaoColapsavel}
            aberto=${blocos.candidatos}
            titulo="Decisoes finais pendentes"
            onClick=${() =>
        setBlocos({ ...blocos, candidatos: !blocos.candidatos })}
          />
        `}
      >
        ${blocos.candidatos
      ? html`
              <div class="table-responsive">
                <table class="table align-middle rh-modern-history-table">
                  <thead>
                    <tr>
                      <th>Processo</th>
                      <th>Candidato</th>
                      <th>Vaga</th>
                      <th>Nota</th>
                      <th>Status</th>
                      <th class="text-end">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${candidatosComDecisaoPendente.length
          ? candidatosComDecisaoPendente.map(
            (candidato) => html`
                            <tr key=${candidato.id_registro}>
                              <td>${candidato.id_processo || '-'}</td>
                              <td>${candidato.nome_candidato || '-'}</td>
                              <td>${candidato.vaga || '-'}</td>
                              <td>${candidato.pontuacao_final || '-'}</td>
                              <td>
                                <span
                                  class=${`process-candidate-status-badge ${obterClasseStatusProcesso(candidato.status_fluxo)}`}
                                >
                                  ${candidato.status_fluxo || '-'}
                                </span>
                              </td>
                              <td class="text-end">
                                ${renderizarAcoesDoCandidato({
              candidato,
              onAprovar: abrirAprovacao,
              onAtualizarStatus: (item, status) =>
                atualizarStatus(
                  item.id_registro,
                  status,
                  obterReferenciaProcessoDoCandidato(item),
                ),
            })}
                              </td>
                            </tr>
                          `,
          )
          : html`
                          <${TabelaVazia}
                            colunas=${6}
                            texto="Nenhum candidato com decisão final pendente."
                          />
                        `}
                  </tbody>
                </table>
              </div>
            `
      : null}
      </${SectionCard}>

      <${ModalPadrao}
        aberto=${!!edicao}
        titulo="Editar processo"
        subtitulo="Ajuste as informações sem alterar a integração existente."
        onClose=${() => setEdicao(null)}
      >
        ${edicao
      ? html`
              <div class="rh-details-body">
                <div class="row g-3">
                  <div class="col-md-6">
                    <label class="form-label">Vaga</label>
                    <input class="form-control" readonly value=${edicao.vaga || ''} />
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
                    <label class="form-label">Operação</label>
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
                  <div class="col-md-3">
                    <label class="form-label d-block mb-2">Nota de corte</label>
                    <div class="form-check form-switch pt-2">
                      <input
                        class="form-check-input"
                        type="checkbox"
                        checked=${Number(edicao.usa_nota_corte || 0) === 1}
                        onChange=${(event) =>
          setEdicao({
            ...edicao,
            usa_nota_corte: event.target.checked ? 1 : 0,
          })}
                      />
                    </div>
                  </div>
                  <div class="col-md-3">
                    <label class="form-label">Valor corte</label>
                    <input
                      class="form-control"
                      type="number"
                      step="0.1"
                      min="0"
                      max="10"
                      value=${edicao.nota_corte ?? ''}
                      disabled=${Number(edicao.usa_nota_corte || 0) !== 1}
                      onInput=${(event) =>
          setEdicao({ ...edicao, nota_corte: event.target.value })}
                    />
                  </div>
                  <div class="col-md-6">
                    <label class="form-label">Status</label>
                    <select
                      class="form-select"
                      value=${edicao.status || 'Aberto'}
                      onChange=${(event) =>
          setEdicao({ ...edicao, status: event.target.value })}
                    >
                      <option value="Aberto">Aberto</option>
                      <option value="Encerrado">Encerrado</option>
                    </select>
                  </div>
                  <div class="col-md-12">
                    <label class="form-label">Link legado</label>
                    <input
                      class="form-control"
                      placeholder="https://..."
                      value=${edicao.link_agendamento || ''}
                      onInput=${(event) =>
          setEdicao({
            ...edicao,
            link_agendamento: event.target.value,
          })}
                    />
                  </div>
                </div>
              </div>
              <footer class="rh-modal-footer">
                <button
                  type="button"
                  class="btn btn-outline-secondary"
                  onClick=${() => setEdicao(null)}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  class="btn btn-primary"
                  onClick=${salvarEdicao}
                >
                  Salvar alterações
                </button>
              </footer>
            `
      : null}
      </${ModalPadrao}>

      <${ModalPadrao}
        aberto=${!!processoParaEncerrar}
        titulo="Encerrar processo"
        subtitulo="Essa ação move o processo para a lista de encerrados."
        onClose=${() => setProcessoParaEncerrar('')}
      >
        <div class="rh-details-body">
          <div class="alert alert-warning mb-0">
            Deseja realmente encerrar o processo ${processoSelecionadoParaEncerramento?.id_processo || processoParaEncerrar || ''}?
          </div>
        </div>
        <footer class="rh-modal-footer">
          <button
            type="button"
            class="btn btn-outline-secondary"
            onClick=${() => setProcessoParaEncerrar('')}
          >
            Cancelar
          </button>
          <button
            type="button"
            class="btn btn-danger"
            onClick=${confirmarEncerramento}
          >
            Encerrar processo
          </button>
        </footer>
      </${ModalPadrao}>

      <${ModalAprovacaoCandidato}
        aberto=${!!aprovacaoSelecionada}
        candidato=${aprovacaoSelecionada?.candidato}
        processo=${aprovacaoSelecionada?.processo}
        salvando=${salvandoAprovacao}
        onClose=${() => setAprovacaoSelecionada(null)}
        onConfirm=${confirmarAprovacao}
      />
    </${PainelRh}>
  `;
}

export function TelaDetalhesProcesso({ controlador }) {
  const [carregando, setCarregando] = useState(true);
  const [salvandoEntrevista, setSalvandoEntrevista] = useState(false);
  const [erro, setErro] = useState('');
  const [processo, setProcesso] = useState(null);
  const [resumo, setResumo] = useState(null);
  const [candidatos, setCandidatos] = useState([]);
  const [entrevistas, setEntrevistas] = useState([]);
  const [slotsEntrevista, setSlotsEntrevista] = useState([]);
  const [carregandoSlotsEntrevista, setCarregandoSlotsEntrevista] = useState(false);
  const [preAnalises, setPreAnalises] = useState([]);
  const [paginaPreAnalises, setPaginaPreAnalises] = useState(1);
  const [totalPaginasPreAnalises, setTotalPaginasPreAnalises] = useState(1);
  const [classificacoesPreAnalises, setClassificacoesPreAnalises] = useState([]);
  const [filtrosPreAnalises, setFiltrosPreAnalises] = useState({
    nome: '',
    scoreMin: '',
    scoreMax: '',
    classificacao: '',
    mostrarOcultos: false,
  });
  const [emailsRecebidos, setEmailsRecebidos] = useState([]);
  const [statusEmailRecebido, setStatusEmailRecebido] = useState(null);
  const [avisosSecoes, setAvisosSecoes] = useState({});
  const [carregandoEmails, setCarregandoEmails] = useState(false);
  const [analisandoEmailUid, setAnalisandoEmailUid] = useState('');
  const [arquivoCv, setArquivoCv] = useState(null);
  const [guardarCvOriginal, setGuardarCvOriginal] = useState(false);
  const [analisandoCv, setAnalisandoCv] = useState(false);
  const [preAnaliseSelecionada, setPreAnaliseSelecionada] = useState(null);
  const [candidatoEditando, setCandidatoEditando] = useState(null);
  const [formularioCandidato, setFormularioCandidato] = useState(
    montarFormularioCandidato(null),
  );
  const [detalheCandidatoSelecionado, setDetalheCandidatoSelecionado] =
    useState(null);
  const [visualizacaoCv, setVisualizacaoCv] = useState(null);
  const [resultadoAnaliseSelecionado, setResultadoAnaliseSelecionado] =
    useState(null);
  const [detalheProvaSelecionado, setDetalheProvaSelecionado] = useState(null);
  const [carregandoDetalheProva, setCarregandoDetalheProva] = useState('');
  const [agendamentoSelecionado, setAgendamentoSelecionado] = useState(null);
  const [documentosEntrevista, setDocumentosEntrevista] = useState([]);
  const [aprovacaoSelecionada, setAprovacaoSelecionada] = useState(null);
  const [salvandoAprovacao, setSalvandoAprovacao] = useState(false);
  const [enviandoCanalAprovacao, setEnviandoCanalAprovacao] = useState('');
  const [eliminacaoSelecionada, setEliminacaoSelecionada] = useState(null);
  const [formularioEliminacao, setFormularioEliminacao] = useState({
    motivo_eliminacao: '',
    etapa_eliminacao: '',
  });
  const [erroEliminacao, setErroEliminacao] = useState('');
  const [entrevistaEdicao, setEntrevistaEdicao] = useState(null);
  const [salvandoEdicaoEntrevista, setSalvandoEdicaoEntrevista] = useState(false);
  const [formularioEdicaoEntrevista, setFormularioEdicaoEntrevista] = useState({
    id_slot: '',
    status_entrevista: 'Agendado',
    observacoes_rh: '',
    mensagem_personalizada: '',
  });
  const [formularioEntrevista, setFormularioEntrevista] = useState({
    id_registro: '',
    id_processo: '',
    id_processo_ref: '',
    id_slot: '',
    data_entrevista: '',
    status_entrevista: 'Agendado',
    link_agendamento: '',
    observacoes_rh: '',
    mensagem_personalizada: '',
    email: '',
    telefone: '',
    whatsapp: '',
  });
  const [mensagemEntrevistaEditada, setMensagemEntrevistaEditada] =
    useState(false);
  const [feedbackLinkPublico, setFeedbackLinkPublico] = useState('');
  const [observacoesPublicasVaga, setObservacoesPublicasVaga] = useState('');
  const [requisitosPublicos, setRequisitosPublicos] = useState(() =>
    montarItensPublicosPadrao(REQUISITOS_PUBLICOS_PADRAO),
  );
  const [responsabilidadesPublicas, setResponsabilidadesPublicas] = useState(() =>
    montarItensPublicosPadrao(RESPONSABILIDADES_PUBLICAS_PADRAO),
  );
  const [salvandoObservacoesPublicas, setSalvandoObservacoesPublicas] =
    useState(false);
  const [secoesExpandidas, setSecoesExpandidas] = useState({
    paginaPublica: false,
    recebimentoEmail: true,
    candidatosInscritos: true,
    preAnaliseCv: true,
    candidatosProcesso: true,
    candidatosAprovados: true,
  });

  const idProcesso = sessionStorage.getItem(CHAVE_PROCESSO_DETALHE) || '';

  const alternarSecao = (chave) => {
    setSecoesExpandidas((anteriores) => ({
      ...anteriores,
      [chave]: !anteriores[chave],
    }));
  };

  useEffect(() => {
    if (!feedbackLinkPublico) return undefined;

    const timeout = window.setTimeout(() => setFeedbackLinkPublico(''), 3200);
    return () => window.clearTimeout(timeout);
  }, [feedbackLinkPublico]);

  const carregarEmailsDoProcesso = async () => {
    if (!idProcesso) return;
    setCarregandoEmails(true);
    try {
      const payload = await lerEmailsRecebidosProcesso(idProcesso, 12);
      setStatusEmailRecebido(payload || null);
      setEmailsRecebidos(Array.isArray(payload?.items) ? payload.items : []);
    } catch (error) {
      setStatusEmailRecebido({
        configured: false,
        message:
          error?.message ||
          'Recebimento de e-mail ainda não configurado ou indisponível no momento.',
      });
      setEmailsRecebidos([]);
    } finally {
      setCarregandoEmails(false);
    }
  };

  const carregar = async (pagina = 1, filtrosCv = filtrosPreAnalises) => {
    if (!idProcesso) {
      setErro('Processo não identificado.');
      setCarregando(false);
      return;
    }

    setCarregando(true);
    setErro('');
    setAvisosSecoes({});

    try {
      const [
        resultadoDetalhe,
        resultadoPreAnalises,
        resultadoEntrevistas,
        resultadoSlots,
      ] = await Promise.allSettled([
        lerDetalheProcesso(idProcesso),
        lerPreAnalisesCv(idProcesso, pagina, 5, filtrosCv),
        lerEntrevistas({ idProcesso }),
        lerSlotsEntrevista({ idProcesso }),
      ]);

      if (resultadoDetalhe.status !== 'fulfilled') {
        throw resultadoDetalhe.reason;
      }

      const detalhe = resultadoDetalhe.value || {};
      const listaPreAnalises =
        resultadoPreAnalises.status === 'fulfilled'
          ? resultadoPreAnalises.value
          : {};
      const listaEntrevistas =
        resultadoEntrevistas.status === 'fulfilled'
          ? resultadoEntrevistas.value
          : [];
      const listaSlots =
        resultadoSlots.status === 'fulfilled' ? resultadoSlots.value : [];
      const novosAvisos = {};

      if (resultadoPreAnalises.status !== 'fulfilled') {
        console.error('Erro ao carregar pré-análise do processo.', resultadoPreAnalises.reason);
        novosAvisos.preAnaliseCv =
          'Não foi possível carregar a pré-análise de CV agora.';
      }

      if (resultadoEntrevistas.status !== 'fulfilled') {
        console.error('Erro ao carregar entrevistas do processo.', resultadoEntrevistas.reason);
        novosAvisos.entrevistas =
          'Não foi possível carregar as entrevistas agora.';
      }

      if (resultadoSlots.status !== 'fulfilled') {
        console.error('Erro ao carregar horários de entrevista.', resultadoSlots.reason);
        novosAvisos.entrevistas =
          novosAvisos.entrevistas ||
          'Não foi possível carregar os horários de entrevista agora.';
      }

      if (detalhe?.processo) {
        sessionStorage.setItem(
          CHAVE_PROCESSO_DETALHE,
          obterReferenciaProcesso(detalhe.processo),
        );
      }
      setProcesso(detalhe?.processo || null);
      setObservacoesPublicasVaga(
        detalhe?.processo?.observacoes_publicas_vaga || '',
      );
      setRequisitosPublicos(
        normalizarItensPublicos(
          detalhe?.processo?.requisitos_publicos,
          'requisitos',
          REQUISITOS_PUBLICOS_PADRAO,
        ),
      );
      setResponsabilidadesPublicas(
        normalizarItensPublicos(
          detalhe?.processo?.responsabilidades_publicas,
          'responsabilidades',
          RESPONSABILIDADES_PUBLICAS_PADRAO,
        ),
      );
      setResumo(detalhe?.resumo || null);
      setCandidatos(Array.isArray(detalhe?.candidatos) ? detalhe.candidatos : []);
      setPreAnalises(
        Array.isArray(listaPreAnalises?.items) ? listaPreAnalises.items : [],
      );
      setPaginaPreAnalises(Number(listaPreAnalises?.page || 1));
      setTotalPaginasPreAnalises(Number(listaPreAnalises?.total_pages || 1));
      setClassificacoesPreAnalises(
        Array.isArray(listaPreAnalises?.classificacoes)
          ? listaPreAnalises.classificacoes
          : [],
      );
      setEntrevistas(Array.isArray(listaEntrevistas) ? listaEntrevistas : []);
      setSlotsEntrevista(Array.isArray(listaSlots) ? listaSlots : []);
      setAvisosSecoes(novosAvisos);
    } catch (error) {
      setErro(
        error.message || 'Não foi possível carregar o detalhe do processo.',
      );
    } finally {
      setCarregando(false);
    }
  };

  const carregarSlotsEntrevistaDoProcesso = async (referenciaProcesso = '') => {
    const filtroProcesso = String(
      referenciaProcesso || obterReferenciaProcesso(processo) || idProcesso || '',
    ).trim();

    setCarregandoSlotsEntrevista(true);
    try {
      const listaSlots = await lerSlotsEntrevista({ idProcesso: filtroProcesso });
      setSlotsEntrevista(Array.isArray(listaSlots) ? listaSlots : []);
    } catch (error) {
      console.error('Erro ao carregar horários de entrevista.', error);
      setSlotsEntrevista([]);
      setErro(
        error?.message || 'Não foi possível carregar os horários de entrevista agora.',
      );
    } finally {
      setCarregandoSlotsEntrevista(false);
    }
  };

  useEffect(() => {
    carregar(1);
  }, []);

  const processoEncerrado = isProcessClosed(processo);
  const basePublicaConfigurada = useMemo(
    () =>
      String(
        processo?.public_candidate_base_url || obterBasePublicaCandidatura(),
      ).trim(),
    [processo?.public_candidate_base_url],
  );
  const urlInternaCandidatura = useMemo(
    () =>
      processo?.link_publico_slug
        ? montarUrlPublicaCandidatura(processo.link_publico_slug)
        : '',
    [processo?.link_publico_slug],
  );
  const urlPublicaCandidatura = useMemo(
    () =>
      processo?.link_publico_slug && basePublicaConfigurada
        ? montarUrlPublicaCandidatura(
          processo.link_publico_slug,
          basePublicaConfigurada,
        )
        : '',
    [processo?.link_publico_slug, basePublicaConfigurada],
  );
  const linkPublicoAtivo = Boolean(processo?.link_publico_ativo) && !processoEncerrado;
  const statusPaginaPublica = !processo?.link_publico_slug
    ? 'Não gerada'
    : linkPublicoAtivo
      ? 'Ativa'
      : 'Inativa';
  const candidatosComFluxo = useMemo(
    () =>
      candidatos.map((candidato) =>
        montarCandidatoDeFluxo(candidato, processo?.status || ''),
      ),
    [candidatos, processo?.status],
  );
  const candidatosInscritos = useMemo(
    () =>
      candidatosComFluxo.filter((candidato) => {
        const origem = normalizarTextoComparacao(candidato.origem);
        const status = canonicalizeCandidateStatus(
          candidato.status_fluxo || candidato.status_candidato,
        );
        return origem.includes('pagina de candidatura') && status === CANDIDATE_STATUS_ANALYSIS;
      }),
    [candidatosComFluxo],
  );
  const candidatosOperacionais = useMemo(
    () =>
      candidatosComFluxo.filter(
        (candidato) =>
          !candidatosInscritos.some(
            (inscrito) => Number(inscrito.id_registro || 0) === Number(candidato.id_registro || 0),
          ) &&
          isActiveCandidateStatus(candidato.status_fluxo || candidato.status_candidato),
      ),
    [candidatosComFluxo, candidatosInscritos],
  );
  const candidatosAprovados = useMemo(
    () =>
      candidatosComFluxo.filter(
        (candidato) =>
          canonicalizeCandidateStatus(
            candidato.status_fluxo || candidato.status_candidato,
          ) === CANDIDATE_STATUS_APPROVED,
      ),
    [candidatosComFluxo],
  );
  const encontrarAnaliseDoInscrito = (candidato) =>
    preAnalises.find((item) => {
      const emailAnalise = normalizarTextoComparacao(item.email);
      const emailCandidato = normalizarTextoComparacao(candidato.email);
      return emailAnalise && emailCandidato && emailAnalise === emailCandidato;
    }) ||
    (candidato.cv_id_pre_analise
      ? {
        id_pre_analise: candidato.cv_id_pre_analise,
        nome_candidato: candidato.nome_candidato,
        email: candidato.email,
        telefone: candidato.telefone,
        whatsapp: candidato.whatsapp,
        score_final: candidato.cv_score_final,
        classificacao: candidato.cv_classificacao,
        classificacao_slug: candidato.cv_classificacao_slug,
        problemas: candidato.cv_problemas,
      }
      : null);
  const slotsDisponiveisEntrevista = useMemo(
    () => {
      const agora = new Date();
      return slotsEntrevista.filter(
        (slot) => {
          const statusSlot = normalizarTextoComparacao(
            slot.status_calculado || slot.status_slot || slot.status || '',
          );
          const inicioSlot = obterDataInicioSlotEntrevista(slot);
          return (
            statusSlot !== 'bloqueado'
            && statusSlot !== 'lotado'
            && obterVagasDisponiveisSlotEntrevista(slot) > 0
            && inicioSlot
            && inicioSlot > agora
          );
        },
      );
    },
    [slotsEntrevista],
  );

  const formatarHorarioSlotEntrevista = (slot) => {
    if (!slot) return '-';

    const inicio = obterDataInicioSlotEntrevista(slot);
    const fim = obterDataFimSlotEntrevista(slot);
    const vagasDisponiveis = obterVagasDisponiveisSlotEntrevista(slot);
    const rotuloVagas =
      vagasDisponiveis === 1 ? 'vaga disponível' : 'vagas disponíveis';

    if (!inicio || !fim) {
      return `${formatarDataHora(slot.inicio)} ate ${formatarDataHora(slot.fim)} — ${vagasDisponiveis} ${rotuloVagas}`;
    }

    const horaInicio = inicio.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    });
    const horaFim = fim.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    });

    return `${inicio.toLocaleDateString('pt-BR')} - ${horaInicio} às ${horaFim} — ${vagasDisponiveis} ${rotuloVagas}`;
  };

  const montarDataEntrevistaIso = (slot) => {
    const data = obterDataInicioSlotEntrevista(slot);
    if (!data) return '';

    const pad = (value) => String(value).padStart(2, '0');
    return [
      data.getFullYear(),
      pad(data.getMonth() + 1),
      pad(data.getDate()),
    ].join('-') + `T${pad(data.getHours())}:${pad(data.getMinutes())}:00`;
  };

  const abrirCurriculo = async (candidato) => {
    if (!candidato?.id_teste || !candidato?.cv_disponivel) {
      setErro('Currículo não encontrado para este candidato.');
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

  const abrirDetalheProva = async (candidato) => {
    if (!candidatoTemProvaSalva(candidato)) {
      setErro('Este candidato ainda não possui prova salva neste processo.');
      return;
    }

    try {
      setErro('');
      const idTesteProva = candidato.id_teste_prova || candidato.id_teste;
      setCarregandoDetalheProva(String(candidato.id_registro || idTesteProva || ''));
      const detalhe = await carregarDetalhesProva(
        idTesteProva,
        obterReferenciaProcesso(processo) || idProcesso,
      );
      const processoAtualRef = String(obterReferenciaProcesso(processo) || idProcesso || '').trim();
      const processoProvaRef = String(
        detalhe?.linha?.id_processo_ref || detalhe?.linha?.id_processo || '',
      ).trim();

      if (
        processoAtualRef &&
        processoProvaRef &&
        processoAtualRef !== processoProvaRef &&
        processoAtualRef.split('@@', 1)[0] !== processoProvaRef
      ) {
        throw new Error('O resultado encontrado pertence a outro processo.');
      }

      setDetalheProvaSelecionado(detalhe);
    } catch (error) {
      setErro(error?.message || 'Não foi possível abrir o resultado da prova.');
    } finally {
      setCarregandoDetalheProva('');
    }
  };

  const analisarCvInscrito = async (candidato) => {
    if (processoEncerrado) {
      setErro('O processo seletivo está encerrado e não permite novas movimentações.');
      return;
    }

    if (!candidato?.id_teste) {
      setErro('Candidato inscrito não identificado.');
      return;
    }

    try {
      setErro('');
      await analisarCvCandidatoInscrito(candidato.id_teste, {
        id_processo: obterReferenciaProcesso(processo) || idProcesso,
      });
      await carregar(1);
    } catch (error) {
      setErro(error?.message || 'Não foi possível analisar o CV deste candidato.');
    }
  };

  const gerarPaginaPublica = async () => {
    if (!processo) return;

    try {
      const resultado = await gerarLinkPublicoCandidatura(
        obterReferenciaProcesso(processo) || idProcesso,
      );
      await carregar(paginaPreAnalises);
      if (resultado?.url) {
        setFeedbackLinkPublico(
          resultado?.aviso_url_publica || 'Página pública gerada com sucesso.',
        );
      }
    } catch (error) {
      setErro(
        error?.message ||
        'Não foi possível gerar a página pública de candidatura.',
      );
    }
  };

  const copiarLinkPublico = async () => {
    if (!linkPublicoAtivo) return;
    if (!urlPublicaCandidatura) {
      setErro(AVISO_URL_PUBLICA_NAO_CONFIGURADA);
      return;
    }

    try {
      await copiarTexto(urlPublicaCandidatura);
      setFeedbackLinkPublico('Link público copiado.');
    } catch (error) {
      setErro('Não foi possível copiar o link público agora.');
    }
  };

  const abrirPaginaPublica = () => {
    const url = urlPublicaCandidatura || urlInternaCandidatura;
    if (!url) return;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const desativarPaginaPublica = async () => {
    if (!processo) return;
    if (!window.confirm('Deseja desativar o link público desta vaga?')) {
      return;
    }

    try {
      await desativarLinkPublicoCandidatura(
        obterReferenciaProcesso(processo) || idProcesso,
      );
      await carregar(paginaPreAnalises);
      setFeedbackLinkPublico('Link público desativado.');
    } catch (error) {
      setErro(
        error?.message ||
        'Não foi possível desativar o link público desta vaga.',
      );
    }
  };

  const salvarObservacoesPublicasVaga = async () => {
    if (!processo) return;

    try {
      setSalvandoObservacoesPublicas(true);
      await atualizarProcesso(obterReferenciaProcesso(processo) || idProcesso, {
        quantidade_vagas: Number(processo.quantidade_vagas || 0),
        data_encerramento: processo.data_encerramento || '',
        operacao: processo.operacao || '',
        trilha: processo.trilha || '',
        usa_nota_corte: Number(processo.usa_nota_corte || 0),
        nota_corte:
          processo.nota_corte !== '' && processo.nota_corte !== null
            ? Number(processo.nota_corte)
            : null,
        status: processo.status || 'Aberto',
        link_agendamento: processo.link_agendamento || '',
        observacoes_publicas_vaga: observacoesPublicasVaga,
        requisitos_publicos: serializarItensPublicos(
          'requisitos',
          requisitosPublicos,
        ),
        responsabilidades_publicas: serializarItensPublicos(
          'responsabilidades',
          responsabilidadesPublicas,
        ),
      });
      await carregar(paginaPreAnalises);
      setFeedbackLinkPublico('Configurações da página pública salvas.');
    } catch (error) {
      setErro(
        error?.message ||
        'Não foi possível salvar as configurações da página pública.',
      );
    } finally {
      setSalvandoObservacoesPublicas(false);
    }
  };

  const abrirEliminacao = (candidato) => {
    const estadoAcoes = candidato?.acoes_fluxo || getCandidateActionState(candidato, processo?.status || '');
    if (estadoAcoes.processClosed || processoEncerrado) {
      setErro('Processo encerrado. Movimentações não são permitidas.');
      return;
    }

    if (!estadoAcoes.canEliminate) {
      setErro('A eliminação não está disponível para o status atual deste candidato.');
      return;
    }

    setErroEliminacao('');
    setFormularioEliminacao({
      motivo_eliminacao: '',
      etapa_eliminacao: '',
    });
    setEliminacaoSelecionada(candidato);
  };

  const atualizarStatus = async (idRegistro, status, dadosStatus = {}) => {
    const statusSeguro = String(status || '').trim();
    const candidatoAtual = candidatos.find(
      (item) => Number(item.id_registro || 0) === Number(idRegistro || 0),
    );
    const statusAtual = canonicalizeCandidateStatus(
      candidatoAtual?.status_fluxo || candidatoAtual?.status_candidato,
    );

    if (statusAtual === CANDIDATE_STATUS_APPROVED) {
      setErro(MENSAGEM_CANDIDATO_APROVADO_BLOQUEADO);
      return;
    }

    if (processoEncerrado) {
      setErro('O processo seletivo está encerrado e não permite novas movimentações.');
      return;
    }

    if (statusSeguro === 'Eliminado') {
      const motivoInformado = String(dadosStatus.motivo_eliminacao || '').trim();
      if (!motivoInformado) {
        abrirEliminacao(candidatoAtual || { id_registro: idRegistro });
        return;
      }
    }

    try {
      await atualizarStatusCandidato(idRegistro, {
        status_candidato: statusSeguro,
        ...(statusSeguro === CANDIDATE_STATUS_APPROVED ? dadosStatus : {}),
        ...(statusSeguro === CANDIDATE_STATUS_ELIMINATED ? dadosStatus : {}),
      });
      await carregar(paginaPreAnalises);
    } catch (error) {
      alert(error.message || 'Não foi possível atualizar o status.');
    }
  };

  const confirmarEliminacao = async () => {
    if (!eliminacaoSelecionada?.id_registro) return;

    const motivo = String(formularioEliminacao.motivo_eliminacao || '').trim();
    const etapa = String(formularioEliminacao.etapa_eliminacao || '').trim();
    if (!motivo) {
      setErroEliminacao('Selecione o motivo da eliminação.');
      return;
    }
    if (motivo === 'Eliminado na entrevista' && !etapa) {
      setErroEliminacao('Selecione em qual entrevista ocorreu a eliminação.');
      return;
    }

    await atualizarStatus(
      eliminacaoSelecionada.id_registro,
      CANDIDATE_STATUS_ELIMINATED,
      {
        motivo_eliminacao: motivo,
        etapa_eliminacao: motivo === 'Eliminado na entrevista' ? etapa : '',
        data_eliminacao: new Date().toISOString(),
      },
    );
    setEliminacaoSelecionada(null);
    setErroEliminacao('');
  };

  const abrirAprovacao = (candidato) => {
    const estadoAcoes = candidato?.acoes_fluxo || getCandidateActionState(candidato, processo?.status || '');
    if (estadoAcoes.processClosed || processoEncerrado) {
      setErro('Processo encerrado. Movimentações não são permitidas.');
      return;
    }

    if (!estadoAcoes.canApprove) {
      setErro('A aprovação não está disponível para o status atual deste candidato.');
      return;
    }

    setAprovacaoSelecionada(candidato);
  };

  const confirmarAprovacao = async (dadosAprovacao) => {
    if (!aprovacaoSelecionada) return;

    setSalvandoAprovacao(true);
    try {
      await atualizarStatus(
        aprovacaoSelecionada.id_registro,
        CANDIDATE_STATUS_APPROVED,
        dadosAprovacao,
      );
      setAprovacaoSelecionada(null);
    } finally {
      setSalvandoAprovacao(false);
    }
  };

  const enviarAprovacaoWhatsApp = async (dadosAprovacao) => {
    if (!aprovacaoSelecionada) return;
    const numero = String(
      aprovacaoSelecionada.whatsapp || aprovacaoSelecionada.telefone || '',
    ).replace(/\D/g, '');
    if (!numero) {
      throw new Error('O candidato não possui número de WhatsApp cadastrado.');
    }

    setEnviandoCanalAprovacao('whatsapp');
    try {
      await registrarWhatsappAprovacao(aprovacaoSelecionada.id_registro, dadosAprovacao);
      window.open(
        `https://wa.me/${numero}?text=${encodeURIComponent(dadosAprovacao.mensagem_aprovacao || '')}`,
        '_blank',
        'noopener,noreferrer',
      );
    } finally {
      setEnviandoCanalAprovacao('');
    }
  };

  const enviarAprovacaoEmail = async (dadosAprovacao) => {
    if (!aprovacaoSelecionada) return;
    setEnviandoCanalAprovacao('email');
    try {
      await enviarEmailAprovacao(aprovacaoSelecionada.id_registro, {
        ...dadosAprovacao,
        assunto: `Aprovação no processo seletivo - ${processo?.vaga || aprovacaoSelecionada.vaga || ''}`,
      });
    } finally {
      setEnviandoCanalAprovacao('');
    }
  };

  const enviarCv = async () => {
    if (processoEncerrado) {
      setErro('O processo seletivo está encerrado e não permite novas movimentações.');
      return;
    }

    if (!arquivoCv) {
      alert('Selecione um CV antes de analisar.');
      return;
    }

    const extensaoCv = `.${String(arquivoCv.name || '').split('.').pop() || ''}`.toLowerCase();
    if (!['.pdf', '.doc', '.docx'].includes(extensaoCv)) {
      alert('Formato de currículo não suportado. Envie um arquivo PDF, DOC ou DOCX.');
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
    if (processoEncerrado) {
      setErro('O processo seletivo está encerrado e não permite novas movimentações.');
      return;
    }

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

  const abrirEdicaoCandidato = (candidato) => {
    const estadoAcoes =
      candidato?.acoes_fluxo || getCandidateActionState(candidato, processo?.status || '');
    if (estadoAcoes.processClosed || !estadoAcoes.canEdit) {
      setErro('Processo encerrado. Movimentações não são permitidas.');
      return;
    }
    if (!candidato?.id_teste) {
      setErro('Candidato sem identificador de prova para edição.');
      return;
    }

    setCandidatoEditando(candidato);
    setFormularioCandidato(montarFormularioCandidato(candidato));
  };

  const atualizarCampoCandidato = (campo, valor) => {
    setFormularioCandidato((anterior) => ({
      ...anterior,
      [campo]: valor,
    }));
  };

  const salvarEdicaoCandidato = async () => {
    if (!candidatoEditando?.id_teste) return;
    const estadoAcoes =
      candidatoEditando?.acoes_fluxo ||
      getCandidateActionState(candidatoEditando, processo?.status || '');
    if (estadoAcoes.processClosed || !estadoAcoes.canEdit) {
      setErro('Processo encerrado. Movimentações não são permitidas.');
      return;
    }

    try {
      await atualizarPerfilCandidato(candidatoEditando.id_teste, {
        ...formularioCandidato,
      });
      setCandidatoEditando(null);
      await carregar(paginaPreAnalises);
    } catch (error) {
      alert(error.message || 'Não foi possível salvar os dados do candidato.');
    }
  };

  const excluirPreAnalise = async (idPreAnalise) => {
    if (processoEncerrado) {
      setErro('O processo seletivo está encerrado e não permite novas movimentações.');
      return;
    }

    if (!window.confirm('Deseja excluir esta pré-análise?')) return;

    try {
      await excluirPreAnaliseCv(idPreAnalise);
      await carregar(paginaPreAnalises);
    } catch (error) {
      alert(error.message || 'Não foi possível excluir a pré-análise.');
    }
  };

  const incluirNoProcesso = async (item, opcoes = {}) => {
    if (processoEncerrado) {
      setErro('O processo seletivo está encerrado e não permite novas movimentações.');
      return;
    }

    if (Number(item?.ja_adicionado_ao_processo || 0) === 1) {
      setErro('Este candidato já está vinculado a este processo.');
      return;
    }

    try {
      await adicionarPreAnaliseAoProcesso(item.id_pre_analise, opcoes);
      await carregar(paginaPreAnalises);
    } catch (error) {
      alert(error.message || 'Não foi possível adicionar ao processo.');
    }
  };

  const utilizarCandidatoNaoQualificado = async (item) => {
    const confirmar = window.confirm(
      `Este candidato foi classificado como ${item.classificacao || 'Não qualificado'}, com score de ${item.score_final ?? '-'}. Deseja utilizar este candidato mesmo assim?`,
    );
    if (!confirmar) return;
    await incluirNoProcesso(item, {
      manual_override: true,
      motivo_override:
        'Utilizado manualmente pelo RH apesar da classificação automática.',
    });
  };

  const enviarPreAnaliseAoBancoTalentos = async (item) => {
    if (processoEncerrado) {
      setErro('O processo seletivo está encerrado e não permite novas movimentações.');
      return;
    }

    if (Number(item?.ja_adicionado_ao_processo || 0) === 1) {
      setErro('Este candidato já está vinculado a este processo.');
      return;
    }

    const confirmar = window.confirm(
      'Este candidato será enviado para o Banco de Talentos e poderá ser utilizado em outro processo. Deseja continuar?',
    );
    if (!confirmar) return;

    try {
      const resultado = await enviarPreAnaliseParaBancoTalentos(item.id_pre_analise);
      window.alert(
        resultado?.duplicate
          ? 'Este candidato já está no Banco de Talentos.'
          : 'Candidato enviado para o Banco de Talentos.',
      );
      await carregar(paginaPreAnalises);
    } catch (error) {
      window.alert(error?.message || 'Não foi possível enviar para o Banco de Talentos.');
    }
  };

  const aplicarFiltrosPreAnalise = async (novosFiltros = filtrosPreAnalises) => {
    setFiltrosPreAnalises(novosFiltros);
    await carregar(1, novosFiltros);
  };

  const limparFiltrosPreAnalise = async () => {
    const filtrosLimpos = {
      nome: '',
      scoreMin: '',
      scoreMax: '',
      classificacao: '',
      mostrarOcultos: false,
    };
    setFiltrosPreAnalises(filtrosLimpos);
    await carregar(1, filtrosLimpos);
  };

  const limparListaPreAnalise = async () => {
    const confirmar = window.confirm(
      'Esta ação apenas limpará a visualização da lista. Os currículos e históricos não serão excluídos.',
    );
    if (!confirmar) return;

    try {
      const filtrosAposLimpeza = { ...filtrosPreAnalises, mostrarOcultos: false };
      await limparListaPreAnalisesCv(obterReferenciaProcesso(processo) || idProcesso);
      setFiltrosPreAnalises(filtrosAposLimpeza);
      await carregar(1, filtrosAposLimpeza);
    } catch (error) {
      setErro(error?.message || 'Não foi possível limpar a visualização da pré-análise.');
    }
  };

  const analisarCvDoEmail = async (emailItem, anexo = null) => {
    if (processoEncerrado) {
      setErro('O processo seletivo está encerrado e não permite novas movimentações.');
      return;
    }

    if (!emailItem?.possui_anexo) {
      setErro('Sem anexo de CV neste e-mail.');
      return;
    }

    try {
      setErro('');
      setAnalisandoEmailUid(emailItem.uid);
      await analisarCvEmailRecebido(obterReferenciaProcesso(processo) || idProcesso, {
        uid: emailItem.uid,
        attachment_name: anexo?.nome || emailItem.nome_anexo || '',
      });
      await carregar(1);
      await carregarEmailsDoProcesso();
    } catch (error) {
      setErro(error?.message || 'Não foi possível analisar o CV recebido por e-mail.');
    } finally {
      setAnalisandoEmailUid('');
    }
  };

  const abrirAgendamento = (candidato) => {
    const estadoAcoes = candidato?.acoes_fluxo || getCandidateActionState(candidato, processo?.status || '');

    if (estadoAcoes.processClosed || !estadoAcoes.isActive) {
      setErro('Somente candidatos ativos em processo aberto podem seguir para agendamento.');
      return;
    }

    const referenciaProcesso =
      obterReferenciaProcessoDoCandidato(candidato) ||
      obterReferenciaProcesso(processo) ||
      idProcesso;

    setErro('');
    setSlotsEntrevista([]);
    setAgendamentoSelecionado(candidato);
    setDocumentosEntrevista([]);
    setFormularioEntrevista({
      id_registro: candidato.id_registro,
      id_processo: candidato.id_processo,
      id_processo_ref: referenciaProcesso,
      id_slot: '',
      data_entrevista: '',
      status_entrevista: 'Agendado',
      link_agendamento: '',
      observacoes_rh: '',
      mensagem_personalizada: '',
      email: candidato.email || '',
      telefone: candidato.telefone || '',
      whatsapp: candidato.whatsapp || candidato.telefone || '',
    });
    setMensagemEntrevistaEditada(false);
    carregarSlotsEntrevistaDoProcesso(referenciaProcesso);
  };

  const montarMensagemEntrevistaPadrao = (
    idSlot = formularioEntrevista.id_slot,
    documentos = documentosEntrevista,
  ) => {
    const nome = agendamentoSelecionado?.nome_candidato || 'candidato(a)';
    const slot = slotsDisponiveisEntrevista.find(
      (item) => Number(obterIdSlotEntrevista(item)) === Number(idSlot),
    );
    if (!slot) {
      return atualizarDocumentosNaMensagem(
        `Olá ${nome}! Gostaríamos de convocá-lo para o nosso processo seletivo para a vaga de: ${processo?.vaga || agendamentoSelecionado?.vaga || ''} no dia _data_ às _horário_.

Compareça levando os seguintes documentos:

_lista_documentos_

Nosso endereço fica na Rua Victor Civita, 77 - Bloco 1, 3° Andar. Se precisar de apoio, responda esta mensagem.`,
        documentos,
      );
    }

    const dataInicio = obterDataInicioSlotEntrevista(slot);
    const data = dataInicio.toLocaleDateString('pt-BR');
    const hora = dataInicio.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    });
    return atualizarDocumentosNaMensagem(
      `Olá ${nome}! Gostaríamos de convocá-lo para o nosso processo seletivo para a vaga de: ${processo?.vaga || agendamentoSelecionado?.vaga || ''} no dia ${data} às ${hora}.

Compareça levando os seguintes documentos:

_lista_documentos_

Nosso endereço fica na Rua Victor Civita, 77 - Bloco 1, 3° Andar. Se precisar de apoio, responda esta mensagem.`,
      documentos,
    );
  };

  const montarMensagemEntrevista = () => {
    const mensagemPersonalizada = String(formularioEntrevista.mensagem_personalizada || '').trim();
    return mensagemPersonalizada || montarMensagemEntrevistaPadrao();
  };

  const alternarDocumentoEntrevista = (documento, marcado) => {
    const proximos = marcado
      ? [...documentosEntrevista, documento]
      : documentosEntrevista.filter((item) => item !== documento);
    setDocumentosEntrevista(proximos);
    setFormularioEntrevista((atual) => ({
      ...atual,
      mensagem_personalizada: mensagemEntrevistaEditada
        ? atualizarDocumentosNaMensagem(atual.mensagem_personalizada, proximos)
        : montarMensagemEntrevistaPadrao(atual.id_slot, proximos),
    }));
  };

  const salvarAgendamento = async (canal = '') => {
    if (processoEncerrado) {
      setErro('O processo seletivo está encerrado e não permite novas movimentações.');
      return;
    }

    const mensagemErro = validarFormularioEntrevista({
      ...formularioEntrevista,
      exige_slot: true,
    });
    if (mensagemErro) {
      setErro(mensagemErro);
      return;
    }

    setSalvandoEntrevista(true);
    setErro('');

    try {
      if (canal === 'whatsapp') {
        const numeroBase = String(formularioEntrevista.whatsapp || formularioEntrevista.telefone || '').replace(/\D/g, '');
        if (!numeroBase) {
          throw new Error('O candidato não possui número de WhatsApp válido extraído do CV.');
        }
      }

      if (canal === 'email') {
        const emailDestino = String(formularioEntrevista.email || '').trim();
        if (!emailDestino) {
          throw new Error('O candidato não possui e-mail válido extraído do CV.');
        }
      }

      const slotSelecionado = slotsDisponiveisEntrevista.find(
        (item) =>
          Number(obterIdSlotEntrevista(item)) ===
          Number(formularioEntrevista.id_slot),
      );
      const dataEntrevista = montarDataEntrevistaIso(slotSelecionado);
      if (!dataEntrevista) {
        throw new Error('Selecione um horário válido para agendar a entrevista.');
      }
      const dataAgendada = new Date(dataEntrevista);
      if (Number.isNaN(dataAgendada.getTime()) || dataAgendada <= new Date()) {
        throw new Error('Selecione um horário futuro para agendar a entrevista.');
      }

      const mensagemFinal = montarMensagemEntrevista();
      const resultado = await agendarEntrevista({
        id_registro: Number(formularioEntrevista.id_registro),
        id_processo: formularioEntrevista.id_processo || '',
        id_processo_ref: formularioEntrevista.id_processo_ref || '',
        id_slot: Number(formularioEntrevista.id_slot),
        data_entrevista: dataEntrevista,
        status_entrevista: formularioEntrevista.status_entrevista || 'Agendado',
        link_agendamento: formularioEntrevista.link_agendamento || '',
        observacoes_rh: formularioEntrevista.observacoes_rh || '',
        mensagem_personalizada: mensagemFinal,
      });
      const mensagem = resultado?.mensagem_base || mensagemFinal;
      await copiarTexto(mensagem).catch(() => null);

      if (canal === 'whatsapp') {
        const numeroBase = String(formularioEntrevista.whatsapp || formularioEntrevista.telefone || '').replace(/\D/g, '');
        window.open(`https://wa.me/${numeroBase}?text=${encodeURIComponent(mensagem)}`, '_blank', 'noopener,noreferrer');
      }

      if (canal === 'email') {
        const emailDestino = String(formularioEntrevista.email || '').trim();
        const assunto = encodeURIComponent('Agendamento de entrevista');
        window.location.href = `mailto:${emailDestino}?subject=${assunto}&body=${encodeURIComponent(mensagem)}`;
      }

      if (!canal) {
        window.alert('Mensagem preparada com sucesso e copiada para a area de transferencia.');
      }

      setAgendamentoSelecionado(null);
      await carregar(paginaPreAnalises);
    } catch (error) {
      setErro(error?.message || 'Não foi possível agendar a entrevista.');
    } finally {
      setSalvandoEntrevista(false);
    }
  };

  const abrirEdicaoEntrevista = (entrevista) => {
    if (isProcessClosed(entrevista?.status_processo)) {
      setErro('O processo seletivo desta entrevista está encerrado e não permite atualização operacional.');
      return;
    }

    setEntrevistaEdicao(entrevista);
    setFormularioEdicaoEntrevista({
      id_slot: '',
      status_entrevista: entrevista.status_entrevista || 'Agendado',
      observacoes_rh: entrevista.observacoes_rh || '',
      mensagem_personalizada: entrevista.mensagem_personalizada || '',
    });
  };

  const salvarEdicaoEntrevista = async () => {
    if (!entrevistaEdicao) return;
    if (isProcessClosed(entrevistaEdicao.status_processo)) {
      setErro('O processo seletivo desta entrevista está encerrado e não permite atualização operacional.');
      return;
    }

    const mensagemErro = validarFormularioEntrevista({
      id_registro: entrevistaEdicao.id_registro,
      ...formularioEdicaoEntrevista,
    });
    if (mensagemErro) {
      setErro(mensagemErro);
      return;
    }

    setSalvandoEdicaoEntrevista(true);
    setErro('');
    try {
      const payload = {
        status_entrevista: formularioEdicaoEntrevista.status_entrevista,
        observacoes_rh: formularioEdicaoEntrevista.observacoes_rh,
        mensagem_personalizada: formularioEdicaoEntrevista.mensagem_personalizada,
      };
      if (formularioEdicaoEntrevista.id_slot) {
        payload.id_slot = Number(formularioEdicaoEntrevista.id_slot);
        if (Number(formularioEdicaoEntrevista.id_slot) !== Number(entrevistaEdicao.id_slot || 0)) {
          payload.status_entrevista = 'Reagendado';
        }
      }

      await atualizarEntrevista(entrevistaEdicao.id_entrevista, payload);
      setEntrevistaEdicao(null);
      await carregar(paginaPreAnalises);
    } catch (error) {
      setErro(error?.message || 'Não foi possível atualizar a entrevista selecionada.');
    } finally {
      setSalvandoEdicaoEntrevista(false);
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
        label: 'Voltar para processos',
        onClick: () => controlador.irParaTelaProtegida('screen-processes'),
      }}
        acoesTopo=${html`<${AcaoSair} controlador=${controlador} />`}
      >
        <div class="alert alert-info">Carregando detalhes do processo...</div>
      </${PainelRh}>
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
      acoesTopo=${html`<${AcaoSair} controlador=${controlador} />`}
    >
      <${PageIntro}
        kicker="Console • Processo seletivo"
        title="Detalhes do processo"
        description="Acompanhe o fluxo completo do RH: pré-análise, qualificação, entrevistas, decisão final e fechamento do processo."
      />

      ${erro ? html`<div class="alert alert-danger">${erro}</div>` : null}
      ${processoEncerrado
      ? html`
            <div class="rh-inline-alert">
              Processo encerrado. As movimentações operacionais de candidatos ficam bloqueadas.
            </div>
          `
      : null}

      <${SectionCard}
        title="Resumo do processo"
        description=${processo
      ? `${processo.id_processo || '-'} • ${processo.vaga || '-'}`
      : 'Processo não localizado.'}
        className="process-summary-panel compact-dashboard-card"
        tourId="process-summary"
        actions=${html`
          <button
            type="button"
            class="btn btn-outline-secondary"
            onClick=${() => controlador.irParaTelaProtegida('screen-processes')}
          >
            Voltar
          </button>
        `}
      >
        <div class="process-summary-grid">
          ${[
            {
              icon: 'flag',
              label: 'Status',
              value: processo?.status || '-',
            },
            {
              icon: 'work',
              label: 'Cargo/Vaga',
              value: processo?.vaga || '-',
            },
            {
              icon: 'groups',
              label: 'Vagas',
              value: processo?.quantidade_vagas || 0,
            },
            {
              icon: 'person_search',
              label: 'Candidatos no processo',
              value: candidatosOperacionais.length || 0,
            },
            {
              icon: 'verified',
              label: 'Aprovados',
              value: candidatosAprovados.length || 0,
            },
            {
              icon: 'event_available',
              label: 'Entrevistas agendadas',
              value: entrevistas.length || resumo?.entrevistas || 0,
            },
            {
              icon: 'calendar_month',
              label: 'Abertura',
              value: formatarDataCurta(processo?.data_criacao),
            },
            {
              icon: 'event_busy',
              label: 'Encerramento',
              value: formatarDataCurta(processo?.data_encerramento),
            },
          ].map(
            (item) => html`
              <article class="process-summary-card summary-metric-card" key=${item.label}>
                <span class="material-symbols-outlined summary-metric-icon">
                  ${item.icon}
                </span>
                <div class="summary-metric-content">
                  <span class="summary-metric-label">${item.label}</span>
                  <strong class="summary-metric-value">${item.value}</strong>
                </div>
              </article>
            `,
          )}
        </div>

        <div class="process-summary-secondary process-meta-row">
          <span class="process-meta-chip">
            <span>Operação</span>
            <strong>${processo?.operacao || '-'}</strong>
          </span>
          <span class="process-meta-chip">
            <span>Trilha</span>
            <strong>${processo?.trilha || '-'}</strong>
          </span>
          <span class="process-meta-chip">
            <span>Nota de corte</span>
            <strong>
              ${Number(processo?.usa_nota_corte || 0)
                ? processo?.nota_corte || '-'
                : 'Não'}
            </strong>
          </span>
          ${processo?.link_agendamento
            ? html`
                <a
                  href=${processo.link_agendamento}
                  target="_blank"
                  rel="noreferrer"
                  class="process-meta-chip process-meta-link"
                >
                  <span>Link legado</span>
                  <strong>Abrir link</strong>
                </a>
              `
            : html`
                <span class="process-meta-chip">
                  <span>Link legado</span>
                  <strong>Não informado</strong>
                </span>
              `}
        </div>
      </${SectionCard}>

      ${EXIBIR_PAGINA_PUBLICA_CANDIDATURA
      ? html`<${SecaoDetalheExpansivel}
        aberto=${secoesExpandidas.paginaPublica}
        titulo="Página pública de candidatura"
        description="Gere um link exclusivo para esta vaga e acompanhe o status da página pública sem expor informações administrativas."
        onToggle=${() => alternarSecao('paginaPublica')}
      >
        <${MetricGrid}
          items=${[
          { label: 'Status', value: statusPaginaPublica },
          {
            label: 'Slug público',
            value: processo?.link_publico_slug || 'Ainda não gerado',
          },
          {
            label: 'Criado em',
            value: formatarDataHora(processo?.link_publico_criado_em),
          },
        ]}
        />

        <div class="row g-3 align-items-end mt-1">
          <div class="col-lg-8">
            <label class="form-label">Link público externo</label>
            <input
              class="form-control"
              readonly
              value=${processo?.link_publico_slug
          ? urlPublicaCandidatura || 'URL pública ainda não configurada.'
          : 'Gere a página para visualizar o link público.'}
            />
            <div class="form-text">
              ${urlPublicaCandidatura
          ? 'Link externo montado com PUBLIC_CANDIDATE_BASE_URL.'
          : AVISO_URL_PUBLICA_NAO_CONFIGURADA}
            </div>
            ${urlInternaCandidatura
          ? html`
                  <label class="form-label mt-3">Link interno</label>
                  <input
                    class="form-control"
                    readonly
                    value=${urlInternaCandidatura}
                  />
                `
          : null}
          </div>

          <div class="col-lg-4">
            <div class="d-flex flex-wrap gap-2 justify-content-lg-end">
              ${!processo?.link_publico_slug
          ? html`
                    <button
                      type="button"
                      class="btn btn-primary"
                      disabled=${processoEncerrado}
                      onClick=${gerarPaginaPublica}
                    >
                      Gerar página de CV
                    </button>
                  `
          : html`
                    <button
                      type="button"
                      class="btn btn-outline-secondary"
                      disabled=${!linkPublicoAtivo}
                      onClick=${copiarLinkPublico}
                    >
                      Copiar link
                    </button>
                    <button
                      type="button"
                      class="btn btn-outline-primary"
                      disabled=${!urlPublicaCandidatura && !urlInternaCandidatura}
                      onClick=${abrirPaginaPublica}
                    >
                      Abrir página
                    </button>
                    <button
                      type="button"
                      class="btn btn-outline-danger"
                      disabled=${!linkPublicoAtivo}
                      onClick=${desativarPaginaPublica}
                    >
                      Desativar link
                    </button>
                    ${!linkPublicoAtivo && !processoEncerrado
              ? html`
                          <button
                            type="button"
                            class="btn btn-primary"
                            onClick=${gerarPaginaPublica}
                          >
                            Gerar nova página
                          </button>
                        `
              : null}
                  `}
            </div>
          </div>
        </div>

        <div class="row g-3 mt-2">
          <div class="col-lg-6">
            <label class="form-label">Requisitos da vaga</label>
            <div class="d-grid gap-2">
              ${requisitosPublicos.map(
                (item, indice) => html`
                  <label class="form-check" key=${`req-${indice}`}>
                    <input
                      class="form-check-input"
                      type="checkbox"
                      checked=${item.visivel !== false}
                      onChange=${(event) =>
                    setRequisitosPublicos((anteriores) =>
                      anteriores.map((atual, atualIndice) =>
                        atualIndice === indice
                          ? { ...atual, visivel: event.target.checked }
                          : atual,
                      ),
                    )}
                    />
                    <span class="form-check-label">${item.texto}</span>
                  </label>
                `,
              )}
            </div>
          </div>
          <div class="col-lg-6">
            <label class="form-label">Responsabilidades da vaga</label>
            <div class="d-grid gap-2">
              ${responsabilidadesPublicas.map(
                (item, indice) => html`
                  <label class="form-check" key=${`resp-${indice}`}>
                    <input
                      class="form-check-input"
                      type="checkbox"
                      checked=${item.visivel !== false}
                      onChange=${(event) =>
                    setResponsabilidadesPublicas((anteriores) =>
                      anteriores.map((atual, atualIndice) =>
                        atualIndice === indice
                          ? { ...atual, visivel: event.target.checked }
                          : atual,
                      ),
                    )}
                    />
                    <span class="form-check-label">${item.texto}</span>
                  </label>
                `,
              )}
            </div>
          </div>
          <div class="col-12">
            <label class="form-label">Observações específicas da vaga</label>
            <textarea
              class="form-control"
              rows="4"
              placeholder="Ex.: Necessario disponibilidade para escala 6x1."
              value=${observacoesPublicasVaga}
              onInput=${(event) =>
          setObservacoesPublicasVaga(event.target.value)}
            ></textarea>
            <div class="form-text">
              Campo opcional exibido na página pública somente quando preenchido.
            </div>
          </div>
          <div class="col-12 text-end">
            <button
              type="button"
              class="btn btn-outline-primary"
              disabled=${salvandoObservacoesPublicas}
              onClick=${salvarObservacoesPublicasVaga}
            >
              ${salvandoObservacoesPublicas ? 'Salvando...' : 'Salvar configurações'}
            </button>
          </div>
        </div>

        ${feedbackLinkPublico
          ? html`<div class="alert alert-success mt-3 mb-0">${feedbackLinkPublico}</div>`
          : null}
      </${SecaoDetalheExpansivel}>`
      : null}

      ${false ? html`<${SecaoDetalheExpansivel}
        aberto=${secoesExpandidas.recebimentoEmail}
        titulo="Recebimento de e-mail"
        description="Caixa de entrada configuravel para curriculos recebidos por e-mail."
        onToggle=${() => alternarSecao('recebimentoEmail')}
      >
        <div class="d-flex justify-content-between align-items-center gap-2 flex-wrap mb-3">
          <div class="text-muted small">
            Endereco monitorado:
            ${statusEmailRecebido?.email_address || 'posilvahp7@gmail.com'}
          </div>
          <button
            type="button"
            class="btn btn-sm btn-outline-secondary"
            disabled=${carregandoEmails}
            onClick=${carregarEmailsDoProcesso}
          >
            ${carregandoEmails ? 'Atualizando...' : 'Atualizar e-mails'}
          </button>
        </div>

        ${!statusEmailRecebido?.configured
        ? html`
              <div class="alert alert-warning">
                ${statusEmailRecebido?.message ||
          'Recebimento de e-mail ainda não configurado ou indisponível no momento.'}
              </div>
            `
        : null}

        <div class="table-responsive">
          <table class="table align-middle rh-modern-history-table">
            <thead>
              <tr>
                <th>Remetente</th>
                <th>Assunto / resumo</th>
                <th>Data</th>
                <th>Dados encontrados</th>
                <th>Anexo</th>
                <th>Status</th>
                <th class="text-end">Ações</th>
              </tr>
            </thead>
            <tbody>
              ${emailsRecebidos.length
        ? emailsRecebidos.map((emailItem) => {
          const anexos = Array.isArray(emailItem?.anexos)
            ? emailItem.anexos
            : [];
          const anexosCv = anexos.filter((anexo) => anexo?.cv_compativel);
          const anexoPrincipal = anexosCv[0] || null;
          return html`
                      <tr key=${emailItem.uid}>
                        <td>
                          <strong>${emailItem.remetente || '-'}</strong>
                          <div class="small text-muted">${emailItem.email_encontrado || '-'}</div>
                        </td>
                        <td>
                          <div>${emailItem.assunto || '-'}</div>
                          <div class="small text-muted">${emailItem.resumo || '-'}</div>
                        </td>
                        <td>${formatarDataHora(emailItem.data_hora)}</td>
                        <td>
                          <div>${emailItem.nome_candidato_possivel || '-'}</div>
                          <div class="small text-muted">${emailItem.vaga_pretendida_possivel || '-'}</div>
                          <div class="small text-muted">${emailItem.telefone_encontrado || '-'}</div>
                        </td>
                        <td>
                          ${emailItem.possui_anexo
              ? html`
                                <div>${emailItem.nome_anexo || 'Anexo recebido'}</div>
                                <div class="small text-muted">
                                  ${anexosCv.length ? 'CV compativel' : 'Sem anexo de CV compativel'}
                                </div>
                              `
              : 'Sem anexo'}
                        </td>
                        <td>
                          <span class="process-candidate-status-badge is-pending">
                            ${emailItem.status_analise || 'Pendente'}
                          </span>
                        </td>
                        <td class="text-end">
                          <div class="rh-table-actions">
                            <button
                              type="button"
                              class="btn btn-sm btn-outline-dark rh-action-btn"
                              onClick=${() => setStatusEmailRecebido({
                ...(statusEmailRecebido || {}),
                message: emailItem.resumo || 'Sem corpo para exibir.',
              })}
                            >
                              <span class="material-symbols-outlined">visibility</span>
                              Detalhes
                            </button>
                            <button
                              type="button"
                              class="btn btn-sm btn-outline-primary rh-action-btn"
                              disabled=${processoEncerrado || !anexoPrincipal || analisandoEmailUid === emailItem.uid}
                              onClick=${() => analisarCvDoEmail(emailItem, anexoPrincipal)}
                            >
                              <span class="material-symbols-outlined">auto_awesome</span>
                              ${analisandoEmailUid === emailItem.uid ? 'Analisando...' : 'Analisar CV'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    `;
        })
        : html`
                    <${TabelaVazia}
                      colunas=${7}
                      texto=${carregandoEmails
            ? 'Carregando e-mails recebidos.'
            : 'Nenhum e-mail recebido para listar.'}
                    />
                  `}
            </tbody>
          </table>
        </div>
      </${SecaoDetalheExpansivel}>` : null}

      ${EXIBIR_CANDIDATOS_INSCRITOS ? html`<${SecaoDetalheExpansivel}
        aberto=${secoesExpandidas.candidatosInscritos}
        titulo="Candidatos inscritos"
        description="Candidatos recebidos pela página pública Envie seu currículo, ainda em triagem pelo RH."
        tourId="process-public-applicants"
        onToggle=${() => alternarSecao('candidatosInscritos')}
      >
        <div class="table-responsive">
          <table class="table align-middle rh-modern-history-table">
            <thead>
              <tr>
                <th>Candidato</th>
                <th>Contato</th>
                <th>Localidade</th>
                <th>Inscrição</th>
                <th>Status / análise</th>
                <th>Score</th>
                <th class="text-end">Ações</th>
              </tr>
            </thead>
            <tbody>
              ${candidatosInscritos.length
      ? candidatosInscritos.map((candidato) => {
        const analise = encontrarAnaliseDoInscrito(candidato);
        return html`
                      <tr key=${candidato.id_registro}>
                        <td>
                          <strong>${candidato.nome_candidato || '-'}</strong>
                          <div class="small text-muted">${candidato.vaga || '-'}</div>
                        </td>
                        <td>
                          <div>${candidato.email || '-'}</div>
                          <div class="small text-muted">
                            ${candidato.whatsapp || candidato.telefone || '-'}
                          </div>
                        </td>
                        <td>
                          <div>${candidato.cidade || '-'}</div>
                          <div class="small text-muted">${candidato.bairro || '-'}</div>
                        </td>
                        <td>${formatarDataHora(candidato.data_prova)}</td>
                        <td>
                          <span
                            class=${`process-candidate-status-badge ${obterClasseStatusProcesso(candidato.status_fluxo)}`}
                          >
                            ${analise?.classificacao || candidato.status_fluxo || '-'}
                          </span>
                          ${analise?.classificacao
            ? html`<div class="small text-muted mt-1">CV analisado</div>`
            : html`<div class="small text-muted mt-1">Aguardando análise</div>`}
                        </td>
                        <td>${analise?.score_final ?? '-'}</td>
                        <td class="text-end">
                          <div class="rh-table-actions">
                            <button
                              type="button"
                              class="btn btn-sm btn-outline-secondary"
                              onClick=${() => abrirCurriculo(candidato)}
                            >
                              Ver CV
                            </button>
                            <button
                              type="button"
                              class="btn btn-sm btn-outline-primary"
                              disabled=${processoEncerrado}
                              onClick=${() => analisarCvInscrito(candidato)}
                            >
                              ${processoEncerrado ? 'Processo encerrado' : 'Analisar CV'}
                            </button>
                            ${analise
            ? html`
                                  <button
                                    type="button"
                                    class="btn btn-sm btn-outline-dark"
                                    onClick=${() => setResultadoAnaliseSelecionado(analise)}
                                  >
                                    Resultado
                                  </button>
                                `
            : null}
                            ${analise &&
            isPreAnaliseNaoQualificada(analise) &&
            Number(analise.ja_adicionado_ao_processo || 1) !== 1 &&
            !processoEncerrado
            ? html`
                                  <button
                                    type="button"
                                    class="btn btn-sm btn-outline-warning"
                                    onClick=${() => utilizarCandidatoNaoQualificado(analise)}
                                  >
                                    Utilizar candidato
                                  </button>
                                  <button
                                    type="button"
                                    class="btn btn-sm btn-outline-secondary rh-action-btn"
                                    onClick=${() => enviarPreAnaliseAoBancoTalentos(analise)}
                                  >
                                    Banco de Talentos
                                  </button>
                                `
            : null}
                          </div>
                        </td>
                      </tr>
                    `;
      })
      : html`
                    <${TabelaVazia}
                      colunas=${7}
                      texto="Nenhum candidato inscrito pela página pública."
                    />
                  `}
            </tbody>
          </table>
        </div>
      </${SecaoDetalheExpansivel}>` : null}

      <${SecaoDetalheExpansivel}
        aberto=${secoesExpandidas.preAnaliseCv}
        titulo="Pré-análise de CV"
        description="Análise automática com possibilidade de ajuste manual antes da inclusão no processo."
        tourId="process-cv-preanalysis"
        onToggle=${() => alternarSecao('preAnaliseCv')}
      >
        ${avisosSecoes.preAnaliseCv
      ? html`<div class="alert alert-warning">${avisosSecoes.preAnaliseCv}</div>`
      : null}
        <div class="row g-3 align-items-end">
          <div class="col-md-6">
            <label class="form-label">Adicionar CV</label>
            <input
              type="file"
              class="form-control"
              accept=".pdf,.doc,.docx"
              disabled=${processoEncerrado || analisandoCv}
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
                Guardar CV original
              </label>
            </div>
          </div>
          <div class="col-md-3">
            <button
              type="button"
              class="btn btn-primary w-100"
              onClick=${enviarCv}
              disabled=${processoEncerrado || analisandoCv}
            >
              ${processoEncerrado
      ? 'Processo encerrado'
      : analisandoCv
        ? 'Analisando...'
        : 'Analisar CV'}
            </button>
          </div>
        </div>

        <div class="rh-filter-grid rh-filter-grid--wide mt-4">
          <div class="rh-filter-field">
            <label>Nome</label>
            <input
              class="form-control"
              placeholder="Buscar candidato"
              value=${filtrosPreAnalises.nome}
              onInput=${(event) =>
      setFiltrosPreAnalises({
        ...filtrosPreAnalises,
        nome: event.target.value,
      })}
            />
          </div>
          <div class="rh-filter-field">
            <label>Score minimo</label>
            <input
              class="form-control"
              type="number"
              min="0"
              max="10"
              step="0.1"
              value=${filtrosPreAnalises.scoreMin}
              onInput=${(event) =>
      setFiltrosPreAnalises({
        ...filtrosPreAnalises,
        scoreMin: event.target.value,
      })}
            />
          </div>
          <div class="rh-filter-field">
            <label>Score maximo</label>
            <input
              class="form-control"
              type="number"
              min="0"
              max="10"
              step="0.1"
              value=${filtrosPreAnalises.scoreMax}
              onInput=${(event) =>
      setFiltrosPreAnalises({
        ...filtrosPreAnalises,
        scoreMax: event.target.value,
      })}
            />
          </div>
          <div class="rh-filter-field">
            <label>Classificacao</label>
            <select
              class="form-select"
              value=${filtrosPreAnalises.classificacao}
              onChange=${(event) =>
      setFiltrosPreAnalises({
        ...filtrosPreAnalises,
        classificacao: event.target.value,
      })}
            >
              <option value="">Todas</option>
              ${classificacoesPreAnalises.map(
        (classificacao) => html`
                  <option value=${classificacao} key=${classificacao}>
                    ${classificacao}
                  </option>
                `,
      )}
            </select>
          </div>
        </div>

        <div class="d-flex justify-content-between gap-2 flex-wrap mt-3">
          <label class="form-check">
            <input
              class="form-check-input"
              type="checkbox"
              checked=${filtrosPreAnalises.mostrarOcultos}
              onChange=${(event) =>
      aplicarFiltrosPreAnalise({
        ...filtrosPreAnalises,
        mostrarOcultos: event.target.checked,
      })}
            />
            <span class="form-check-label">Mostrar itens limpos</span>
          </label>
          <div class="d-flex gap-2 flex-wrap">
            <button
              type="button"
              class="btn btn-outline-secondary btn-sm"
              onClick=${limparFiltrosPreAnalise}
            >
              Limpar filtros
            </button>
            <button
              type="button"
              class="btn btn-outline-primary btn-sm"
              onClick=${() => aplicarFiltrosPreAnalise()}
            >
              Aplicar filtros
            </button>
            <button
              type="button"
              class="btn btn-outline-danger btn-sm"
              disabled=${processoEncerrado || !preAnalises.length}
              onClick=${limparListaPreAnalise}
            >
              Limpar lista
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
              ${preAnalises.length
      ? preAnalises.map(
        (item) => html`
                      <tr key=${item.id_pre_analise}>
                        <td>${item.nome_candidato || '-'}</td>
                        <td>${item.email || '-'}</td>
                        <td>${item.telefone || item.whatsapp || '-'}</td>
                        <td>
                          <span
                            class=${`cv-classification-badge ${item.classificacao_slug || ''}`}
                          >
                            ${item.classificacao || '-'}
                          </span>
                          ${Number(item.ja_adicionado_ao_processo || 0) === 1
            ? html`
                                <div class="small text-muted mt-1">
                                  ${item.situacao_pre_analise || 'Já incluído no processo'}
                                </div>
                              `
            : null}
                        </td>
                        <td>${item.score_final ?? '-'}</td>
                        <td class="text-end">
                          <div class="d-flex justify-content-end gap-2 flex-wrap">
                            ${!processoEncerrado
            ? html`
                                  <button
                                    type="button"
                                    class="btn btn-sm btn-outline-secondary"
                                    onClick=${() => setPreAnaliseSelecionada({ ...item })}
                                  >
                                    Editar
                                  </button>
                                `
            : null}
                            <button
                              type="button"
                              class="btn btn-sm btn-outline-dark rh-action-btn"
                              onClick=${() => setResultadoAnaliseSelecionado(item)}
                            >
                              Resultado
                            </button>
                            <button
                              type="button"
                              class="btn btn-sm btn-outline-info rh-action-btn"
                              onClick=${() => setVisualizacaoCv(item)}
                            >
                              Ver CV
                            </button>
                            ${!processoEncerrado &&
            Number(item.ja_adicionado_ao_processo || 0) !== 1 &&
            isPreAnaliseUtilizavelDireto(item)
            ? html`
                                  <button
                                    type="button"
                                    class="btn btn-sm btn-outline-success rh-action-btn"
                                    onClick=${() =>
                incluirNoProcesso(item)}
                                  >
                                    Adicionar
                                  </button>
                                `
            : null}
                            ${!processoEncerrado &&
            Number(item.ja_adicionado_ao_processo || 0) !== 1 &&
            isPreAnaliseNaoQualificada(item)
            ? html`
                                  <button
                                    type="button"
                                    class="btn btn-sm btn-outline-warning rh-action-btn"
                                    onClick=${() =>
                utilizarCandidatoNaoQualificado(item)}
                                  >
                                    Utilizar candidato
                                  </button>
                                  <button
                                    type="button"
                                    class="btn btn-sm btn-outline-secondary rh-action-btn"
                                    onClick=${() =>
                enviarPreAnaliseAoBancoTalentos(item)}
                                  >
                                    Banco de Talentos
                                  </button>
                                `
            : null}
                            ${!processoEncerrado
            ? html`
                                  <button
                                    type="button"
                                    class="btn btn-sm btn-outline-danger rh-action-btn"
                                    onClick=${() => excluirPreAnalise(item.id_pre_analise)}
                                  >
                                    Excluir
                                  </button>
                                `
            : null}
                          </div>
                        </td>
                      </tr>
                    `,
      )
      : html`
                    <${TabelaVazia}
                      colunas=${6}
                      texto="Nenhuma pré-análise encontrada."
                    />
                  `}
            </tbody>
          </table>
        </div>

        <${GrupoPaginacao}
          paginaAtual=${paginaPreAnalises}
          totalPaginas=${totalPaginasPreAnalises}
          onChange=${(pagina) => carregar(pagina)}
        />
      </${SecaoDetalheExpansivel}>

      <div class="process-candidates-grid">
        <${SecaoDetalheExpansivel}
          aberto=${secoesExpandidas.candidatosProcesso}
          titulo="Candidatos no processo"
          description="As ações aparecem somente quando a etapa do candidato permite movimentação dentro do fluxo do RH."
          tourId="process-candidates"
          onToggle=${() => alternarSecao('candidatosProcesso')}
        >
        <div class="table-responsive">
          <table class="table align-middle rh-modern-history-table">
            <thead>
              <tr>
                <th>Candidato</th>
                <th>Contato / origem</th>
                <th>Localidade</th>
                <th>Status</th>
                <th>Prova</th>
                <th>CV</th>
                <th class="text-end">Ações</th>
              </tr>
            </thead>
            <tbody>
              ${candidatosOperacionais.length
      ? candidatosOperacionais.map(
        (candidato) => {
          const tagsCandidato = Array.isArray(candidato?.tags)
            ? candidato.tags
            : [];
          return html`
                      <tr key=${candidato.id_registro}>
                        <td>
                          <strong>${candidato.nome_candidato || '-'}</strong>
                          <div class="small text-muted mt-1">
                            ${candidato.vaga || '-'}
                          </div>
                          ${tagsCandidato.length
              ? html`
                                <div class="rh-chip-wrap mt-2">
                                  ${tagsCandidato.slice(0, 3).map(
                (tag) => html`
                                      <span key=${tag} class="rh-chip">${tag}</span>
                                    `,
              )}
                                </div>
                              `
              : null}
                        </td>
                        <td>
                          <div>${candidato.email || '-'}</div>
                          <div class="small text-muted">
                            ${candidato.whatsapp || candidato.telefone || '-'}
                          </div>
                          <div class="small text-muted">
                            Origem: ${formatarOrigemCandidato(candidato)}
                          </div>
                          ${formatarOrigemCandidato(candidato) === 'Banco de Talentos' &&
              (candidato.processo_origem || candidato.id_processo_origem)
              ? html`
                                <div class="small text-muted">
                                  Processo anterior:
                                  ${candidato.processo_origem || candidato.id_processo_origem}
                                </div>
                              `
              : null}
                        </td>
                        <td>
                          <div>${candidato.cidade || '-'}</div>
                          <div class="small text-muted">
                            ${candidato.bairro || '-'}
                          </div>
                        </td>
                        <td>
                          <span
                            class=${`process-candidate-status-badge ${obterClasseStatusProcesso(candidato.status_fluxo)}`}
                          >
                            ${candidato.status_fluxo || '-'}
                          </span>
                        </td>
                        <td>
                          ${candidatoTemProvaSalva(candidato)
              ? html`
                                <div class="rh-cell-stack">
                                  <strong>${obterNotaProvaCandidato(candidato)}</strong>
                                  <div class="d-flex gap-2 flex-wrap">
                                    <button
                                      type="button"
                                      class="btn btn-sm btn-outline-dark rh-action-btn"
                                      disabled=${carregandoDetalheProva ===
                String(candidato.id_registro || candidato.id_teste || '')}
                                      onClick=${() => abrirDetalheProva(candidato)}
                                    >
                                      <span class="material-symbols-outlined">analytics</span>
                                      Notas
                                    </button>
                                    <button
                                      type="button"
                                      class="btn btn-sm btn-outline-primary rh-action-btn"
                                      disabled=${carregandoDetalheProva ===
                String(candidato.id_registro || candidato.id_teste || '')}
                                      onClick=${() => abrirDetalheProva(candidato)}
                                    >
                                      <span class="material-symbols-outlined">visibility</span>
                                      Resultado
                                    </button>
                                  </div>
                                </div>
                              `
              : html`<span class="text-muted">Sem prova</span>`}
                        </td>
                        <td>
                          ${candidato.cv_disponivel
              ? html`
                                <button
                                  type="button"
                                  class="btn btn-sm btn-outline-secondary rh-action-btn"
                                  onClick=${() => abrirCurriculo(candidato)}
                                >
                                  <span class="material-symbols-outlined">description</span>
                                  Ver CV
                                </button>
                              `
              : 'Sem CV'}
                        </td>
                        <td class="text-end">
                          ${renderizarAcoesDoCandidato({
                candidato,
                onAgendarEntrevista: abrirAgendamento,
                onAprovar: abrirAprovacao,
                onEditar: abrirEdicaoCandidato,
                onAtualizarStatus: (item, status) =>
                  atualizarStatus(item.id_registro, status),
              })}
                        </td>
                      </tr>
                    `},
      )
      : html`
                    <${TabelaVazia}
                      colunas=${7}
                      texto="Nenhum candidato vinculado a este processo."
                    />
                  `}
            </tbody>
          </table>
        </div>
        </${SecaoDetalheExpansivel}>

        <${SecaoDetalheExpansivel}
          aberto=${secoesExpandidas.candidatosAprovados}
          titulo="Candidatos aprovados"
          description="Aprovados ficam fora do fluxo ativo e permanecem disponíveis para consulta, resultado e relatórios."
          tourId="process-approved-candidates"
          onToggle=${() => alternarSecao('candidatosAprovados')}
        >
        <div class="table-responsive">
          <table class="table align-middle rh-modern-history-table">
            <thead>
              <tr>
                <th>Candidato</th>
                <th>Contato</th>
                <th>Nota</th>
                <th>Data de aprovação</th>
                <th class="text-end">Ações</th>
              </tr>
            </thead>
            <tbody>
              ${candidatosAprovados.length
      ? candidatosAprovados.map(
        (candidato) => html`
                      <tr key=${`aprovado-${candidato.id_registro}`}>
                        <td>
                          <strong>${candidato.nome_candidato || '-'}</strong>
                          <div class="small text-muted">${candidato.vaga || '-'}</div>
                        </td>
                        <td>
                          <div>${candidato.email || '-'}</div>
                          <div class="small text-muted">
                            ${candidato.whatsapp || candidato.telefone || '-'}
                          </div>
                        </td>
                        <td>${obterNotaProvaCandidato(candidato) || 'Sem prova'}</td>
                        <td>
                          ${formatarDataHora(
          candidato.aprovado_em ||
          candidato.data_aprovacao ||
          candidato.data_atualizacao_pipeline,
        )}
                        </td>
                        <td class="text-end">
                          <div class="d-flex justify-content-end gap-2 flex-wrap">
                            <button
                              type="button"
                              class="btn btn-sm btn-outline-primary"
                              onClick=${() => setDetalheCandidatoSelecionado(candidato)}
                            >
                              Detalhes
                            </button>
                            ${candidatoTemProvaSalva(candidato)
            ? html`
                                  <button
                                    type="button"
                                    class="btn btn-sm btn-outline-dark"
                                    disabled=${carregandoDetalheProva ===
              String(candidato.id_registro || candidato.id_teste || '')}
                                    onClick=${() => abrirDetalheProva(candidato)}
                                  >
                                    Ver resultado
                                  </button>
                                `
            : null}
                            ${candidato.cv_disponivel
            ? html`
                                  <button
                                    type="button"
                                    class="btn btn-sm btn-outline-secondary"
                                    onClick=${() => abrirCurriculo(candidato)}
                                  >
                                    Ver CV
                                  </button>
                                `
            : null}
                          </div>
                        </td>
                      </tr>
                    `,
      )
      : html`
                    <${TabelaVazia}
                      colunas=${5}
                      texto="Nenhum candidato aprovado neste processo."
                    />
                  `}
            </tbody>
          </table>
        </div>
        </${SecaoDetalheExpansivel}>
      </div>

      <${SectionCard}
        title="Entrevistas agendadas"
        description="Agenda vinculada ao processo atual, usando horários internos."
        tourId="process-interviews"
        actions=${html`
          <button
            type="button"
            class="btn btn-outline-secondary"
            onClick=${() => controlador.irParaTelaProtegida('screen-interviews')}
          >
            Ver agenda completa
          </button>
        `}
      >
        ${carregando
      ? html`
              <${LoadingState}
                titulo="Carregando entrevistas"
                descricao="Sincronizando agenda e status do candidato."
              />
            `
      : entrevistas.length
        ? html`
                <div class="table-responsive">
                  <table class="table align-middle rh-modern-history-table process-interviews-table">
                    <thead>
                      <tr>
                        <th>Candidato</th>
                        <th>Data</th>
                        <th>Hora</th>
                        <th>Tipo/etapa</th>
                        <th>Status</th>
                        <th class="text-end">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${entrevistas.map(
          (entrevista) => html`
                          <tr key=${entrevista.id_entrevista}>
                            <td>
                              <strong>${entrevista.nome_candidato || '-'}</strong>
                              ${entrevista.observacoes_rh
                                ? html`<small>${entrevista.observacoes_rh}</small>`
                                : null}
                            </td>
                            <td>${formatarDataCurta(entrevista.data_entrevista)}</td>
                            <td>${formatarHoraCurta(entrevista.data_entrevista)}</td>
                            <td>${entrevista.tipo_entrevista || entrevista.etapa_entrevista || (entrevista.id_slot ? 'Calendário interno' : 'Registro legado')}</td>
                            <td>
                              <span
                                class=${`rh-status-pill ${obterClasseStatusEntrevista(entrevista.status_entrevista)}`}
                              >
                                ${entrevista.status_entrevista || '-'}
                              </span>
                            </td>
                            <td class="text-end">
                              <div class="rh-action-cluster justify-content-end">
                                <button
                                  type="button"
                                  class="btn btn-sm btn-outline-secondary rh-action-btn"
                                  onClick=${() =>
                                    copiarTexto(entrevista.mensagem_base || '')
                                      .then(() =>
                                        window.alert('Mensagem copiada para a area de transferencia.'),
                                      )
                                      .catch(() =>
                                        window.alert('Nao foi possivel copiar a mensagem automaticamente.'),
                                      )}
                                  >
                                    <span class="material-symbols-outlined">content_copy</span>
                                  Copiar
                                </button>
                                <button
                                  type="button"
                                  class="btn btn-sm btn-outline-primary rh-action-btn"
                                  disabled=${isProcessClosed(entrevista.status_processo)}
                                  onClick=${() => abrirEdicaoEntrevista(entrevista)}
                                >
                                  <span class="material-symbols-outlined">edit</span>
                                  Editar
                                </button>
                              </div>
                            </td>
                          </tr>
                        `,
        )}
                    </tbody>
                  </table>
                </div>
              `
        : html`
                <${EmptyState}
                  title="Nenhuma entrevista agendada"
                  text="Use o botão “Agendar entrevista” na tabela de candidatos para registrar o compromisso."
                />
              `}
      </${SectionCard}>

      <${ModalPadrao}
        aberto=${!!agendamentoSelecionado}
        titulo="Agendar entrevista"
        subtitulo="A entrevista será vinculada ao candidato e ao processo selecionado."
        onClose=${() => setAgendamentoSelecionado(null)}
      >
        ${agendamentoSelecionado
      ? html`
              <div class="rh-details-body">
                <div class="row g-3">
                  <div class="col-md-6">
                    <label class="form-label">Candidato</label>
                    <input
                      class="form-control"
                      readonly
                      value=${agendamentoSelecionado.nome_candidato || ''}
                    />
                  </div>
                  <div class="col-md-6">
                    <label class="form-label">Processo</label>
                    <input
                      class="form-control"
                      readonly
                      value=${agendamentoSelecionado.id_processo || ''}
                    />
                  </div>
                  <div class="col-md-6">
                    <label class="form-label">Vaga</label>
                    <input
                      class="form-control"
                      readonly
                      value=${agendamentoSelecionado.vaga || ''}
                    />
                  </div>
                  <div class="col-md-6">
                    <label class="form-label">Status inicial</label>
                    <select
                      class="form-select"
                      value=${formularioEntrevista.status_entrevista}
                      onChange=${(event) =>
          setFormularioEntrevista({
            ...formularioEntrevista,
            status_entrevista: event.target.value,
          })}
                    >
                      <option value="Agendado">Agendado</option>
                      <option value="Confirmado">Confirmado</option>
                    </select>
                  </div>
                  <div class="col-md-6">
                    <label class="form-label">Horário disponível</label>
                    <select
                      class="form-select"
                      value=${formularioEntrevista.id_slot}
                      disabled=${carregandoSlotsEntrevista}
                      onChange=${(event) => {
          const idSlotSelecionado = event.target.value;
          setFormularioEntrevista({
            ...formularioEntrevista,
            id_slot: idSlotSelecionado,
            mensagem_personalizada: mensagemEntrevistaEditada
              ? formularioEntrevista.mensagem_personalizada
              : montarMensagemEntrevistaPadrao(idSlotSelecionado),
          });
        }}
                    >
                      <option value="">
                        ${carregandoSlotsEntrevista
          ? 'Carregando horários...'
          : 'Selecione um slot'}
                      </option>
                      ${slotsDisponiveisEntrevista.map(
          (slot) => html`
                          <option
                            key=${obterIdSlotEntrevista(slot)}
                            value=${obterIdSlotEntrevista(slot)}
                          >
                            ${formatarHorarioSlotEntrevista(slot)}
                          </option>
                        `,
        )}
                    </select>
                    ${!carregandoSlotsEntrevista &&
        !slotsDisponiveisEntrevista.length
          ? html`
                            <div class="form-text">
                              Nenhum horário disponível para este processo.
                            </div>
                          `
          : null}
                  </div>
                  <div class="col-md-6">
                    <label class="form-label">WhatsApp extraído do CV</label>
                    <input
                      class="form-control"
                      placeholder="21999999999"
                      value=${formularioEntrevista.whatsapp || formularioEntrevista.telefone || ''}
                      onInput=${(event) =>
          setFormularioEntrevista({
            ...formularioEntrevista,
            whatsapp: event.target.value,
          })}
                    />
                  </div>
                  <div class="col-md-6">
                    <label class="form-label">E-mail extraído do CV</label>
                    <input
                      class="form-control"
                      placeholder="candidato@email.com"
                      value=${formularioEntrevista.email || ''}
                      onInput=${(event) =>
          setFormularioEntrevista({
            ...formularioEntrevista,
            email: event.target.value,
                      })}
                    />
                  </div>
                  <div class="col-md-12">
                    <label class="form-label">Documentos solicitados</label>
                    <div class="row g-2">
                      ${DOCUMENTOS_APROVACAO_PADRAO.map(
                        (documento) => html`
                          <label class="form-check col-md-6" key=${documento}>
                            <input
                              class="form-check-input"
                              type="checkbox"
                              checked=${documentosEntrevista.includes(documento)}
                              onChange=${(event) =>
                                alternarDocumentoEntrevista(
                                  documento,
                                  event.target.checked,
                                )}
                            />
                            <span class="form-check-label">${documento}</span>
                          </label>
                        `,
                      )}
                    </div>
                  </div>
                  <div class="col-md-12">
                    <label class="form-label">Mensagem que será enviada</label>
                    <textarea
                      class="form-control"
                      rows="6"
                      value=${montarMensagemEntrevista()}
                      onInput=${(event) => {
          setMensagemEntrevistaEditada(true);
          setFormularioEntrevista({
            ...formularioEntrevista,
            mensagem_personalizada: event.target.value,
          });
        }}
                    ></textarea>
                    <div class="form-text">
                      Este texto será usado exatamente no envio.
                    </div>
                  </div>
                  <div class="col-md-12">
                    <label class="form-label">Observações RH</label>
                    <textarea
                      class="form-control"
                      rows="4"
                      value=${formularioEntrevista.observacoes_rh}
                      onInput=${(event) =>
          setFormularioEntrevista({
            ...formularioEntrevista,
            observacoes_rh: event.target.value,
          })}
                    ></textarea>
                  </div>
                </div>
              </div>
              <footer class="rh-modal-footer">
                <button
                  type="button"
                  class="btn btn-outline-secondary"
                  onClick=${() => setAgendamentoSelecionado(null)}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  class="btn btn-outline-primary"
                  disabled=${salvandoEntrevista || processoEncerrado || !formularioEntrevista.id_slot}
                  onClick=${() => salvarAgendamento()}
                >
                  ${salvandoEntrevista ? 'Salvando...' : 'Salvar e copiar'}
                </button>
                <button
                  type="button"
                  class="btn btn-outline-primary"
                  disabled=${salvandoEntrevista || processoEncerrado || !formularioEntrevista.id_slot}
                  onClick=${() => salvarAgendamento('email')}
                >
                  ${salvandoEntrevista ? 'Salvando...' : 'Enviar por e-mail'}
                </button>
                <button
                  type="button"
                  class="btn btn-success"
                  disabled=${salvandoEntrevista || processoEncerrado || !formularioEntrevista.id_slot}
                  onClick=${() => salvarAgendamento('whatsapp')}
                >
                  ${salvandoEntrevista
          ? 'Salvando...'
          : processoEncerrado
            ? 'Processo encerrado'
            : 'Enviar por WhatsApp'}
                </button>
              </footer>
            `
      : null}
      </${ModalPadrao}>

      <${ModalAprovacaoCandidato}
        aberto=${!!aprovacaoSelecionada}
        candidato=${aprovacaoSelecionada}
        processo=${processo}
        salvando=${salvandoAprovacao}
        enviandoCanal=${enviandoCanalAprovacao}
        onClose=${() => setAprovacaoSelecionada(null)}
        onConfirm=${confirmarAprovacao}
        onSendWhatsApp=${enviarAprovacaoWhatsApp}
        onSendEmail=${enviarAprovacaoEmail}
      />

      <${ModalPadrao}
        aberto=${!!eliminacaoSelecionada}
        titulo="Eliminar candidato"
        subtitulo="Informe o motivo antes de confirmar a eliminação."
        onClose=${() => setEliminacaoSelecionada(null)}
      >
        ${eliminacaoSelecionada
          ? html`
              <div class="rh-details-body">
                <div class="row g-3">
                  <div class="col-md-12">
                    <label class="form-label">Candidato</label>
                    <input
                      class="form-control"
                      readonly
                      value=${eliminacaoSelecionada.nome_candidato || ''}
                    />
                  </div>
                  <div class="col-md-12">
                    <label class="form-label">Motivo da eliminação</label>
                    <select
                      class="form-select"
                      value=${formularioEliminacao.motivo_eliminacao}
                      onChange=${(event) =>
                        setFormularioEliminacao({
                          motivo_eliminacao: event.target.value,
                          etapa_eliminacao:
                            event.target.value === 'Eliminado na entrevista'
                              ? formularioEliminacao.etapa_eliminacao
                              : '',
                        })}
                    >
                      <option value="">Selecione...</option>
                      ${MOTIVOS_ELIMINACAO.map(
                        (motivo) => html`
                          <option key=${motivo} value=${motivo}>${motivo}</option>
                        `,
                      )}
                    </select>
                  </div>
                  ${formularioEliminacao.motivo_eliminacao === 'Eliminado na entrevista'
                    ? html`
                        <div class="col-md-12">
                          <label class="form-label">Em qual entrevista?</label>
                          <select
                            class="form-select"
                            value=${formularioEliminacao.etapa_eliminacao}
                            onChange=${(event) =>
                              setFormularioEliminacao({
                                ...formularioEliminacao,
                                etapa_eliminacao: event.target.value,
                              })}
                          >
                            <option value="">Selecione...</option>
                            ${ETAPAS_ELIMINACAO_ENTREVISTA.map(
                              (etapa) => html`
                                <option key=${etapa} value=${etapa}>${etapa}</option>
                              `,
                            )}
                          </select>
                        </div>
                      `
                    : null}
                </div>
                ${erroEliminacao
                  ? html`<div class="alert alert-warning mt-3 mb-0">${erroEliminacao}</div>`
                  : null}
              </div>
              <footer class="rh-modal-footer">
                <button
                  type="button"
                  class="btn btn-outline-secondary"
                  onClick=${() => setEliminacaoSelecionada(null)}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  class="btn btn-danger"
                  onClick=${confirmarEliminacao}
                >
                  Confirmar eliminação
                </button>
              </footer>
            `
          : null}
      </${ModalPadrao}>

      <${ModalEdicaoEntrevista}
        aberto=${!!entrevistaEdicao}
        entrevista=${entrevistaEdicao}
        formulario=${formularioEdicaoEntrevista}
        slotsDisponiveis=${slotsDisponiveisEntrevista}
        salvando=${salvandoEdicaoEntrevista}
        onClose=${() => setEntrevistaEdicao(null)}
        onChange=${setFormularioEdicaoEntrevista}
        onSave=${salvarEdicaoEntrevista}
      />

      <${ModalPadrao}
        aberto=${!!detalheCandidatoSelecionado}
        titulo=${`Detalhes do candidato | ${detalheCandidatoSelecionado?.nome_candidato || 'Candidato'}`}
        subtitulo="Consulta administrativa do candidato no processo."
        onClose=${() => setDetalheCandidatoSelecionado(null)}
      >
        ${detalheCandidatoSelecionado
      ? html`
              <div class="rh-details-body">
                <${MetricGrid}
                  items=${[
          {
            label: 'Nome',
            value: detalheCandidatoSelecionado.nome_candidato || '-',
          },
          {
            label: 'E-mail',
            value: detalheCandidatoSelecionado.email || '-',
          },
          {
            label: 'Telefone',
            value:
              detalheCandidatoSelecionado.whatsapp ||
              detalheCandidatoSelecionado.telefone ||
              '-',
          },
          {
            label: 'Status',
            value: detalheCandidatoSelecionado.status_fluxo || '-',
          },
          ...(canonicalizeCandidateStatus(
            detalheCandidatoSelecionado.status_fluxo ||
              detalheCandidatoSelecionado.status_candidato,
          ) === CANDIDATE_STATUS_ELIMINATED
            ? [
                {
                  label: 'Motivo da eliminação',
                  value: obterMotivoEliminacao(detalheCandidatoSelecionado),
                },
                {
                  label: 'Etapa da eliminação',
                  value: detalheCandidatoSelecionado.etapa_eliminacao || '-',
                },
                {
                  label: 'Data da eliminação',
                  value: formatarDataHora(
                    detalheCandidatoSelecionado.data_eliminacao ||
                      detalheCandidatoSelecionado.eliminado_em,
                  ),
                },
              ]
            : []),
          {
            label: 'Nota',
            value:
              obterNotaProvaCandidato(detalheCandidatoSelecionado) ||
              'Sem prova',
          },
          {
            label: 'Aprovação',
            value: formatarDataHora(
              detalheCandidatoSelecionado.aprovado_em ||
              detalheCandidatoSelecionado.data_aprovacao ||
              detalheCandidatoSelecionado.data_atualizacao_pipeline,
            ),
          },
        ]}
                />
              </div>
              <footer class="rh-modal-footer">
                <button
                  type="button"
                  class="btn btn-primary"
                  onClick=${() => setDetalheCandidatoSelecionado(null)}
                >
                  Fechar
                </button>
              </footer>
            `
      : null}
      </${ModalPadrao}>

      <${ModalPadrao}
        aberto=${!!candidatoEditando}
        titulo=${`Editar candidato | ${candidatoEditando?.nome_candidato || 'Candidato'}`}
        subtitulo="Atualize dados cadastrais sem alterar o vínculo com o processo."
        onClose=${() => setCandidatoEditando(null)}
      >
        ${candidatoEditando
      ? html`
              <div class="rh-details-body">
                <div class="row g-3">
                  <div class="col-md-6">
                    <label class="form-label">Nome</label>
                    <input
                      class="form-control"
                      value=${formularioCandidato.nome_candidato}
                      onInput=${(event) =>
          atualizarCampoCandidato('nome_candidato', event.target.value)}
                    />
                  </div>
                  <div class="col-md-6">
                    <label class="form-label">E-mail</label>
                    <input
                      class="form-control"
                      value=${formularioCandidato.email}
                      onInput=${(event) =>
          atualizarCampoCandidato('email', event.target.value)}
                    />
                  </div>
                  <div class="col-md-6">
                    <label class="form-label">Telefone</label>
                    <input
                      class="form-control"
                      value=${formularioCandidato.telefone}
                      onInput=${(event) =>
          atualizarCampoCandidato('telefone', event.target.value)}
                    />
                  </div>
                  <div class="col-md-6">
                    <label class="form-label">WhatsApp</label>
                    <input
                      class="form-control"
                      value=${formularioCandidato.whatsapp}
                      onInput=${(event) =>
          atualizarCampoCandidato('whatsapp', event.target.value)}
                    />
                  </div>
                  <div class="col-md-6">
                    <label class="form-label">Cidade</label>
                    <input
                      class="form-control"
                      value=${formularioCandidato.cidade}
                      onInput=${(event) =>
          atualizarCampoCandidato('cidade', event.target.value)}
                    />
                  </div>
                  <div class="col-md-6">
                    <label class="form-label">Bairro</label>
                    <input
                      class="form-control"
                      value=${formularioCandidato.bairro}
                      onInput=${(event) =>
          atualizarCampoCandidato('bairro', event.target.value)}
                    />
                  </div>
                </div>
              </div>
              <footer class="rh-modal-footer">
                <button
                  type="button"
                  class="btn btn-outline-secondary"
                  onClick=${() => setCandidatoEditando(null)}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  class="btn btn-primary"
                  onClick=${salvarEdicaoCandidato}
                >
                  Salvar
                </button>
              </footer>
            `
      : null}
      </${ModalPadrao}>

      <${ModalDetalhesProva}
        detalhe=${detalheProvaSelecionado}
        onClose=${() => setDetalheProvaSelecionado(null)}
        onDownload=${() =>
      detalheProvaSelecionado?.linha?.id_teste
        ? baixarPacoteHistorico(
          detalheProvaSelecionado.linha.id_teste,
          detalheProvaSelecionado.linha.nome_candidato,
        )
        : null}
      />

      <${ModalPadrao}
        aberto=${!!preAnaliseSelecionada}
        titulo="Editar pre-cadastro"
        subtitulo="Ajuste as informações extraídas do CV antes de seguir."
        onClose=${() => setPreAnaliseSelecionada(null)}
      >
        ${preAnaliseSelecionada
      ? html`
              <div class="rh-details-body">
                <div class="row g-3">
                  <div class="col-md-6">
                    <label class="form-label">Nome</label>
                    <input
                      class="form-control"
                      value=${preAnaliseSelecionada.nome_candidato || ''}
                      onInput=${(event) =>
          setPreAnaliseSelecionada({
            ...preAnaliseSelecionada,
            nome_candidato: event.target.value,
          })}
                    />
                  </div>
                  <div class="col-md-6">
                    <label class="form-label">E-mail</label>
                    <input
                      class="form-control"
                      value=${preAnaliseSelecionada.email || ''}
                      onInput=${(event) =>
          setPreAnaliseSelecionada({
            ...preAnaliseSelecionada,
            email: event.target.value,
          })}
                    />
                  </div>
                  <div class="col-md-6">
                    <label class="form-label">Telefone</label>
                    <input
                      class="form-control"
                      value=${preAnaliseSelecionada.telefone || ''}
                      onInput=${(event) =>
          setPreAnaliseSelecionada({
            ...preAnaliseSelecionada,
            telefone: event.target.value,
          })}
                    />
                  </div>
                  <div class="col-md-6">
                    <label class="form-label">WhatsApp</label>
                    <input
                      class="form-control"
                      value=${preAnaliseSelecionada.whatsapp || ''}
                      onInput=${(event) =>
          setPreAnaliseSelecionada({
            ...preAnaliseSelecionada,
            whatsapp: event.target.value,
          })}
                    />
                  </div>
                </div>
              </div>
              <footer class="rh-modal-footer">
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
              </footer>
            `
      : null}
      </${ModalPadrao}>

      <${ModalPadrao}
        aberto=${!!visualizacaoCv}
        titulo="Visualização do CV"
        subtitulo="Texto bruto extraído do currículo."
        onClose=${() => setVisualizacaoCv(null)}
        className="cv-preview-dialog"
      >
        ${visualizacaoCv
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
              link.download = visualizacaoCv.nome_arquivo || 'cv';
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
      : null}
      </${ModalPadrao}>

      <${ModalPadrao}
        aberto=${!!resultadoAnaliseSelecionado}
        titulo="Resultado da análise"
        subtitulo="Resumo analítico da classificação automática do CV."
        onClose=${() => setResultadoAnaliseSelecionado(null)}
      >
        ${resultadoAnaliseSelecionado
      ? html`
              <div class="rh-details-body">
                <${MetricGrid}
                  items=${[
          {
            label: 'Score',
            value: resultadoAnaliseSelecionado.score_final ?? '-',
          },
          {
            label: 'Classificação',
            value: html`
                        <span
                          class=${`cv-classification-badge ${resultadoAnaliseSelecionado.classificacao_slug || ''}`}
                        >
                          ${resultadoAnaliseSelecionado.classificacao || '-'}
                        </span>
                      `,
          },
        ]}
                />

                <${SectionCard}
                  title="Palavras-chave identificadas"
                  className="rh-section-card--flat"
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
          } catch (error) {
            return (
              resultadoAnaliseSelecionado.palavras_chave ||
              'Nenhuma palavra-chave relevante foi identificada.'
            );
          }
        })()}
                  </div>
                </${SectionCard}>

                <${SectionCard}
                  title="Pontos observados pelo sistema"
                  className="rh-section-card--flat"
                >
                  <div class="cv-preview-box">
                    ${(() => {
          const dados = lerProblemasCv(resultadoAnaliseSelecionado);
          const linhas = [
            ...(dados.pontos_fortes || []),
            ...(dados.problemas || []),
          ];
          return linhas.length
            ? linhas.join('\n')
            : resultadoAnaliseSelecionado.problemas ||
            'Nenhum problema crítico foi apontado.';
        })()}
                  </div>
                </${SectionCard}>

                <${SectionCard}
                  title="Experiências e competências"
                  className="rh-section-card--flat"
                >
                  <div class="cv-preview-box">
                    ${(() => {
          const dados = lerProblemasCv(resultadoAnaliseSelecionado);
          const competencias = dados.competencias || {};
          const experiencias = dados.experiencias || [];
          const linhas = [];
          if (dados.confianca_nome) {
            linhas.push(`Nome: ${dados.nome_detectado || resultadoAnaliseSelecionado.nome_candidato || '-'} (${dados.confianca_nome})`);
          }
          if (experiencias.length) {
            linhas.push(`Experiências: ${experiencias.join(' | ')}`);
          }
          if (competencias.comportamentais?.length) {
            linhas.push(`Comportamentais: ${competencias.comportamentais.join(', ')}`);
          }
          if (competencias.tecnicas?.length) {
            linhas.push(`Técnicas: ${competencias.tecnicas.join(', ')}`);
          }
          return linhas.length
            ? linhas.join('\n')
            : 'Sem experiências ou competências claras no texto extraído.';
        })()}
                  </div>
                </${SectionCard}>

                <${SectionCard}
                  title="Resumo analítico"
                  className="rh-section-card--flat"
                >
                  <div class="cv-preview-box">
                    ${lerProblemasCv(resultadoAnaliseSelecionado).justificativa ||
        montarResumoAnaliticoCv(resultadoAnaliseSelecionado)}
                  </div>
                </${SectionCard}>
              </div>
            `
      : null}
      </${ModalPadrao}>
    </${PainelRh}>
  `;
}
