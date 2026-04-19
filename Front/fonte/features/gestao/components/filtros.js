import { html } from '../../../infraestrutura-react.js';

export function BlocoFiltro({ children, tourId = '' }) {
  return html`
    <section class="rh-filter-card" data-tour-id=${tourId || null}>
      ${children}
    </section>
  `;
}

export function CampoFiltro({ label, icon, children }) {
  return html`
    <div class="rh-filter-field">
      <label>${label}</label>
      <div class="rh-modern-input-shell">
        <span class="material-symbols-outlined">${icon}</span>
        ${children}
      </div>
    </div>
  `;
}
