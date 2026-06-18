import { html, useState } from '../../infraestrutura-react.js';
import { BuscaGlobalTopbar } from '../busca-global.js';
import { obterTourDaTela } from '../../shared/tour-config.js';
import { BotaoAjudaTour, TourGuiado } from '../tour-guiado.js';

function BarraLateral({
  navAtiva,
  controlador,
  mostrarAtalhos = true,
  recolhida = false,
}) {
  const itens = [
    { tela: 'screen-menu', icone: 'home', label: 'Painel' },
    { tela: 'screen-email-inbox', icone: 'mail', label: 'E-mails' },
    { tela: 'screen-history', icone: 'history', label: 'Historico' },
    {
      tela: 'screen-processes',
      icone: 'folder_managed',
      label: 'Processos',
    },
    {
      tela: 'screen-candidates',
      icone: 'badge',
      label: 'Candidatos',
    },
    {
      tela: 'screen-candidate-pipeline',
      icone: 'view_kanban',
      label: 'Pipeline',
      exibir: false,
    },
    {
      tela: 'screen-interviews',
      icone: 'event_available',
      label: 'Entrevistas',
    },
    {
      tela: 'screen-analysis-candidates',
      icone: 'analytics',
      label: 'Analise',
    },
    {
      tela: 'screen-talent-bank',
      icone: 'group',
      label: 'Banco de talentos',
    },
  ];

  return html`
    <aside
      class=${`rh-modern-sidebar ${recolhida ? 'is-collapsed' : ''}`.trim()}
      data-tour-id="layout-sidebar"
    >
      <div class="rh-modern-sidebar-brand">
        <button
          type="button"
          class="rh-modern-logo-btn"
          aria-label="Voltar ao painel principal"
          onClick=${() => controlador.irParaMenu()}
        >
          <img
            alt="Central 24h"
            class="rh-modern-logo"
            src="estilos/logo_conecta_branco.png"
          />
        </button>
        <button
          type="button"
          class="rh-modern-sidebar-toggle"
          aria-label=${recolhida
      ? 'Expandir menu lateral'
      : 'Recolher menu lateral'}
          title=${recolhida ? 'Expandir menu lateral' : 'Recolher menu lateral'}
          onClick=${() => controlador.alternarBarraLateral()}
        >
          <span class="material-symbols-outlined">
            ${recolhida ? 'left_panel_open' : 'left_panel_close'}
          </span>
        </button>
      </div>

      <nav class="rh-modern-nav">
        ${itens.filter((item) => item.exibir !== false).map(
        (item) => html`
            <button
              key=${item.tela}
              type="button"
              class=${`rh-modern-nav-btn ${navAtiva === item.tela ? 'is-active' : ''}`}
              title=${item.label}
              onClick=${() => controlador.irParaTelaProtegida(item.tela)}
            >
              <span class="material-symbols-outlined">${item.icone}</span>
              <span class="rh-modern-nav-label">${item.label}</span>
            </button>
          `,
      )}
      </nav>

      ${mostrarAtalhos
      ? html`
            <div class="rh-modern-sidebar-actions">
              <button
                type="button"
                class="rh-modern-cta-btn"
                title="Novo processo"
                onClick=${() =>
          controlador.irParaTelaProtegida('screen-process-create')}
              >
                <span class="material-symbols-outlined">playlist_add</span>
                <span class="rh-modern-nav-label">Novo processo</span>
              </button>
              <button
                type="button"
                class="rh-modern-cta-btn"
                title="Nova prova"
                onClick=${() => controlador.iniciarNovoFluxo()}
              >
                <span class="material-symbols-outlined">play_circle</span>
                <span class="rh-modern-nav-label">Nova prova</span>
              </button>
            </div>
          `
      : null}
    </aside>
  `;
}

export function PageIntro({
  kicker,
  title,
  description,
  actions = null,
  tourId = 'page-intro',
}) {
  return html`
    <section class="rh-page-intro" data-tour-id=${tourId || null}>
      <div>
        ${kicker ? html`<p class="rh-modern-kicker">${kicker}</p>` : null}
        <h2 class="rh-modern-title">${title}</h2>
        ${description
      ? html`<p class="rh-modern-description">${description}</p>`
      : null}
      </div>
      ${actions
      ? html`<div class="rh-page-intro-actions">${actions}</div>`
      : null}
    </section>
  `;
}

export function SectionCard({
  title,
  description,
  actions = null,
  className = '',
  tourId = '',
  children,
}) {
  return html`
    <section
      class=${`rh-section-card ${className}`.trim()}
      data-tour-id=${tourId || null}
    >
      ${title || description || actions
      ? html`
            <header class="rh-section-card-header">
              <div>
                ${title ? html`<h3>${title}</h3>` : null}
                ${description
          ? html`<p class="rh-section-card-description">
                      ${description}
                    </p>`
          : null}
              </div>
              ${actions}
            </header>
          `
      : null}
      ${children}
    </section>
  `;
}

export function PainelRh({
  screenId,
  navAtiva,
  subtituloMarca,
  placeholderBusca,
  controlador,
  acaoPrimaria,
  acoesTopo = null,
  mostrarAtalhos = true,
  children,
}) {
  const sidebarRecolhida = !!controlador?.estado?.barraLateralRecolhida;
  const tour = obterTourDaTela(screenId, {
    hasPrimaryAction: Boolean(acaoPrimaria),
  });
  const [tourReopenSignal, setTourReopenSignal] = useState(0);
  const usuarioTour = controlador?.estado?.usuarioAutenticado || '';

  return html`
    <section class="active screen" id=${screenId}>
      <div
        class=${`rh-modern-shell ${sidebarRecolhida ? 'is-sidebar-collapsed' : ''}`.trim()}
      >
        <${BarraLateral}
          navAtiva=${navAtiva}
          subtituloMarca=${subtituloMarca}
          controlador=${controlador}
          mostrarAtalhos=${mostrarAtalhos}
          recolhida=${sidebarRecolhida}
        />

        <div class="rh-modern-main">
          <header class="rh-modern-topbar">
            <div class="rh-modern-topbar-left" data-tour-id="topbar-search">
              <${BuscaGlobalTopbar}
                placeholderBusca=${placeholderBusca}
                controlador=${controlador}
              />
            </div>
            <div class="rh-modern-topbar-actions">
              ${acaoPrimaria
      ? html`
                    <button
                      type="button"
                      class="btn btn-primary rh-modern-primary-btn"
                      data-tour-id="topbar-primary-action"
                      onClick=${acaoPrimaria.onClick}
                    >
                      ${acaoPrimaria.label}
                    </button>
                  `
      : null}
              ${tour?.steps?.length
      ? html`
                    <${BotaoAjudaTour}
                      compact=${true}
                      label="Ver orientacoes"
                      onClick=${() => setTourReopenSignal((valor) => valor + 1)}
                    />
                  `
      : null}
              ${acoesTopo}
            </div>
          </header>

          <main class="rh-modern-page">
            ${children}
            ${tour?.steps?.length
      ? html`
                  <${TourGuiado}
                    screenId=${screenId}
                    userId=${usuarioTour}
                    steps=${tour.steps}
                    reopenSignal=${tourReopenSignal}
                  />
                `
      : null}
          </main>
        </div>
      </div>
    </section>
  `;
}
