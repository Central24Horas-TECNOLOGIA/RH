import { html } from '../../infraestrutura-react.js';

export function TabelaVazia({ colunas, texto }) {
  return html`
    <tr>
      <td colspan=${colunas} class="text-center text-muted py-4">${texto}</td>
    </tr>
  `;
}
