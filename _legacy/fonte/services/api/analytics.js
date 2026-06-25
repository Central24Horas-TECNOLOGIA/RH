import { requisitar, requisitarArquivo } from './core.js';

export async function lerAnalisesCandidatos() {
  return requisitar('/candidate-analytics', { method: 'GET' });
}

export async function lerDetalheAnaliseCandidato(idTeste) {
  return requisitar(`/candidate-analytics/${encodeURIComponent(idTeste)}`, {
    method: 'GET',
  });
}

function montarParametrosRelatorio(filtros = {}) {
  const params = new URLSearchParams();
  if (filtros.dataInicial) params.set('start_date', filtros.dataInicial);
  if (filtros.dataFinal) params.set('end_date', filtros.dataFinal);
  if (filtros.status) params.set('status_filter', filtros.status);
  if (filtros.processo) params.set('id_processo', filtros.processo);
  const query = params.toString();
  return query ? `?${query}` : '';
}

export async function lerRelatorioProcessos(filtros = {}) {
  return requisitar(`/reports/processes${montarParametrosRelatorio(filtros)}`, {
    method: 'GET',
  });
}

export async function baixarRelatorioProcessos(filtros = {}) {
  return requisitarArquivo(
    `/reports/processes/export${montarParametrosRelatorio(filtros)}`,
    { method: 'GET' },
  );
}

export async function lerRelatorioCandidatos(filtros = {}) {
  return requisitar(`/reports/candidates${montarParametrosRelatorio(filtros)}`, {
    method: 'GET',
  });
}

export async function baixarRelatorioCandidatos(filtros = {}) {
  return requisitarArquivo(
    `/reports/candidates/export${montarParametrosRelatorio(filtros)}`,
    { method: 'GET' },
  );
}
