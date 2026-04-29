import { invalidarCacheApi, requisitar } from './core.js';

export async function lerEntrevistas({
  idProcesso = '',
  statusEntrevista = '',
  search = '',
} = {}) {
  const params = new URLSearchParams();
  if (idProcesso) params.set('id_processo', idProcesso);
  if (statusEntrevista) params.set('status_entrevista', statusEntrevista);
  if (search) params.set('search', search);

  const sufixo = params.toString() ? `?${params.toString()}` : '';
  return requisitar(`/interviews${sufixo}`, { method: 'GET' });
}

export async function lerSlotsEntrevista({
  idProcesso = '',
  date = '',
  statusSlot = '',
} = {}) {
  const params = new URLSearchParams();
  if (idProcesso) params.set('id_processo', idProcesso);
  if (date) params.set('date', date);
  if (statusSlot) params.set('status_slot', statusSlot);

  const sufixo = params.toString() ? `?${params.toString()}` : '';
  return requisitar(`/interview-slots${sufixo}`, { method: 'GET' });
}

export async function criarSlotsEntrevista(payload) {
  const resultado = await requisitar('/interview-slots', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  invalidarCacheApi('candidatos-processos', 'pipeline-candidatos', 'processos');
  return resultado;
}

export async function atualizarSlotEntrevista(idSlot, payload) {
  const resultado = await requisitar(
    `/interview-slots/${encodeURIComponent(idSlot)}`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    },
  );

  invalidarCacheApi('candidatos-processos', 'pipeline-candidatos', 'processos');
  return resultado;
}

export async function agendarEntrevista(payload) {
  const resultado = await requisitar('/interviews', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  invalidarCacheApi('candidatos-processos', 'pipeline-candidatos', 'processos');
  return resultado;
}

export async function atualizarEntrevista(idEntrevista, payload) {
  const resultado = await requisitar(
    `/interviews/${encodeURIComponent(idEntrevista)}`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    },
  );

  invalidarCacheApi('candidatos-processos', 'pipeline-candidatos', 'processos');
  return resultado;
}
