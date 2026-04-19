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
