import { useEffect, useState } from '../infraestrutura-react.js';
import {
  lerProcessos,
  lerEntrevistas,
  lerCandidatosProcessos,
  listarSolicitacoesAlteracaoEmailApi,
} from '../app/controlador-aplicacao.js';

export const CATEGORIAS_NOTIFICACAO = [
  {
    id: 'entrevistas',
    label: 'Entrevistas e Banco de Talentos',
    cor: '#f89501',
    descricao: 'Avisos de entrevistas agendadas para os próximos dias e movimentações no banco de talentos.',
  },
  {
    id: 'processos',
    label: 'Processos Seletivos',
    cor: '#053c6c',
    descricao: 'Abertura, atualização e encerramento de vagas e processos seletivos.',
  },
  {
    id: 'provas',
    label: 'Provas',
    cor: '#3f9a23',
    descricao: 'Provas geradas, respondidas ou aguardando correção.',
  },
  {
    id: 'problemas',
    label: 'Problemas',
    cor: '#f80101',
    descricao: 'Pendências e alertas que precisam da sua atenção, como candidatos travados numa etapa.',
  },
  {
    id: 'administracao',
    label: 'Administração',
    cor: '#65176c',
    descricao: 'Avisos administrativos do sistema, como alterações de configuração e auditoria.',
  },
];

const CHAVE_PREFERENCIAS = 'c24_notificacoes_categorias';
const CHAVE_CORES_PERSONALIZADAS = 'c24_notificacoes_cores';

export function lerCoresNotificacao() {
  let salvo = {};
  try {
    salvo = JSON.parse(localStorage.getItem(CHAVE_CORES_PERSONALIZADAS) || '{}');
  } catch (error) {
    salvo = {};
  }

  return CATEGORIAS_NOTIFICACAO.reduce((acumulado, categoria) => {
    acumulado[categoria.id] = salvo[categoria.id] || categoria.cor;
    return acumulado;
  }, {});
}

export function salvarCorNotificacao(categoriaId, cor) {
  const cores = lerCoresNotificacao();
  cores[categoriaId] = cor;
  try {
    localStorage.setItem(CHAVE_CORES_PERSONALIZADAS, JSON.stringify(cores));
  } catch (error) {
    // Preferência é best-effort; se o storage falhar, a cor padrão continua valendo.
  }
  return cores;
}
const JANELA_ENTREVISTAS_PROXIMAS_MS = 1000 * 60 * 60 * 48;
const LIMITE_ITENS_POR_CATEGORIA = 5;

export function lerPreferenciasNotificacao() {
  let salvo = {};
  try {
    salvo = JSON.parse(localStorage.getItem(CHAVE_PREFERENCIAS) || '{}');
  } catch (error) {
    salvo = {};
  }

  return CATEGORIAS_NOTIFICACAO.reduce((acumulado, categoria) => {
    acumulado[categoria.id] = salvo[categoria.id] !== false;
    return acumulado;
  }, {});
}

export function salvarPreferenciasNotificacao(preferencias) {
  try {
    localStorage.setItem(CHAVE_PREFERENCIAS, JSON.stringify(preferencias || {}));
  } catch (error) {
    // Preferência é best-effort; se o storage falhar, mantemos o padrão (tudo ativo).
  }
}

function montarItensEntrevistas(entrevistas) {
  const agora = Date.now();
  return (Array.isArray(entrevistas) ? entrevistas : [])
    .filter((item) => {
      const dataBruta = item?.data_entrevista;
      if (!dataBruta) return false;
      const timestamp = new Date(dataBruta).getTime();
      return Number.isFinite(timestamp) && timestamp >= agora && timestamp - agora <= JANELA_ENTREVISTAS_PROXIMAS_MS;
    })
    .slice(0, LIMITE_ITENS_POR_CATEGORIA)
    .map((item) => ({
      id: `entrevista-${item.id_entrevista || item.id_slot || Math.random()}`,
      categoria: 'entrevistas',
      texto: `Entrevista de ${item.nome_candidato || 'candidato'} agendada${item.vaga ? ` — ${item.vaga}` : ''}`,
    }));
}

function montarItensProcessos(processos) {
  return (Array.isArray(processos) ? processos : [])
    .filter((item) => String(item?.status || '').toLowerCase().includes('aberto'))
    .slice(0, LIMITE_ITENS_POR_CATEGORIA)
    .map((item) => ({
      id: `processo-${item.id_processo || item.id_processo_ref || Math.random()}`,
      categoria: 'processos',
      texto: `Processo aberto: ${item.vaga || item.id_processo_ref || item.id_processo || 'sem nome'}`,
    }));
}

function montarItensProblemas(candidatosProcessos) {
  return (Array.isArray(candidatosProcessos) ? candidatosProcessos : [])
    .filter((item) => /pend[êe]ncia|pendente/i.test(String(item?.status_fluxo || item?.etapa_pipeline || item?.status || '')))
    .slice(0, LIMITE_ITENS_POR_CATEGORIA)
    .map((item) => ({
      id: `pendencia-${item.id_registro || Math.random()}`,
      categoria: 'problemas',
      texto: `Pendência com ${item.nome_candidato || item.nome || 'candidato'}`,
    }));
}

function montarItensAdministracao(solicitacoesEmail) {
  return (Array.isArray(solicitacoesEmail) ? solicitacoesEmail : [])
    .slice(0, LIMITE_ITENS_POR_CATEGORIA)
    .map((item) => ({
      id: `solicitacao-email-${item.id}`,
      categoria: 'administracao',
      texto: `${item.nome_usuario || item.login_usuario || 'Usuário'} pediu alteração de e-mail para ${item.email_novo}`,
    }));
}

export function useResumoNotificacoes(controlador) {
  const [itens, setItens] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const autenticado = Boolean(controlador?.estado?.autenticado);

  useEffect(() => {
    let ativo = true;

    if (!autenticado) {
      setItens([]);
      setCarregando(false);
      return undefined;
    }

    setCarregando(true);
    const podeVerSolicitacoesEmail = Boolean(controlador?.possuiPermissao?.('usuarios.alterar_email'));

    const carregar = async () => {
      const [processos, entrevistas, candidatosProcessos, solicitacoesEmail] = await Promise.all([
        lerProcessos().catch(() => []),
        lerEntrevistas().catch(() => []),
        lerCandidatosProcessos().catch(() => []),
        podeVerSolicitacoesEmail
          ? listarSolicitacoesAlteracaoEmailApi().then((valor) => valor?.solicitacoes || []).catch(() => [])
          : Promise.resolve([]),
      ]);
      if (!ativo) return;

      const preferencias = lerPreferenciasNotificacao();
      const resultado = [
        ...montarItensEntrevistas(entrevistas),
        ...montarItensProcessos(processos),
        ...montarItensProblemas(candidatosProcessos),
        ...montarItensAdministracao(solicitacoesEmail),
      ].filter((item) => preferencias[item.categoria] !== false);

      setItens(resultado);
      setCarregando(false);
    };

    carregar().catch(() => {
      if (ativo) setCarregando(false);
    });

    return () => {
      ativo = false;
    };
  }, [autenticado]);

  return { itens, carregando };
}
