const DEBUG_ATIVO =
  window.__RH_DEBUG__ === true || localStorage.getItem('rh_debug') === '1';

function escrever(tipo, escopo, mensagem, contexto) {
  const metodo = console[tipo] || console.log;
  const prefixo = `[RH:${escopo}]`;

  if (contexto !== undefined) {
    metodo(prefixo, mensagem, contexto);
    return;
  }

  metodo(prefixo, mensagem);
}

export function criarLogger(escopo) {
  return {
    info(mensagem, contexto) {
      escrever('info', escopo, mensagem, contexto);
    },
    warn(mensagem, contexto) {
      escrever('warn', escopo, mensagem, contexto);
    },
    error(mensagem, contexto) {
      escrever('error', escopo, mensagem, contexto);
    },
    debug(mensagem, contexto) {
      if (!DEBUG_ATIVO) return;
      escrever('debug', escopo, mensagem, contexto);
    },
  };
}
