import { requisitar } from './core.js';

export async function listarOperacoes() {
  return requisitar('/operacoes', { method: 'GET' });
}
