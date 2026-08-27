import { html } from '../../infraestrutura-react.js';
import { PageIntro, PainelRh, SectionCard } from '../../ui/componentes-compartilhados.js';
import { AcaoSair } from '../../shared/components/actions.js';

const DIRETRIZES = [
  {
    tela: 'screen-settings-onboarding',
    icone: 'checklist',
    titulo: 'Trilhas de Onboarding',
    descricao: 'Módulos, conteúdos e ordem da trilha aplicada aos novos candidatos aprovados.',
    permissao: 'onboarding.editar',
  },
  {
    tela: 'screen-settings-disc',
    icone: 'insights',
    titulo: 'Teste DISC',
    descricao: 'Perguntas, perfis e critérios de avaliação do teste comportamental DISC.',
    permissao: 'provas.questoes_criar',
  },
  {
    tela: 'screen-settings-fit-cultural',
    icone: 'diversity_3',
    titulo: 'Fit Cultural',
    descricao: 'Afirmações e pesos usados para medir aderência cultural do candidato.',
    permissao: 'fit_cultural.editar',
  },
  {
    tela: 'screen-settings-raciocinio-logico',
    icone: 'psychology',
    titulo: 'Raciocínio Lógico',
    descricao: 'Banco de questões e parâmetros do teste de raciocínio lógico.',
    permissao: 'provas.questoes_criar',
  },
];

export function TelaProvasConfiguracao({ controlador }) {
  const diretrizesVisiveis = DIRETRIZES.filter(
    (item) => !item.permissao || controlador?.possuiPermissao?.(item.permissao),
  );

  return html`
    <${PainelRh}
      screenId="screen-provas-configuracao"
      navAtiva="screen-provas-configuracao"
      subtituloMarca="Configuração do Conecta Provas"
      placeholderBusca="Configuração de provas"
      controlador=${controlador}
      acoesTopo=${html`<${AcaoSair} controlador=${controlador} />`}
    >
      <${PageIntro}
        kicker="Conecta Provas"
        title="Configuração"
        description="Reúne as diretrizes complementares aplicadas durante o processo seletivo: onboarding, DISC, Fit Cultural e Raciocínio Lógico."
      />

      <${SectionCard} title="Diretrizes da prova" className="rh-section-card--flat">
        <div class="row g-3">
          ${diretrizesVisiveis.length
      ? diretrizesVisiveis.map(
        (item) => html`
                <div key=${item.tela} class="col-md-6">
                  <div class="rh-section-card rh-section-card--flat h-100 d-flex flex-column justify-content-between" style="padding:16px;">
                    <div class="d-flex align-items-start gap-3">
                      <span class="material-symbols-outlined" aria-hidden="true">${item.icone}</span>
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
                        Configurar
                        <span class="material-symbols-outlined" aria-hidden="true">arrow_forward</span>
                      </button>
                    </div>
                  </div>
                </div>
              `,
      )
      : html`<p class="text-muted mb-0">Você não possui permissão para configurar nenhuma diretriz de prova.</p>`}
        </div>
      </${SectionCard}>
    </${PainelRh}>
  `;
}
