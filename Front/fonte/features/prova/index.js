import { html, useEffect, useMemo, useState } from '../infraestrutura-react.js';
import {
  SUGESTOES_NIVEL_POR_VAGA,
  resolverBlueprintProva,
} from '../../perguntas.js';
import { lerProcessos, navegarParaTela } from '../../app/controlador-aplicacao.js';
import {
  formatarNotaVisual,
  formatarTempoRestante,
  montarDescricaoFluxo,
  obterClasseEtapaResultado,
} from '../../shared/helpers-visuais.js';
import { AcaoSair } from '../../shared/components/actions.js';
import {
  EditorTextoRich,
  EmptyState,
  MetricGrid,
  ModalPadrao,
  PageIntro,
  PainelRh,
  PerguntaExcel,
  PerguntaMultipla,
  SectionCard,
} from '../../ui/componentes-compartilhados.js';
import { CHAVE_REQUISITO_BUSCA } from '../../ui/busca-global.js';

export function TelaConfiguracao({ controlador }) {
  const [processosAbertos, setProcessosAbertos] = useState([]);
  const [erro, setErro] = useState('');
  const [requisitoBuscado, setRequisitoBuscado] = useState(null);
  const [formulario, setFormulario] = useState(() => ({
    processo:
      controlador.estado.processoSelecionado ||
      (controlador.estado.candidato.id_processo
        ? controlador.estado.candidato.id_processo
        : ''),
    vaga: controlador.estado.candidato.role || '',
    nivel: controlador.estado.candidato.level || '',
    trilha:
      controlador.estado.candidato.track &&
      controlador.estado.candidato.track !== 'automatico'
        ? controlador.estado.candidato.track
        : '',
    tempo: controlador.estado.candidato.time || 40,
  }));

  useEffect(() => {
    (async () => {
      try {
        const lista = await lerProcessos(true);
        const abertos = (Array.isArray(lista) ? lista : []).filter(
          (processo) => String(processo.status || '').trim() !== 'Encerrado',
        );
        setProcessosAbertos(abertos);
      } catch (error) {
        setErro(
          error?.message ||
            'Nao foi possivel carregar os processos seletivos abertos.',
        );
      }
    })();
  }, []);

  useEffect(() => {
    try {
      const bruto = sessionStorage.getItem(CHAVE_REQUISITO_BUSCA);
      if (!bruto) return;

      setRequisitoBuscado(JSON.parse(bruto));
      sessionStorage.removeItem(CHAVE_REQUISITO_BUSCA);
    } catch (error) {
      sessionStorage.removeItem(CHAVE_REQUISITO_BUSCA);
    }
  }, []);

  useEffect(() => {
    const nivelSugerido = SUGESTOES_NIVEL_POR_VAGA[formulario.vaga];
    if (nivelSugerido && !formulario.nivel) {
      setFormulario((anterior) => ({ ...anterior, nivel: nivelSugerido }));
    }
  }, [formulario.vaga, formulario.nivel]);

  const blueprint = useMemo(() => {
    if (!formulario.vaga || !formulario.nivel) return null;
    return resolverBlueprintProva(
      formulario.vaga,
      formulario.nivel,
      formulario.trilha || '',
    );
  }, [formulario]);

  const prosseguir = () => {
    if (!formulario.vaga || !formulario.nivel || !formulario.tempo) {
      setErro('Preencha os campos da configuracao para prosseguir.');
      return;
    }

    if (!formulario.processo) {
      setErro('Selecione o processo seletivo para prosseguir.');
      return;
    }

    setErro('');
    controlador.configurarFluxo({
      role: formulario.vaga,
      level: formulario.nivel,
      track: formulario.trilha || '',
      time: Number(formulario.tempo),
      processId: formulario.processo,
    });
  };

  return html`
    <${PainelRh}
      screenId="screen-config"
      navAtiva="screen-config"
      subtituloMarca="Configuracao da prova"
      placeholderBusca="Configuracao do fluxo da prova"
      controlador=${controlador}
      acaoPrimaria=${{
        label: 'Iniciar teste',
        onClick: () => controlador.iniciarNovoFluxo(),
      }}
      acoesTopo=${html`<${AcaoSair} controlador=${controlador} />`}
    >
      <${PageIntro}
        kicker="Console • Configuracao"
        title="Configuracao da prova"
        description="Selecione perfil, nivel, trilha e processo sem alterar o roteamento hash nem a integracao existente."
      />

      ${
        requisitoBuscado
          ? html`
            <${SectionCard}
              title="Requisito localizado na busca"
              description=${`${requisitoBuscado.blueprintLabel || 'Blueprint'} • ${requisitoBuscado.stageLabel || 'Etapa'}`}
            >
              <div class="rh-inline-alert mb-0">
                <strong>${requisitoBuscado.titulo || 'Requisito'}</strong>
                <div>${requisitoBuscado.descricao || 'Sem descricao adicional.'}</div>
              </div>
            </${SectionCard}>
          `
          : null
      }

      <${SectionCard}
        title="Parametros da avaliacao"
        description="Todos os campos abaixo alimentam o mesmo estado global ja utilizado pelo sistema."
        tourId="config-parameters"
      >
        <div class="row g-3">
          <div class="col-md-6">
            <label class="form-label">Processo seletivo</label>
            <select
              class="form-select rh-flow-input"
              value=${formulario.processo}
              onChange=${(event) =>
                setFormulario({ ...formulario, processo: event.target.value })}
            >
              <option value="">Selecione...</option>
              <option value="PROCESSO_UNICO">Processo unico</option>
              ${processosAbertos.map(
                (processo) => html`
                  <option
                    key=${processo.id_processo}
                    value=${processo.id_processo}
                  >
                    ${`${processo.id_processo} • ${processo.vaga} • ${processo.operacao || processo.trilha || '-'} • ${processo.data_encerramento || '-'}`}
                  </option>
                `,
              )}
            </select>
          </div>

          <div class="col-md-6">
            <label class="form-label">Perfil da vaga</label>
            <select
              class="form-select rh-flow-input"
              value=${formulario.vaga}
              onChange=${(event) =>
                setFormulario({ ...formulario, vaga: event.target.value })}
            >
              <option value="">Selecione...</option>
              <option>Jovem Aprendiz</option>
              <option>Operador</option>
              <option>Estagiario</option>
              <option>Supervisor</option>
              <option>Control Desk</option>
              <option>Planejamento</option>
              <option>TI</option>
              <option>Analista</option>
              <option>Outros</option>
            </select>
          </div>

          <div class="col-md-6">
            <label class="form-label">Nivel da prova</label>
            <select
              class="form-select rh-flow-input"
              value=${formulario.nivel}
              onChange=${(event) =>
                setFormulario({ ...formulario, nivel: event.target.value })}
            >
              <option value="">Selecione...</option>
              <option value="1">Nivel 1 - Jovem Aprendiz</option>
              <option value="2">Nivel 2 - Operador / Estagiario</option>
              <option value="3">
                Nivel 3 - Supervisor / Control Desk / Planejamento
              </option>
              <option value="4">Nivel 4 - TI / Analista / Outros</option>
            </select>
          </div>

          <div class="col-md-6">
            <label class="form-label">Area / Trilha</label>
            <select
              class="form-select rh-flow-input"
              value=${formulario.trilha}
              onChange=${(event) =>
                setFormulario({ ...formulario, trilha: event.target.value })}
            >
              <option value="">Automatico</option>
              <option value="operacao">Operacao</option>
              <option value="ti">TI</option>
              <option value="rh">RH</option>
              <option value="adm">ADM / Gestao</option>
            </select>
          </div>

          <div class="col-md-6">
            <label class="form-label">Tempo total (minutos)</label>
            <input
              class="form-control rh-flow-input"
              type="number"
              min="5"
              max="180"
              value=${formulario.tempo}
              onInput=${(event) =>
                setFormulario({ ...formulario, tempo: event.target.value })}
            />
          </div>
        </div>

        <div class="rh-flow-preview mt-4">
          <div class="rh-flow-preview-icon">
            <span class="material-symbols-outlined">info</span>
          </div>
          <div>
            <div class="fw-semibold mb-1">
              ${blueprint?.label || 'Fluxo que sera aplicado'}
            </div>
            <div class="text-muted small">${montarDescricaoFluxo(blueprint)}</div>
          </div>
        </div>

        ${erro ? html`<div class="alert alert-danger mt-4">${erro}</div>` : null}

        <div class="rh-form-footer">
          <button
            type="button"
            class="btn btn-outline-secondary"
            onClick=${() => controlador.irParaMenu()}
          >
            Voltar ao menu
          </button>
          <button
            type="button"
            class="btn btn-success btn-lg"
            onClick=${prosseguir}
          >
            Prosseguir
          </button>
        </div>
      </${SectionCard}>
    </${PainelRh}>
  `;
}

export function TelaCandidato({ controlador }) {
  const [nome, setNome] = useState(controlador.estado.candidato.name || '');
  const [erro, setErro] = useState('');

  useEffect(() => {
    setNome(controlador.estado.candidato.name || '');
  }, [controlador.estado.candidato.name]);

  const iniciar = () => {
    controlador.atualizarNomeCandidato(nome);
    const resultado = controlador.iniciarProva(nome);
    if (!resultado.ok) {
      setErro(resultado.mensagem);
      return;
    }
    setErro('');
  };

  return html`
    <section class="active screen" id="screen-candidate">
      <div class="rh-standalone-page">
        <div class="rh-candidate-layout">
          <aside class="rh-candidate-side-card">
            <label
              class="form-label small text-uppercase fw-bold text-muted mb-2"
            >
              Nome completo
            </label>
            <div class="rh-candidate-name-shell">
              <input
                class="form-control rh-flow-input"
                placeholder="Ex: Joao Augusto da Silva"
                value=${nome}
                onInput=${(event) => {
                  setNome(event.target.value);
                  controlador.atualizarNomeCandidato(event.target.value);
                }}
                type="text"
              />
              <span class="material-symbols-outlined">badge</span>
            </div>

            <div class="rh-candidate-summary-card mt-4">
              <h3 class="h6 fw-bold mb-3">Etapas e criterios</h3>
              <ul class="candidate-summary-list">
                ${(controlador.regrasCandidato || []).map(
                  (item) => html`
                    <li key=${item.key}>
                      <strong>${item.label}</strong>
                      <span>${item.description}</span>
                    </li>
                  `,
                )}
              </ul>
            </div>
          </aside>

          <section class="rh-candidate-main-card">
            <h2 class="h3 fw-bold mb-2">Instrucoes ao candidato</h2>
            <p class="text-muted mb-4">
              Leia atentamente as orientacoes antes de iniciar a prova.
            </p>

            <div class="rh-instruction-grid">
              <article class="rh-instruction-card">
                <h3>Antes de comecar</h3>
                <ul class="rules-list">
                  <li>Leia atentamente cada questao.</li>
                  <li>
                    Em exercicios de Excel, baixe o arquivo e envie a versao
                    respondida.
                  </li>
                  <li>
                    O sistema registra automaticamente o andamento da prova.
                  </li>
                  <li>Revise as respostas sempre que possivel.</li>
                </ul>
              </article>
              <article class="rh-instruction-card">
                <h3>Durante a prova</h3>
                <ul class="rules-list">
                  <li>
                    Algumas etapas avaliam pratica, raciocinio e organizacao.
                  </li>
                  <li>O cronometro segue o tempo configurado pelo RH.</li>
                  <li>
                    Ao finalizar, o resultado fica disponivel para analise
                    interna.
                  </li>
                  <li>
                    Se houver dificuldade tecnica, avise o responsavel pela
                    aplicacao.
                  </li>
                </ul>
              </article>
            </div>

            ${erro
              ? html`<div class="alert alert-danger mt-4">${erro}</div>`
              : null}

            <div class="rh-candidate-footer">
              <div class="rh-candidate-disclaimer">
                <span class="material-symbols-outlined">info</span>
                <span>
                  Ao iniciar, voce confirma que leu e concorda com as
                  orientacoes da avaliacao.
                </span>
              </div>
              <div class="d-flex gap-2 flex-wrap">
                <button
                  type="button"
                  class="btn btn-outline-secondary"
                  onClick=${() =>
                    controlador.irParaTelaProtegida('screen-config')}
                >
                  Voltar
                </button>
                <button
                  type="button"
                  class="btn btn-success btn-lg"
                  onClick=${iniciar}
                >
                  Iniciar prova
                </button>
              </div>
            </div>
          </section>
        </div>
      </div>
    </section>
  `;
}

export function TelaProva({ controlador }) {
  const [confirmarEncerramento, setConfirmarEncerramento] = useState(false);
  const indiceAtual = controlador.estado.indiceAtual;
  const questaoAtual = controlador.estado.questoes[indiceAtual];
  const respostaAtual = controlador.estado.respostas[indiceAtual] || null;

  if (!questaoAtual) {
    return html`
      <section class="active screen" id="screen-exam">
        <div class="container py-5">
          <div class="alert alert-warning mb-0">
            Nenhuma questao foi carregada para esta prova.
          </div>
        </div>
      </section>
    `;
  }

  const progresso =
    ((indiceAtual + 1) / Math.max(1, controlador.estado.questoes.length)) * 100;

  const voltar = () => {
    if (indiceAtual > 0) {
      controlador.definirIndiceAtual(indiceAtual - 1);
    }
  };

  const avancar = () => {
    if (indiceAtual < controlador.estado.questoes.length - 1) {
      controlador.definirIndiceAtual(indiceAtual + 1);
      return;
    }

    controlador.encerrarProva('Finalizado');
  };

  const atualizarRespostaDiscursiva = (conteudo) =>
    controlador.atualizarResposta(indiceAtual, {
      type: 'word',
      content: conteudo,
    });

  const atualizarRespostaObjetiva = (selected) =>
    controlador.atualizarResposta(indiceAtual, {
      type: 'multiple',
      selected,
    });

  return html`
    <section class="active screen" id="screen-exam">
      <${ModalPadrao}
        aberto=${confirmarEncerramento}
        titulo="Confirmar encerramento"
        subtitulo="Tem certeza de que deseja encerrar a prova agora?"
        onClose=${() => setConfirmarEncerramento(false)}
      >
        <div class="rh-details-body">
          <div class="alert alert-warning mb-0">
            Ao confirmar, a prova sera finalizada imediatamente e o candidato seguira para a tela de conclusao.
          </div>
        </div>
        <footer class="rh-modal-footer">
          <button
            type="button"
            class="btn btn-outline-secondary"
            onClick=${() => setConfirmarEncerramento(false)}
          >
            Continuar prova
          </button>
          <button
            type="button"
            class="btn btn-danger"
            onClick=${() => {
              setConfirmarEncerramento(false);
              controlador.encerrarProva('Encerrado pelo candidato');
            }}
          >
            Encerrar prova
          </button>
        </footer>
      </${ModalPadrao}>

      <div class="exam-screen-shell">
        <header class="exam-screen-header">
          <div class="exam-screen-header-inner">
            <div class="exam-screen-brand">
              <img
                alt="Conecta C24h"
                class="exam-screen-logo"
                src="estilos/logo-conecta-c24h.png"
              />
              <div class="exam-screen-brand-copy">
                <span class="exam-screen-caption">Prova em andamento</span>
                <div class="exam-screen-candidate">
                  Candidato:
                  <strong>${controlador.estado.candidato.name || ''}</strong>
                </div>
              </div>
            </div>

            <div class="exam-screen-toolbar">
              <span class="exam-stage-badge">${questaoAtual.stage}</span>
              <div class="exam-timer-shell">
                <span class="material-symbols-outlined">timer</span>
                <div>${formatarTempoRestante(controlador.estado.segundosRestantes)}</div>
              </div>
            </div>
          </div>

          <div class="exam-progress-track">
            <div
              class="exam-progress-fill"
              style=${{ width: `${progresso}%` }}
            ></div>
          </div>
        </header>

        <div class="exam-screen-content">
          <div class="exam-question-card">
            <span class="exam-question-kicker">
              ${`Questao ${indiceAtual + 1} de ${controlador.estado.questoes.length}`}
            </span>
            <h3 class="exam-question-title">${questaoAtual.title}</h3>
            <p class="exam-question-description">${questaoAtual.description}</p>
          </div>

          <div class="exam-dynamic-area">
            ${
              questaoAtual.type === 'word'
                ? html`
                    <${EditorTextoRich}
                      valor=${respostaAtual?.content || ''}
                      onChange=${atualizarRespostaDiscursiva}
                    />
                  `
                : null
            }
            ${
              questaoAtual.type === 'multiple'
                ? html`
                    <${PerguntaMultipla}
                      questao=${questaoAtual}
                      resposta=${respostaAtual}
                      onChange=${atualizarRespostaObjetiva}
                    />
                  `
                : null
            }
            ${
              questaoAtual.type === 'excel_external'
                ? html`
                    <${PerguntaExcel}
                      questao=${questaoAtual}
                      resposta=${respostaAtual}
                      nomeCandidato=${controlador.estado.candidato.name}
                      onChange=${(resposta) =>
                        controlador.atualizarResposta(indiceAtual, resposta)}
                    />
                  `
                : null
            }
          </div>
        </div>

        <footer class="exam-screen-footer">
          <div class="exam-screen-footer-actions">
            <button
              type="button"
              class="btn exam-nav-btn exam-nav-btn-secondary"
              disabled=${indiceAtual === 0}
              onClick=${voltar}
            >
              Anterior
            </button>
          </div>

          <div class="exam-screen-footer-actions">
            <button
              type="button"
              class="btn exam-nav-btn exam-nav-btn-danger"
              onClick=${() => setConfirmarEncerramento(true)}
            >
              Encerrar agora
            </button>
            <button
              type="button"
              class="btn exam-nav-btn exam-nav-btn-primary"
              onClick=${avancar}
            >
              ${
                indiceAtual === controlador.estado.questoes.length - 1
                  ? 'Finalizar'
                  : 'Proxima'
              }
            </button>
          </div>
        </footer>
      </div>
    </section>
  `;
}

export function TelaConclusao({ controlador }) {
  const [alertaSalvar, setAlertaSalvar] = useState('');
  const [tipoSalvar, setTipoSalvar] = useState('info');

  useEffect(() => {
    if (controlador.estado.resultadoSalvo) {
      setTipoSalvar('success');
      setAlertaSalvar('Resultado salvo com sucesso.');
    }
  }, [controlador.estado.resultadoSalvo]);

  const salvar = async () => {
    setTipoSalvar('info');
    setAlertaSalvar('Salvando resultado no sistema...');

    const retorno = await controlador.salvarResultado();
    if (!retorno?.ok) {
      setTipoSalvar('danger');
      setAlertaSalvar(
        retorno?.mensagem ||
          'Nao foi possivel salvar a prova no servidor. Verifique a API e tente novamente.',
      );
      return;
    }

    setTipoSalvar('success');
    setAlertaSalvar('Resultado salvo com sucesso.');
  };

  const acessarResultado = () => {
    navegarParaTela('screen-result');
  };

  return html`
    <section class="active screen" id="screen-thanks">
      <div class="rh-finish-screen">
        <div class="rh-finish-shell">
          <div class="rh-finish-badge">Concluido</div>
          <div class="rh-finish-icon-wrap">
            <div class="rh-finish-icon">OK</div>
          </div>
          <h2 class="rh-finish-title">Avaliacao finalizada com sucesso</h2>
          <p class="rh-finish-subtitle">
            A prova foi encerrada e o resultado pode ser salvo no sistema para
            registro definitivo.
          </p>

          <div class="rh-finish-info-grid">
            <article
              class="rh-finish-info-card rh-finish-info-card-save is-required"
            >
              <div class="rh-finish-info-icon is-blue">
                <span class="material-symbols-outlined">task_alt</span>
              </div>
              <h3>Finalizacao obrigatoria</h3>
              <p>
                Para concluir corretamente esta avaliacao, e obrigatorio salvar
                o resultado no sistema.
              </p>
              <button
                type="button"
                class="btn rh-finish-save-btn"
                disabled=${controlador.estado.salvandoResultado ||
                controlador.estado.resultadoSalvo}
                onClick=${salvar}
              >
                ${controlador.estado.salvandoResultado
                  ? 'Salvando...'
                  : controlador.estado.resultadoSalvo
                    ? 'Resultado salvo'
                    : 'Salvar resultado'}
              </button>
            </article>

            <article class="rh-finish-info-card is-soft">
              <div class="rh-finish-info-icon is-gold">
                <span class="material-symbols-outlined">trending_up</span>
              </div>
              <h3>Proximos passos</h3>
              <p>
                O RH recebera o registro salvo e podera continuar a analise do
                candidato nas telas de gestao.
              </p>
            </article>
          </div>

          ${alertaSalvar
            ? html`
                <div class=${`alert rh-finish-alert alert-${tipoSalvar} mt-3`}>
                  ${alertaSalvar}
                </div>
              `
            : null}

          <div class="d-flex justify-content-center mt-3 no-print">
            <button
              type="button"
              class="btn btn-outline-secondary"
              onClick=${() => controlador.irParaMenu()}
            >
              Retornar ao menu
            </button>
          </div>

          <div class="rh-finish-access-card no-print">
            <div class="rh-finish-access-icon">
              <span class="material-symbols-outlined">lock</span>
            </div>
            <div class="rh-finish-access-title">Acesso restrito RH</div>
            <p class="rh-finish-access-text">
              O resultado detalhado permanece restrito a usuarios autenticados
              no sistema.
            </p>
            <button
              type="button"
              class="btn rh-finish-access-btn"
              onClick=${acessarResultado}
            >
              Abrir resultado
            </button>
          </div>
        </div>
      </div>
    </section>
  `;
}

export function TelaResultado({ controlador }) {
  const estado = controlador.estado;
  const dataGeracao = new Date().toLocaleString('pt-BR');
  const identificador = estado.idResultadoAtual || 'Nao salvo';

  return html`
    <section class="active screen" id="screen-result">
      <div class="rh-result-screen">
        <aside class="rh-result-sidebar no-print">
          <div class="rh-result-sidebar-title">
            <span class="material-symbols-outlined">assignment_turned_in</span>
            <div>
              <strong>Avaliacao tecnica</strong>
              <span>${`ID: ${identificador}`}</span>
            </div>
          </div>
          <nav class="rh-result-nav">
            <button type="button" class="rh-result-nav-btn is-active">
              Pontuacao
            </button>
          </nav>
          <button
            type="button"
            class="btn rh-result-export-btn"
            onClick=${() => window.print()}
          >
            Imprimir resultado
          </button>
        </aside>

        <div class="rh-result-main">
          <div class="rh-result-topnav no-print">
            <div class="rh-result-topnav-links">
              <span class="is-active">Avaliacoes</span>
            </div>
            <div class="rh-result-topnav-actions">
              <button
                type="button"
                class="btn btn-primary"
                onClick=${() => controlador.baixarPacoteAtual()}
              >
                Baixar prova
              </button>
              <button
                type="button"
                class="btn btn-outline-secondary"
                onClick=${() => controlador.irParaMenu()}
              >
                Menu principal
              </button>
            </div>
          </div>

          <div class="rh-result-content card app-card">
            <div class="card-body p-4">
              <div class="print-page">
                <div class="rh-result-header">
                  <div>
                    <h2 class="rh-result-title">Resultado da avaliacao</h2>
                    <p class="rh-result-subtitle">
                      Relatorio consolidado em ${dataGeracao}
                    </p>
                  </div>
                  <span class="rh-result-status-badge no-print">
                    ${estado.statusFinalizacao || 'Finalizado'}
                  </span>
                </div>

                <div class="rh-result-summary-grid">
                  <div class="rh-result-candidate-card">
                    <div class="rh-result-candidate-name">
                      ${estado.candidato.name || '-'}
                    </div>
                    <div class="rh-result-candidate-role">
                      ${estado.candidato.role || '-'}
                    </div>
                    <div class="rh-result-candidate-meta">
                      <span class="rh-result-meta-pill">${`ID ${identificador}`}</span>
                      <span class="rh-result-meta-pill">
                        ${`${estado.candidato.level || '-'} • ${controlador.blueprint?.label || '-'}`}
                      </span>
                      <span class="rh-result-meta-pill">
                        ${estado.candidato.id_processo || 'Processo individual'}
                      </span>
                    </div>
                  </div>
                  <div class="rh-result-score-card">
                    <div class="rh-result-score-label">Nota final</div>
                    <div class="rh-result-score-value">
                      ${formatarNotaVisual(estado.notaFinalPonderada, 2)}
                    </div>
                  </div>
                </div>

                <div class="rh-result-body-grid">
                  <section class="rh-result-stage-panel">
                    <div class="rh-result-panel-head">
                      <h3>Pontuacao por etapa</h3>
                      <span>Peso total: 100%</span>
                    </div>
                    <div class="rh-stage-grid">
                      ${(estado.resumoEtapas || []).map(
                        (etapa) => html`
                          <article
                            key=${etapa.key}
                            class="rh-stage-result-card"
                          >
                            <div class="rh-stage-result-top">
                              <div class="text-muted">${etapa.label}</div>
                              <span class="weight-badge"
                                >${`Peso ${etapa.weight}%`}</span
                              >
                            </div>
                            <strong
                              >${`${etapa.questionCount} item(ns) avaliados`}</strong
                            >
                            <div
                              class=${`stage-card-score ${obterClasseEtapaResultado(etapa.percent)}`}
                            >
                              ${`${etapa.rawScore}/${etapa.rawMax}`}
                            </div>
                            <div class="small text-muted mt-1">
                              ${`Aproveitamento: ${formatarNotaVisual(
                                Number(etapa.percent || 0) * 100,
                                1,
                              )}% • Nota ponderada: ${formatarNotaVisual(
                                etapa.weightedScore,
                                2,
                              )}`}
                            </div>
                            ${etapa.pendings
                              ? html`
                                  <div class="small text-muted mt-2">
                                    ${`Pendencias de revisao: ${etapa.pendings}`}
                                  </div>
                                `
                              : null}
                          </article>
                        `,
                      )}
                    </div>
                  </section>

                  <aside class="rh-result-side-stack">
                    <${SectionCard}
                      title="Observacoes do RH"
                      className="rh-section-card--flat"
                    >
                      <textarea
                        class="form-control"
                        rows="7"
                        placeholder="Digite observacoes sobre desempenho, postura, tempo, comportamento, pontos fortes e pontos de atencao."
                        value=${estado.observacaoRh || ''}
                        onInput=${(event) =>
                          controlador.atualizarObservacaoRh(event.target.value)}
                      ></textarea>
                    </${SectionCard}>

                    <${SectionCard}
                      title="Pendencias"
                      className="rh-section-card--flat"
                    >
                      ${
                        (estado.pendenciasManuais || []).length
                          ? html`
                              <div class="rh-result-pending-list">
                                ${(estado.pendenciasManuais || []).map(
                                  (item, indice) => html`
                                    <div key=${indice} class="mb-3">
                                      <strong>
                                        ${item.title ||
                                        item.q?.title ||
                                        'Item para revisao'}
                                      </strong>
                                      ${item.completedTasks?.length
                                        ? html`
                                            <div class="small text-muted mt-2">
                                              ${item.completedTasks.map(
                                                (linha, indiceLinha) => html`
                                                  <div key=${indiceLinha}>
                                                    ${linha}
                                                  </div>
                                                `,
                                              )}
                                            </div>
                                          `
                                        : null}
                                      ${item.answerKey?.length
                                        ? html`
                                            <div class="small text-muted mt-2">
                                              ${item.answerKey.map(
                                                (linha, indiceLinha) => html`
                                                  <div key=${indiceLinha}>
                                                    ${linha}
                                                  </div>
                                                `,
                                              )}
                                            </div>
                                          `
                                        : null}
                                      ${item.notes?.length
                                        ? html`
                                            <div class="small text-muted mt-2">
                                              ${item.notes.map(
                                                (linha, indiceLinha) => html`
                                                  <div key=${indiceLinha}>
                                                    ${linha}
                                                  </div>
                                                `,
                                              )}
                                            </div>
                                          `
                                        : null}
                                    </div>
                                  `,
                                )}
                              </div>
                            `
                          : html`
                              <${EmptyState}
                                title="Sem pendencias"
                                text="Nao ha pendencias de revisao registradas para esta prova."
                              />
                            `
                      }
                    </${SectionCard}>
                  </aside>
                </div>

                <${SectionCard}
                  title="Resumo complementar"
                  className="rh-section-card--flat"
                >
                  <${MetricGrid}
                    items=${[
                      {
                        label: 'Pontuacao bruta',
                        value: `${estado.totalScore}/${estado.totalMax}`,
                      },
                      {
                        label: 'Etapas avaliadas',
                        value: (estado.resumoEtapas || []).length,
                      },
                      {
                        label: 'Status final',
                        value: estado.statusFinalizacao || 'Finalizado',
                      },
                    ]}
                  />
                </${SectionCard}>
              </div>

              <div class="print-only-result">
                <div class="print-sheet-topbar">${dataGeracao}</div>
                <div class="print-sheet-title-row">
                  <div>
                    <h1>Resultado da avaliacao</h1>
                    <p>Resumo final da prova</p>
                  </div>
                </div>
                <div class="print-sheet-meta">
                  <div>${`Candidato(a): ${estado.candidato.name || '-'}`}</div>
                  <div>${`Vaga: ${estado.candidato.role || '-'}`}</div>
                  <div>
                    ${`Nivel da prova: ${estado.candidato.level || '-'} • ${controlador.blueprint?.label || '-'}`}
                  </div>
                  <div>${`Nota final: ${formatarNotaVisual(estado.notaFinalPonderada, 2)}`}</div>
                </div>
                <div class="print-sheet-divider"></div>
                <h2 class="print-sheet-section-title">Pontuacao por etapa</h2>
                <div class="print-stage-grid">
                  ${(estado.resumoEtapas || []).map(
                    (etapa) => html`
                      <div class="print-stage-card" key=${etapa.key}>
                        <div class="print-stage-title">${etapa.label}</div>
                        <div class="print-stage-score">
                          ${`${etapa.rawScore}/${etapa.rawMax}`}
                        </div>
                        <div class="print-stage-meta">
                          ${`Peso: ${etapa.weight}%`}<br />
                          ${`Aproveitamento: ${formatarNotaVisual(
                            Number(etapa.percent || 0) * 100,
                            1,
                          )}%`}<br />
                          ${`Nota ponderada: ${formatarNotaVisual(etapa.weightedScore, 2)}`}
                        </div>
                      </div>
                    `,
                  )}
                </div>
                <div class="print-sheet-divider print-gap-top"></div>
                <h2 class="print-sheet-section-title">Pendencias para revisao do RH</h2>
                <div class="print-manual-box">
                  ${
                    (estado.pendenciasManuais || []).length
                      ? (estado.pendenciasManuais || []).map(
                          (item, indice) => html`
                            <div key=${indice} class="mb-3">
                              <strong
                                >${item.title ||
                                item.q?.title ||
                                'Item para revisao'}</strong
                              >
                              ${item.notes?.length
                                ? html`
                                    <div class="small text-muted">
                                      ${item.notes.join(' | ')}
                                    </div>
                                  `
                                : null}
                            </div>
                          `,
                        )
                      : html`<div>Nenhuma pendencia.</div>`
                  }
                </div>
                <div class="print-sheet-divider print-gap-top"></div>
                <h2 class="print-sheet-section-title">Observacao do RH</h2>
                <div class="print-observation-note">
                  ${
                    (estado.observacaoRh || '').trim() ||
                    'Anotacoes sobre desempenho, postura, tempo e pontos de atencao.'
                  }
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  `;
}
