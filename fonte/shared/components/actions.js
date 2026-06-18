import { html } from '../../infraestrutura-react.js';

export function AcaoSair({ controlador }) {
  return html`
    <button
      type="button"
      class="btn btn-outline-secondary rh-modern-secondary-btn"
      onClick=${() => controlador.sair()}
    >
      Sair
    </button>
  `;
}
