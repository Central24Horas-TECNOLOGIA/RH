import { html, useEffect, useMemo, useState } from '../../infraestrutura-react.js';
import {
  atualizarAgendaTreinamento,
  atualizarTrilhaOnboarding,
  criarTrilhaOnboarding,
  listarAtribuicoesTreinamento,
  listarTrilhasOnboarding,
} from '../../servico-api.js';
import { listarOperacoes } from '../../services/api/operations.js';
import {
  ModalPadrao,
  PageIntro,
  PainelRh,
  SectionCard,
} from '../../ui/componentes-compartilhados.js';
import { AcaoSair } from '../../shared/components/actions.js';
import { TabelaVazia } from '../../shared/components/empty-table-row.js';
import { SkeletonTableRows } from '../../shared/components/skeleton.js';

const CATEGORIAS_TREINAMENTO = ['LGPD', 'Segurança da Informação', 'Onboarding', 'Produto', 'Outro'];
const MODALIDADES_TREINAMENTO = [
  { value: '', label: 'Não definida' },
  { value: 'presencial', label: 'Presencial' },
  { value: 'virtual', label: 'Virtual' },
  { value: 'hibrido', label: 'Híbrido' },
];
const TIPOS_CONTEUDO = [
  { value: '', label: 'Somente checklist' },
  { value: 'video', label: 'Vídeo' },
  { value: 'texto', label: 'Texto' },
  { value: 'slide', label: 'Slide' },
  { value: 'link', label: 'Link (ex.: intranet/SharePoint)' },
];
const STATUS_ATRIBUICAO = [
  { value: 'em_andamento', label: 'Em andamento' },
  { value: 'concluido', label: 'Concluído' },
  { value: 'cancelado', label: 'Cancelado' },
];
const STATUS_TOM = { em_andamento: '', concluido: 'is-indicacao', cancelado: 'is-eliminado' };

const ITEM_INICIAL = { titulo: '', descricao: '', obrigatorio: true, tipo_conteudo: '', conteudo_url: '' };
const FORM_TRILHA_INICIAL = {
  id_trilha: '',
  nome: '',
  descricao: '',
  ativo: true,
  categoria: 'Onboarding',
  id_operacao: '',
  modalidade: '',
  local_padrao: '',
  itens: [],
};
const FORM_AGENDA_INICIAL = {
  id_onboarding: '',
  data_prevista: '',
  local: '',
  ministrante: '',
  status: 'em_andamento',
};

function normalizarItensParaEnvio(itens) {
  return itens.map((item, index) => ({
    titulo: item.titulo.trim(),
    descricao: (item.descricao || '').trim(),
    ordem: index,
    obrigatorio: !!item.obrigatorio,
    tipo_conteudo: item.tipo_conteudo || '',
    conteudo_url: (item.conteudo_url || '').trim(),
  }));
}

function formatarDataHora(valor) {
  if (!valor) return '-';
  try {
    return new Date(valor).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  } catch (error) {
    return valor;
  }
}

function paraInputDatetimeLocal(valor) {
  if (!valor) return '';
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return '';
  const offset = data.getTimezoneOffset();
  const local = new Date(data.getTime() - offset * 60000);
  return local.toISOString().slice(0, 16);
}

export function TelaTreinamentos({ controlador, telaAtual = 'screen-training-trilhas' }) {
  const abaAtiva = telaAtual === 'screen-training-assignments' ? 'atribuicoes' : 'trilhas';
  const podeEditar = controlador?.possuiPermissao?.('onboarding.editar');

  const [trilhas, setTrilhas] = useState([]);
  const [operacoes, setOperacoes] = useState([]);
  const [atribuicoes, setAtribuicoes] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');

  const [modalTrilhaAberto, setModalTrilhaAberto] = useState(false);
  const [formTrilha, setFormTrilha] = useState(FORM_TRILHA_INICIAL);
  const [salvandoTrilha, setSalvandoTrilha] = useState(false);
  const [erroTrilha, setErroTrilha] = useState('');

  const [modalAgendaAberto, setModalAgendaAberto] = useState(false);
  const [formAgenda, setFormAgenda] = useState(FORM_AGENDA_INICIAL);
  const [salvandoAgenda, setSalvandoAgenda] = useState(false);
  const [erroAgenda, setErroAgenda] = useState('');

  const carregarTrilhas = async () => {
    try {
      const dados = await listarTrilhasOnboarding();
      setTrilhas(Array.isArray(dados) ? dados : []);
    } catch (error) {
      setErro(error?.message || 'Não foi possível carregar as trilhas de treinamento.');
    }
  };

  const carregarAtribuicoes = async () => {
    try {
      const dados = await listarAtribuicoesTreinamento();
      setAtribuicoes(Array.isArray(dados) ? dados : []);
    } catch (error) {
      setErro(error?.message || 'Não foi possível carregar as atribuições de treinamento.');
    }
  };

  const carregarOperacoes = async () => {
    try {
      const dados = await listarOperacoes();
      setOperacoes(Array.isArray(dados) ? dados : []);
    } catch (error) {
      // A lista de operações é auxiliar (filtro); segue sem quebrar a tela.
    }
  };

  const carregarTudo = async () => {
    setCarregando(true);
    setErro('');
    await Promise.all([carregarTrilhas(), carregarAtribuicoes(), carregarOperacoes()]);
    setCarregando(false);
  };

  useEffect(() => {
    carregarTudo();
  }, []);

  const nomeOperacao = (idOperacao) =>
    operacoes.find((operacao) => String(operacao.id_item) === String(idOperacao))?.nome || '';

  const irParaAba = (aba) => {
    controlador.irParaTelaProtegida(
      aba === 'atribuicoes' ? 'screen-training-assignments' : 'screen-training-trilhas',
    );
  };

  // -- Trilhas -----------------------------------------------------------

  const abrirNovaTrilha = () => {
    setFormTrilha({ ...FORM_TRILHA_INICIAL, itens: [{ ...ITEM_INICIAL }] });
    setErroTrilha('');
    setModalTrilhaAberto(true);
  };

  const abrirEdicaoTrilha = (trilha) => {
    setFormTrilha({
      id_trilha: trilha.id_trilha,
      nome: trilha.nome || '',
      descricao: trilha.descricao || '',
      ativo: !!trilha.ativo,
      categoria: trilha.categoria || 'Onboarding',
      id_operacao: trilha.id_operacao || '',
      modalidade: trilha.modalidade || '',
      local_padrao: trilha.local_padrao || '',
      itens: (trilha.itens || []).map((item) => ({
        titulo: item.titulo || '',
        descricao: item.descricao || '',
        obrigatorio: !!item.obrigatorio,
        tipo_conteudo: item.tipo_conteudo || '',
        conteudo_url: item.conteudo_url || '',
      })),
    });
    setErroTrilha('');
    setModalTrilhaAberto(true);
  };

  const fecharModalTrilha = () => {
    setModalTrilhaAberto(false);
    setFormTrilha(FORM_TRILHA_INICIAL);
    setErroTrilha('');
  };

  const atualizarItemTrilha = (index, campo, valor) => {
    setFormTrilha((atual) => ({
      ...atual,
      itens: atual.itens.map((item, idx) => (idx === index ? { ...item, [campo]: valor } : item)),
    }));
  };

  const adicionarItemTrilha = () => {
    setFormTrilha((atual) => ({ ...atual, itens: [...atual.itens, { ...ITEM_INICIAL }] }));
  };

  const removerItemTrilha = (index) => {
    setFormTrilha((atual) => ({ ...atual, itens: atual.itens.filter((_, idx) => idx !== index) }));
  };

  const moverItemTrilha = (index, direcao) => {
    setFormTrilha((atual) => {
      const novoIndex = index + direcao;
      if (novoIndex < 0 || novoIndex >= atual.itens.length) return atual;
      const itens = [...atual.itens];
      const [item] = itens.splice(index, 1);
      itens.splice(novoIndex, 0, item);
      return { ...atual, itens };
    });
  };

  const itensTrilhaValidos = formTrilha.itens.every((item) => item.titulo.trim());

  const salvarTrilha = async () => {
    setErroTrilha('');
    if (!formTrilha.nome.trim()) {
      setErroTrilha('Informe o nome da trilha.');
      return;
    }
    if (!itensTrilhaValidos) {
      setErroTrilha('Informe o título de todos os módulos da trilha.');
      return;
    }

    const payload = {
      nome: formTrilha.nome.trim(),
      descricao: formTrilha.descricao.trim(),
      ativo: !!formTrilha.ativo,
      categoria: formTrilha.categoria,
      id_operacao: formTrilha.id_operacao ? Number(formTrilha.id_operacao) : null,
      modalidade: formTrilha.modalidade,
      local_padrao: formTrilha.local_padrao.trim(),
      itens: normalizarItensParaEnvio(formTrilha.itens),
    };

    setSalvandoTrilha(true);
    try {
      if (formTrilha.id_trilha) {
        await atualizarTrilhaOnboarding(formTrilha.id_trilha, payload);
      } else {
        await criarTrilhaOnboarding(payload);
      }
      fecharModalTrilha();
      await carregarTrilhas();
    } catch (error) {
      setErroTrilha(error?.message || 'Não foi possível salvar a trilha de treinamento.');
    } finally {
      setSalvandoTrilha(false);
    }
  };

  // -- Atribuições (agenda/local/status) ----------------------------------

  const abrirAgenda = (atribuicao) => {
    setFormAgenda({
      id_onboarding: atribuicao.id_onboarding,
      data_prevista: paraInputDatetimeLocal(atribuicao.data_prevista),
      local: atribuicao.local || '',
      ministrante: atribuicao.ministrante || '',
      status: atribuicao.status || 'em_andamento',
    });
    setErroAgenda('');
    setModalAgendaAberto(true);
  };

  const fecharModalAgenda = () => {
    setModalAgendaAberto(false);
    setFormAgenda(FORM_AGENDA_INICIAL);
    setErroAgenda('');
  };

  const salvarAgenda = async () => {
    setSalvandoAgenda(true);
    setErroAgenda('');
    try {
      await atualizarAgendaTreinamento(formAgenda.id_onboarding, {
        data_prevista: formAgenda.data_prevista ? new Date(formAgenda.data_prevista).toISOString() : null,
        local: formAgenda.local.trim(),
        ministrante: formAgenda.ministrante.trim(),
        status: formAgenda.status,
      });
      fecharModalAgenda();
      await carregarAtribuicoes();
    } catch (error) {
      setErroAgenda(error?.message || 'Não foi possível salvar a agenda do treinamento.');
    } finally {
      setSalvandoAgenda(false);
    }
  };

  const trilhasAtivas = useMemo(() => trilhas.filter((trilha) => trilha.ativo), [trilhas]);

  const renderTrilhas = () => html`
    ${erro ? html`<div class="alert alert-warning">${erro}</div>` : null}
    <${SectionCard} title="Trilhas de treinamento" className="rh-section-card--flat">
      <div class="table-responsive">
        <table class="table align-middle rh-modern-history-table">
          <thead>
            <tr>
              <th>Nome</th>
              <th>Categoria</th>
              <th>Operação</th>
              <th>Modalidade</th>
              <th>Módulos</th>
              <th>Status</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            ${carregando
      ? html`<${SkeletonTableRows} colunas=${7} linhas=${3} />`
      : trilhas.length
        ? trilhas.map(
          (item) => html`
                    <tr key=${item.id_trilha}>
                      <td>
                        <strong>${item.nome}</strong>
                        ${item.descricao ? html`<div class="text-muted small">${item.descricao}</div>` : null}
                      </td>
                      <td>${item.categoria || 'Onboarding'}</td>
                      <td>${nomeOperacao(item.id_operacao) || 'Todas'}</td>
                      <td>${MODALIDADES_TREINAMENTO.find((m) => m.value === item.modalidade)?.label || '-'}</td>
                      <td>${(item.itens || []).length} módulo(s)</td>
                      <td>
                        <span class=${`rh-chip ${item.ativo ? 'is-indicacao' : ''}`}>
                          ${item.ativo ? 'Ativa' : 'Inativa'}
                        </span>
                      </td>
                      <td>
                        <button type="button" class="btn btn-outline-secondary btn-sm" onClick=${() => abrirEdicaoTrilha(item)}>
                          <span class="material-symbols-outlined">edit</span>
                          Editar
                        </button>
                      </td>
                    </tr>
                  `,
        )
        : html`<${TabelaVazia} colunas=${7} texto="Nenhuma trilha de treinamento cadastrada." icone="school" />`}
          </tbody>
        </table>
      </div>
    </${SectionCard}>
  `;

  const renderAtribuicoes = () => html`
    ${erro ? html`<div class="alert alert-warning">${erro}</div>` : null}
    <${SectionCard}
      title="Colaboradores em treinamento"
      className="rh-section-card--flat"
      description="Quem está fazendo o quê, quando e onde — inclui o check/OK do supervisor por módulo."
    >
      <div class="table-responsive">
        <table class="table align-middle rh-modern-history-table">
          <thead>
            <tr>
              <th>Colaborador</th>
              <th>Trilha</th>
              <th>Progresso</th>
              <th>Data prevista</th>
              <th>Local</th>
              <th>Ministrante</th>
              <th>Status</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            ${carregando
      ? html`<${SkeletonTableRows} colunas=${8} linhas=${3} />`
      : atribuicoes.length
        ? atribuicoes.map(
          (item) => html`
                    <tr key=${item.id_onboarding}>
                      <td>
                        <strong>${item.nome_candidato || `Registro ${item.id_registro}`}</strong>
                        ${item.vaga ? html`<div class="text-muted small">${item.vaga}</div>` : null}
                      </td>
                      <td>
                        ${item.trilha_nome}
                        <div class="text-muted small">${item.trilha_categoria || 'Onboarding'}</div>
                      </td>
                      <td>${item.itens_concluidos}/${item.total_itens} (${item.percentual_concluido}%)</td>
                      <td>${formatarDataHora(item.data_prevista)}</td>
                      <td>${item.local || '-'}</td>
                      <td>${item.ministrante || '-'}</td>
                      <td>
                        <span class=${`rh-chip ${STATUS_TOM[item.status] || ''}`}>
                          ${STATUS_ATRIBUICAO.find((s) => s.value === item.status)?.label || item.status}
                        </span>
                      </td>
                      <td>
                        <button
                          type="button"
                          class="btn btn-outline-secondary btn-sm"
                          disabled=${!podeEditar}
                          onClick=${() => abrirAgenda(item)}
                        >
                          <span class="material-symbols-outlined">event</span>
                          Agenda
                        </button>
                      </td>
                    </tr>
                  `,
        )
        : html`<${TabelaVazia} colunas=${8} texto="Nenhum colaborador em treinamento no momento." icone="assignment_ind" />`}
          </tbody>
        </table>
      </div>
    </${SectionCard}>
  `;

  return html`
    <${PainelRh}
      screenId="screen-training"
      navAtiva=${telaAtual === 'screen-training-assignments' ? 'screen-training-assignments' : 'screen-training-trilhas'}
      subtituloMarca="Treinamentos"
      placeholderBusca="Treinamentos"
      controlador=${controlador}
      acoesTopo=${html`<${AcaoSair} controlador=${controlador} />`}
      acaoPrimaria=${abaAtiva === 'trilhas'
      ? { label: 'Nova trilha', icon: 'add', onClick: abrirNovaTrilha, permissao: 'onboarding.editar' }
      : null}
    >
      <${PageIntro}
        kicker="Processos"
        title="Treinamentos"
        description="LGPD, Segurança da Informação, Onboarding e Produto — organizados em trilhas por operação, com vídeos, textos, slides e o acompanhamento de quem está fazendo cada treinamento."
      />

      <${SectionCard} className="rh-section-card--flat" style="margin-bottom:24px;">
        <div class="d-flex align-items-start gap-3">
          <span class="material-symbols-outlined" aria-hidden="true">upcoming</span>
          <div>
            <h3 class="h6 mb-1">Centro de Treinamentos — em breve</h3>
            <p class="rh-section-card-description mb-0">
              A expansão desta área (acesso dedicado para instrutores e supervisores, atribuição de quem
              ministra cada treinamento com aviso automático, e liberação vinculada ao processo seletivo)
              está em desenvolvimento e chega em breve. As trilhas e atribuições abaixo continuam
              funcionando normalmente.
            </p>
          </div>
        </div>
      </${SectionCard}>

      <div class="c24-tabs" style="margin-bottom:16px;display:flex;gap:8px;">
        <button type="button" class=${`c24-pill-tab ${abaAtiva === 'trilhas' ? 'is-active' : ''}`} onClick=${() => irParaAba('trilhas')}>
          <span class="material-symbols-outlined">school</span>
          Trilhas
        </button>
        <button type="button" class=${`c24-pill-tab ${abaAtiva === 'atribuicoes' ? 'is-active' : ''}`} onClick=${() => irParaAba('atribuicoes')}>
          <span class="material-symbols-outlined">assignment_ind</span>
          Atribuições
        </button>
      </div>

      ${abaAtiva === 'trilhas' ? renderTrilhas() : renderAtribuicoes()}

      <${ModalPadrao}
        aberto=${modalTrilhaAberto}
        titulo=${formTrilha.id_trilha ? 'Editar trilha de treinamento' : 'Nova trilha de treinamento'}
        subtitulo="Monte os módulos (vídeo, texto, slide ou link) que serão aplicados ao iniciar o treinamento de um colaborador."
        onClose=${fecharModalTrilha}
        className="rh-modal-dialog--lg"
      >
        <div class="rh-details-body">
          ${erroTrilha ? html`<div class="alert alert-warning">${erroTrilha}</div>` : null}

          <div class="rh-filter-field">
            <label>Nome da trilha</label>
            <input
              class="form-control"
              value=${formTrilha.nome}
              onInput=${(event) => setFormTrilha({ ...formTrilha, nome: event.target.value })}
              placeholder="Ex.: Onboarding CRF, Segurança da Informação"
            />
          </div>

          <div class="row g-2">
            <div class="col-md-4">
              <div class="rh-filter-field">
                <label>Categoria</label>
                <select
                  class="form-select"
                  value=${formTrilha.categoria}
                  onChange=${(event) => setFormTrilha({ ...formTrilha, categoria: event.target.value })}
                >
                  ${CATEGORIAS_TREINAMENTO.map((categoria) => html`<option key=${categoria} value=${categoria}>${categoria}</option>`)}
                </select>
              </div>
            </div>
            <div class="col-md-4">
              <div class="rh-filter-field">
                <label>Operação (opcional)</label>
                <select
                  class="form-select"
                  value=${formTrilha.id_operacao}
                  onChange=${(event) => setFormTrilha({ ...formTrilha, id_operacao: event.target.value })}
                >
                  <option value="">Todas as operações</option>
                  ${operacoes.map((operacao) => html`<option key=${operacao.id_item} value=${operacao.id_item}>${operacao.nome}</option>`)}
                </select>
              </div>
            </div>
            <div class="col-md-4">
              <div class="rh-filter-field">
                <label>Modalidade</label>
                <select
                  class="form-select"
                  value=${formTrilha.modalidade}
                  onChange=${(event) => setFormTrilha({ ...formTrilha, modalidade: event.target.value })}
                >
                  ${MODALIDADES_TREINAMENTO.map((opcao) => html`<option key=${opcao.value} value=${opcao.value}>${opcao.label}</option>`)}
                </select>
              </div>
            </div>
          </div>

          <div class="rh-filter-field">
            <label>Local padrão (opcional)</label>
            <input
              class="form-control"
              value=${formTrilha.local_padrao}
              onInput=${(event) => setFormTrilha({ ...formTrilha, local_padrao: event.target.value })}
              placeholder="Ex.: Sala de treinamento 2, ou link da sala virtual"
            />
          </div>

          <div class="rh-filter-field">
            <label>Descrição (opcional)</label>
            <textarea
              class="form-control"
              rows="2"
              value=${formTrilha.descricao}
              onInput=${(event) => setFormTrilha({ ...formTrilha, descricao: event.target.value })}
            ></textarea>
          </div>

          <label class="d-flex align-items-center gap-2">
            <input
              type="checkbox"
              checked=${formTrilha.ativo}
              onChange=${(event) => setFormTrilha({ ...formTrilha, ativo: !!event.target.checked })}
            />
            <span>Trilha ativa</span>
          </label>

          <div class="rh-filter-field">
            <label>Módulos da trilha</label>
            ${formTrilha.itens.map(
      (item, index) => html`
                <div key=${index} class="rh-section-card rh-section-card--flat" style="padding:12px;margin-bottom:8px;">
                  <div class="row g-2 align-items-start">
                    <div class="col-md-5">
                      <input
                        class="form-control"
                        placeholder="Título do módulo"
                        value=${item.titulo}
                        onInput=${(event) => atualizarItemTrilha(index, 'titulo', event.target.value)}
                      />
                    </div>
                    <div class="col-md-4">
                      <select
                        class="form-select"
                        value=${item.tipo_conteudo}
                        onChange=${(event) => atualizarItemTrilha(index, 'tipo_conteudo', event.target.value)}
                      >
                        ${TIPOS_CONTEUDO.map((opcao) => html`<option key=${opcao.value} value=${opcao.value}>${opcao.label}</option>`)}
                      </select>
                    </div>
                    <div class="col-md-3 d-flex gap-1">
                      <button type="button" class="btn btn-outline-secondary btn-sm" onClick=${() => moverItemTrilha(index, -1)} title="Mover para cima">
                        <span class="material-symbols-outlined">arrow_upward</span>
                      </button>
                      <button type="button" class="btn btn-outline-secondary btn-sm" onClick=${() => moverItemTrilha(index, 1)} title="Mover para baixo">
                        <span class="material-symbols-outlined">arrow_downward</span>
                      </button>
                    </div>
                  </div>
                  <div class="row g-2 mt-1">
                    <div class="col-md-6">
                      <input
                        class="form-control"
                        placeholder="Descrição (opcional)"
                        value=${item.descricao}
                        onInput=${(event) => atualizarItemTrilha(index, 'descricao', event.target.value)}
                      />
                    </div>
                    <div class="col-md-6">
                      <input
                        class="form-control"
                        placeholder="Link do conteúdo (vídeo, slide, intranet/SharePoint...)"
                        value=${item.conteudo_url}
                        onInput=${(event) => atualizarItemTrilha(index, 'conteudo_url', event.target.value)}
                        disabled=${!item.tipo_conteudo}
                      />
                    </div>
                  </div>
                  <div class="d-flex align-items-center justify-content-between mt-2">
                    <label class="d-flex align-items-center gap-2 mb-0">
                      <input
                        type="checkbox"
                        checked=${item.obrigatorio}
                        onChange=${(event) => atualizarItemTrilha(index, 'obrigatorio', !!event.target.checked)}
                      />
                      <span>Módulo obrigatório</span>
                    </label>
                    <button type="button" class="btn btn-outline-danger btn-sm" onClick=${() => removerItemTrilha(index)}>
                      <span class="material-symbols-outlined">delete</span>
                      Remover
                    </button>
                  </div>
                </div>
              `,
    )}
            <button type="button" class="btn btn-outline-primary btn-sm" onClick=${adicionarItemTrilha}>
              <span class="material-symbols-outlined">add</span>
              Adicionar módulo
            </button>
          </div>
        </div>

        <footer class="rh-modal-footer">
          <div class="rh-modal-footer-actions">
            <button type="button" class="btn btn-outline-secondary" disabled=${salvandoTrilha} onClick=${fecharModalTrilha}>
              Cancelar
            </button>
            <button
              type="button"
              class="btn btn-primary"
              disabled=${salvandoTrilha || !formTrilha.nome.trim() || !itensTrilhaValidos}
              onClick=${salvarTrilha}
            >
              ${salvandoTrilha ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </footer>
      </${ModalPadrao}>

      <${ModalPadrao}
        aberto=${modalAgendaAberto}
        titulo="Agenda do treinamento"
        subtitulo="Defina quando, onde e com quem — e marque o status geral do treinamento."
        onClose=${fecharModalAgenda}
      >
        <div class="rh-details-body">
          ${erroAgenda ? html`<div class="alert alert-warning">${erroAgenda}</div>` : null}

          <div class="rh-filter-field">
            <label>Data e horário previstos</label>
            <input
              type="datetime-local"
              class="form-control"
              value=${formAgenda.data_prevista}
              onInput=${(event) => setFormAgenda({ ...formAgenda, data_prevista: event.target.value })}
            />
          </div>

          <div class="rh-filter-field">
            <label>Local</label>
            <input
              class="form-control"
              value=${formAgenda.local}
              onInput=${(event) => setFormAgenda({ ...formAgenda, local: event.target.value })}
              placeholder="Ex.: Sala 2, ou link da videochamada"
            />
          </div>

          <div class="rh-filter-field">
            <label>Ministrante</label>
            <input
              class="form-control"
              value=${formAgenda.ministrante}
              onInput=${(event) => setFormAgenda({ ...formAgenda, ministrante: event.target.value })}
              placeholder="Quem vai dar o treinamento"
            />
          </div>

          <div class="rh-filter-field">
            <label>Status</label>
            <select
              class="form-select"
              value=${formAgenda.status}
              onChange=${(event) => setFormAgenda({ ...formAgenda, status: event.target.value })}
            >
              ${STATUS_ATRIBUICAO.map((opcao) => html`<option key=${opcao.value} value=${opcao.value}>${opcao.label}</option>`)}
            </select>
          </div>
        </div>

        <footer class="rh-modal-footer">
          <div class="rh-modal-footer-actions">
            <button type="button" class="btn btn-outline-secondary" disabled=${salvandoAgenda} onClick=${fecharModalAgenda}>
              Cancelar
            </button>
            <button type="button" class="btn btn-primary" disabled=${salvandoAgenda} onClick=${salvarAgenda}>
              ${salvandoAgenda ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </footer>
      </${ModalPadrao}>
    </${PainelRh}>
  `;
}
