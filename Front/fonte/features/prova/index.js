import { html, useEffect, useMemo, useState } from '../infraestrutura-react.js';
import {
  SUGESTOES_NIVEL_POR_VAGA,
  montarProvaPorBlueprint,
  resolverBlueprintProva,
} from '../../perguntas.js';
import {
  atualizarEntrevista,
  lerEntrevistas,
  lerProcessos,
  navegarParaTela,
} from '../../app/controlador-aplicacao.js';
import {
  formatarDataHora,
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
import {
  encontrarProcessoPorReferencia,
  obterChaveProcesso,
  obterReferenciaProcesso,
} from '../../shared/process-reference.js';
import {
  NIVEIS_PERSONALIZACAO,
  PERFIS_OPERACAO,
  STATUS_PERSONALIZACAO,
  gerarPersonalizacaoProva,
  registrarHistoricoPersonalizacao,
} from './services/personalizacao-inteligente.js';

const STATUS_CANDIDATOS_AGENDADOS = new Set(['Agendado', 'Confirmado']);

function normalizarTexto(valor) {
  return String(valor || '').trim();
}

function montarIdentificadorCandidatoAgendado(candidato) {
  return (
    normalizarTexto(candidato?.id_entrevista) ||
    normalizarTexto(candidato?.id_registro) ||
    normalizarTexto(candidato?.id_teste)
  );
}

function deduplicarCandidatosAgendados(lista) {
  const mapa = new Map();

  (Array.isArray(lista) ? lista : []).forEach((item) => {
    const chave =
      montarIdentificadorCandidatoAgendado(item) ||
      `${normalizarTexto(item?.nome_candidato)}::${normalizarTexto(item?.id_processo_ref || item?.id_processo)}`;
    if (chave && !mapa.has(chave)) {
      mapa.set(chave, item);
    }
  });

  return Array.from(mapa.values());
}

function ModalAcessoAdministrativo({
  aberto,
  acao = '',
  controlador,
  onClose,
  onLiberado,
}) {
  const [usuario, setUsuario] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [autenticando, setAutenticando] = useState(false);

  useEffect(() => {
    if (!aberto) return;
    setUsuario('');
    setSenha('');
    setErro('');
    setAutenticando(false);
  }, [aberto]);

  if (!aberto) return null;

  const confirmar = async () => {
    if (!usuario.trim() || !senha) {
      setErro('Informe login e senha do RH/administrador.');
      return;
    }

    setAutenticando(true);
    setErro('');
    const resultado = await controlador.autenticarAcessoAdministrativo(
      usuario,
      senha,
    );
    setAutenticando(false);

    if (!resultado?.ok) {
      setErro(resultado?.mensagem || 'Usuário ou senha inválidos.');
      return;
    }

    onLiberado();
  };

  return html`
    <${ModalPadrao}
      aberto=${aberto}
      titulo="Acesso restrito"
      subtitulo="Acesso restrito. Informe as credenciais do RH/administrador para continuar."
      onClose=${onClose}
    >
      <div class="rh-details-body">
        ${acao ? html`<p class="text-muted mb-3">${acao}</p>` : null}
        <div class="row g-3">
          <div class="col-md-12">
            <label class="form-label">Login</label>
            <input
              class="form-control"
              value=${usuario}
              autocomplete="username"
              onInput=${(event) => setUsuario(event.target.value)}
            />
          </div>
          <div class="col-md-12">
            <label class="form-label">Senha</label>
            <input
              class="form-control"
              type="password"
              value=${senha}
              autocomplete="current-password"
              onInput=${(event) => setSenha(event.target.value)}
              onKeyDown=${(event) => {
                if (event.key === 'Enter') confirmar();
              }}
            />
          </div>
        </div>
        ${erro ? html`<div class="alert alert-danger mt-3 mb-0">${erro}</div>` : null}
      </div>
      <footer class="rh-modal-footer">
        <button
          type="button"
          class="btn btn-outline-secondary"
          disabled=${autenticando}
          onClick=${onClose}
        >
          Cancelar
        </button>
        <button
          type="button"
          class="btn btn-primary"
          disabled=${autenticando}
          onClick=${confirmar}
        >
          ${autenticando ? 'Validando...' : 'Continuar'}
        </button>
      </footer>
    </${ModalPadrao}>
  `;
}

export function TelaConfiguracao({ controlador }) {
  const [processosAbertos, setProcessosAbertos] = useState([]);
  const [candidatosAgendados, setCandidatosAgendados] = useState([]);
  const [atualizandoCandidatoAgendado, setAtualizandoCandidatoAgendado] =
    useState(false);
  const [erro, setErro] = useState('');
  const [requisitoBuscado, setRequisitoBuscado] = useState(null);
  const [formulario, setFormulario] = useState(() => ({
    processo:
      controlador.estado.processoSelecionado ||
      (controlador.estado.candidato.id_processo_ref ||
      controlador.estado.candidato.id_processo
        ? controlador.estado.candidato.id_processo_ref ||
          controlador.estado.candidato.id_processo
        : ''),
    candidatoAgendado: montarIdentificadorCandidatoAgendado(
      controlador.estado.candidato,
    ),
    vaga: controlador.estado.candidato.role || '',
    nivel: controlador.estado.candidato.level || '',
    trilha:
      controlador.estado.candidato.track &&
      controlador.estado.candidato.track !== 'automatico'
        ? controlador.estado.candidato.track
        : '',
    tempo: controlador.estado.candidato.time || 40,
  }));
  const [personalizacao, setPersonalizacao] = useState(() => ({
    ativada: false,
    operacao: '',
    perfilOperacao: PERFIS_OPERACAO[0].id,
    nivelPersonalizacao: NIVEIS_PERSONALIZACAO[1].id,
    status: STATUS_PERSONALIZACAO.NAO_PERSONALIZADA,
    questoes: [],
    alertas: [],
    historico: null,
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
            'Não foi possível carregar os processos seletivos abertos.',
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

  const processoSelecionado = useMemo(() => {
    if (!formulario.processo || formulario.processo === 'PROCESSO_UNICO') {
      return null;
    }

    return (
      encontrarProcessoPorReferencia(processosAbertos, formulario.processo) ||
      processosAbertos.find(
        (processo) =>
          normalizarTexto(processo.id_processo) ===
          normalizarTexto(formulario.processo),
      ) ||
      null
    );
  }, [formulario.processo, processosAbertos]);

  useEffect(() => {
    if (!processoSelecionado) {
      setCandidatosAgendados([]);
      setFormulario((anterior) =>
        anterior.candidatoAgendado
          ? { ...anterior, candidatoAgendado: '' }
          : anterior,
      );
      return;
    }

    const referenciaProcesso = obterReferenciaProcesso(processoSelecionado);
    const vagaProcesso = normalizarTexto(processoSelecionado.vaga);

    setFormulario((anterior) => {
      const proximoFormulario = { ...anterior };
      let mudou = false;

      if (
        referenciaProcesso &&
        normalizarTexto(anterior.processo) !== referenciaProcesso
      ) {
        proximoFormulario.processo = referenciaProcesso;
        mudou = true;
      }

      if (vagaProcesso && normalizarTexto(anterior.vaga) !== vagaProcesso) {
        proximoFormulario.vaga = vagaProcesso;
        mudou = true;
      }

      return mudou ? proximoFormulario : anterior;
    });
    setPersonalizacao((anterior) => ({
      ...anterior,
      operacao:
        anterior.operacao ||
        processoSelecionado.operacao ||
        processoSelecionado.trilha ||
        processoSelecionado.vaga ||
        '',
      questoes: [],
      alertas: [],
      historico: null,
      status: anterior.ativada
        ? STATUS_PERSONALIZACAO.PENDENTE
        : STATUS_PERSONALIZACAO.NAO_PERSONALIZADA,
    }));
  }, [processoSelecionado]);

  useEffect(() => {
    let ativo = true;

    if (!processoSelecionado) {
      return undefined;
    }

    (async () => {
      try {
        const lista = await lerEntrevistas({
          idProcesso: obterReferenciaProcesso(processoSelecionado),
        });
        if (!ativo) return;

        const candidatosFiltrados = deduplicarCandidatosAgendados(
          (Array.isArray(lista) ? lista : []).filter((item) =>
            STATUS_CANDIDATOS_AGENDADOS.has(
              normalizarTexto(item.status_entrevista),
            ),
          ),
        );
        setCandidatosAgendados(candidatosFiltrados);
        setFormulario((anterior) => {
          if (!anterior.candidatoAgendado) {
            return anterior;
          }

          const aindaExiste = candidatosFiltrados.some(
            (item) =>
              montarIdentificadorCandidatoAgendado(item) ===
              anterior.candidatoAgendado,
          );
          return aindaExiste
            ? anterior
            : { ...anterior, candidatoAgendado: '' };
        });
      } catch (error) {
        if (!ativo) return;
        setCandidatosAgendados([]);
        setErro(
          error?.message ||
            'Não foi possível carregar os candidatos agendados deste processo.',
        );
      }
    })();

    return () => {
      ativo = false;
    };
  }, [processoSelecionado]);

  const candidatoAgendadoSelecionado = useMemo(
    () =>
      candidatosAgendados.find(
        (item) =>
          montarIdentificadorCandidatoAgendado(item) ===
          formulario.candidatoAgendado,
      ) || null,
    [candidatosAgendados, formulario.candidatoAgendado],
  );

  const blueprint = useMemo(() => {
    if (!formulario.vaga || !formulario.nivel) return null;
    return resolverBlueprintProva(
      formulario.vaga,
      formulario.nivel,
      formulario.trilha || '',
    );
  }, [formulario]);

  const montarConfiguracaoPersonalizacao = () => ({
    operacao:
      personalizacao.operacao ||
      processoSelecionado?.operacao ||
      processoSelecionado?.trilha ||
      processoSelecionado?.vaga ||
      '',
    cliente: processoSelecionado?.cliente || processoSelecionado?.operacao || '',
    perfilOperacao: personalizacao.perfilOperacao,
    nivelPersonalizacao: personalizacao.nivelPersonalizacao,
    usuario:
      controlador.estado.nomeUsuarioAutenticado ||
      controlador.estado.usuarioAutenticado ||
      'RH',
  });

  const camposPersonalizacaoPreenchidos = (configuracao) =>
    Boolean(
      normalizarTexto(configuracao.operacao) &&
        normalizarTexto(configuracao.perfilOperacao) &&
        normalizarTexto(configuracao.nivelPersonalizacao),
    );

  const montarHistoricoFallbackPersonalizacao = (
    configuracao,
    questoesBase,
    mensagem,
  ) => ({
    id: `${Date.now()}-fallback`,
    acao: 'fallback_personalizacao_automatica',
    operacao: configuracao.operacao,
    cliente: configuracao.cliente,
    perfil_atendimento:
      PERFIS_OPERACAO.find((perfil) => perfil.id === configuracao.perfilOperacao)
        ?.label || configuracao.perfilOperacao,
    nivel_personalizacao:
      NIVEIS_PERSONALIZACAO.find(
        (nivel) => nivel.id === configuracao.nivelPersonalizacao,
      )?.label || configuracao.nivelPersonalizacao,
    usuario: configuracao.usuario,
    data_hora: new Date().toISOString(),
    mecanismo: 'template_local_fallback',
    total_questoes: questoesBase.length,
    alertas: [mensagem],
  });

  const gerarPersonalizacaoAutomatica = () => {
    const configuracao = montarConfiguracaoPersonalizacao();
    const questoesBase = montarProvaPorBlueprint(blueprint);

    try {
      const resultado = gerarPersonalizacaoProva(questoesBase, configuracao);
      const historico = {
        ...(resultado.historico || {}),
        status_publicacao: STATUS_PERSONALIZACAO.PUBLICADA,
        publicada_em: new Date().toISOString(),
      };
      registrarHistoricoPersonalizacao(historico);
      setPersonalizacao((anterior) => ({
        ...anterior,
        status: STATUS_PERSONALIZACAO.PUBLICADA,
        questoes: resultado.questoes,
        alertas: resultado.alertas,
        historico,
      }));

      return {
        enabled: true,
        status: STATUS_PERSONALIZACAO.PUBLICADA,
        configuracao,
        questoes: resultado.questoes,
        alertas: resultado.alertas,
        historico,
      };
    } catch (error) {
      const mensagem =
        error?.message ||
        'Não foi possível personalizar todas as questões automaticamente. A prova continuará com as questões originais nos itens não personalizados.';
      const historico = montarHistoricoFallbackPersonalizacao(
        configuracao,
        questoesBase,
        mensagem,
      );
      registrarHistoricoPersonalizacao(historico);
      setPersonalizacao((anterior) => ({
        ...anterior,
        status: STATUS_PERSONALIZACAO.ERRO,
        questoes: questoesBase,
        alertas: [mensagem],
        historico,
      }));

      return {
        enabled: true,
        status: STATUS_PERSONALIZACAO.ERRO,
        configuracao,
        questoes: questoesBase,
        alertas: [mensagem],
        historico,
      };
    }
  };

  const prosseguir = () => {
    if (!formulario.vaga || !formulario.nivel || !formulario.tempo) {
      setErro('Preencha os campos da configuração para prosseguir.');
      return;
    }

    if (!formulario.processo) {
      setErro('Selecione o processo seletivo para prosseguir.');
      return;
    }

    let personalizacaoProva = null;
    if (personalizacao.ativada) {
      if (!blueprint) {
        setErro('Selecione uma combinação válida de vaga, nível e trilha.');
        return;
      }

      const configuracao = montarConfiguracaoPersonalizacao();
      if (!camposPersonalizacaoPreenchidos(configuracao)) {
        setErro(
          'Preencha os campos obrigatórios da Personalização Inteligente antes de prosseguir.',
        );
        return;
      }

      personalizacaoProva = gerarPersonalizacaoAutomatica();
    }

    setErro('');
    controlador.configurarFluxo({
      role: formulario.vaga,
      level: formulario.nivel,
      track: formulario.trilha || '',
      time: Number(formulario.tempo),
      processId: formulario.processo,
      scheduledCandidate: candidatoAgendadoSelecionado,
      personalizacaoProva,
    });
  };

  const selecionarCandidatoAgendado = async (event) => {
    const identificador = event.target.value;
    setFormulario((anterior) => ({
      ...anterior,
      candidatoAgendado: identificador,
    }));

    if (!identificador) {
      return;
    }

    const candidato = candidatosAgendados.find(
      (item) => montarIdentificadorCandidatoAgendado(item) === identificador,
    );
    if (!candidato?.id_entrevista) {
      return;
    }

    if (normalizarTexto(candidato.status_entrevista) === 'Compareceu') {
      return;
    }

    setAtualizandoCandidatoAgendado(true);
    setErro('');

    try {
      await atualizarEntrevista(candidato.id_entrevista, {
        status_entrevista: 'Compareceu',
        id_processo_ref:
          obterReferenciaProcesso(processoSelecionado) ||
          normalizarTexto(candidato.id_processo_ref || candidato.id_processo),
      });
      setCandidatosAgendados((anterior) =>
        anterior.map((item) =>
          montarIdentificadorCandidatoAgendado(item) === identificador
            ? { ...item, status_entrevista: 'Compareceu' }
            : item,
        ),
      );
    } catch (error) {
      setErro(
        error?.message ||
          'Não foi possível atualizar o status do candidato para Compareceu.',
      );
    } finally {
      setAtualizandoCandidatoAgendado(false);
    }
  };

  return html`
    <${PainelRh}
      screenId="screen-config"
      navAtiva="screen-config"
      subtituloMarca="Configuração da prova"
      placeholderBusca="Configuração do fluxo da prova"
      controlador=${controlador}
      acaoPrimaria=${{
        label: 'Iniciar teste',
        permissao: 'provas.enviar',
        onClick: () => controlador.iniciarNovoFluxo(),
      }}
      acoesTopo=${html`<${AcaoSair} controlador=${controlador} />`}
    >
      <${PageIntro}
        kicker="Console • Configuração"
        title="Configuração da prova"
        description="Selecione perfil, nível, trilha e processo sem alterar o roteamento hash nem a integração existente."
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
                <div>${requisitoBuscado.descricao || 'Sem descrição adicional.'}</div>
              </div>
            </${SectionCard}>
          `
          : null
      }

      <${SectionCard}
        title="Parâmetros da avaliação"
        description="Todos os campos abaixo alimentam o mesmo estado global já utilizado pelo sistema."
        tourId="config-parameters"
      >
        <div class="row g-3">
          <div class="col-md-6">
            <label class="form-label">Processo seletivo</label>
            <select
              class="form-select rh-flow-input"
              value=${formulario.processo}
              onChange=${(event) =>
                setFormulario({
                  ...formulario,
                  processo: event.target.value,
                  candidatoAgendado: '',
                })}
            >
              <option value="">Selecione...</option>
              <option value="PROCESSO_UNICO">Processo único</option>
              ${processosAbertos.map(
                (processo) => html`
                  <option
                    key=${obterChaveProcesso(processo)}
                    value=${obterReferenciaProcesso(processo)}
                  >
                    ${`${processo.id_processo} • ${processo.vaga} • ${processo.operacao || processo.trilha || '-'} • ${processo.data_encerramento || '-'}`}
                  </option>
                `,
              )}
            </select>
          </div>

          <div class="col-md-6">
            <label class="form-label">Candidato agendado</label>
            <select
              class="form-select rh-flow-input"
              value=${formulario.candidatoAgendado}
              disabled=${!processoSelecionado || atualizandoCandidatoAgendado}
              onChange=${selecionarCandidatoAgendado}
            >
              <option value="">Opcional</option>
              ${candidatosAgendados.map(
                (candidato) => html`
                  <option
                    key=${montarIdentificadorCandidatoAgendado(candidato)}
                    value=${montarIdentificadorCandidatoAgendado(candidato)}
                  >
                    ${`${candidato.nome_candidato || '-'} • ${formatarDataHora(candidato.data_entrevista)} • ${candidato.status_entrevista || 'Agendado'}`}
                  </option>
                `,
              )}
            </select>
            <div class="form-text">
              ${
                processoSelecionado
                  ? atualizandoCandidatoAgendado
                    ? 'Atualizando o status do candidato para Compareceu...'
                    : 'Ao selecionar um candidato agendado, o nome será preenchido automaticamente e a agenda operacional será atualizada para Compareceu.'
                  : 'Selecione um processo para listar os candidatos com entrevista agendada.'
              }
            </div>
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
              <option>Estagiário</option>
              <option>Supervisor</option>
              <option>Control Desk</option>
              <option>Planejamento</option>
              <option>TI</option>
              <option>Analista</option>
              <option>Outros</option>
            </select>
          </div>

          <div class="col-md-6">
            <label class="form-label">Nível da prova</label>
            <select
              class="form-select rh-flow-input"
              value=${formulario.nivel}
              onChange=${(event) =>
                setFormulario({ ...formulario, nivel: event.target.value })}
            >
              <option value="">Selecione...</option>
              <option value="1">Nível 1 - Jovem Aprendiz</option>
              <option value="2">Nível 2 - Operador / Estagiário</option>
              <option value="3">
                Nível 3 - Supervisor / Control Desk / Planejamento
              </option>
              <option value="4">Nível 4 - TI / Analista / Outros</option>
            </select>
          </div>

          <div class="col-md-6">
            <label class="form-label">Área / Trilha</label>
            <select
              class="form-select rh-flow-input"
              value=${formulario.trilha}
              onChange=${(event) =>
                setFormulario({ ...formulario, trilha: event.target.value })}
            >
              <option value="">Automático</option>
              <option value="operacao">Operação</option>
              <option value="ti">TI</option>
              <option value="rh">RH</option>
              <option value="adm">ADM / Gestão</option>
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
              ${blueprint?.label || 'Fluxo que será aplicado'}
            </div>
            <div class="text-muted small">${montarDescricaoFluxo(blueprint)}</div>
          </div>
        </div>

        <div class="border rounded-2 p-3 mt-4">
          <div class="d-flex align-items-start justify-content-between gap-3 flex-wrap">
            <label class="form-check m-0">
              <input
                class="form-check-input"
                type="checkbox"
                checked=${personalizacao.ativada}
                onChange=${(event) =>
                  setPersonalizacao({
                    ...personalizacao,
                    ativada: event.target.checked,
                    status: event.target.checked
                      ? STATUS_PERSONALIZACAO.PENDENTE
                      : STATUS_PERSONALIZACAO.NAO_PERSONALIZADA,
                    questoes: [],
                    alertas: [],
                    historico: null,
                  })}
              />
              <span class="form-check-label fw-semibold">
                Personalização Inteligente
              </span>
            </label>
            <span class="badge bg-secondary">${personalizacao.status}</span>
          </div>

          ${personalizacao.ativada
            ? html`
                <div class="row g-3 mt-1">
                  <div class="col-md-6">
                    <label class="form-label">Operação / Cliente</label>
                    <input
                      class="form-control"
                      required
                      value=${personalizacao.operacao}
                      placeholder="Ex.: Clínica, SAC, Backoffice..."
                      onInput=${(event) =>
                        setPersonalizacao({
                          ...personalizacao,
                          operacao: event.target.value,
                          status: STATUS_PERSONALIZACAO.PENDENTE,
                          questoes: [],
                          alertas: [],
                          historico: null,
                        })}
                    />
                  </div>
                  <div class="col-md-6">
                    <label class="form-label">Perfil de atendimento</label>
                    <select
                      class="form-select"
                      required
                      value=${personalizacao.perfilOperacao}
                      onChange=${(event) =>
                        setPersonalizacao({
                          ...personalizacao,
                          perfilOperacao: event.target.value,
                          status: STATUS_PERSONALIZACAO.PENDENTE,
                          questoes: [],
                          alertas: [],
                          historico: null,
                        })}
                    >
                      ${PERFIS_OPERACAO.map(
                        (perfil) => html`
                          <option key=${perfil.id} value=${perfil.id}>
                            ${perfil.label}
                          </option>
                        `,
                      )}
                    </select>
                  </div>
                  <div class="col-md-6">
                    <label class="form-label">Nível de personalização</label>
                    <select
                      class="form-select"
                      required
                      value=${personalizacao.nivelPersonalizacao}
                      onChange=${(event) =>
                        setPersonalizacao({
                          ...personalizacao,
                          nivelPersonalizacao: event.target.value,
                          status: STATUS_PERSONALIZACAO.PENDENTE,
                          questoes: [],
                          alertas: [],
                          historico: null,
                        })}
                    >
                      ${NIVEIS_PERSONALIZACAO.map(
                        (nivel) => html`
                          <option key=${nivel.id} value=${nivel.id}>
                            ${nivel.label}
                          </option>
                        `,
                      )}
                    </select>
                  </div>
                </div>

                ${personalizacao.alertas.length
                  ? html`
                      <div class="alert alert-warning mt-3 mb-0">
                        ${personalizacao.alertas.slice(0, 3).join(' ')}
                      </div>
                    `
                  : null}
              `
            : null}
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
  const [email, setEmail] = useState(controlador.estado.candidato.email || '');
  const [whatsapp, setWhatsapp] = useState(
    controlador.estado.candidato.whatsapp || '',
  );
  const [erro, setErro] = useState('');
  const [salvandoContato, setSalvandoContato] = useState(false);
  const regrasCandidato = Array.isArray(controlador.regrasCandidato)
    ? controlador.regrasCandidato
    : [];

  useEffect(() => {
    setNome(controlador.estado.candidato.name || '');
    setEmail(controlador.estado.candidato.email || '');
    setWhatsapp(controlador.estado.candidato.whatsapp || '');
  }, [
    controlador.estado.candidato.name,
    controlador.estado.candidato.email,
    controlador.estado.candidato.whatsapp,
  ]);

  const iniciar = async () => {
    setSalvandoContato(true);
    setErro('');
    try {
      const dadosContato = { name: nome, email, whatsapp };
      controlador.atualizarDadosContatoCandidato(dadosContato);
      const confirmacao =
        await controlador.confirmarDadosContatoCandidato(dadosContato);
      if (!confirmacao.ok) {
        setErro(confirmacao.mensagem);
        return;
      }

      const resultado = controlador.iniciarProva(
        confirmacao.dados.name,
        confirmacao.dados,
      );
      if (!resultado.ok) {
        setErro(resultado.mensagem);
        return;
      }
    } catch (error) {
      setErro(
        error?.message ||
          'Não foi possível confirmar seus dados. Verifique as informações e tente novamente.',
      );
    } finally {
      setSalvandoContato(false);
    }
  };

  return html`
    <section class="active screen" id="screen-candidate">
      <div class="rh-standalone-page">
        <div class="rh-candidate-layout">
          <aside class="rh-candidate-side-card">
            <h2 class="h5 fw-bold mb-2">Confirme seus dados</h2>
            <p class="text-muted small mb-3">
              Nome, e-mail e WhatsApp serão usados pelo RH para identificar sua
              prova e acompanhar o processo seletivo.
            </p>
            <label
              class="form-label small text-uppercase fw-bold text-muted mb-2"
            >
              Nome completo
            </label>
            <div class="rh-candidate-name-shell">
              <input
                class="form-control rh-flow-input"
                placeholder="Ex: João Augusto da Silva"
                value=${nome}
                onInput=${(event) => {
                  setNome(event.target.value);
                  controlador.atualizarDadosContatoCandidato({
                    name: event.target.value,
                    email,
                    whatsapp,
                  });
                }}
                type="text"
              />
              <span class="material-symbols-outlined">badge</span>
            </div>

            <div class="rh-candidate-contact-grid">
              <div>
                <label
                  class="form-label small text-uppercase fw-bold text-muted mb-2"
                >
                  E-mail
                </label>
                <input
                  class="form-control rh-flow-input"
                  placeholder="nome@email.com"
                  value=${email}
                  onInput=${(event) => {
                    setEmail(event.target.value);
                    controlador.atualizarDadosContatoCandidato({
                      name: nome,
                      email: event.target.value,
                      whatsapp,
                    });
                  }}
                  type="email"
                />
              </div>
              <div>
                <label
                  class="form-label small text-uppercase fw-bold text-muted mb-2"
                >
                  WhatsApp
                </label>
                <input
                  class="form-control rh-flow-input"
                  placeholder="(11) 99999-9999"
                  value=${whatsapp}
                  onInput=${(event) => {
                    setWhatsapp(event.target.value);
                    controlador.atualizarDadosContatoCandidato({
                      name: nome,
                      email,
                      whatsapp: event.target.value,
                    });
                  }}
                  type="tel"
                />
              </div>
            </div>

            <div class="rh-candidate-summary-card mt-4">
              <h3 class="h6 fw-bold mb-3">Etapas e critérios</h3>
              <ul class="candidate-summary-list">
                ${regrasCandidato.map(
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
            <h2 class="h3 fw-bold mb-2">Instruções ao candidato</h2>
            <p class="text-muted mb-4">
              Leia atentamente as orientações antes de iniciar a prova.
            </p>

            <div class="rh-instruction-grid">
              <article class="rh-instruction-card">
                <h3>Antes de começar</h3>
                <ul class="rules-list">
                  <li>
                    Confira se nome, e-mail e WhatsApp estão corretos antes de
                    iniciar a avaliação.
                  </li>
                  <li>
                    Leia todas as orientações da tela e siga somente as instruções passadas pelo
                    responsável do RH.
                  </li>
                  <li>
                    Mantenha aberto apenas o que for necessário para realizar a prova. Evite
                    abas, arquivos ou consultas que não tenham sido autorizados.
                  </li>
                  <li>
                    Em exercícios de Excel, baixe o arquivo base, edite a sua própria cópia e
                    envie a versão respondida quando solicitado.
                  </li>
                  <li>
                    Em exercícios de texto, responda com clareza, organização e cuidado com
                    ortografia, pontuação e formatação.
                  </li>
                  <li>
                    O cronômetro será iniciado ao começar a prova. Organize seu tempo antes de
                    avançar.
                  </li>
                  <li>
                    Caso perceba qualquer problema técnico antes do início, avise o responsável
                    pela aplicação imediatamente.
                  </li>
                </ul>
              </article>
              <article class="rh-instruction-card">
                <h3>Durante a prova</h3>
                <ul class="rules-list">
                  <li>
                    Responda com atenção: algumas questões avaliam conhecimento, outras avaliam
                    raciocínio, escrita, organização e prática.
                  </li>
                  <li>
                    O tempo de prova é controlado pelo sistema. Ao finalizar o prazo, a
                    avaliação poderá ser encerrada pelo responsável.
                  </li>
                  <li>
                    Não atualize a página, não feche o navegador e não utilize o botão voltar do
                    navegador durante a avaliação.
                  </li>
                  <li>
                    Salve ou anexe os arquivos solicitados somente nos campos indicados. Arquivos
                    enviados fora do local correto podem não ser considerados.
                  </li>
                  <li>
                    Em questões práticas, organize o material como faria em uma rotina real de
                    trabalho: nomeie, formate e revise antes de concluir.
                  </li>
                  <li>
                    Se houver travamento, queda de energia, erro no arquivo ou outra dificuldade
                    técnica, comunique imediatamente o responsável pela aplicação.
                  </li>
                  <li>
                    Ao terminar, revise o que for possível e finalize somente quando tiver
                    certeza de que deseja encerrar a avaliação.
                  </li>
                  <li>
                    Depois da finalização, o resultado ficará disponível apenas para análise
                    interna do RH.
                  </li>
                </ul>
              </article>
            </div>

            ${
              erro
                ? html`<div class="alert alert-danger mt-4">${erro}</div>`
                : null
            }

            <div class="rh-candidate-footer">
              <div class="rh-candidate-disclaimer">
                <span class="material-symbols-outlined">info</span>
                <span>
                  Ao iniciar, você confirma seus dados de contato e concorda
                  com as orientações da avaliação.
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
                  disabled=${salvandoContato}
                >
                  ${salvandoContato ? 'Confirmando...' : 'Confirmar e iniciar prova'}
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
  const [confirmarExcelAusente, setConfirmarExcelAusente] = useState(null);
  const [erroFinalizacao, setErroFinalizacao] = useState('');
  const indiceAtual = controlador.estado.indiceAtual;
  const questaoAtual = controlador.estado.questoes[indiceAtual];
  const respostaAtual = controlador.estado.respostas[indiceAtual] || null;

  useEffect(() => {
    if (
      controlador.estado.provaFinalizada &&
      controlador.estado.modoFinalizacao === 'desistencia'
    ) {
      controlador.exigirNovoLogin();
    }
  }, [controlador.estado.provaFinalizada, controlador.estado.modoFinalizacao]);

  if (!questaoAtual) {
    return html`
      <section class="active screen" id="screen-exam">
        <div class="container py-5">
          <div class="alert alert-warning mb-0">
            Nenhuma questão foi carregada para esta prova.
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
      setErroFinalizacao('');
      controlador.definirIndiceAtual(indiceAtual + 1);
      return;
    }

    const resultado = controlador.encerrarProva('Finalizado');
    if (!resultado?.ok) {
      if (resultado?.tipo === 'excel_nao_enviado') {
        setConfirmarExcelAusente(resultado);
        setErroFinalizacao('');
        return;
      }
      setErroFinalizacao(
        resultado?.mensagem ||
          'Não foi possível finalizar a prova com as respostas atuais.',
      );
      return;
    }

    setErroFinalizacao('');
  };

  const atualizarRespostaDiscursiva = (conteudo) => {
    setErroFinalizacao('');
    controlador.atualizarResposta(indiceAtual, {
      type: 'word',
      content: conteudo,
    });
  };

  const atualizarRespostaObjetiva = (selected) => {
    setErroFinalizacao('');
    controlador.atualizarResposta(indiceAtual, {
      type: 'multiple',
      selected,
    });
  };

  return html`
    <section class="active screen" id="screen-exam">
      <${ModalPadrao}
        aberto=${confirmarEncerramento}
        titulo="Confirmar encerramento"
        subtitulo="Ao encerrar a prova agora, o candidato será marcado como Desistente e eliminado do processo. Deseja continuar?"
        onClose=${() => setConfirmarEncerramento(false)}
      >
        <div class="rh-details-body">
          <div class="alert alert-warning mb-0">
            Ao confirmar, não será exigido Excel nem conclusão das etapas restantes.
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
              const resultado = controlador.encerrarProva(
                'Desistente',
                { modo: 'desistencia' },
              );
              if (!resultado?.ok) {
                setErroFinalizacao(
                  resultado?.mensagem ||
                    'Não foi possível encerrar a prova com as respostas atuais.',
                );
                return;
              }
              setErroFinalizacao('');
            }}
          >
            Encerrar prova
          </button>
        </footer>
      </${ModalPadrao}>

      <${ModalPadrao}
        aberto=${!!confirmarExcelAusente}
        titulo="Excel não enviado"
        subtitulo="A etapa de Excel pode ser finalizada com nota zero se o candidato decidir continuar."
        onClose=${() => setConfirmarExcelAusente(null)}
      >
        <div class="rh-details-body">
          <div class="alert alert-warning mb-0">
            Você ainda não enviou a prova de Excel. Essa etapa receberá nota zero e impactará sua nota final. Deseja finalizar mesmo assim?
          </div>
        </div>
        <footer class="rh-modal-footer">
          <button
            type="button"
            class="btn btn-outline-secondary"
            onClick=${() => {
              setConfirmarExcelAusente(null);
              const indiceExcel = Number(confirmarExcelAusente?.indice);
              if (!Number.isNaN(indiceExcel)) {
                controlador.definirIndiceAtual(indiceExcel);
              }
            }}
          >
            Voltar e enviar Excel
          </button>
          <button
            type="button"
            class="btn btn-primary"
            onClick=${() => {
              setConfirmarExcelAusente(null);
              const resultado = controlador.encerrarProva('Finalizado', {
                permitirExcelZero: true,
              });
              if (!resultado?.ok) {
                setErroFinalizacao(
                  resultado?.mensagem ||
                    'Não foi possível finalizar a prova com as respostas atuais.',
                );
                return;
              }
              setErroFinalizacao('');
            }}
          >
            Finalizar mesmo assim
          </button>
        </footer>
      </${ModalPadrao}>

      <div class="exam-screen-shell">
        <header class="exam-screen-header">
          <div class="exam-screen-header-inner">
            <div class="exam-screen-brand">
              <img
                alt="Central 24h"
                class="exam-screen-logo"
                src="estilos/logo_conecta_padrao.png"
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
                      onChange=${(resposta) => {
                        setErroFinalizacao('');
                        controlador.atualizarResposta(indiceAtual, resposta);
                      }}
                    />
                  `
                : null
            }
          </div>
        </div>

        ${
          erroFinalizacao
            ? html`
                <div class="container pb-3">
                  <div class="alert alert-danger mb-0">${erroFinalizacao}</div>
                </div>
              `
            : null
        }

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
              onClick=${() => {
                setErroFinalizacao('');
                setConfirmarEncerramento(true);
              }}
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
  const [acaoRestrita, setAcaoRestrita] = useState(null);
  const modoDesistencia = controlador.estado.modoFinalizacao === 'desistencia';

  useEffect(() => {
    if (controlador.estado.resultadoSalvo) {
      setTipoSalvar('success');
      setAlertaSalvar('Resultado salvo com sucesso.');
    }
  }, [controlador.estado.resultadoSalvo]);

  useEffect(() => {
    if (modoDesistencia && !controlador.estado.resultadoSalvo && !controlador.estado.salvandoResultado) {
      salvar();
    }
  }, [modoDesistencia, controlador.estado.resultadoSalvo, controlador.estado.salvandoResultado]);

  const salvar = async () => {
    setTipoSalvar('info');
    setAlertaSalvar('Salvando resultado no sistema...');

    const retorno = await controlador.salvarResultado();
    if (!retorno?.ok) {
      setTipoSalvar('danger');
      setAlertaSalvar(
        retorno?.mensagem ||
          'Não foi possível salvar a prova no servidor. Verifique a API e tente novamente.',
      );
      return;
    }

    setTipoSalvar('success');
    setAlertaSalvar('Resultado salvo com sucesso.');
  };

  const acessarResultado = () => {
    setAcaoRestrita({
      descricao: 'Confirme as credenciais para abrir o resultado detalhado.',
      executar: () => navegarParaTela('screen-result'),
    });
  };

  const retornarMenu = () => {
    setAcaoRestrita({
      descricao: 'Confirme as credenciais para retornar ao menu interno do RH.',
      executar: () => controlador.irParaMenu(),
    });
  };

  return html`
    <section class="active screen" id="screen-thanks">
      <${ModalAcessoAdministrativo}
        aberto=${!!acaoRestrita}
        acao=${acaoRestrita?.descricao || ''}
        controlador=${controlador}
        onClose=${() => setAcaoRestrita(null)}
        onLiberado=${() => {
          const executar = acaoRestrita?.executar;
          setAcaoRestrita(null);
          if (typeof executar === 'function') {
            window.setTimeout(executar, 0);
          }
        }}
      />
      <div class="rh-finish-screen">
        <div class="rh-finish-shell">
          <div class="rh-finish-badge">${modoDesistencia ? 'Desistente' : 'Concluído'}</div>
          <!-- <div class="rh-finish-icon-wrap">
            <div class="rh-finish-icon">OK</div>
          </div> -->
          <h2 class="rh-finish-title">
            ${modoDesistencia
              ? 'Prova encerrada antes da conclusão.'
              : 'Avaliação finalizada com sucesso!'}
          </h2>
          <p class="rh-finish-subtitle">
            ${modoDesistencia
              ? 'Candidato marcado como Desistente e eliminado do processo.'
              : 'A prova foi encerrada e o resultado pode ser salvo no sistema para registro definitivo.'}
          </p>

          <div class="rh-finish-info-grid">
            <article
              class="rh-finish-info-card rh-finish-info-card-save is-required"
            >
              <div class="rh-finish-info-icon is-blue">
                <span class="material-symbols-outlined">task_alt</span>
              </div>
              <h3>${modoDesistencia ? 'Registro de desistência' : 'Finalização obrigatória'}</h3>
              <p>
                ${modoDesistencia
                  ? 'A desistência está sendo registrada sem exigir entrega de Excel ou etapas pendentes.'
                  : 'Para concluir corretamente esta avaliação, é obrigatório salvar o resultado no sistema.'}
              </p>
              <br />
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
                    : modoDesistencia
                      ? 'Registrar desistência'
                      : 'Salvar resultado'}
              </button>
            </article>

            <article class="rh-finish-info-card is-soft">
              <div class="rh-finish-info-icon is-gold">
                <span class="material-symbols-outlined">trending_up</span>
              </div>
              <h3>${modoDesistencia ? 'Acesso bloqueado' : 'Próximos passos'}</h3>
              <p>
                ${modoDesistencia
                  ? 'Para voltar, abrir resultado ou retornar ao menu, será necessário informar login e senha novamente.'
                  : 'O RH receberá o registro salvo e poderá continuar a análise do candidato nas telas de gestão.'}
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
              onClick=${retornarMenu}
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
              O resultado detalhado permanece restrito a usuários autenticados
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
  const identificador = estado.idResultadoAtual || 'Não salvo';
  const [acaoRestrita, setAcaoRestrita] = useState(null);

  return html`
    <section class="active screen" id="screen-result">
      <${ModalAcessoAdministrativo}
        aberto=${!!acaoRestrita}
        acao=${acaoRestrita?.descricao || ''}
        controlador=${controlador}
        onClose=${() => setAcaoRestrita(null)}
        onLiberado=${() => {
          const executar = acaoRestrita?.executar;
          setAcaoRestrita(null);
          if (typeof executar === 'function') {
            window.setTimeout(executar, 0);
          }
        }}
      />
      <div class="rh-result-screen">
        <aside class="rh-result-sidebar no-print">
          <div class="rh-result-sidebar-title">
            <span class="material-symbols-outlined">assignment_turned_in</span>
            <div>
              <strong>Avaliação técnica</strong>
              <span>${`ID: ${identificador}`}</span>
            </div>
          </div>
          <nav class="rh-result-nav">
            <button type="button" class="rh-result-nav-btn is-active">
              Pontuação
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
              <span class="is-active">Avaliações</span>
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
                onClick=${() =>
                  setAcaoRestrita({
                    descricao: 'Confirme as credenciais para voltar ao menu interno do RH.',
                    executar: () => controlador.irParaMenu(),
                  })}
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
                    <h2 class="rh-result-title">Resultado da avaliação</h2>
                    <p class="rh-result-subtitle">
                      Relatório consolidado em ${dataGeracao}
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
                      <h3>Pontuação por etapa</h3>
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
                      title="Observações do RH"
                      className="rh-section-card--flat"
                    >
                      <textarea
                        class="form-control"
                        rows="7"
                        placeholder="Digite observações sobre desempenho, postura, tempo, comportamento, pontos fortes e pontos de atenção."
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
                                text="Não há pendências de revisão registradas para esta prova."
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
                        label: 'Pontuação bruta',
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
                    <h1>Resultado da avaliação</h1>
                    <p>Resumo final da prova</p>
                  </div>
                </div>
                <div class="print-sheet-meta">
                  <div>${`Candidato(a): ${estado.candidato.name || '-'}`}</div>
                  <div>${`Vaga: ${estado.candidato.role || '-'}`}</div>
                  <div>
                    ${`Nível da prova: ${estado.candidato.level || '-'} • ${controlador.blueprint?.label || '-'}`}
                  </div>
                  <div>${`Nota final: ${formatarNotaVisual(estado.notaFinalPonderada, 2)}`}</div>
                </div>
                <div class="print-sheet-divider"></div>
                <h2 class="print-sheet-section-title">Pontuação por etapa</h2>
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
                <h2 class="print-sheet-section-title">Observação do RH</h2>
                <div class="print-observation-note">
                  ${
                    (estado.observacaoRh || '').trim() ||
                    'Anotações sobre desempenho, postura, tempo e pontos de atenção.'
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
