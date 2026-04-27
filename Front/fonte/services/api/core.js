import { criarLogger } from '../../logger.js';

const URL_API_BASE = window.__RH_API_BASE__ || 'http://127.0.0.1:8010';
const TEMPO_CACHE_MS = 15000;
const CHAVE_TOKEN_AUTENTICACAO = 'rh_api_access_token';
const CHAVE_USUARIO_AUTENTICADO = 'rh_api_authenticated_user';

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
  return {
    token: sessionStorage.getItem(CHAVE_TOKEN_AUTENTICACAO) || '',
    usuario: sessionStorage.getItem(CHAVE_USUARIO_AUTENTICADO) || '',
  };
}

export function salvarSessaoAutenticacao(token, usuario) {
  sessionStorage.setItem(CHAVE_TOKEN_AUTENTICACAO, token || '');
  sessionStorage.setItem(CHAVE_USUARIO_AUTENTICADO, usuario || '');
}

export function limparSessaoAutenticacao() {
  sessionStorage.removeItem(CHAVE_TOKEN_AUTENTICACAO);
  sessionStorage.removeItem(CHAVE_USUARIO_AUTENTICADO);
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

export async function requisitar(caminho, opcoes = {}, configuracao = {}) {
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
    throw new Error(textoErro || `Falha na API (${resposta.status}).`);
  }

  const tipo = resposta.headers.get('content-type') || '';
  if (tipo.includes('application/json')) {
    return resposta.json();
  }

  return resposta.text();
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
