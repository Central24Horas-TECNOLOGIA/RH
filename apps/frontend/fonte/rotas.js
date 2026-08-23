// Mantém a navegação em hash simples para funcionar sem etapa de build.
export const ROTAS_POR_TELA = {
  'screen-login': 'login',
  'screen-menu': 'inicio',
  'screen-email-inbox': 'caixa-email',
  'screen-history': 'processos/historico-exames',
  'screen-processes': 'processos',
  'screen-processes-closed': 'processos/encerrados',
  'screen-process-decisions': 'processos/decisoes-pendentes',
  'screen-candidates': 'candidatos',
  'screen-candidate-pipeline': 'pipeline-candidatos',
  'screen-process-create': 'novo-processo',
  'screen-process-details': 'detalhes-processo',
  'screen-candidate-details': 'candidatos/detalhes',
  'screen-interviews': 'processos/entrevistas-agendadas',
  'screen-talent-bank': 'banco-talentos',
  'screen-documents': 'drive-conecta',
  'screen-settings-users': 'configuracoes/usuario',
  'screen-settings-profiles': 'configuracoes/perfis-permissoes',
  'screen-settings-logs': 'configuracoes/logs',
  'screen-settings': 'configuracoes/usuario',
  'screen-generated-exams': 'processos/provas-resultados',
  'screen-process-analytical-results': 'processos/resultados-analiticos',
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
TELAS_POR_ROTA['processos/abertos'] = 'screen-processes';
TELAS_POR_ROTA.historico = 'screen-history';
TELAS_POR_ROTA['historico-exames'] = 'screen-history';
TELAS_POR_ROTA['provas-resultados'] = 'screen-generated-exams';
TELAS_POR_ROTA.entrevistas = 'screen-interviews';
TELAS_POR_ROTA.configuracoes = 'screen-settings-users';
TELAS_POR_ROTA['configuracoes/usuario'] = 'screen-settings-users';
TELAS_POR_ROTA['configuracoes/usuarios'] = 'screen-settings-users';
TELAS_POR_ROTA['configuracoes/regras-reutilizaveis'] = 'screen-settings-users';

export function obterRotaPorTela(tela) {
  if (tela === 'screen-processes-open') return ROTAS_POR_TELA['screen-processes'];
  return ROTAS_POR_TELA[tela] || ROTAS_POR_TELA['screen-login'];
}

function normalizarRota(valor) {
  return String(valor || '')
    .replace(/^#\/?/, '')
    .replace(/^\/+/, '')
    .replace(/\/+$/, '')
    .trim();
}

export function obterRotaAtual() {
  const pathname =
    typeof window !== 'undefined' ? String(window.location.pathname || '') : '';
  const hashLegado =
    typeof window !== 'undefined' ? normalizarRota(window.location.hash) : '';
  if (hashLegado) return hashLegado;

  const caminhoNormalizado = pathname.replace(/\/+$/, '') || '/';
  if (
    caminhoNormalizado === '/conecta-provas' ||
    caminhoNormalizado.startsWith('/conecta-provas/')
  ) {
    return 'conecta-provas';
  }

  const partes = caminhoNormalizado.split('/').filter(Boolean);
  const indiceIndex = partes.findIndex((parte) => parte.toLowerCase() === 'index.html');
  if (indiceIndex >= 0) {
    return normalizarRota(partes.slice(indiceIndex + 1).join('/'));
  }

  return normalizarRota(partes.join('/'));
}

export function obterTelaPorRota(rotaAtual = obterRotaAtual()) {
  const rota = normalizarRota(rotaAtual);
  if (!rota) return 'screen-login';
  if (rota === 'conecta-provas' || rota.startsWith('conecta-provas/')) {
    return 'screen-conecta-provas';
  }
  if (rota.startsWith('candidatar/')) return 'screen-public-candidacy';
  if (/^processos\/.+\/resultados-analiticos$/.test(rota)) {
    return 'screen-process-analytical-results';
  }
  return TELAS_POR_ROTA[rota] || 'screen-login';
}

export function obterProcessoResultadosAnaliticosPorRota(rotaAtual = obterRotaAtual()) {
  const rota = normalizarRota(rotaAtual);
  const match = rota.match(/^processos\/(.+)\/resultados-analiticos$/);
  return match ? decodeURIComponent(match[1]) : '';
}

export function montarCaminhoResultadosAnaliticos(processId) {
  return `/processos/${encodeURIComponent(String(processId || '').trim())}/resultados-analiticos`;
}

export function obterTelaPorHash(hashAtual) {
  return obterTelaPorRota(hashAtual || obterRotaAtual());
}

export function montarCaminhoDaTela(tela) {
  const rota = obterRotaPorTela(tela);
  return `/${rota}`.replace(/\/+/g, '/');
}

export function montarHashDaTela(tela) {
  return montarCaminhoDaTela(tela);
}

export function obterSlugCandidaturaPorHash(hashAtual) {
  const rota = normalizarRota(hashAtual || obterRotaAtual());

  if (!rota.startsWith('candidatar/')) return '';
  return decodeURIComponent(rota.slice('candidatar/'.length));
}

export function montarHashCandidatura(slug) {
  return `/candidatar/${encodeURIComponent(String(slug || '').trim())}`;
}
