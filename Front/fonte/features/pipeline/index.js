import {
  html,
  useEffect,
  useMemo,
  useState,
} from '../../infraestrutura-react.js';
import {
  criarCardPipeline,
  excluirCardPipeline,
  lerPipelineCandidatos,
  lerProcessos,
  moverCardPipeline,
} from '../../app/controlador-aplicacao.js';
import {
  formatarDataHora,
  obterClasseStatusEntrevista,
} from '../../shared/helpers-visuais.js';
import { AcaoSair } from '../../shared/components/actions.js';
import { validarCardPipeline } from '../../shared/validacoes.js';
import { formatarNotaAnalise } from '../../utilitarios.js';
import {
  CHAVE_PIPELINE_CANDIDATO,
  CHAVE_PIPELINE_PROCESSO,
} from '../processos/state.js';
import {
  EmptyState,
  LoadingState,
  MetricGrid,
  ModalPadrao,
  PageIntro,
  PainelRh,
  SectionCard,
} from '../../ui/componentes-compartilhados.js';

const ETAPAS_PIPELINE = [
  'Triagem',
  'Prova',
  'Entrevista',
  'Aprovado',
  'Reprovado',
];

function indiceEtapa(etapa) {
  return ETAPAS_PIPELINE.indexOf(etapa);
}

export function TelaPipelineCandidatos({ controlador }) {
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [processos, setProcessos] = useState([]);
  const [cards, setCards] = useState([]);
  const [filtros, setFiltros] = useState(() => ({
    processo: sessionStorage.getItem(CHAVE_PIPELINE_PROCESSO) || '',
    busca: '',
  }));
  const [candidatoFoco, setCandidatoFoco] = useState(
    sessionStorage.getItem(CHAVE_PIPELINE_CANDIDATO) || '',
  );
  const [modalCriacaoAberto, setModalCriacaoAberto] = useState(false);
  const [novoCard, setNovoCard] = useState({
    id_processo: sessionStorage.getItem(CHAVE_PIPELINE_PROCESSO) || '',
    nome_candidato: '',
    vaga: '',
    etapa_pipeline: 'Triagem',
  });

  const carregar = async (forcar = false) => {
    setCarregando(true);
    setErro('');

    try {
      const [listaProcessos, listaCards] = await Promise.all([
        lerProcessos(forcar),
        lerPipelineCandidatos(filtros.processo, filtros.busca),
      ]);

      setProcessos(Array.isArray(listaProcessos) ? listaProcessos : []);
      setCards(Array.isArray(listaCards) ? listaCards : []);
    } catch (error) {
      setErro(
        error?.message || 'Nao foi possivel carregar o pipeline de candidatos.',
      );
      setCards([]);
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregar();
  }, [filtros.processo, filtros.busca]);

  useEffect(() => {
    if (filtros.processo) {
      sessionStorage.setItem(CHAVE_PIPELINE_PROCESSO, filtros.processo);
    } else {
      sessionStorage.removeItem(CHAVE_PIPELINE_PROCESSO);
    }
  }, [filtros.processo]);

  useEffect(() => {
    if (!candidatoFoco) return;

    const timeout = window.setTimeout(() => {
      setCandidatoFoco('');
      sessionStorage.removeItem(CHAVE_PIPELINE_CANDIDATO);
    }, 4000);

    return () => window.clearTimeout(timeout);
  }, [candidatoFoco]);

  const cardsPorEtapa = useMemo(
    () =>
      ETAPAS_PIPELINE.map((etapa) => ({
        etapa,
        items: cards.filter(
          (item) => String(item.etapa_pipeline || '').trim() === etapa,
        ),
      })),
    [cards],
  );

  const resumo = useMemo(() => {
    const base = { total: cards.length, entrevistasAtivas: 0 };
    ETAPAS_PIPELINE.forEach((etapa) => {
      base[etapa] = cards.filter(
        (item) => String(item.etapa_pipeline || '').trim() === etapa,
      ).length;
    });
    base.entrevistasAtivas = cards.filter((item) => item.status_entrevista).length;
    return base;
  }, [cards]);

  const mover = async (card, direcao) => {
    const posicaoAtual = indiceEtapa(card.etapa_pipeline);
    const proximaPosicao = posicaoAtual + direcao;

    if (proximaPosicao < 0 || proximaPosicao >= ETAPAS_PIPELINE.length) {
      return;
    }

    setSalvando(true);
    setErro('');

    try {
      await moverCardPipeline(card.id_registro, {
        etapa_pipeline: ETAPAS_PIPELINE[proximaPosicao],
        data_movimentacao: new Date().toISOString(),
      });
      await carregar(true);
    } catch (error) {
      setErro(
        error?.message || 'Nao foi possivel mover o candidato no pipeline.',
      );
    } finally {
      setSalvando(false);
    }
  };

  const remover = async (card) => {
    const confirmar = window.confirm(
      `Deseja realmente excluir o card de ${card.nome_candidato || 'candidato'}? Essa remocao sera persistida e refletida nas telas relacionadas.`,
    );
    if (!confirmar) return;

    setSalvando(true);
    setErro('');

    try {
      await excluirCardPipeline(card.id_registro);
      await carregar(true);
    } catch (error) {
      setErro(
        error?.message || 'Nao foi possivel excluir o card selecionado.',
      );
    } finally {
      setSalvando(false);
    }
  };

  const salvarNovoCard = async () => {
    const mensagemErro = validarCardPipeline(novoCard);
    if (mensagemErro) {
      setErro(mensagemErro);
      return;
    }

    setSalvando(true);
    setErro('');

    try {
      await criarCardPipeline({
        ...novoCard,
        nome_candidato: novoCard.nome_candidato.trim(),
      });

      setModalCriacaoAberto(false);
      setNovoCard({
        id_processo: novoCard.id_processo,
        nome_candidato: '',
        vaga: '',
        etapa_pipeline: 'Triagem',
      });
      await carregar(true);
    } catch (error) {
      setErro(
        error?.message || 'Nao foi possivel criar o card do candidato.',
      );
    } finally {
      setSalvando(false);
    }
  };

  return html`
    <${PainelRh}
      screenId="screen-candidate-pipeline"
      navAtiva="screen-candidate-pipeline"
      subtituloMarca="Pipeline de candidatos"
      placeholderBusca="Pipeline de candidatos"
      controlador=${controlador}
      acaoPrimaria=${{
        label: 'Novo card',
        onClick: () => setModalCriacaoAberto(true),
      }}
      acoesTopo=${html`
        <button
          type="button"
          class="btn btn-outline-secondary"
          onClick=${() => carregar(true)}
        >
          Atualizar
        </button>
        <${AcaoSair} controlador=${controlador} />
      `}
    >
      <${PageIntro}
        kicker="Console • Pipeline"
        title="Pipeline de candidatos"
        description="Acompanhe cada etapa do funil com persistencia real, exclusao segura do card e leitura integrada de entrevista e perfil RH."
      />

      ${erro ? html`<div class="rh-inline-alert">${erro}</div>` : null}

      <${SectionCard}
        title="Visao executiva"
        description="Resumo rapido do kanban por etapa e entrevistas em andamento."
      >
        <${MetricGrid}
          items=${[
            { label: 'Total', value: resumo.total || 0 },
            { label: 'Triagem', value: resumo.Triagem || 0, variant: 'is-analysis' },
            { label: 'Prova', value: resumo.Prova || 0 },
            { label: 'Entrevista', value: resumo.Entrevista || 0, variant: 'is-highlight' },
            { label: 'Entrevistas agendadas', value: resumo.entrevistasAtivas || 0, variant: 'is-highlight' },
            { label: 'Aprovado', value: resumo.Aprovado || 0, variant: 'is-approved' },
            { label: 'Reprovado', value: resumo.Reprovado || 0, variant: 'is-eliminated' },
          ]}
        />
      </${SectionCard}>

      <${SectionCard}
        title="Filtros"
        description="Filtre por processo ou pesquise rapidamente por nome, vaga ou codigo do processo."
        tourId="pipeline-filters"
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
            <label>Busca rapida</label>
            <input
              class="form-control"
              value=${filtros.busca}
              placeholder="Nome, vaga ou processo"
              onInput=${(event) =>
                setFiltros({ ...filtros, busca: event.target.value })}
            />
          </div>
        </div>
      </${SectionCard}>

      <section class="rh-pipeline-board-wrap" data-tour-id="pipeline-board">
        <section class="rh-pipeline-board">
          ${cardsPorEtapa.map(
            (coluna) => html`
              <article key=${coluna.etapa} class="rh-pipeline-column">
                <header class="rh-pipeline-column-header">
                  <strong>${coluna.etapa}</strong>
                  <span>${coluna.items.length}</span>
                </header>

                <div class="rh-pipeline-column-body">
                  ${carregando
                    ? html`
                        <${LoadingState}
                          titulo="Carregando cards"
                          descricao="Buscando movimentacoes persistidas no pipeline."
                        />
                      `
                    : coluna.items.length
                      ? coluna.items.map(
                          (card) => html`
                            <div
                              key=${card.id_registro}
                              class=${`rh-pipeline-card ${String(card.id_registro) === String(candidatoFoco) ? 'is-focused' : ''}`.trim()}
                            >
                              <div class="rh-pipeline-card-top">
                                <strong>${card.nome_candidato || '-'}</strong>
                                <span class="rh-status-pill">
                                  ${card.status_candidato || 'Em analise'}
                                </span>
                              </div>

                              <div class="rh-pipeline-card-meta">
                                <span>${card.id_processo || '-'}</span>
                                <span>${card.vaga || '-'}</span>
                              </div>

                              ${card.tags?.length
                                ? html`
                                    <div class="rh-chip-wrap mt-3">
                                      ${card.tags.slice(0, 3).map(
                                        (tag) => html`
                                          <span key=${tag} class="rh-chip">${tag}</span>
                                        `,
                                      )}
                                    </div>
                                  `
                                : null}

                              <div class="rh-pipeline-card-details">
                                <span>Origem: ${card.origem || '-'}</span>
                                <span>
                                  Nota:
                                  ${card.pontuacao_final !== undefined &&
                                  card.pontuacao_final !== null &&
                                  card.pontuacao_final !== ''
                                    ? formatarNotaAnalise(card.pontuacao_final)
                                    : '-'}
                                </span>
                                <span>
                                  Entrevista:
                                  ${card.status_entrevista
                                    ? html`
                                        <span
                                          class=${`rh-status-pill ${obterClasseStatusEntrevista(card.status_entrevista)}`}
                                        >
                                          ${card.status_entrevista}
                                        </span>
                                      `
                                    : 'Nao agendada'}
                                </span>
                                ${card.data_entrevista
                                  ? html`
                                      <span>
                                        Data entrevista: ${formatarDataHora(
                                          card.data_entrevista,
                                        )}
                                      </span>
                                    `
                                  : null}
                              </div>

                              <div class="rh-pipeline-card-actions">
                                <button
                                  type="button"
                                  class="btn btn-sm btn-outline-secondary"
                                  disabled=${salvando ||
                                  indiceEtapa(card.etapa_pipeline) === 0}
                                  onClick=${() => mover(card, -1)}
                                >
                                  Etapa anterior
                                </button>
                                <button
                                  type="button"
                                  class="btn btn-sm btn-primary"
                                  disabled=${salvando ||
                                  indiceEtapa(card.etapa_pipeline) ===
                                    ETAPAS_PIPELINE.length - 1}
                                  onClick=${() => mover(card, 1)}
                                >
                                  Proxima etapa
                                </button>
                                <button
                                  type="button"
                                  class="btn btn-sm btn-outline-danger"
                                  disabled=${salvando}
                                  onClick=${() => remover(card)}
                                >
                                  Excluir card
                                </button>
                              </div>
                            </div>
                          `,
                        )
                      : html`
                          <div class="rh-pipeline-empty">
                            Nenhum candidato nesta etapa.
                          </div>
                        `}
                </div>
              </article>
            `,
          )}
        </section>
      </section>

      ${!carregando && !cards.length
        ? html`
            <${EmptyState}
              title="Nenhum card no pipeline"
              text="Crie um novo card ou ajuste os filtros para visualizar candidatos."
            />
          `
        : null}

      <${ModalPadrao}
        aberto=${modalCriacaoAberto}
        titulo="Novo card de candidato"
        subtitulo="Crie um card manual e vincule o candidato ao processo correto."
        onClose=${() => setModalCriacaoAberto(false)}
      >
        <div class="row g-3">
          <div class="col-md-12">
            <label class="form-label">Processo</label>
            <select
              class="form-select"
              value=${novoCard.id_processo}
              onChange=${(event) =>
                setNovoCard({ ...novoCard, id_processo: event.target.value })}
            >
              <option value="">Selecione...</option>
              ${processos.map(
                (processo) => html`
                  <option key=${processo.id_processo} value=${processo.id_processo}>
                    ${processo.id_processo} • ${processo.vaga}
                  </option>
                `,
              )}
            </select>
          </div>

          <div class="col-md-8">
            <label class="form-label">Nome do candidato</label>
            <input
              class="form-control"
              value=${novoCard.nome_candidato}
              onInput=${(event) =>
                setNovoCard({
                  ...novoCard,
                  nome_candidato: event.target.value,
                })}
            />
          </div>

          <div class="col-md-4">
            <label class="form-label">Etapa inicial</label>
            <select
              class="form-select"
              value=${novoCard.etapa_pipeline}
              onChange=${(event) =>
                setNovoCard({
                  ...novoCard,
                  etapa_pipeline: event.target.value,
                })}
            >
              ${ETAPAS_PIPELINE.map(
                (etapa) => html`
                  <option key=${etapa} value=${etapa}>${etapa}</option>
                `,
              )}
            </select>
          </div>

          <div class="col-md-12">
            <label class="form-label">Vaga</label>
            <input
              class="form-control"
              placeholder="Opcional: se vazio, usa a vaga do processo"
              value=${novoCard.vaga}
              onInput=${(event) =>
                setNovoCard({ ...novoCard, vaga: event.target.value })}
            />
          </div>
        </div>

        <div class="rh-form-footer mt-4">
          <button
            type="button"
            class="btn btn-outline-secondary"
            onClick=${() => setModalCriacaoAberto(false)}
          >
            Cancelar
          </button>
          <button
            type="button"
            class="btn btn-primary"
            disabled=${salvando}
            onClick=${salvarNovoCard}
          >
            ${salvando ? 'Salvando...' : 'Criar card'}
          </button>
        </div>
      </${ModalPadrao}>
    </${PainelRh}>
  `;
}
