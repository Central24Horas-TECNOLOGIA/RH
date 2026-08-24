import { invalidarCacheApi, requisitar } from './core.js';

export async function listarTrilhasOnboarding() {
  return requisitar('/onboarding/trilhas', { method: 'GET' });
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
