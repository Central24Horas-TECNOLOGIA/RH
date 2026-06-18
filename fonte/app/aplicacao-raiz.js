import { html, useEffect } from '../infraestrutura-react.js';
import {
  navegarParaTela,
  usarTelaAtual,
  useControladorAplicacao,
} from './controlador-aplicacao.js';
import {
  TelaAnaliseCandidatos,
  TelaBancoTalentos,
  TelaCriarProcesso,
  TelaCaixaEmail,
  TelaHistorico,
  TelaInicio,
  TelaLogin,
} from '../features/telas-gestao.js';
import {
  TelaDetalhesProcesso,
  TelaProcessos,
} from '../features/telas-processos.js';
import { TelaCandidatos } from '../features/candidatos/index.js';
import { TelaPipelineCandidatos } from '../features/tela-pipeline.js';
import { TelaEntrevistas } from '../features/tela-entrevistas.js';
import { TelaCandidaturaPublica } from '../features/public-candidacy/index.js';
import {
  TelaCandidato,
  TelaConfiguracao,
  TelaConclusao,
  TelaProva,
  TelaResultado,
} from '../features/telas-prova.js';

function resolverTelaProtegida(telaAtual, controlador) {
  const { estado, blueprint } = controlador;

  if (telaAtual === 'screen-public-candidacy') {
    return telaAtual;
  }

  if (!estado.autenticado) {
    return 'screen-login';
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

export function Aplicacao() {
  const controlador = useControladorAplicacao();
  const telaAtual = usarTelaAtual(controlador.estado.autenticado);
  const telaResolvida = resolverTelaProtegida(telaAtual, controlador);

  useEffect(() => {
    if (telaResolvida !== telaAtual) {
      navegarParaTela(telaResolvida);
    }
  }, [telaAtual, telaResolvida]);

  if (telaResolvida === 'screen-public-candidacy') {
    return html`<${TelaCandidaturaPublica} />`;
  }

  if (controlador.estado.validandoSessao) {
    return html`
      <section class="active screen" id="screen-loading">
        <div class="container py-5">
          <div class="alert alert-secondary mb-0">
            Validando sessao do usuario...
          </div>
        </div>
      </section>
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

  if (telaResolvida === 'screen-candidates') {
    return html`<${TelaCandidatos} controlador=${controlador} />`;
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

  if (telaResolvida === 'screen-analysis-candidates') {
    return html`<${TelaAnaliseCandidatos} controlador=${controlador} />`;
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
