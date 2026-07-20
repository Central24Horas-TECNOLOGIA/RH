import {
  limparSessaoAutenticacao,
  lerSessaoAutenticacao,
  possuiSessaoAutenticada,
  requisitar,
  salvarSessaoAutenticacao,
} from './core.js';

export async function fazerLoginApi(usuario, senha, mfaCode = '') {
  const resultado = await requisitar(
    '/auth/login',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usuario, senha, mfa_code: mfaCode }),
    },
    { autenticado: false },
  );

  salvarSessaoAutenticacao(resultado.access_token, resultado);
  return resultado;
}

export async function concluirLoginMicrosoftApi() {
  const resultado = await requisitar(
    '/auth/microsoft/complete',
    {
      method: 'POST',
      credentials: 'include',
    },
    { autenticado: false },
  );

  salvarSessaoAutenticacao(resultado.access_token, resultado);
  return resultado;
}

export async function verificarSessaoApi() {
  const sessao = await requisitar('/auth/me', { method: 'GET' });
  salvarSessaoAutenticacao(lerSessaoAutenticacao().token, sessao);
  return sessao;
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
