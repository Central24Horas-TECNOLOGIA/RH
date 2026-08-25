import { html } from '../../infraestrutura-react.js';
import {
  EmptyState,
  PageIntro,
  PainelRh,
  SectionCard,
} from '../../ui/componentes-compartilhados.js';
import { AcaoSair } from '../../shared/components/actions.js';

export function TelaTreinamentos({ controlador }) {
  return html`
    <${PainelRh}
      screenId="screen-training"
      navAtiva="screen-training"
      subtituloMarca="Treinamentos"
      placeholderBusca="Treinamentos"
      controlador=${controlador}
      acoesTopo=${html`<${AcaoSair} controlador=${controlador} />`}
    >
      <${PageIntro}
        kicker="Processos"
        title="Treinamentos"
        description="Trilhas de capacitação e treinamentos para os times de recrutamento e seleção."
      />

      <${SectionCard} className="rh-section-card--flat">
        <${EmptyState}
          title="Em breve..."
          text="Esta área ainda está sendo construída. Em breve você poderá acompanhar treinamentos por aqui."
        />
      </${SectionCard}>
    </${PainelRh}>
  `;
}
