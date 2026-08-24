import { invalidarCacheApi, requisitar } from './core.js';

export async function listarDatasComemorativas() {
  return requisitar('/celebratory-dates', { method: 'GET' });
}

export async function criarDataComemorativa(payload) {
  const resultado = await requisitar('/celebratory-dates', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload || {}),
  });
  invalidarCacheApi('celebratory-dates');
  return resultado;
}

export async function atualizarDataComemorativa(idData, payload) {
  const resultado = await requisitar(`/celebratory-dates/${encodeURIComponent(idData)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload || {}),
  });
  invalidarCacheApi('celebratory-dates');
  return resultado;
}

export async function removerDataComemorativa(idData) {
  const resultado = await requisitar(`/celebratory-dates/${encodeURIComponent(idData)}`, {
    method: 'DELETE',
  });
  invalidarCacheApi('celebratory-dates');
  return resultado;
}
