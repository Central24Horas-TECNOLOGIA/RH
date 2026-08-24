// Gerenciamento do tema claro/escuro (dark mode) da aplicação.
// Persiste a escolha do usuário em localStorage e reflete no atributo
// data-theme da tag <html>. Quando não há escolha explícita, o app segue
// a preferência do sistema operacional (prefers-color-scheme).

const CHAVE_STORAGE = 'c24_tema_preferido';
const TEMAS_VALIDOS = ['claro', 'escuro', 'auto'];

export function obterTemaSalvo() {
  try {
    const valor = window.localStorage.getItem(CHAVE_STORAGE);
    return TEMAS_VALIDOS.includes(valor) ? valor : 'auto';
  } catch (_erro) {
    return 'auto';
  }
}

function resolverEscuroEfetivo(escolha) {
  if (escolha === 'escuro') return true;
  if (escolha === 'claro') return false;
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  } catch (_erro) {
    return false;
  }
}

export function aplicarTema(tema) {
  const escolha = TEMAS_VALIDOS.includes(tema) ? tema : 'auto';
  const raiz = document.documentElement;

  if (escolha === 'auto') {
    raiz.removeAttribute('data-theme');
  } else {
    raiz.setAttribute('data-theme', escolha === 'escuro' ? 'dark' : 'light');
  }

  // Sincroniza o dark mode nativo do Bootstrap (5.3+) para que modais,
  // dropdowns, formulários e tabelas que ainda usam classes Bootstrap
  // "cruas" também sigam o tema escolhido.
  raiz.setAttribute('data-bs-theme', resolverEscuroEfetivo(escolha) ? 'dark' : 'light');

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

  // Em modo "auto", acompanha mudanças ao vivo na preferência do SO
  // (ex.: usuário liga o dark mode do Windows com o app já aberto).
  try {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const aoMudar = () => {
      if (obterTemaSalvo() === 'auto') aplicarTema('auto');
    };
    media.addEventListener?.('change', aoMudar);
  } catch (_erro) {
    // matchMedia indisponível: sem atualização ao vivo, tudo bem.
  }
}

export function proximoTema(temaAtual) {
  const ordem = ['claro', 'escuro', 'auto'];
  const indice = ordem.indexOf(temaAtual);
  return ordem[(indice + 1) % ordem.length];
}
