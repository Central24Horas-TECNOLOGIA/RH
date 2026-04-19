import type { RouteId, ScreenId } from '../types/models';

export const routeMap: Record<ScreenId, RouteId> = {
  'screen-login': 'login',
  'screen-menu': 'inicio',
  'screen-history': 'historico',
  'screen-processes': 'processos',
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
};
