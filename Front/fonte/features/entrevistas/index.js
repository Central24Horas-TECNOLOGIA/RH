import {
  html,
  useEffect,
  useMemo,
  useState,
} from '../../infraestrutura-react.js';
import {
  atualizarEntrevista,
  atualizarSlotEntrevista,
  criarSlotsEntrevista,
  lerEntrevistas,
  lerProcessos,
  lerSlotsEntrevista,
} from '../../app/controlador-aplicacao.js';
import {
  formatarDataHora,
  obterClasseStatusEntrevista,
} from '../../shared/helpers-visuais.js';
import { copiarTexto } from '../../shared/browser-utils.js';
import { AcaoSair } from '../../shared/components/actions.js';
import {
  canonicalizeCandidateStatus,
  isProcessClosed,
} from '../../shared/process-flow.js';
import { validarFormularioEntrevista } from '../../shared/validacoes.js';
import {
  EmptyState,
  LoadingState,
  MetricGrid,
  ModalPadrao,
  PageIntro,
  PainelRh,
  SectionCard,
} from '../../ui/componentes-compartilhados.js';
import {
  obterChaveProcesso,
  obterReferenciaProcesso,
} from '../../shared/process-reference.js';

const STATUS_ENTREVISTA = [
  'Agendado',
  'Confirmado',
  'Reagendado',
  'Faltou',
  'Compareceu',
  'Aprovado',
  'Eliminado',
  'Banco de talentos',
];

const STATUS_SLOT_DISPONIVEL = 'Disponivel';
const STATUS_SLOT_BLOQUEADO = 'Bloqueado';

function hojeIsoLocal() {
  const agora = new Date();
  const ano = agora.getFullYear();
  const mes = String(agora.getMonth() + 1).padStart(2, '0');
  const dia = String(agora.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

function normalizarTexto(valor) {
  return String(valor || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function formatarHorarioSlot(slot) {
  if (!slot) return '-';
  const inicio = formatarDataHora(slot.inicio);
  const fim = formatarDataHora(slot.fim);
  return `${inicio} ate ${fim}`;
}

function obterSlotDisponivel(slot) {
  const statusSlot = normalizarTexto(slot?.status_calculado || slot?.status_slot);
  return statusSlot !== normalizarTexto(STATUS_SLOT_BLOQUEADO) && statusSlot !== 'lotado' && Number(slot?.disponiveis ?? 1) > 0;
}

function obterClasseStatusSlot(slot) {
  const statusSlot = normalizarTexto(slot?.status_calculado || slot?.status_slot);
  if (statusSlot === 'lotado' || statusSlot === 'bloqueado') return 'is-eliminated';
  if (statusSlot === 'parcialmente ocupado') return 'is-analysis';
  return 'is-highlight';
}

function formatarOcupacaoSlot(slot) {
  return `${Number(slot?.ocupados || 0)}/${Number(slot?.capacidade_total || 1)} ocupados`;
}

export function TelaEntrevistas({ controlador }) {
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [entrevistas, setEntrevistas] = useState([]);
  const [slots, setSlots] = useState([]);
  const [processos, setProcessos] = useState([]);
  const [filtros, setFiltros] = useState({
    processo: '',
    status: '',
    busca: '',
    data: hojeIsoLocal(),
  });
  const [formularioSlots, setFormularioSlots] = useState({
    id_processo_ref: '',
    data: hojeIsoLocal(),
    hora_inicio: '09:00',
    hora_fim: '12:00',
    duracao_minutos: 30,
    capacidade_total: 1,
    observacoes_rh: '',
  });
  const [entrevistaEdicao, setEntrevistaEdicao] = useState(null);
  const [formularioEdicao, setFormularioEdicao] = useState({
    id_slot: '',
    status_entrevista: 'Agendado',
    observacoes_rh: '',
    mensagem_personalizada: '',
  });
  const [slotEdicao, setSlotEdicao] = useState(null);
  const [formularioSlotEdicao, setFormularioSlotEdicao] = useState({
    capacidade_total: 1,
    status_slot: STATUS_SLOT_DISPONIVEL,
    observacoes_rh: '',
  });

  const carregar = async () => {
    setCarregando(true);
    setErro('');

    try {
      const [listaEntrevistas, listaProcessos, listaSlots] = await Promise.all([
        lerEntrevistas({
          idProcesso: filtros.processo,
          statusEntrevista: filtros.status,
          search: filtros.busca,
        }),
        lerProcessos(true),
        lerSlotsEntrevista({
          idProcesso: filtros.processo,
          date: filtros.data,
        }),
      ]);

      setEntrevistas(Array.isArray(listaEntrevistas) ? listaEntrevistas : []);
      setProcessos(Array.isArray(listaProcessos) ? listaProcessos : []);
      setSlots(Array.isArray(listaSlots) ? listaSlots : []);
    } catch (error) {
      setErro(
        error?.message || 'Nao foi possivel carregar a agenda de entrevistas.',
      );
      setEntrevistas([]);
      setSlots([]);
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregar();
  }, [filtros.processo, filtros.status, filtros.busca, filtros.data]);

  const slotsDisponiveis = useMemo(
    () => slots.filter((slot) => obterSlotDisponivel(slot)),
    [slots],
  );

  const resumo = useMemo(
    () => ({
      total: entrevistas.length,
      disponiveis: slotsDisponiveis.length,
      ocupados: slots.filter((slot) => normalizarTexto(slot.status_slot) === 'ocupado').length,
      parcialmenteOcupados: slots.filter((slot) => normalizarTexto(slot.status_calculado || slot.status_slot) === 'parcialmente ocupado').length,
      lotados: slots.filter((slot) => normalizarTexto(slot.status_calculado || slot.status_slot) === 'lotado').length,
      agendadas: entrevistas.filter(
        (item) => canonicalizeCandidateStatus(item.status_entrevista) === 'Agendado',
      ).length,
      confirmadas: entrevistas.filter(
        (item) => canonicalizeCandidateStatus(item.status_entrevista) === 'Confirmado',
      ).length,
      reagendadas: entrevistas.filter(
        (item) => canonicalizeCandidateStatus(item.status_entrevista) === 'Reagendado',
      ).length,
      compareceram: entrevistas.filter(
        (item) => canonicalizeCandidateStatus(item.status_entrevista) === 'Compareceu',
      ).length,
      faltas: entrevistas.filter(
        (item) => canonicalizeCandidateStatus(item.status_entrevista) === 'Faltou',
      ).length,
    }),
    [entrevistas, slots, slotsDisponiveis.length],
  );

  const criarDisponibilidade = async () => {
    if (!formularioSlots.data || !formularioSlots.hora_inicio || !formularioSlots.hora_fim) {
      setErro('Informe data, hora inicial e hora final para gerar slots.');
      return;
    }
    if (Number(formularioSlots.capacidade_total || 0) < 1) {
      setErro('A capacidade por slot deve ser maior que zero.');
      return;
    }

    setSalvando(true);
    setErro('');

    try {
      const processoSelecionado = processos.find(
        (processo) =>
          obterReferenciaProcesso(processo) === formularioSlots.id_processo_ref,
      );

      const resultado = await criarSlotsEntrevista({
        ...formularioSlots,
        id_processo: processoSelecionado?.id_processo || '',
      });

      await carregar();
      window.alert(
        `Slots criados: ${resultado?.created || 0}. Ignorados por conflito: ${resultado?.skipped || 0}.`,
      );
    } catch (error) {
      setErro(error?.message || 'Nao foi possivel criar os horarios.');
    } finally {
      setSalvando(false);
    }
  };

  const abrirEdicaoSlot = (slot) => {
    setSlotEdicao(slot);
    setFormularioSlotEdicao({
      capacidade_total: Number(slot.capacidade_total || 1),
      status_slot: slot.status_calculado === STATUS_SLOT_BLOQUEADO ? STATUS_SLOT_BLOQUEADO : (normalizarTexto(slot.status_slot) === 'bloqueado' ? STATUS_SLOT_BLOQUEADO : STATUS_SLOT_DISPONIVEL),
      observacoes_rh: slot.observacoes_rh || '',
    });
  };

  const salvarSlot = async () => {
    if (!slotEdicao) return;
    const capacidade = Number(formularioSlotEdicao.capacidade_total || 0);
    if (capacidade < 1) {
      setErro('A capacidade do slot deve ser maior que zero.');
      return;
    }
    if (capacidade < Number(slotEdicao.ocupados || 0)) {
      setErro('A capacidade nao pode ser menor que a quantidade ja ocupada.');
      return;
    }

    setSalvando(true);
    setErro('');
    try {
      await atualizarSlotEntrevista(slotEdicao.id_slot, {
        capacidade_total: capacidade,
        status_slot: formularioSlotEdicao.status_slot,
        observacoes_rh: formularioSlotEdicao.observacoes_rh || '',
      });
      setSlotEdicao(null);
      await carregar();
    } catch (error) {
      setErro(error?.message || 'Nao foi possivel atualizar o slot.');
    } finally {
      setSalvando(false);
    }
  };

  const abrirEdicao = (entrevista) => {
    if (isProcessClosed(entrevista?.status_processo)) {
      setErro('O processo seletivo desta entrevista esta encerrado e nao permite atualizacao operacional.');
      return;
    }

    setEntrevistaEdicao(entrevista);
    setFormularioEdicao({
      id_slot: '',
      status_entrevista: entrevista.status_entrevista || 'Agendado',
      observacoes_rh: entrevista.observacoes_rh || '',
      mensagem_personalizada: entrevista.mensagem_personalizada || '',
    });
  };

  const salvar = async () => {
    if (!entrevistaEdicao) return;
    if (isProcessClosed(entrevistaEdicao.status_processo)) {
      setErro('O processo seletivo desta entrevista esta encerrado e nao permite atualizacao operacional.');
      return;
    }

    const mensagemErro = validarFormularioEntrevista({
      id_registro: entrevistaEdicao.id_registro,
      ...formularioEdicao,
    });
    if (mensagemErro) {
      setErro(mensagemErro);
      return;
    }

    setSalvando(true);
    setErro('');

    try {
      const payload = {
        status_entrevista: formularioEdicao.status_entrevista,
        observacoes_rh: formularioEdicao.observacoes_rh,
        mensagem_personalizada: formularioEdicao.mensagem_personalizada,
      };
      if (formularioEdicao.id_slot) {
        payload.id_slot = Number(formularioEdicao.id_slot);
        if (Number(formularioEdicao.id_slot) !== Number(entrevistaEdicao.id_slot || 0)) {
          payload.status_entrevista = 'Reagendado';
        }
      }

      await atualizarEntrevista(entrevistaEdicao.id_entrevista, payload);

      setEntrevistaEdicao(null);
      await carregar();
    } catch (error) {
      setErro(
        error?.message || 'Nao foi possivel atualizar a entrevista selecionada.',
      );
    } finally {
      setSalvando(false);
    }
  };

  return html`
    <${PainelRh}
      screenId="screen-interviews"
      navAtiva="screen-interviews"
      subtituloMarca="Agenda de entrevistas"
      placeholderBusca="Entrevistas e confirmacoes"
      controlador=${controlador}
      acoesTopo=${html`
        <button
          type="button"
          class="btn btn-outline-secondary"
          onClick=${() => carregar()}
        >
          Atualizar
        </button>
        <${AcaoSair} controlador=${controlador} />
      `}
    >
      <${PageIntro}
        kicker="Console | Entrevistas"
        title="Calendario interno de entrevistas"
        description="Crie horarios internos, acompanhe slots ocupados e controle status sem depender de Booking."
      />

      ${erro ? html`<div class="rh-inline-alert">${erro}</div>` : null}

      <${SectionCard}
        title="Visao executiva"
        description="Panorama rapido da agenda interna."
      >
        <${MetricGrid}
          items=${[
            { label: 'Entrevistas', value: resumo.total || 0 },
            { label: 'Slots livres', value: resumo.disponiveis || 0, variant: 'is-highlight' },
            { label: 'Parciais', value: resumo.parcialmenteOcupados || 0, variant: 'is-analysis' },
            { label: 'Lotados', value: resumo.lotados || 0, variant: 'is-eliminated' },
            { label: 'Agendado', value: resumo.agendadas || 0, variant: 'is-analysis' },
            { label: 'Confirmado', value: resumo.confirmadas || 0, variant: 'is-highlight' },
            { label: 'Reagendado', value: resumo.reagendadas || 0, variant: 'is-analysis' },
            { label: 'Compareceu', value: resumo.compareceram || 0, variant: 'is-approved' },
            { label: 'Faltou', value: resumo.faltas || 0, variant: 'is-eliminated' },
          ]}
        />
      </${SectionCard}>

      <${SectionCard}
        title="Criar disponibilidade"
        description="Defina dia, faixa de horario e duracao. O sistema gera os slots sem conflito."
      >
        <div class="rh-filter-grid rh-filter-grid--wide">
          <div class="rh-filter-field">
            <label>Processo</label>
            <select
              class="form-select"
              value=${formularioSlots.id_processo_ref}
              disabled=${salvando}
              onChange=${(event) =>
                setFormularioSlots({
                  ...formularioSlots,
                  id_processo_ref: event.target.value,
                })}
            >
              <option value="">Geral</option>
              ${processos.map(
                (processo) => html`
                  <option
                    key=${obterChaveProcesso(processo)}
                    value=${obterReferenciaProcesso(processo)}
                  >
                    ${processo.id_processo} | ${processo.vaga}
                  </option>
                `,
              )}
            </select>
          </div>
          <div class="rh-filter-field">
            <label>Data</label>
            <input
              class="form-control"
              type="date"
              value=${formularioSlots.data}
              disabled=${salvando}
              onInput=${(event) =>
                setFormularioSlots({ ...formularioSlots, data: event.target.value })}
            />
          </div>
          <div class="rh-filter-field">
            <label>Inicio</label>
            <input
              class="form-control"
              type="time"
              value=${formularioSlots.hora_inicio}
              disabled=${salvando}
              onInput=${(event) =>
                setFormularioSlots({
                  ...formularioSlots,
                  hora_inicio: event.target.value,
                })}
            />
          </div>
          <div class="rh-filter-field">
            <label>Fim</label>
            <input
              class="form-control"
              type="time"
              value=${formularioSlots.hora_fim}
              disabled=${salvando}
              onInput=${(event) =>
                setFormularioSlots({
                  ...formularioSlots,
                  hora_fim: event.target.value,
                })}
            />
          </div>
          <div class="rh-filter-field">
            <label>Duracao</label>
            <input
              class="form-control"
              type="number"
              min="5"
              max="240"
              step="5"
              value=${formularioSlots.duracao_minutos}
              disabled=${salvando}
              onInput=${(event) =>
                setFormularioSlots({
                  ...formularioSlots,
                  duracao_minutos: Number(event.target.value || 30),
                })}
            />
          </div>
          <div class="rh-filter-field">
            <label>Capacidade por slot</label>
            <input
              class="form-control"
              type="number"
              min="1"
              step="1"
              value=${formularioSlots.capacidade_total}
              disabled=${salvando}
              onInput=${(event) =>
                setFormularioSlots({
                  ...formularioSlots,
                  capacidade_total: Number(event.target.value || 1),
                })}
            />
          </div>
          <div class="rh-filter-field">
            <label>Observacoes</label>
            <input
              class="form-control"
              value=${formularioSlots.observacoes_rh}
              disabled=${salvando}
              onInput=${(event) =>
                setFormularioSlots({
                  ...formularioSlots,
                  observacoes_rh: event.target.value,
                })}
            />
          </div>
        </div>
        <div class="text-end mt-3">
          <button
            type="button"
            class="btn btn-primary"
            disabled=${salvando}
            onClick=${criarDisponibilidade}
          >
            ${salvando ? 'Salvando...' : 'Gerar slots'}
          </button>
        </div>
      </${SectionCard}>

      <${SectionCard}
        title="Filtros"
        description="Refine a agenda por dia, processo, status ou busca textual."
        tourId="interview-filters"
      >
        <div class="rh-filter-grid rh-filter-grid--wide">
          <div class="rh-filter-field">
            <label>Data</label>
            <input
              class="form-control"
              type="date"
              value=${filtros.data}
              onInput=${(event) => setFiltros({ ...filtros, data: event.target.value })}
            />
          </div>

          <div class="rh-filter-field">
            <label>Processo</label>
            <select
              class="form-select"
              value=${filtros.processo}
              onChange=${(event) =>
                setFiltros({ ...filtros, processo: event.target.value })}
            >
              <option value="">Todos os processos</option>
              ${processos.map(
                (processo) => html`
                  <option
                    key=${obterChaveProcesso(processo)}
                    value=${obterReferenciaProcesso(processo)}
                  >
                    ${processo.id_processo} | ${processo.vaga}
                  </option>
                `,
              )}
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
              ${STATUS_ENTREVISTA.map(
                (statusItem) => html`
                  <option key=${statusItem} value=${statusItem}>${statusItem}</option>
                `,
              )}
            </select>
          </div>

          <div class="rh-filter-field">
            <label>Busca</label>
            <input
              class="form-control"
              placeholder="Candidato, vaga, processo, tag..."
              value=${filtros.busca}
              onInput=${(event) =>
                setFiltros({ ...filtros, busca: event.target.value })}
            />
          </div>
        </div>
      </${SectionCard}>

      <${SectionCard}
        title="Slots do dia"
        description="Visao por horario com disponibilidade, candidato e status."
      >
        ${carregando
          ? html`
              <${LoadingState}
                titulo="Carregando horarios"
                descricao="Buscando slots internos da agenda."
              />
            `
          : slots.length
            ? html`
                <div class="table-responsive">
                  <table class="table align-middle rh-modern-history-table">
                    <thead>
                      <tr>
                        <th>Horario</th>
                        <th>Processo</th>
                        <th>Ocupacao</th>
                        <th>Status slot</th>
                        <th>Candidato</th>
                        <th>Status entrevista</th>
                        <th>Observacoes</th>
                        <th class="text-end">Acoes</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${slots.map(
                        (slot) => html`
                          <tr key=${slot.id_slot}>
                            <td>${formatarHorarioSlot(slot)}</td>
                            <td>${slot.id_processo || 'Geral'}</td>
                            <td>${formatarOcupacaoSlot(slot)} | ${Number(slot.disponiveis || 0)} disponiveis</td>
                            <td>
                              <span
                                class=${`rh-status-pill ${obterClasseStatusSlot(slot)}`}
                              >
                                ${slot.status_calculado || slot.status_slot || '-'}
                              </span>
                            </td>
                            <td>${slot.nome_candidato ? `${slot.nome_candidato}${Number(slot.ocupados || 0) > 1 ? ` (+${Number(slot.ocupados || 0) - 1})` : ''}` : '-'}</td>
                            <td>${slot.status_entrevista || '-'}</td>
                            <td>${slot.observacoes_rh || '-'}</td>
                            <td class="text-end">
                              <button
                                type="button"
                                class="btn btn-sm btn-outline-primary"
                                onClick=${() => abrirEdicaoSlot(slot)}
                              >
                                Editar slot
                              </button>
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
                  title="Nenhum slot para o filtro"
                  text="Crie disponibilidade para o dia desejado ou ajuste os filtros."
                />
              `}
      </${SectionCard}>

      <${SectionCard}
        title="Agenda operacional"
        description="Atualize status, copie a mensagem base e reagende usando slots disponiveis."
        tourId="interview-agenda"
      >
        ${carregando
          ? html`
              <${LoadingState}
                titulo="Carregando entrevistas"
                descricao="Buscando agenda, status e candidatos associados."
              />
            `
          : entrevistas.length
            ? html`
                <div class="table-responsive">
                  <table class="table align-middle rh-modern-history-table">
                    <thead>
                      <tr>
                        <th>Candidato</th>
                        <th>Processo</th>
                        <th>Vaga</th>
                        <th>Data / hora</th>
                        <th>Status</th>
                        <th>Agenda</th>
                        <th>Informacoes RH</th>
                        <th class="text-end">Acoes</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${entrevistas.map(
                        (item) => html`
                          <tr key=${item.id_entrevista}>
                            <td>
                              <strong>${item.nome_candidato || '-'}</strong>
                              ${item.tags?.length
                                ? html`
                                    <div class="rh-chip-wrap mt-2">
                                      ${item.tags.slice(0, 3).map(
                                        (tag) => html`
                                          <span key=${tag} class="rh-chip">${tag}</span>
                                        `,
                                      )}
                                    </div>
                                  `
                                : null}
                            </td>
                            <td>${item.id_processo || '-'}</td>
                            <td>${item.vaga || '-'}</td>
                            <td>${formatarDataHora(item.data_entrevista)}</td>
                            <td>
                              <span
                                class=${`rh-status-pill ${obterClasseStatusEntrevista(item.status_entrevista)}`}
                              >
                                ${item.status_entrevista || '-'}
                              </span>
                            </td>
                            <td>${item.id_slot ? 'Calendario interno' : 'Registro legado'}</td>
                            <td>
                              <div class="rh-cell-stack">
                                <span>${item.observacoes_rh || 'Sem observacoes.'}</span>
                                ${isProcessClosed(item.status_processo)
                                  ? html`
                                      <small>Processo encerrado: movimentacoes bloqueadas.</small>
                                    `
                                  : null}
                                ${item.observacao_candidato_rh
                                  ? html`
                                      <small>
                                        Perfil RH: ${item.observacao_candidato_rh}
                                      </small>
                                    `
                                  : null}
                              </div>
                            </td>
                            <td class="text-end">
                              <div class="d-flex justify-content-end gap-2 flex-wrap">
                                <button
                                  type="button"
                                  class="btn btn-sm btn-outline-secondary"
                                  onClick=${() =>
                                    copiarTexto(item.mensagem_base || '')
                                      .then(() =>
                                        window.alert('Mensagem copiada para a area de transferencia.'),
                                      )
                                      .catch(() =>
                                        window.alert('Nao foi possivel copiar a mensagem automaticamente.'),
                                      )}
                                >
                                  Copiar mensagem
                                </button>
                                <button
                                  type="button"
                                  class="btn btn-sm btn-outline-primary"
                                  disabled=${isProcessClosed(item.status_processo)}
                                  onClick=${() => abrirEdicao(item)}
                                >
                                  ${isProcessClosed(item.status_processo)
                                    ? 'Processo encerrado'
                                    : 'Atualizar'}
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
                  title="Nenhuma entrevista encontrada"
                  text="Agende entrevistas a partir do detalhe do processo para acompanhar a jornada por aqui."
                />
              `}
      </${SectionCard}>

      <${ModalPadrao}
        aberto=${!!entrevistaEdicao}
        titulo="Atualizar entrevista"
        subtitulo="Edite status e, quando necessario, escolha novo slot para reagendar."
        onClose=${() => setEntrevistaEdicao(null)}
      >
        ${entrevistaEdicao
          ? html`
              <div class="rh-details-body">
                <div class="row g-3">
                  <div class="col-md-6">
                    <label class="form-label">Candidato</label>
                    <input
                      class="form-control"
                      readonly
                      value=${entrevistaEdicao.nome_candidato || ''}
                    />
                  </div>
                  <div class="col-md-6">
                    <label class="form-label">Processo</label>
                    <input
                      class="form-control"
                      readonly
                      value=${entrevistaEdicao.id_processo || ''}
                    />
                  </div>
                  <div class="col-md-6">
                    <label class="form-label">Horario atual</label>
                    <input
                      class="form-control"
                      readonly
                      value=${formatarDataHora(entrevistaEdicao.data_entrevista)}
                    />
                  </div>
                  <div class="col-md-6">
                    <label class="form-label">Status</label>
                    <select
                      class="form-select"
                      value=${formularioEdicao.status_entrevista}
                      onChange=${(event) =>
                        setFormularioEdicao({
                          ...formularioEdicao,
                          status_entrevista: event.target.value,
                        })}
                    >
                      ${STATUS_ENTREVISTA.map(
                        (statusItem) => html`
                          <option key=${statusItem} value=${statusItem}>
                            ${statusItem}
                          </option>
                        `,
                      )}
                    </select>
                  </div>
                  <div class="col-md-12">
                    <label class="form-label">Novo horario para reagendar</label>
                    <select
                      class="form-select"
                      value=${formularioEdicao.id_slot}
                      onChange=${(event) =>
                        setFormularioEdicao({
                          ...formularioEdicao,
                          id_slot: event.target.value,
                        })}
                    >
                      <option value="">Manter horario atual</option>
                            ${slotsDisponiveis.map(
                        (slot) => html`
                          <option key=${slot.id_slot} value=${slot.id_slot}>
                            ${formatarHorarioSlot(slot)} | ${formatarOcupacaoSlot(slot)} | ${slot.id_processo || 'Geral'}
                          </option>
                        `,
                      )}
                    </select>
                  </div>
                  <div class="col-md-12">
                    <label class="form-label">Mensagem personalizada</label>
                    <textarea
                      class="form-control"
                      rows="3"
                      value=${formularioEdicao.mensagem_personalizada}
                      onInput=${(event) =>
                        setFormularioEdicao({
                          ...formularioEdicao,
                          mensagem_personalizada: event.target.value,
                        })}
                    ></textarea>
                  </div>
                  <div class="col-md-12">
                    <label class="form-label">Observacoes RH</label>
                    <textarea
                      class="form-control"
                      rows="4"
                      value=${formularioEdicao.observacoes_rh}
                      onInput=${(event) =>
                        setFormularioEdicao({
                          ...formularioEdicao,
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
                  onClick=${() => setEntrevistaEdicao(null)}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  class="btn btn-primary"
                  disabled=${salvando || isProcessClosed(entrevistaEdicao.status_processo)}
                  onClick=${salvar}
                >
                  ${salvando
                    ? 'Salvando...'
                    : isProcessClosed(entrevistaEdicao.status_processo)
                      ? 'Processo encerrado'
                      : 'Salvar atualizacao'}
                </button>
              </footer>
            `
          : null}
      </${ModalPadrao}>

      <${ModalPadrao}
        aberto=${!!slotEdicao}
        titulo="Editar slot"
        subtitulo="Altere capacidade, status operacional e observacoes do horario."
        onClose=${() => setSlotEdicao(null)}
      >
        ${slotEdicao
          ? html`
              <div class="rh-details-body">
                <div class="row g-3">
                  <div class="col-md-6">
                    <label class="form-label">Horario</label>
                    <input class="form-control" readonly value=${formatarHorarioSlot(slotEdicao)} />
                  </div>
                  <div class="col-md-3">
                    <label class="form-label">Ocupados</label>
                    <input class="form-control" readonly value=${Number(slotEdicao.ocupados || 0)} />
                  </div>
                  <div class="col-md-3">
                    <label class="form-label">Capacidade</label>
                    <input
                      class="form-control"
                      type="number"
                      min=${Math.max(1, Number(slotEdicao.ocupados || 0))}
                      step="1"
                      value=${formularioSlotEdicao.capacidade_total}
                      onInput=${(event) =>
                        setFormularioSlotEdicao({
                          ...formularioSlotEdicao,
                          capacidade_total: Number(event.target.value || 1),
                        })}
                    />
                  </div>
                  <div class="col-md-6">
                    <label class="form-label">Status</label>
                    <select
                      class="form-select"
                      value=${formularioSlotEdicao.status_slot}
                      onChange=${(event) =>
                        setFormularioSlotEdicao({
                          ...formularioSlotEdicao,
                          status_slot: event.target.value,
                        })}
                    >
                      <option value=${STATUS_SLOT_DISPONIVEL}>Disponivel</option>
                      <option value=${STATUS_SLOT_BLOQUEADO}>Bloqueado</option>
                    </select>
                  </div>
                  <div class="col-md-12">
                    <label class="form-label">Observacoes</label>
                    <textarea
                      class="form-control"
                      rows="4"
                      value=${formularioSlotEdicao.observacoes_rh}
                      onInput=${(event) =>
                        setFormularioSlotEdicao({
                          ...formularioSlotEdicao,
                          observacoes_rh: event.target.value,
                        })}
                    ></textarea>
                  </div>
                </div>
              </div>
              <footer class="rh-modal-footer">
                <button type="button" class="btn btn-outline-secondary" onClick=${() => setSlotEdicao(null)}>
                  Cancelar
                </button>
                <button type="button" class="btn btn-primary" disabled=${salvando} onClick=${salvarSlot}>
                  ${salvando ? 'Salvando...' : 'Salvar slot'}
                </button>
              </footer>
            `
          : null}
      </${ModalPadrao}>
    </${PainelRh}>
  `;
}
