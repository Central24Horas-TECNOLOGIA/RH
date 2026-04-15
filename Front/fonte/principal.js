import { createRoot, html } from './infraestrutura-react.js';
import { Aplicacao } from './aplicacao.js';

const container = document.getElementById('app');
const root = createRoot(container);

root.render(html`<${Aplicacao} />`);
