import {
  gravarCache,
  invalidarCacheApi,
  lerCache,
  requisitar,
} from './core.js';

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

  invalidarCacheApi(
    'candidatos-processos',
    'banco-talentos',
    'processos',
    'pipeline-candidatos',
  );
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

export async function lerBancoTalentos({
  forcar = false,
  search = '',
  skill = '',
  tag = '',
} = {}) {
  const chaveCache = `banco-talentos:${search}:${skill}:${tag}`;

  if (!forcar) {
    const emCache = lerCache(chaveCache);
    if (emCache) return emCache;
  }

  const params = new URLSearchParams();
  if (search) params.set('search', search);
  if (skill) params.set('skill', skill);
  if (tag) params.set('tag', tag);

  const sufixo = params.toString() ? `?${params.toString()}` : '';
  const dados = await requisitar(`/talent-bank${sufixo}`, { method: 'GET' });
  const lista = Array.isArray(dados) ? dados : [];
  gravarCache(chaveCache, lista);
  return lista;
}

export async function removerBancoTalentos(idBanco) {
  const resultado = await requisitar(`/talent-bank/${idBanco}`, {
    method: 'DELETE',
  });

  invalidarCacheApi('banco-talentos', 'candidatos-processos', 'processos');
  return resultado;
}

export async function atualizarPerfilCandidato(idTeste, payload) {
  const resultado = await requisitar(
    `/candidate-profiles/${encodeURIComponent(idTeste)}`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    },
  );

  invalidarCacheApi('banco-talentos', 'candidatos-processos', 'pipeline-candidatos');
  return resultado;
}

export async function usarCandidatoDoBancoTalentos(idBanco, dadosUso) {
  const resultado = await requisitar(`/talent-bank/${idBanco}/use`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(dadosUso),
  });

  invalidarCacheApi(
    'banco-talentos',
    'candidatos-processos',
    'processos',
    'pipeline-candidatos',
  );
  return resultado;
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
