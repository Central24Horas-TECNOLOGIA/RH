// Gerenciamento do tema claro/escuro (dark mode) da aplicação.
// Persiste a escolha do usuário em localStorage e reflete no atributo
// data-theme da tag <html>. O tema claro é o padrão do sistema para
// todo mundo; o escuro só entra se a pessoa escolher explicitamente
// (não segue mais a preferência do sistema operacional).

const CHAVE_STORAGE = 'c24_tema_preferido';
const TEMAS_VALIDOS = ['claro', 'escuro'];

export function obterTemaSalvo() {
  try {
    const valor = window.localStorage.getItem(CHAVE_STORAGE);
    return TEMAS_VALIDOS.includes(valor) ? valor : 'claro';
  } catch (_erro) {
    return 'claro';
  }
}

export function aplicarTema(tema) {
  const escolha = TEMAS_VALIDOS.includes(tema) ? tema : 'claro';
  const raiz = document.documentElement;

  raiz.setAttribute('data-theme', escolha === 'escuro' ? 'dark' : 'light');

  // Sincroniza o dark mode nativo do Bootstrap (5.3+) para que modais,
  // dropdowns, formulários e tabelas que ainda usam classes Bootstrap
  // "cruas" também sigam o tema escolhido.
  raiz.setAttribute('data-bs-theme', escolha === 'escuro' ? 'dark' : 'light');

  return escolha;
}

export function definirTema(tema) {
  const escolha = aplicarTema(tema);
  try {
    window.localStorage.setItem(CHAVE_STORAGE, escolha);
  } catch (_erro) {
    // Sem acesso a localStorage (modo privado, etc.): mantém apenas em memória.
  }
  return escolha;
}

export function inicializarTema() {
  aplicarTema(obterTemaSalvo());
}

export function proximoTema(temaAtual) {
  return temaAtual === 'escuro' ? 'claro' : 'escuro';
}
