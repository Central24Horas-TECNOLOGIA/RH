import { html, useEffect, useMemo, useState } from '../../infraestrutura-react.js';
import {
  alterarStatusUsuario,
  atualizarItemConfiguracao,
  atualizarPermissoesPerfil,
  atualizarUsuario,
  baixarLogsAuditoria,
  criarItemConfiguracao,
  criarUsuario,
  desativarItemConfiguracao,
  excluirUsuario,
  listarCatalogoConfiguracoes,
  listarLogsAuditoria,
  listarPerfis,
  listarPermissoes,
  listarUsuarios,
  redefinirSenhaUsuario,
} from '../../app/controlador-aplicacao.js';
import { baixarBlob, obterItensPaginados } from '../../utilitarios.js';
import { AcaoSair } from '../../shared/components/actions.js';
import { PageIntro, PainelRh } from '../../ui/componentes-compartilhados.js';

const ABAS = [
  { id: 'usuarios', label: 'Usuários', permissao: 'usuarios.visualizar', icon: 'group' },
  { id: 'perfis', label: 'Perfis e permissões', permissao: 'configuracoes.visualizar', icon: 'admin_panel_settings' },
  { id: 'catalogos', label: 'Regras reutilizáveis', permissao: 'configuracoes.visualizar', icon: 'rebase_edit' },
  { id: 'logs', label: 'Logs', permissao: 'logs.visualizar', icon: 'history_edu' },
];

const FORM_USUARIO_INICIAL = {
  id_usuario: '',
  nome: '',
  email: '',
  login: '',
  senha: '',
  perfil: 'estagiario',
  status: 'Ativo',
  justificativa: '',
};

const FORM_ITEM_INICIAL = {
  id_item: '',
  chave: '',
  nome: '',
  descricao: '',
  categoria: '',
  criticidade: 'operacional',
  tags: '',
  aplicavel: 'todos',
  permissoes: '',
  payloadJson: '{}',
  ativo: true,
  justificativa: '',
};

const CATALOGO_ICONS = {
  geral: 'settings',
  lgpd: 'shield_lock',
  motivos_eliminacao: 'delete',
  status_candidatos: 'person_check',
  modelos_email: 'mail',
  tipos_documentos: 'description',
  documentos_pacotes: 'folder_open',
  etapas: 'route',
  trilhas: 'timeline',
  provas: 'quiz',
  questoes: 'help',
  notificacoes: 'notifications',
};

const STATUS_USUARIO = ['', 'Ativo', 'Inativo', 'Bloqueado'];
const STATUS_ITEM = [
  { value: 'todos', label: 'Todos' },
  { value: 'ativo', label: 'Ativos' },
  { value: 'inativo', label: 'Inativos' },
];

function normalizarLista(valor) {
  return Array.isArray(valor) ? valor : [];
}

function normalizarBusca(valor) {
  return String(valor || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function formatarData(valor) {
  if (!valor) return '-';
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return String(valor);
  return data.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatarDataCurta(valor) {
  if (!valor) return 'Sem acesso';
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return String(valor);
  return data.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
  });
}

function hojeSemHora() {
  const data = new Date();
  data.setHours(0, 0, 0, 0);
  return data;
}

function textoCampos(...campos) {
  return normalizarBusca(campos.filter(Boolean).join(' '));
}

function contarPor(lista, predicado) {
  return normalizarLista(lista).filter(predicado).length;
}

function obterIniciais(nome, fallback = 'RH') {
  const partes = String(nome || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!partes.length) return fallback;
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return `${partes[0][0]}${partes[partes.length - 1][0]}`.toUpperCase();
}

function obterStatusTone(status) {
  const texto = normalizarBusca(status);
  if (texto === 'ativo' || texto === 'sucesso') return 'success';
  if (texto === 'bloqueado' || texto === 'falha' || texto === 'critica') return 'danger';
  if (texto === 'inativo' || texto === 'rascunho') return 'muted';
  return 'info';
}

function dividirCsv(valor) {
  return String(valor || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function formatarCsv(valor) {
  if (Array.isArray(valor)) return valor.join(', ');
  return String(valor || '');
}

function agruparPermissoes(permissoes) {
  return normalizarLista(permissoes).reduce((mapa, permissao) => {
    const modulo = permissao.modulo || 'Outros';
    mapa[modulo] = mapa[modulo] || [];
    mapa[modulo].push(permissao);
    return mapa;
  }, {});
}

function permissaoEstaAtiva(perfil, chave) {
  return normalizarLista(perfil?.permissoes).includes(chave);
}

function formatarPayloadLog(valor) {
  if (valor === undefined || valor === null || valor === '') return '-';
  if (typeof valor === 'object') return JSON.stringify(valor, null, 2);
  try {
    return JSON.stringify(JSON.parse(valor), null, 2);
  } catch (error) {
    return String(valor);
  }
}

function inferirCriticidadeLog(log) {
  if (log?.sucesso === false) return 'Falha';
  const acao = normalizarBusca(log?.acao);
  if (
    acao.includes('excluir') ||
    acao.includes('desativar') ||
    acao.includes('bloquear') ||
    acao.includes('permiss') ||
    acao.includes('senha')
  ) {
    return 'Crítica';
  }
  return 'Operacional';
}

function Icone({ name, className = '' }) {
  return html`
    <span class=${`material-symbols-outlined ${className}`.trim()} aria-hidden="true">
      ${name}
    </span>
  `;
}

function Badge({ label, tone = 'info' }) {
  return html`<span class=${`c24-badge is-${tone}`}>${label}</span>`;
}

function StatCard({ icon, label, value, helper, tone = 'blue' }) {
  return html`
    <article class=${`c24-stat-card is-${tone}`}>
      <span class="c24-stat-icon"><${Icone} name=${icon} /></span>
      <span class="c24-stat-label">${label}</span>
      <strong>${value}</strong>
      ${helper ? html`<small>${helper}</small>` : null}
    </article>
  `;
}

function StatGrid({ items }) {
  return html`
    <div class="c24-stat-grid">
      ${items.map(
        (item) => html`
          <${StatCard}
            key=${item.label}
            icon=${item.icon}
            label=${item.label}
            value=${item.value}
            helper=${item.helper}
            tone=${item.tone}
          />
        `,
      )}
    </div>
  `;
}

function EmptyPanel({ icon = 'inbox', title, text, action = null }) {
  return html`
    <div class="c24-empty-state">
      <${Icone} name=${icon} />
      <h3>${title}</h3>
      <p>${text}</p>
      ${action}
    </div>
  `;
}

function FilterField({ label, icon = 'filter_alt', children }) {
  return html`
    <label class="c24-filter-field">
      <span><${Icone} name=${icon} />${label}</span>
      ${children}
    </label>
  `;
}

function PaginacaoCompacta({ paginacao, onChange }) {
  if (!paginacao || paginacao.totalPaginas <= 1) return null;
  return html`
    <div class="c24-pagination">
      <span>
        ${paginacao.totalItens} itens, página ${paginacao.paginaAtual} de ${paginacao.totalPaginas}
      </span>
      <div class="c24-pagination-actions">
        ${Array.from({ length: paginacao.totalPaginas }, (_, indice) => indice + 1).map(
          (pagina) => html`
            <button
              key=${pagina}
              type="button"
              class=${`c24-page-btn ${pagina === paginacao.paginaAtual ? 'is-active' : ''}`.trim()}
              onClick=${() => onChange(pagina)}
            >
              ${pagina}
            </button>
          `,
        )}
      </div>
    </div>
  `;
}

function BotaoAba({ aba, ativa, onClick }) {
  return html`
    <button
      type="button"
      class=${`c24-pill-tab ${ativa ? 'is-active' : ''}`.trim()}
      onClick=${onClick}
    >
      <${Icone} name=${aba.icon} />
      ${aba.label}
    </button>
  `;
}

export function TelaConfiguracoesSistema({ controlador }) {
  const abasPermitidas = ABAS.filter((aba) => controlador.possuiPermissao(aba.permissao));
  const [abaAtiva, setAbaAtiva] = useState(abasPermitidas[0]?.id || 'usuarios');
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [feedback, setFeedback] = useState('');
  const [usuarios, setUsuarios] = useState([]);
  const [perfis, setPerfis] = useState([]);
  const [permissoes, setPermissoes] = useState([]);
  const [catalogo, setCatalogo] = useState([]);
  const [logs, setLogs] = useState([]);
  const [formUsuario, setFormUsuario] = useState(FORM_USUARIO_INICIAL);
  const [usuarioSelecionadoId, setUsuarioSelecionadoId] = useState('');
  const [criandoUsuario, setCriandoUsuario] = useState(false);
  const [filtrosUsuarios, setFiltrosUsuarios] = useState({
    busca: '',
    status: '',
    perfil: '',
    area: '',
    acesso: '',
  });
  const [paginaUsuarios, setPaginaUsuarios] = useState(1);
  const [perfilSelecionadoId, setPerfilSelecionadoId] = useState('');
  const [permissoesPerfilDraft, setPermissoesPerfilDraft] = useState([]);
  const [buscaPermissao, setBuscaPermissao] = useState('');
  const [mostrarSomenteAtivas, setMostrarSomenteAtivas] = useState(false);
  const [perfilComparadoId, setPerfilComparadoId] = useState('');
  const [justificativaPerfil, setJustificativaPerfil] = useState('');
  const [tipoCatalogo, setTipoCatalogo] = useState('');
  const [formItem, setFormItem] = useState(FORM_ITEM_INICIAL);
  const [filtrosCatalogo, setFiltrosCatalogo] = useState({ busca: '', status: 'todos' });
  const [filtrosLogs, setFiltrosLogs] = useState({
    busca: '',
    modulo: '',
    acao: '',
    usuario: '',
    criticidade: '',
    status: '',
    periodo: '',
  });
  const [paginaLogs, setPaginaLogs] = useState(1);
  const [logExpandidoId, setLogExpandidoId] = useState('');
  const [salvando, setSalvando] = useState(false);

  const permissoesPorModulo = useMemo(() => agruparPermissoes(permissoes), [permissoes]);
  const secaoCatalogoAtiva = useMemo(
    () => catalogo.find((secao) => secao.tipo === tipoCatalogo) || catalogo[0] || null,
    [catalogo, tipoCatalogo],
  );
  const perfilSelecionado = useMemo(
    () => perfis.find((perfil) => perfil.id === perfilSelecionadoId) || null,
    [perfis, perfilSelecionadoId],
  );
  const perfilComparado = useMemo(
    () => perfis.find((perfil) => perfil.id === perfilComparadoId) || null,
    [perfis, perfilComparadoId],
  );
  const abaRenderizada = abasPermitidas.some((aba) => aba.id === abaAtiva)
    ? abaAtiva
    : abasPermitidas[0]?.id || '';

  useEffect(() => {
    if (!abasPermitidas.some((aba) => aba.id === abaAtiva)) {
      setAbaAtiva(abasPermitidas[0]?.id || 'usuarios');
    }
  }, [abasPermitidas.map((aba) => aba.id).join('|'), abaAtiva]);

  useEffect(() => {
    if (!perfis.length) {
      setPerfilSelecionadoId('');
      return;
    }
    if (perfilSelecionadoId && !perfis.some((perfil) => perfil.id === perfilSelecionadoId)) {
      setPerfilSelecionadoId('');
    }
  }, [perfis, perfilSelecionadoId]);

  useEffect(() => {
    setPermissoesPerfilDraft(normalizarLista(perfilSelecionado?.permissoes));
    setJustificativaPerfil('');
  }, [perfilSelecionado?.id, normalizarLista(perfilSelecionado?.permissoes).join('|')]);

  useEffect(() => {
    if (criandoUsuario) return;
    if (!usuarios.length) {
      setUsuarioSelecionadoId('');
      setFormUsuario(FORM_USUARIO_INICIAL);
      return;
    }
    if (!usuarioSelecionadoId || !usuarios.some((usuario) => String(usuario.id_usuario) === String(usuarioSelecionadoId))) {
      setUsuarioSelecionadoId(usuarios[0].id_usuario);
    }
  }, [usuarios, usuarioSelecionadoId, criandoUsuario]);

  useEffect(() => {
    if (criandoUsuario) {
      setFormUsuario(FORM_USUARIO_INICIAL);
      return;
    }
    const usuario = usuarios.find((item) => String(item.id_usuario) === String(usuarioSelecionadoId));
    if (!usuario) return;
    setFormUsuario({
      ...FORM_USUARIO_INICIAL,
      ...usuario,
      perfil: usuario.perfil || usuario.perfil_id || FORM_USUARIO_INICIAL.perfil,
      senha: '',
      justificativa: '',
    });
  }, [usuarioSelecionadoId, criandoUsuario, usuarios]);

  const carregarTudo = async () => {
    setCarregando(true);
    setErro('');
    try {
      const [usuariosResp, perfisResp, permissoesResp, catalogoResp, logsResp] =
        await Promise.allSettled([
          controlador.possuiPermissao('usuarios.visualizar') ? listarUsuarios() : [],
          controlador.possuiPermissao('configuracoes.visualizar') ? listarPerfis() : [],
          controlador.possuiPermissao('configuracoes.visualizar') ? listarPermissoes() : [],
          controlador.possuiPermissao('configuracoes.visualizar')
            ? listarCatalogoConfiguracoes()
            : { sections: [] },
          controlador.possuiPermissao('logs.visualizar') ? listarLogsAuditoria({ limit: 160 }) : [],
        ]);

      if (usuariosResp.status === 'fulfilled') setUsuarios(normalizarLista(usuariosResp.value));
      if (perfisResp.status === 'fulfilled') setPerfis(normalizarLista(perfisResp.value));
      if (permissoesResp.status === 'fulfilled') setPermissoes(normalizarLista(permissoesResp.value));
      if (catalogoResp.status === 'fulfilled') {
        const secoes = normalizarLista(catalogoResp.value?.sections);
        setCatalogo(secoes);
        setTipoCatalogo((atual) =>
          secoes.some((secao) => secao.tipo === atual) ? atual : secoes[0]?.tipo || '',
        );
      }
      if (logsResp.status === 'fulfilled') setLogs(normalizarLista(logsResp.value));

      const falha = [usuariosResp, perfisResp, permissoesResp, catalogoResp, logsResp].find(
        (item) => item.status === 'rejected',
      );
      if (falha) {
        setErro(falha.reason?.message || 'Não foi possível carregar parte das configurações.');
      }
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregarTudo();
  }, []);

  const selecionarUsuario = (usuario) => {
    setCriandoUsuario(false);
    setUsuarioSelecionadoId(usuario.id_usuario);
  };

  const iniciarNovoUsuario = () => {
    setCriandoUsuario(true);
    setUsuarioSelecionadoId('');
    setFormUsuario(FORM_USUARIO_INICIAL);
  };

  const salvarUsuario = async (event) => {
    event.preventDefault();
    setSalvando(true);
    setErro('');
    setFeedback('');
    try {
      const payload = {
        nome: formUsuario.nome,
        email: formUsuario.email,
        login: formUsuario.login || formUsuario.email,
        perfil: formUsuario.perfil,
        status: formUsuario.status,
        justificativa: formUsuario.justificativa,
      };
      if (formUsuario.id_usuario) {
        await atualizarUsuario(formUsuario.id_usuario, payload);
        if (formUsuario.senha) {
          await redefinirSenhaUsuario(formUsuario.id_usuario, {
            senha: formUsuario.senha,
            justificativa: formUsuario.justificativa || 'Senha redefinida em Configurações.',
          });
        }
        setFeedback('Usuário atualizado.');
      } else {
        await criarUsuario({ ...payload, senha: formUsuario.senha });
        setFeedback('Usuário criado.');
      }
      setCriandoUsuario(false);
      setFormUsuario(FORM_USUARIO_INICIAL);
      await carregarTudo();
    } catch (error) {
      setErro(error?.message || 'Não foi possível salvar o usuário.');
    } finally {
      setSalvando(false);
    }
  };

  const alterarStatus = async (usuario, acao) => {
    setErro('');
    setFeedback('');
    try {
      await alterarStatusUsuario(usuario.id_usuario, {
        acao,
        justificativa: `Status alterado por Configurações: ${acao}.`,
      });
      setFeedback('Status do usuário atualizado.');
      await carregarTudo();
    } catch (error) {
      setErro(error?.message || 'Não foi possível alterar o status do usuário.');
    }
  };

  const desativarUsuario = async (usuario) => {
    if (!window.confirm(`Desativar o usuário ${usuario.nome || usuario.email}?`)) return;
    setErro('');
    setFeedback('');
    try {
      await excluirUsuario(usuario.id_usuario, 'Desativação lógica por Configurações.');
      setFeedback('Usuário desativado.');
      await carregarTudo();
    } catch (error) {
      setErro(error?.message || 'Não foi possível desativar o usuário.');
    }
  };

  const selecionarCatalogo = (tipo) => {
    setTipoCatalogo(tipo);
    setFormItem(FORM_ITEM_INICIAL);
    setFiltrosCatalogo({ busca: '', status: 'todos' });
  };

  const editarItem = (item) => {
    const payload = item.payload || {};
    setFormItem({
      id_item: item.id_item || '',
      chave: item.chave || '',
      nome: item.nome || '',
      descricao: item.descricao || '',
      categoria: item.categoria || '',
      criticidade: payload.criticidade || payload.severidade || 'operacional',
      tags: formatarCsv(payload.tags),
      aplicavel: payload.aplicavel || payload.aplicavel_a || 'todos',
      permissoes: formatarCsv(payload.permissoes),
      payloadJson: JSON.stringify(payload || {}, null, 2),
      ativo: Boolean(item.ativo),
      justificativa: '',
    });
  };

  const duplicarItem = (item) => {
    editarItem(item);
    setFormItem((atual) => ({
      ...atual,
      id_item: '',
      nome: `Cópia de ${item.nome || 'item'}`,
      chave: item.chave ? `${item.chave}_copia` : '',
      justificativa: 'Duplicação de regra reutilizável.',
    }));
  };

  const salvarItem = async (event) => {
    event.preventDefault();
    if (!secaoCatalogoAtiva) return;
    setSalvando(true);
    setErro('');
    setFeedback('');
    try {
      let payload = {};
      try {
        payload = JSON.parse(formItem.payloadJson || '{}');
      } catch (error) {
        throw new Error('O payload JSON da configuração está inválido.');
      }
      payload = {
        ...payload,
        criticidade: formItem.criticidade,
        tags: dividirCsv(formItem.tags),
        aplicavel: formItem.aplicavel,
        permissoes: dividirCsv(formItem.permissoes),
      };

      const data = {
        chave: formItem.chave,
        nome: formItem.nome,
        descricao: formItem.descricao,
        categoria: formItem.categoria,
        payload,
        ativo: formItem.ativo,
        justificativa: formItem.justificativa,
      };

      if (formItem.id_item) {
        await atualizarItemConfiguracao(secaoCatalogoAtiva.tipo, formItem.id_item, data);
        setFeedback('Configuração atualizada.');
      } else {
        await criarItemConfiguracao(secaoCatalogoAtiva.tipo, data);
        setFeedback('Configuração criada.');
      }
      setFormItem(FORM_ITEM_INICIAL);
      await carregarTudo();
    } catch (error) {
      setErro(error?.message || 'Não foi possível salvar a configuração.');
    } finally {
      setSalvando(false);
    }
  };

  const desativarItem = async (item) => {
    if (!secaoCatalogoAtiva) return;
    if (!window.confirm(`Arquivar ${item.nome || 'este item'}?`)) return;
    setErro('');
    setFeedback('');
    try {
      await desativarItemConfiguracao(
        secaoCatalogoAtiva.tipo,
        item.id_item,
        'Arquivamento lógico por Configurações.',
      );
      setFeedback('Configuração arquivada.');
      await carregarTudo();
    } catch (error) {
      setErro(error?.message || 'Não foi possível arquivar a configuração.');
    }
  };

  const salvarPermissoesPerfil = async () => {
    if (!perfilSelecionado) return;
    setSalvando(true);
    setErro('');
    setFeedback('');
    try {
      await atualizarPermissoesPerfil(perfilSelecionado.id, {
        permissoes: permissoesPerfilDraft,
        justificativa: justificativaPerfil,
      });
      setFeedback('Permissões do perfil atualizadas.');
      await carregarTudo();
    } catch (error) {
      setErro(error?.message || 'Não foi possível salvar as permissões do perfil.');
    } finally {
      setSalvando(false);
    }
  };

  const alternarPermissao = (chave) => {
    setPermissoesPerfilDraft((atuais) => {
      const conjunto = new Set(atuais);
      if (conjunto.has(chave)) conjunto.delete(chave);
      else conjunto.add(chave);
      return Array.from(conjunto).sort();
    });
  };

  const alterarGrupoPermissoes = (itens, ativo) => {
    setPermissoesPerfilDraft((atuais) => {
      const conjunto = new Set(atuais);
      normalizarLista(itens).forEach((permissao) => {
        if (ativo) conjunto.add(permissao.chave);
        else conjunto.delete(permissao.chave);
      });
      return Array.from(conjunto).sort();
    });
  };

  const selecionarPerfilPermissoes = (idPerfil) => {
    setPerfilSelecionadoId(idPerfil);
    setPerfilComparadoId((atual) => (atual === idPerfil ? '' : atual));
  };

  const abrirUsuariosDoPerfil = () => {
    if (!perfilSelecionado) return;
    setFiltrosUsuarios((atuais) => ({ ...atuais, perfil: perfilSelecionado.id }));
    setPaginaUsuarios(1);
    setAbaAtiva('usuarios');
  };

  const abrirUsuarioVinculado = (usuario) => {
    selecionarUsuario(usuario);
    setAbaAtiva('usuarios');
  };

  const exportarLogs = async () => {
    setErro('');
    try {
      const arquivo = await baixarLogsAuditoria();
      baixarBlob(arquivo.filename || 'logs_auditoria.csv', arquivo.blob);
    } catch (error) {
      setErro(error?.message || 'Não foi possível exportar os logs.');
    }
  };

  const usuariosFiltrados = useMemo(() => {
    const busca = normalizarBusca(filtrosUsuarios.busca);
    const status = normalizarBusca(filtrosUsuarios.status);
    const perfil = normalizarBusca(filtrosUsuarios.perfil);
    const area = normalizarBusca(filtrosUsuarios.area);
    const acesso = filtrosUsuarios.acesso;
    const agora = Date.now();
    return usuarios.filter((usuario) => {
      const texto = textoCampos(
        usuario.nome,
        usuario.email,
        usuario.login,
        usuario.perfil_nome,
        usuario.perfil,
        usuario.nivel,
        usuario.area,
        usuario.operacao,
        usuario.departamento,
      );
      if (busca && !texto.includes(busca)) return false;
      if (status && normalizarBusca(usuario.status) !== status) return false;
      if (perfil && normalizarBusca(usuario.perfil) !== perfil) return false;
      if (area) {
        const textoArea = textoCampos(usuario.area, usuario.operacao, usuario.departamento);
        if (!textoArea.includes(area)) return false;
      }
      if (acesso === 'sem_acesso' && usuario.ultimo_acesso) return false;
      if (acesso === 'recentes') {
        const data = new Date(usuario.ultimo_acesso);
        if (Number.isNaN(data.getTime()) || agora - data.getTime() > 1000 * 60 * 60 * 24 * 7) {
          return false;
        }
      }
      return true;
    });
  }, [usuarios, filtrosUsuarios]);

  const paginacaoUsuarios = useMemo(
    () => obterItensPaginados(usuariosFiltrados, paginaUsuarios, 7),
    [usuariosFiltrados, paginaUsuarios],
  );

  const usuariosPorPerfil = useMemo(() => {
    return usuarios.reduce((mapa, usuario) => {
      const id = usuario.perfil || usuario.perfil_id || '';
      if (!id) return mapa;
      mapa[id] = mapa[id] || [];
      mapa[id].push(usuario);
      return mapa;
    }, {});
  }, [usuarios]);

  const contagemUsuariosPorPerfil = useMemo(() => {
    return Object.fromEntries(
      Object.entries(usuariosPorPerfil).map(([idPerfil, usuariosPerfil]) => [idPerfil, usuariosPerfil.length]),
    );
  }, [usuariosPorPerfil]);

  const perfilMaisUsado = useMemo(() => {
    const ordenados = Object.entries(contagemUsuariosPorPerfil).sort((a, b) => b[1] - a[1]);
    const idPerfil = ordenados[0]?.[0] || '';
    return perfis.find((perfil) => perfil.id === idPerfil)?.nome || '-';
  }, [contagemUsuariosPorPerfil, perfis]);

  const usuariosPerfilSelecionado = useMemo(
    () => (perfilSelecionado ? usuariosPorPerfil[perfilSelecionado.id] || [] : []),
    [perfilSelecionado?.id, usuariosPorPerfil],
  );

  const permissoesOriginaisPerfil = useMemo(
    () => normalizarLista(perfilSelecionado?.permissoes),
    [perfilSelecionado?.id, perfilSelecionado?.permissoes],
  );

  const alteracoesPendentesPerfil = useMemo(() => {
    const originais = new Set(permissoesOriginaisPerfil);
    const rascunho = new Set(permissoesPerfilDraft);
    let total = 0;
    rascunho.forEach((chave) => {
      if (!originais.has(chave)) total += 1;
    });
    originais.forEach((chave) => {
      if (!rascunho.has(chave)) total += 1;
    });
    return total;
  }, [permissoesOriginaisPerfil, permissoesPerfilDraft]);

  const itensCatalogo = normalizarLista(secaoCatalogoAtiva?.items);
  const itensCatalogoFiltrados = useMemo(() => {
    const busca = normalizarBusca(filtrosCatalogo.busca);
    const status = filtrosCatalogo.status;
    return itensCatalogo.filter((item) => {
      const texto = textoCampos(item.nome, item.chave, item.descricao, item.categoria);
      if (busca && !texto.includes(busca)) return false;
      if (status === 'ativo' && !item.ativo) return false;
      if (status === 'inativo' && item.ativo) return false;
      return true;
    });
  }, [itensCatalogo, filtrosCatalogo]);

  const itemEmEdicao = useMemo(
    () => itensCatalogo.find((item) => String(item.id_item) === String(formItem.id_item)) || null,
    [itensCatalogo, formItem.id_item],
  );

  const logsFiltrados = useMemo(() => {
    const busca = normalizarBusca(filtrosLogs.busca);
    const modulo = normalizarBusca(filtrosLogs.modulo);
    const acao = normalizarBusca(filtrosLogs.acao);
    const usuario = normalizarBusca(filtrosLogs.usuario);
    const criticidade = normalizarBusca(filtrosLogs.criticidade);
    const statusLog = filtrosLogs.status;
    const inicioHoje = hojeSemHora().getTime();
    return logs.filter((log) => {
      const texto = textoCampos(
        log.nome_usuario,
        log.email_usuario,
        log.perfil_nome,
        log.modulo,
        log.acao,
        log.entidade,
        log.entidade_id,
        log.justificativa,
        log.origem,
      );
      if (busca && !texto.includes(busca)) return false;
      if (modulo && !normalizarBusca(log.modulo).includes(modulo)) return false;
      if (acao && !normalizarBusca(log.acao).includes(acao)) return false;
      if (usuario && !textoCampos(log.nome_usuario, log.email_usuario).includes(usuario)) return false;
      if (criticidade && normalizarBusca(inferirCriticidadeLog(log)) !== criticidade) return false;
      if (statusLog === 'sucesso' && log.sucesso === false) return false;
      if (statusLog === 'falha' && log.sucesso !== false) return false;
      if (filtrosLogs.periodo) {
        const data = new Date(log.data_hora);
        if (Number.isNaN(data.getTime())) return false;
        if (filtrosLogs.periodo === 'hoje' && data.getTime() < inicioHoje) return false;
        if (filtrosLogs.periodo === '7d' && Date.now() - data.getTime() > 1000 * 60 * 60 * 24 * 7) return false;
        if (filtrosLogs.periodo === '30d' && Date.now() - data.getTime() > 1000 * 60 * 60 * 24 * 30) return false;
      }
      return true;
    });
  }, [logs, filtrosLogs]);

  const paginacaoLogs = useMemo(
    () => obterItensPaginados(logsFiltrados, paginaLogs, 9),
    [logsFiltrados, paginaLogs],
  );

  const logsConfiguracoesRecentes = useMemo(
    () =>
      logs
        .filter((log) => normalizarBusca(log.modulo).includes('configur'))
        .slice(0, 4),
    [logs],
  );

  const modulosLogs = useMemo(
    () => Array.from(new Set(logs.map((log) => log.modulo).filter(Boolean))).sort(),
    [logs],
  );

  const acoesLogs = useMemo(
    () => Array.from(new Set(logs.map((log) => log.acao).filter(Boolean))).sort(),
    [logs],
  );

  const metricasGerais = [
    {
      icon: 'group',
      label: 'Usuários ativos',
      value: contarPor(usuarios, (usuario) => normalizarBusca(usuario.status) === 'ativo'),
      helper: `${usuarios.length} cadastrados`,
      tone: 'blue',
    },
    {
      icon: 'admin_panel_settings',
      label: 'Perfis',
      value: perfis.length,
      helper: `${permissoes.length} permissões mapeadas`,
      tone: 'indigo',
    },
    {
      icon: 'rule_settings',
      label: 'Regras ativas',
      value: catalogo.reduce(
        (total, secao) => total + contarPor(secao.items, (item) => item.ativo),
        0,
      ),
      helper: `${catalogo.length} catálogos`,
      tone: 'green',
    },
    {
      icon: 'warning',
      label: 'Alertas',
      value: contarPor(logs, (log) => log.sucesso === false),
      helper: 'Falhas em auditoria',
      tone: 'yellow',
    },
  ];

  const renderAuditoriaRecente = (itens = logsConfiguracoesRecentes) => html`
    <section class="c24-card settings-audit-strip">
      <header class="c24-card-header compact">
        <div>
          <span class="c24-eyebrow">Auditoria recente</span>
          <h3>Últimas ações administrativas</h3>
        </div>
        ${controlador.possuiPermissao('logs.visualizar')
          ? html`
              <button type="button" class="c24-link-btn" onClick=${() => setAbaAtiva('logs')}>
                Ver todas as ações
              </button>
            `
          : null}
      </header>
      ${itens.length
        ? html`
            <div class="settings-audit-list">
              ${itens.map(
                (log) => html`
                  <article class="settings-audit-item" key=${log.id_log}>
                    <span class="settings-audit-icon"><${Icone} name="history" /></span>
                    <div>
                      <strong>${log.acao || 'Ação registrada'}</strong>
                      <small>${log.nome_usuario || '-'} - ${formatarData(log.data_hora)}</small>
                    </div>
                    <${Badge}
                      label=${inferirCriticidadeLog(log)}
                      tone=${obterStatusTone(inferirCriticidadeLog(log))}
                    />
                  </article>
                `,
              )}
            </div>
          `
        : html`
            <${EmptyPanel}
              icon="history"
              title="Sem auditoria recente"
              text="As ações administrativas aparecerão aqui quando forem registradas."
            />
          `}
    </section>
  `;

  const renderUsuarios = () => {
    const podeCriar = controlador.possuiPermissao('usuarios.criar');
    const podeEditar = controlador.possuiPermissao('usuarios.editar');
    const podeSalvar = formUsuario.id_usuario ? podeEditar : podeCriar;
    return html`
      <div class="settings-admin-shell">
        <${StatGrid}
          items=${[
            { icon: 'group', label: 'Total de usuários', value: usuarios.length, helper: 'Contas registradas', tone: 'blue' },
            {
              icon: 'check_circle',
              label: 'Ativos',
              value: contarPor(usuarios, (usuario) => normalizarBusca(usuario.status) === 'ativo'),
              helper: 'Com acesso liberado',
              tone: 'green',
            },
            {
              icon: 'block',
              label: 'Inativos ou bloqueados',
              value: contarPor(usuarios, (usuario) => normalizarBusca(usuario.status) !== 'ativo'),
              helper: 'Requerem revisão',
              tone: 'yellow',
            },
            {
              icon: 'person_add',
              label: 'Novos este mês',
              value: contarPor(usuarios, (usuario) => {
                const data = new Date(usuario.criado_em);
                const agora = new Date();
                return !Number.isNaN(data.getTime()) && data.getMonth() === agora.getMonth() && data.getFullYear() === agora.getFullYear();
              }),
              helper: 'Criados no mes atual',
              tone: 'indigo',
            },
          ]}
        />

        <div class="settings-users-workspace">
          <section class="c24-card settings-list-panel">
            <header class="c24-card-header">
              <div>
                <span class="c24-eyebrow">Acessos</span>
                <h3>Usuários do sistema</h3>
                <p>${usuariosFiltrados.length} resultado(s) com os filtros atuais.</p>
              </div>
              <div class="settings-card-actions">
                <button type="button" class="btn btn-primary btn-sm" disabled=${!podeCriar} onClick=${iniciarNovoUsuario}>
                  <${Icone} name="person_add" /> Novo usuário
                </button>
                <button type="button" class="btn btn-outline-secondary btn-sm" onClick=${carregarTudo}>
                  <${Icone} name="refresh" /> Atualizar
                </button>
              </div>
            </header>

            <div class="c24-filter-bar settings-users-filter">
              <${FilterField} label="Buscar" icon="search">
                <input
                  class="form-control"
                  placeholder="Nome, e-mail ou login"
                  value=${filtrosUsuarios.busca}
                  onInput=${(event) => {
                    setFiltrosUsuarios({ ...filtrosUsuarios, busca: event.target.value });
                    setPaginaUsuarios(1);
                  }}
                />
              </${FilterField}>
              <${FilterField} label="Status">
                <select
                  class="form-select"
                  value=${filtrosUsuarios.status}
                  onChange=${(event) => {
                    setFiltrosUsuarios({ ...filtrosUsuarios, status: event.target.value });
                    setPaginaUsuarios(1);
                  }}
                >
                  ${STATUS_USUARIO.map(
                    (status) => html`<option key=${status || 'todos'} value=${status}>${status || 'Todos'}</option>`,
                  )}
                </select>
              </${FilterField}>
              <${FilterField} label="Perfil" icon="badge">
                <select
                  class="form-select"
                  value=${filtrosUsuarios.perfil}
                  onChange=${(event) => {
                    setFiltrosUsuarios({ ...filtrosUsuarios, perfil: event.target.value });
                    setPaginaUsuarios(1);
                  }}
                >
                  <option value="">Todos</option>
                  ${perfis.map(
                    (perfil) => html`<option key=${perfil.id} value=${perfil.id}>${perfil.nome}</option>`,
                  )}
                </select>
              </${FilterField}>
              <${FilterField} label="Area/op." icon="account_tree">
                <input
                  class="form-control"
                  placeholder="Área ou operação"
                  value=${filtrosUsuarios.area}
                  onInput=${(event) => {
                    setFiltrosUsuarios({ ...filtrosUsuarios, area: event.target.value });
                    setPaginaUsuarios(1);
                  }}
                />
              </${FilterField}>
              <${FilterField} label="Acesso" icon="schedule">
                <select
                  class="form-select"
                  value=${filtrosUsuarios.acesso}
                  onChange=${(event) => {
                    setFiltrosUsuarios({ ...filtrosUsuarios, acesso: event.target.value });
                    setPaginaUsuarios(1);
                  }}
                >
                  <option value="">Todos</option>
                  <option value="recentes">Últimos 7 dias</option>
                  <option value="sem_acesso">Sem acesso</option>
                </select>
              </${FilterField}>
              <button
                type="button"
                class="btn btn-outline-secondary btn-sm"
                onClick=${() => {
                  setFiltrosUsuarios({ busca: '', status: '', perfil: '', area: '', acesso: '' });
                  setPaginaUsuarios(1);
                }}
              >
                Limpar
              </button>
            </div>

            ${paginacaoUsuarios.itens.length
              ? html`
                  <div class="settings-user-list">
                    ${paginacaoUsuarios.itens.map(
                      (usuario) => {
                        const ativo = normalizarBusca(usuario.status) === 'ativo';
                        return html`
                          <article
                            key=${usuario.id_usuario}
                            class=${`settings-user-row ${String(usuario.id_usuario) === String(usuarioSelecionadoId) ? 'is-active' : ''}`.trim()}
                            onClick=${() => selecionarUsuario(usuario)}
                          >
                            <span class="settings-avatar">${obterIniciais(usuario.nome || usuario.email)}</span>
                            <div class="settings-row-main">
                              <strong>${usuario.nome || '-'}</strong>
                              <span>${usuario.email || usuario.login || '-'}</span>
                              <div class="settings-row-meta">
                                <small>${usuario.perfil_nome || usuario.perfil || '-'}</small>
                                <small>${formatarDataCurta(usuario.ultimo_acesso)}</small>
                              </div>
                            </div>
                            <div class="settings-row-status">
                              <${Badge} label=${usuario.status || 'Sem status'} tone=${obterStatusTone(usuario.status)} />
                              <div class="settings-row-actions">
                                <button
                                  type="button"
                                  class="c24-icon-btn"
                                  title=${ativo ? 'Bloquear' : 'Ativar'}
                                  onClick=${(event) => {
                                    event.stopPropagation();
                                    alterarStatus(usuario, ativo ? 'bloquear' : 'ativar');
                                  }}
                                >
                                  <${Icone} name=${ativo ? 'lock' : 'check_circle'} />
                                </button>
                                <button
                                  type="button"
                                  class="c24-icon-btn is-danger"
                                  title="Desativar"
                                  disabled=${!controlador.possuiPermissao('usuarios.excluir')}
                                  onClick=${(event) => {
                                    event.stopPropagation();
                                    desativarUsuario(usuario);
                                  }}
                                >
                                  <${Icone} name="person_remove" />
                                </button>
                              </div>
                            </div>
                          </article>
                        `;
                      },
                    )}
                  </div>
                  <${PaginacaoCompacta} paginacao=${paginacaoUsuarios} onChange=${setPaginaUsuarios} />
                `
              : html`
                  <${EmptyPanel}
                    icon="group_off"
                    title="Sem usuários"
                    text="Nenhum usuário corresponde aos filtros atuais."
                    action=${html`<button type="button" class="btn btn-primary btn-sm" disabled=${!podeCriar} onClick=${iniciarNovoUsuario}>Novo usuário</button>`}
                  />
                `}
          </section>

          <section class="c24-card settings-detail-panel">
            <header class="c24-card-header">
              <div>
                <span class="c24-eyebrow">${formUsuario.id_usuario ? 'Edição' : 'Cadastro'}</span>
                <h3>${formUsuario.id_usuario ? 'Detalhes do usuário' : 'Novo usuário'}</h3>
                <p>Dados, perfil, senha e status ficam conectados ao controle de acesso real.</p>
              </div>
              ${formUsuario.id_usuario
                ? html`<${Badge} label=${formUsuario.status || 'Sem status'} tone=${obterStatusTone(formUsuario.status)} />`
                : null}
            </header>

            <form class="c24-form-grid" onSubmit=${salvarUsuario}>
              <label>
                <span>Nome</span>
                <input
                  class="form-control"
                  required
                  value=${formUsuario.nome}
                  onInput=${(event) => setFormUsuario({ ...formUsuario, nome: event.target.value })}
                />
              </label>
              <label>
                <span>E-mail</span>
                <input
                  class="form-control"
                  type="email"
                  required
                  value=${formUsuario.email}
                  onInput=${(event) => setFormUsuario({ ...formUsuario, email: event.target.value })}
                />
              </label>
              <label>
                <span>Login</span>
                <input
                  class="form-control"
                  placeholder="Usa o e-mail se vazio"
                  value=${formUsuario.login}
                  onInput=${(event) => setFormUsuario({ ...formUsuario, login: event.target.value })}
                />
              </label>
              <label>
                <span>Perfil</span>
                <select
                  class="form-select"
                  value=${formUsuario.perfil}
                  onChange=${(event) => setFormUsuario({ ...formUsuario, perfil: event.target.value })}
                >
                  ${perfis.map(
                    (perfil) => html`<option key=${perfil.id} value=${perfil.id}>${perfil.nome} - ${perfil.nivel}</option>`,
                  )}
                </select>
              </label>
              <label>
                <span>Status</span>
                <select
                  class="form-select"
                  value=${formUsuario.status}
                  onChange=${(event) => setFormUsuario({ ...formUsuario, status: event.target.value })}
                >
                  <option>Ativo</option>
                  <option>Inativo</option>
                  <option>Bloqueado</option>
                </select>
              </label>
              <label>
                <span>${formUsuario.id_usuario ? 'Nova senha' : 'Senha inicial'}</span>
                <input
                  class="form-control"
                  type="password"
                  required=${!formUsuario.id_usuario}
                  value=${formUsuario.senha}
                  onInput=${(event) => setFormUsuario({ ...formUsuario, senha: event.target.value })}
                />
              </label>
              <label class="is-wide">
                <span>Justificativa</span>
                <textarea
                  class="form-control"
                  rows="2"
                  placeholder="Explique alterações sensíveis, como perfil, status ou senha."
                  value=${formUsuario.justificativa}
                  onInput=${(event) => setFormUsuario({ ...formUsuario, justificativa: event.target.value })}
                ></textarea>
              </label>
              <footer class="settings-form-footer is-wide">
                <button type="submit" class="btn btn-primary" disabled=${salvando || !podeSalvar}>
                  <${Icone} name="check" /> ${salvando ? 'Salvando...' : 'Salvar'}
                </button>
                <button type="button" class="btn btn-outline-secondary" onClick=${iniciarNovoUsuario}>
                  Limpar
                </button>
                ${formUsuario.id_usuario
                  ? html`
                      <button
                        type="button"
                        class="btn btn-outline-danger"
                        disabled=${!controlador.possuiPermissao('usuarios.desativar')}
                        onClick=${() => desativarUsuario(formUsuario)}
                      >
                        Desativar
                      </button>
                    `
                  : null}
              </footer>
            </form>
          </section>
        </div>
      </div>
    `;
  };

  const renderPerfis = () => {
    const permissoesFiltradasPorModulo = Object.entries(permissoesPorModulo).map(([modulo, itens]) => {
      const filtrados = itens.filter((permissao) => {
        const ativa = permissoesPerfilDraft.includes(permissao.chave);
        if (mostrarSomenteAtivas && !ativa) return false;
        const busca = normalizarBusca(buscaPermissao);
        if (!busca) return true;
        return textoCampos(permissao.chave, permissao.descricao, permissao.modulo).includes(busca);
      });
      return [modulo, filtrados];
    }).filter(([, itens]) => itens.length);

    const renderPreviaUsuarios = (perfil) => {
      const usuariosPerfil = usuariosPorPerfil[perfil.id] || [];
      const exibidos = usuariosPerfil.slice(0, 3);
      return html`
        <div class="settings-profile-users-preview">
          <span>Usuários</span>
          <div class="settings-profile-avatar-stack">
            ${exibidos.length
              ? exibidos.map(
                  (usuario) => html`
                    <span
                      class="settings-profile-user-avatar"
                      key=${usuario.id_usuario}
                      title=${usuario.nome || usuario.email || 'Usuário'}
                    >
                      ${obterIniciais(usuario.nome || usuario.email)}
                    </span>
                  `,
                )
              : html`<span class="settings-profile-users-empty">Sem usuários</span>`}
            ${usuariosPerfil.length > exibidos.length
              ? html`<span class="settings-profile-user-more">+${usuariosPerfil.length - exibidos.length}</span>`
              : null}
          </div>
        </div>
      `;
    };

    return html`
      <div class="settings-admin-shell settings-profiles-page">
        <${StatGrid}
          items=${[
            { icon: 'badge', label: 'Total de perfis', value: perfis.length, helper: `${perfilMaisUsado} em destaque`, tone: 'blue' },
            { icon: 'shield', label: 'Permissões cadastradas', value: permissoes.length, helper: `${contarPor(permissoes, (item) => item.critica)} críticas`, tone: 'yellow' },
            { icon: 'groups', label: 'Usuários vinculados', value: usuarios.length, helper: 'Base real cadastrada', tone: 'green' },
            {
              icon: 'pending_actions',
              label: 'Alterações pendentes',
              value: alteracoesPendentesPerfil,
              helper: perfilSelecionado?.nome || 'Nenhum perfil selecionado',
              tone: 'indigo',
            },
          ]}
        />

        <div class="settings-profile-workspace">
          <section class="c24-card">
            <header class="c24-card-header compact">
              <div>
                <span class="c24-eyebrow">Perfis</span>
                <h3>Escopos de acesso</h3>
                <p>Selecione um perfil para consultar usuários vinculados e editar a matriz de permissões.</p>
              </div>
            </header>
            <div class="settings-profile-list">
              ${perfis.length
                ? perfis.map(
                    (perfil) => {
                      const selecionado = perfilSelecionado?.id === perfil.id;
                      return html`
                        <article
                          key=${perfil.id}
                          class=${`settings-profile-card ${selecionado ? 'is-active' : ''}`.trim()}
                        >
                          <div class="settings-profile-card-top">
                            <span class="settings-profile-icon"><${Icone} name="badge" /></span>
                            <span class="settings-profile-title">
                              <strong>${perfil.nome}</strong>
                              <small>${normalizarLista(perfil.permissoes).length} permissões</small>
                            </span>
                            <span class="settings-profile-badges">
                              <${Badge} label=${perfil.nivel || 'Nivel'} tone="info" />
                              ${selecionado ? html`<${Badge} label="Selecionado" tone="success" />` : null}
                            </span>
                          </div>
                          <p>${perfil.descricao || '-'}</p>
                          <div class="settings-profile-card-meta">
                            <span>${contagemUsuariosPorPerfil[perfil.id] || 0} usuário(s) vinculados</span>
                            ${renderPreviaUsuarios(perfil)}
                          </div>
                          <button
                            type="button"
                            class=${`btn btn-sm ${selecionado ? 'btn-primary' : 'btn-outline-primary'}`.trim()}
                            onClick=${() => selecionarPerfilPermissoes(perfil.id)}
                          >
                            <${Icone} name="admin_panel_settings" />
                            ${selecionado ? 'Selecionado' : 'Gerenciar permissões'}
                          </button>
                        </article>
                      `;
                    },
                  )
                : html`
                    <${EmptyPanel}
                      icon="group_off"
                      title="Sem perfis"
                      text="Nenhum perfil foi retornado pelo backend."
                    />
                  `}
            </div>
          </section>

          ${perfilSelecionado
            ? html`
                <section class="c24-card settings-linked-users-card">
                  <header class="c24-card-header compact">
                    <div>
                      <span class="c24-eyebrow">Usuários vinculados</span>
                      <h3>${perfilSelecionado.nome}</h3>
                      <p>Usuários com este escopo de acesso.</p>
                    </div>
                    <div class="settings-card-actions">
                      <${Badge} label=${`${usuariosPerfilSelecionado.length} usuário(s)`} tone="info" />
                      ${usuariosPerfilSelecionado.length
                        ? html`
                            <button type="button" class="btn btn-outline-primary btn-sm" onClick=${abrirUsuariosDoPerfil}>
                              Ver todos
                            </button>
                          `
                        : null}
                    </div>
                  </header>
                  ${usuariosPerfilSelecionado.length
                    ? html`
                        <div class="settings-linked-user-list">
                          ${usuariosPerfilSelecionado.slice(0, 5).map(
                            (usuario) => {
                              const areaUsuario = usuario.operacao || usuario.area || usuario.departamento || '';
                              return html`
                                <article class="settings-linked-user-row" key=${usuario.id_usuario}>
                                  <span class="settings-avatar">${obterIniciais(usuario.nome || usuario.email)}</span>
                                  <div class="settings-row-main">
                                    <strong>${usuario.nome || '-'}</strong>
                                    <span>${usuario.email || usuario.login || '-'}</span>
                                    <div class="settings-row-meta">
                                      <small>${usuario.status || 'Sem status'}</small>
                                      ${areaUsuario ? html`<small>${areaUsuario}</small>` : null}
                                    </div>
                                  </div>
                                  <div class="settings-row-status">
                                    <${Badge} label=${usuario.status || 'Sem status'} tone=${obterStatusTone(usuario.status)} />
                                    <button
                                      type="button"
                                      class="c24-icon-btn"
                                      title="Abrir usuário"
                                      onClick=${() => abrirUsuarioVinculado(usuario)}
                                    >
                                      <${Icone} name="open_in_new" />
                                    </button>
                                  </div>
                                </article>
                              `;
                            },
                          )}
                        </div>
                      `
                    : html`
                        <p class="settings-linked-users-empty">
                          Este perfil ainda não possui usuários vinculados.
                        </p>
                      `}
                </section>

                <section class="c24-card settings-permission-panel">
                  <header class="c24-card-header settings-permission-head">
                    <div>
                      <span class="c24-eyebrow">Matriz granular</span>
                      <h3>${perfilSelecionado.nome}</h3>
                      <p>${perfilSelecionado.descricao || 'Revise as permissões deste perfil.'}</p>
                    </div>
                    <div class="settings-card-actions">
                      <${Badge}
                        label=${`${permissoesPerfilDraft.length} ativas`}
                        tone=${permissoesPerfilDraft.length ? 'success' : 'muted'}
                      />
                      <${Badge}
                        label=${`${alteracoesPendentesPerfil} pendente(s)`}
                        tone=${alteracoesPendentesPerfil ? 'danger' : 'muted'}
                      />
                      <button
                        type="button"
                        class="btn btn-primary btn-sm"
                        disabled=${salvando || !controlador.possuiPermissao('configuracoes.editar')}
                        onClick=${salvarPermissoesPerfil}
                      >
                        <${Icone} name="save" /> ${salvando ? 'Salvando...' : 'Salvar matriz'}
                      </button>
                      <button
                        type="button"
                        class="btn btn-outline-secondary btn-sm"
                        disabled=${salvando}
                        onClick=${() => setPermissoesPerfilDraft(permissoesOriginaisPerfil)}
                      >
                        <${Icone} name="restore" /> Restaurar
                      </button>
                    </div>
                  </header>

                  <div class="c24-filter-bar settings-permission-filter">
                    <${FilterField} label="Buscar permissão" icon="search">
                      <input
                        class="form-control"
                        placeholder="Módulo, chave ou descrição"
                        value=${buscaPermissao}
                        onInput=${(event) => setBuscaPermissao(event.target.value)}
                      />
                    </${FilterField}>
                    <${FilterField} label="Comparar com" icon="compare_arrows">
                      <select
                        class="form-select"
                        value=${perfilComparadoId}
                        onChange=${(event) => setPerfilComparadoId(event.target.value)}
                      >
                        <option value="">Não comparar</option>
                        ${perfis
                          .filter((perfil) => perfil.id !== perfilSelecionado.id)
                          .map((perfil) => html`<option key=${perfil.id} value=${perfil.id}>${perfil.nome}</option>`)}
                      </select>
                    </${FilterField}>
                    <label class="c24-check-filter settings-active-filter">
                      <input
                        type="checkbox"
                        checked=${mostrarSomenteAtivas}
                        onChange=${(event) => setMostrarSomenteAtivas(event.target.checked)}
                      />
                      Ver apenas ativas
                    </label>
                    <${FilterField} label="Justificativa da alteração" icon="edit_note">
                      <input
                        class="form-control"
                        value=${justificativaPerfil}
                        placeholder="Opcional, recomendado para alterações críticas"
                        onInput=${(event) => setJustificativaPerfil(event.target.value)}
                      />
                    </${FilterField}>
                  </div>

                  <div class="settings-permission-groups">
                    ${permissoesFiltradasPorModulo.length
                      ? permissoesFiltradasPorModulo.map(
                          ([modulo, itens]) => {
                            const ativos = contarPor(itens, (permissao) => permissoesPerfilDraft.includes(permissao.chave));
                            return html`
                              <details class="settings-permission-group" key=${modulo} open>
                                <summary>
                                  <span>
                                    <strong>${modulo}</strong>
                                    <small>${ativos}/${itens.length} ativas</small>
                                  </span>
                                  <span class="settings-group-actions">
                                    <button
                                      type="button"
                                      onClick=${(event) => {
                                        event.preventDefault();
                                        event.stopPropagation();
                                        alterarGrupoPermissoes(itens, true);
                                      }}
                                    >
                                      Marcar grupo
                                    </button>
                                    <button
                                      type="button"
                                      onClick=${(event) => {
                                        event.preventDefault();
                                        event.stopPropagation();
                                        alterarGrupoPermissoes(itens, false);
                                      }}
                                    >
                                      Limpar grupo
                                    </button>
                                  </span>
                                </summary>
                                <div class="settings-permission-list">
                                  ${itens.map(
                                    (permissao) => {
                                      const ativa = permissoesPerfilDraft.includes(permissao.chave);
                                      const ativaComparado = perfilComparado ? permissaoEstaAtiva(perfilComparado, permissao.chave) : null;
                                      return html`
                                        <label class=${`settings-permission-row ${ativa ? 'is-active' : ''}`.trim()} key=${permissao.chave}>
                                          <input
                                            type="checkbox"
                                            checked=${ativa}
                                            onChange=${() => alternarPermissao(permissao.chave)}
                                          />
                                          <span class="settings-permission-copy">
                                            <strong>${permissao.chave}</strong>
                                            <small>${permissao.descricao || '-'}</small>
                                          </span>
                                          <span class="settings-permission-badges">
                                            <${Badge} label=${permissao.critica ? 'Crítica' : 'Operacional'} tone=${permissao.critica ? 'danger' : 'muted'} />
                                            ${perfilComparado
                                              ? html`<${Badge} label=${ativaComparado ? 'no comparado' : 'fora do comparado'} tone=${ativaComparado ? 'success' : 'muted'} />`
                                              : null}
                                          </span>
                                        </label>
                                      `;
                                    },
                                  )}
                                </div>
                              </details>
                            `;
                          },
                        )
                      : html`
                          <${EmptyPanel}
                            icon="shield_off"
                            title="Sem permissões"
                            text="Nenhuma permissão corresponde ao filtro atual."
                          />
                        `}
                  </div>
                </section>
              `
            : html`
                <section class="c24-card settings-profile-empty-card">
                  <${EmptyPanel}
                    icon="rule"
                    title="Selecione um perfil"
                    text="Selecione um perfil para visualizar e editar permissões."
                  />
                </section>
              `}
        </div>
      </div>
    `;
  };

  const renderCatalogos = () => html`
    <div class="settings-admin-shell">
      <${StatGrid} items=${metricasGerais} />

      <div class="settings-catalog-workspace">
        <section class="c24-card settings-area-panel">
          <header class="c24-card-header compact">
            <div>
              <span class="c24-eyebrow">Catálogos</span>
              <h3>Áreas de configuração</h3>
            </div>
          </header>
          <div class="settings-area-list">
            ${catalogo.map(
              (secao) => {
                const ativos = contarPor(secao.items, (item) => item.ativo);
                return html`
                  <button
                    type="button"
                    key=${secao.tipo}
                    class=${`settings-area-button ${secaoCatalogoAtiva?.tipo === secao.tipo ? 'is-active' : ''}`.trim()}
                    onClick=${() => selecionarCatalogo(secao.tipo)}
                  >
                    <span><${Icone} name=${CATALOGO_ICONS[secao.tipo] || 'settings'} /></span>
                    <strong>${secao.label}</strong>
                    <small>${ativos}/${normalizarLista(secao.items).length} ativos</small>
                  </button>
                `;
              },
            )}
          </div>
        </section>

        <section class="c24-card settings-rule-form-card">
          <header class="c24-card-header">
            <div>
              <span class="c24-eyebrow">${secaoCatalogoAtiva?.label || 'Catálogo'}</span>
              <h3>${formItem.id_item ? 'Editar regra' : 'Nova regra'}</h3>
              <p>Campos principais ficam no topo; o JSON avançado preserva integrações existentes.</p>
            </div>
            <div class="settings-card-actions">
              ${itemEmEdicao
                ? html`
                    <button type="button" class="btn btn-outline-secondary btn-sm" onClick=${() => duplicarItem(itemEmEdicao)}>
                      <${Icone} name="content_copy" /> Duplicar
                    </button>
                    <button type="button" class="btn btn-outline-danger btn-sm" onClick=${() => desativarItem(itemEmEdicao)}>
                      <${Icone} name="archive" /> Arquivar
                    </button>
                  `
                : null}
            </div>
          </header>
          <form class="c24-form-grid settings-rule-form" onSubmit=${salvarItem}>
            <label>
              <span>Nome</span>
              <input
                class="form-control"
                required
                value=${formItem.nome}
                onInput=${(event) => setFormItem({ ...formItem, nome: event.target.value })}
              />
            </label>
            <label>
              <span>Chave</span>
              <input
                class="form-control"
                value=${formItem.chave}
                onInput=${(event) => setFormItem({ ...formItem, chave: event.target.value })}
              />
            </label>
            <label>
              <span>Categoria</span>
              <input
                class="form-control"
                value=${formItem.categoria}
                onInput=${(event) => setFormItem({ ...formItem, categoria: event.target.value })}
              />
            </label>
            <label>
              <span>Criticidade</span>
              <select
                class="form-select"
                value=${formItem.criticidade}
                onChange=${(event) => setFormItem({ ...formItem, criticidade: event.target.value })}
              >
                <option value="operacional">Operacional</option>
                <option value="atencao">Atenção</option>
                <option value="critica">Crítica</option>
              </select>
            </label>
            <label class="is-wide">
              <span>Descrição</span>
              <textarea
                class="form-control"
                rows="2"
                value=${formItem.descricao}
                onInput=${(event) => setFormItem({ ...formItem, descricao: event.target.value })}
              ></textarea>
            </label>
            <label>
              <span>Tags</span>
              <input
                class="form-control"
                placeholder="Separadas por vírgula"
                value=${formItem.tags}
                onInput=${(event) => setFormItem({ ...formItem, tags: event.target.value })}
              />
            </label>
            <label>
              <span>Aplicável a</span>
              <select
                class="form-select"
                value=${formItem.aplicavel}
                onChange=${(event) => setFormItem({ ...formItem, aplicavel: event.target.value })}
              >
                <option value="todos">Todos os fluxos</option>
                <option value="fluxos_especificos">Fluxos específicos</option>
                <option value="somente_rh">Somente RH</option>
              </select>
            </label>
            <label class="is-wide">
              <span>Permissões relacionadas</span>
              <input
                class="form-control"
                placeholder="Ex.: configuracoes.editar, lgpd.configurar"
                value=${formItem.permissoes}
                onInput=${(event) => setFormItem({ ...formItem, permissoes: event.target.value })}
              />
            </label>
            <label class="settings-toggle-line">
              <input
                type="checkbox"
                checked=${formItem.ativo}
                onChange=${(event) => setFormItem({ ...formItem, ativo: event.target.checked })}
              />
              <span>Item ativo nos fluxos operacionais</span>
            </label>
            <label class="is-wide">
              <span>Justificativa</span>
              <input
                class="form-control"
                value=${formItem.justificativa}
                onInput=${(event) => setFormItem({ ...formItem, justificativa: event.target.value })}
              />
            </label>
            <details class="settings-json-details is-wide">
              <summary>Payload JSON avançado</summary>
              <textarea
                class="form-control font-monospace"
                rows="5"
                value=${formItem.payloadJson}
                onInput=${(event) => setFormItem({ ...formItem, payloadJson: event.target.value })}
              ></textarea>
            </details>
            <footer class="settings-form-footer is-wide">
              <button type="submit" class="btn btn-primary" disabled=${salvando || !secaoCatalogoAtiva || !controlador.possuiPermissao('configuracoes.editar')}>
                <${Icone} name="check" /> ${salvando ? 'Salvando...' : 'Salvar'}
              </button>
              <button type="button" class="btn btn-outline-secondary" onClick=${() => setFormItem(FORM_ITEM_INICIAL)}>
                Limpar
              </button>
            </footer>
          </form>
        </section>

        <section class="c24-card settings-catalog-list-card">
          <header class="c24-card-header">
            <div>
              <span class="c24-eyebrow">${secaoCatalogoAtiva?.label || 'Regras'}</span>
              <h3>Itens cadastrados</h3>
              <p>Desative itens usados nos fluxos; não remova fisicamente.</p>
            </div>
            <button type="button" class="btn btn-primary btn-sm" onClick=${() => setFormItem(FORM_ITEM_INICIAL)}>
              <${Icone} name="add" /> Novo item
            </button>
          </header>

          <div class="c24-filter-bar settings-catalog-filter">
            <${FilterField} label="Buscar" icon="search">
              <input
                class="form-control"
                value=${filtrosCatalogo.busca}
                placeholder="Nome, chave ou categoria"
                onInput=${(event) => setFiltrosCatalogo({ ...filtrosCatalogo, busca: event.target.value })}
              />
            </${FilterField}>
            <${FilterField} label="Status">
              <select
                class="form-select"
                value=${filtrosCatalogo.status}
                onChange=${(event) => setFiltrosCatalogo({ ...filtrosCatalogo, status: event.target.value })}
              >
                ${STATUS_ITEM.map(
                  (item) => html`<option key=${item.value} value=${item.value}>${item.label}</option>`,
                )}
              </select>
            </${FilterField}>
          </div>

          ${itensCatalogoFiltrados.length
            ? html`
                <div class="settings-catalog-items">
                  ${itensCatalogoFiltrados.map(
                    (item) => html`
                      <article class=${`settings-catalog-item ${String(item.id_item) === String(formItem.id_item) ? 'is-active' : ''}`.trim()} key=${item.id_item}>
                        <button type="button" class="settings-catalog-item-main" onClick=${() => editarItem(item)}>
                          <span class="settings-catalog-icon"><${Icone} name=${CATALOGO_ICONS[secaoCatalogoAtiva?.tipo] || 'settings'} /></span>
                          <span>
                            <strong>${item.nome || '-'}</strong>
                            <small>${item.descricao || item.categoria || item.chave || 'Sem descrição'}</small>
                          </span>
                        </button>
                        <div class="settings-catalog-item-actions">
                          <${Badge} label=${item.ativo ? 'Ativo' : 'Inativo'} tone=${item.ativo ? 'success' : 'muted'} />
                          <button type="button" class="c24-icon-btn" title="Duplicar" onClick=${() => duplicarItem(item)}>
                            <${Icone} name="content_copy" />
                          </button>
                          <button type="button" class="c24-icon-btn is-danger" title="Arquivar" disabled=${!item.ativo} onClick=${() => desativarItem(item)}>
                            <${Icone} name="archive" />
                          </button>
                        </div>
                      </article>
                    `,
                  )}
                </div>
                <div class="settings-list-footer">
                  <span>${itensCatalogoFiltrados.length} exibidos de ${itensCatalogo.length}</span>
                  <button type="button" class="c24-link-btn" onClick=${() => setFiltrosCatalogo({ busca: '', status: 'todos' })}>
                    Ver todos
                  </button>
                </div>
              `
            : html`
                <${EmptyPanel}
                  icon="inventory_2"
                  title="Sem itens"
                  text="Cadastre o primeiro item reutilizável deste catálogo."
                  action=${html`<button type="button" class="btn btn-primary btn-sm" onClick=${() => setFormItem(FORM_ITEM_INICIAL)}>Novo item</button>`}
                />
              `}
        </section>
      </div>

      ${renderAuditoriaRecente()}
    </div>
  `;

  const renderLogs = () => html`
    <div class="settings-admin-shell">
      <${StatGrid}
        items=${[
          {
            icon: 'today',
            label: 'Ações hoje',
            value: contarPor(logs, (log) => {
              const data = new Date(log.data_hora);
              return !Number.isNaN(data.getTime()) && data.getTime() >= hojeSemHora().getTime();
            }),
            helper: 'Desde 00:00',
            tone: 'blue',
          },
          {
            icon: 'priority_high',
            label: 'Críticas',
            value: contarPor(logs, (log) => inferirCriticidadeLog(log) === 'Crítica'),
            helper: 'Permissões, senha e bloqueios',
            tone: 'yellow',
          },
          {
            icon: 'error',
            label: 'Falhas',
            value: contarPor(logs, (log) => log.sucesso === false),
            helper: 'Eventos sem sucesso',
            tone: 'red',
          },
          {
            icon: 'login',
            label: 'Logins recentes',
            value: contarPor(logs, (log) => normalizarBusca(log.acao).includes('login')),
            helper: 'Entradas e recusas',
            tone: 'green',
          },
        ]}
      />

      <section class="c24-card settings-logs-panel">
        <header class="c24-card-header">
          <div>
            <span class="c24-eyebrow">Auditoria</span>
            <h3>Logs do sistema</h3>
            <p>${logsFiltrados.length} evento(s) encontrados nos filtros atuais.</p>
          </div>
          <div class="settings-card-actions">
            <button type="button" class="btn btn-outline-secondary btn-sm" onClick=${carregarTudo}>
              <${Icone} name="refresh" /> Atualizar
            </button>
            <button type="button" class="btn btn-primary btn-sm" disabled=${!controlador.possuiPermissao('logs.exportar')} onClick=${exportarLogs}>
              <${Icone} name="download" /> Exportar
            </button>
          </div>
        </header>

        <div class="c24-filter-bar settings-log-filter">
          <${FilterField} label="Busca" icon="search">
            <input
              class="form-control"
              value=${filtrosLogs.busca}
              placeholder="Texto livre"
              onInput=${(event) => {
                setFiltrosLogs({ ...filtrosLogs, busca: event.target.value });
                setPaginaLogs(1);
              }}
            />
          </${FilterField}>
          <${FilterField} label="Módulo">
            <select
              class="form-select"
              value=${filtrosLogs.modulo}
              onChange=${(event) => {
                setFiltrosLogs({ ...filtrosLogs, modulo: event.target.value });
                setPaginaLogs(1);
              }}
            >
              <option value="">Todos</option>
              ${modulosLogs.map((modulo) => html`<option key=${modulo} value=${modulo}>${modulo}</option>`)}
            </select>
          </${FilterField}>
          <${FilterField} label="Ação" icon="bolt">
            <select
              class="form-select"
              value=${filtrosLogs.acao}
              onChange=${(event) => {
                setFiltrosLogs({ ...filtrosLogs, acao: event.target.value });
                setPaginaLogs(1);
              }}
            >
              <option value="">Todas</option>
              ${acoesLogs.map((acao) => html`<option key=${acao} value=${acao}>${acao}</option>`)}
            </select>
          </${FilterField}>
          <${FilterField} label="Usuário" icon="person">
            <input
              class="form-control"
              value=${filtrosLogs.usuario}
              onInput=${(event) => {
                setFiltrosLogs({ ...filtrosLogs, usuario: event.target.value });
                setPaginaLogs(1);
              }}
            />
          </${FilterField}>
          <${FilterField} label="Criticidade" icon="priority_high">
            <select
              class="form-select"
              value=${filtrosLogs.criticidade}
              onChange=${(event) => {
                setFiltrosLogs({ ...filtrosLogs, criticidade: event.target.value });
                setPaginaLogs(1);
              }}
            >
              <option value="">Todas</option>
              <option value="Operacional">Operacional</option>
              <option value="Critica">Crítica</option>
              <option value="Falha">Falha</option>
            </select>
          </${FilterField}>
          <${FilterField} label="Período" icon="date_range">
            <select
              class="form-select"
              value=${filtrosLogs.periodo}
              onChange=${(event) => {
                setFiltrosLogs({ ...filtrosLogs, periodo: event.target.value });
                setPaginaLogs(1);
              }}
            >
              <option value="">Todo período</option>
              <option value="hoje">Hoje</option>
              <option value="7d">7 dias</option>
              <option value="30d">30 dias</option>
            </select>
          </${FilterField}>
          <button
            type="button"
            class="btn btn-outline-secondary btn-sm"
            onClick=${() => {
              setFiltrosLogs({ busca: '', modulo: '', acao: '', usuario: '', criticidade: '', status: '', periodo: '' });
              setPaginaLogs(1);
            }}
          >
            Limpar
          </button>
        </div>

        ${paginacaoLogs.itens.length
          ? html`
              <div class="settings-log-list">
                ${paginacaoLogs.itens.map(
                  (log) => {
                    const aberto = String(logExpandidoId) === String(log.id_log);
                    const criticidade = inferirCriticidadeLog(log);
                    return html`
                      <article class=${`settings-log-card ${aberto ? 'is-open' : ''}`.trim()} key=${log.id_log}>
                        <button
                          type="button"
                          class="settings-log-summary"
                          onClick=${() => setLogExpandidoId(aberto ? '' : log.id_log)}
                        >
                          <span class="settings-log-time">
                            <strong>${formatarData(log.data_hora)}</strong>
                            <small>${log.modulo || '-'}</small>
                          </span>
                          <span class="settings-log-user">
                            <strong>${log.nome_usuario || '-'}</strong>
                            <small>${log.perfil_nome || log.email_usuario || '-'}</small>
                          </span>
                          <span class="settings-log-action">
                            <strong>${log.acao || '-'}</strong>
                            <small>${`${log.entidade || '-'} ${log.entidade_id || ''}`}</small>
                          </span>
                          <span class="settings-log-badges">
                            <${Badge} label=${criticidade} tone=${obterStatusTone(criticidade)} />
                            <${Badge} label=${log.sucesso === false ? 'Falha' : 'Sucesso'} tone=${log.sucesso === false ? 'danger' : 'success'} />
                            <${Icone} name=${aberto ? 'expand_less' : 'expand_more'} />
                          </span>
                        </button>
                        ${aberto
                          ? html`
                              <div class="settings-log-details">
                                <div>
                                  <strong>Antes</strong>
                                  <pre class="settings-log-pre">${formatarPayloadLog(log.valor_anterior)}</pre>
                                </div>
                                <div>
                                  <strong>Depois</strong>
                                  <pre class="settings-log-pre">${formatarPayloadLog(log.valor_novo)}</pre>
                                </div>
                                <div>
                                  <strong>Contexto</strong>
                                  <p>${log.justificativa || 'Sem justificativa registrada.'}</p>
                                  <small>Origem: ${log.origem || '-'}</small>
                                </div>
                              </div>
                            `
                          : null}
                      </article>
                    `;
                  },
                )}
              </div>
              <${PaginacaoCompacta} paginacao=${paginacaoLogs} onChange=${setPaginaLogs} />
            `
          : html`
              <${EmptyPanel}
                icon="history_off"
                title="Sem logs"
                text="Nenhum evento de auditoria corresponde aos filtros atuais."
              />
            `}
      </section>
    </div>
  `;

  return html`
    <${PainelRh}
      screenId="screen-settings"
      navAtiva="screen-settings"
      subtituloMarca="Configurações"
      placeholderBusca="Configurações, usuários, permissões e logs"
      controlador=${controlador}
      mostrarAtalhos=${false}
      acoesTopo=${html`<${AcaoSair} controlador=${controlador} />`}
    >
      <${PageIntro}
        kicker="Console - Administração"
        title="Configurações"
        description="Centralize usuários, perfis, permissões, logs e regras reutilizáveis sem retirar as ações do fluxo operacional."
        actions=${html`
          <div class="c24-tabs">
            ${abasPermitidas.map(
              (aba) => html`
                <${BotaoAba}
                  key=${aba.id}
                  aba=${aba}
                  ativa=${abaRenderizada === aba.id}
                  onClick=${() => setAbaAtiva(aba.id)}
                />
              `,
            )}
          </div>
        `}
      />

      ${erro ? html`<div class="alert alert-danger c24-feedback">${erro}</div>` : null}
      ${feedback ? html`<div class="alert alert-success c24-feedback">${feedback}</div>` : null}
      ${carregando
        ? html`
            <div class="c24-loading-panel">
              <div class="spinner-border text-primary" role="status" aria-hidden="true"></div>
              <div>
                <strong>Carregando configurações</strong>
                <p>Buscando usuários, perfis, regras e logs de auditoria.</p>
              </div>
            </div>
          `
          : !abasPermitidas.length
          ? html`
              <${EmptyPanel}
                icon="lock"
                title="Sem permissão"
                text="Seu perfil não tem acesso a esta área administrativa."
              />
            `
          : abaRenderizada === 'usuarios'
            ? renderUsuarios()
            : abaRenderizada === 'perfis'
              ? renderPerfis()
              : abaRenderizada === 'catalogos'
                ? renderCatalogos()
                : renderLogs()}
    </${PainelRh}>
  `;
}
