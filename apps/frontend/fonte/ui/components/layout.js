import { html, useEffect, useState } from '../../infraestrutura-react.js';
import { BuscaGlobalTopbar } from '../busca-global.js';
import { obterTourDaTela } from '../../shared/tour-config.js';
import { BotaoAjudaTour, TourGuiado } from '../tour-guiado.js';

export function BarraLateral({
  navAtiva,
  controlador,
  subtituloMarca = 'Plataforma de Recrutamento e Seleção',
  mostrarAtalhos = true,
  recolhida = false,
  onOpenHelp = null,
  mostrarAjuda = false,
}) {
  const itensPrincipais = [
    { tela: 'screen-menu', icone: 'home', label: 'Início' },
    {
      tela: 'screen-email-inbox',
      icone: 'mail',
      label: 'E-mails',
      permissao: 'candidatos.criar',
    },
  ];
  const itensAposProcessos = [
    {
      tela: 'screen-interviews',
      icone: 'event_available',
      label: 'Entrevistas',
      permissao: 'entrevistas.visualizar',
    },
    {
      tela: 'screen-talent-bank',
      icone: 'group',
      label: 'Banco de Talentos',
      permissao: 'candidatos.visualizar',
    },
    {
      tela: 'screen-onedrive-files',
      icone: 'cloud',
      label: 'OneDrive',
      permissao: 'onedrive.visualizar',
    },
    // Item removido do menu lateral por decisão de interface.
    // {
    //   tela: 'screen-help',
    //   icone: 'help',
    //   label: 'Ajuda',
    //   acao: onOpenHelp,
    //   visivel: Boolean(mostrarAjuda && onOpenHelp),
    // },
  ];
  const sublinksProcessos = [
    {
      tela: 'screen-processes',
      icone: 'view_list',
      label: 'Processos Seletivos',
      permissao: 'vagas.visualizar',
    },
    {
      tela: 'screen-processes-closed',
      icone: 'radio_button_checked',
      label: 'Processos encerrados',
      status: 'is-closed',
      permissao: 'vagas.visualizar',
    },
    {
      tela: 'screen-generated-exams',
      icone: 'assignment',
      label: 'Provas e Resultados',
      permissao: 'provas.visualizar',
    },
  ];
  const sublinksRelatorios = [
    {
      tela: 'screen-analysis-candidates',
      icone: 'bar_chart',
      label: 'Relatórios Gerais',
      permissao: 'relatorios.visualizar',
    },
    {
      tela: 'screen-candidates',
      icone: 'groups',
      label: 'Candidatos',
      permissao: 'candidatos.visualizar',
      telasRelacionadas: ['screen-candidate-details', 'screen-candidate-pipeline'],
    },
  ];
  const sublinksConfiguracoes = [
    {
      tela: 'screen-settings-users',
      icone: 'person',
      label: 'Usuários',
      permissao: 'usuarios.visualizar',
    },
    {
      tela: 'screen-settings-profiles',
      icone: 'admin_panel_settings',
      label: 'Perfis e permissões',
      permissao: 'configuracoes.visualizar',
    },
    {
      tela: 'screen-settings-logs',
      icone: 'history_edu',
      label: 'Logs',
      permissao: 'logs.visualizar',
    },
  ];
  const telasRelacionadasProcessos = [
    'screen-process-create',
    'screen-processes',
    'screen-processes-closed',
    'screen-process-decisions',
    'screen-process-details',
    'screen-generated-exams',
    'screen-process-analytical-results',
    'screen-history',
  ];
  const telasRelacionadasRelatorios = [
    'screen-analysis-candidates',
    'screen-candidates',
    'screen-candidate-details',
    'screen-candidate-pipeline',
  ];
  const telasRelacionadasConfiguracoes = [
    'screen-settings',
    'screen-settings-users',
    'screen-settings-profiles',
    'screen-settings-logs',
  ];
  const possuiPermissao = (permissao) =>
    !permissao || controlador?.possuiPermissao?.(permissao);
  const itemAtivo = (item) =>
    navAtiva === item.tela || (item.telasRelacionadas || []).includes(navAtiva);
  const grupoProcessosAtivo = telasRelacionadasProcessos.includes(navAtiva);
  const subitemProcessoAtivo = sublinksProcessos.some(
    (item) => item.tela === navAtiva,
  );
  const sublinksConfiguracoesVisiveis = sublinksConfiguracoes.filter((subitem) =>
    possuiPermissao(subitem.permissao),
  );
  const sublinksRelatoriosVisiveis = sublinksRelatorios.filter((subitem) =>
    possuiPermissao(subitem.permissao),
  );
  const grupoRelatoriosAtivo = telasRelacionadasRelatorios.includes(navAtiva);
  const subitemRelatorioAtivo = (subitem) =>
    navAtiva === subitem.tela || (subitem.telasRelacionadas || []).includes(navAtiva);
  const grupoConfiguracoesAtivo = telasRelacionadasConfiguracoes.includes(navAtiva);
  const subitemConfiguracaoAtivo = (subitem) =>
    navAtiva === subitem.tela ||
    (navAtiva === 'screen-settings' && subitem.tela === 'screen-settings-users');
  const [submenuProcessosAberto, setSubmenuProcessosAberto] =
    useState(grupoProcessosAtivo);
  const [submenuRelatoriosAberto, setSubmenuRelatoriosAberto] =
    useState(grupoRelatoriosAtivo);
  const [submenuConfiguracoesAberto, setSubmenuConfiguracoesAberto] =
    useState(grupoConfiguracoesAtivo);
  const [logoComErro, setLogoComErro] = useState(false);

  useEffect(() => {
    setSubmenuProcessosAberto(grupoProcessosAtivo);
  }, [navAtiva, grupoProcessosAtivo]);

  useEffect(() => {
    setSubmenuRelatoriosAberto(grupoRelatoriosAtivo);
  }, [navAtiva, grupoRelatoriosAtivo]);

  useEffect(() => {
    setSubmenuConfiguracoesAberto(grupoConfiguracoesAtivo);
  }, [navAtiva, grupoConfiguracoesAtivo]);

  const renderizarItem = (item) => {
    if (item.visivel === false || !possuiPermissao(item.permissao)) return null;
    const ativo = itemAtivo(item) && !item.acao;
    return html`
      <button
        key=${item.label}
        type="button"
        class=${`rh-modern-nav-btn ${ativo ? 'is-active' : ''}`.trim()}
        title=${item.label}
        aria-current=${ativo ? 'page' : null}
        onClick=${item.acao || (() => controlador.irParaTelaProtegida(item.tela))}
      >
        <span class="material-symbols-outlined" aria-hidden="true">
          ${item.icone}
        </span>
        <span class="rh-modern-nav-label">${item.label}</span>
      </button>
    `;
  };

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
          title=${subtituloMarca || 'Conecta'}
        >
          ${logoComErro
      ? html`
                <span class="rh-modern-logo-fallback">
                  <strong>Conecta</strong>
                  <span>Central 24h</span>
                </span>
              `
      : html`
                <img
                  alt="Conecta Central 24h"
                  class="rh-modern-logo"
                  src="/estilos/logo_conecta_branco_palavra.png"
                  onError=${() => setLogoComErro(true)}
                />
              `}
        </button>
      </div>

      <nav class="rh-modern-nav">
        <button
          type="button"
          class="rh-modern-nav-btn rh-modern-sidebar-toggle"
          aria-label=${recolhida ? 'Expandir menu lateral' : 'Recolher menu lateral'}
          title=${recolhida ? 'Expandir menu lateral' : 'Recolher menu lateral'}
          onClick=${() => controlador.alternarBarraLateral()}
        >
          <span class="material-symbols-outlined">
            ${recolhida ? 'chevron_right' : 'chevron_left'}
          </span>
          <span class="rh-modern-nav-label">${recolhida ? 'Expandir' : 'Recolher'}</span>
        </button>
        ${itensPrincipais.map(renderizarItem)}
        ${possuiPermissao('vagas.visualizar') || possuiPermissao('provas.visualizar')
      ? html`
              <div
                class=${`rh-modern-nav-group ${submenuProcessosAberto && !recolhida ? 'is-open' : ''
          } ${grupoProcessosAtivo ? 'has-active' : ''}`.trim()}
              >
                <button
                  type="button"
                  class=${`rh-modern-nav-btn rh-modern-nav-parent-btn ${(recolhida && grupoProcessosAtivo) ||
          (grupoProcessosAtivo && !subitemProcessoAtivo)
          ? 'is-active'
          : ''
          }`.trim()}
                  title="Recrutamento"
                  aria-expanded=${!recolhida && submenuProcessosAberto}
                  aria-controls="rh-modern-subnav-processos"
                  aria-current=${grupoProcessosAtivo && !subitemProcessoAtivo ? 'page' : null
        }
                  onClick=${() => {
          if (recolhida) {
            controlador.irParaTelaProtegida(
              possuiPermissao('vagas.visualizar')
                ? 'screen-processes'
                : 'screen-generated-exams',
            );
            return;
          }
          setSubmenuProcessosAberto((valor) => !valor);
        }}
                >
                  <span class="material-symbols-outlined" aria-hidden="true">
                    business_center
                  </span>
                  <span class="rh-modern-nav-label">Recrutamento</span>
                  <span
                    class="material-symbols-outlined rh-modern-nav-chevron"
                    aria-hidden="true"
                  >
                    expand_more
                  </span>
                </button>
                ${submenuProcessosAberto && !recolhida
          ? html`
                      <div
                        class="rh-modern-subnav"
                        id="rh-modern-subnav-processos"
                        role="group"
                        aria-label="Submenu de Recrutamento"
                      >
                        ${sublinksProcessos.filter((subitem) => possuiPermissao(subitem.permissao)).map(
            (subitem) => html`
                            <button
                              key=${subitem.tela}
                              type="button"
                              class=${`rh-modern-subnav-btn ${navAtiva === subitem.tela ? 'is-active' : ''
                } ${subitem.status || ''}`.trim()}
                              title=${subitem.label}
                              aria-current=${navAtiva === subitem.tela ? 'page' : null
              }
                              onClick=${() =>
                controlador.irParaTelaProtegida(subitem.tela)}
                            >
                              <span
                                class="material-symbols-outlined"
                                aria-hidden="true"
                              >
                                ${subitem.icone}
                              </span>
                              <span>${subitem.label}</span>
                            </button>
                          `,
          )}
                      </div>
                    `
          : null}
              </div>
            `
      : null}
        ${itensAposProcessos.map(renderizarItem)}
        ${sublinksRelatoriosVisiveis.length
      ? html`
              <div
                class=${`rh-modern-nav-group ${submenuRelatoriosAberto && !recolhida ? 'is-open' : ''
          } ${grupoRelatoriosAtivo ? 'has-active' : ''}`.trim()}
              >
                <button
                  type="button"
                  class=${`rh-modern-nav-btn rh-modern-nav-parent-btn ${recolhida && grupoRelatoriosAtivo ? 'is-active' : ''
          }`.trim()}
                  title="Relatórios"
                  aria-expanded=${!recolhida && submenuRelatoriosAberto}
                  aria-controls="rh-modern-subnav-relatorios"
                  onClick=${() => {
          if (recolhida) {
            controlador.irParaTelaProtegida(
              sublinksRelatoriosVisiveis[0]?.tela || 'screen-analysis-candidates',
            );
            return;
          }
          setSubmenuRelatoriosAberto((valor) => !valor);
        }}
                >
                  <span class="material-symbols-outlined" aria-hidden="true">
                    bar_chart
                  </span>
                  <span class="rh-modern-nav-label">Relatórios</span>
                  <span
                    class="material-symbols-outlined rh-modern-nav-chevron"
                    aria-hidden="true"
                  >
                    expand_more
                  </span>
                </button>
                ${submenuRelatoriosAberto && !recolhida
          ? html`
                      <div
                        class="rh-modern-subnav"
                        id="rh-modern-subnav-relatorios"
                        role="group"
                        aria-label="Submenu de Relatórios"
                      >
                        ${sublinksRelatoriosVisiveis.map(
            (subitem) => html`
                            <button
                              key=${subitem.tela}
                              type="button"
                              class=${`rh-modern-subnav-btn ${subitemRelatorioAtivo(subitem) ? 'is-active' : ''
                }`.trim()}
                              title=${subitem.label}
                              aria-current=${subitemRelatorioAtivo(subitem) ? 'page' : null
              }
                              onClick=${() =>
                controlador.irParaTelaProtegida(subitem.tela)}
                            >
                              <span
                                class="material-symbols-outlined"
                                aria-hidden="true"
                              >
                                ${subitem.icone}
                              </span>
                              <span>${subitem.label}</span>
                            </button>
                          `,
          )}
                      </div>
                    `
          : null}
              </div>
            `
      : null}
        ${sublinksConfiguracoesVisiveis.length
      ? html`
              <div
                class=${`rh-modern-nav-group ${submenuConfiguracoesAberto && !recolhida ? 'is-open' : ''
          } ${grupoConfiguracoesAtivo ? 'has-active' : ''}`.trim()}
              >
                <button
                  type="button"
                  class=${`rh-modern-nav-btn rh-modern-nav-parent-btn ${recolhida && grupoConfiguracoesAtivo ? 'is-active' : ''
          }`.trim()}
                  title="Configurações"
                  aria-expanded=${!recolhida && submenuConfiguracoesAberto}
                  aria-controls="rh-modern-subnav-configuracoes"
                  onClick=${() => {
          if (recolhida) {
            controlador.irParaTelaProtegida(
              sublinksConfiguracoesVisiveis[0]?.tela || 'screen-settings-users',
            );
            return;
          }
          setSubmenuConfiguracoesAberto((valor) => !valor);
        }}
                >
                  <span class="material-symbols-outlined" aria-hidden="true">
                    settings
                  </span>
                  <span class="rh-modern-nav-label">Configurações</span>
                  <span
                    class="material-symbols-outlined rh-modern-nav-chevron"
                    aria-hidden="true"
                  >
                    expand_more
                  </span>
                </button>
                ${submenuConfiguracoesAberto && !recolhida
          ? html`
                      <div
                        class="rh-modern-subnav"
                        id="rh-modern-subnav-configuracoes"
                        role="group"
                        aria-label="Submenu de Configurações"
                      >
                        ${sublinksConfiguracoesVisiveis.map(
            (subitem) => html`
                            <button
                              key=${subitem.tela}
                              type="button"
                              class=${`rh-modern-subnav-btn ${subitemConfiguracaoAtivo(subitem) ? 'is-active' : ''
                }`.trim()}
                              title=${subitem.label}
                              aria-current=${subitemConfiguracaoAtivo(subitem) ? 'page' : null
              }
                              onClick=${() =>
                controlador.irParaTelaProtegida(subitem.tela)}
                            >
                              <span
                                class="material-symbols-outlined"
                                aria-hidden="true"
                              >
                                ${subitem.icone}
                              </span>
                              <span>${subitem.label}</span>
                            </button>
                          `,
          )}
                      </div>
                    `
          : null}
              </div>
            `
      : null}
      </nav>
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

export function CartaoUsuarioTopo({ controlador }) {
  const [aberto, setAberto] = useState(false);
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

  useEffect(() => {
    if (!aberto) return undefined;

    const fecharAoClicarFora = (event) => {
      if (event.target?.closest?.('.c24-user-menu-wrap')) return;
      setAberto(false);
    };
    const fecharNoEscape = (event) => {
      if (event.key === 'Escape') setAberto(false);
    };

    document.addEventListener('click', fecharAoClicarFora);
    document.addEventListener('keydown', fecharNoEscape);
    return () => {
      document.removeEventListener('click', fecharAoClicarFora);
      document.removeEventListener('keydown', fecharNoEscape);
    };
  }, [aberto]);

  return html`
    <div class="c24-user-menu-wrap">
      <button
        type="button"
        class="c24-user-menu"
        title="Perfil do usuário"
        aria-label=${`Abrir menu do perfil de ${nome}`}
        aria-haspopup="menu"
        aria-expanded=${aberto}
        onClick=${(event) => {
      event.stopPropagation();
      setAberto((valor) => !valor);
    }}
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
          ${aberto ? 'expand_less' : 'expand_more'}
        </span>
      </button>

      ${aberto
      ? html`
            <div class="c24-user-dropdown" role="menu">
              ${podeAbrirPerfil
          ? html`
                    <button
                      type="button"
                      role="menuitem"
                      class="c24-user-dropdown-item"
                      onClick=${() => {
              setAberto(false);
              controlador.irParaTelaProtegida('screen-settings');
            }}
                    >
                      <span class="material-symbols-outlined">settings</span>
                      Configurações
                    </button>
                  `
          : null}
              <button
                type="button"
                role="menuitem"
                class="c24-user-dropdown-item is-danger"
                onClick=${() => {
          setAberto(false);
          controlador.sair();
        }}
              >
                <span class="material-symbols-outlined">logout</span>
                Sair
              </button>
            </div>
          `
      : null}
    </div>
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
  const permissaoAcaoPrimaria = acaoPrimaria?.permissao;
  const permissoesAcaoPrimaria = Array.isArray(acaoPrimaria?.permissoes)
    ? acaoPrimaria.permissoes
    : [];
  const mostrarAcaoPrimaria =
    acaoPrimaria &&
    (!permissaoAcaoPrimaria && !permissoesAcaoPrimaria.length
      ? true
      : permissoesAcaoPrimaria.length
        ? controlador?.possuiAlgumaPermissao?.(...permissoesAcaoPrimaria)
        : controlador?.possuiPermissao?.(permissaoAcaoPrimaria));
  const abrirTour = () => setTourReopenSignal((valor) => valor + 1);
  const ambiente = String(window.RUNTIME_CONFIG?.APP_ENV || '').toLowerCase();
  const exibirAmbiente = ambiente === 'dev' || ambiente === 'hml';

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
          onOpenHelp=${abrirTour}
          mostrarAjuda=${Boolean(tour?.steps?.length)}
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
                      ${acaoPrimaria.icon
          ? html`<span class="material-symbols-outlined">${acaoPrimaria.icon}</span>`
          : null}
                      ${acaoPrimaria.label}
                    </button>
                  `
      : null}
              ${tour?.steps?.length
      ? html`
                    <${BotaoAjudaTour}
                      compact=${true}
                      label="Ver orientações"
                      onClick=${abrirTour}
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
