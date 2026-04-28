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
  atualizarPreAnaliseCv,
  atualizarProcesso,
  atualizarStatusCandidato,
  analisarCvProcesso,
  baixarCvCandidato,
  desativarLinkPublicoCandidatura,
  encerrarProcesso,
  excluirPreAnaliseCv,
  gerarLinkPublicoCandidatura,
  lerCandidatosProcessos,
  lerDetalheProcesso,
  lerEntrevistas,
  lerPreAnalisesCv,
  lerProcessos,
  lerSlotsEntrevista,
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
  toDatetimeLocal,
} from '../../shared/browser-utils.js';
import { AcaoSair } from '../../shared/components/actions.js';
import { TabelaVazia } from '../../shared/components/empty-table-row.js';
import {
  getCandidateActionState,
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
  ModalPadrao,
  PageIntro,
  PainelRh,
  SectionCard,
} from '../../ui/componentes-compartilhados.js';

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
  onAgendarEntrevista,
}) {
  const estadoAcoes = candidato.acoes_fluxo || getCandidateActionState(candidato);
  const botoes = [];

  if (estadoAcoes.canScheduleInterview && typeof onAgendarEntrevista === 'function') {
    botoes.push(
      html`
        <button
          type="button"
          class="btn btn-sm btn-outline-primary"
          onClick=${() => onAgendarEntrevista(candidato)}
        >
          Agendar entrevista
        </button>
      `,
    );
  }

  if (estadoAcoes.canApprove) {
    botoes.push(
      html`
        <button
          type="button"
          class="btn btn-sm btn-outline-success"
          onClick=${() => onAtualizarStatus(candidato, 'Aprovado')}
        >
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
          class="btn btn-sm btn-outline-danger"
          onClick=${() => onAtualizarStatus(candidato, 'Eliminado')}
        >
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
          class="btn btn-sm btn-outline-secondary"
          onClick=${() => onAtualizarStatus(candidato, 'Banco de talentos')}
        >
          Banco de talentos
        </button>
      `,
    );
  }

  if (!botoes.length) {
    return html`<span class="text-muted">Sem acoes disponiveis</span>`;
  }

  return html`<div class="d-flex justify-content-end gap-2 flex-wrap">${botoes}</div>`;
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
            'Nao foi possivel carregar os candidatos vinculados.',
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

  const atualizarStatus = async (registro, statusCandidato, idProcesso) => {
    const processo = encontrarProcessoPorReferencia(processos, idProcesso);

    if (isProcessClosed(processo)) {
      window.alert('O processo seletivo esta encerrado e nao permite novas movimentacoes.');
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
    });

    await carregar();
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
        title="Gestao de processos seletivos"
        description="Controle processos abertos, acompanhe as etapas do RH e conclua apenas as acoes que ainda estao pendentes."
      />

      ${erro ? html`<div class="rh-inline-alert">${erro}</div>` : null}

      <${SectionCard}
        title="Visao executiva"
        description="Indicadores rapidos para acompanhamento operacional."
      >
        <${MetricGrid}
          items=${[
            { label: 'Processos totais', value: resumo.totalProcessos },
            { label: 'Abertos', value: resumo.abertos, variant: 'is-approved' },
            { label: 'Encerrados', value: resumo.encerrados, variant: 'is-eliminated' },
            {
              label: 'Decisoes pendentes',
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
            <label>Operacao</label>
            <input
              class="form-control"
              value=${filtros.operacao}
              placeholder="Filtrar por operacao"
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
              <option value="nao">Nao</option>
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
                      <th>Operacao</th>
                      <th>Trilha</th>
                      <th>Nota de corte</th>
                      <th>Valor corte</th>
                      <th>Vagas</th>
                      <th>Encerramento</th>
                      <th>Link legado</th>
                      <th>Status</th>
                      <th class="text-end">Acoes</th>
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
                                <td>${Number(processo.usa_nota_corte || 0) ? 'Sim' : 'Nao'}</td>
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
                                    : 'Nao informado'}
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
                      <th>Operacao</th>
                      <th>Trilha</th>
                      <th>Nota de corte</th>
                      <th>Valor corte</th>
                      <th>Vagas</th>
                      <th>Encerramento</th>
                      <th>Link legado</th>
                      <th>Status</th>
                      <th class="text-end">Acoes</th>
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
                              <td>${Number(processo.usa_nota_corte || 0) ? 'Sim' : 'Nao'}</td>
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
                                  : 'Nao informado'}
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
                      <th class="text-end">Acoes</th>
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
                            texto="Nenhum candidato com decisao final pendente."
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
        subtitulo="Ajuste as informacoes sem alterar a integracao existente."
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
                  Salvar alteracoes
                </button>
              </footer>
            `
          : null}
      </${ModalPadrao}>

      <${ModalPadrao}
        aberto=${!!processoParaEncerrar}
        titulo="Encerrar processo"
        subtitulo="Essa acao move o processo para a lista de encerrados."
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
  const [preAnalises, setPreAnalises] = useState([]);
  const [paginaPreAnalises, setPaginaPreAnalises] = useState(1);
  const [totalPaginasPreAnalises, setTotalPaginasPreAnalises] = useState(1);
  const [arquivoCv, setArquivoCv] = useState(null);
  const [guardarCvOriginal, setGuardarCvOriginal] = useState(false);
  const [analisandoCv, setAnalisandoCv] = useState(false);
  const [preAnaliseSelecionada, setPreAnaliseSelecionada] = useState(null);
  const [visualizacaoCv, setVisualizacaoCv] = useState(null);
  const [resultadoAnaliseSelecionado, setResultadoAnaliseSelecionado] =
    useState(null);
  const [agendamentoSelecionado, setAgendamentoSelecionado] = useState(null);
  const [formularioEntrevista, setFormularioEntrevista] = useState({
    id_registro: '',
    id_processo: '',
    id_processo_ref: '',
    id_slot: '',
    data_entrevista: '',
    status_entrevista: 'Agendado',
    link_agendamento: '',
    observacoes_rh: '',
    email: '',
    telefone: '',
    whatsapp: '',
  });
  const [feedbackLinkPublico, setFeedbackLinkPublico] = useState('');

  const idProcesso = sessionStorage.getItem(CHAVE_PROCESSO_DETALHE) || '';

  useEffect(() => {
    if (!feedbackLinkPublico) return undefined;

    const timeout = window.setTimeout(() => setFeedbackLinkPublico(''), 3200);
    return () => window.clearTimeout(timeout);
  }, [feedbackLinkPublico]);

  const carregar = async (pagina = 1) => {
    if (!idProcesso) {
      setErro('Processo nao identificado.');
      setCarregando(false);
      return;
    }

    setCarregando(true);
    setErro('');

    try {
      const [detalhe, listaPreAnalises, listaEntrevistas, listaSlots] = await Promise.all([
        lerDetalheProcesso(idProcesso),
        lerPreAnalisesCv(idProcesso, pagina, 5),
        lerEntrevistas({ idProcesso }),
        lerSlotsEntrevista({ idProcesso, statusSlot: 'Disponivel' }),
      ]);

      if (detalhe?.processo) {
        sessionStorage.setItem(
          CHAVE_PROCESSO_DETALHE,
          obterReferenciaProcesso(detalhe.processo),
        );
      }
      setProcesso(detalhe?.processo || null);
      setResumo(detalhe?.resumo || null);
      setCandidatos(Array.isArray(detalhe?.candidatos) ? detalhe.candidatos : []);
      setPreAnalises(
        Array.isArray(listaPreAnalises?.items) ? listaPreAnalises.items : [],
      );
      setPaginaPreAnalises(Number(listaPreAnalises?.page || 1));
      setTotalPaginasPreAnalises(Number(listaPreAnalises?.total_pages || 1));
      setEntrevistas(Array.isArray(listaEntrevistas) ? listaEntrevistas : []);
      setSlotsEntrevista(Array.isArray(listaSlots) ? listaSlots : []);
    } catch (error) {
      setErro(
        error.message || 'Nao foi possivel carregar o detalhe do processo.',
      );
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregar(1);
  }, []);

  const processoEncerrado = isProcessClosed(processo);
  const urlPublicaCandidatura = useMemo(
    () =>
      processo?.link_publico_slug
        ? montarUrlPublicaCandidatura(processo.link_publico_slug)
        : '',
    [processo?.link_publico_slug],
  );
  const linkPublicoAtivo = Boolean(processo?.link_publico_ativo) && !processoEncerrado;
  const statusPaginaPublica = !processo?.link_publico_slug
    ? 'Nao gerada'
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
  const slotsDisponiveisEntrevista = useMemo(
    () =>
      slotsEntrevista.filter(
        (slot) =>
          String(slot.status_slot || '').trim() === 'Disponivel' &&
          !Number(slot.id_entrevista || 0),
      ),
    [slotsEntrevista],
  );

  const formatarHorarioSlotEntrevista = (slot) =>
    slot ? `${formatarDataHora(slot.inicio)} ate ${formatarDataHora(slot.fim)}` : '-';

  const abrirCurriculo = async (candidato) => {
    if (!candidato?.id_teste || !candidato?.cv_disponivel) {
      setErro('Nao ha curriculo disponivel para este candidato.');
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
        error?.message || 'Nao foi possivel abrir o curriculo do candidato.',
      );
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
        setFeedbackLinkPublico('Pagina publica gerada com sucesso.');
      }
    } catch (error) {
      setErro(
        error?.message ||
          'Nao foi possivel gerar a pagina publica de candidatura.',
      );
    }
  };

  const copiarLinkPublico = async () => {
    if (!urlPublicaCandidatura || !linkPublicoAtivo) return;

    try {
      await copiarTexto(urlPublicaCandidatura);
      setFeedbackLinkPublico('Link copiado.');
    } catch (error) {
      setErro('Nao foi possivel copiar o link publico agora.');
    }
  };

  const abrirPaginaPublica = () => {
    if (!urlPublicaCandidatura) return;
    window.open(urlPublicaCandidatura, '_blank', 'noopener,noreferrer');
  };

  const desativarPaginaPublica = async () => {
    if (!processo) return;
    if (!window.confirm('Deseja desativar o link publico desta vaga?')) {
      return;
    }

    try {
      await desativarLinkPublicoCandidatura(
        obterReferenciaProcesso(processo) || idProcesso,
      );
      await carregar(paginaPreAnalises);
      setFeedbackLinkPublico('Link publico desativado.');
    } catch (error) {
      setErro(
        error?.message ||
          'Nao foi possivel desativar o link publico desta vaga.',
      );
    }
  };

  const atualizarStatus = async (idRegistro, status) => {
    const statusSeguro = String(status || '').trim();

    if (processoEncerrado) {
      setErro('O processo seletivo esta encerrado e nao permite novas movimentacoes.');
      return;
    }

    if (statusSeguro === 'Eliminado') {
      const confirmar = window.confirm(
        'Deseja realmente eliminar este candidato?',
      );
      if (!confirmar) return;
    }

    try {
      await atualizarStatusCandidato(idRegistro, {
        status_candidato: statusSeguro,
      });
      await carregar(paginaPreAnalises);
    } catch (error) {
      alert(error.message || 'Nao foi possivel atualizar o status.');
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
      alert(error.message || 'Nao foi possivel analisar o CV.');
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
      alert(error.message || 'Nao foi possivel salvar a edicao.');
    }
  };

  const excluirPreAnalise = async (idPreAnalise) => {
    if (!window.confirm('Deseja excluir esta pre-analise?')) return;

    try {
      await excluirPreAnaliseCv(idPreAnalise);
      await carregar(paginaPreAnalises);
    } catch (error) {
      alert(error.message || 'Nao foi possivel excluir a pre-analise.');
    }
  };

  const incluirNoProcesso = async (idPreAnalise) => {
    try {
      await adicionarPreAnaliseAoProcesso(idPreAnalise);
      await carregar(paginaPreAnalises);
    } catch (error) {
      alert(error.message || 'Nao foi possivel adicionar ao processo.');
    }
  };

  const abrirAgendamento = (candidato) => {
    const estadoAcoes = candidato?.acoes_fluxo || getCandidateActionState(candidato, processo?.status || '');
    if (estadoAcoes.processClosed || !estadoAcoes.canScheduleInterview) {
      setErro('Somente candidatos qualificados em processo aberto podem seguir para agendamento.');
      return;
    }

    setAgendamentoSelecionado(candidato);
    setFormularioEntrevista({
      id_registro: candidato.id_registro,
      id_processo: candidato.id_processo,
      id_processo_ref:
        obterReferenciaProcessoDoCandidato(candidato) ||
        obterReferenciaProcesso(processo),
      id_slot: '',
      data_entrevista: '',
      status_entrevista: 'Agendado',
      link_agendamento: '',
      observacoes_rh: '',
      email: candidato.email || '',
      telefone: candidato.telefone || '',
      whatsapp: candidato.whatsapp || candidato.telefone || '',
    });
  };

  const montarMensagemEntrevista = () => {
    const nome = agendamentoSelecionado?.nome_candidato || 'candidato(a)';
    const slot = slotsDisponiveisEntrevista.find(
      (item) => Number(item.id_slot) === Number(formularioEntrevista.id_slot),
    );
    if (!slot) {
      return `Ol\u00e1 ${nome}, sua entrevista foi agendada para data a confirmar \u00e0s horario a confirmar.`;
    }

    const dataInicio = new Date(slot.inicio);
    const data = dataInicio.toLocaleDateString('pt-BR');
    const hora = dataInicio.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    });
    return `Ol\u00e1 ${nome}, sua entrevista foi agendada para ${data} \u00e0s ${hora}.`;
  };

  const salvarAgendamento = async (canal = '') => {
    if (processoEncerrado) {
      setErro('O processo seletivo esta encerrado e nao permite novas movimentacoes.');
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
          throw new Error('O candidato nao possui numero de WhatsApp valido extraido do CV.');
        }
      }

      if (canal === 'email') {
        const emailDestino = String(formularioEntrevista.email || '').trim();
        if (!emailDestino) {
          throw new Error('O candidato nao possui e-mail valido extraido do CV.');
        }
      }

      const resultado = await agendarEntrevista({
        ...formularioEntrevista,
        id_slot: Number(formularioEntrevista.id_slot),
      });
      const mensagem = resultado?.mensagem_base || montarMensagemEntrevista();
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
      setErro(error?.message || 'Nao foi possivel agendar a entrevista.');
    } finally {
      setSalvandoEntrevista(false);
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
        description="Acompanhe o fluxo completo do RH: pre-analise, qualificacao, entrevistas, decisao final e fechamento do processo."
      />

      ${erro ? html`<div class="alert alert-danger">${erro}</div>` : null}
      ${processoEncerrado
        ? html`
            <div class="rh-inline-alert">
              Processo encerrado. As movimentacoes operacionais de candidatos ficam bloqueadas.
            </div>
          `
        : null}

      <${SectionCard}
        title="Resumo do processo"
        description=${processo
          ? `${processo.id_processo || '-'} • ${processo.vaga || '-'}`
          : 'Processo nao localizado.'}
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
        <${MetricGrid}
          items=${[
            { label: 'Nome', value: processo?.nome_processo || '-' },
            { label: 'Vaga', value: processo?.vaga || '-' },
            { label: 'Operacao', value: processo?.operacao || '-' },
            { label: 'Trilha', value: processo?.trilha || '-' },
            {
              label: 'Status',
              value: processo?.status || '-',
            },
            {
              label: 'Nota de corte',
              value: Number(processo?.usa_nota_corte || 0)
                ? processo?.nota_corte || '-'
                : 'Nao',
            },
            { label: 'Vagas', value: processo?.quantidade_vagas || 0 },
            {
              label: 'Encerramento',
              value: processo?.data_encerramento || '-',
            },
            {
              label: 'Link legado',
              value: processo?.link_agendamento
                ? html`
                    <a
                      href=${processo.link_agendamento}
                      target="_blank"
                      rel="noreferrer"
                      class="rh-link-inline"
                    >
                      Abrir link
                    </a>
                  `
                : 'Nao informado',
            },
          ]}
        />
        <div class="mt-4">
          <${MetricGrid}
            items=${[
              { label: 'Total', value: resumo?.total || 0 },
              { label: 'Em analise', value: resumo?.analise || 0, variant: 'is-analysis' },
              { label: 'Qualificados', value: resumo?.qualificados || 0, variant: 'is-highlight' },
              { label: 'Entrevistas', value: resumo?.entrevistas || 0, variant: 'is-confirmed' },
              { label: 'Aprovados', value: resumo?.aprovados || 0, variant: 'is-approved' },
              { label: 'Eliminados', value: resumo?.eliminados || 0, variant: 'is-eliminated' },
              { label: 'Banco de talentos', value: resumo?.banco || 0, variant: 'is-talent' },
            ]}
          />
        </div>
      </${SectionCard}>

      <${SectionCard}
        title="Pagina publica de candidatura"
        description="Gere um link exclusivo para esta vaga e acompanhe o status da pagina publica sem expor informacoes administrativas."
      >
        <${MetricGrid}
          items=${[
            { label: 'Status', value: statusPaginaPublica },
            {
              label: 'Slug publico',
              value: processo?.link_publico_slug || 'Ainda nao gerado',
            },
            {
              label: 'Criado em',
              value: formatarDataHora(processo?.link_publico_criado_em),
            },
          ]}
        />

        <div class="row g-3 align-items-end mt-1">
          <div class="col-lg-8">
            <label class="form-label">Link publico</label>
            <input
              class="form-control"
              readonly
              value=${urlPublicaCandidatura || 'Gere a pagina para visualizar o link publico.'}
            />
            <div class="form-text">
              A pagina publica exibe a vaga, uma descricao objetiva e o formulario
              de candidatura. Quando nao houver texto publico cadastrado, o sistema
              monta um resumo automatico com base na vaga, operacao e trilha.
            </div>
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
                      Gerar pagina de CV
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
                      disabled=${!urlPublicaCandidatura}
                      onClick=${abrirPaginaPublica}
                    >
                      Abrir pagina
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
                            Gerar nova pagina
                          </button>
                        `
                      : null}
                  `}
            </div>
          </div>
        </div>

        ${feedbackLinkPublico
          ? html`<div class="alert alert-success mt-3 mb-0">${feedbackLinkPublico}</div>`
          : null}
      </${SectionCard}>

      <${SectionCard}
        title="Pre-analise de CV"
        description="Analise automatica com possibilidade de ajuste manual antes da inclusao no processo."
        tourId="process-cv-preanalysis"
      >
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
                Guardar CV original
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
                <th>Classificacao</th>
                <th>Score</th>
                <th class="text-end">Acoes</th>
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
                        </td>
                        <td>${item.score_final ?? '-'}</td>
                        <td class="text-end">
                          <div class="d-flex justify-content-end gap-2 flex-wrap">
                            <button
                              type="button"
                              class="btn btn-sm btn-outline-secondary"
                              onClick=${() => setPreAnaliseSelecionada({ ...item })}
                            >
                              Editar
                            </button>
                            <button
                              type="button"
                              class="btn btn-sm btn-outline-dark"
                              onClick=${() => setResultadoAnaliseSelecionado(item)}
                            >
                              Resultado
                            </button>
                            <button
                              type="button"
                              class="btn btn-sm btn-outline-info"
                              onClick=${() => setVisualizacaoCv(item)}
                            >
                              Ver CV
                            </button>
                            ${Number(item.ja_adicionado_ao_processo || 0) !== 1 &&
                            String(item.classificacao || '').trim() === 'Qualificado'
                              ? html`
                                  <button
                                    type="button"
                                    class="btn btn-sm btn-outline-success"
                                    onClick=${() =>
                                      incluirNoProcesso(item.id_pre_analise)}
                                  >
                                    Adicionar
                                  </button>
                                `
                              : null}
                            <button
                              type="button"
                              class="btn btn-sm btn-outline-danger"
                              onClick=${() => excluirPreAnalise(item.id_pre_analise)}
                            >
                              Excluir
                            </button>
                          </div>
                        </td>
                      </tr>
                    `,
                  )
                : html`
                    <${TabelaVazia}
                      colunas=${6}
                      texto="Nenhuma pre-analise encontrada."
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
      </${SectionCard}>

      <${SectionCard}
        title="Candidatos no processo"
        description="As acoes aparecem somente quando a etapa do candidato permite movimentacao dentro do fluxo do RH."
        tourId="process-candidates"
      >
        <div class="table-responsive">
          <table class="table align-middle rh-modern-history-table">
            <thead>
              <tr>
                <th>Candidato</th>
                <th>Contato / origem</th>
                <th>Localidade</th>
                <th>Status</th>
                <th>Entrevista</th>
                <th>CV</th>
                <th class="text-end">Acoes</th>
              </tr>
            </thead>
            <tbody>
              ${candidatosComFluxo.length
                ? candidatosComFluxo.map(
                    (candidato) => html`
                      <tr key=${candidato.id_registro}>
                        <td>
                          <strong>${candidato.nome_candidato || '-'}</strong>
                          <div class="small text-muted mt-1">
                            ${candidato.vaga || '-'}
                          </div>
                          ${candidato.tags?.length
                            ? html`
                                <div class="rh-chip-wrap mt-2">
                                  ${candidato.tags.slice(0, 3).map(
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
                            ${candidato.origem || '-'}
                          </div>
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
                          ${candidato.status_entrevista
                            ? html`
                                <div class="rh-cell-stack">
                                  <span
                                    class=${`rh-status-pill ${obterClasseStatusEntrevista(candidato.status_entrevista)}`}
                                  >
                                    ${candidato.status_entrevista}
                                  </span>
                                  <small>${formatarDataHora(candidato.data_entrevista)}</small>
                                </div>
                              `
                            : candidato.acoes_fluxo?.canScheduleInterview
                              ? 'Aguardando agendamento'
                              : processoEncerrado
                                ? 'Processo encerrado'
                                : 'Sem entrevista prevista'}
                        </td>
                        <td>
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
                            : 'Sem CV'}
                        </td>
                        <td class="text-end">
                          ${renderizarAcoesDoCandidato({
                            candidato,
                            onAgendarEntrevista: abrirAgendamento,
                            onAtualizarStatus: (item, status) =>
                              atualizarStatus(item.id_registro, status),
                          })}
                        </td>
                      </tr>
                    `,
                  )
                : html`
                    <${TabelaVazia}
                      colunas=${6}
                      texto="Nenhum candidato vinculado a este processo."
                    />
                  `}
            </tbody>
          </table>
        </div>
      </${SectionCard}>

      <${SectionCard}
        title="Entrevistas agendadas"
        description="Agenda vinculada ao processo atual, usando horarios internos."
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
                  <table class="table align-middle rh-modern-history-table">
                    <thead>
                      <tr>
                        <th>Candidato</th>
                        <th>Data / hora</th>
                        <th>Status</th>
                        <th>Agenda</th>
                        <th>Observacoes</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${entrevistas.map(
                        (entrevista) => html`
                          <tr key=${entrevista.id_entrevista}>
                            <td>${entrevista.nome_candidato || '-'}</td>
                            <td>${formatarDataHora(entrevista.data_entrevista)}</td>
                            <td>
                              <span
                                class=${`rh-status-pill ${obterClasseStatusEntrevista(entrevista.status_entrevista)}`}
                              >
                                ${entrevista.status_entrevista || '-'}
                              </span>
                            </td>
                            <td>${entrevista.id_slot ? 'Calendario interno' : 'Registro legado'}</td>
                            <td>${entrevista.observacoes_rh || 'Sem observacoes.'}</td>
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
                  text="Use o botao “Agendar entrevista” na tabela de candidatos para registrar o compromisso."
                />
              `}
      </${SectionCard}>

      <${ModalPadrao}
        aberto=${!!agendamentoSelecionado}
        titulo="Agendar entrevista"
        subtitulo="A entrevista sera vinculada ao candidato e ao processo selecionado."
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
                    <label class="form-label">Horario disponivel</label>
                    <select
                      class="form-select"
                      value=${formularioEntrevista.id_slot}
                      onChange=${(event) =>
                        setFormularioEntrevista({
                          ...formularioEntrevista,
                          id_slot: event.target.value,
                        })}
                    >
                      <option value="">Selecione um slot</option>
                      ${slotsDisponiveisEntrevista.map(
                        (slot) => html`
                          <option key=${slot.id_slot} value=${slot.id_slot}>
                            ${formatarHorarioSlotEntrevista(slot)}
                          </option>
                        `,
                      )}
                    </select>
                  </div>
                  <div class="col-md-6">
                    <label class="form-label">WhatsApp extraido do CV</label>
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
                    <label class="form-label">E-mail extraido do CV</label>
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
                    <label class="form-label">Mensagem que sera enviada</label>
                    <textarea
                      class="form-control"
                      rows="6"
                      readonly
                      value=${montarMensagemEntrevista()}
                    ></textarea>
                    <div class="form-text">
                      A mensagem usa o horario interno selecionado no calendario.
                    </div>
                  </div>
                  <div class="col-md-12">
                    <label class="form-label">Observacoes RH</label>
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

      <${ModalPadrao}
        aberto=${!!preAnaliseSelecionada}
        titulo="Editar pre-cadastro"
        subtitulo="Ajuste as informacoes extraidas do CV antes de seguir."
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
        titulo="Visualizacao do CV"
        subtitulo="Texto bruto extraido do curriculo."
        onClose=${() => setVisualizacaoCv(null)}
        className="cv-preview-dialog"
      >
        ${visualizacaoCv
          ? html`
              <div class="rh-details-body">
                <div class="cv-preview-box">
                  ${visualizacaoCv.texto_extraido || 'Sem conteudo extraido.'}
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
        titulo="Resultado da analise"
        subtitulo="Resumo analitico da classificacao automatica do CV."
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
                      label: 'Classificacao',
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
                      try {
                        const problemas = JSON.parse(
                          resultadoAnaliseSelecionado.problemas || '[]',
                        );
                        return Array.isArray(problemas) && problemas.length
                          ? problemas.join('\n')
                          : 'Nenhum problema critico foi apontado.';
                      } catch (error) {
                        return (
                          resultadoAnaliseSelecionado.problemas ||
                          'Nenhum problema critico foi apontado.'
                        );
                      }
                    })()}
                  </div>
                </${SectionCard}>

                <${SectionCard}
                  title="Resumo analitico"
                  className="rh-section-card--flat"
                >
                  <div class="cv-preview-box">
                    ${montarResumoAnaliticoCv(resultadoAnaliseSelecionado)}
                  </div>
                </${SectionCard}>
              </div>
            `
          : null}
      </${ModalPadrao}>
    </${PainelRh}>
  `;
}
