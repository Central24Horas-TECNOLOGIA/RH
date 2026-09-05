import { html } from '../../infraestrutura-react.js';
import { PageIntro, PainelRh, SectionCard } from '../../ui/componentes-compartilhados.js';
import { AcaoSair } from '../../shared/components/actions.js';
import { IconeSvg } from '../../ui/icone.js';

const MODULOS_DISPONIVEIS = [
  {
    tela: 'screen-settings-users',
    icone: 'person',
    titulo: 'Usuários',
    descricao: 'Criação de usuários, vínculo com operação e nível de acesso.',
    permissao: 'usuarios.visualizar',
  },
  {
    tela: 'screen-settings-profiles',
    icone: 'admin_panel_settings',
    titulo: 'Perfis e permissões',
    descricao: 'Regras de acesso por perfil (Administrador, Gestor, RH, Supervisor).',
    permissao: 'configuracoes.visualizar',
  },
  {
    tela: 'screen-settings-operations',
    icone: 'apartment',
    titulo: 'Operações',
    descricao: 'Cadastro de operações e produtos usados em processos, provas e treinamentos.',
    permissao: 'configuracoes.visualizar',
  },
  {
    tela: 'screen-settings-catalog',
    icone: 'inventory_2',
    titulo: 'Catálogos',
    descricao: 'Listas e regras reutilizáveis do sistema (motivos, status, modelos de e-mail).',
    permissao: 'configuracoes.visualizar',
  },
  {
    tela: 'screen-settings-logs',
    icone: 'history_edu',
    titulo: 'Logs',
    descricao: 'Trilha de auditoria das ações realizadas no Conecta.',
    permissao: 'logs.visualizar',
  },
];

export function TelaAdministracao({ controlador }) {
  const modulosVisiveis = MODULOS_DISPONIVEIS.filter(
    (item) => !item.permissao || controlador?.possuiPermissao?.(item.permissao),
  );

  return html`
    <${PainelRh}
      screenId="screen-settings-administracao"
      navAtiva="screen-settings-administracao"
      subtituloMarca="Administração do Conecta"
      placeholderBusca="Administração"
      controlador=${controlador}
      acoesTopo=${html`<${AcaoSair} controlador=${controlador} />`}
    >
      <${PageIntro}
        kicker="Configurações"
        title="Administração"
        description="Controle de nível global do Conecta: cadastro de operações, credenciais de acesso ao sistema, usuários e regras. Diferente da visão de Gestor, aqui a atuação é sobre a plataforma como um todo."
      />

      <${SectionCard} title="Módulos administrativos" className="rh-section-card--flat">
        <div class="row g-3">
          ${modulosVisiveis.length
      ? modulosVisiveis.map(
        (item) => html`
                <div key=${item.tela} class="col-md-6">
                  <div class="rh-section-card rh-section-card--flat h-100 d-flex flex-column justify-content-between" style=${{ padding: '16px' }}>
                    <div class="d-flex align-items-start gap-3">
                      <span class="material-symbols-outlined" aria-hidden="true">${IconeSvg(item.icone)}</span>
                      <div>
                        <h3 class="h6 mb-1">${item.titulo}</h3>
                        <p class="rh-section-card-description mb-0">${item.descricao}</p>
                      </div>
                    </div>
                    <div class="mt-3">
                      <button
                        type="button"
                        class="btn btn-outline-secondary btn-sm"
                        onClick=${() => controlador.irParaTelaProtegida(item.tela)}
                      >
                        Abrir
                        <span class="material-symbols-outlined" aria-hidden="true">${IconeSvg('arrow_forward')}</span>
                      </button>
                    </div>
                  </div>
                </div>
              `,
      )
      : html`<p class="text-muted mb-0">Você não possui permissão para acessar módulos administrativos.</p>`}
        </div>
      </${SectionCard}>

      <${SectionCard} title="Em construção" className="rh-section-card--flat">
        <p class="mb-2">
          As próximas frentes desta área (cadastro completo de operação e produto refletindo em todo
          o sistema, regras globais e níveis de administrador dedicados) estão no roadmap aprovado
          pelo RH e serão adicionadas aqui em etapas.
        </p>
        <p class="mb-0 text-muted">
          Por segurança, credenciais de infraestrutura (chaves de API, senhas do arquivo <code>.env</code>)
          não ficam editáveis por nenhuma tela — permanecem restritas ao ambiente do servidor.
        </p>
      </${SectionCard}>
    </${PainelRh}>
  `;
}
