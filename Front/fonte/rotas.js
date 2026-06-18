// Mantém a navegação em hash simples para funcionar sem etapa de build.
export const ROTAS_POR_TELA = {
  'screen-login': 'login',
  'screen-menu': 'inicio',
  'screen-email-inbox': 'caixa-email',
  'screen-history': 'processos/historico-exames',
  'screen-processes': 'processos',
  'screen-processes-open': 'processos/abertos',
  'screen-processes-closed': 'processos/encerrados',
  'screen-process-decisions': 'processos/decisoes-pendentes',
  'screen-candidates': 'candidatos',
  'screen-candidate-pipeline': 'pipeline-candidatos',
  'screen-process-create': 'novo-processo',
  'screen-process-details': 'detalhes-processo',
  'screen-candidate-details': 'candidatos/detalhes',
  'screen-interviews': 'processos/entrevistas-agendadas',
  'screen-talent-bank': 'banco-talentos',
  'screen-settings-users': 'configuracoes/usuario',
  'screen-settings-profiles': 'configuracoes/perfis-permissoes',
  'screen-settings-rules': 'configuracoes/regras-reutilizaveis',
  'screen-settings-logs': 'configuracoes/logs',
  'screen-settings': 'configuracoes/usuario',
  'screen-generated-exams': 'processos/provas-resultados',
  'screen-config': 'configuracao',
  'screen-candidate': 'candidato',
  'screen-exam': 'prova',
  'screen-thanks': 'conclusao',
  'screen-result': 'resultado',
  'screen-analysis-candidates': 'analise-candidatos',
  'screen-public-candidacy': 'candidatar',
  'screen-conecta-provas': 'conecta-provas',
  'screen-forbidden': 'acesso-negado',
};

export const TELAS_POR_ROTA = Object.entries(ROTAS_POR_TELA).reduce(
  (mapa, [tela, rota]) => {
    mapa[rota] = tela;
    return mapa;
  },
  {},
);

TELAS_POR_ROTA['processos/visao-geral'] = 'screen-processes';
TELAS_POR_ROTA.historico = 'screen-history';
TELAS_POR_ROTA['historico-exames'] = 'screen-history';
TELAS_POR_ROTA['provas-resultados'] = 'screen-generated-exams';
TELAS_POR_ROTA.entrevistas = 'screen-interviews';
TELAS_POR_ROTA.configuracoes = 'screen-settings-users';
TELAS_POR_ROTA['configuracoes/usuario'] = 'screen-settings-users';
TELAS_POR_ROTA['configuracoes/usuarios'] = 'screen-settings-users';

export function obterRotaPorTela(tela) {
  return ROTAS_POR_TELA[tela] || ROTAS_POR_TELA['screen-login'];
}

export function obterTelaPorHash(hashAtual) {
  const pathname =
    typeof window !== 'undefined' ? String(window.location.pathname || '') : '';
  const caminhoNormalizado = pathname.replace(/\/+$/, '') || '/';
  if (
    caminhoNormalizado === '/conecta-provas' ||
    caminhoNormalizado.startsWith('/conecta-provas/')
  ) {
    return 'screen-conecta-provas';
  }

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
