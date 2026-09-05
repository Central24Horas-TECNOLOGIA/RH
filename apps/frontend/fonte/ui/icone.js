import { html, React } from '../infraestrutura-react.js';
import { ICONES } from './icones-svg.js';

// Ícone genérico de contorno usado quando um nome não é encontrado no conjunto
// (evita um espaço em branco silencioso na tela — ver Icone/IconeSvg abaixo).
const FALLBACK = [['circle', { cx: '12', cy: '12', r: '8' }]];

const NOMES_AVISADOS = new Set();

function construirFormas(nome) {
  const formas = ICONES[nome] || FALLBACK;
  if (!ICONES[nome] && !NOMES_AVISADOS.has(nome)) {
    NOMES_AVISADOS.add(nome);
    if (typeof console !== 'undefined' && nome) {
      console.warn(`[icone] "${nome}" não está no conjunto de ícones (apps/frontend/fonte/ui/icones-svg.js).`);
    }
  }
  return formas.map(([tag, atributos], indice) => React.createElement(tag, { key: indice, ...atributos }));
}

// Renderiza só o <svg> do ícone — usado para trocar o conteúdo de um
// <span>/<i class="material-symbols-outlined"> já existente sem alterar a
// tag, as classes ou o CSS de tamanho/cor que já aponta para essa classe.
export function IconeSvg(nome) {
  return html`
    <svg
      viewBox="0 0 24 24"
      width="1em"
      height="1em"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      ${construirFormas(nome)}
    </svg>
  `;
}

// Componente completo (span + ícone) para telas que preferem usar
// <${Icone} name="..." /> em vez de montar o <span> na mão.
export function Icone({ name, className = '' }) {
  return html`
    <span class=${`material-symbols-outlined ${className}`.trim()} aria-hidden="true">
      ${IconeSvg(name)}
    </span>
  `;
}
