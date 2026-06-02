import { html } from '../../infraestrutura-react.js';

export function AcaoSair({ controlador }) {
  return html`
    <button
      type="button"
      class="btn btn-outline-secondary rh-modern-secondary-btn rh-action-btn"
      onClick=${() => controlador.sair()}
    >
      <span class="material-symbols-outlined">logout</span>
      Sair
    </button>
  `;
}
