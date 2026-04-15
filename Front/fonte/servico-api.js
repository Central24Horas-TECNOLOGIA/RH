const URL_API_BASE = 'http://127.0.0.1:8000';
const TEMPO_CACHE_MS = 15000;

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

async function requisitar(caminho, opcoes = {}) {
  let resposta;

  try {
    resposta = await fetch(`${URL_API_BASE}${caminho}`, {
      cache: 'no-store',
      ...opcoes,
    });
  } catch (error) {
    // Traduz o erro de rede para uma mensagem mais util no front.
    throw new Error(
      `Nao foi possivel conectar com a API em ${URL_API_BASE}${caminho}. Verifique se o servidor da API esta ativo.`,
    );
  }

  if (!resposta.ok) {
    const textoErro = await resposta.text().catch(() => '');
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

export async function lerHistorico() {
  return requisitar('/history', { method: 'GET' });
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

  invalidarCacheApi('candidatos-processos', 'banco-talentos', 'processos');
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
