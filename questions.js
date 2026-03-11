function wordQ(stage, title, description, expected, points = 10) {
  return { stage, type: 'word', title, description, expected, points };
}

function mcqQ(stage, title, description, options, answer, points = 10) {
  return {
    stage,
    type: 'multiple',
    title,
    description,
    options,
    answer,
    points,
  };
}

function excelExternalQ(stage, title, description, taskId, points = 50) {
  return {
    stage,
    type: 'excel_external',
    title,
    description,
    taskId,
    points,
  };
}

const QUALID_PLANILHA_A = [
  ['Operador', 'Supervisor', 'Produto', 'Valor (R$)', 'Quantidade'],
  ['Wesley Nunes', 'Tony', 'Net Fone', 8, 7],
  ['Amanda Gilena', 'Lula', 'Total Cine Plus HD', 60, 2],
  ['Rafael Luiz', 'Tony', 'Total Cine', 25, 8],
  ['Fátima Osório', 'Angela', 'Premium Básico', 17, 1],
  ['Jorge Ponteio', 'Lula', 'Vírtua 6 MB', 20, 3],
  ['Elenilda Hilda', 'Barack', 'Net Fone', 8, 12],
  ['Simone Maria', 'Lula', 'Premium Conforto', 18, 1],
  ['Antônio Carlos', 'Angela', 'Vírtua 2 MB', 10, 3],
  ['Luis Mário', 'Barack', 'Vírtua 2 MB', 10, 4],
  ['Mariana Souza', 'Angela', 'Total Cine Top HD', 80, 1],
];

const PROCV_OPERADORES = [
  'Fátima Osório',
  'Antônio Carlos',
  'Elenilda Hilda',
  'Tânia Santana',
  'Nancy Vanderley',
  'Jorge Ponteio',
  'Luis Mário',
  'Luzia Mendonça',
  'Eloísa Gouvêa',
  'Rafael Luiz',
  'Amanda Gilena',
  'Simone Maria',
  'Wesley Nunes',
];

const STATUS_VOLUME = [
  ['DISPONIBILIDADE / CSO', 26],
  ['ERRO DE CADASTRO', 119],
  ['FAX', 327],
  ['INSATISFACAO COM A TELEFONICA', 72],
  ['JA FOI CONTATADO', 214],
  ['LIGACOES NAO COMPLETADAS', 263],
  ['MENSAGEM DE OPERADORA (TELEFONIA)', 302],
  ['MUDANCA DE ENDERECO', 30],
  ['NAO ATENDE', 7586],
  ['NAO AUTORIZOU RET DO MULTILINK', 6],
  ['NAO CONCORDA C/ A PERMANENCIA MINIMA', 5],
  ['NAO OBTEVE TODAS AS INFORMACOES DE PROMOCAO', 1],
  ['NAO POSSUI COMPUTADOR', 1107],
  ['NAO POSSUI CONFIGURACAO MINIMA DO PC', 25],
  ['NAO TEM INTERNET', 558],
  ['NECESSIDADE E BENEFICIO EM BANDA LARGA', 45],
];

const CIDADES_CONTSE = [
  ['Campinas', 269],
  ['Guarulhos', 111],
  ['Limeira', 48],
  ['Jacarei', 33],
  ['Embu', 30],
  ['Catanduva', 28],
  ['Lins', 19],
  ['Itapolis', 17],
  ['Jandira', 15],
  ['Lorena', 8],
  ['Guaratingueta', 8],
  ['Juquia', 2],
];

const ZONAS = [
  ['OESTE', 506],
  ['CENTRO SUL', 365],
  ['SUDESTE', 361],
  ['NORDESTE', 293],
  ['SUL', 267],
  ['CENTRO', 258],
  ['LESTE2', 169],
  ['LESTE1', 115],
  ['NOROESTE', 76],
];

const VENDAS_OPERADORES = [
  'ADIEL PASSOS DOS SANTOS',
  'NOEMI SOARES DE SOUZA',
  'NORMA SUELI SANTOS',
  'NUBIA ROSA PEREIRA',
  'ALINE MACIEL BARROSO',
  'VANIA ELISABETE GOMES',
  'ROGERIO FIRMO DE ALMEIDA',
  'CÍNTIA FERREIRA DE OLIVEIRA SILVA',
  'TAIS HERMESDORFF RODRIGUES',
  'DAVID LEANDRO SILVA',
  'ELAINE CRISTINA RISSO NISHIMARU',
  'TATIANE APARECIDA DE PAULA',
  'PEDRO',
];

const GRAFICO_ANALITICO = [
  [
    '',
    'Junho',
    'Julho',
    'Agosto',
    'Setembro',
    'Outubro',
    'Novembro',
    'Dezembro',
    'Janeiro',
  ],
  ['Chamadas Realizadas', 2350, 2597, 2778, 3058, 2371, 3243, 4061, 1861],
  ['Chamadas Recebidas', 5614, 5528, 5582, 5025, 5162, 5078, 4691, 5103],
  ['Chamadas Atendidas', 4636, 4974, 4873, 4448, 4319, 4024, 3648, 4922],
  [
    'Nível Serviço',
    0.81,
    0.89,
    0.8583,
    0.8675,
    0.81,
    0.75,
    0.7401256661,
    0.9592374289,
  ],
  [
    '% Aban',
    0.1742073388,
    0.1002170767,
    0.1270154066,
    0.1148258706,
    0.163308795,
    0.2075620323,
    0.2223406523,
    0.0121497158,
  ],
];

const MACRO_RJ = [
  ['ESTADO', 'VALORES'],
  ['RJ', 10],
  ['SP', 20],
  ['SP', 30],
  ['SP', 54],
  ['SP', 87],
  ['RJ', 45],
  ['RJ', 2],
  ['RJ', 3],
  ['RJ', 5],
  ['RJ', 98],
  ['SP', 7],
  ['RJ', 5],
];

const ROLE_LEVEL_SUGGESTIONS = {
  'Jovem Aprendiz': '1',
  Operador: '2',
  Estagiário: '2',
  Supervisor: '3',
  'Help Desk': '3',
  Planejamento: '3',
  TI: '4',
  Analista: '4',
  Outros: '4',
};

const EXAM_MODELS = {
  1: [
    wordQ(
      'Etapa 1 - Word (Básico)',
      'Título e texto',
      'Escreva “COMUNICADO INTERNO” em negrito e centralizado, com uma frase abaixo.',
      {
        titleText: 'COMUNICADO INTERNO',
        titleBold: true,
        titleCenter: true,
        minTextLength: 20,
      },
    ),
    wordQ(
      'Etapa 1 - Word (Básico)',
      'Lista simples',
      'Escreva “ROTINA” e crie uma lista com 3 itens.',
      { titleText: 'ROTINA', requiresList: true, minListItems: 3 },
    ),
    wordQ(
      'Etapa 1 - Word (Básico)',
      'Parágrafo curto',
      'Escreva um texto com pelo menos 35 caracteres e destaque uma palavra em negrito.',
      { minTextLength: 35, anyBold: true },
    ),
    wordQ(
      'Etapa 1 - Word (Básico)',
      'Alinhamento central',
      'Escreva “BOAS PRÁTICAS” centralizado e adicione uma frase abaixo.',
      { titleText: 'BOAS PRÁTICAS', titleCenter: true, minTextLength: 25 },
    ),
    wordQ(
      'Etapa 1 - Word (Básico)',
      'Lista destacada',
      'Crie uma lista com 2 itens e deixe ao menos um item em negrito.',
      { requiresList: true, minListItems: 2, anyBold: true },
    ),

    excelExternalQ(
      'Etapa 2 - Excel (LibreOffice)',
      'Teste Prático de Excel',
      'Baixe a planilha e realize as tarefas práticas desta prova: linhas de grade, cópia da tabela para G9, preenchimento azul claro em D9, comentário em A11, filtro na tabela e cálculo do total com fórmula. Ao terminar, envie o arquivo uma única vez.',
      'basic_exam',
    ),

    mcqQ(
      'Etapa 3 - Conhecimentos Gerais (Básico)',
      'Postura profissional',
      'Ao atender um cliente irritado, qual a melhor postura inicial?',
      [
        'Interromper para corrigir',
        'Responder no mesmo tom',
        'Ouvir com calma e manter postura profissional',
        'Encerrar rapidamente',
      ],
      2,
    ),
    mcqQ(
      'Etapa 3 - Conhecimentos Gerais (Básico)',
      'Organização',
      'Qual atitude contribui mais para organização no trabalho?',
      [
        'Anotar tarefas e prioridades',
        'Fazer tudo sem ordem',
        'Ignorar prazos pequenos',
        'Deixar tudo para o final',
      ],
      0,
    ),
    mcqQ(
      'Etapa 3 - Conhecimentos Gerais (Básico)',
      'Pontualidade',
      'Chegar no horário demonstra principalmente:',
      [
        'Desatenção',
        'Compromisso',
        'Rigidez excessiva',
        'Falta de flexibilidade',
      ],
      1,
    ),
    mcqQ(
      'Etapa 3 - Conhecimentos Gerais (Básico)',
      'Comunicação',
      'Uma comunicação clara no trabalho ajuda a:',
      [
        'Aumentar ruídos',
        'Evitar alinhamentos',
        'Reduzir erros e retrabalho',
        'Diminuir produtividade',
      ],
      2,
    ),
    mcqQ(
      'Etapa 3 - Conhecimentos Gerais (Básico)',
      'Ética',
      'Qual situação reflete postura ética?',
      [
        'Compartilhar senhas',
        'Omitir erro crítico',
        'Respeitar regras e dados do cliente',
        'Usar sistemas sem autorização',
      ],
      2,
    ),
  ],

  2: [
    wordQ(
      'Etapa 1 - Word (Básico)',
      'Título e lista',
      'Escreva “ROTINA DIÁRIA” centralizado e em negrito. Depois crie uma lista com 3 itens.',
      {
        titleText: 'ROTINA DIÁRIA',
        titleBold: true,
        titleCenter: true,
        requiresList: true,
        minListItems: 3,
      },
    ),
    wordQ(
      'Etapa 1 - Word (Básico)',
      'Comunicado simples',
      'Escreva um comunicado curto com pelo menos 40 caracteres e destaque uma palavra em negrito.',
      { minTextLength: 40, anyBold: true },
    ),
    wordQ(
      'Etapa 1 - Word (Básico)',
      'Título alinhado',
      'Escreva “ATENÇÃO” centralizado e, abaixo, uma frase de orientação.',
      { titleText: 'ATENÇÃO', titleCenter: true, minTextLength: 20 },
    ),
    wordQ(
      'Etapa 1 - Word (Básico)',
      'Lista de tarefas',
      'Crie uma lista com 4 tarefas e aplique negrito em pelo menos uma delas.',
      { requiresList: true, minListItems: 4, anyBold: true },
    ),
    wordQ(
      'Etapa 1 - Word (Básico)',
      'Texto sobre atendimento',
      'Escreva um texto com 2 frases sobre bom atendimento.',
      { minTextLength: 45, minSentences: 2 },
    ),

    excelExternalQ(
      'Etapa 2 - Excel (LibreOffice)',
      'Teste Prático de Excel',
      'Baixe a planilha e realize as tarefas do teste prático: ordenar a Planilha A por Operador, criar a coluna Valor Total multiplicando Valor (R$) por Quantidade, usar PROCV para localizar supervisores, listar a partir de BC255 os operadores não encontrados, montar o resumo solicitado, copiar/colar e filtrar Wesley Nunes, além de criar um gráfico de colunas agrupadas com supervisores e mês de março. Ao terminar, envie o arquivo uma única vez.',
      'qualid_exam',
    ),

    mcqQ(
      'Etapa 3 - Conhecimentos Gerais (Básico)',
      'Organização de trabalho',
      'Qual atitude contribui mais para organização no ambiente de trabalho?',
      [
        'Anotar tarefas e prioridades',
        'Fazer tudo sem ordem',
        'Ignorar prazos pequenos',
        'Deixar tudo para o final',
      ],
      0,
    ),
    mcqQ(
      'Etapa 3 - Conhecimentos Gerais (Básico)',
      'Atendimento',
      'Em um atendimento difícil, o mais adequado é:',
      [
        'Responder de forma ríspida',
        'Manter calma e objetividade',
        'Discutir com o cliente',
        'Ignorar o problema',
      ],
      1,
    ),
    mcqQ(
      'Etapa 3 - Conhecimentos Gerais (Básico)',
      'Trabalho em equipe',
      'Trabalho em equipe costuma exigir:',
      [
        'Competição interna constante',
        'Falta de comunicação',
        'Colaboração e alinhamento',
        'Isolamento',
      ],
      2,
    ),
    mcqQ(
      'Etapa 3 - Conhecimentos Gerais (Básico)',
      'Aprendizado',
      'Receber feedback deve ser visto como:',
      [
        'Ameaça pessoal',
        'Oportunidade de melhoria',
        'Motivo para confronto',
        'Algo sem utilidade',
      ],
      1,
    ),
    mcqQ(
      'Etapa 3 - Conhecimentos Gerais (Básico)',
      'Responsabilidade',
      'Assumir responsabilidade por um erro demonstra:',
      [
        'Maturidade profissional',
        'Fraqueza',
        'Falta de preparo',
        'Desorganização',
      ],
      0,
    ),
  ],

  3: [
    wordQ(
      'Etapa 1 - Word (Básico)',
      'Aviso de equipe',
      'Crie o título “AVISO DE EQUIPE” em negrito e centralizado. Depois escreva um comunicado com 2 frases.',
      {
        titleText: 'AVISO DE EQUIPE',
        titleBold: true,
        titleCenter: true,
        minSentences: 2,
        minTextLength: 45,
      },
    ),
    wordQ(
      'Etapa 1 - Word (Básico)',
      'Lista operacional',
      'Crie um título e uma lista com 3 ações de acompanhamento.',
      { requiresList: true, minListItems: 3 },
    ),
    wordQ(
      'Etapa 1 - Word (Básico)',
      'Resumo curto',
      'Escreva um resumo com pelo menos 55 caracteres sobre controle de demandas.',
      { minTextLength: 55 },
    ),
    wordQ(
      'Etapa 1 - Word (Básico)',
      'Destaque de informação',
      'Escreva um texto curto e destaque pelo menos uma palavra em negrito.',
      { minTextLength: 35, anyBold: true },
    ),
    wordQ(
      'Etapa 1 - Word (Básico)',
      'Título centralizado',
      'Escreva “MONITORAMENTO” centralizado e abaixo uma frase explicativa.',
      { titleText: 'MONITORAMENTO', titleCenter: true, minTextLength: 25 },
    ),

    excelExternalQ(
      'Etapa 2 - Excel (LibreOffice)',
      'Teste Prático de Excel',
      'Baixe a planilha e realize o teste prático completo: usar CONT.SE por cidade e ordenar em ordem decrescente, aplicar PROCV para volumes por status, criar tabela por DDD e gráfico Pizza 3D, calcular média, percentual e situação por zona com regra lógica e executar a análise de vendas com PROCV, totais e percentuais. Ao terminar, envie o arquivo uma única vez.',
      'planning_exam',
    ),

    mcqQ(
      'Etapa 3 - Conhecimentos Gerais (Avançado)',
      'Tomada de decisão',
      'Um prazo foi reduzido e a equipe está sobrecarregada. Qual a melhor ação inicial?',
      [
        'Ignorar o problema',
        'Redistribuir tarefas e alinhar prioridades',
        'Cobrar sem contexto',
        'Esperar alguém reclamar',
      ],
      1,
    ),
    mcqQ(
      'Etapa 3 - Conhecimentos Gerais (Avançado)',
      'Priorização',
      'Qual critério é mais adequado para priorizar atividades?',
      [
        'Ordem aleatória',
        'Impacto e urgência',
        'Preferência pessoal',
        'Quantidade de texto',
      ],
      1,
    ),
    mcqQ(
      'Etapa 3 - Conhecimentos Gerais (Avançado)',
      'Liderança',
      'Uma boa liderança tende a:',
      [
        'Aumentar ruído',
        'Delegar com clareza',
        'Ocultar informações',
        'Evitar acompanhamento',
      ],
      1,
    ),
    mcqQ(
      'Etapa 3 - Conhecimentos Gerais (Avançado)',
      'Indicadores',
      'O uso de indicadores ajuda principalmente a:',
      [
        'Diminuir controle',
        'Tomar decisão com base em dados',
        'Evitar análise',
        'Substituir planejamento',
      ],
      1,
    ),
    mcqQ(
      'Etapa 3 - Conhecimentos Gerais (Avançado)',
      'Comunicação',
      'Ao comunicar mudança de processo, o ideal é:',
      [
        'Informar parcialmente',
        'Alinhar objetivo, impacto e prazo',
        'Mudar sem aviso',
        'Esperar erros aparecerem',
      ],
      1,
    ),

    mcqQ(
      'Etapa 4 - Conhecimentos Técnicos (Básicos)',
      'Suporte técnico',
      'Ao receber um chamado de sistema lento, qual é um passo inicial adequado?',
      [
        'Fechar o chamado sem análise',
        'Reiniciar tudo sem checar',
        'Coletar evidências e identificar o contexto do problema',
        'Culpar o usuário imediatamente',
      ],
      2,
    ),
    mcqQ(
      'Etapa 4 - Conhecimentos Técnicos (Básicos)',
      'Registro',
      'Registrar um incidente de forma adequada ajuda a:',
      [
        'Ocultar histórico',
        'Padronizar análise futura',
        'Diminuir rastreabilidade',
        'Evitar evidências',
      ],
      1,
    ),
    mcqQ(
      'Etapa 4 - Conhecimentos Técnicos (Básicos)',
      'Diagnóstico',
      'Antes de aplicar uma correção, o ideal é:',
      [
        'Aplicar qualquer solução',
        'Identificar a causa provável',
        'Escalar sem contexto',
        'Ignorar logs',
      ],
      1,
    ),
    mcqQ(
      'Etapa 4 - Conhecimentos Técnicos (Básicos)',
      'Boas práticas',
      'Qual é uma boa prática em suporte?',
      [
        'Compartilhar senha por chat',
        'Validar impacto antes da mudança',
        'Alterar produção sem registro',
        'Testar direto no ambiente crítico',
      ],
      1,
    ),
    mcqQ(
      'Etapa 4 - Conhecimentos Técnicos (Básicos)',
      'Atendimento técnico',
      'Quando faltar informação em um chamado, o melhor é:',
      [
        'Inventar contexto',
        'Solicitar detalhes objetivos ao solicitante',
        'Encerrar imediatamente',
        'Alterar a descrição sem avisar',
      ],
      1,
    ),
  ],

  4: [
    wordQ(
      'Etapa 1 - Word (Avançado)',
      'Relatório técnico',
      'Escreva o título “RELATÓRIO TÉCNICO” em negrito e centralizado. Depois, escreva um texto com pelo menos 60 caracteres e inclua uma lista com 2 itens.',
      {
        titleText: 'RELATÓRIO TÉCNICO',
        titleBold: true,
        titleCenter: true,
        minTextLength: 60,
        requiresList: true,
        minListItems: 2,
      },
    ),
    wordQ(
      'Etapa 1 - Word (Avançado)',
      'Comunicado analítico',
      'Escreva um comunicado com 2 frases e destaque pelo menos uma palavra em negrito.',
      { minSentences: 2, minTextLength: 55, anyBold: true },
    ),
    wordQ(
      'Etapa 1 - Word (Avançado)',
      'Checklist técnico',
      'Crie uma lista com 4 itens de validação técnica.',
      { requiresList: true, minListItems: 4 },
    ),
    wordQ(
      'Etapa 1 - Word (Avançado)',
      'Título formal',
      'Escreva “PLANO DE AÇÃO” centralizado e adicione uma explicação abaixo.',
      { titleText: 'PLANO DE AÇÃO', titleCenter: true, minTextLength: 30 },
    ),
    wordQ(
      'Etapa 1 - Word (Avançado)',
      'Resumo executivo',
      'Escreva um resumo com pelo menos 70 caracteres sobre melhoria contínua.',
      { minTextLength: 70 },
    ),

    excelExternalQ(
      'Etapa 2 - Excel (LibreOffice)',
      'Teste Prático de Excel',
      'Baixe a planilha e realize o teste prático avançado: usar CONT.SE com ordenação por cidade, aplicar PROCV para status, criar gráfico analítico combinado com eixo secundário, calcular a soma do RJ na célula F10 e executar a análise completa de vendas com PROCV, totais e percentuais. Ao terminar, envie o arquivo uma única vez.',
      'advanced_exam',
    ),

    mcqQ(
      'Etapa 3 - Conhecimentos Gerais (Avançado)',
      'Priorização',
      'Qual critério é mais adequado para priorizar demandas críticas?',
      [
        'Ordem aleatória',
        'Impacto no negócio e urgência',
        'Preferência pessoal',
        'Quantidade de texto na solicitação',
      ],
      1,
    ),
    mcqQ(
      'Etapa 3 - Conhecimentos Gerais (Avançado)',
      'Comunicação executiva',
      'Em uma comunicação executiva, o ideal é:',
      [
        'Ser vago',
        'Trazer contexto, risco e ação proposta',
        'Esconder impacto',
        'Evitar objetividade',
      ],
      1,
    ),
    mcqQ(
      'Etapa 3 - Conhecimentos Gerais (Avançado)',
      'Gestão',
      'Uma boa gestão de processo costuma exigir:',
      [
        'Ausência de métricas',
        'Monitoramento contínuo',
        'Mudanças sem registro',
        'Falta de padrão',
      ],
      1,
    ),
    mcqQ(
      'Etapa 3 - Conhecimentos Gerais (Avançado)',
      'Planejamento',
      'Planejar adequadamente ajuda a:',
      [
        'Aumentar retrabalho',
        'Reduzir previsibilidade',
        'Melhorar controle e execução',
        'Eliminar alinhamentos',
      ],
      2,
    ),
    mcqQ(
      'Etapa 3 - Conhecimentos Gerais (Avançado)',
      'Melhoria contínua',
      'Melhoria contínua depende de:',
      [
        'Dados, análise e ajustes',
        'Aleatoriedade',
        'Ações isoladas',
        'Decisões sem acompanhamento',
      ],
      0,
    ),

    mcqQ(
      'Etapa 4 - Conhecimentos Técnicos Específicos',
      'Análise técnica',
      'Em um incidente recorrente, qual abordagem costuma ser mais adequada?',
      [
        'Tratar só o efeito',
        'Ignorar histórico',
        'Investigar causa raiz e recorrência',
        'Aguardar novo incidente',
      ],
      2,
    ),
    mcqQ(
      'Etapa 4 - Conhecimentos Técnicos Específicos',
      'Mudança controlada',
      'Antes de uma mudança técnica, o ideal é:',
      [
        'Aplicar sem validação',
        'Avaliar risco e plano de retorno',
        'Executar sem comunicação',
        'Alterar em produção direto',
      ],
      1,
    ),
    mcqQ(
      'Etapa 4 - Conhecimentos Técnicos Específicos',
      'Observabilidade',
      'Logs e métricas servem principalmente para:',
      [
        'Enfeite visual',
        'Diagnóstico e acompanhamento',
        'Substituir testes',
        'Eliminar documentação',
      ],
      1,
    ),
    mcqQ(
      'Etapa 4 - Conhecimentos Técnicos Específicos',
      'Rastreabilidade',
      'Registrar evidências ajuda a:',
      [
        'Perder histórico',
        'Aumentar rastreabilidade',
        'Ocultar falhas',
        'Reduzir auditoria',
      ],
      1,
    ),
    mcqQ(
      'Etapa 4 - Conhecimentos Técnicos Específicos',
      'Prevenção',
      'Qual ação ajuda a prevenir recorrência?',
      [
        'Ignorar tendência',
        'Apenas reiniciar serviços',
        'Criar ação corretiva estruturada',
        'Fechar incidente sem análise',
      ],
      2,
    ),
  ],
};
