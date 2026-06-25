import {
  html,
  useEffect,
  useMemo,
  useState,
} from '../infraestrutura-react.js';

const CARD_WIDTH = 320;
const CARD_HEIGHT_ESTIMATE = 220;
const VIEWPORT_PADDING = 16;

function montarChaveTour(screenId, userId) {
  const safeScreenId = String(screenId || '').trim() || 'screen';
  const safeUserId = String(userId || '').trim() || 'anonimo';
  return `rh_tour_visto:${safeScreenId}:${safeUserId}`;
}

function clamp(valor, minimo, maximo) {
  return Math.min(Math.max(valor, minimo), maximo);
}

function calcularPosicao(step) {
  const larguraJanela = window.innerWidth || 1280;
  const alturaJanela = window.innerHeight || 720;
  const larguraCard = clamp(
    Math.min(CARD_WIDTH, larguraJanela - VIEWPORT_PADDING * 2),
    260,
    CARD_WIDTH,
  );
  const posicaoCentral = {
    card: {
      width: larguraCard,
      top: VIEWPORT_PADDING,
      left: clamp(
        (larguraJanela - larguraCard) / 2,
        VIEWPORT_PADDING,
        larguraJanela - larguraCard - VIEWPORT_PADDING,
      ),
    },
    target: null,
  };

  if (!step?.target) return posicaoCentral;

  const elemento = document.querySelector(step.target);
  if (!elemento) return posicaoCentral;

  const rect = elemento.getBoundingClientRect();
  if (!rect.width && !rect.height) return posicaoCentral;

  let top = rect.bottom + 14;
  if (top + CARD_HEIGHT_ESTIMATE > alturaJanela - VIEWPORT_PADDING) {
    top = Math.max(VIEWPORT_PADDING, rect.top - CARD_HEIGHT_ESTIMATE - 14);
  }

  const left = clamp(
    rect.left,
    VIEWPORT_PADDING,
    larguraJanela - larguraCard - VIEWPORT_PADDING,
  );

  return {
    card: {
      width: larguraCard,
      top,
      left,
    },
    target: {
      top: Math.max(VIEWPORT_PADDING / 2, rect.top - 6),
      left: Math.max(VIEWPORT_PADDING / 2, rect.left - 6),
      width: rect.width + 12,
      height: rect.height + 12,
    },
  };
}

export function BotaoAjudaTour({
  onClick,
  label = 'Ver orientações',
  compact = false,
}) {
  return html`
    <button
      type="button"
      class=${`btn btn-outline-secondary rh-tour-help-btn ${compact ? 'is-compact' : ''}`.trim()}
      onClick=${onClick}
    >
      <span class="material-symbols-outlined">help</span>
      <span>${label}</span>
    </button>
  `;
}

export function TourGuiado({
  screenId,
  userId = '',
  steps = [],
  reopenSignal = 0,
}) {
  const passos = Array.isArray(steps) ? steps.filter(Boolean) : [];
  const [aberto, setAberto] = useState(false);
  const [indiceAtual, setIndiceAtual] = useState(0);
  const [layout, setLayout] = useState(null);
  const chavePersistencia = useMemo(
    () => montarChaveTour(screenId, userId),
    [screenId, userId],
  );
  const passoAtual = passos[indiceAtual] || null;

  useEffect(() => {
    if (!passos.length) return;

    try {
      if (window.localStorage.getItem(chavePersistencia) === '1') {
        return;
      }

      window.localStorage.setItem(chavePersistencia, '1');
      setIndiceAtual(0);
      setAberto(true);
    } catch (error) {
      setIndiceAtual(0);
      setAberto(true);
    }
  }, [chavePersistencia, passos.length]);

  useEffect(() => {
    if (!passos.length || !reopenSignal) return;
    setIndiceAtual(0);
    setAberto(true);
  }, [passos.length, reopenSignal]);

  useEffect(() => {
    if (!aberto || !passoAtual) return;

    const atualizar = () => setLayout(calcularPosicao(passoAtual));
    atualizar();

    window.addEventListener('resize', atualizar);
    window.addEventListener('scroll', atualizar, true);
    return () => {
      window.removeEventListener('resize', atualizar);
      window.removeEventListener('scroll', atualizar, true);
    };
  }, [aberto, passoAtual]);

  useEffect(() => {
    if (!aberto) return;

    const aoPressionarTecla = (event) => {
      if (event.key === 'Escape') {
        setAberto(false);
      }
    };

    window.addEventListener('keydown', aoPressionarTecla);
    return () => window.removeEventListener('keydown', aoPressionarTecla);
  }, [aberto]);

  if (!aberto || !passoAtual) return null;

  const ultimoPasso = indiceAtual >= passos.length - 1;
  const cardStyle = {
    top: `${layout?.card?.top || VIEWPORT_PADDING}px`,
    left: `${layout?.card?.left || VIEWPORT_PADDING}px`,
    width: `${layout?.card?.width || CARD_WIDTH}px`,
  };
  const destaqueStyle = layout?.target
    ? {
        top: `${layout.target.top}px`,
        left: `${layout.target.left}px`,
        width: `${layout.target.width}px`,
        height: `${layout.target.height}px`,
      }
    : null;

  return html`
    <div class="rh-tour-layer" aria-live="polite">
      ${destaqueStyle
        ? html`<div class="rh-tour-highlight" style=${destaqueStyle}></div>`
        : null}

      <div class="rh-tour-card" role="dialog" aria-modal="false" style=${cardStyle}>
        <div class="rh-tour-kicker">
          Guia rapido
          <span>${`${indiceAtual + 1}/${passos.length}`}</span>
        </div>
        <h3 class="rh-tour-title">${passoAtual.title}</h3>
        <p class="rh-tour-text">${passoAtual.text}</p>

        <div class="rh-tour-actions">
          <button
            type="button"
            class="btn btn-outline-secondary btn-sm"
            onClick=${() => setAberto(false)}
          >
            Fechar
          </button>
          <button
            type="button"
            class="btn btn-primary btn-sm"
            onClick=${() => {
              if (ultimoPasso) {
                setAberto(false);
                return;
              }

              setIndiceAtual(indiceAtual + 1);
            }}
          >
            ${ultimoPasso ? 'Concluir' : 'Seguinte'}
          </button>
        </div>
      </div>
    </div>
  `;
}
