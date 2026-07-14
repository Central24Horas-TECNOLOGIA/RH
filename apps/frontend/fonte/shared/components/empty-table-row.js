import { html } from '../../infraestrutura-react.js';

export function TabelaVazia({ colunas, texto }) {
  const carregando = String(texto || '').toLowerCase().includes('carregando');

  return html`
    <tr>
      <td colspan=${colunas} class="text-center text-muted py-4">
        ${carregando
          ? html`
              <div class="rh-loading-state c24-loading-panel">
                <div class="spinner-border text-primary" role="status" aria-hidden="true"></div>
                <div>
                  <strong>${texto}</strong>
                  <p>Aguarde enquanto as informações são atualizadas.</p>
                </div>
              </div>
            `
          : texto}
      </td>
    </tr>
  `;
}
