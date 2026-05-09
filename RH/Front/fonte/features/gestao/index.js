import {
  html,
  useEffect,
  useMemo,
  useState,
} from '../../infraestrutura-react.js';
import {
  TAMANHO_ANALISE,
  TAMANHO_HISTORICO,
  TAMANHO_RECENTES,
  atualizarStatusCandidato,
  baixarCvCandidato,
  baixarPacoteHistorico,
  carregarDetalhesProva,
  construirMapaStatusAtual,
  criarProcesso,
  lerAnalisesCandidatos,
  lerBancoTalentos,
  lerCandidatosProcessos,
  lerDetalheAnaliseCandidato,
  lerHistorico,
  lerHistoricoPaginado,
  lerProcessos,
  montarIdProcesso,
  obterClasseSituacaoAtual,
  obterRegrasFormularioProcesso,
  obterRotuloSituacaoAtual,
  atualizarPerfilCandidato,
  baixarRelatorioCandidatos,
  baixarRelatorioProcessos,
  removerBancoTalentos,
  usarCandidatoDoBancoTalentos,
  lerRelatorioCandidatos,
  lerRelatorioProcessos,
} from '../../app/controlador-aplicacao.js';
import {
  baixarBlob,
  formatarDataParaInput,
  formatarNotaAnalise,
  formatarPercentualAfinidade,
  formatarPontuacaoDetalhada,
  obterItensPaginados,
} from '../../utilitarios.js';
import { abrirBlobEmNovaGuia } from '../../shared/browser-utils.js';
import {
  formatarDataHora,
  obterClasseAderencia,
  obterClasseStatusEntrevista,
} from '../../shared/helpers-visuais.js';
import { AcaoSair } from '../../shared/components/actions.js';
import { TabelaVazia } from '../../shared/components/empty-table-row.js';
import {
  getCandidateActionState,
  getCandidateVisibleStatus,
  isProcessClosed,
} from '../../shared/process-flow.js';
import { obterTourLogin } from '../../shared/tour-config.js';
import {
  obterChaveProcesso,
  obterReferenciaProcesso,
} from '../../shared/process-reference.js';
import {
  quebrarListaTexto,
  validarFormularioProcesso,
  validarPerfilCandidato,
} from '../../shared/validacoes.js';
import { BlocoFiltro, CampoFiltro } from './components/filtros.js';
import {
  EmptyState,
  GrupoPaginacao,
  LoadingState,
  MetricGrid,
  ModalDetalhesProva,
  ModalPadrao,
  PageIntro,
  PainelRh,
  SectionCard,
} from '../../ui/componentes-compartilhados.js';
import { BotaoAjudaTour, TourGuiado } from '../../ui/tour-guiado.js';

export function TelaLogin({ controlador }) {
  const [usuario, setUsuario] = useState('');
  const [senha, setSenha] = useState('');
  const [mensagemErro, setMensagemErro] = useState('');
  const [tourReopenSignal, setTourReopenSignal] = useState(0);
  const tourLogin = obterTourLogin();

  const enviar = async () => {
    const resultado = await controlador.fazerLogin(
      usuario.trim(),
      senha.trim(),
    );

    if (!resultado.ok) {
      setMensagemErro(resultado.mensagem);
    }
  };

  return html`
    <section class="active screen" id="screen-login">
      <div class="rh-login-page">
        <div class="rh-login-hero" data-tour-id="login-hero">
          <div class="rh-login-hero-badge">Sistema Interno RH</div>
          <h1 class="rh-login-hero-title">Plataforma de provas, processos e analise.</h1>
          <p class="rh-login-hero-text">
            Um fluxo unico para aplicacao de provas, acompanhamento de candidatos,
            banco de talentos e analise operacional.
          </p>
          <div class="rh-login-hero-points">
            <span>Historico consolidado</span>
            <span>Processos seletivos</span>
            <span>Analise de candidatos</span>
          </div>
        </div>

        <div
          class="rh-login-panel rh-login-panel-modern"
          data-tour-id="login-panel"
        >
          <div class="rh-login-brand-block rh-login-brand-block-centered">
            <img
              alt="Central 24h"
              class="rh-login-brand-image"
              src="estilos/logo_conecta_padrao.png"
            />
          </div>

          <div class="rh-login-copy-block">
            <h2 class="rh-login-welcome-title">Acesso ao ambiente RH</h2>
            <p class="rh-login-welcome-text">
              Entre com as credenciais para continuar.
            </p>
          </div>

          <div class="mb-3">
            <label class="form-label rh-login-label">Login</label>
            <div class="rh-login-input-wrap">
              <span class="material-symbols-outlined rh-login-input-icon">
                alternate_email
              </span>
              <input
                class="form-control rh-login-input rh-login-input-modern"
                placeholder="nome@empresa.com.br"
                value=${usuario}
                onInput=${(event) => setUsuario(event.target.value)}
                type="text"
              />
            </div>
          </div>

          <div class="mb-2">
            <div class="rh-login-label-row">
              <label class="form-label rh-login-label mb-0">Senha</label>
              <button class="rh-login-link-btn" tabindex="-1" type="button">
                Ambiente restrito
              </button>
            </div>
            <div class="rh-login-input-wrap">
              <span class="material-symbols-outlined rh-login-input-icon">
                lock
              </span>
              <input
                class="form-control rh-login-input rh-login-input-modern"
                placeholder="••••••••"
                value=${senha}
                onInput=${(event) => setSenha(event.target.value)}
                type="password"
              />
            </div>
          </div>

          ${mensagemErro
            ? html`<div class="alert alert-danger mb-3">${mensagemErro}</div>`
            : null}

          <button
            class="btn rh-login-btn rh-login-btn-modern w-100"
            data-tour-id="login-submit"
            onClick=${enviar}
          >
            <span>Acessar sistema</span>
            <span class="material-symbols-outlined">arrow_forward</span>
          </button>

          <div class="rh-login-help-row">
            <${BotaoAjudaTour}
              compact=${true}
              label="Ver orientacoes"
              onClick=${() => setTourReopenSignal((valor) => valor + 1)}
            />
          </div>

          <div class="rh-login-footer-meta">
            <span>© 2026 Central 24h</span>
            <span>Privacidade</span>
            <span>Termos</span>
            <span>Suporte</span>
          </div>
        </div>
      </div>

      <${TourGuiado}
        screenId="screen-login"
        userId=""
        steps=${tourLogin.steps}
        reopenSignal=${tourReopenSignal}
      />
    </section>
  `;
}

export function TelaInicio({ controlador }) {
  const [carregando, setCarregando] = useState(true);
  const [recentes, setRecentes] = useState([]);
  const [detalheAberto, setDetalheAberto] = useState(null);

  const carregar = async () => {
    setCarregando(true);
    try {
      const historico = await lerHistorico();
      const ordenado = (Array.isArray(historico) ? historico : [])
        .sort((a, b) =>
          String(b.data_iso || '').localeCompare(String(a.data_iso || '')),
        )
        .slice(0, TAMANHO_RECENTES);
      setRecentes(ordenado);
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregar();
  }, []);

  return html`
    <${PainelRh}
      screenId="screen-menu"
      navAtiva="screen-menu"
      subtituloMarca="Central 24h"
      placeholderBusca="Painel executivo do RH"
      controlador=${controlador}
      acaoPrimaria=${{
        label: 'Iniciar teste',
        onClick: () => controlador.iniciarNovoFluxo(),
      }}
      acoesTopo=${html`<${AcaoSair} controlador=${controlador} />`}
    >
      <${PageIntro}
        kicker="Painel principal"
        title="Ultimas provas salvas"
        description="Acesso rapido aos registros mais recentes com historico detalhado e download do pacote salvo."
        actions=${html`
          <button
            type="button"
            class="btn btn-outline-secondary"
            onClick=${carregar}
          >
            Atualizar
          </button>
        `}
      />

      <${SectionCard}
        title="Resumo rapido"
        description="Visao imediata do volume mais recente salvo no sistema."
      >
        <${MetricGrid}
          items=${[
            {
              label: 'Registros recentes',
              value: recentes.length,
              helper: 'Ultimos itens visiveis no painel',
            },
            {
              label: 'Status de carregamento',
              value: carregando ? 'Atualizando' : 'Pronto',
              helper: 'Consulta do historico consolidado',
            },
          ]}
        />
      </${SectionCard}>

      <${SectionCard}
        title="Atalhos operacionais"
        description="Acesse os fluxos principais do sistema."
        tourId="home-shortcuts"
      >
        <div class="rh-action-grid">
          <button
            type="button"
            class="rh-action-card"
            onClick=${() => controlador.iniciarNovoFluxo()}
          >
            <span class="material-symbols-outlined">play_circle</span>
            <strong>Nova prova</strong>
            <p>Inicie uma avaliacao individual ou vinculada a um processo.</p>
          </button>
          <button
            type="button"
            class="rh-action-card"
            onClick=${() => controlador.irParaTelaProtegida('screen-processes')}
          >
            <span class="material-symbols-outlined">folder_managed</span>
            <strong>Processos seletivos</strong>
            <p>Gerencie vagas, status e candidatos em andamento.</p>
          </button>
          <button
            type="button"
            class="rh-action-card"
            onClick=${() => controlador.irParaTelaProtegida('screen-history')}
          >
            <span class="material-symbols-outlined">history</span>
            <strong>Historico completo</strong>
            <p>Filtre provas salvas por nome, vaga e data.</p>
          </button>
        </div>
      </${SectionCard}>

      <${SectionCard}
        title="Registros recentes"
        description="Clique em um registro para abrir o detalhamento salvo."
        tourId="home-recent"
      >
        ${carregando
          ? html`<div class="alert alert-secondary">Carregando provas recentes...</div>`
          : recentes.length
            ? html`
                <div class="rh-recent-grid">
                  ${recentes.map(
                    (item) => html`
                      <button
                        key=${item.id_teste}
                        type="button"
                        class="rh-recent-card"
                        onClick=${async () =>
                          setDetalheAberto(
                            await carregarDetalhesProva(item.id_teste),
                          )}
                      >
                        <div class="rh-recent-avatar-wrap">
                          <span class="rh-recent-avatar">
                            ${String(item.nome_candidato || 'C')
                              .trim()
                              .slice(0, 1)
                              .toUpperCase()}
                          </span>
                        </div>
                        <div class="rh-recent-card-body">
                          <strong>${item.nome_candidato || '-'}</strong>
                          <span>${item.vaga || '-'}</span>
                          <span>${item.data_exibicao || '-'}</span>
                        </div>
                        <span class="material-symbols-outlined">arrow_forward</span>
                      </button>
                    `,
                  )}
                </div>
              `
            : html`
                <${EmptyState}
                  title="Nenhum registro salvo"
                  text="Assim que uma prova for concluida e salva, ela aparecera aqui."
                />
              `}
      </${SectionCard}>

      <${ModalDetalhesProva}
        detalhe=${detalheAberto}
        onClose=${() => setDetalheAberto(null)}
        onDownload=${() =>
          baixarPacoteHistorico(
            detalheAberto?.linha?.id_teste,
            detalheAberto?.linha?.nome_candidato || 'candidato',
          )}
      />
    </${PainelRh}>
  `;
}

export function TelaHistorico({ controlador }) {
  const [carregando, setCarregando] = useState(true);
  const [linhas, setLinhas] = useState([]);
  const [pagina, setPagina] = useState(1);
  const [paginacao, setPaginacao] = useState({
    paginaAtual: 1,
    totalPaginas: 1,
    totalItens: 0,
  });
  const [filtros, setFiltros] = useState({ nome: '', vaga: '', data: '' });
  const [detalheAberto, setDetalheAberto] = useState(null);
  const [mapaStatus, setMapaStatus] = useState({});

  useEffect(() => {
    (async () => {
      setCarregando(true);
      try {
        const [historico, statusAtual] = await Promise.all([
          lerHistoricoPaginado({
            pagina,
            tamanho: TAMANHO_HISTORICO,
            nome: filtros.nome,
            vaga: filtros.vaga,
            data: filtros.data,
          }),
          construirMapaStatusAtual(),
        ]);
        setLinhas(Array.isArray(historico?.items) ? historico.items : []);
        setPaginacao({
          paginaAtual: historico?.page || pagina,
          totalPaginas: historico?.total_pages || 1,
          totalItens: historico?.total_items || 0,
        });
        setMapaStatus(statusAtual);
      } finally {
        setCarregando(false);
      }
    })();
  }, [filtros, pagina]);

  return html`
    <${PainelRh}
      screenId="screen-history"
      navAtiva="screen-history"
      subtituloMarca="Historico de provas"
      placeholderBusca="Consulta do historico de avaliacoes"
      controlador=${controlador}
      acaoPrimaria=${{
        label: 'Iniciar teste',
        onClick: () => controlador.iniciarNovoFluxo(),
      }}
      acoesTopo=${html`<${AcaoSair} controlador=${controlador} />`}
    >
      <${PageIntro}
        kicker="Console • Historico"
        title="Historico de exames"
        description="Consulte resultados salvos com filtros por candidato, vaga e data."
      />

      <${BlocoFiltro} tourId="history-filters">
        <div class="rh-filter-grid">
          <${CampoFiltro} label="Candidato" icon="person_search">
            <input
              class="form-control"
              placeholder="Pesquisar por nome..."
              value=${filtros.nome}
              onInput=${(event) => {
                setPagina(1);
                setFiltros({ ...filtros, nome: event.target.value });
              }}
            />
          </${CampoFiltro}>

          <${CampoFiltro} label="Vaga" icon="work">
            <input
              class="form-control"
              placeholder="Pesquisar por vaga..."
              value=${filtros.vaga}
              onInput=${(event) => {
                setPagina(1);
                setFiltros({ ...filtros, vaga: event.target.value });
              }}
            />
          </${CampoFiltro}>

          <${CampoFiltro} label="Data" icon="calendar_month">
            <input
              class="form-control"
              type="date"
              value=${filtros.data}
              onInput=${(event) => {
                setPagina(1);
                setFiltros({ ...filtros, data: event.target.value });
              }}
            />
          </${CampoFiltro}>
        </div>
      </${BlocoFiltro}>

      <${SectionCard}
        title="Resultados salvos"
        description="Tabela consolidada com status atualizado e acoes de consulta."
        tourId="history-results"
      >
        <div class="table-responsive">
          <table class="table align-middle rh-modern-history-table">
            <thead>
              <tr>
                <th>Candidato</th>
                <th>Vaga</th>
                <th>Nivel</th>
                <th>Data</th>
                <th>Nota</th>
                <th>Status</th>
                <th class="text-end">Acoes</th>
              </tr>
            </thead>
            <tbody>
              ${carregando
                ? html`<${TabelaVazia} colunas=${7} texto="Carregando historico..." />`
                : linhas.length
                  ? linhas.map(
                      (linha) => html`
                        <tr key=${linha.id_teste}>
                          <td>${linha.nome_candidato || '-'}</td>
                          <td>${linha.vaga || '-'}</td>
                          <td>${linha.nivel || '-'}</td>
                          <td>${linha.data_exibicao || '-'}</td>
                          <td>
                            ${formatarPontuacaoDetalhada(
                              linha.pontuacao_final,
                              '',
                            )}
                          </td>
                          <td>
                            <span
                              class=${`rh-status-pill ${obterClasseSituacaoAtual(obterRotuloSituacaoAtual(linha, mapaStatus))}`}
                            >
                              ${obterRotuloSituacaoAtual(linha, mapaStatus)}
                            </span>
                          </td>
                          <td class="text-end">
                            <div class="d-flex justify-content-end gap-2 flex-wrap">
                              <button
                                type="button"
                                class="btn btn-sm btn-outline-primary"
                                onClick=${async () =>
                                  setDetalheAberto(
                                    await carregarDetalhesProva(linha.id_teste),
                                  )}
                              >
                                Detalhes
                              </button>
                              <button
                                type="button"
                                class="btn btn-sm btn-outline-success"
                                onClick=${() =>
                                  baixarPacoteHistorico(
                                    linha.id_teste,
                                    linha.nome_candidato || 'candidato',
                                  )}
                              >
                                Baixar prova
                              </button>
                            </div>
                          </td>
                        </tr>
                      `,
                    )
                  : html`
                      <${TabelaVazia}
                        colunas=${7}
                        texto="Nenhum registro encontrado para os filtros informados."
                      />
                    `}
            </tbody>
          </table>
        </div>

        <${GrupoPaginacao}
          paginaAtual=${paginacao.paginaAtual}
          totalPaginas=${paginacao.totalPaginas}
          onChange=${setPagina}
        />
      </${SectionCard}>

      <${ModalDetalhesProva}
        detalhe=${detalheAberto}
        onClose=${() => setDetalheAberto(null)}
        onDownload=${() =>
          baixarPacoteHistorico(
            detalheAberto?.linha?.id_teste,
            detalheAberto?.linha?.nome_candidato || 'candidato',
          )}
      />
    </${PainelRh}>
  `;
}

export function TelaCriarProcesso({ controlador }) {
  const [formulario, setFormulario] = useState({
    vaga: '',
    quantidade: 1,
    dataEncerramento: '',
    operacao: '',
    trilha: '',
    usaNotaCorte: false,
    notaCorte: '',
  });
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  const regras = obterRegrasFormularioProcesso(formulario.vaga);

  useEffect(() => {
    if (regras.trilhaFixa && formulario.trilha !== regras.trilhaFixa) {
      setFormulario((anterior) => ({ ...anterior, trilha: regras.trilhaFixa }));
    }
  }, [regras.trilhaFixa, formulario.trilha]);

  const criar = async () => {
    const mensagemErro = validarFormularioProcesso(formulario, regras);
    if (mensagemErro) {
      setErro(mensagemErro);
      return;
    }

    setErro('');
    setSalvando(true);

    try {
      await criarProcesso({
        id_processo: montarIdProcesso(formulario.vaga),
        vaga: formulario.vaga,
        quantidade_vagas: Number(formulario.quantidade),
        vagas_preenchidas: 0,
        data_encerramento: formulario.dataEncerramento,
        operacao: formulario.operacao,
        trilha: regras.trilhaFixa || formulario.trilha,
        usa_nota_corte: formulario.usaNotaCorte ? 1 : 0,
        nota_corte: formulario.usaNotaCorte
          ? Number(formulario.notaCorte)
          : null,
        status: 'Aberto',
        data_criacao: new Date().toISOString(),
        link_agendamento: '',
      });

      controlador.irParaTelaProtegida('screen-processes');
    } catch (error) {
      setErro(error?.message || 'Nao foi possivel criar o processo.');
    } finally {
      setSalvando(false);
    }
  };

  return html`
    <${PainelRh}
      screenId="screen-process-create"
      navAtiva="screen-process-create"
      subtituloMarca="Novo processo seletivo"
      placeholderBusca="Cadastro de novo processo"
      controlador=${controlador}
      acaoPrimaria=${{
        label: 'Ver processos',
        onClick: () => controlador.irParaTelaProtegida('screen-processes'),
      }}
      acoesTopo=${html`<${AcaoSair} controlador=${controlador} />`}
    >
      <${PageIntro}
        kicker="Console • Novo processo"
        title="Abrir processo seletivo"
        description="Cadastre uma vaga com a mesma logica funcional do sistema atual, agora em uma composicao mais previsivel."
      />

      <${SectionCard}
        title="Dados do processo"
        description="Os campos abaixo mantem a compatibilidade com a API e com o fluxo atual de provas."
        tourId="process-create-form"
      >
        <div class="row g-3">
          <div class="col-md-6">
            <label class="form-label">Vaga do processo</label>
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

          <div class="col-md-3">
            <label class="form-label">Quantidade de vagas</label>
            <input
              class="form-control rh-flow-input"
              type="number"
              min="1"
              value=${formulario.quantidade}
              onInput=${(event) =>
                setFormulario({ ...formulario, quantidade: event.target.value })}
            />
          </div>

          <div class="col-md-3">
            <label class="form-label">Data de encerramento</label>
            <input
              class="form-control rh-flow-input"
              type="date"
              value=${formulario.dataEncerramento}
              onInput=${(event) =>
                setFormulario({
                  ...formulario,
                  dataEncerramento: event.target.value,
                })}
            />
          </div>

          <div class="col-md-6">
            <label class="form-label">Operacao</label>
            <select
              class="form-select rh-flow-input"
              value=${formulario.operacao}
              onChange=${(event) =>
                setFormulario({ ...formulario, operacao: event.target.value })}
            >
              <option value="">Selecione...</option>
              <option>CRF</option>
              <option>DAVITA</option>
              <option>NEWE</option>
              <option>BRAVA</option>
              <option>ENDOVIEW</option>
            </select>
          </div>

          <div class="col-md-6">
            <label class="form-label">Trilha</label>
            <select
              class="form-select rh-flow-input"
              disabled=${!!regras.trilhaFixa}
              value=${regras.trilhaFixa || formulario.trilha}
              onChange=${(event) =>
                setFormulario({ ...formulario, trilha: event.target.value })}
            >
              <option value="">Selecione...</option>
              <option value="RH">RH</option>
              <option value="TI">TI</option>
            </select>
          </div>

          <div class="col-md-6">
            <label class="form-label d-block mb-2">Ativar nota de corte</label>
            <label class="rh-cutoff-toggle">
              <input
                type="checkbox"
                checked=${formulario.usaNotaCorte}
                onChange=${(event) =>
                  setFormulario({
                    ...formulario,
                    usaNotaCorte: event.target.checked,
                  })}
              />
              <span class="rh-cutoff-toggle-slider"></span>
            </label>
          </div>

          <div class="col-md-6">
            <label class="form-label">Nota de corte</label>
            <input
              class="form-control rh-flow-input"
              type="number"
              min="4"
              max="10"
              step="0.1"
              disabled=${!formulario.usaNotaCorte}
              value=${formulario.notaCorte}
              onInput=${(event) =>
                setFormulario({ ...formulario, notaCorte: event.target.value })}
            />
          </div>

        </div>

        ${erro ? html`<div class="alert alert-danger mt-4">${erro}</div>` : null}

        <div class="rh-form-footer">
          <button
            type="button"
            class="btn btn-outline-secondary"
            onClick=${() => controlador.irParaTelaProtegida('screen-processes')}
          >
            Voltar
          </button>
          <button
            type="button"
            class="btn btn-success btn-lg"
            disabled=${salvando}
            onClick=${criar}
          >
            ${salvando ? 'Salvando...' : 'Criar processo'}
          </button>
        </div>
      </${SectionCard}>
    </${PainelRh}>
  `;
}

export function TelaBancoTalentos({ controlador }) {
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [linhas, setLinhas] = useState([]);
  const [processosAbertos, setProcessosAbertos] = useState([]);
  const [candidatoParaUtilizar, setCandidatoParaUtilizar] = useState(null);
  const [processoSelecionadoUso, setProcessoSelecionadoUso] = useState('');
  const [perfilEdicao, setPerfilEdicao] = useState(null);
  const [formularioPerfil, setFormularioPerfil] = useState({
    tags: '',
    habilidades: '',
    observacao_rh: '',
  });
  const [filtros, setFiltros] = useState({
    busca: '',
    habilidade: '',
    tag: '',
  });

  const carregar = async () => {
    setCarregando(true);
    setErro('');

    try {
      const [banco, processos] = await Promise.all([
        lerBancoTalentos({
          forcar: true,
          search: filtros.busca,
          skill: filtros.habilidade,
          tag: filtros.tag,
        }),
        lerProcessos(true),
      ]);

      setLinhas(Array.isArray(banco) ? banco : []);
      setProcessosAbertos(
        (Array.isArray(processos) ? processos : []).filter(
          (processo) => String(processo.status || '').trim() !== 'Encerrado',
        ),
      );
    } catch (error) {
      setErro(
        error?.message || 'Nao foi possivel carregar o banco de talentos.',
      );
      setLinhas([]);
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregar();
  }, [filtros.busca, filtros.habilidade, filtros.tag]);

  const abrirCurriculo = async (candidato) => {
    if (!candidato?.id_teste || !candidato?.cv_disponivel) {
      window.alert('Nao ha curriculo disponivel para este candidato.');
      return;
    }

    try {
      const arquivo = await baixarCvCandidato(candidato.id_teste);
      const tipo = String(arquivo?.contentType || '').toLowerCase();
      if (tipo.includes('pdf')) {
        abrirBlobEmNovaGuia(arquivo.blob);
        return;
      }

      baixarBlob(arquivo.filename || 'curriculo', arquivo.blob);
    } catch (error) {
      setErro(
        error?.message || 'Nao foi possivel abrir o curriculo do candidato.',
      );
    }
  };

  const remover = async (idBanco) => {
    if (!window.confirm('Deseja eliminar este candidato do banco de talentos?')) {
      return;
    }

    setSalvando(true);
    setErro('');
    try {
      await removerBancoTalentos(idBanco);
      await carregar();
    } catch (error) {
      setErro(
        error?.message || 'Nao foi possivel remover o candidato do banco.',
      );
    } finally {
      setSalvando(false);
    }
  };

  const abrirEdicaoPerfil = (candidato) => {
    setPerfilEdicao(candidato);
    setFormularioPerfil({
      tags: Array.isArray(candidato.tags) ? candidato.tags.join(', ') : '',
      habilidades: Array.isArray(candidato.habilidades)
        ? candidato.habilidades.join(', ')
        : '',
      observacao_rh: candidato.observacao_rh || '',
    });
  };

  const salvarPerfil = async () => {
    if (!perfilEdicao) return;

    const mensagemErro = validarPerfilCandidato(formularioPerfil);
    if (mensagemErro) {
      setErro(mensagemErro);
      return;
    }

    setSalvando(true);
    setErro('');

    try {
      await atualizarPerfilCandidato(perfilEdicao.id_teste, {
        nome_candidato: perfilEdicao.nome_candidato,
        tags: quebrarListaTexto(formularioPerfil.tags),
        habilidades: quebrarListaTexto(formularioPerfil.habilidades),
        observacao_rh: formularioPerfil.observacao_rh,
      });
      setPerfilEdicao(null);
      await carregar();
    } catch (error) {
      setErro(error?.message || 'Nao foi possivel atualizar o perfil RH.');
    } finally {
      setSalvando(false);
    }
  };

  const confirmarUso = async () => {
    if (!candidatoParaUtilizar || !processoSelecionadoUso) {
      window.alert('Selecione um processo antes de continuar.');
      return;
    }

    const confirmar = window.confirm(
      `Deseja realmente utilizar o candidato ${candidatoParaUtilizar?.nome_candidato || ''} no processo ${processoSelecionadoUso}?`,
    );
    if (!confirmar) return;

    setSalvando(true);
    setErro('');

    try {
      const processoSelecionado = processosAbertos.find(
        (processo) => obterReferenciaProcesso(processo) === processoSelecionadoUso,
      );
      await usarCandidatoDoBancoTalentos(candidatoParaUtilizar.id_banco, {
        id_processo: processoSelecionado?.id_processo || '',
        id_processo_ref: processoSelecionadoUso,
      });

      setCandidatoParaUtilizar(null);
      setProcessoSelecionadoUso('');
      await carregar();
    } catch (error) {
      setErro(
        error?.message || 'Nao foi possivel reutilizar o candidato selecionado.',
      );
    } finally {
      setSalvando(false);
    }
  };

  return html`
    <${PainelRh}
      screenId="screen-talent-bank"
      navAtiva="screen-talent-bank"
      subtituloMarca="Banco de talentos"
      placeholderBusca="Reaproveitamento de candidatos"
      controlador=${controlador}
      acoesTopo=${html`<${AcaoSair} controlador=${controlador} />`}
    >
      <${PageIntro}
        kicker="Console • Banco de talentos"
        title="Candidatos reaproveitaveis"
        description="Acompanhe candidatos guardados para oportunidades futuras, filtre por habilidade e registre tags e observacoes do RH."
      />

      ${erro ? html`<div class="rh-inline-alert">${erro}</div>` : null}

      <${SectionCard}
        title="Filtros"
        description="Busque candidatos por nome, habilidade e tags cadastradas."
        tourId="talent-filters"
      >
        <div class="rh-filter-grid rh-filter-grid--wide">
          <div class="rh-filter-field">
            <label>Busca por nome</label>
            <input
              class="form-control"
              placeholder="Nome, vaga ou processo"
              value=${filtros.busca}
              onInput=${(event) =>
                setFiltros({ ...filtros, busca: event.target.value })}
            />
          </div>
          <div class="rh-filter-field">
            <label>Habilidade</label>
            <input
              class="form-control"
              placeholder="Excel, Atendimento, TI..."
              value=${filtros.habilidade}
              onInput=${(event) =>
                setFiltros({ ...filtros, habilidade: event.target.value })}
            />
          </div>
          <div class="rh-filter-field">
            <label>Tag</label>
            <input
              class="form-control"
              placeholder="Prioritario, Boa aderencia..."
              value=${filtros.tag}
              onInput=${(event) =>
                setFiltros({ ...filtros, tag: event.target.value })}
            />
          </div>
        </div>
      </${SectionCard}>

      <${SectionCard}
        title="Lista atual"
        description="Reaproveitamento, perfil RH e filtros avancados funcionando sobre dados persistidos."
        tourId="talent-table"
      >
        ${carregando
          ? html`
              <${LoadingState}
                titulo="Carregando banco de talentos"
                descricao="Buscando candidatos, tags e observacoes persistidas."
              />
            `
          : html`
              <div class="table-responsive">
                <table class="table align-middle rh-modern-history-table">
                  <thead>
                    <tr>
                      <th>Processo</th>
                      <th>Candidato</th>
                      <th>Cidade</th>
                      <th>Bairro</th>
                      <th>Vaga</th>
                      <th>Nota</th>
                      <th>Habilidades / tags</th>
                      <th>Observacoes RH</th>
                      <th>Entrevista</th>
                      <th>CV</th>
                      <th class="text-end">Acoes</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${linhas.length
                      ? linhas.map(
                          (linha) => html`
                            <tr key=${linha.id_banco}>
                              <td>${linha.id_processo || '-'}</td>
                              <td>
                                <strong>${linha.nome_candidato || '-'}</strong>
                                <div class="small text-muted mt-1">
                                  ${formatarDataHora(linha.data_movimentacao)}
                                </div>
                              </td>
                              <td>${linha.cidade || '-'}</td>
                              <td>${linha.bairro || '-'}</td>
                              <td>${linha.vaga || '-'}</td>
                              <td>${linha.pontuacao_final || '-'}</td>
                              <td>
                                <div class="rh-cell-stack">
                                  <div class="rh-chip-wrap">
                                    ${(linha.habilidades || []).map(
                                      (item) => html`
                                        <span key=${item} class="rh-chip is-skill">${item}</span>
                                      `,
                                    )}
                                    ${(linha.tags || []).map(
                                      (item) => html`
                                        <span key=${item} class="rh-chip">${item}</span>
                                      `,
                                    )}
                                  </div>
                                  <small>${linha.origem || '-'}</small>
                                </div>
                              </td>
                              <td>${linha.observacao_rh || 'Sem observacoes.'}</td>
                              <td>
                                ${linha.status_entrevista
                                  ? html`
                                      <div class="rh-cell-stack">
                                        <span
                                          class=${`rh-status-pill ${obterClasseStatusEntrevista(linha.status_entrevista)}`}
                                        >
                                          ${linha.status_entrevista}
                                        </span>
                                        <small>${formatarDataHora(linha.data_entrevista)}</small>
                                      </div>
                                    `
                                  : 'Nao agendada'}
                              </td>
                              <td>
                                ${linha.cv_disponivel
                                  ? html`
                                      <button
                                        type="button"
                                        class="btn btn-sm btn-outline-secondary"
                                        onClick=${() => abrirCurriculo(linha)}
                                      >
                                        Ver CV
                                      </button>
                                    `
                                  : 'Sem CV'}
                              </td>
                              <td class="text-end">
                                <div class="d-flex justify-content-end gap-2 flex-wrap">
                                  <button
                                    type="button"
                                    class="btn btn-sm btn-outline-secondary"
                                    onClick=${() => abrirEdicaoPerfil(linha)}
                                  >
                                    Perfil RH
                                  </button>
                                  <button
                                    type="button"
                                    class="btn btn-sm btn-outline-danger"
                                    disabled=${salvando}
                                    onClick=${() => remover(linha.id_banco)}
                                  >
                                    Eliminar
                                  </button>
                                  <button
                                    type="button"
                                    class="btn btn-sm btn-outline-primary"
                                    onClick=${() => {
                                      setCandidatoParaUtilizar(linha);
                                      setProcessoSelecionadoUso('');
                                    }}
                                  >
                                    Utilizar
                                  </button>
                                </div>
                              </td>
                            </tr>
                          `,
                        )
                      : html`
                          <${TabelaVazia}
                            colunas=${11}
                            texto="Nenhum candidato no banco de talentos."
                          />
                        `}
                  </tbody>
                </table>
              </div>
            `}
      </${SectionCard}>

      <${ModalPadrao}
        aberto=${!!candidatoParaUtilizar}
        titulo="Utilizar candidato"
        subtitulo="Selecione o processo aberto e confirme a reutilizacao."
        onClose=${() => {
          setCandidatoParaUtilizar(null);
          setProcessoSelecionadoUso('');
        }}
      >
        <div class="rh-details-body">
          <label class="form-label">Processo aberto</label>
          <select
            class="form-select"
            value=${processoSelecionadoUso}
            onChange=${(event) => setProcessoSelecionadoUso(event.target.value)}
          >
            <option value="">Selecione...</option>
              ${processosAbertos.map(
                (processo) => html`
                <option key=${obterChaveProcesso(processo)} value=${obterReferenciaProcesso(processo)}>
                  ${processo.id_processo} • ${processo.vaga} •
                  ${processo.operacao || processo.trilha || '-'}
                </option>
              `,
            )}
          </select>
        </div>
        <footer class="rh-modal-footer">
          <button
            type="button"
            class="btn btn-outline-secondary"
            onClick=${() => {
              setCandidatoParaUtilizar(null);
              setProcessoSelecionadoUso('');
            }}
          >
            Cancelar
          </button>
          <button
            type="button"
            class="btn btn-primary"
            disabled=${salvando}
            onClick=${confirmarUso}
          >
            Confirmar utilizacao
          </button>
        </footer>
      </${ModalPadrao}>

      <${ModalPadrao}
        aberto=${!!perfilEdicao}
        titulo="Perfil RH do candidato"
        subtitulo="Cadastre habilidades, tags e observacoes persistidas para reutilizacao futura."
        onClose=${() => setPerfilEdicao(null)}
      >
        ${perfilEdicao
          ? html`
              <div class="rh-details-body">
                <div class="row g-3">
                  <div class="col-md-12">
                    <label class="form-label">Candidato</label>
                    <input
                      class="form-control"
                      readonly
                      value=${perfilEdicao.nome_candidato || ''}
                    />
                  </div>
                  <div class="col-md-12">
                    <label class="form-label">Habilidades</label>
                    <input
                      class="form-control"
                      placeholder="Excel, Atendimento, Administrativo..."
                      value=${formularioPerfil.habilidades}
                      onInput=${(event) =>
                        setFormularioPerfil({
                          ...formularioPerfil,
                          habilidades: event.target.value,
                        })}
                    />
                  </div>
                  <div class="col-md-12">
                    <label class="form-label">Tags</label>
                    <input
                      class="form-control"
                      placeholder="Prioritario, Boa aderencia..."
                      value=${formularioPerfil.tags}
                      onInput=${(event) =>
                        setFormularioPerfil({
                          ...formularioPerfil,
                          tags: event.target.value,
                        })}
                    />
                  </div>
                  <div class="col-md-12">
                    <label class="form-label">Observacao RH</label>
                    <textarea
                      class="form-control"
                      rows="5"
                      value=${formularioPerfil.observacao_rh}
                      onInput=${(event) =>
                        setFormularioPerfil({
                          ...formularioPerfil,
                          observacao_rh: event.target.value,
                        })}
                    ></textarea>
                  </div>
                </div>
              </div>
              <footer class="rh-modal-footer">
                <button
                  type="button"
                  class="btn btn-outline-secondary"
                  onClick=${() => setPerfilEdicao(null)}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  class="btn btn-primary"
                  disabled=${salvando}
                  onClick=${salvarPerfil}
                >
                  ${salvando ? 'Salvando...' : 'Salvar perfil'}
                </button>
              </footer>
            `
          : null}
      </${ModalPadrao}>
    </${PainelRh}>
  `;
}

function GraficoComparativoAnalise({ itens = [] }) {
  const dados = Array.isArray(itens) ? itens : [];
  const maiorValor = Math.max(
    1,
    ...dados.flatMap((item) => [
      Number(item?.obtained || 0),
      Number(item?.expected || 0),
    ]),
  );

  if (!dados.length) {
    return html`
      <${EmptyState}
        title="Sem dados para o grafico"
        text="Nao ha informacoes suficientes para exibir a comparacao."
      />
    `;
  }

  return html`
    <div class="rh-analysis-chart">
      ${dados.map(
        (item, indice) => html`
          <div key=${indice} class="rh-analysis-chart-row">
            <div class="rh-analysis-chart-label">${item.label || '-'}</div>
            <div class="rh-analysis-chart-bars">
              <div class="rh-analysis-chart-bar-track">
                <div
                  class="rh-analysis-chart-bar is-obtained"
                  style=${{
                    width: `${(Number(item?.obtained || 0) / maiorValor) * 100}%`,
                  }}
                ></div>
              </div>
              <div class="rh-analysis-chart-bar-track">
                <div
                  class="rh-analysis-chart-bar is-expected"
                  style=${{
                    width: `${(Number(item?.expected || 0) / maiorValor) * 100}%`,
                  }}
                ></div>
              </div>
            </div>
            <div class="rh-analysis-chart-value">
              ${formatarNotaAnalise(item?.obtained || 0)} x
              ${formatarNotaAnalise(item?.expected || 0)}
            </div>
          </div>
        `,
      )}
    </div>
  `;
}

export function TelaAnaliseCandidatos({ controlador }) {
  const [linhas, setLinhas] = useState([]);
  const [pagina, setPagina] = useState(1);
  const [relatorioAtivo, setRelatorioAtivo] = useState('processos');
  const [carregandoRelatorio, setCarregandoRelatorio] = useState(false);
  const [relatorioProcessos, setRelatorioProcessos] = useState([]);
  const [relatorioCandidatos, setRelatorioCandidatos] = useState([]);
  const [filtrosRelatorio, setFiltrosRelatorio] = useState({
    dataInicial: '',
    dataFinal: '',
    status: '',
    processo: '',
  });
  const [filtros, setFiltros] = useState({
    processo: '',
    candidato: '',
    vaga: '',
    nota: '',
  });
  const [detalhe, setDetalhe] = useState(null);

  const carregarAnalises = async () => {
    const dados = await lerAnalisesCandidatos();
    setLinhas(Array.isArray(dados) ? dados : []);
  };

  const carregarRelatorios = async () => {
    setCarregandoRelatorio(true);
    try {
      const [processos, candidatos] = await Promise.all([
        lerRelatorioProcessos(filtrosRelatorio),
        lerRelatorioCandidatos(filtrosRelatorio),
      ]);
      setRelatorioProcessos(Array.isArray(processos) ? processos : []);
      setRelatorioCandidatos(Array.isArray(candidatos) ? candidatos : []);
    } finally {
      setCarregandoRelatorio(false);
    }
  };

  const baixarRelatorioAtivo = async () => {
    const arquivo =
      relatorioAtivo === 'processos'
        ? await baixarRelatorioProcessos(filtrosRelatorio)
        : await baixarRelatorioCandidatos(filtrosRelatorio);
    baixarBlob(arquivo.filename || 'relatorio.csv', arquivo.blob);
  };

  useEffect(() => {
    carregarAnalises();
    carregarRelatorios();
  }, []);

  const filtrado = useMemo(
    () =>
      linhas.filter((linha) => {
        const matchProcesso =
          !filtros.processo ||
          String(linha.id_processo || '')
            .toLowerCase()
            .includes(filtros.processo.toLowerCase());
        const matchCandidato =
          !filtros.candidato ||
          String(linha.nome_candidato || '')
            .toLowerCase()
            .includes(filtros.candidato.toLowerCase());
        const matchVaga =
          !filtros.vaga ||
          String(linha.vaga || '')
            .toLowerCase()
            .includes(filtros.vaga.toLowerCase());

        let matchNota = true;
        if (filtros.nota) {
          const notaMinima = Number(String(filtros.nota).replace(',', '.'));
          const notaAtual = Number(
            String(linha.nota_final || 0).replace(',', '.'),
          );
          if (!Number.isNaN(notaMinima)) {
            matchNota = notaAtual >= notaMinima;
          }
        }

        return matchProcesso && matchCandidato && matchVaga && matchNota;
      }),
    [linhas, filtros],
  );

  const paginado = obterItensPaginados(filtrado, pagina, TAMANHO_ANALISE);
  const detalheEstadoAcoes = useMemo(
    () => getCandidateActionState(detalhe || {}, detalhe?.status_processo || ''),
    [detalhe],
  );

  const aplicarAcao = async (statusCandidato) => {
    if (!detalhe?.id_teste) return;
    if (detalheEstadoAcoes.processClosed) {
      window.alert('O processo seletivo deste candidato esta encerrado e nao permite novas movimentacoes.');
      return;
    }
    if (
      statusCandidato === 'Aprovado' &&
      !detalheEstadoAcoes.canApprove
    ) {
      window.alert('A aprovacao nao esta disponivel para o status atual deste candidato.');
      return;
    }
    if (
      statusCandidato === 'Eliminado' &&
      !detalheEstadoAcoes.canEliminate
    ) {
      window.alert('A eliminacao nao esta disponivel para o status atual deste candidato.');
      return;
    }
    if (
      statusCandidato === 'Banco de talentos' &&
      !detalheEstadoAcoes.canSendToTalentBank
    ) {
      window.alert('O envio para banco de talentos nao esta disponivel para o status atual deste candidato.');
      return;
    }

    const candidatosProcesso = await lerCandidatosProcessos(true);
    const vinculo = candidatosProcesso.find(
      (item) =>
        String(item.id_teste || '').trim() ===
        String(detalhe.id_teste || '').trim(),
    );

    if (!vinculo) {
      window.alert(
        'Nao foi possivel localizar o vinculo do candidato com o processo.',
      );
      return;
    }

    await atualizarStatusCandidato(vinculo.id_registro, {
      status_candidato: statusCandidato,
      data_movimentacao: new Date().toISOString(),
    });

    await carregarAnalises();
    setDetalhe(await lerDetalheAnaliseCandidato(detalhe.id_teste));
  };

  return html`
    <${PainelRh}
      screenId="screen-analysis-candidates"
      navAtiva="screen-analysis-candidates"
      subtituloMarca="Analise por candidato"
      placeholderBusca="Inteligencia analitica do RH"
      controlador=${controlador}
      mostrarAtalhos=${false}
      acoesTopo=${html`<${AcaoSair} controlador=${controlador} />`}
    >
      <${PageIntro}
        kicker="Console • Relatorios"
        title="Relatorios e analise por candidato"
        description="Exporte processos e candidatos por periodo, mantendo a analise individual disponivel para consulta operacional."
      />

      <${SectionCard}
        title="Relatorios exportaveis"
        description="Os dados sao gerados sob demanda pela API, sem criar arquivo permanente no servidor."
        actions=${html`
          <button
            type="button"
            class="btn btn-outline-secondary"
            disabled=${carregandoRelatorio}
            onClick=${carregarRelatorios}
          >
            Atualizar
          </button>
          <button
            type="button"
            class="btn btn-primary"
            disabled=${carregandoRelatorio}
            onClick=${baixarRelatorioAtivo}
          >
            Exportar CSV
          </button>
        `}
      >
        <div class="d-flex gap-2 flex-wrap mb-3">
          <button
            type="button"
            class=${`btn ${relatorioAtivo === 'processos' ? 'btn-primary' : 'btn-outline-primary'}`}
            onClick=${() => setRelatorioAtivo('processos')}
          >
            Relatorio de Processos
          </button>
          <button
            type="button"
            class=${`btn ${relatorioAtivo === 'candidatos' ? 'btn-primary' : 'btn-outline-primary'}`}
            onClick=${() => setRelatorioAtivo('candidatos')}
          >
            Relatorio de Candidatos
          </button>
        </div>

        <div class="rh-filter-grid rh-filter-grid--wide mb-4">
          <div class="rh-filter-field">
            <label>Data inicial</label>
            <input
              class="form-control"
              type="date"
              value=${filtrosRelatorio.dataInicial}
              onInput=${(event) =>
                setFiltrosRelatorio({
                  ...filtrosRelatorio,
                  dataInicial: event.target.value,
                })}
            />
          </div>
          <div class="rh-filter-field">
            <label>Data final</label>
            <input
              class="form-control"
              type="date"
              value=${filtrosRelatorio.dataFinal}
              onInput=${(event) =>
                setFiltrosRelatorio({
                  ...filtrosRelatorio,
                  dataFinal: event.target.value,
                })}
            />
          </div>
          <div class="rh-filter-field">
            <label>Status candidato</label>
            <select
              class="form-select"
              value=${filtrosRelatorio.status}
              disabled=${relatorioAtivo !== 'candidatos'}
              onChange=${(event) =>
                setFiltrosRelatorio({
                  ...filtrosRelatorio,
                  status: event.target.value,
                })}
            >
              <option value="">Todos</option>
              <option value="Aprovado">Aprovado</option>
              <option value="Eliminado">Eliminado/Reprovado</option>
              <option value="Banco de talentos">Banco de Talentos</option>
              <option value="Analise">Em andamento</option>
            </select>
          </div>
          <div class="rh-filter-field">
            <label>Processo</label>
            <input
              class="form-control"
              value=${filtrosRelatorio.processo}
              disabled=${relatorioAtivo !== 'candidatos'}
              onInput=${(event) =>
                setFiltrosRelatorio({
                  ...filtrosRelatorio,
                  processo: event.target.value,
                })}
            />
          </div>
        </div>

        ${relatorioAtivo === 'processos'
          ? html`
              <div class="table-responsive">
                <table class="table align-middle rh-modern-history-table">
                  <thead>
                    <tr>
                      <th>Processo</th>
                      <th>Vaga</th>
                      <th>Vagas</th>
                      <th>Aprovados</th>
                      <th>Eliminados/Reprovados</th>
                      <th>Abertura</th>
                      <th>Encerramento</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${relatorioProcessos.length
                      ? relatorioProcessos.slice(0, 12).map(
                          (linha) => html`
                            <tr key=${`${linha.nome_relatorio_processo}-${linha.data_abertura}`}>
                              <td>${linha.nome_relatorio_processo || '-'}</td>
                              <td>${linha.vaga || '-'}</td>
                              <td>${linha.quantidade_vagas ?? '-'}</td>
                              <td>${linha.quantidade_aprovados ?? 0}</td>
                              <td>${linha.quantidade_eliminados_reprovados ?? 0}</td>
                              <td>${formatarDataHora(linha.data_abertura)}</td>
                              <td>${linha.data_encerramento || '-'}</td>
                              <td>${linha.status_processo || '-'}</td>
                            </tr>
                          `,
                        )
                      : html`<${TabelaVazia} colunas=${8} texto="Nenhum processo no periodo." />`}
                  </tbody>
                </table>
              </div>
            `
          : html`
              <div class="table-responsive">
                <table class="table align-middle rh-modern-history-table">
                  <thead>
                    <tr>
                      <th>Candidato</th>
                      <th>Processo</th>
                      <th>Vaga</th>
                      <th>Nota</th>
                      <th>Status</th>
                      <th>Aprovação</th>
                      <th>Eliminação/Reprovação</th>
                      <th>Banco</th>
                      <th>Contato</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${relatorioCandidatos.length
                      ? relatorioCandidatos.slice(0, 12).map(
                          (linha) => html`
                            <tr key=${`${linha.nome_candidato}-${linha.processo}-${linha.status}`}>
                              <td>${linha.nome_candidato || '-'}</td>
                              <td>${linha.processo || '-'}</td>
                              <td>${linha.vaga || '-'}</td>
                              <td>${linha.nota_prova || 'Sem prova'}</td>
                              <td>${linha.status || '-'}</td>
                              <td>${formatarDataHora(linha.data_aprovacao)}</td>
                              <td>${formatarDataHora(linha.data_eliminacao_reprovacao)}</td>
                              <td>${formatarDataHora(linha.data_banco_talentos)}</td>
                              <td>
                                <div>${linha.email || '-'}</div>
                                <div class="small text-muted">${linha.telefone || '-'}</div>
                              </td>
                            </tr>
                          `,
                        )
                      : html`<${TabelaVazia} colunas=${9} texto="Nenhum candidato no periodo." />`}
                  </tbody>
                </table>
              </div>
            `}
      </${SectionCard}>

      <${BlocoFiltro} tourId="analysis-filters">
        <div class="rh-filter-grid rh-filter-grid--wide">
          <${CampoFiltro} label="Processo" icon="folder_managed">
            <input
              class="form-control"
              value=${filtros.processo}
              onInput=${(event) => {
                setPagina(1);
                setFiltros({ ...filtros, processo: event.target.value });
              }}
            />
          </${CampoFiltro}>
          <${CampoFiltro} label="Candidato" icon="person_search">
            <input
              class="form-control"
              value=${filtros.candidato}
              onInput=${(event) => {
                setPagina(1);
                setFiltros({ ...filtros, candidato: event.target.value });
              }}
            />
          </${CampoFiltro}>
          <${CampoFiltro} label="Vaga" icon="work">
            <input
              class="form-control"
              value=${filtros.vaga}
              onInput=${(event) => {
                setPagina(1);
                setFiltros({ ...filtros, vaga: event.target.value });
              }}
            />
          </${CampoFiltro}>
          <${CampoFiltro} label="Nota minima" icon="star">
            <input
              class="form-control"
              type="number"
              step="0.1"
              min="0"
              max="10"
              value=${filtros.nota}
              onInput=${(event) => {
                setPagina(1);
                setFiltros({ ...filtros, nota: event.target.value });
              }}
            />
          </${CampoFiltro}>
        </div>
      </${BlocoFiltro}>

      <${SectionCard}
        title="Ranking analitico"
        description="O modal de detalhe respeita o status atual do candidato e bloqueia movimentacoes em processo encerrado."
        tourId="analysis-ranking"
      >
        <div class="table-responsive">
          <table class="table align-middle rh-modern-history-table">
            <thead>
              <tr>
                <th>Processo</th>
                <th>Candidato</th>
                <th>Vaga</th>
                <th>Nota</th>
                <th>Afinidade</th>
                <th>Recomendacao</th>
                <th>Status</th>
                <th class="text-end">Acoes</th>
              </tr>
            </thead>
            <tbody>
              ${paginado.itens.length
                ? paginado.itens.map(
                    (linha) => html`
                      <tr key=${linha.id_teste}>
                        <td>${linha.id_processo || '-'}</td>
                        <td>${linha.nome_candidato || '-'}</td>
                        <td>${linha.vaga || '-'}</td>
                        <td>${formatarNotaAnalise(linha.nota_final)}</td>
                        <td>
                          ${formatarPercentualAfinidade(
                            linha.afinidade_percentual,
                          )}%
                        </td>
                        <td>
                          <span class=${obterClasseAderencia(linha.recomendacao)}>
                            ${linha.recomendacao || '-'}
                          </span>
                        </td>
                        <td>${getCandidateVisibleStatus(linha) || '-'}</td>
                        <td class="text-end">
                          <button
                            type="button"
                            class="btn btn-sm btn-outline-primary"
                            onClick=${async () =>
                              setDetalhe(
                                await lerDetalheAnaliseCandidato(linha.id_teste),
                              )}
                          >
                            Detalhes
                          </button>
                        </td>
                      </tr>
                    `,
                  )
                : html`
                    <${TabelaVazia}
                      colunas=${8}
                      texto="Nenhuma analise disponivel."
                    />
                  `}
            </tbody>
          </table>
        </div>

        <${GrupoPaginacao}
          paginaAtual=${paginado.paginaAtual}
          totalPaginas=${paginado.totalPaginas}
          onChange=${setPagina}
        />
      </${SectionCard}>

      <${ModalPadrao}
        aberto=${!!detalhe}
        titulo=${`Analise do candidato • ${detalhe?.nome_candidato || 'Candidato'}`}
        subtitulo="Comparativo analitico entre desempenho e expectativa da vaga."
        onClose=${() => setDetalhe(null)}
      >
        ${detalhe
          ? html`
              <div class="rh-details-body">
                <${MetricGrid}
                  items=${[
                    { label: 'Processo', value: detalhe.id_processo || '-' },
                    { label: 'Candidato', value: detalhe.nome_candidato || '-' },
                    { label: 'Vaga', value: detalhe.vaga || '-' },
                    {
                      label: 'Nota final',
                      value: formatarNotaAnalise(detalhe.nota_final),
                    },
                    {
                      label: 'Afinidade',
                      value: `${formatarPercentualAfinidade(
                        detalhe.afinidade_percentual,
                      )}%`,
                    },
                    {
                      label: 'Recomendacao',
                      value: html`
                        <span class=${obterClasseAderencia(detalhe.recomendacao)}>
                          ${detalhe.recomendacao || '-'}
                        </span>
                      `,
                    },
                    {
                      label: 'Status atual',
                      value: getCandidateVisibleStatus(detalhe) || '-',
                    },
                    {
                      label: 'Processo',
                      value: detalhe.status_processo || 'Aberto',
                    },
                  ]}
                />

                <${SectionCard}
                  title="Etapas comparadas"
                  className="rh-section-card--flat"
                >
                  <${GraficoComparativoAnalise} itens=${detalhe.grafico || []} />
                </${SectionCard}>

                <${SectionCard}
                  title="Observacoes"
                  className="rh-section-card--flat"
                >
                  <div class="rh-detail-list">
                    <div>
                      Nota textual geral:
                      ${formatarNotaAnalise(
                        detalhe?.analise_texto?.overall || 0,
                      )}
                    </div>
                    ${(detalhe.ressalvas || []).map(
                      (item, indice) => html`<div key=${indice}>${item}</div>`,
                    )}
                    <div>${detalhe.parecer_final || '-'}</div>
                  </div>
                </${SectionCard}>
              </div>

              <footer class="rh-modal-footer">
                <div class="rh-modal-footer-actions">
                  ${detalheEstadoAcoes.canApprove
                    ? html`
                        <button
                          type="button"
                          class="btn btn-outline-success"
                          onClick=${() => aplicarAcao('Aprovado')}
                        >
                          Aprovar
                        </button>
                      `
                    : null}
                  ${detalheEstadoAcoes.canEliminate
                    ? html`
                        <button
                          type="button"
                          class="btn btn-outline-danger"
                          onClick=${() => aplicarAcao('Eliminado')}
                        >
                          Eliminar
                        </button>
                      `
                    : null}
                  ${detalheEstadoAcoes.canSendToTalentBank
                    ? html`
                        <button
                          type="button"
                          class="btn btn-outline-secondary"
                          onClick=${() => aplicarAcao('Banco de talentos')}
                        >
                          Banco de talentos
                        </button>
                      `
                    : null}
                  ${!detalheEstadoAcoes.canApprove &&
                  !detalheEstadoAcoes.canEliminate &&
                  !detalheEstadoAcoes.canSendToTalentBank
                    ? html`
                        <span class="text-muted">
                          ${isProcessClosed(detalhe?.status_processo)
                            ? 'Processo encerrado: sem movimentacoes.'
                            : 'Sem acoes operacionais para o status atual.'}
                        </span>
                      `
                    : null}
                </div>
                <button
                  type="button"
                  class="btn btn-primary"
                  onClick=${() => setDetalhe(null)}
                >
                  Fechar
                </button>
              </footer>
            `
          : null}
      </${ModalPadrao}>
    </${PainelRh}>
  `;
}
