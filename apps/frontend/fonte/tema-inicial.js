// Achado S-11 (SEC-012): extraído de <script> inline em index.html para
// permitir remover 'unsafe-inline' de script-src no CSP (Caddyfile). Precisa
// rodar de forma síncrona, antes da folha de estilos e do restante da
// página, para aplicar o tema salvo sem um flash do tema errado.
(function () {
  try {
    var tema = window.localStorage.getItem('c24_tema_preferido');
    var raiz = document.documentElement;
    var escuroEfetivo = tema === 'escuro';
    raiz.setAttribute('data-theme', escuroEfetivo ? 'dark' : 'light');
    raiz.setAttribute('data-bs-theme', escuroEfetivo ? 'dark' : 'light');
  } catch (erro) {
    /* localStorage/matchMedia indisponível: segue o padrão claro */
  }
})();
