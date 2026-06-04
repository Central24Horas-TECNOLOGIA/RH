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
    {
      tela: 'screen-email-inbox',
      icone: 'mail',
      label: 'E-mails',
      permissao: 'candidatos.criar',
    },
    {
      tela: 'screen-history',
      icone: 'history',
      label: 'Histórico',
      permissao: 'candidatos.consultar_historico',
    },
    {
      tela: 'screen-processes',
      icone: 'folder_managed',
      label: 'Processos',
      permissao: 'vagas.visualizar',
    },
    {
      tela: 'screen-candidates',
      icone: 'badge',
      label: 'Candidatos',
      permissao: 'candidatos.visualizar',
    },
    {
      tela: 'screen-candidate-pipeline',
      icone: 'view_kanban',
      label: 'Pipeline',
      permissao: 'candidatos.mover_etapa',
      exibir: false,
    },
    {
      tela: 'screen-interviews',
      icone: 'event_available',
      label: 'Entrevistas',
      permissao: 'entrevistas.visualizar',
    },
    {
      tela: 'screen-analysis-candidates',
      icone: 'analytics',
      label: 'Análise',
      permissao: 'relatorios.visualizar',
    },
    {
      tela: 'screen-talent-bank',
      icone: 'group',
      label: 'Banco de talentos',
      permissao: 'candidatos.visualizar',
    },
    {
      tela: 'screen-settings',
      icone: 'settings',
      label: 'Configurações',
      permissao: 'configuracoes.visualizar',
    },
  ];
  const possuiPermissao = (permissao) =>
    !permissao || controlador?.possuiPermissao?.(permissao);

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
        ${itens.filter((item) => item.exibir !== false && possuiPermissao(item.permissao)).map(
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

      ${mostrarAtalhos &&
      (possuiPermissao('vagas.criar') || possuiPermissao('provas.enviar'))
      ? html`
            <div class="rh-modern-sidebar-actions">
              ${possuiPermissao('vagas.criar')
          ? html`
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
                  `
          : null}
              ${possuiPermissao('provas.enviar')
          ? html`
                    <button
                      type="button"
                      class="rh-modern-cta-btn"
                      title="Nova prova"
                      onClick=${() => controlador.iniciarNovoFluxo()}
                    >
                      <span class="material-symbols-outlined">play_circle</span>
                      <span class="rh-modern-nav-label">Nova prova</span>
                    </button>
                  `
          : null}
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

function obterIniciaisUsuario(nome) {
  const partes = String(nome || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (!partes.length) return 'RH';
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();

  return `${partes[0].slice(0, 1)}${partes[partes.length - 1].slice(0, 1)}`.toUpperCase();
}

function CartaoUsuarioTopo({ controlador }) {
  const estado = controlador?.estado || {};
  const nome =
    estado.nomeUsuarioAutenticado ||
    estado.usuarioAutenticado ||
    'Usuário RH';
  const perfilBase =
    estado.perfilUsuarioNome ||
    estado.perfilUsuario ||
    estado.nivelPerfilUsuario ||
    'Usuário';
  const perfil = String(perfilBase).includes('/')
    ? perfilBase
    : `RH / ${perfilBase}`;
  const avatar =
    estado.avatarUsuario ||
    estado.userAvatar ||
    estado.usuarioAvatar ||
    '';
  const podeAbrirPerfil =
    controlador?.possuiPermissao?.('configuracoes.visualizar') ||
    controlador?.podeAcessarTela?.('screen-settings');

  return html`
    <button
      type="button"
      class="c24-user-menu"
      title="Perfil do usuário"
      aria-label=${`Perfil do usuário ${nome}`}
      onClick=${podeAbrirPerfil
        ? () => controlador.irParaTelaProtegida('screen-settings')
        : undefined}
    >
      <span class="c24-user-avatar">
        ${avatar
          ? html`<img src=${avatar} alt="" />`
          : html`<span>${obterIniciaisUsuario(nome)}</span>`}
        <i aria-hidden="true"></i>
      </span>
      <span class="c24-user-copy">
        <strong>${nome}</strong>
        <small>${perfil}</small>
      </span>
      <span class="material-symbols-outlined c24-user-chevron">
        expand_more
      </span>
    </button>
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
  const mostrarAcaoPrimaria =
    acaoPrimaria &&
    (!acaoPrimaria.permissao ||
      controlador?.possuiPermissao?.(acaoPrimaria.permissao));

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
              ${mostrarAcaoPrimaria
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
                      label="Ver orientações"
                      onClick=${() => setTourReopenSignal((valor) => valor + 1)}
                    />
                  `
      : null}
              ${acoesTopo}
              <${CartaoUsuarioTopo} controlador=${controlador} />
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
