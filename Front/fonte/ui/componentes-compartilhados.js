import {
  html,
  useEffect,
  useRef,
  useState,
} from '../infraestrutura-react.js';
import {
  construirModeloPaginacao,
  formatarPontuacaoDetalhada,
} from '../utilitarios.js';
import {
  baixarModeloExcel,
  obterCapacidadesDaTarefa,
  validarArquivoExcel,
} from '../regras-prova.js';
import { obterClasseSituacaoAtual } from '../app/controlador-aplicacao.js';

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

export function GrupoPaginacao({ paginaAtual, totalPaginas, onChange }) {
  const itens = construirModeloPaginacao(paginaAtual, totalPaginas);
  if (itens.length <= 1) return null;

  return html`
    <div class="rh-pagination-wrap">
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

export function ModalPadrao({
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
      class="rh-modal-overlay"
      onClick=${(event) => event.target === event.currentTarget && onClose()}
    >
      <div
        class=${`rh-modal-dialog ${className}`.trim()}
        role="dialog"
        aria-modal="true"
      >
        <header class="rh-modal-header">
          <div>
            <h3 class="rh-modal-title">${titulo}</h3>
            ${subtitulo
              ? html`<p class="rh-modal-subtitle">${subtitulo}</p>`
              : null}
          </div>
          <button
            type="button"
            class="btn rh-modal-close-btn"
            aria-label="Fechar"
            onClick=${onClose}
          >
            ×
          </button>
        </header>
        <div class="rh-modal-content">${children}</div>
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
    { tela: 'screen-menu', icone: 'home', label: 'Painel' },
    { tela: 'screen-history', icone: 'history', label: 'Historico' },
    {
      tela: 'screen-processes',
      icone: 'folder_managed',
      label: 'Processos',
    },
    {
      tela: 'screen-analysis-candidates',
      icone: 'analytics',
      label: 'Analise',
    },
    {
      tela: 'screen-talent-bank',
      icone: 'group',
      label: 'Banco de talentos',
    },
  ];

  return html`
    <aside class="rh-modern-sidebar">
      <div class="rh-modern-sidebar-brand">
        <button
          type="button"
          class="rh-modern-logo-btn"
          aria-label="Voltar ao painel"
          onClick=${() => controlador.irParaMenu()}
        >
          <img
            alt="Central 24 Horas"
            class="rh-modern-logo"
            src="estilos/logo-central24.jpg"
          />
        </button>
        <div>
          <div class="rh-modern-brand-title">Conexa RH</div>
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
            <div class="rh-modern-sidebar-actions">
              <button
                type="button"
                class="rh-modern-cta-btn"
                onClick=${() =>
                  controlador.irParaTelaProtegida('screen-process-create')}
              >
                <span class="material-symbols-outlined">playlist_add</span>
                <span>Novo processo</span>
              </button>
              <button
                type="button"
                class="rh-modern-cta-btn"
                onClick=${() => controlador.iniciarNovoFluxo()}
              >
                <span class="material-symbols-outlined">play_circle</span>
                <span>Nova prova</span>
              </button>
            </div>
          `
        : null}
    </aside>
  `;
}

export function PageIntro({ kicker, title, description, actions = null }) {
  return html`
    <section class="rh-page-intro">
      <div>
        ${kicker ? html`<p class="rh-modern-kicker">${kicker}</p>` : null}
        <h2 class="rh-modern-title">${title}</h2>
        ${description
          ? html`<p class="rh-modern-description">${description}</p>`
          : null}
      </div>
      ${actions ? html`<div class="rh-page-intro-actions">${actions}</div>` : null}
    </section>
  `;
}

export function SectionCard({
  title,
  description,
  actions = null,
  className = '',
  children,
}) {
  return html`
    <section class=${`rh-section-card ${className}`.trim()}>
      ${title || description || actions
        ? html`
            <header class="rh-section-card-header">
              <div>
                ${title ? html`<h3>${title}</h3>` : null}
                ${description
                  ? html`<p class="rh-section-card-description">
                      ${description}
                    </p>`
                  : null}
              </div>
              ${actions}
            </header>
          `
        : null}
      ${children}
    </section>
  `;
}

export function MetricGrid({ items = [] }) {
  return html`
    <div class="rh-metric-grid">
      ${items.map(
        (item, indice) => html`
          <article
            key=${item.label || indice}
            class=${`rh-metric-card ${item.variant || ''}`.trim()}
          >
            <span class="rh-metric-label">${item.label}</span>
            <strong class="rh-metric-value">${item.value}</strong>
            ${item.helper
              ? html`<span class="rh-metric-helper">${item.helper}</span>`
              : null}
          </article>
        `,
      )}
    </div>
  `;
}

export function EmptyState({ title, text }) {
  return html`
    <div class="rh-empty-state">
      <h3>${title}</h3>
      <p>${text}</p>
    </div>
  `;
}

export function PainelRh({
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
      <div class="rh-modern-shell">
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

export function ModalDetalhesProva({ detalhe, onClose, onDownload }) {
  if (!detalhe) return null;

  const { linha, payload, resumoEtapas, situacaoAtual } = detalhe;

  return html`
    <${ModalPadrao}
      aberto=${true}
      titulo=${`Detalhes da prova • ${linha.nome_candidato || 'Candidato'}`}
      subtitulo="Informacoes registradas no historico e no gabarito salvo."
      onClose=${onClose}
    >
      <div class="rh-details-body">
        <${MetricGrid}
          items=${[
            {
              label: 'Candidato',
              value: payload?.candidate?.name || linha.nome_candidato || '-',
            },
            {
              label: 'Vaga',
              value: payload?.candidate?.role || linha.vaga || '-',
            },
            {
              label: 'Nivel',
              value: payload?.candidate?.level || linha.nivel || '-',
            },
            {
              label: 'Nota final',
              value: formatarPontuacaoDetalhada(
                linha.pontuacao_final,
                payload?.weightedFinalScore,
              ),
            },
            {
              label: 'Data',
              value: linha.data_exibicao || '-',
            },
            {
              label: 'Situacao',
              value: html`
                <span
                  class=${`rh-status-pill ${obterClasseSituacaoAtual(situacaoAtual)}`}
                >
                  ${situacaoAtual}
                </span>
              `,
            },
          ]}
        />

        <${SectionCard}
          title="Notas por etapa"
          className="rh-section-card--flat"
        >
          ${resumoEtapas?.length
            ? html`
                <div class="rh-stage-grid">
                  ${resumoEtapas.map(
                    (etapa, indice) => html`
                      <article key=${indice} class="rh-stage-card">
                        <div class="rh-stage-card-top">
                          <strong>${etapa.label || '-'}</strong>
                          <span>Peso ${etapa.weight ?? '-'}%</span>
                        </div>
                        <div class="rh-stage-card-score">
                          ${etapa.rawScore ?? 0}/${etapa.rawMax ?? 0}
                        </div>
                        <p>
                          Aproveitamento:
                          ${((etapa.percent || 0) * 100).toFixed(1)}%
                        </p>
                        <p>
                          Nota ponderada:
                          ${Number(etapa.weightedScore || 0).toFixed(1)}
                        </p>
                      </article>
                    `,
                  )}
                </div>
              `
            : html`
                <${EmptyState}
                  title="Sem detalhamento salvo"
                  text="Esta prova possui apenas o resumo consolidado no historico."
                />
              `}
        </${SectionCard}>

        <${SectionCard}
          title="Registro completo"
          className="rh-section-card--flat"
        >
          ${payload?.textContent
            ? html`<pre class="rh-detail-log">${payload.textContent}</pre>`
            : html`
                <${EmptyState}
                  title="Gabarito indisponivel"
                  text="Nao existe texto detalhado salvo para esta prova."
                />
              `}
        </${SectionCard}>
      </div>

      <footer class="rh-modal-footer">
        <div class="rh-modal-footer-actions">
          <button
            type="button"
            class="btn btn-outline-secondary"
            onClick=${() => window.print()}
          >
            Imprimir
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
      </footer>
    </${ModalPadrao}>
  `;
}

export function EditorTextoRich({ valor, onChange }) {
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

  const acoes = [
    ['bold', html`<strong>B</strong>`],
    ['italic', html`<em>I</em>`],
    ['underline', html`<u>U</u>`],
    ['justifyLeft', 'Esq'],
    ['justifyCenter', 'Centro'],
    ['insertUnorderedList', 'Lista'],
  ];

  return html`
    <div class="rh-editor-card">
      <div class="toolbar rh-editor-toolbar">
        ${acoes.map(
          ([comando, rotulo]) => html`
            <button
              key=${comando}
              type="button"
              class="btn btn-outline-secondary"
              onClick=${() => executarComando(comando)}
            >
              ${rotulo}
            </button>
          `,
        )}
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
  `;
}

export function PerguntaMultipla({ questao, resposta, onChange }) {
  const selecionado = resposta?.selected;

  return html`
    <div class="rh-option-list">
      ${questao.options.map(
        (opcao, indice) => html`
          <label
            key=${`${questao.title}-${indice}`}
            class=${`rh-option-card ${selecionado === indice ? 'is-selected' : ''}`}
          >
            <input
              class="form-check-input"
              type="radio"
              name="mcq"
              checked=${selecionado === indice}
              onChange=${() => onChange(indice)}
            />
            <span class="exam-option-letter"
              >${String.fromCharCode(65 + indice)}</span
            >
            <span class="exam-option-text">${opcao}</span>
          </label>
        `,
      )}
    </div>
  `;
}

export function PerguntaExcel({ questao, resposta, nomeCandidato, onChange }) {
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
      if (event.target) {
        event.target.value = '';
      }
    }
  };

  return html`
    <div class="excel-card">
      <div class="row g-4">
        <div class="col-lg-7">
          <div class="excel-step">
            <h4>Como funciona esta etapa</h4>
            <ol class="mb-0">
              <li>Baixe a planilha da etapa.</li>
              <li>Execute a atividade no Excel ou LibreOffice Calc.</li>
              <li>Salve o arquivo corretamente.</li>
              <li>Envie o arquivo respondido para validacao.</li>
            </ol>
          </div>

          <div class="excel-step">
            <h4>O que sera avaliado</h4>
            <ul class="muted-list">
              ${obterCapacidadesDaTarefa(questao.taskId).map(
                (item, indice) => html`<li key=${indice}>${item}</li>`,
              )}
            </ul>
          </div>

          <button
            type="button"
            class="btn btn-success"
            onClick=${baixarArquivoBase}
          >
            Baixar arquivo .xlsx
          </button>
        </div>

        <div class="col-lg-5">
          <div class="excel-upload-box">
            <label class="form-label fw-semibold">Enviar arquivo respondido</label>
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



