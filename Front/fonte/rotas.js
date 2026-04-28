// Mantém a navegação em hash simples para funcionar sem etapa de build.
export const ROTAS_POR_TELA = {
  'screen-login': 'login',
  'screen-menu': 'inicio',
  'screen-history': 'historico',
  'screen-processes': 'processos',
  'screen-candidates': 'candidatos',
  'screen-candidate-pipeline': 'pipeline-candidatos',
  'screen-process-create': 'novo-processo',
  'screen-process-details': 'detalhes-processo',
  'screen-interviews': 'entrevistas',
  'screen-talent-bank': 'banco-talentos',
  'screen-config': 'configuracao',
  'screen-candidate': 'candidato',
  'screen-exam': 'prova',
  'screen-thanks': 'conclusao',
  'screen-result': 'resultado',
  'screen-analysis-candidates': 'analise-candidatos',
  'screen-public-candidacy': 'candidatar',
};

export const TELAS_POR_ROTA = Object.entries(ROTAS_POR_TELA).reduce(
  (mapa, [tela, rota]) => {
    mapa[rota] = tela;
    return mapa;
  },
  {},
);

export function obterRotaPorTela(tela) {
  return ROTAS_POR_TELA[tela] || ROTAS_POR_TELA['screen-login'];
}

export function obterTelaPorHash(hashAtual) {
  const rota = String(hashAtual || '')
    .replace(/^#\/?/, '')
    .trim();

  if (!rota) return 'screen-login';
  if (rota.startsWith('candidatar/')) return 'screen-public-candidacy';
  return TELAS_POR_ROTA[rota] || 'screen-login';
}

export function montarHashDaTela(tela) {
  return `#/${obterRotaPorTela(tela)}`;
}

export function obterSlugCandidaturaPorHash(hashAtual) {
  const rota = String(hashAtual || '')
    .replace(/^#\/?/, '')
    .trim();

  if (!rota.startsWith('candidatar/')) return '';
  return decodeURIComponent(rota.slice('candidatar/'.length));
}

export function montarHashCandidatura(slug) {
  return `#/candidatar/${encodeURIComponent(String(slug || '').trim())}`;
}
