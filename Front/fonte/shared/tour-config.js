const TOUR_TEXTOS = {
  'screen-menu': {
    label: 'Painel principal',
    introTitle: 'Painel principal',
    introText:
      'Aqui o RH acompanha os registros mais recentes, acessa atalhos operacionais e inicia novos fluxos sem perder o contexto.',
    primaryActionText:
      'Use este atalho para iniciar uma nova avaliacao a partir do painel principal.',
    extraSteps: [
      {
        tourId: 'home-shortcuts',
        title: 'Atalhos operacionais',
        text:
          'Os cards levam direto para prova, processos e historico, reduzindo o caminho ate as rotinas mais usadas.',
      },
      {
        tourId: 'home-recent',
        title: 'Registros recentes',
        text:
          'Abra um item recente para revisar detalhes da prova salva ou baixar o pacote consolidado.',
      },
    ],
  },
  'screen-history': {
    label: 'Historico',
    introTitle: 'Historico de provas',
    introText:
      'Esta tela centraliza consultas por candidato, vaga e data para auditoria e reaproveitamento das avaliacoes.',
    primaryActionText:
      'Inicie uma nova avaliacao sem sair da area de historico.',
    extraSteps: [
      {
        tourId: 'history-filters',
        title: 'Filtros de consulta',
        text:
          'Refine a busca por nome, vaga e data para localizar rapidamente o registro correto.',
      },
      {
        tourId: 'history-results',
        title: 'Tabela de resultados',
        text:
          'Use as acoes da tabela para abrir detalhes da prova ou baixar o pacote salvo.',
      },
    ],
  },
  'screen-process-create': {
    label: 'Novo processo',
    introTitle: 'Novo processo seletivo',
    introText:
      'Configure a vaga, prazo, regras de corte e link de agendamento preservando a integracao com provas, pipeline e entrevistas.',
    primaryActionText:
      'Volte rapidamente para a gestao de processos quando precisar revisar a lista atual.',
    extraSteps: [
      {
        tourId: 'process-create-form',
        title: 'Cadastro do processo',
        text:
          'Preencha os campos principais da vaga, defina nota de corte quando necessario e salve o processo para abrir o funil.',
      },
    ],
  },
  'screen-processes': {
    label: 'Processos seletivos',
    introTitle: 'Gestao de processos',
    introText:
      'Esta area consolida processos abertos, encerrados e candidatos em analise com acesso direto ao detalhe do funil.',
    primaryActionText:
      'Crie um novo processo seletivo mantendo o cadastro alinhado com o backend atual.',
    extraSteps: [
      {
        tourId: 'process-filters',
        title: 'Filtros de processos',
        text:
          'Aplique filtros por vaga, operacao, nota de corte e status antes de navegar nas listas.',
      },
      {
        tourId: 'process-open-table',
        title: 'Processos abertos',
        text:
          'Use a tabela para editar, abrir detalhes e encerrar processos sem perder a referencia operacional.',
      },
    ],
  },
  'screen-process-details': {
    label: 'Detalhes do processo',
    introTitle: 'Detalhes do processo',
    introText:
      'Aqui voce acompanha o resumo da vaga, as pre-analises de CV, os candidatos vinculados e a agenda de entrevistas do processo.',
    primaryActionText:
      'Use este atalho para retornar a tela de gestao completa de processos.',
    extraSteps: [
      {
        tourId: 'process-summary',
        title: 'Resumo do processo',
        text:
          'Consulte vagas, operacao, trilha, nota de corte e indicadores consolidados do processo selecionado.',
      },
      {
        tourId: 'process-cv-preanalysis',
        title: 'Pre-analise de CV',
        text:
          'Envie curriculos, revise a extração automatica e aprove candidatos para o processo sem retrabalho manual.',
      },
      {
        tourId: 'process-candidates',
        title: 'Candidatos do processo',
        text:
          'Atualize status, envie para banco de talentos e agende entrevistas diretamente na grade principal.',
      },
      {
        tourId: 'process-interviews',
        title: 'Entrevistas vinculadas',
        text:
          'Acompanhe a agenda do processo e valide rapidamente data, status e link de agendamento.',
      },
    ],
  },
  'screen-candidate-pipeline': {
    label: 'Pipeline',
    introTitle: 'Pipeline de candidatos',
    introText:
      'O kanban mostra o avanço real do candidato por etapa, refletindo status persistidos no backend.',
    primaryActionText:
      'Crie um card manual quando precisar registrar um candidato fora do fluxo automatico.',
    extraSteps: [
      {
        tourId: 'pipeline-filters',
        title: 'Filtros do pipeline',
        text:
          'Combine processo e busca textual para reduzir a lista antes de mover ou revisar cards.',
      },
      {
        tourId: 'pipeline-board',
        title: 'Quadro por etapa',
        text:
          'Cada coluna representa uma etapa do funil e permite avancar, retroceder ou excluir cards com seguranca.',
      },
    ],
  },
  'screen-interviews': {
    label: 'Entrevistas',
    introTitle: 'Agenda de entrevistas',
    introText:
      'A agenda consolida compromissos, status e mensagens base geradas para cada candidato.',
    extraSteps: [
      {
        tourId: 'interview-filters',
        title: 'Filtros da agenda',
        text:
          'Refine a lista por processo, status e busca textual para localizar rapidamente o agendamento certo.',
      },
      {
        tourId: 'interview-agenda',
        title: 'Agenda operacional',
        text:
          'Atualize status, copie a mensagem base e abra o link de agendamento diretamente na tabela.',
      },
    ],
  },
  'screen-talent-bank': {
    label: 'Banco de talentos',
    introTitle: 'Banco de talentos',
    introText:
      'Reaproveite candidatos aprovados em etapas anteriores com tags, habilidades e observacoes persistidas.',
    extraSteps: [
      {
        tourId: 'talent-filters',
        title: 'Filtros do banco',
        text:
          'Busque por nome, habilidade e tag para localizar perfis reutilizaveis com mais rapidez.',
      },
      {
        tourId: 'talent-table',
        title: 'Lista reutilizavel',
        text:
          'A tabela permite atualizar perfil RH, eliminar registros ou reaproveitar o candidato em um novo processo.',
      },
    ],
  },
  'screen-analysis-candidates': {
    label: 'Analise de candidatos',
    introTitle: 'Analise por candidato',
    introText:
      'Compare nota, afinidade e recomendacao para apoiar decisoes do RH com o mesmo conjunto de dados do sistema.',
    extraSteps: [
      {
        tourId: 'analysis-filters',
        title: 'Filtros analiticos',
        text:
          'Restrinja o ranking por processo, candidato, vaga ou nota minima antes de abrir os detalhes.',
      },
      {
        tourId: 'analysis-ranking',
        title: 'Ranking analitico',
        text:
          'Abra o detalhe do candidato para validar afinidade, recomendacao e aplicar a acao adequada.',
      },
    ],
  },
  'screen-config': {
    label: 'Configuracao da prova',
    introTitle: 'Configuracao da prova',
    introText:
      'Defina processo, perfil, nivel e tempo da avaliacao antes de iniciar o fluxo do candidato.',
    primaryActionText:
      'Reinicie o fluxo de configuracao quando quiser montar uma nova avaliacao rapidamente.',
    extraSteps: [
      {
        tourId: 'config-parameters',
        title: 'Parametros da avaliacao',
        text:
          'Esses campos alimentam o estado global da prova e garantem que o resultado volte ao processo correto.',
      },
    ],
  },
};

function montarSeletor(screenId, tourId) {
  return `#${screenId} [data-tour-id="${tourId}"]`;
}

export function obterTourDaTela(screenId, { hasPrimaryAction = false } = {}) {
  if (!screenId) return null;

  const config = TOUR_TEXTOS[screenId] || {
    label: 'Tela atual',
    introTitle: 'Tela atual',
    introText:
      'Use o menu lateral, a busca global e o contexto da pagina para navegar pelo fluxo atual com seguranca.',
    primaryActionText:
      'Use esta acao principal para avancar no fluxo da tela atual.',
    extraSteps: [],
  };

  const steps = [
    {
      target: montarSeletor(screenId, 'layout-sidebar'),
      title: 'Menu lateral',
      text:
        'Navegue entre os modulos principais do RH sem perder a sessao nem o contexto operacional.',
    },
    {
      target: montarSeletor(screenId, 'topbar-search'),
      title: 'Busca global',
      text:
        'Pesquise paginas, processos, candidatos e requisitos diretamente pelo topo da aplicacao.',
    },
    {
      target: montarSeletor(screenId, 'page-intro'),
      title: config.introTitle,
      text: config.introText,
    },
  ];

  if (hasPrimaryAction) {
    steps.push({
      target: montarSeletor(screenId, 'topbar-primary-action'),
      title: 'Acao principal',
      text: config.primaryActionText,
    });
  }

  (config.extraSteps || []).forEach((step) => {
    steps.push({
      target: montarSeletor(screenId, step.tourId),
      title: step.title,
      text: step.text,
    });
  });

  return {
    label: config.label,
    steps,
  };
}

export function obterTourLogin() {
  return {
    label: 'Acesso ao sistema',
    steps: [
      {
        target: '#screen-login [data-tour-id="login-hero"]',
        title: 'Visao da plataforma',
        text:
          'Este painel resume o escopo da solucao para RH, incluindo processos, provas, entrevistas e analise.',
      },
      {
        target: '#screen-login [data-tour-id="login-panel"]',
        title: 'Credenciais de acesso',
        text:
          'Informe login e senha corporativos para liberar o console com os modulos protegidos do RH.',
      },
      {
        target: '#screen-login [data-tour-id="login-submit"]',
        title: 'Entrada segura',
        text:
          'Use este botao para validar a sessao e seguir para o painel principal da plataforma.',
      },
    ],
  };
}
