const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const rootDir = path.resolve(__dirname, '..');
const perguntasUrl = pathToFileURL(path.join(rootDir, 'fonte', 'perguntas.js')).href;
const personalizacaoUrl = pathToFileURL(
  path.join(rootDir, 'fonte', 'features', 'prova', 'services', 'personalizacao-inteligente.js'),
).href;

const expectedJobs = [
  {
    label: 'Planejamento',
    level: '4',
    track: 'Operação / Gestão',
    count: 17,
    niche: 'Planejamento',
    operation: 'CRF',
  },
  {
    label: 'Estagiário',
    level: '2',
    track: 'Comercial',
    optionTrack: '',
    count: 15,
    niche: 'Estagiário / Comercial',
    operation: 'CRF',
  },
  {
    label: 'Estagiário',
    level: '2',
    track: 'Operação',
    optionTrack: '',
    count: 15,
    niche: 'Estagiário / Operação',
    operation: 'Brava',
  },
  {
    label: 'Estagiário',
    level: '2',
    track: 'Financeiro',
    optionTrack: '',
    count: 15,
    niche: 'Estagiário / Financeiro',
    operation: 'Newe',
  },
  {
    label: 'Suporte Técnico Júnior',
    level: '2',
    track: 'TI',
    count: 17,
    niche: 'Suporte Técnico Júnior',
    operation: 'DAVITA',
  },
  {
    label: 'Suporte Técnico Pleno',
    level: '3',
    track: 'TI',
    count: 17,
    niche: 'Suporte Técnico Pleno',
    operation: 'Endoview',
  },
  {
    label: 'Suporte Técnico Sênior',
    level: '4',
    track: 'TI',
    count: 17,
    niche: 'Suporte Técnico Sênior',
    operation: 'Brava',
  },
  {
    label: 'Supervisor',
    level: '3',
    track: 'Operação / Gestão',
    count: 14,
    niche: 'Supervisor',
    operation: 'DAVITA',
  },
];

const forbiddenPatterns = [
  /\bTecninco\b/,
  /\bSupoerte\b/,
  /\bseginifica\b/,
  /\bapra\b/,
  /\bmanuentação\b/,
  /\bofficie\b/i,
  /(^|[^cç])onhecimento\b/i,
  /\bgerenciamente\b/,
  /\bpretroliferas\b/,
  /\bocorrencias\b/,
  /\bemergencias\b/,
  /\bclinicas\b/,
];

async function main() {
  const perguntas = await import(perguntasUrl);
  const personalizacao = await import(personalizacaoUrl);
  const resumoBanco = perguntas.obterResumoBancoQuestoes();
  assert.ok(resumoBanco.validacao.ok, 'Banco central de questoes deve estar valido.');
  assert.ok(resumoBanco.total >= 60, 'Banco central deve ter cobertura minima de questoes.');
  assert.ok(
    resumoBanco.personalizadas.total >= 10,
    'Banco central deve incluir questoes personalizadas por cliente/area.',
  );
  assert.deepEqual(
    resumoBanco.personalizadas.clientes.map((cliente) => cliente.id).sort(),
    ['brava', 'crf', 'davita', 'endoview', 'newe'],
    'Clientes de personalizacao devem estar declarados no banco central.',
  );

  for (const job of expectedJobs) {
    const option = perguntas.OPCOES_VAGAS_PROVA.find((item) => item.label === job.label);
    assert.ok(option, `${job.label} deve aparecer nas opções de vaga`);
    assert.equal(option.level, job.level, `${job.label} deve sugerir nível ${job.level}`);
    assert.equal(
      option.track,
      job.optionTrack ?? job.track,
      `${job.label} deve manter a trilha de catálogo esperada`,
    );

    const blueprint = perguntas.resolverBlueprintProva(job.label, job.level, job.track);
    assert.ok(blueprint, `${job.label} deve resolver um blueprint`);
    assert.equal(blueprint.level, job.level, `${job.label} deve manter nível no blueprint`);
    assert.equal(
      blueprint.stages.reduce((total, stage) => total + Number(stage.weight || 0), 0),
      100,
      `${job.label} deve manter pesos somando 100%`,
    );

    const questions = perguntas.montarProvaPorBlueprint(blueprint);
    assert.equal(questions.length, job.count, `${job.label} deve gerar ${job.count} questões`);
    assert.ok(
      questions.some((question) => question.stageKey === 'professional_essay'),
      `${job.label} deve incluir redação obrigatória`,
    );

    const personalized = personalizacao.gerarPersonalizacaoProva(questions, {
      vaga: job.label,
      trilha: job.track,
      nivelProva: job.level,
      operacao: job.operation,
      perfilOperacao: 'call_center',
      nivelPersonalizacao: 'situacional',
      usuario: 'smoke-test',
    });
    assert.equal(personalized.status, personalizacao.STATUS_PERSONALIZACAO.GERADA);
    assert.equal(personalized.questoes.length, questions.length);

    const essay = personalized.questoes.find(
      (question) => question.stageKey === 'professional_essay',
    );
    assert.equal(essay.personalizacaoInteligente.nicho_vaga, job.niche);
    assert.equal(essay.personalizacaoInteligente.nicho_operacao, job.operation);
    assert.equal(/Use linguagem humanizada|A resposta deve mostrar|400 caracteres/i.test(essay.description), false);
    assert.equal(essay.essay.maxLines, 20);
    assert.ok(
      essay.essay.supportTexts.every((texto) => !/^Texto-(base|motivador)\s*\d/i.test(texto)),
      'Textos-base da redação não devem repetir rótulo interno no conteúdo',
    );
  }

  const jovemBlueprint = perguntas.resolverBlueprintProva('Jovem Aprendiz', '1', 'Operação');
  const jovemQuestions = perguntas.montarProvaPorBlueprint(jovemBlueprint);
  const textoJovemPadrao = jovemQuestions
    .map((question) => `${question.title}\n${question.description}`)
    .join('\n');
  assert.ok(
    jovemQuestions
      .filter((question) => question.type !== 'excel_external')
      .every((question) => question.questionBankId),
    'Questoes nao Excel devem vir do banco central editavel',
  );
  assert.equal(/Formata/i.test(textoJovemPadrao), false);
  assert.equal(/Leia a situa/i.test(textoJovemPadrao), false);
  assert.ok(
    jovemQuestions.every((question) => !question.personalizacaoInteligente),
    'Prova padrão não deve nascer personalizada',
  );
  assert.ok(
    jovemQuestions.some((question) => question.type === 'excel_external'),
    'Jovem Aprendiz deve manter etapa de Excel gerada',
  );
  assert.ok(
    jovemQuestions.some((question) => question.type === 'word' && question.stageKey === 'word_basic'),
    'Jovem Aprendiz deve manter etapa de Word/texto',
  );
  const jovemEssay = jovemQuestions.find((question) => question.stageKey === 'professional_essay');
  assert.equal(jovemEssay.title, 'Redação');
  assert.equal(jovemEssay.essay.maxCharacters, 2200);
  assert.equal(jovemEssay.expected.maxCharacters, 2200);
  assert.equal(jovemEssay.essay.maxLines, 20);
  assert.equal(jovemEssay.expected.maxLines, 20);
  assert.ok(
    jovemEssay.essay.supportTexts.length >= 2,
    'Redação deve ter ao menos dois textos-base',
  );

  const jovemPersonalizada = personalizacao.gerarPersonalizacaoProva(jovemQuestions, {
    vaga: 'Jovem Aprendiz',
    trilha: 'Operação',
    nivelProva: '1',
    operacao: 'Davita',
    perfilOperacao: 'atendimento_saude',
    tiposAtendimento: ['Atendimento ao paciente', 'Agendamento'],
    nivelPersonalizacao: 'contextual_avancado',
    usuario: 'smoke-test',
  });
  const textoJovem = jovemPersonalizada.questoes.map((question) => question.description).join('\n');
  const questoesBancoDavita = jovemPersonalizada.questoes.filter(
    (question) => question.personalizacaoInteligente?.mecanismo === 'banco_personalizado',
  );
  assert.ok(
    questoesBancoDavita.length >= 2,
    'Personalizacao Davita deve usar questoes especificas do banco central quando houver match.',
  );
  assert.ok(
    questoesBancoDavita.every(
      (question) =>
        question.personalizacaoInteligente?.origem_banco_personalizado?.cliente_id === 'davita' &&
        Array.isArray(question.personalizacaoInteligente?.origem_banco_personalizado?.areas) &&
        question.personalizacaoInteligente.origem_banco_personalizado.areas.length > 0,
    ),
    'Questoes personalizadas devem manter cliente e areas de origem.',
  );
  const enunciadosDavita = jovemPersonalizada.questoes
    .filter((question) => question.type !== 'excel_external')
    .map((question) => String(question.description || '').trim())
    .filter(Boolean);
  assert.equal(
    enunciadosDavita.length,
    new Set(enunciadosDavita).size,
    'Personalização DaVita deve manter enunciados diferentes por questão',
  );
  assert.equal(
    /central de agendamento\s+central de agendamento/i.test(textoJovem),
    false,
    'Personalização DaVita não deve duplicar central de agendamento',
  );
  assert.equal(
    /^Contexto:/im.test(textoJovem),
    false,
    'Personalização não deve expor rótulo Contexto:',
  );
  assert.equal(
    jovemPersonalizada.questoes[0].personalizacaoInteligente.restricao_nivel,
    'Jovem Aprendiz',
  );
  assert.equal(/\b(SLA|KPI|CRM)\b/i.test(textoJovem), false);
  assert.equal(/gestão de pessoas|liderança/i.test(textoJovem), false);
  assert.ok(
    /primeiro emprego|iniciando a vida profissional|situação simples/i.test(textoJovem),
    'Personalização de Jovem Aprendiz deve manter linguagem de entrada',
  );

  const operadorBlueprint = perguntas.resolverBlueprintProva('Operador', '2', 'Operação');
  const operadorQuestions = perguntas.montarProvaPorBlueprint(operadorBlueprint);
  const operadorPersonalizada = personalizacao.gerarPersonalizacaoProva(operadorQuestions, {
    vaga: 'Operador',
    trilha: 'Operação',
    nivelProva: '2',
    operacao: 'Davita',
    perfilOperacao: 'atendimento_saude',
    tiposAtendimento: ['Atendimento ao paciente', 'Agendamento'],
    nivelPersonalizacao: 'contextual_avancado',
    usuario: 'smoke-test',
  });
  const textoOperador = operadorPersonalizada.questoes.map((question) => question.description).join('\n');
  assert.equal(/\b(KPI|CRM)\b/i.test(textoOperador), false);
  assert.equal(/gestão de pessoas/i.test(textoOperador), false);

  const blueprintsWithoutEssay = Object.entries(perguntas.BLUEPRINTS_PROVA)
    .filter(([, blueprint]) => !blueprint.stages?.some((stage) => stage.key === 'professional_essay'))
    .map(([key]) => key);
  assert.deepEqual(blueprintsWithoutEssay, [], 'Todos os blueprints devem ter redação');

  const activeSources = [
    path.join(rootDir, 'fonte', 'perguntas.js'),
    path.join(rootDir, 'fonte', 'features', 'prova', 'services', 'personalizacao-inteligente.js'),
    path.join(rootDir, 'fonte', 'app', 'controlador-aplicacao.js'),
    path.join(rootDir, 'fonte', 'features', 'prova', 'index.js'),
  ];
  for (const filePath of activeSources) {
    const source = fs.readFileSync(filePath, 'utf8');
    for (const pattern of forbiddenPatterns) {
      assert.equal(
        pattern.test(source),
        false,
        `${path.relative(rootDir, filePath)} não deve conter ${pattern}`,
      );
    }
  }

  console.log('RH business rules smoke passed.');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
