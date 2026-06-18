import {
  limparSessaoAutenticacao,
  possuiSessaoAutenticada,
  requisitar,
  salvarSessaoAutenticacao,
} from './core.js';

export async function fazerLoginApi(usuario, senha) {
  const resultado = await requisitar(
    '/auth/login',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usuario, senha }),
    },
    { autenticado: false },
  );

  salvarSessaoAutenticacao(resultado.access_token, resultado.usuario);
  return resultado;
}

export async function verificarSessaoApi() {
  return requisitar('/auth/me', { method: 'GET' });
}

export async function encerrarSessaoApi() {
  try {
    if (!possuiSessaoAutenticada()) {
      return { success: true };
    }

    return await requisitar('/auth/logout', { method: 'POST' });
  } finally {
    limparSessaoAutenticacao();
  }
}
