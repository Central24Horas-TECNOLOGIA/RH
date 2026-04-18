function wordQ(
  stageKey,
  stageLabel,
  title,
  description,
  expected,
  points = 10,
) {
  return {
    stageKey,
    stage: stageLabel,
    type: 'word',
    title,
    description,
    expected,
    points,
  };
}

function mcqQ(
  stageKey,
  stageLabel,
  title,
  description,
  options,
  answer,
  points = 10,
) {
  return {
    stageKey,
    stage: stageLabel,
    type: 'multiple',
    title,
    description,
    options,
    answer,
    points,
  };
}

function excelExternalQ(
  stageKey,
  stageLabel,
  title,
  description,
  taskId,
  points = 50,
) {
  return {
    stageKey,
    stage: stageLabel,
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
  'Control Desk': '3',
  Planejamento: '3',
  TI: '4',
  Analista: '4',
  Outros: '4',
};

const STAGE_LABELS = {
  word_basic: 'Word',
  word_advanced: 'Word',
  excel_basic: 'Excel',
  excel_mid: 'Excel',
  excel_advanced: 'Excel',
  general_basic: 'Conhecimentos Gerais',
  general_adv_people: 'Conhecimentos Gerais: Boas Práticas e Gestão de Pessoas',
  general_advanced: 'Conhecimentos Gerais',
  tech_ti_basic: 'Conhecimentos Técnicos: TI',
  tech_rh_basic: 'Conhecimentos Técnicos: RH',
  tech_adm_basic: 'Conhecimentos Técnicos: Avançado',
  tech_ti_specific: 'Conhecimentos Técnicos Específicos - TI',
  tech_adm_specific: 'Conhecimentos Técnicos Específicos - Administração',
  writing_logic: 'Avaliação de Escrita e Lógica',
  analysis_eval: 'Avaliação de Análise',
  tech_logic: 'Avaliação Técnica e Lógica',
};
function wordBasicPool() {
  return [
    wordQ(
      'word_basic',
      STAGE_LABELS.word_basic,
      'Formatação de comunicado interno',
      'Durante a troca de turno das 14h, o supervisor percebeu que alguns operadores estavam retornando com atraso das pausas, o que acabou impactando a organização da equipe e o fluxo de atendimento. Para reforçar essa orientação de forma clara e objetiva, foi solicitado um comunicado interno simples para toda a operação. Escreva o título "COMUNICADO INTERNO" em negrito e centralizado. Em seguida, redija um pequeno texto orientando que os operadores devem retornar das pausas no horário correto, a fim de evitar impactos no atendimento e na rotina da operação.',
      {
        titleText: 'COMUNICADO INTERNO',
        titleBold: true,
        titleCenter: true,
        minTextLength: 45,
      },
    ),
    wordQ(
      'word_basic',
      STAGE_LABELS.word_basic,
      'E-mail corporativo simples',
      'Durante o período de atendimento da manhã, por volta das 10h20, foi identificada uma instabilidade no sistema utilizado pela operação, o que causou impacto momentâneo no fluxo de atendimento por aproximadamente 10 minutos. Após a atuação da equipe responsável, o acesso foi restabelecido e a operação voltou ao funcionamento normal. Considerando esse cenário, redija um e-mail curto e profissional para o supervisor, explicando o ocorrido de forma clara e informando que o sistema já foi normalizado.',
      { minTextLength: 55, minSentences: 2 },
    ),
    wordQ(
      'word_basic',
      STAGE_LABELS.word_basic,
      'Texto com lista de procedimentos',
      'Antes de iniciar os atendimentos, a equipe precisa seguir uma rotina básica de preparação para começar o trabalho de forma organizada. Pense em ações simples, como verificar as informações necessárias, abrir as ferramentas utilizadas e conferir se tudo está pronto para o início da operação. Com base nesse contexto, escreva o título "ROTINA DE ABERTURA" e crie uma lista com pelo menos 3 itens mostrando o que deve ser feito antes de começar o atendimento.',
      { titleText: 'ROTINA DE ABERTURA', requiresList: true, minListItems: 3 },
    ),
  ];
}

function wordBasicLevel3Pool() {
  return [
    wordQ(
      'word_basic',
      STAGE_LABELS.word_basic,
      'Redação de comunicado interno',
      'A equipe do turno da manhã precisará seguir, de forma temporária, uma pequena alteração no script de atendimento utilizado pela operação. Para que todos recebam a informação de maneira rápida e clara, será necessário elaborar um aviso interno com orientação objetiva. Com base nesse cenário, escreva o título "AVISO DE EQUIPE" em negrito e centralizado. Em seguida, redija um comunicado com pelo menos 2 frases, utilizando linguagem clara, direta e de fácil entendimento.',
      {
        titleText: 'AVISO DE EQUIPE',
        titleBold: true,
        titleCenter: true,
        minSentences: 2,
        minTextLength: 55,
      },
    ),
    wordQ(
      'word_basic',
      STAGE_LABELS.word_basic,
      'Estruturação de procedimento com lista',
      'Um novo operador iniciou suas atividades hoje e precisa receber orientações simples para registrar um chamado interno corretamente. Para isso, é importante organizar um passo a passo básico com ações que ajudem no acompanhamento desse processo. Com base nesse cenário, crie um título apropriado e escreva uma lista com 3 ações de acompanhamento relacionadas ao registro de um chamado interno.',
      { requiresList: true, minListItems: 3, minTextLength: 25 },
    ),
    wordQ(
      'word_basic',
      STAGE_LABELS.word_basic,
      'Revisão e formatação de texto',
      'Durante a rotina operacional, o controle de demandas é importante para manter as atividades organizadas, acompanhar pendências e evitar esquecimentos. Quando as informações são registradas de forma clara, fica mais fácil acompanhar prioridades e prazos. Considerando esse contexto, escreva um resumo curto sobre controle de demandas e destaque pelo menos uma palavra em negrito.',
      { minTextLength: 55, anyBold: true },
    ),
  ];
}

function wordAdvancedPool() {
  return [
    wordQ(
      'word_advanced',
      STAGE_LABELS.word_advanced,
      'Redação de relatório técnico',
      'Após uma falha de integração entre sistemas, a gerência solicitou um relatório técnico resumido para entender o que aconteceu e quais foram os impactos gerados na operação. Nesse tipo de documento, é importante apresentar o ocorrido de forma clara, mencionando o incidente e os reflexos observados, como lentidão, interrupções ou dificuldades no andamento das atividades. Considerando esse contexto, escreva o título "RELATORIO TECNICO" em negrito e centralizado. Em seguida, descreva o incidente e os impactos operacionais em pelo menos 2 frases.',
      {
        titleText: 'RELATORIO TECNICO',
        titleBold: true,
        titleCenter: true,
        minSentences: 2,
        minTextLength: 70,
      },
    ),
    wordQ(
      'word_advanced',
      STAGE_LABELS.word_advanced,
      'Estruturação de documento técnico',
      'A área de TI precisa manter registrado um procedimento de contingência para situações em que a API principal apresente indisponibilidade. Para garantir continuidade operacional e uma resposta adequada ao problema, é importante considerar ações como validar a falha, comunicar os responsáveis, utilizar alternativas temporárias e acompanhar a normalização do serviço. Com base nesse cenário, crie uma lista com pelo menos 3 itens descrevendo as ações que devem ser executadas quando a API principal ficar indisponível.',
      { requiresList: true, minListItems: 3, minTextLength: 35 },
    ),
    wordQ(
      'word_advanced',
      STAGE_LABELS.word_advanced,
      'Organização de procedimentos',
      'Quando um problema é identificado em produção, torna-se necessário acompanhar a correção de forma organizada, registrando as ações executadas, o andamento da análise e a evolução da solução aplicada. Esse acompanhamento ajuda a dar mais clareza ao processo e facilita a comunicação entre as áreas envolvidas. Com base nesse cenário, escreva "PLANO DE ACAO" centralizado e, abaixo, redija um texto objetivo sobre como acompanhar a correção de um problema em produção.',
      { titleText: 'PLANO DE ACAO', titleCenter: true, minTextLength: 55 },
    ),
  ];
}

function generalBasicPool() {
  return [
    mcqQ(
      'general_basic',
      STAGE_LABELS.general_basic,
      'Interpretação de situação de trabalho',
      'Durante um período de pico de chamadas, a operação apresenta maior volume de atendimentos do que o habitual, o que pode gerar aumento no tempo de espera e maior insatisfação por parte dos clientes. Em uma dessas situações, um cliente inicia o contato irritado, reclamando da demora para ser atendido. Considerando a necessidade de manter a qualidade no atendimento mesmo em momentos de pressão, qual deve ser a sua postura inicial diante desse cenário?',
      [
        ' Transferir a ligação sem apresentar explicações',
        ' Ouvir o cliente com calma e manter uma postura profissional',
        ' Responder no mesmo tom utilizado pelo cliente',
        ' Encerrar o atendimento rapidamente para reduzir a fila',
      ],
      1,
    ),
    mcqQ(
      'general_basic',
      STAGE_LABELS.general_basic,
      'Lógica básica',
      `Durante o acompanhamento da operação no período da manhã, foi solicitado o levantamento do volume de atendimentos recebidos por uma fila em horários diferentes. Os dados apurados foram os seguintes:

9h: 18 atendimentos
10h: 22 atendimentos
11h: 20 atendimentos

Considerando as informações apresentadas, quantos atendimentos foram realizados no total nesse período? Caso necessário, você pode utilizar a calculadora do Windows para apoiar o cálculo.`,
      [' 58', ' 60', ' 62', ' 64'],
      1,
    ),
    mcqQ(
      'general_basic',
      STAGE_LABELS.general_basic,
      'Comunicação no trabalho',
      'Durante o repasse de turno, é essencial que as informações sobre a operação sejam transmitidas de forma organizada, para que a próxima equipe consiga dar continuidade às atividades sem falhas ou duplicidade de ações. Quando os registros não são feitos com clareza, aumentam as chances de erros, perda de informações importantes e retrabalho. Considerando esse contexto, qual prática contribui diretamente para evitar retrabalho durante um repasse de turno?',
      [
        ' Passar informações incompletas para agilizar o repasse',
        ' Registrar as pendências de forma clara e organizada',
        ' Confiar apenas na memória para repassar as atividades',
        ' Informar somente o que for urgente e deixar o restante para depois',
      ],
      1,
    ),
    mcqQ(
      'general_basic',
      STAGE_LABELS.general_basic,
      'Organização de tarefas',
      'Durante a rotina operacional, é comum que diferentes demandas cheguem ao mesmo tempo, exigindo organização e capacidade de priorização. Em muitos casos, algumas atividades podem aguardar um pouco mais, enquanto outras precisam de atenção imediata por impactarem diretamente o andamento do atendimento ou da operação. Imagine que você recebeu três tarefas: corrigir um cadastro bloqueado, responder um e-mail sem urgência e atualizar um relatório semanal. Considerando a necessidade de definir prioridades de forma adequada, o que deve ser tratado primeiro?',
      [
        ' Atualizar o relatório semanal, por ser uma atividade de rotina',
        ' Responder o e-mail sem urgência, para reduzir pendências na caixa de entrada',
        ' Corrigir o cadastro bloqueado, por ter impacto mais imediato na operação',
        ' Tratar qualquer uma das tarefas, sem necessidade de ordem de prioridade',
      ],
      2,
    ),
    mcqQ(
      'general_basic',
      STAGE_LABELS.general_basic,
      'Trabalho em equipe',
      'Durante a rotina de atendimento, especialmente nos primeiros dias de integração, é comum que novos colaboradores tenham dúvidas sobre procedimentos, sistemas e fluxos internos da operação. Nessas situações, a forma como a equipe responde ao pedido de ajuda faz diferença tanto no aprendizado do colega quanto no clima de colaboração no ambiente de trabalho. Imagine que, durante o atendimento, um colega novo pediu ajuda para localizar um procedimento no sistema. Considerando uma postura colaborativa e profissional, qual atitude demonstra melhor trabalho em equipe?',
      [
        ' Ignorar o pedido para não interromper a própria rotina',
        ' Dizer para ele descobrir sozinho, para aprender mais rápido',
        ' Orientar de forma rápida e indicar onde localizar o procedimento no sistema',
        ' Mandar que ele procure o RH para resolver a dúvida',
      ],
      2,
    ),
  ];
}

function generalAdvPeoplePool() {
  return [
    mcqQ(
      'general_adv_people',
      STAGE_LABELS.general_adv_people,
      'Tomada de decisão',
      'Durante a rotina da operação, podem surgir situações inesperadas que exigem ação rápida da supervisão para reduzir impactos no atendimento. Um aumento repentino no volume de chamadas, somado à ausência de operadores, pode comprometer o nível de serviço, aumentar o tempo de espera e gerar sobrecarga na equipe disponível. Nesse tipo de cenário, é importante que o supervisor avalie rapidamente a situação e adote medidas imediatas para manter a operação o mais estável possível. Considerando esse contexto, qual é a ação inicial mais adequada para um supervisor?',
      [
        ' Esperar até o fim do dia para avaliar o impacto na operação',
        ' Redistribuir a equipe disponível e priorizar as filas mais críticas',
        ' Cobrar a equipe pelo aumento da demanda sem reorganizar os recursos',
        ' Interromper os acompanhamentos da operação até a situação normalizar',
      ],
      1,
    ),
    mcqQ(
      'general_adv_people',
      STAGE_LABELS.general_adv_people,
      'Gestão de equipe',
      'Durante o acompanhamento da equipe, o supervisor pode identificar situações em que um operador demonstra boa postura profissional, mantém um relacionamento adequado no ambiente de trabalho e apresenta comprometimento com a rotina, mas ainda assim comete erros recorrentes em determinadas atividades, como o preenchimento de cadastros. Nesses casos, é importante adotar uma abordagem que contribua para o desenvolvimento do colaborador, corrija o problema de forma construtiva e preserve um ambiente profissional respeitoso. Considerando esse contexto, qual abordagem tende a gerar melhor resultado?',
      [
        ' Expor o erro diante da equipe para reforçar a cobrança',
        ' Aplicar um feedback individual com orientação objetiva sobre os ajustes necessários',
        ' Ignorar o problema, já que o operador apresenta boa postura',
        ' Retirar o operador da atividade sem apresentar explicações',
      ],
      1,
    ),
    mcqQ(
      'general_adv_people',
      STAGE_LABELS.general_adv_people,
      'Resolução de problemas',
      'Uma fila de e-mails vem acumulando atraso há três dias consecutivos, o que pode indicar não apenas aumento de demanda, mas também possíveis dificuldades relacionadas à capacidade da equipe, à priorização das tratativas ou ao cumprimento do SLA. Em situações como essa, é importante que a liderança avalie o cenário com cuidado antes de tomar qualquer medida, para evitar decisões precipitadas e atuar de forma mais assertiva sobre a causa do problema. Considerando esse contexto, antes de cobrar a equipe, qual é a atitude mais adequada?',
      [
        ' Analisar a causa do atraso, o volume da fila, o SLA e a capacidade operacional da equipe',
        ' Substituir toda a equipe responsável pela fila para tentar normalizar o cenário',
        ' Fechar temporariamente a fila sem comunicação prévia',
        ' Informar apenas que a equipe precisa acelerar o ritmo de trabalho',
      ],
      0,
    ),
    mcqQ(
      'general_adv_people',
      STAGE_LABELS.general_adv_people,
      'Análise de cenário',
      'Ao acompanhar a produtividade de uma operação, não basta apenas observar se as atividades estão sendo concluídas, mas também analisar indicadores que ajudem a entender a eficiência com que o trabalho está sendo realizado. Métricas operacionais permitem avaliar ritmo, capacidade de entrega e desempenho da equipe de forma mais objetiva, contribuindo para decisões mais assertivas na gestão. Considerando esse contexto, qual indicador costuma ajudar a entender a eficiência operacional?',
      [
        ' Tempo médio de atendimento e volume tratado',
        ' Cor utilizada na planilha de acompanhamento',
        ' Duração do horário de almoço da equipe',
        ' Quantidade de e-mails pessoais recebidos no dia',
      ],
      0,
    ),
    mcqQ(
      'general_adv_people',
      STAGE_LABELS.general_adv_people,
      'Comunicação organizacional',
      'Sempre que uma mudança de processo precisa ser aplicada na operação, a forma como essa informação é comunicada para a equipe faz diferença no entendimento, na adesão e na execução correta da nova orientação. Quando a comunicação é feita sem contexto ou sem clareza, aumentam as chances de dúvidas, falhas na aplicação e retrabalho. Por isso, é importante que a equipe receba a informação de maneira objetiva, mas também com os elementos necessários para compreender o que vai mudar e a partir de quando. Considerando esse contexto, ao comunicar uma mudança de processo para a equipe, qual é a conduta mais adequada?',
      [
        ' Enviar um aviso sem contexto, apenas informando que houve alteração',
        ' Explicar o motivo da mudança, o impacto na rotina e a data de início',
        ' Alterar o processo sem comunicar a equipe previamente',
        ' Esperar que as dúvidas apareçam para só então explicar a mudança',
      ],
      1,
    ),
  ];
}

function generalAdvancedPool() {
  return [
    mcqQ(
      'general_advanced',
      STAGE_LABELS.general_advanced,
      'Tomada de decisão estratégica',
      'Ao analisar os indicadores da operação, foi identificado que o TMA apresentou melhora, indicando maior agilidade nos atendimentos. No entanto, ao mesmo tempo, a taxa de recontato aumentou, o que pode sinalizar que parte das demandas não está sendo resolvida de forma efetiva no primeiro contato. Considerando esse cenário, qual leitura faz mais sentido?',
      [
        ' A operação melhorou de forma completa, sem qualquer ponto de atenção',
        ' Pode ter ocorrido ganho de velocidade, mas com possível queda na qualidade ou na efetividade do atendimento',
        ' O aumento do recontato não é relevante para a análise da operação',
        ' A melhor solução é reduzir ainda mais o tempo médio de atendimento',
      ],
      1,
    ),
    mcqQ(
      'general_advanced',
      STAGE_LABELS.general_advanced,
      'Análise de cenário organizacional',
      'Uma nova operação será implantada em 15 dias, exigindo planejamento e organização para que o início aconteça de forma estruturada e com o menor risco possível. Antes de avançar para etapas mais visuais ou administrativas, é fundamental validar os pontos que impactam diretamente a viabilidade da operação. Considerando esse contexto, o que deve ser validado primeiro?',
      [
        ' Volume previsto, jornada da equipe, capacidade operacional e riscos envolvidos',
        ' Apenas o nome do cliente que será atendido',
        ' Somente o layout físico da sala onde a operação ficará',
        ' Somente a definição do uniforme da equipe',
      ],
      0,
    ),
    mcqQ(
      'general_advanced',
      STAGE_LABELS.general_advanced,
      'Gestão de projetos',
      'Durante um projeto de implantação, o acompanhamento das etapas depende de marcos bem definidos, pois eles ajudam a organizar o andamento do trabalho e permitem maior controle sobre o que precisa ser entregue. Para que o projeto avance com clareza e responsabilidade, é importante estabelecer referências objetivas ao longo da execução. Nesse contexto, um marco importante é:',
      [
        ' Não trabalhar com cronograma para manter flexibilidade total',
        ' Definir entregas, responsáveis e prazos de cada etapa',
        ' Evitar registrar decisões para não engessar o projeto',
        ' Alterar o escopo diariamente conforme surgirem novas ideias',
      ],
      1,
    ),
    mcqQ(
      'general_advanced',
      STAGE_LABELS.general_advanced,
      'Pensamento crítico',
      'Ao receber um relatório com informações inconsistentes, como divergência de números, ausência de coerência entre indicadores ou dados fora do padrão esperado, é necessário adotar uma postura analítica antes de utilizar esse material em apresentações ou tomadas de decisão. Considerando esse cenário, qual é a melhor conduta?',
      [
        ' Aceitar o relatório sem realizar validações adicionais',
        ' Cruzar os dados e investigar as divergências antes de seguir com a análise',
        ' Apresentar o conteúdo mesmo com inconsistências, para não atrasar a entrega',
        ' Descartar imediatamente o relatório sem tentar entender a origem do problema',
      ],
      1,
    ),
    mcqQ(
      'general_advanced',
      STAGE_LABELS.general_advanced,
      'Comunicação estratégica',
      'Quando ocorre um incidente crítico na operação, a comunicação com a diretoria deve ser objetiva, mas também suficientemente completa para permitir uma compreensão rápida da situação e apoiar a tomada de decisão. Nesse tipo de reporte, é importante ir além da simples descrição do problema e apresentar os elementos essenciais do cenário. Considerando esse contexto, a comunicação deve conter:',
      [
        ' Somente a informação de que houve um problema na operação',
        ' Contexto do incidente, impacto gerado, plano de ação e próximos passos',
        ' Apenas opiniões gerais, sem necessidade de dados ou direcionamento',
        ' Detalhes secundários e informações sem relação direta com o incidente',
      ],
      1,
    ),
  ];
}

function techTiBasicPool() {
  return [
    mcqQ(
      'tech_ti_basic',
      STAGE_LABELS.tech_ti_basic,
      'Noções básicas de sistemas',
      'Um operador informa que, após realizar o login normalmente, a tela do CRM não carrega e o sistema não apresenta a funcionalidade esperada. Antes de adotar medidas mais amplas ou encerrar a análise, é importante fazer uma verificação inicial que ajude a entender se o problema está no acesso ao sistema ou em outro fator técnico. Considerando esse cenário, qual verificação inicial faz mais sentido?',
      [
        ' Verificar se o sistema está acessível e se existe alguma mensagem de erro apresentada na tela',
        ' Trocar o mouse utilizado pelo operador',
        ' Reiniciar o computador de todos os usuários da operação',
        ' Fechar o chamado sem realizar testes iniciais',
      ],
      0,
    ),
    mcqQ(
      'tech_ti_basic',
      STAGE_LABELS.tech_ti_basic,
      'Atendimento técnico básico',
      'Durante o suporte inicial, registrar informações como horário da ocorrência, erro apresentado e impacto percebido pelo usuário é uma prática importante para a condução do atendimento. Esse tipo de registro ajuda a organizar a análise e contribui para um acompanhamento mais preciso do caso. Considerando esse contexto, por que essa prática é importante?',
      [
        ' Porque evita que o atendimento tenha rastreabilidade',
        ' Porque facilita o diagnóstico do problema e mantém o histórico da ocorrência',
        ' Porque substitui completamente a necessidade de testes técnicos',
        ' Porque elimina a participação do usuário na tratativa',
      ],
      1,
    ),
    mcqQ(
      'tech_ti_basic',
      STAGE_LABELS.tech_ti_basic,
      'Conceitos de rede',
      'Em uma situação de suporte, um computador consegue navegar normalmente na internet, mas não acessa um sistema interno utilizado pela operação. Esse cenário indica que a conectividade geral não está totalmente comprometida, mas ainda pode existir uma falha em algum ponto específico do ambiente. Considerando essa situação, qual hipótese inicial faz mais sentido?',
      [
        ' Pode haver um problema específico na rede interna ou no serviço do sistema acessado',
        ' Houve falta de energia em todo o bairro',
        ' O teclado do computador está desconectado',
        ' O monitor da estação está desligado',
      ],
      0,
    ),
    mcqQ(
      'tech_ti_basic',
      STAGE_LABELS.tech_ti_basic,
      'Segurança da informação básica',
      'No ambiente corporativo, seguir boas práticas de segurança da informação é essencial para proteger acessos, dados e responsabilidades individuais dentro dos sistemas utilizados pela operação. Entre essas práticas, o uso correto de credenciais é uma das mais importantes. Considerando esse contexto, qual conduta está correta?',
      [
        ' Compartilhar a senha com outro colaborador para agilizar o trabalho',
        ' Utilizar credenciais individuais e não repassá-las a outras pessoas',
        ' Anotar a senha em papel e deixá-la visível no posto de trabalho',
        ' Utilizar a conta de um colega para acessar o sistema',
      ],
      1,
    ),
    mcqQ(
      'tech_ti_basic',
      STAGE_LABELS.tech_ti_basic,
      'Lógica de troubleshooting',
      'Quando uma falha ocorre de forma recorrente, a investigação precisa seguir uma sequência lógica para aumentar as chances de encontrar a causa correta e evitar alterações indevidas no ambiente. Uma abordagem organizada permite analisar o problema com mais segurança e registrar o que foi identificado ao longo da tratativa. Nesse contexto, qual sequência é mais adequada?',
      [
        ' Supor a causa do problema e alterar o ambiente de produção imediatamente',
        ' Coletar evidências, testar hipóteses e registrar os resultados obtidos',
        ' Ignorar o histórico das ocorrências anteriores',
        ' Aguardar para ver se o problema desaparece sozinho',
      ],
      1,
    ),
  ];
}

function techRhBasicPool() {
  return [
    mcqQ(
      'tech_rh_basic',
      STAGE_LABELS.tech_rh_basic,
      'Triagem de candidatos',
      'Durante um processo seletivo para a vaga de operador, o RH recebeu um volume elevado de currículos e precisa acompanhar cada candidato de forma organizada ao longo das etapas. Para evitar perda de informações, atrasos no acompanhamento e confusão sobre o status de cada pessoa, é importante utilizar um recurso que permita visualizar o andamento do processo com clareza. Considerando esse contexto, qual recurso ajuda a acompanhar o processo com mais organização?',
      [
        ' Uma planilha contendo nome do candidato, etapa do processo e status atualizado',
        ' Anotações soltas feitas ao longo do dia, sem padrão definido',
        ' Mensagens trocadas de forma dispersa, sem controle centralizado',
        ' A memória do recrutador para lembrar em que etapa cada candidato está',
      ],
      0,
    ),
    mcqQ(
      'tech_rh_basic',
      STAGE_LABELS.tech_rh_basic,
      'Comunicação com candidato',
      'Durante o andamento de um processo seletivo, é comum que candidatos entrem em contato para saber em que etapa estão ou se houve alguma atualização sobre a vaga. Nesses casos, a forma como o RH responde contribui para a imagem da empresa e para a experiência do candidato ao longo do processo. Considerando esse cenário, qual é a melhor resposta?',
      [
        ' Ignorar o contato até que o processo seletivo seja encerrado',
        ' Responder com clareza e educação, informando a etapa atual do processo seletivo',
        ' Criticar o candidato por insistir em pedir retorno',
        ' Divulgar informações ou notas de outros candidatos para justificar a resposta',
      ],
      1,
    ),
    mcqQ(
      'tech_rh_basic',
      STAGE_LABELS.tech_rh_basic,
      'Organização de entrevistas',
      'Ao organizar entrevistas para um processo seletivo, é essencial manter uma agenda bem estruturada para evitar sobreposição de horários, desencontros e dificuldades na condução das etapas. Um bom planejamento permite que recrutadores e gestores acompanhem os horários com mais precisão e reduz falhas na comunicação com os candidatos. Nesse contexto, o que ajuda a evitar conflito de horários?',
      [
        ' Agendar todos os candidatos no mesmo horário para ganhar tempo',
        ' Definir previamente os horários e os responsáveis por cada entrevista',
        ' Permitir que cada candidato escolha qualquer horário sem controle centralizado',
        ' Não confirmar a presença dos candidatos antes da entrevista',
      ],
      1,
    ),
    mcqQ(
      'tech_rh_basic',
      STAGE_LABELS.tech_rh_basic,
      'Confidencialidade de dados',
      'Durante o processo seletivo, o RH lida com informações pessoais e profissionais dos candidatos, como dados de contato, histórico profissional e avaliações realizadas ao longo das etapas. Por esse motivo, é fundamental tratar esse conteúdo com responsabilidade e limitar o acesso apenas a quem realmente participa do processo. Considerando esse contexto, os dados dos candidatos devem ser tratados como:',
      [
        ' Informação pública, disponível para qualquer pessoa da empresa',
        ' Informação de uso restrito ao processo seletivo',
        ' Conteúdo apropriado para compartilhamento em grupos internos sem critério',
        ' Material que pode ser enviado a qualquer gestor, mesmo sem participação no processo',
      ],
      1,
    ),
    mcqQ(
      'tech_rh_basic',
      STAGE_LABELS.tech_rh_basic,
      'Feedback ao candidato',
      'Nem todos os candidatos avançam até a etapa final de um processo seletivo, mas mesmo nesses casos é importante manter uma comunicação profissional e respeitosa. O retorno adequado demonstra organização, cuidado com a experiência do candidato e alinhamento com uma postura ética da empresa. Considerando esse cenário, quando um candidato não é aprovado, o mais adequado é:',
      [
        ' Não responder ao candidato após a conclusão da avaliação',
        ' Informar o resultado de forma respeitosa, clara e objetiva',
        ' Ironizar o desempenho apresentado durante o processo',
        ' Bloquear o contato do candidato para evitar novas mensagens',
      ],
      1,
    ),
  ];
}

function techAdmBasicPool() {
  return [
    mcqQ(
      'tech_adm_basic',
      STAGE_LABELS.tech_adm_basic,
      'Controle operacional',
      'No planejamento de uma operação, definir corretamente o tamanho da equipe é uma etapa essencial para garantir equilíbrio entre demanda e capacidade de atendimento. Para isso, é necessário considerar informações que permitam estimar quantas pessoas serão necessárias ao longo da rotina, evitando tanto sobrecarga quanto ociosidade. Considerando esse contexto, qual informação é indispensável para dimensionar a equipe?',
      [
        ' Volume esperado de demanda e jornada de trabalho da equipe',
        ' Nome do supervisor responsável pela operação',
        ' Cor do sistema utilizado pela equipe',
        ' Quantidade de cadeiras disponíveis no ambiente',
      ],
      0,
    ),
    mcqQ(
      'tech_adm_basic',
      STAGE_LABELS.tech_adm_basic,
      'Indicadores',
      'No acompanhamento de indicadores operacionais, algumas métricas ajudam a entender com mais precisão como o atendimento está sendo executado no dia a dia. Entre elas, o TMA é amplamente utilizado para avaliar um aspecto específico da rotina operacional e apoiar análises de desempenho. Considerando esse cenário, o TMA é usado para acompanhar principalmente:',
      [
        ' Tempo médio de atendimento realizado pela operação',
        ' Quantidade de faltas registradas pela equipe',
        ' Número de cadeiras ocupadas no setor',
        ' Tempo médio de almoço dos colaboradores',
      ],
      0,
    ),
    mcqQ(
      'tech_adm_basic',
      STAGE_LABELS.tech_adm_basic,
      'Processos',
      'Quando um fluxo operacional começa a apresentar retrabalho com frequência, isso geralmente indica que existe alguma falha no processo, seja na execução, na comunicação ou no próprio desenho da atividade. Antes de tomar medidas mais drásticas, é importante entender onde está a origem do problema para agir de forma mais assertiva. Nesse contexto, qual costuma ser a primeira ação mais adequada?',
      [
        ' Mapear o processo e identificar o ponto em que a falha está ocorrendo',
        ' Trocar toda a equipe envolvida na atividade',
        ' Parar de medir os resultados para reduzir a pressão',
        ' Remover os controles existentes no processo',
      ],
      0,
    ),
    mcqQ(
      'tech_adm_basic',
      STAGE_LABELS.tech_adm_basic,
      'Gestão de rotina',
      'Uma gestão de rotina eficiente depende de acompanhamento contínuo, permitindo identificar desvios, registrar ocorrências e agir com rapidez quando necessário. Esse processo ajuda a manter mais controle sobre a operação e favorece decisões baseadas em fatos, e não apenas em percepção. Considerando esse contexto, uma boa rotina de acompanhamento tende a incluir:',
      [
        ' Monitoramento das atividades, registro das informações e ações corretivas quando necessário',
        ' Apenas opiniões gerais sobre o que está acontecendo na operação',
        ' Decisões tomadas sem análise de dados ou contexto',
        ' Atividades sem definição de responsáveis',
      ],
      0,
    ),
    mcqQ(
      'tech_adm_basic',
      STAGE_LABELS.tech_adm_basic,
      'Análise operacional',
      'Ao perceber aumento no volume de fila e queda na produtividade da equipe, é importante evitar conclusões precipitadas e analisar os fatores que podem estar contribuindo para esse cenário. Uma avaliação adequada ajuda a entender se o problema está relacionado à demanda, à capacidade disponível ou a outros elementos da operação. Considerando essa situação, qual é a postura mais adequada?',
      [
        ' Cruzar informações de volume, capacidade operacional e absenteísmo da equipe',
        ' Ignorar o histórico recente da operação',
        ' Cobrar a equipe imediatamente sem realizar análise',
        ' Esperar até o fechamento do mês para verificar o cenário',
      ],
      0,
    ),
  ];
}

function techTiSpecificPool() {
  return [
    mcqQ(
      'tech_ti_specific',
      STAGE_LABELS.tech_ti_specific,
      'Lógica de programação',
      'No desenvolvimento de sistemas, é comum utilizar estruturas que permitem ao programa avaliar uma situação antes de definir qual ação deve ser executada. Esse tipo de recurso é importante para criar fluxos mais inteligentes e adaptar o comportamento da aplicação conforme determinadas regras. Considerando esse contexto, em programação, uma condição IF serve para:',
      [
        ' Repetir comandos sem qualquer critério lógico',
        ' Tomar uma decisão com base em uma condição avaliada',
        ' Armazenar imagens dentro do código',
        ' Desligar a rede quando houver erro',
      ],
      1,
    ),
    mcqQ(
      'tech_ti_specific',
      STAGE_LABELS.tech_ti_specific,
      'Infraestrutura de TI',
      'Em um ambiente corporativo, o desempenho dos servidores influencia diretamente a estabilidade e a resposta dos sistemas utilizados pelos usuários. Quando um servidor apresenta uso excessivo de CPU, isso pode comprometer a execução de processos e afetar os serviços que dependem dele. Considerando esse cenário, um servidor com alto uso de CPU pode impactar diretamente:',
      [
        ' O desempenho das aplicações e serviços executados nesse ambiente',
        ' A cor exibida no navegador do usuário',
        ' O layout visual de um e-mail corporativo',
        ' O volume de café consumido pela equipe de TI',
      ],
      0,
    ),
    mcqQ(
      'tech_ti_specific',
      STAGE_LABELS.tech_ti_specific,
      'Segurança da informação',
      'No acesso a sistemas corporativos, adotar boas práticas de segurança é essencial para reduzir riscos, limitar exposições indevidas e garantir que cada usuário tenha apenas o nível de acesso necessário para sua função. Entre essas práticas, algumas se destacam por fortalecer o controle sobre autenticação e permissões. Considerando esse contexto, qual prática reforça a segurança no acesso a sistemas?',
      [
        ' Utilizar senhas compartilhadas entre membros da equipe',
        ' Aplicar o princípio do privilégio mínimo e utilizar autenticação adequada',
        ' Manter credenciais genéricas para facilitar o acesso',
        ' Permitir acesso irrestrito a qualquer usuário autenticado',
      ],
      1,
    ),
    mcqQ(
      'tech_ti_specific',
      STAGE_LABELS.tech_ti_specific,
      'APIs e integração',
      'Em ambientes com múltiplos sistemas, é comum que diferentes aplicações precisem trocar informações de forma estruturada e padronizada. Para viabilizar essa comunicação, utiliza-se um recurso que permite requisições, respostas e integração entre serviços distintos. Considerando esse contexto, uma API é melhor descrita como:',
      [
        ' Uma tela utilizada apenas para exibição de relatórios',
        ' Uma interface de comunicação entre sistemas e aplicações',
        ' Um tipo de banco de dados físico instalado localmente',
        ' Uma planilha protegida utilizada para controle interno',
      ],
      1,
    ),
    mcqQ(
      'tech_ti_specific',
      STAGE_LABELS.tech_ti_specific,
      'Arquitetura de sistemas',
      'Quando uma integração é considerada crítica para a operação, o desenho técnico não deve se limitar apenas ao funcionamento ideal do fluxo, mas também prever como o ambiente será monitorado e como reagirá em caso de falhas. Um planejamento mais completo reduz riscos e facilita a continuidade do serviço mesmo em situações adversas. Considerando esse cenário, um bom desenho técnico deve considerar:',
      [
        ' Falhas possíveis, observabilidade do ambiente e estratégias de contingência',
        ' Somente o nome do endpoint principal da integração',
        ' Apenas a cor do sistema envolvido no processo',
        ' A ausência de logs para simplificar o ambiente',
      ],
      0,
    ),
  ];
}

function techAdmSpecificPool() {
  return [
    mcqQ(
      'tech_adm_specific',
      STAGE_LABELS.tech_adm_specific,
      'Gestão de indicadores',
      'No acompanhamento de uma operação de call center, diferentes indicadores são utilizados para medir desempenho, qualidade e eficiência. Entre eles, existe um indicador específico voltado para entender quanto tempo, em média, cada atendimento leva para ser concluído, sendo bastante utilizado na gestão da rotina operacional. Considerando esse contexto, qual indicador mede o tempo médio de atendimento em uma operação de call center?',
      [' NPS', ' SLA', ' TMA', ' ABS'],
      2,
    ),
    mcqQ(
      'tech_adm_specific',
      STAGE_LABELS.tech_adm_specific,
      'Análise de produtividade',
      'Ao acompanhar os resultados da operação, foi identificado aumento do TMA e queda na aderência da equipe. Esse cenário pode indicar impactos tanto no ritmo dos atendimentos quanto no cumprimento da escala planejada, exigindo uma análise inicial mais cuidadosa antes de qualquer cobrança direta. Considerando essa situação, qual é a melhor ação inicial?',
      [
        ' Analisar a causa do cenário, a escala aplicada e o perfil da demanda recebida',
        ' Trocar a cor do dashboard para facilitar a visualização',
        ' Parar de acompanhar os indicadores até a operação estabilizar',
        ' Cobrar a equipe imediatamente, sem investigar o contexto',
      ],
      0,
    ),
    mcqQ(
      'tech_adm_specific',
      STAGE_LABELS.tech_adm_specific,
      'Planejamento operacional',
      'Na implantação de uma nova operação, estimar corretamente a quantidade de profissionais necessários é uma etapa essencial para atender a demanda esperada sem sobrecarregar a equipe ou comprometer o nível de serviço. Para isso, é preciso começar a análise pelos fatores que impactam diretamente o dimensionamento operacional. Considerando esse contexto, para estimar a equipe necessária em uma nova operação, deve-se olhar primeiro para:',
      [
        ' Volume esperado de atendimentos e SLA alvo da operação',
        ' Nome do cliente atendido',
        ' Modelo de headset que será utilizado pela equipe',
        ' Horário de almoço do gestor responsável',
      ],
      0,
    ),
    mcqQ(
      'tech_adm_specific',
      STAGE_LABELS.tech_adm_specific,
      'Gestão de processos',
      'A monitoria de qualidade é uma ferramenta importante para avaliar como os atendimentos estão sendo realizados e identificar pontos que precisam de ajuste ao longo da operação. Quando aplicada de forma consistente, ela contribui para reforçar padrões, corrigir desvios e apoiar o desenvolvimento da equipe. Nesse contexto, uma monitoria de qualidade ajuda principalmente a:',
      [
        ' Mapear a aderência ao processo e identificar oportunidades de melhoria',
        ' Aumentar o ruído na operação',
        ' Eliminar a necessidade de treinamentos futuros',
        ' Esconder falhas existentes no atendimento',
      ],
      0,
    ),
    mcqQ(
      'tech_adm_specific',
      STAGE_LABELS.tech_adm_specific,
      'Análise de dados',
      'No contexto da gestão operacional, dashboards são amplamente utilizados para consolidar indicadores e facilitar a leitura das informações mais relevantes da operação. Quando bem estruturados, eles ajudam gestores e analistas a identificar comportamentos, acompanhar resultados e apoiar decisões com mais agilidade. Considerando esse cenário, dashboards são úteis porque:',
      [
        ' Substituem completamente qualquer tipo de análise mais detalhada',
        ' Ajudam a visualizar tendências e apoiam a tomada de decisão',
        ' Servem apenas para impressão de relatórios',
        ' Dispensam a conferência ou validação dos dados apresentados',
      ],
      1,
    ),
  ];
}

function writingLogicPool() {
  return [
    wordQ(
      'writing_logic',
      STAGE_LABELS.writing_logic,
      'Avaliação de escrita',
      'Durante o andamento do processo seletivo, um candidato que não compareceu à entrevista entrou em contato por mensagem, justificando a ausência e solicitando a possibilidade de remarcar o horário. Nessa situação, é importante responder de forma educada, profissional e objetiva, demonstrando atenção ao candidato sem confirmar de imediato uma nova data. Com base nesse contexto, escreva uma resposta curta, cordial e profissional, informando que o RH irá verificar a disponibilidade para possível remarcação.',
      { minTextLength: 50, minSentences: 2 },
    ),
    mcqQ(
      'writing_logic',
      STAGE_LABELS.writing_logic,
      'Raciocínio lógico',
      'Durante o acompanhamento da produtividade da equipe, foi identificado que cada operador consegue realizar 12 atendimentos por hora. Considerando uma equipe composta por 4 operadores trabalhando nesse mesmo ritmo ao longo de 2 horas, quantos atendimentos serão realizados no total nesse período?',
      [' 48', ' 72', ' 96', ' 108'],
      2,
    ),
  ];
}

function analysisEvalPool() {
  return [
    mcqQ(
      'analysis_eval',
      STAGE_LABELS.analysis_eval,
      'Leitura de cenário',
      'Durante o acompanhamento dos indicadores operacionais, foi identificado que uma fila apresentou aumento de 20% no volume de demanda, enquanto a quantidade de profissionais disponível permaneceu a mesma. Como consequência, o SLA da operação caiu, indicando piora no atendimento dentro do prazo esperado. Considerando esse cenário, qual hipótese é mais provável?',
      [
        ' A operação passou a ter excesso de capacidade disponível',
        ' A operação pode estar subdimensionada para o novo volume de demanda',
        ' O principal problema está relacionado apenas à cor do dashboard',
        ' Esse cenário não indica nenhum impacto operacional relevante',
      ],
      1,
    ),
    mcqQ(
      'analysis_eval',
      STAGE_LABELS.analysis_eval,
      'Priorização analítica',
      'Ao estruturar um plano de ação para tratar um problema operacional, é importante organizar as informações de forma clara para facilitar o acompanhamento, a execução e a cobrança das atividades definidas. Para que o plano seja útil na prática, os primeiros elementos registrados devem permitir entender o que será feito, por quem e em qual prazo. Considerando esse contexto, qual informação deve aparecer primeiro?',
      [
        ' Ação definida, responsável pela execução e prazo estabelecido',
        ' Apenas opiniões gerais sobre o cenário analisado',
        ' Somente o nome do cliente ou da operação envolvida',
        ' Informações sem definição de responsável',
      ],
      0,
    ),
  ];
}

function techLogicPool() {
  return [
    mcqQ(
      'tech_logic',
      STAGE_LABELS.tech_logic,
      'Lógica técnica',
      'Em um ambiente onde o acesso ao sistema depende de validação de credenciais por meio de uma API de autenticação, qualquer falha nesse componente pode afetar diretamente a entrada dos usuários na aplicação. Como esse serviço é parte essencial do processo de login, a indisponibilidade tende a gerar um impacto bastante específico. Considerando esse cenário, qual impacto é mais esperado?',
      [
        ' Os usuários podem ficar impedidos de acessar o sistema normalmente',
        ' A impressora da operação ficará sem tinta',
        ' O monitor dos computadores mudará de cor automaticamente',
        ' Toda a internet do bairro será interrompida',
      ],
      0,
    ),
    mcqQ(
      'tech_logic',
      STAGE_LABELS.tech_logic,
      'Análise técnica',
      'Quando um erro ocorre de forma intermitente em produção, a análise precisa ser conduzida com cuidado, já que o problema pode não aparecer de maneira contínua e pode depender de contexto, horário ou condição específica. Nessas situações, registrar evidências se torna essencial para identificar padrões e apoiar a investigação técnica. Considerando esse contexto, qual é a melhor prática?',
      [
        ' Coletar logs, registrar o horário e analisar o contexto em que o erro ocorreu',
        ' Reiniciar os serviços imediatamente, sem qualquer registro da ocorrência',
        ' Ignorar o problema por não acontecer o tempo todo',
        ' Alterar o ambiente de produção sem plano ou evidência',
      ],
      0,
    ),
  ];
}

function excelStageBasic() {
  return [
    excelExternalQ(
      'excel_basic',
      STAGE_LABELS.excel_basic,
      'Teste Prático de Excel',
      'Baixe a planilha e realize as atividades práticas do nível básico, seguindo as orientações propostas no arquivo. As tarefas envolvem ações fundamentais de organização e edição, manuseio de células, design de tabelas, utilização de filtros e calculos simples. O exercício simula uma rotina simples de apoio administrativo em uma operação de atendimento.',
      'basic_exam',
      50,
    ),
  ];
}
function excelStageQualid() {
  return [
    excelExternalQ(
      'excel_basic',
      STAGE_LABELS.excel_basic,
      'Teste Prático de Excel',
      'Baixe a planilha e execute as tarefas do teste prático voltado ao contexto operacional. As atividades incluem ordenar a Planilha A pelo campo Operador, criar a coluna Valor Total, utilizar a função PROCV para localizar supervisores, listar os registros não encontrados a partir da célula BC255, montar o resumo solicitado, aplicar filtro para Wesley Nunes e elaborar um gráfico de colunas agrupadas. O objetivo é avaliar sua capacidade de organização, fórmula e análise em uma rotina de operação.',
      'qualid_exam',
      50,
    ),
  ];
}
function excelStageMid() {
  return [
    excelExternalQ(
      'excel_mid',
      STAGE_LABELS.excel_mid,
      'Teste Prático de Excel',
      'Baixe a planilha e execute as tarefas do teste prático voltado ao contexto operacional. As atividades incluem ordenar a Planilha A pelo campo Operador, criar a coluna Valor Total, utilizar a função PROCV para localizar supervisores, listar os registros não encontrados a partir da célula BC255, montar o resumo solicitado, aplicar filtro para Wesley Nunes e elaborar um gráfico de colunas agrupadas. O objetivo é avaliar sua capacidade de organização, fórmula e análise em uma rotina de operação.',
      'qualid_exam',
      50,
    ),
  ];
}

function excelStagePlanning() {
  return [
    excelExternalQ(
      'excel_advanced',
      STAGE_LABELS.excel_advanced,
      'Teste Prático de Excel',
      'Baixe a planilha e realize o teste prático completo, executando as atividades conforme as instruções apresentadas no arquivo. Entre as tarefas, estão o uso de CONT.SE por cidade, aplicação de PROCV para localizar volumes por status, montagem de tabela por DDD com gráfico Pizza 3D, cálculo de média e percentual por zona, definição de situação com base em regra lógica e análise de vendas com totais e percentuais. O exercício foi estruturado para simular uma rotina analítica com foco em planejamento operacional.',
      'planning_exam',
      50,
    ),
  ];
}
function excelStageAdvanced() {
  return [
    excelExternalQ(
      'excel_advanced',
      STAGE_LABELS.excel_advanced,
      'Teste Prático de Excel',
      'Baixe a planilha e execute o teste prático avançado conforme as orientações fornecidas. As atividades incluem aplicar CONT.SE com ordenação por cidade, utilizar PROCV para retorno de status, criar um gráfico combinado com eixo secundário, calcular a soma do RJ na célula F10 e desenvolver uma análise completa de vendas com totais e percentuais. O cenário proposto busca avaliar domínio técnico e capacidade de análise em atividades mais avançadas no Excel.',
      'advanced_exam',
      50,
    ),
  ];
}

function excelMidPool() {
  return [
    mcqQ(
      'excel_mid',
      STAGE_LABELS.excel_mid,
      'Identificação de maior valor',
      'Durante a análise de desempenho da equipe, o supervisor comparou a quantidade de chamadas atendidas por três operadores em um mesmo período. Os registros mostraram os seguintes resultados: Ana realizou 35 atendimentos, João realizou 42 e Pedro realizou 27. Considerando os dados apresentados, qual operador realizou o maior número de atendimentos?',
      [' Ana', ' João', ' Pedro', ' Todos realizaram a mesma quantidade'],
      1,
    ),
    mcqQ(
      'excel_mid',
      STAGE_LABELS.excel_mid,
      'Cálculo de média',
      'Em um acompanhamento simples de produtividade, foi verificado que três operadores realizaram 30, 40 e 50 atendimentos, respectivamente. Para entender o desempenho médio desse grupo, é necessário calcular a média dos valores apresentados. Considerando esse cenário, qual é a média de atendimentos realizados?',
      [' 30', ' 40', ' 45', ' 50'],
      1,
    ),
    mcqQ(
      'excel_mid',
      STAGE_LABELS.excel_mid,
      'Identificação de erro em fórmula',
      'Ao revisar uma planilha de controle, você identifica que uma fórmula foi digitada da seguinte forma: =SUM(A1:A5. Antes de utilizá-la, é importante verificar se a estrutura está correta, pois erros de sintaxe podem impedir o funcionamento da fórmula no Excel. Considerando esse caso, o que está errado nessa fórmula?',
      [
        ' A função SUM não existe no Excel',
        ' Falta fechar o parêntese ao final da fórmula',
        ' O intervalo informado está grande demais para ser usado',
        ' A fórmula está correta e pode ser utilizada normalmente',
      ],
      1,
    ),
    mcqQ(
      'excel_mid',
      STAGE_LABELS.excel_mid,
      'Organização de dados',
      'Em uma planilha com o nome dos operadores e a quantidade de atendimentos realizados, pode ser necessário reorganizar as informações para visualizar quem teve maior desempenho. O Excel possui recursos específicos para ordenar valores de forma crescente ou decrescente, facilitando esse tipo de análise. Considerando esse contexto, qual recurso permite organizar os operadores do maior para o menor número de atendimentos?',
      [
        ' Ordenar / Classificar',
        ' Inserir imagem',
        ' Imprimir planilha',
        ' Congelar painéis',
      ],
      0,
    ),
    mcqQ(
      'excel_mid',
      STAGE_LABELS.excel_mid,
      'Função básica de soma',
      'Ao trabalhar com uma planilha, muitas vezes é necessário somar valores de um intervalo de células para obter um total de forma automática. No caso de valores localizados entre as células A1 e A3, o Excel possui uma fórmula específica para realizar essa soma de maneira correta. Considerando esse cenário, qual fórmula soma os valores entre A1 e A3?',
      [' =SUM(A1:A3)', ' =AVG(A1:A3)', ' =MAX(A1:A3)', ' =COUNT(A1:A3)'],
      0,
    ),
  ];
}

function wordBasicPoolJovemAprendiz() {
  return [
    wordQ(
      'word_basic',
      STAGE_LABELS.word_basic,
      'Formatação de comunicado interno',
      'Durante a rotina do setor, foi percebido que alguns recados importantes estavam sendo passados apenas verbalmente, o que gerou dúvidas entre os colaboradores. Para evitar desencontro de informações, foi solicitado um comunicado simples para reforçar uma orientação à equipe. Escreva o título "COMUNICADO INTERNO" em negrito e centralizado. Em seguida, redija um pequeno texto informando que todos devem conferir os avisos do setor no início do expediente.',
      {
        titleText: 'COMUNICADO INTERNO',
        titleBold: true,
        titleCenter: true,
        minTextLength: 45,
      },
    ),
    wordQ(
      'word_basic',
      STAGE_LABELS.word_basic,
      'E-mail corporativo simples',
      'Você teve um atraso pontual na chegada ao trabalho por causa de um problema no transporte e precisa avisar o supervisor de forma educada e profissional. Redija um e-mail curto informando o ocorrido e dizendo que já está se dirigindo ao local de trabalho.',
      { minTextLength: 55, minSentences: 2 },
    ),
    wordQ(
      'word_basic',
      STAGE_LABELS.word_basic,
      'Lista de materiais para o primeiro dia',
      'Um novo colaborador iniciará as atividades no setor e precisa receber uma orientação simples sobre o que deve levar no primeiro dia. Escreva o título "MATERIAIS PARA O PRIMEIRO DIA" e crie uma lista com pelo menos 3 itens contendo materiais ou documentos importantes.',
      {
        titleText: 'MATERIAIS PARA O PRIMEIRO DIA',
        requiresList: true,
        minListItems: 3,
      },
    ),
  ];
}

function wordBasicPoolOperador() {
  return [
    wordQ(
      'word_basic',
      STAGE_LABELS.word_basic,
      'Formatação de comunicado interno',
      'Durante a troca de turno, foi percebido que alguns registros de atendimento estavam sendo finalizados sem as observações necessárias, o que dificultou o acompanhamento dos casos. Para reforçar essa orientação, foi solicitado um comunicado interno simples para a equipe. Escreva o título "COMUNICADO INTERNO" em negrito e centralizado. Em seguida, redija um pequeno texto orientando que os atendimentos devem ser finalizados com registro claro das informações principais.',
      {
        titleText: 'COMUNICADO INTERNO',
        titleBold: true,
        titleCenter: true,
        minTextLength: 45,
      },
    ),
    wordQ(
      'word_basic',
      STAGE_LABELS.word_basic,
      'E-mail corporativo simples',
      'Durante o atendimento, você identificou um caso que precisa de acompanhamento do supervisor, pois o cliente informou uma divergência que não pode ser resolvida no primeiro contato. Redija um e-mail curto e profissional para o supervisor, resumindo a situação e solicitando orientação sobre a tratativa.',
      { minTextLength: 55, minSentences: 2 },
    ),
    wordQ(
      'word_basic',
      STAGE_LABELS.word_basic,
      'Lista de pendências do atendimento',
      'Ao encerrar o turno, você precisa deixar registradas algumas pendências para a próxima equipe dar continuidade aos casos em aberto. Escreva o título "PENDENCIAS DO TURNO" e crie uma lista com pelo menos 3 itens contendo exemplos de pendências ou ações que precisam de acompanhamento.',
      { titleText: 'PENDENCIAS DO TURNO', requiresList: true, minListItems: 3 },
    ),
  ];
}

function wordBasicPoolEstagiarioTI() {
  return [
    wordQ(
      'word_basic',
      STAGE_LABELS.word_basic,
      'Formatação de comunicado interno',
      'A equipe de TI realizará uma atualização simples em uma ferramenta interna no fim do expediente, e os colaboradores precisam ser avisados com antecedência. Escreva o título "COMUNICADO TECNICO" em negrito e centralizado. Em seguida, redija um pequeno texto informando que poderá haver instabilidade temporária durante a atualização e que a equipe será avisada após a normalização.',
      {
        titleText: 'COMUNICADO TECNICO',
        titleBold: true,
        titleCenter: true,
        minTextLength: 45,
      },
    ),
    wordQ(
      'word_basic',
      STAGE_LABELS.word_basic,
      'E-mail corporativo simples',
      'Um usuário informou que não consegue acessar uma ferramenta interna e você precisa registrar o caso para acompanhamento do responsável. Redija um e-mail curto e profissional resumindo o problema e informando que a situação está em análise.',
      { minTextLength: 55, minSentences: 2 },
    ),
    wordQ(
      'word_basic',
      STAGE_LABELS.word_basic,
      'Checklist inicial de suporte',
      'Antes de iniciar um atendimento técnico simples, é importante realizar algumas verificações básicas para entender o problema com mais clareza. Com base nesse contexto, escreva o título "CHECKLIST INICIAL DE SUPORTE" e crie uma lista com pelo menos 3 itens mostrando verificações que podem ser feitas no começo do atendimento.',
      {
        titleText: 'CHECKLIST INICIAL DE SUPORTE',
        requiresList: true,
        minListItems: 3,
      },
    ),
  ];
}

function generalBasicPoolEstagiarioTI() {
  return [
    mcqQ(
      'general_basic',
      STAGE_LABELS.general_basic,
      'Interpretação de situação de trabalho',
      'Um usuário entra em contato informando que não consegue acessar um sistema utilizado pela empresa e demonstra impaciência porque precisa concluir uma atividade com urgência. Considerando uma postura profissional no atendimento inicial de suporte, qual deve ser sua atitude?',
      [
        ' Pedir para o usuário aguardar sem registrar nenhuma informação',
        ' Ouvir o relato com calma, coletar as informações básicas e iniciar a análise',
        ' Responder de forma ríspida para mostrar que o problema não é simples',
        ' Encerrar o contato e pedir para o usuário tentar novamente mais tarde',
      ],
      1,
    ),
    mcqQ(
      'general_basic',
      STAGE_LABELS.general_basic,
      'Lógica básica',
      `Durante um período de suporte, foram registrados os seguintes chamados resolvidos:
9h: 4 chamados
10h: 6 chamados
11h: 5 chamados

Considerando as informações apresentadas, quantos chamados foram resolvidos no total nesse período? Caso necessário, você pode utilizar a calculadora do Windows para apoiar o cálculo.`,
      [' 13', ' 14', ' 15', ' 16'],
      2,
    ),
    mcqQ(
      'general_basic',
      STAGE_LABELS.general_basic,
      'Comunicação no trabalho',
      'Durante o repasse de atividades entre integrantes da equipe de TI, é importante registrar de forma clara o que já foi analisado, o que ainda está pendente e quais testes foram realizados. Considerando esse contexto, qual prática ajuda diretamente a evitar retrabalho?',
      [
        ' Registrar o andamento do chamado com informações objetivas e organizadas',
        ' Passar apenas parte das informações para o próximo responsável descobrir o restante',
        ' Evitar registros para tornar o processo mais rápido',
        ' Informar somente que existe um problema, sem detalhar nada',
      ],
      0,
    ),
    mcqQ(
      'general_basic',
      STAGE_LABELS.general_basic,
      'Organização de tarefas',
      'Durante o expediente, você recebeu três demandas: atender um usuário que está sem acesso ao sistema, responder um e-mail sem urgência e atualizar um documento interno. Considerando a necessidade de priorização adequada, o que deve ser tratado primeiro?',
      [
        ' Atualizar o documento interno, por ser uma atividade importante',
        ' Responder o e-mail sem urgência para limpar a caixa de entrada',
        ' Atender o usuário sem acesso ao sistema, por gerar impacto mais imediato',
        ' Tratar as demandas em qualquer ordem, pois todas têm o mesmo peso',
      ],
      2,
    ),
    mcqQ(
      'general_basic',
      STAGE_LABELS.general_basic,
      'Trabalho em equipe',
      'Durante a rotina de suporte, um colega novo pediu ajuda para localizar um procedimento técnico já documentado. Considerando uma postura colaborativa e profissional, qual atitude demonstra melhor trabalho em equipe?',
      [
        ' Ignorar o pedido para não interromper a própria rotina',
        ' Dizer para ele resolver sozinho sem qualquer orientação',
        ' Indicar onde está o procedimento e orientar rapidamente sobre como utilizá-lo',
        ' Mandar que ele aguarde até o fim do dia para buscar ajuda',
      ],
      2,
    ),
  ];
}

function writingLogicPoolEstagiarioTI() {
  return [
    wordQ(
      'writing_logic',
      STAGE_LABELS.writing_logic,
      'Avaliação de escrita',
      'Um colaborador informou por mensagem que está com dificuldade para acessar uma ferramenta interna e pediu uma previsão imediata de solução. Nessa situação, é importante responder de forma educada, profissional e objetiva, informando que o caso será analisado sem prometer um prazo antes da validação técnica. Com base nesse contexto, escreva uma resposta curta, cordial e profissional.',
      { minTextLength: 50, minSentences: 2 },
    ),
    mcqQ(
      'writing_logic',
      STAGE_LABELS.writing_logic,
      'Raciocínio lógico',
      'Durante o acompanhamento da equipe de suporte, foi identificado que cada analista consegue tratar 8 chamados por hora. Considerando uma equipe composta por 3 analistas trabalhando nesse mesmo ritmo ao longo de 2 horas, quantos chamados serão tratados no total nesse período?',
      [' 32', ' 40', ' 48', ' 56'],
      2,
    ),
  ];
}

function wordBasicPoolEstagiarioRH() {
  return [
    wordQ(
      'word_basic',
      STAGE_LABELS.word_basic,
      'Formatação de comunicado interno',
      'O RH precisa reforçar para os colaboradores a importância de confirmar presença nas entrevistas internas agendadas com antecedência. Escreva o título "COMUNICADO INTERNO" em negrito e centralizado. Em seguida, redija um pequeno texto orientando que a confirmação seja feita dentro do prazo informado para evitar desencontros de agenda.',
      {
        titleText: 'COMUNICADO INTERNO',
        titleBold: true,
        titleCenter: true,
        minTextLength: 45,
      },
    ),
    wordQ(
      'word_basic',
      STAGE_LABELS.word_basic,
      'E-mail corporativo simples',
      'Um candidato enviou o currículo para uma vaga e você precisa responder confirmando o recebimento, informando que o material será analisado pelo RH. Redija um e-mail curto, cordial e profissional.',
      { minTextLength: 55, minSentences: 2 },
    ),
    wordQ(
      'word_basic',
      STAGE_LABELS.word_basic,
      'Lista de documentos para entrevista',
      'O RH precisa encaminhar uma orientação simples sobre o que o candidato deve apresentar no dia da entrevista. Escreva o título "DOCUMENTOS PARA A ENTREVISTA" e crie uma lista com pelo menos 3 itens contendo documentos ou informações que o candidato deve levar.',
      {
        titleText: 'DOCUMENTOS PARA A ENTREVISTA',
        requiresList: true,
        minListItems: 3,
      },
    ),
  ];
}

function generalBasicPoolEstagiarioRH() {
  return [
    mcqQ(
      'general_basic',
      STAGE_LABELS.general_basic,
      'Interpretação de situação de trabalho',
      'Um candidato entrou em contato demonstrando ansiedade para saber se seguirá no processo seletivo. Considerando a postura esperada do RH, qual deve ser a atitude inicial mais adequada?',
      [
        ' Ignorar a mensagem até que todas as etapas sejam finalizadas',
        ' Responder com educação, informar a etapa atual e orientar que novas atualizações serão comunicadas',
        ' Passar informações de outros candidatos para justificar a demora',
        ' Informar uma aprovação sem que o processo tenha sido concluído',
      ],
      1,
    ),
    mcqQ(
      'general_basic',
      STAGE_LABELS.general_basic,
      'Lógica básica',
      `Em um processo seletivo, o RH agendou 5 entrevistas pela manhã, 4 à tarde e 3 no fim do dia.

Considerando as informações apresentadas, quantas entrevistas foram agendadas no total? Caso necessário, você pode utilizar a calculadora do Windows para apoiar o cálculo.`,
      [' 10', ' 11', ' 12', ' 13'],
      2,
    ),
    mcqQ(
      'general_basic',
      STAGE_LABELS.general_basic,
      'Comunicação no trabalho',
      'Durante o andamento de um processo seletivo, diferentes pessoas podem participar das etapas, como RH, gestor solicitante e entrevistadores. Para evitar retrabalho e desencontro de informações, qual prática contribui mais diretamente para uma boa comunicação entre os envolvidos?',
      [
        ' Registrar o status dos candidatos de forma clara e atualizada',
        ' Informar cada etapa apenas de forma verbal, sem qualquer registro',
        ' Compartilhar dados dos candidatos em grupos sem necessidade',
        ' Atualizar o processo somente ao final de todas as entrevistas',
      ],
      0,
    ),
    mcqQ(
      'general_basic',
      STAGE_LABELS.general_basic,
      'Organização de tarefas',
      'Durante o dia, você recebeu três demandas: confirmar as entrevistas agendadas para hoje, responder um e-mail sem urgência e atualizar uma planilha de acompanhamento semanal. Considerando a necessidade de priorização adequada, o que deve ser tratado primeiro?',
      [
        ' Atualizar a planilha semanal, por ser uma atividade recorrente',
        ' Responder o e-mail sem urgência para reduzir pendências',
        ' Confirmar as entrevistas agendadas para hoje, por ter impacto imediato no processo',
        ' Tratar qualquer tarefa primeiro, sem necessidade de ordem',
      ],
      2,
    ),
    mcqQ(
      'general_basic',
      STAGE_LABELS.general_basic,
      'Trabalho em equipe',
      'Durante o processo seletivo, um colega pediu apoio para localizar rapidamente o status de um candidato já entrevistado. Considerando uma postura colaborativa e profissional, qual atitude demonstra melhor trabalho em equipe?',
      [
        ' Ignorar o pedido para não interromper a própria rotina',
        ' Informar de forma organizada onde está o registro e compartilhar o status correto',
        ' Dizer para o colega procurar sozinho sem qualquer orientação',
        ' Passar uma informação sem conferir se está correta',
      ],
      1,
    ),
  ];
}

function wordPoolHelpDesk() {
  return [
    wordQ(
      'word_basic',
      STAGE_LABELS.word_basic,
      'E-mail corporativo simples',
      'Um sistema interno ficou indisponível por alguns minutos, impactando o trabalho de parte da equipe. Após a normalização, você precisa registrar o ocorrido para o supervisor. Redija um e-mail curto e profissional informando o problema, o impacto percebido e que o acesso já foi restabelecido.',
      { minTextLength: 55, minSentences: 2 },
    ),
    wordQ(
      'word_basic',
      STAGE_LABELS.word_basic,
      'Estruturação de documento técnico',
      'No atendimento de Help Desk, é importante manter um passo a passo claro para casos em que o usuário não consegue acessar um sistema. Com base nesse cenário, crie um título apropriado e escreva uma lista com pelo menos 3 ações iniciais de verificação para esse tipo de atendimento.',
      { requiresList: true, minListItems: 3, minTextLength: 35 },
    ),
    wordQ(
      'word_basic',
      STAGE_LABELS.word_basic,
      'Registro de atendimento',
      'Após concluir um suporte, é necessário deixar um registro claro para histórico do chamado. Escreva o título "REGISTRO DE ATENDIMENTO" em negrito e centralizado. Em seguida, redija um pequeno texto resumindo o problema reportado, a ação executada e o resultado obtido.',
      {
        titleText: 'REGISTRO DE ATENDIMENTO',
        titleBold: true,
        titleCenter: true,
        minSentences: 2,
        minTextLength: 55,
      },
    ),
  ];
}

function wordBasicLevel3PoolPlanejamento() {
  return [
    wordQ(
      'word_basic',
      STAGE_LABELS.word_basic,
      'Redação de comunicado interno',
      'Foi identificado um ajuste temporário na distribuição das pausas da equipe para melhor equilíbrio da operação em um horário de maior demanda. Para comunicar essa alteração com clareza, escreva o título "AJUSTE OPERACIONAL" em negrito e centralizado. Em seguida, redija um comunicado com pelo menos 2 frases, utilizando linguagem clara, direta e de fácil entendimento.',
      {
        titleText: 'AJUSTE OPERACIONAL',
        titleBold: true,
        titleCenter: true,
        minSentences: 2,
        minTextLength: 55,
      },
    ),
    wordQ(
      'word_basic',
      STAGE_LABELS.word_basic,
      'Estruturação de procedimento com lista',
      'Durante a rotina de planejamento, é importante acompanhar de forma organizada uma fila que apresentou aumento de volume. Com base nesse cenário, crie um título apropriado e escreva uma lista com 3 ações de acompanhamento que ajudem a monitorar esse cenário ao longo do dia.',
      { requiresList: true, minListItems: 3, minTextLength: 25 },
    ),
    wordQ(
      'word_basic',
      STAGE_LABELS.word_basic,
      'Revisão e formatação de texto',
      'Durante a análise operacional, o acompanhamento de volume, capacidade e desvios ajuda a manter a rotina mais organizada e facilita decisões ao longo do dia. Considerando esse contexto, escreva um resumo curto sobre a importância do acompanhamento intradiário e destaque pelo menos uma palavra em negrito.',
      { minTextLength: 55, anyBold: true },
    ),
  ];
}

function techAdmBasicPoolPlanejamento() {
  return [
    mcqQ(
      'tech_adm_basic',
      STAGE_LABELS.tech_adm_basic,
      'Controle operacional',
      'No planejamento de uma operação, definir corretamente o tamanho da equipe é uma etapa essencial para garantir equilíbrio entre demanda e capacidade de atendimento. Para isso, é necessário considerar informações que permitam estimar quantas pessoas serão necessárias ao longo da rotina, evitando tanto sobrecarga quanto ociosidade. Considerando esse contexto, qual informação é indispensável para dimensionar a equipe?',
      [
        ' Volume esperado de demanda e jornada de trabalho da equipe',
        ' Nome do supervisor responsável pela operação',
        ' Cor do sistema utilizado pela equipe',
        ' Quantidade de cadeiras disponíveis no ambiente',
      ],
      0,
    ),
    mcqQ(
      'tech_adm_basic',
      STAGE_LABELS.tech_adm_basic,
      'Indicadores',
      'No acompanhamento operacional, o planejamento utiliza indicadores para entender se a capacidade da equipe está adequada à demanda recebida. Entre esses indicadores, o TMA costuma ser acompanhado para avaliar principalmente:',
      [
        ' Tempo médio de atendimento realizado pela operação',
        ' Quantidade de faltas registradas pela equipe',
        ' Número de cadeiras ocupadas no setor',
        ' Tempo médio de almoço dos colaboradores',
      ],
      0,
    ),
    mcqQ(
      'tech_adm_basic',
      STAGE_LABELS.tech_adm_basic,
      'Interpretação de situação de trabalho',
      'Ao acompanhar a operação, você identificou aumento repentino no volume de chamadas e queda do SLA em uma faixa horária específica. Considerando uma análise inicial de planejamento, qual deve ser a primeira leitura mais adequada?',
      [
        ' Verificar se houve aumento de demanda, redução de capacidade ou desvio de escala naquele período',
        ' Concluir imediatamente que toda a equipe teve baixo desempenho',
        ' Ignorar o horário afetado e observar apenas o consolidado do mês',
        ' Aguardar o fim da semana sem analisar o desvio no momento',
      ],
      0,
    ),
    mcqQ(
      'tech_adm_basic',
      STAGE_LABELS.tech_adm_basic,
      'Comunicação no trabalho',
      'Durante o repasse entre equipes de planejamento, é importante registrar com clareza os desvios observados, as ações aplicadas e os pontos que ainda exigem acompanhamento. Considerando esse contexto, qual prática contribui diretamente para evitar retrabalho?',
      [
        ' Registrar o status operacional de forma objetiva, com dados e ações realizadas',
        ' Compartilhar apenas uma percepção geral, sem detalhamento',
        ' Deixar as informações para serem lembradas depois, sem registro formal',
        ' Comunicar somente o que já foi resolvido e omitir o restante',
      ],
      0,
    ),
    mcqQ(
      'tech_adm_basic',
      STAGE_LABELS.tech_adm_basic,
      'Organização de tarefas',
      'Durante a rotina de planejamento, você recebeu três demandas: analisar um desvio crítico de escala do dia, responder um e-mail sem urgência e atualizar uma apresentação semanal. Considerando a necessidade de priorização adequada, o que deve ser tratado primeiro?',
      [
        ' Atualizar a apresentação semanal, por ser uma entrega importante',
        ' Responder o e-mail sem urgência para reduzir pendências',
        ' Analisar o desvio crítico de escala do dia, por ter impacto imediato na operação',
        ' Tratar qualquer uma das tarefas, sem necessidade de ordem',
      ],
      2,
    ),
  ];
}

function generalAdvancedPoolTI() {
  return [
    mcqQ(
      'general_advanced',
      STAGE_LABELS.general_advanced,
      'Tomada de decisão estratégica',
      'Ao acompanhar um incidente técnico, foi identificado aumento de lentidão em um sistema crítico, mas ainda sem indisponibilidade total. Ao mesmo tempo, os logs apontam crescimento de erros em um serviço específico. Considerando esse cenário, qual leitura faz mais sentido?',
      [
        ' O ambiente está normal e não exige acompanhamento',
        ' Existe um sinal de degradação que pode evoluir para indisponibilidade, exigindo análise técnica e monitoramento imediato',
        ' A melhor decisão é ignorar os logs até que o sistema pare totalmente',
        ' O aumento de erros não tem relação com a estabilidade do ambiente',
      ],
      1,
    ),
    mcqQ(
      'general_advanced',
      STAGE_LABELS.general_advanced,
      'Análise de cenário organizacional',
      'Uma nova operação será implantada em 15 dias, exigindo planejamento e organização para que o início aconteça de forma estruturada e com o menor risco possível. Antes de avançar para etapas mais visuais ou administrativas, é fundamental validar os pontos que impactam diretamente a viabilidade da operação. Considerando esse contexto, o que deve ser validado primeiro?',
      [
        ' Volume previsto, jornada da equipe, capacidade operacional e riscos envolvidos',
        ' Apenas o nome do cliente que será atendido',
        ' Somente o layout físico da sala onde a operação ficará',
        ' Somente a definição do uniforme da equipe',
      ],
      0,
    ),
    mcqQ(
      'general_advanced',
      STAGE_LABELS.general_advanced,
      'Gestão de projetos',
      'Durante um projeto de implantação, o acompanhamento das etapas depende de marcos bem definidos, pois eles ajudam a organizar o andamento do trabalho e permitem maior controle sobre o que precisa ser entregue. Para que o projeto avance com clareza e responsabilidade, é importante estabelecer referências objetivas ao longo da execução. Nesse contexto, um marco importante é:',
      [
        ' Não trabalhar com cronograma para manter flexibilidade total',
        ' Definir entregas, responsáveis e prazos de cada etapa',
        ' Evitar registrar decisões para não engessar o projeto',
        ' Alterar o escopo diariamente conforme surgirem novas ideias',
      ],
      1,
    ),
    mcqQ(
      'general_advanced',
      STAGE_LABELS.general_advanced,
      'Pensamento crítico',
      'Ao receber um relatório com informações inconsistentes, como divergência de números, ausência de coerência entre indicadores ou dados fora do padrão esperado, é necessário adotar uma postura analítica antes de utilizar esse material em apresentações ou tomadas de decisão. Considerando esse cenário, qual é a melhor conduta?',
      [
        ' Aceitar o relatório sem realizar validações adicionais',
        ' Cruzar os dados e investigar as divergências antes de seguir com a análise',
        ' Apresentar o conteúdo mesmo com inconsistências, para não atrasar a entrega',
        ' Descartar imediatamente o relatório sem tentar entender a origem do problema',
      ],
      1,
    ),
    mcqQ(
      'general_advanced',
      STAGE_LABELS.general_advanced,
      'Comunicação estratégica',
      'Quando ocorre um incidente crítico na operação, a comunicação com a diretoria deve ser objetiva, mas também suficientemente completa para permitir uma compreensão rápida da situação e apoiar a tomada de decisão. Nesse tipo de reporte, é importante ir além da simples descrição do problema e apresentar os elementos essenciais do cenário. Considerando esse contexto, a comunicação deve conter:',
      [
        ' Somente a informação de que houve um problema na operação',
        ' Contexto do incidente, impacto gerado, plano de ação e próximos passos',
        ' Apenas opiniões gerais, sem necessidade de dados ou direcionamento',
        ' Detalhes secundários e informações sem relação direta com o incidente',
      ],
      1,
    ),
  ];
}

function techAdmSpecificPoolAnalista() {
  return [
    mcqQ(
      'tech_adm_specific',
      STAGE_LABELS.tech_adm_specific,
      'Gestão de indicadores',
      'No acompanhamento de uma operação, diferentes indicadores são utilizados para medir desempenho, qualidade e eficiência. Entre eles, existe um indicador específico voltado para entender quanto tempo, em média, cada atendimento leva para ser concluído, sendo bastante utilizado na gestão da rotina operacional. Considerando esse contexto, qual indicador mede o tempo médio de atendimento em uma operação de call center?',
      [' NPS', ' SLA', ' TMA', ' ABS'],
      2,
    ),
    mcqQ(
      'tech_adm_specific',
      STAGE_LABELS.tech_adm_specific,
      'Análise de produtividade',
      'Ao acompanhar os resultados de uma rotina analítica, foi identificado atraso recorrente na entrega de relatórios e aumento de divergências nos dados consolidados. Antes de qualquer cobrança direta, qual é a melhor ação inicial?',
      [
        ' Validar a origem dos dados, o fluxo de atualização e os pontos do processo em que ocorrem as divergências',
        ' Cobrar imediatamente a equipe, sem investigar o contexto',
        ' Suspender o acompanhamento dos relatórios até o cenário melhorar',
        ' Alterar o layout do dashboard para tentar resolver o problema',
      ],
      0,
    ),
    mcqQ(
      'tech_adm_specific',
      STAGE_LABELS.tech_adm_specific,
      'Planejamento operacional',
      'Na implantação de uma nova operação, estimar corretamente a quantidade de profissionais necessários é uma etapa essencial para atender a demanda esperada sem sobrecarregar a equipe ou comprometer o nível de serviço. Para isso, é preciso começar a análise pelos fatores que impactam diretamente o dimensionamento operacional. Considerando esse contexto, para estimar a equipe necessária em uma nova operação, deve-se olhar primeiro para:',
      [
        ' Volume esperado de atendimentos e SLA alvo da operação',
        ' Nome do cliente atendido',
        ' Modelo de headset que será utilizado pela equipe',
        ' Horário de almoço do gestor responsável',
      ],
      0,
    ),
    mcqQ(
      'tech_adm_specific',
      STAGE_LABELS.tech_adm_specific,
      'Gestão de processos',
      'Quando um processo apresenta retrabalho frequente, atrasos e divergência entre as áreas envolvidas, qual prática tende a ajudar mais diretamente na melhoria do fluxo?',
      [
        ' Mapear o processo atual, identificar gargalos e definir ajustes com responsáveis claros',
        ' Manter o processo como está e apenas cobrar mais velocidade da equipe',
        ' Eliminar os registros para tornar o fluxo mais rápido',
        ' Alterar as atividades diariamente sem padronização',
      ],
      0,
    ),
    mcqQ(
      'tech_adm_specific',
      STAGE_LABELS.tech_adm_specific,
      'Análise de dados',
      'Na rotina de um analista, dashboards ajudam a acompanhar indicadores, mas não substituem totalmente uma análise crítica. Considerando esse contexto, dashboards são úteis principalmente porque:',
      [
        ' Organizam a visualização dos dados e ajudam a identificar tendências, desvios e pontos que exigem aprofundamento',
        ' Eliminam a necessidade de validar a base de dados utilizada',
        ' Servem apenas para deixar apresentações mais bonitas',
        ' Tornam desnecessária qualquer investigação complementar',
      ],
      0,
    ),
  ];
}

const EXAM_BLUEPRINTS = {
  jovem_aprendiz: {
    level: '1',
    label: 'Nv 1 - Jovem Aprendiz',
    stages: [
      {
        key: 'word_basic',
        weight: 40,
        questions: () => wordBasicPoolJovemAprendiz(),
      },
      { key: 'excel_basic', weight: 40, questions: () => excelStageBasic() },
      { key: 'general_basic', weight: 20, questions: () => generalBasicPool() },
    ],
  },
  operador: {
    level: '2',
    label: 'Nv 2 - Operador',
    stages: [
      {
        key: 'word_basic',
        weight: 40,
        questions: () => wordBasicPoolOperador(),
      },
      { key: 'excel_basic', weight: 40, questions: () => excelStageQualid() },
      { key: 'general_basic', weight: 20, questions: () => generalBasicPool() },
    ],
  },
  estagiario_ti: {
    level: '2',
    label: 'Nv 2 - Estagiario (TI)',
    stages: [
      {
        key: 'word_basic',
        weight: 20,
        questions: () => wordBasicPoolEstagiarioTI(),
      },
      { key: 'excel_basic', weight: 20, questions: () => excelStageQualid() },
      {
        key: 'general_basic',
        weight: 10,
        questions: () => generalBasicPoolEstagiarioTI(),
      },
      { key: 'tech_ti_basic', weight: 40, questions: () => techTiBasicPool() },
      {
        key: 'writing_logic',
        weight: 10,
        questions: () => writingLogicPoolEstagiarioTI(),
      },
    ],
  },
  estagiario_rh: {
    level: '2',
    label: 'Nv 2 - Estagiario (RH)',
    stages: [
      {
        key: 'word_basic',
        weight: 20,
        questions: () => wordBasicPoolEstagiarioRH(),
      },
      { key: 'excel_basic', weight: 20, questions: () => excelStageQualid() },
      {
        key: 'general_basic',
        weight: 10,
        questions: () => generalBasicPoolEstagiarioRH(),
      },
      { key: 'tech_rh_basic', weight: 40, questions: () => techRhBasicPool() },
      { key: 'writing_logic', weight: 10, questions: () => writingLogicPool() },
    ],
  },
  supervisor: {
    level: '3',
    label: 'Nv 3 - Supervisor',
    stages: [
      { key: 'word_basic', weight: 35, questions: () => wordBasicLevel3Pool() },
      { key: 'excel_mid', weight: 35, questions: () => excelStageMid() },
      {
        key: 'general_adv_people',
        weight: 30,
        questions: () => generalAdvPeoplePool(),
      },
    ],
  },
  helpdesk: {
    level: '3',
    label: 'Nv 3 - Control Desk',
    stages: [
      { key: 'word_basic', weight: 20, questions: () => wordPoolHelpDesk() },
      {
        key: 'excel_advanced',
        weight: 20,
        questions: () => excelStagePlanning(),
      },
      {
        key: 'general_basic',
        weight: 10,
        questions: () => generalBasicPoolEstagiarioTI(),
      },
      {
        key: 'tech_ti_basic',
        weight: 40,
        questions: () => techTiBasicPool(),
      },
      { key: 'analysis_eval', weight: 10, questions: () => analysisEvalPool() },
    ],
  },
  planejamento: {
    level: '3',
    label: 'Nv 3 - Planejamento',
    stages: [
      {
        key: 'word_basic',
        weight: 20,
        questions: () => wordBasicLevel3PoolPlanejamento(),
      },
      {
        key: 'excel_advanced',
        weight: 20,
        questions: () => excelStagePlanning(),
      },
      { key: 'general_basic', weight: 10, questions: () => generalBasicPool() },
      {
        key: 'tech_adm_basic',
        weight: 40,
        questions: () => techAdmBasicPoolPlanejamento(),
      },
      { key: 'analysis_eval', weight: 10, questions: () => analysisEvalPool() },
    ],
  },
  ti: {
    level: '4',
    label: 'Nv 4 - TI',
    stages: [
      { key: 'word_advanced', weight: 20, questions: () => wordAdvancedPool() },
      {
        key: 'excel_advanced',
        weight: 20,
        questions: () => excelStageAdvanced(),
      },
      {
        key: 'general_advanced',
        weight: 10,
        questions: () => generalAdvancedPoolTI(),
      },
      {
        key: 'tech_ti_specific',
        weight: 40,
        questions: () => techTiSpecificPool(),
      },
      { key: 'tech_logic', weight: 10, questions: () => techLogicPool() },
    ],
  },
  adm: {
    level: '4',
    label: 'Nv 4 - Analista / Outros (ADM)',
    stages: [
      { key: 'word_advanced', weight: 20, questions: () => wordAdvancedPool() },
      {
        key: 'excel_advanced',
        weight: 20,
        questions: () => excelStageAdvanced(),
      },
      {
        key: 'general_advanced',
        weight: 20,
        questions: () => generalAdvancedPool(),
      },
      {
        key: 'tech_adm_specific',
        weight: 40,
        questions: () => techAdmSpecificPoolAnalista(),
      },
    ],
  },
};

function resolveExamBlueprint(role, level, track = '') {
  const safeRole = String(role || '').trim();
  const safeTrack = String(track || '')
    .trim()
    .toLowerCase();

  if (safeRole === 'Jovem Aprendiz' || level === '1') {
    return EXAM_BLUEPRINTS.jovem_aprendiz;
  }

  if (safeRole === 'Operador') {
    return EXAM_BLUEPRINTS.operador;
  }

  if (safeRole === 'Estagiário') {
    return safeTrack === 'rh'
      ? EXAM_BLUEPRINTS.estagiario_rh
      : EXAM_BLUEPRINTS.estagiario_ti;
  }

  if (safeRole === 'Supervisor') {
    return EXAM_BLUEPRINTS.supervisor;
  }

  if (safeRole === 'Control Desk') {
    return EXAM_BLUEPRINTS.helpdesk;
  }

  if (safeRole === 'Planejamento') {
    return EXAM_BLUEPRINTS.planejamento;
  }

  if (safeRole === 'TI') {
    return EXAM_BLUEPRINTS.ti;
  }

  return EXAM_BLUEPRINTS.adm;
}

function shuffleArray(items) {
  const arr = Array.isArray(items) ? [...items] : [];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function shuffleMultipleChoiceQuestion(question) {
  if (
    !question ||
    question.type !== 'multiple' ||
    !Array.isArray(question.options)
  ) {
    return question;
  }

  const indexedOptions = question.options.map((option, index) => ({
    option,
    originalIndex: index,
  }));

  const shuffledOptions = shuffleArray(indexedOptions);
  const newAnswerIndex = shuffledOptions.findIndex(
    (item) => item.originalIndex === question.answer,
  );

  return {
    ...question,
    options: shuffledOptions.map((item) => item.option),
    answer: newAnswerIndex,
  };
}

function getBlueprintQuestionTarget(blueprint) {
  if (!blueprint || !blueprint.label) return null;

  if (blueprint.label.includes('Estagiário')) return 13;
  if (blueprint.label.includes('Analista / Outros')) return 16;

  return null;
}

function normalizeBlueprintQuestions(questions) {
  return questions.map((question) => {
    const cloned = { ...question };
    if (cloned.type === 'multiple') {
      return shuffleMultipleChoiceQuestion(cloned);
    }
    return cloned;
  });
}

function buildExamFromBlueprint(blueprint) {
  const questions = [];

  if (!blueprint || !Array.isArray(blueprint.stages)) {
    throw new Error('Blueprint inválido ou sem etapas definidas.');
  }

  blueprint.stages.forEach((stage, index) => {
    let stageQuestions = [];

    if (typeof stage.questions === 'function') {
      stageQuestions = stage.questions();
    } else if (Array.isArray(stage.questions)) {
      stageQuestions = stage.questions;
    } else {
      console.error('Etapa inválida encontrada no blueprint:', stage);
      throw new Error(
        `A etapa "${stage?.key || index}" está com o campo "questions" inválido.`,
      );
    }

    if (!Array.isArray(stageQuestions)) {
      console.error('A etapa retornou questions em formato inválido:', stage);
      throw new Error(
        `A etapa "${stage?.key || index}" não retornou uma lista de questões válida.`,
      );
    }

    questions.push(
      ...stageQuestions.map((q) => ({
        ...q,
        stageWeight: stage.weight,
      })),
    );
  });

  return questions;
}

// Exporta apenas a superfície consumida pela aplicação React.
export {
  ROLE_LEVEL_SUGGESTIONS as SUGESTOES_NIVEL_POR_VAGA,
  STAGE_LABELS as ROTULOS_ETAPAS,
  EXAM_BLUEPRINTS as BLUEPRINTS_PROVA,
  resolveExamBlueprint as resolverBlueprintProva,
  buildExamFromBlueprint as montarProvaPorBlueprint,
};


