import { React, createRoot, html } from './infraestrutura-react.js';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error) {
    console.error('Falha ao renderizar a aplicacao.', error);
  }

  render() {
    if (this.state.error) {
      return html`
        <section class="active screen" id="screen-bootstrap-error">
          <div class="container py-5">
            <div class="alert alert-danger mb-0">
              Nao foi possivel renderizar a interface principal. Verifique o console para mais detalhes.
            </div>
          </div>
        </section>
      `;
    }

    return this.props.children;
  }
}

function renderizarFalhaInicializacao(root, mensagem) {
  root.render(html`
    <section class="active screen" id="screen-bootstrap-error">
      <div class="container py-5">
        <div class="alert alert-danger mb-0">
          ${mensagem}
        </div>
      </div>
    </section>
  `);
}

const container = document.getElementById('app');
if (!container) {
  throw new Error('Elemento #app nao encontrado para montar a aplicacao.');
}

const root = createRoot(container);

async function iniciarAplicacao() {
  try {
    const { Aplicacao } = await import('./aplicacao.js');

    root.render(html`
      <${ErrorBoundary}>
        <${Aplicacao} />
      </${ErrorBoundary}>
    `);
  } catch (error) {
    console.error('Falha ao inicializar a aplicacao.', error);
    renderizarFalhaInicializacao(
      root,
      'Nao foi possivel inicializar a aplicacao. Verifique o console para mais detalhes.',
    );
  }
}

iniciarAplicacao();
