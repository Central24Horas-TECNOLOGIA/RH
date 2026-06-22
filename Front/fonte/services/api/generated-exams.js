import { invalidarCacheApi, lerCache, gravarCache, requisitar } from './core.js';

const CACHE_PROVAS_GERADAS = 'provas-geradas';

export async function listarProvasGeradas() {
  const cache = lerCache(CACHE_PROVAS_GERADAS);
  if (cache) return cache;

  const dados = await requisitar('/generated-exams');
  gravarCache(CACHE_PROVAS_GERADAS, dados);
  return dados;
}

export async function criarProvaGerada(payload) {
  const resultado = await requisitar('/generated-exams', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload || {}),
  });
  invalidarCacheApi(CACHE_PROVAS_GERADAS, 'candidatos-processos', 'processos');
  return resultado;
}

export async function atualizarProvaGerada(idProva, payload) {
  const resultado = await requisitar(`/generated-exams/${encodeURIComponent(idProva)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload || {}),
  });
  invalidarCacheApi(CACHE_PROVAS_GERADAS, 'candidatos-processos', 'processos');
  return resultado;
}

export async function deletarProvaGerada(idProva) {
  const resultado = await requisitar(`/generated-exams/${encodeURIComponent(idProva)}`, {
    method: 'DELETE',
  });
  invalidarCacheApi(CACHE_PROVAS_GERADAS, 'candidatos-processos', 'processos', 'pipeline-candidatos');
  return resultado;
}

export async function lerProvaGerada(idProva) {
  return requisitar(`/generated-exams/${encodeURIComponent(idProva)}`);
}

export async function recalcularScoreProva(idProva) {
  const resultado = await requisitar(
    `/generated-exams/${encodeURIComponent(idProva)}/score/recalculate`,
    { method: 'POST' },
  );
  invalidarCacheApi(CACHE_PROVAS_GERADAS, 'candidatos-processos', 'processos', 'pipeline-candidatos');
  return resultado;
}

export async function salvarAvaliacaoManualProva(idProva, payload) {
  const resultado = await requisitar(
    `/generated-exams/${encodeURIComponent(idProva)}/manual-evaluation`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload || {}),
    },
  );
  invalidarCacheApi(CACHE_PROVAS_GERADAS, 'candidatos-processos', 'processos', 'pipeline-candidatos');
  return resultado;
}

export async function reabrirProvaGerada(idProva, payload) {
  const resultado = await requisitar(
    `/generated-exams/${encodeURIComponent(idProva)}/reopen`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload || {}),
    },
  );
  invalidarCacheApi(CACHE_PROVAS_GERADAS, 'candidatos-processos', 'processos', 'pipeline-candidatos');
  return resultado;
}

export async function cancelarProvaGerada(idProva, payload) {
  const resultado = await requisitar(
    `/generated-exams/${encodeURIComponent(idProva)}/cancel`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload || {}),
    },
  );
  invalidarCacheApi(CACHE_PROVAS_GERADAS, 'candidatos-processos', 'processos', 'pipeline-candidatos');
  return resultado;
}

export async function registrarDecisaoRhProva(idProva, payload) {
  const resultado = await requisitar(
    `/generated-exams/${encodeURIComponent(idProva)}/decision`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload || {}),
    },
  );
  invalidarCacheApi(CACHE_PROVAS_GERADAS, 'candidatos-processos', 'processos', 'pipeline-candidatos', 'banco-talentos');
  return resultado;
}

export async function acessarProvaPorEmail(email) {
  return requisitar('/conecta-provas-api/acesso/email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  }, { autenticado: false });
}

export async function acessarProvaPorTelefone(telefone) {
  return requisitar('/conecta-provas-api/acesso/telefone', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ telefone }),
  }, { autenticado: false });
}

export async function acessarProvaPorCodigo(codigo) {
  return requisitar('/conecta-provas-api/acesso/codigo', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ codigo }),
  }, { autenticado: false });
}

export async function lerSessaoConectaProvas(token) {
  return requisitar('/conecta-provas-api/sessao', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  }, { autenticado: false });
}

export async function confirmarDadosConectaProvas(payload) {
  return requisitar('/conecta-provas-api/confirmar-dados', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload || {}),
  }, { autenticado: false });
}

export async function iniciarConectaProvas(token) {
  return requisitar('/conecta-provas-api/iniciar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  }, { autenticado: false });
}

export async function salvarRespostasConectaProvas(token, respostas) {
  return requisitar('/conecta-provas-api/respostas', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, respostas }),
  }, { autenticado: false });
}

export async function marcarRevisaoConectaProvas(token, respostas) {
  return requisitar('/conecta-provas-api/revisao', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, respostas }),
  }, { autenticado: false });
}

export async function finalizarConectaProvas(token, respostas, opcoes = {}) {
  return requisitar('/conecta-provas-api/finalizar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      token,
      respostas,
      finalizar_mesmo_assim: Boolean(opcoes.finalizarMesmoAssim),
    }),
  }, { autenticado: false });
}
