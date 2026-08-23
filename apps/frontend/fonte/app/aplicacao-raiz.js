import { html, lazy, Suspense, useEffect } from '../infraestrutura-react.js';
"Teste de commit - AplicaÃ§Ã£o Raiz";
import {
  navegarParaTela,
  usarTelaAtual,
  useControladorAplicacao,
} from './controlador-aplicacao.js';
import { LoadingState } from '../ui/componentes-compartilhados.js';

function carregarTela(importador, nomeExportado) {
  return lazy(() => importador().then((modulo) => ({ default: modulo[nomeExportado] })));
}

function TelaCarregando({
  titulo = 'Carregando tela',
  descricao = 'Aguarde: Carregando informações.',
}) {
  return html`
    <section class="active screen" id="screen-loading">
      <div class="container py-5">
        <${LoadingState}
          titulo=${titulo}
          descricao=${descricao}
        />
      </div>
    </section>
  `;
}

const importarGestao = () => import('../features/telas-gestao.js?v=20260716-microsoft-login-fallback');
const importarProcessos = () => import('../features/telas-processos.js');
const importarProva = () => import('../features/telas-prova.js');

const TelaAnaliseCandidatos = carregarTela(importarGestao, 'TelaAnaliseCandidatos');
const TelaBancoTalentos = carregarTela(importarGestao, 'TelaBancoTalentos');
const TelaCriarProcesso = carregarTela(importarGestao, 'TelaCriarProcesso');
const TelaCaixaEmail = carregarTela(importarGestao, 'TelaCaixaEmail');
const TelaHistorico = carregarTela(importarGestao, 'TelaHistorico');
const TelaInicio = carregarTela(importarGestao, 'TelaInicio');
const TelaLogin = carregarTela(importarGestao, 'TelaLogin');
const TelaDetalhesProcesso = carregarTela(importarProcessos, 'TelaDetalhesProcesso');
const TelaProcessosDecisoesPendentes = carregarTela(importarProcessos, 'TelaProcessosDecisoesPendentes');
const TelaProcessosEncerrados = carregarTela(importarProcessos, 'TelaProcessosEncerrados');
const TelaProcessos = carregarTela(importarProcessos, 'TelaProcessos');
const TelaCandidatos = carregarTela(() => import('../features/candidatos/index.js'), 'TelaCandidatos');
const TelaDetalhesCandidato = carregarTela(() => import('../features/candidatos/index.js'), 'TelaDetalhesCandidato');
const TelaPipelineCandidatos = carregarTela(() => import('../features/tela-pipeline.js'), 'TelaPipelineCandidatos');
const TelaEntrevistas = carregarTela(() => import('../features/tela-entrevistas.js'), 'TelaEntrevistas');
const TelaDocumentosRh = carregarTela(() => import('../features/documentos-rh/index.js'), 'TelaDocumentosRh');
const TelaCandidaturaPublica = carregarTela(() => import('../features/public-candidacy/index.js'), 'TelaCandidaturaPublica');
const TelaConectaProvas = carregarTela(() => import('../features/conecta-provas/index.js?v=20260721-exam-analytics-2'), 'TelaConectaProvas');
const TelaProvasResultados = carregarTela(() => import('../features/provas-geradas/index.js'), 'TelaProvasResultados');
const TelaResultadosAnaliticosProcesso = carregarTela(
  () => import('../features/resultados-analiticos/index.js?v=20260721-exam-analytics-2'),
  'TelaResultadosAnaliticosProcesso',
);
const TelaConfiguracoesSistema = carregarTela(
  () => import('../features/configuracoes/index.js?v=20260713-config-users-fix7'),
  'TelaConfiguracoesSistema',
);
const TelaCandidato = carregarTela(importarProva, 'TelaCandidato');
const TelaConfiguracao = carregarTela(importarProva, 'TelaConfiguracao');
const TelaConclusao = carregarTela(importarProva, 'TelaConclusao');
const TelaProva = carregarTela(importarProva, 'TelaProva');
const TelaResultado = carregarTela(importarProva, 'TelaResultado');

function resolverTelaProtegida(telaAtual, controlador) {
  const { estado, blueprint } = controlador;

  if (telaAtual === 'screen-public-candidacy' || telaAtual === 'screen-conecta-provas') {
    return telaAtual;
  }

  if (telaAtual === 'screen-forbidden') {
    return telaAtual;
  }

  if (!estado.autenticado) {
    return 'screen-login';
  }

  if (telaAtual === 'screen-processes-open') {
    return 'screen-processes';
  }

  if (!controlador.podeAcessarTela(telaAtual)) {
    return 'screen-forbidden';
  }

  if (
    estado.provaFinalizada &&
    !estado.acessoRhLiberadoAposProva &&
    telaAtual !== 'screen-thanks'
  ) {
    return 'screen-thanks';
  }

  if (telaAtual === 'screen-login') {
    return 'screen-menu';
  }

  if (telaAtual === 'screen-candidate' && !blueprint) {
    return 'screen-config';
  }

  if (telaAtual === 'screen-exam' && !estado.questoes.length) {
    return estado.candidato.role ? 'screen-candidate' : 'screen-config';
  }

  if (
    (telaAtual === 'screen-thanks' || telaAtual === 'screen-result') &&
    !estado.provaFinalizada
  ) {
    if (estado.questoes.length) {
      return 'screen-exam';
    }
    return 'screen-menu';
  }

  return telaAtual;
}

function ConteudoAplicacao() {
  const controlador = useControladorAplicacao();
  const telaAtual = usarTelaAtual(controlador.estado.autenticado);
  const telaResolvida = resolverTelaProtegida(telaAtual, controlador);

  useEffect(() => {
    if (telaResolvida !== telaAtual) {
      navegarParaTela(telaResolvida, {
        replace: telaResolvida === 'screen-login',
      });
    }
  }, [telaAtual, telaResolvida]);

  if (telaResolvida === 'screen-public-candidacy') {
    return html`<${TelaCandidaturaPublica} />`;
  }

  if (telaResolvida === 'screen-conecta-provas') {
    return html`<${TelaConectaProvas} />`;
  }

  if (controlador.estado.validandoSessao) {
    return html`
      <${TelaCarregando}
        titulo="Validando sessão"
        descricao="Confirmando seu acesso antes de abrir o painel."
      />
    `;
  }

  if (!controlador.estado.autenticado || telaResolvida === 'screen-login') {
    return html`<${TelaLogin} controlador=${controlador} />`;
  }

  if (telaResolvida === 'screen-menu') {
    return html`<${TelaInicio} controlador=${controlador} />`;
  }

  if (telaResolvida === 'screen-email-inbox') {
    return html`<${TelaCaixaEmail} controlador=${controlador} />`;
  }

  if (telaResolvida === 'screen-history') {
    return html`<${TelaHistorico} controlador=${controlador} />`;
  }

  if (telaResolvida === 'screen-process-create') {
    return html`<${TelaCriarProcesso} controlador=${controlador} />`;
  }

  if (telaResolvida === 'screen-processes') {
    return html`<${TelaProcessos} controlador=${controlador} />`;
  }

  if (telaResolvida === 'screen-processes-closed') {
    return html`<${TelaProcessosEncerrados} controlador=${controlador} />`;
  }

  if (telaResolvida === 'screen-process-decisions') {
    return html`<${TelaProcessosDecisoesPendentes} controlador=${controlador} />`;
  }

  if (telaResolvida === 'screen-candidates') {
    return html`<${TelaCandidatos} controlador=${controlador} />`;
  }

  if (telaResolvida === 'screen-candidate-details') {
    return html`<${TelaDetalhesCandidato} controlador=${controlador} />`;
  }

  if (telaResolvida === 'screen-candidate-pipeline') {
    return html`<${TelaPipelineCandidatos} controlador=${controlador} />`;
  }

  if (telaResolvida === 'screen-process-details') {
    return html`<${TelaDetalhesProcesso} controlador=${controlador} />`;
  }

  if (telaResolvida === 'screen-interviews') {
    return html`<${TelaEntrevistas} controlador=${controlador} />`;
  }

  if (telaResolvida === 'screen-talent-bank') {
    return html`<${TelaBancoTalentos} controlador=${controlador} />`;
  }

  if (telaResolvida === 'screen-documents') {
    return html`<${TelaDocumentosRh} controlador=${controlador} />`;
  }

  if (telaResolvida === 'screen-analysis-candidates') {
    return html`<${TelaAnaliseCandidatos} controlador=${controlador} />`;
  }

  if (
    telaResolvida === 'screen-settings' ||
    telaResolvida === 'screen-settings-users' ||
    telaResolvida === 'screen-settings-profiles' ||
    telaResolvida === 'screen-settings-logs'
  ) {
    return html`
      <${TelaConfiguracoesSistema}
        controlador=${controlador}
        telaAtual=${telaResolvida}
      />
    `;
  }

  if (telaResolvida === 'screen-generated-exams') {
    return html`<${TelaProvasResultados} controlador=${controlador} />`;
  }

  if (telaResolvida === 'screen-process-analytical-results') {
    return html`<${TelaResultadosAnaliticosProcesso} controlador=${controlador} />`;
  }

  if (telaResolvida === 'screen-forbidden') {
    return html`
      <section class="active screen" id="screen-forbidden">
        <div class="container py-5">
          <div class="alert alert-warning mb-3">
            ${controlador.estado.avisoAcessoNegado ||
      'Você não possui permissão para acessar esta área ou executar esta ação.'}
          </div>
          <button
            type="button"
            class="btn btn-primary"
            onClick=${() => controlador.irParaMenu()}
          >
            Voltar ao painel
          </button>
        </div>
      </section>
    `;
  }

  if (telaResolvida === 'screen-config') {
    return html`<${TelaConfiguracao} controlador=${controlador} />`;
  }

  if (telaResolvida === 'screen-candidate') {
    return html`<${TelaCandidato} controlador=${controlador} />`;
  }

  if (telaResolvida === 'screen-exam') {
    return html`<${TelaProva} controlador=${controlador} />`;
  }

  if (telaResolvida === 'screen-thanks') {
    return html`<${TelaConclusao} controlador=${controlador} />`;
  }

  return html`<${TelaResultado} controlador=${controlador} />`;
}

export function Aplicacao() {
  return html`
    <${Suspense} fallback=${html`<${TelaCarregando} />`}>
      <${ConteudoAplicacao} />
    </${Suspense}>
  `;
}
