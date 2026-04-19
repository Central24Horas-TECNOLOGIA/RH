/**
 * @typedef {import('../src/types/api').SaveAnswerFileRequest} SaveAnswerFileRequest
 * @typedef {import('../src/types/api').UpdateCandidateStatusRequest} UpdateCandidateStatusRequest
 * @typedef {import('../src/types/models').HistoryRecord} HistoryRecord
 * @typedef {import('../src/types/models').Process} Process
 */

const URL_API_BASE = window.__RH_API_BASE__ || 'http://127.0.0.1:8000';
const TEMPO_CACHE_MS = 15000;
const CHAVE_TOKEN_AUTENTICACAO = 'rh_api_access_token';
const CHAVE_USUARIO_AUTENTICADO = 'rh_api_authenticated_user';

export const EVENTO_AUTENTICACAO_EXPIRADA = 'rh-auth-expired';

const cacheMemoria = new Map();

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

async function requisitar(caminho, opcoes = {}, configuracao = {}) {
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

    throw new Error(textoErro || `Falha na API (${resposta.status}).`);
  }

  const tipo = resposta.headers.get('content-type') || '';
  if (tipo.includes('application/json')) {
    return resposta.json();
  }

  return resposta.text();
}

export function invalidarCacheApi(...chaves) {
  chaves.forEach((chave) => cacheMemoria.delete(chave));
}

export async function fazerLoginApi(usuario, senha) {
  const resultado = await requisitar(
    '/auth/login',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usuario, senha }),
    },
    { autenticado: false },
  );

  salvarSessaoAutenticacao(resultado.access_token, resultado.usuario);
  return resultado;
}

export async function verificarSessaoApi() {
  return requisitar('/auth/me', { method: 'GET' });
}

export async function encerrarSessaoApi() {
  try {
    if (!possuiSessaoAutenticada()) {
      return { success: true };
    }

    return await requisitar('/auth/logout', { method: 'POST' });
  } finally {
    limparSessaoAutenticacao();
  }
}

export async function lerHistorico() {
  return requisitar('/history', { method: 'GET' });
}

export async function lerHistoricoPaginado({
  pagina = 1,
  tamanho = 10,
  nome = '',
  vaga = '',
  data = '',
} = {}) {
  const params = new URLSearchParams({
    page: String(pagina),
    page_size: String(tamanho),
  });

  if (nome) params.set('nome', nome);
  if (vaga) params.set('vaga', vaga);
  if (data) params.set('data', data);

  return requisitar(`/history?${params.toString()}`, { method: 'GET' });
}

export async function salvarHistorico(linha) {
  const resultado = await requisitar('/history', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(linha),
  });

  invalidarCacheApi('historico');
  return resultado;
}

export async function lerArquivosResposta() {
  const emCache = lerCache('gabaritos');
  if (emCache) return emCache;

  const dados = await requisitar('/answer-files', { method: 'GET' });
  const seguro = dados && typeof dados === 'object' ? dados : {};
  gravarCache('gabaritos', seguro);
  return seguro;
}

export async function salvarArquivoResposta(payload) {
  const resultado = await requisitar('/answer-files', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  invalidarCacheApi('gabaritos');
  return resultado;
}

export async function lerProcessos(forcar = false) {
  if (!forcar) {
    const emCache = lerCache('processos');
    if (emCache) return emCache;
  }

  const dados = await requisitar('/processes', { method: 'GET' });
  const lista = Array.isArray(dados) ? dados : [];
  gravarCache('processos', lista);
  return lista;
}

export async function criarProcesso(dadosProcesso) {
  const resultado = await requisitar('/processes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(dadosProcesso),
  });

  invalidarCacheApi('processos');
  return resultado;
}

export async function atualizarProcesso(idProcesso, dadosProcesso) {
  const resultado = await requisitar(
    `/processes/${encodeURIComponent(idProcesso)}`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dadosProcesso),
    },
  );

  invalidarCacheApi('processos');
  return resultado;
}

export async function encerrarProcesso(idProcesso) {
  const resultado = await requisitar(
    `/processes/${encodeURIComponent(idProcesso)}/close`,
    { method: 'POST' },
  );

  invalidarCacheApi('processos');
  return resultado;
}

export async function lerCandidatosProcessos(forcar = false) {
  if (!forcar) {
    const emCache = lerCache('candidatos-processos');
    if (emCache) return emCache;
  }

  const dados = await requisitar('/process-candidates', { method: 'GET' });
  const lista = Array.isArray(dados) ? dados : [];
  gravarCache('candidatos-processos', lista);
  return lista;
}

export async function criarCandidatoNoProcesso(dadosCandidato) {
  const resultado = await requisitar('/process-candidates', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(dadosCandidato),
  });

  invalidarCacheApi('candidatos-processos', 'banco-talentos', 'processos');
  return resultado;
}

export async function atualizarStatusCandidato(idRegistro, dadosStatus) {
  const resultado = await requisitar(
    `/process-candidates/${idRegistro}/status`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dadosStatus),
    },
  );

  invalidarCacheApi('candidatos-processos', 'banco-talentos', 'processos', 'pipeline-candidatos');
  return resultado;
}

export async function lerBancoTalentos(forcar = false) {
  if (!forcar) {
    const emCache = lerCache('banco-talentos');
    if (emCache) return emCache;
  }

  const dados = await requisitar('/talent-bank', { method: 'GET' });
  const lista = Array.isArray(dados) ? dados : [];
  gravarCache('banco-talentos', lista);
  return lista;
}

export async function removerBancoTalentos(idBanco) {
  const resultado = await requisitar(`/talent-bank/${idBanco}`, {
    method: 'DELETE',
  });

  invalidarCacheApi('banco-talentos', 'candidatos-processos', 'processos');
  return resultado;
}

export async function usarCandidatoDoBancoTalentos(idBanco, dadosUso) {
  const resultado = await requisitar(`/talent-bank/${idBanco}/use`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(dadosUso),
  });

  invalidarCacheApi('banco-talentos', 'candidatos-processos', 'processos');
  return resultado;
}

export async function lerAnalisesCandidatos() {
  return requisitar('/candidate-analytics', { method: 'GET' });
}

export async function lerDetalheAnaliseCandidato(idTeste) {
  return requisitar(`/candidate-analytics/${encodeURIComponent(idTeste)}`, {
    method: 'GET',
  });
}

export async function lerDetalheProcesso(idProcesso) {
  return requisitar(`/processes/${encodeURIComponent(idProcesso)}/details`, {
    method: 'GET',
  });
}

export async function lerPreAnalisesCv(idProcesso, pagina = 1, tamanho = 5) {
  const params = new URLSearchParams({
    page: String(pagina),
    page_size: String(tamanho),
  });

  return requisitar(
    `/processes/${encodeURIComponent(idProcesso)}/cv-pre-analyses?${params.toString()}`,
    { method: 'GET' },
  );
}

export async function analisarCvProcesso(idProcesso, formData) {
  const resultado = await requisitar(
    `/processes/${encodeURIComponent(idProcesso)}/cv-pre-analyses`,
    {
      method: 'POST',
      body: formData,
    },
  );

  invalidarCacheApi('processos', 'candidatos-processos');
  return resultado;
}

export async function atualizarPreAnaliseCv(idPreAnalise, payload) {
  return requisitar(`/cv-pre-analyses/${encodeURIComponent(idPreAnalise)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function excluirPreAnaliseCv(idPreAnalise) {
  return requisitar(`/cv-pre-analyses/${encodeURIComponent(idPreAnalise)}`, {
    method: 'DELETE',
  });
}

export async function adicionarPreAnaliseAoProcesso(idPreAnalise) {
  const resultado = await requisitar(
    `/cv-pre-analyses/${encodeURIComponent(idPreAnalise)}/add-to-process`,
    { method: 'POST' },
  );

  invalidarCacheApi('processos', 'candidatos-processos');
  return resultado;
}

export async function lerPipelineCandidatos(idProcesso = '', search = '') {
  const params = new URLSearchParams();
  if (idProcesso) params.set('id_processo', idProcesso);
  if (search) params.set('search', search);

  const sufixo = params.toString() ? `?${params.toString()}` : '';
  return requisitar(`/candidate-pipeline${sufixo}`, { method: 'GET' });
}

export async function criarCardPipeline(payload) {
  const resultado = await requisitar('/candidate-pipeline', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  invalidarCacheApi('candidatos-processos', 'pipeline-candidatos', 'processos');
  return resultado;
}

export async function moverCardPipeline(idRegistro, payload) {
  const resultado = await requisitar(
    `/candidate-pipeline/${encodeURIComponent(idRegistro)}/stage`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    },
  );

  invalidarCacheApi('candidatos-processos', 'pipeline-candidatos', 'processos');
  return resultado;
}
