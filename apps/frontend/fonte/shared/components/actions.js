import { html } from '../../infraestrutura-react.js';
import { IconeSvg } from '../../ui/icone.js';

export function AcaoSair({ controlador }) {
  return html`
    <button
      type="button"
      class="btn btn-outline-secondary rh-modern-secondary-btn rh-action-btn"
      onClick=${() => controlador.sair()}
    >
      <span class="material-symbols-outlined">${IconeSvg('logout')}</span>
      Sair
    </button>
  `;
}
