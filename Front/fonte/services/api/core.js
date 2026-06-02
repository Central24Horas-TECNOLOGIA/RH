import { criarLogger } from '../../logger.js';

const CONFIG_RUNTIME = window.RUNTIME_CONFIG || {};
const URL_API_BASE =
  CONFIG_RUNTIME.API_BASE_URL || window.__RH_API_BASE__ || 'http://127.0.0.1:8010';
export const URL_PUBLICA_BASE_CANDIDATURA =
  CONFIG_RUNTIME.PUBLIC_CANDIDATE_BASE_URL ||
  window.__RH_PUBLIC_CANDIDATE_BASE_URL__ ||
  '';
const TEMPO_CACHE_MS = 15000;
const CHAVE_TOKEN_AUTENTICACAO = 'rh_api_access_token';
const CHAVE_USUARIO_AUTENTICADO = 'rh_api_authenticated_user';
const CHAVE_SESSAO_AUTENTICACAO = 'rh_api_session_payload';

export const EVENTO_AUTENTICACAO_EXPIRADA = 'rh-auth-expired';

const cacheMemoria = new Map();
const logger = criarLogger('api');

function lerCache(chave) {
  const entrada = cacheMemoria.get(chave);
  if (!entrada) return null;

  if (Date.now() - entrada.timestamp > TEMPO_CACHE_MS) {
    cacheMemoria.delete(chave);
    return null;
  }

  return entrada.data;
}

function gravarCache(chave, data) {
  cacheMemoria.set(chave, {
    data,
    timestamp: Date.now(),
  });
}

export function lerSessaoAutenticacao() {
  let payload = {};
  try {
    payload = JSON.parse(sessionStorage.getItem(CHAVE_SESSAO_AUTENTICACAO) || '{}');
  } catch (error) {
    payload = {};
  }

  return {
    token: sessionStorage.getItem(CHAVE_TOKEN_AUTENTICACAO) || '',
    usuario: sessionStorage.getItem(CHAVE_USUARIO_AUTENTICADO) || '',
    nome: payload.nome || '',
    email: payload.email || '',
    perfil: payload.perfil || '',
    perfil_nome: payload.perfil_nome || '',
    nivel: payload.nivel || '',
    permissoes: Array.isArray(payload.permissoes) ? payload.permissoes : [],
  };
}

export function salvarSessaoAutenticacao(token, sessaoOuUsuario) {
  const sessao =
    typeof sessaoOuUsuario === 'object' && sessaoOuUsuario !== null
      ? sessaoOuUsuario
      : { usuario: sessaoOuUsuario || '' };
  sessionStorage.setItem(CHAVE_TOKEN_AUTENTICACAO, token || '');
  sessionStorage.setItem(CHAVE_USUARIO_AUTENTICADO, sessao.usuario || sessao.email || '');
  sessionStorage.setItem(
    CHAVE_SESSAO_AUTENTICACAO,
    JSON.stringify({
      usuario: sessao.usuario || sessao.email || '',
      nome: sessao.nome || '',
      email: sessao.email || '',
      perfil: sessao.perfil || '',
      perfil_nome: sessao.perfil_nome || '',
      nivel: sessao.nivel || '',
      permissoes: Array.isArray(sessao.permissoes) ? sessao.permissoes : [],
    }),
  );
}

export function limparSessaoAutenticacao() {
  [sessionStorage, localStorage].forEach((armazenamento) => {
    try {
      armazenamento.removeItem(CHAVE_TOKEN_AUTENTICACAO);
      armazenamento.removeItem(CHAVE_USUARIO_AUTENTICADO);
      armazenamento.removeItem(CHAVE_SESSAO_AUTENTICACAO);
    } catch (error) {
      logger.warn('Nao foi possivel limpar dados locais de autenticacao.', error);
    }
  });
  cacheMemoria.clear();
}

export function possuiSessaoAutenticada() {
  return Boolean(lerSessaoAutenticacao().token);
}

function notificarSessaoExpirada() {
  window.dispatchEvent(new CustomEvent(EVENTO_AUTENTICACAO_EXPIRADA));
}

async function lerMensagemErro(resposta) {
  const tipo = resposta.headers.get('content-type') || '';

  if (tipo.includes('application/json')) {
    const json = await resposta.json().catch(() => null);
    if (json?.message) return json.message;
    if (json?.detail) return json.detail;
  }

  return resposta.text().catch(() => '');
}

async function executarRequisicao(caminho, opcoes = {}, configuracao = {}) {
  const { autenticado = true } = configuracao;
  const headers = new Headers(opcoes.headers || {});
  const sessao = lerSessaoAutenticacao();

  if (autenticado && sessao.token) {
    headers.set('Authorization', `Bearer ${sessao.token}`);
  }

  let resposta;

  try {
    resposta = await fetch(`${URL_API_BASE}${caminho}`, {
      cache: 'no-store',
      ...opcoes,
      headers,
    });
  } catch (error) {
    logger.error('Falha de conectividade com a API.', {
      caminho,
      mensagem: error?.message || '',
    });
    throw new Error(
      `Nao foi possivel conectar com a API em ${URL_API_BASE}${caminho}. Verifique se o servidor da API esta ativo.`,
    );
  }

  if (!resposta.ok) {
    const textoErro = await lerMensagemErro(resposta);

    if (resposta.status === 401) {
      limparSessaoAutenticacao();
      notificarSessaoExpirada();
    }

    logger.warn('Resposta de erro recebida da API.', {
      caminho,
      status: resposta.status,
      textoErro,
    });
    if (resposta.status === 400 || resposta.status === 422) {
      throw new Error(textoErro || 'Nao foi possivel validar os dados enviados para a API.');
    }
    if (resposta.status >= 500) {
      throw new Error(
        textoErro ||
          'Nao foi possivel concluir a operacao. A API retornou erro interno. Verifique o log do servidor.',
      );
    }
    throw new Error(textoErro || `Falha na API (${resposta.status}).`);
  }

  return resposta;
}

function extrairNomeArquivo(resposta) {
  const disposition = resposta.headers.get('content-disposition') || '';
  const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    return decodeURIComponent(utf8Match[1]);
  }

  const asciiMatch = disposition.match(/filename="?([^";]+)"?/i);
  if (asciiMatch?.[1]) {
    return asciiMatch[1];
  }

  return 'arquivo';
}

export async function requisitar(caminho, opcoes = {}, configuracao = {}) {
  const resposta = await executarRequisicao(caminho, opcoes, configuracao);

  const tipo = resposta.headers.get('content-type') || '';
  if (tipo.includes('application/json')) {
    return resposta.json();
  }

  return resposta.text();
}

export async function requisitarArquivo(caminho, opcoes = {}, configuracao = {}) {
  const resposta = await executarRequisicao(caminho, opcoes, configuracao);
  return {
    blob: await resposta.blob(),
    filename: extrairNomeArquivo(resposta),
    contentType:
      resposta.headers.get('content-type') || 'application/octet-stream',
  };
}

export function invalidarCacheApi(...chaves) {
  chaves.forEach((chave) => {
    cacheMemoria.delete(chave);
    Array.from(cacheMemoria.keys())
      .filter((cacheKey) => cacheKey.startsWith(`${chave}:`))
      .forEach((cacheKey) => cacheMemoria.delete(cacheKey));
  });
}

export { gravarCache, lerCache };
