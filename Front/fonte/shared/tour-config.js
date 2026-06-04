const TOUR_TEXTOS = {
  'screen-menu': {
    label: 'Painel principal',
    introTitle: 'Painel principal',
    introText:
      'Aqui o RH acompanha os registros mais recentes, acessa atalhos operacionais e inicia novos fluxos sem perder o contexto.',
    primaryActionText:
      'Use este atalho para iniciar uma nova avaliação a partir do painel principal.',
    extraSteps: [
      {
        tourId: 'home-shortcuts',
        title: 'Atalhos operacionais',
        text:
          'Os cards levam direto para prova, processos e histórico, reduzindo o caminho até as rotinas mais usadas.',
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
    label: 'Histórico',
    introTitle: 'Histórico de provas',
    introText:
      'Esta tela centraliza consultas por candidato, vaga e data para auditoria e reaproveitamento das avaliações.',
    primaryActionText:
      'Inicie uma nova avaliação sem sair da área de histórico.',
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
          'Use as ações da tabela para abrir detalhes da prova ou baixar o pacote salvo.',
      },
    ],
  },
  'screen-process-create': {
    label: 'Novo processo',
    introTitle: 'Novo processo seletivo',
    introText:
      'Configure a vaga, prazo e regras de corte preservando a integração com provas, pipeline e entrevistas.',
    primaryActionText:
      'Volte rapidamente para a gestão de processos quando precisar revisar a lista atual.',
    extraSteps: [
      {
        tourId: 'process-create-form',
        title: 'Cadastro do processo',
        text:
          'Preencha os campos principais da vaga, defina nota de corte quando necessário e salve o processo para abrir o funil.',
      },
    ],
  },
  'screen-processes': {
    label: 'Processos seletivos',
    introTitle: 'Gestão de processos',
    introText:
      'Esta área consolida processos abertos, encerrados e candidatos em análise com acesso direto ao detalhe do funil.',
    primaryActionText:
      'Crie um novo processo seletivo mantendo o cadastro alinhado com o backend atual.',
    extraSteps: [
      {
        tourId: 'process-filters',
        title: 'Filtros de processos',
        text:
          'Aplique filtros por vaga, operação, nota de corte e status antes de navegar nas listas.',
      },
      {
        tourId: 'process-open-table',
        title: 'Processos abertos',
        text:
          'Use a tabela para editar, abrir detalhes e encerrar processos sem perder a referência operacional.',
      },
    ],
  },
  'screen-process-details': {
    label: 'Detalhes do processo',
    introTitle: 'Detalhes do processo',
    introText:
      'Aqui você acompanha o resumo da vaga, as pré-análises de CV, os candidatos vinculados e a agenda de entrevistas do processo.',
    primaryActionText:
      'Use este atalho para retornar à tela de gestão completa de processos.',
    extraSteps: [
      {
        tourId: 'process-summary',
        title: 'Resumo do processo',
        text:
          'Consulte vagas, operação, trilha, nota de corte e indicadores consolidados do processo selecionado.',
      },
      {
        tourId: 'process-cv-preanalysis',
        title: 'Pré-análise de CV',
        text:
          'Envie currículos, revise a extração automática e aprove candidatos para o processo sem retrabalho manual.',
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
      'Crie um card manual quando precisar registrar um candidato fora do fluxo automático.',
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
          'Cada coluna representa uma etapa do funil e permite avançar, retroceder ou excluir cards com segurança.',
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
      'Reaproveite candidatos aprovados em etapas anteriores com tags, habilidades e observações persistidas.',
    extraSteps: [
      {
        tourId: 'talent-filters',
        title: 'Filtros do banco',
        text:
          'Busque por nome, habilidade e tag para localizar perfis reutilizáveis com mais rapidez.',
      },
      {
        tourId: 'talent-table',
        title: 'Lista reutilizável',
        text:
          'A tabela permite atualizar perfil RH, eliminar registros ou reaproveitar o candidato em um novo processo.',
      },
    ],
  },
  'screen-analysis-candidates': {
    label: 'Análise de candidatos',
    introTitle: 'Análise por candidato',
    introText:
      'Compare nota, afinidade e recomendação para apoiar decisões do RH com o mesmo conjunto de dados do sistema.',
    extraSteps: [
      {
        tourId: 'analysis-filters',
        title: 'Filtros analíticos',
        text:
          'Restrinja o ranking por processo, candidato, vaga ou nota mínima antes de abrir os detalhes.',
      },
      {
        tourId: 'analysis-ranking',
        title: 'Ranking analítico',
        text:
          'Abra o detalhe do candidato para validar afinidade, recomendação e aplicar a ação adequada.',
      },
    ],
  },
  'screen-config': {
    label: 'Configuração da prova',
    introTitle: 'Configuração da prova',
    introText:
      'Defina processo, perfil, nível e tempo da avaliação antes de iniciar o fluxo do candidato.',
    primaryActionText:
      'Reinicie o fluxo de configuração quando quiser montar uma nova avaliação rapidamente.',
    extraSteps: [
      {
        tourId: 'config-parameters',
        title: 'Parâmetros da avaliação',
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
      'Use o menu lateral, a busca global e o contexto da página para navegar pelo fluxo atual com segurança.',
    primaryActionText:
      'Use esta ação principal para avançar no fluxo da tela atual.',
    extraSteps: [],
  };

  const steps = [
    {
      target: montarSeletor(screenId, 'layout-sidebar'),
      title: 'Menu lateral',
      text:
        'Navegue entre os módulos principais do RH sem perder a sessão nem o contexto operacional.',
    },
    {
      target: montarSeletor(screenId, 'topbar-search'),
      title: 'Busca global',
      text:
        'Pesquise páginas, processos, candidatos e requisitos diretamente pelo topo da aplicação.',
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
      title: 'Ação principal',
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
        title: 'Visão da plataforma',
        text:
          'Este painel resume o escopo da solução para RH, incluindo processos, provas, entrevistas e análise.',
      },
      {
        target: '#screen-login [data-tour-id="login-panel"]',
        title: 'Credenciais de acesso',
        text:
          'Informe login e senha corporativos para liberar o console com os módulos protegidos do RH.',
      },
      {
        target: '#screen-login [data-tour-id="login-submit"]',
        title: 'Entrada segura',
        text:
          'Use este botão para validar a sessão e seguir para o painel principal da plataforma.',
      },
    ],
  };
}
