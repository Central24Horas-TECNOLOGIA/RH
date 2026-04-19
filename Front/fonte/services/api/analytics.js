import { requisitar } from './core.js';

export async function lerAnalisesCandidatos() {
  return requisitar('/candidate-analytics', { method: 'GET' });
}

export async function lerDetalheAnaliseCandidato(idTeste) {
  return requisitar(`/candidate-analytics/${encodeURIComponent(idTeste)}`, {
    method: 'GET',
  });
}
