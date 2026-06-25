import { html } from '../../infraestrutura-react.js';
import { construirModeloPaginacao } from '../../utilitarios.js';

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

export function LoadingState({
  titulo = 'Carregando dados',
  descricao = 'Aguarde enquanto as informacoes sao atualizadas.',
}) {
  return html`
    <div class="rh-loading-state">
      <div
        class="spinner-border text-primary"
        role="status"
        aria-hidden="true"
      ></div>
      <div>
        <strong>${titulo}</strong>
        <p>${descricao}</p>
      </div>
    </div>
  `;
}
