import { invalidarCacheApi, requisitar } from './core.js';

function montarQuery(params = {}) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([chave, valor]) => {
    if (valor === undefined || valor === null || valor === '') return;
    query.set(chave, valor);
  });
  const texto = query.toString();
  return texto ? `?${texto}` : '';
}

export async function listarTrilhasOnboarding(filtros = {}) {
  return requisitar(`/onboarding/trilhas${montarQuery(filtros)}`, { method: 'GET' });
}

export async function listarAtribuicoesTreinamento(filtros = {}) {
  return requisitar(`/onboarding/assignments${montarQuery(filtros)}`, { method: 'GET' });
}

export async function atualizarAgendaTreinamento(idOnboarding, payload) {
  const resultado = await requisitar(`/onboarding/assignments/${encodeURIComponent(idOnboarding)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload || {}),
  });
  invalidarCacheApi('onboarding-progresso');
  return resultado;
}

export async function lerTrilhaOnboarding(idTrilha) {
  return requisitar(`/onboarding/trilhas/${encodeURIComponent(idTrilha)}`, { method: 'GET' });
}

export async function criarTrilhaOnboarding(payload) {
  const resultado = await requisitar('/onboarding/trilhas', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload || {}),
  });
  invalidarCacheApi('onboarding-trilhas');
  return resultado;
}

export async function atualizarTrilhaOnboarding(idTrilha, payload) {
  const resultado = await requisitar(`/onboarding/trilhas/${encodeURIComponent(idTrilha)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload || {}),
  });
  invalidarCacheApi('onboarding-trilhas');
  return resultado;
}

export async function iniciarOnboardingCandidato(payload) {
  const resultado = await requisitar('/onboarding/candidatos/iniciar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload || {}),
  });
  invalidarCacheApi('onboarding-progresso');
  return resultado;
}

export async function lerProgressoOnboardingCandidato(idRegistro) {
  return requisitar(`/onboarding/candidatos/${encodeURIComponent(idRegistro)}`, { method: 'GET' });
}

export async function marcarItemOnboarding(idOnboardingItem, concluido) {
  const resultado = await requisitar(`/onboarding/itens/${encodeURIComponent(idOnboardingItem)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ concluido: !!concluido }),
  });
  invalidarCacheApi('onboarding-progresso');
  return resultado;
}

export async function excluirAtribuicaoTreinamento(idOnboarding) {
  const resultado = await requisitar(`/onboarding/assignments/${encodeURIComponent(idOnboarding)}`, {
    method: 'DELETE',
  });
  invalidarCacheApi('onboarding-progresso');
  return resultado;
}

export async function salvarPresencaTreinamento(presencas) {
  const resultado = await requisitar('/onboarding/assignments/presenca', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ presencas: presencas || [] }),
  });
  invalidarCacheApi('onboarding-progresso');
  return resultado;
}

export async function listarTreinamentosProcesso(filtros = {}) {
  return requisitar(`/onboarding/processos-treinamentos${montarQuery(filtros)}`, { method: 'GET' });
}

export async function listarCandidatosLiberacaoTreinamento(idProcessoTreinamento) {
  return requisitar(
    `/onboarding/processos-treinamentos/${encodeURIComponent(idProcessoTreinamento)}/candidatos`,
    { method: 'GET' },
  );
}

export async function liberarVagasTreinamento(idProcessoTreinamento, candidatos) {
  const resultado = await requisitar(
    `/onboarding/processos-treinamentos/${encodeURIComponent(idProcessoTreinamento)}/liberar`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ candidatos: candidatos || [] }),
    },
  );
  invalidarCacheApi('onboarding-progresso');
  return resultado;
}
