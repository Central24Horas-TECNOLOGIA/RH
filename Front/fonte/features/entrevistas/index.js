import {
  html,
  useEffect,
  useMemo,
  useState,
} from '../../infraestrutura-react.js';
import {
  atualizarEntrevista,
  lerEntrevistas,
  lerProcessos,
} from '../../app/controlador-aplicacao.js';
import {
  formatarDataHora,
  obterClasseStatusEntrevista,
} from '../../shared/helpers-visuais.js';
import { copiarTexto, toDatetimeLocal } from '../../shared/browser-utils.js';
import { AcaoSair } from '../../shared/components/actions.js';
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

const STATUS_ENTREVISTA = [
  'Agendado',
  'Confirmado',
  'Compareceu',
  'Faltou',
];

export function TelaEntrevistas({ controlador }) {
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [entrevistas, setEntrevistas] = useState([]);
  const [processos, setProcessos] = useState([]);
  const [filtros, setFiltros] = useState({
    processo: '',
    status: '',
    busca: '',
  });
  const [entrevistaEdicao, setEntrevistaEdicao] = useState(null);
  const [formularioEdicao, setFormularioEdicao] = useState({
    data_entrevista: '',
    status_entrevista: 'Agendado',
    link_agendamento: '',
    observacoes_rh: '',
  });

  const carregar = async () => {
    setCarregando(true);
    setErro('');

    try {
      const [listaEntrevistas, listaProcessos] = await Promise.all([
        lerEntrevistas({
          idProcesso: filtros.processo,
          statusEntrevista: filtros.status,
          search: filtros.busca,
        }),
        lerProcessos(true),
      ]);

      setEntrevistas(Array.isArray(listaEntrevistas) ? listaEntrevistas : []);
      setProcessos(Array.isArray(listaProcessos) ? listaProcessos : []);
    } catch (error) {
      setErro(
        error?.message || 'Nao foi possivel carregar as entrevistas agendadas.',
      );
      setEntrevistas([]);
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregar();
  }, [filtros.processo, filtros.status, filtros.busca]);

  const resumo = useMemo(
    () => ({
      total: entrevistas.length,
      agendadas: entrevistas.filter(
        (item) => String(item.status_entrevista || '') === 'Agendado',
      ).length,
      confirmadas: entrevistas.filter(
        (item) => String(item.status_entrevista || '') === 'Confirmado',
      ).length,
      compareceram: entrevistas.filter(
        (item) => String(item.status_entrevista || '') === 'Compareceu',
      ).length,
      faltas: entrevistas.filter(
        (item) => String(item.status_entrevista || '') === 'Faltou',
      ).length,
    }),
    [entrevistas],
  );

  const abrirEdicao = (entrevista) => {
    setEntrevistaEdicao(entrevista);
    setFormularioEdicao({
      data_entrevista: toDatetimeLocal(entrevista.data_entrevista),
      status_entrevista: entrevista.status_entrevista || 'Agendado',
      link_agendamento:
        entrevista.link_agendamento || entrevista.link_agendamento_processo || '',
      observacoes_rh: entrevista.observacoes_rh || '',
    });
  };

  const salvar = async () => {
    if (!entrevistaEdicao) return;

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
      await atualizarEntrevista(entrevistaEdicao.id_entrevista, {
        data_entrevista: new Date(formularioEdicao.data_entrevista).toISOString(),
        status_entrevista: formularioEdicao.status_entrevista,
        link_agendamento: formularioEdicao.link_agendamento,
        observacoes_rh: formularioEdicao.observacoes_rh,
      });

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
        kicker="Console • Entrevistas"
        title="Entrevistas agendadas"
        description="Acompanhe data, status, link e mensagem base de cada entrevista vinculada aos candidatos e processos."
      />

      ${erro ? html`<div class="rh-inline-alert">${erro}</div>` : null}

      <${SectionCard}
        title="Visao executiva"
        description="Panorama rapido da agenda ativa de entrevistas."
      >
        <${MetricGrid}
          items=${[
            { label: 'Total', value: resumo.total || 0 },
            { label: 'Agendado', value: resumo.agendadas || 0, variant: 'is-analysis' },
            { label: 'Confirmado', value: resumo.confirmadas || 0, variant: 'is-highlight' },
            { label: 'Compareceu', value: resumo.compareceram || 0, variant: 'is-approved' },
            { label: 'Faltou', value: resumo.faltas || 0, variant: 'is-eliminated' },
          ]}
        />
      </${SectionCard}>

      <${SectionCard}
        title="Filtros"
        description="Refine a agenda por processo, status ou busca textual."
        tourId="interview-filters"
      >
        <div class="rh-filter-grid rh-filter-grid--wide">
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
                  <option key=${processo.id_processo} value=${processo.id_processo}>
                    ${processo.id_processo} • ${processo.vaga}
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
        title="Agenda operacional"
        description="Edite status, copie a mensagem base e abra o link de agendamento quando necessario."
        tourId="interview-agenda"
      >
        ${carregando
          ? html`
              <${LoadingState}
                titulo="Carregando entrevistas"
                descricao="Buscando agenda, status e links associados."
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
                        <th>Link</th>
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
                            <td>
                              ${item.link_agendamento
                                ? html`
                                    <a
                                      href=${item.link_agendamento}
                                      target="_blank"
                                      rel="noreferrer"
                                      class="rh-link-inline"
                                    >
                                      Abrir link
                                    </a>
                                  `
                                : 'Sem link'}
                            </td>
                            <td>
                              <div class="rh-cell-stack">
                                <span>${item.observacoes_rh || 'Sem observacoes.'}</span>
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
                                  onClick=${() => abrirEdicao(item)}
                                >
                                  Atualizar
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
        subtitulo="Edite o status, a data e as informacoes operacionais do agendamento."
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
                    <label class="form-label">Data e hora</label>
                    <input
                      class="form-control"
                      type="datetime-local"
                      value=${formularioEdicao.data_entrevista}
                      onInput=${(event) =>
                        setFormularioEdicao({
                          ...formularioEdicao,
                          data_entrevista: event.target.value,
                        })}
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
                    <label class="form-label">Link de agendamento</label>
                    <input
                      class="form-control"
                      value=${formularioEdicao.link_agendamento}
                      onInput=${(event) =>
                        setFormularioEdicao({
                          ...formularioEdicao,
                          link_agendamento: event.target.value,
                        })}
                    />
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
                  disabled=${salvando}
                  onClick=${salvar}
                >
                  ${salvando ? 'Salvando...' : 'Salvar atualizacao'}
                </button>
              </footer>
            `
          : null}
      </${ModalPadrao}>
    </${PainelRh}>
  `;
}
