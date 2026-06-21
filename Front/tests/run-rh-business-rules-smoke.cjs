const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const rootDir = path.resolve(__dirname, '..');
const perguntasUrl = pathToFileURL(path.join(rootDir, 'fonte', 'perguntas.js')).href;
const personalizacaoUrl = pathToFileURL(
  path.join(rootDir, 'fonte', 'features', 'prova', 'services', 'personalizacao-inteligente.js'),
).href;

const forbiddenVisiblePatterns = /Gabarito|Resposta correta|O que deve ser avaliado|Rubrica interna/i;

function contarPor(lista, seletor) {
  return lista.reduce((mapa, item) => {
    const chave = seletor(item);
    mapa[chave] = (mapa[chave] || 0) + 1;
    return mapa;
  }, {});
}

function gerar(perguntas, vaga, nivel, trilha) {
  const blueprint = perguntas.resolverBlueprintProva(vaga, nivel, trilha);
  assert.ok(blueprint, `${vaga} deve resolver blueprint`);
  const questoes = perguntas.montarProvaPorBlueprint(blueprint);
  return { blueprint, questoes };
}

function assertSemSigiloVisivel(questoes, contexto) {
  const vazamentos = questoes
    .filter((questao) => questao.type !== 'excel_external')
    .filter((questao) =>
      forbiddenVisiblePatterns.test(
        [questao.description, questao.enunciadoCandidato, questao.instrucaoCandidato].join('\n'),
      ),
    )
    .map((questao) => questao.questionBankId || questao.title);

  assert.deepEqual(vazamentos, [], `${contexto} não deve expor gabarito/rubrica`);
}

function assertExcelPreservado(questoes, taskId, contexto) {
  const excel = questoes.filter((questao) => questao.type === 'excel_external');
  assert.equal(excel.length, 1, `${contexto} deve manter uma etapa Excel`);
  assert.equal(excel[0].taskId, taskId, `${contexto} deve manter arquivo-base Excel`);
  assert.equal(excel[0].questaoReformulada, undefined, `${contexto} Excel não deve vir do banco reformulado`);
}

function assertGrupoCompacto(questoes, tamanhos, contexto) {
  const grupos = questoes.filter((questao) => questao.type === 'compact_choice_group');
  assert.deepEqual(
    grupos.map((questao) => questao.items.length).sort((a, b) => a - b),
    tamanhos.slice().sort((a, b) => a - b),
    `${contexto} deve manter questões agrupadas`,
  );
}

async function main() {
  const perguntas = await import(perguntasUrl);
  const personalizacao = await import(personalizacaoUrl);
  const resumoBanco = perguntas.obterResumoBancoQuestoes();

  assert.ok(resumoBanco.validacao.ok, 'Banco central legado deve continuar válido.');
  assert.ok(resumoBanco.total >= 60, 'Banco legado deve continuar carregado.');
  assert.ok(resumoBanco.reformuladas.total >= 60, 'Banco reformulado deve estar carregado.');
  assert.deepEqual(
    resumoBanco.reformuladas.cargos,
    ['estagiario', 'jovem_aprendiz', 'operador', 'supervisor'],
    'Somente cargos reformulados devem entrar no novo banco.',
  );

  const jovem = gerar(perguntas, 'Jovem Aprendiz', '1', 'Operação');
  assert.equal(jovem.questoes.length, 16, 'Jovem Aprendiz neutra deve usar os DOCX e manter Excel/Geral.');
  assert.equal(jovem.questoes.filter((q) => q.questaoReformulada).length, 10);
  assertExcelPreservado(jovem.questoes, 'basic_exam', 'Jovem Aprendiz');
  assert.equal(jovem.questoes.filter((q) => q.stageKey === 'professional_essay').length, 1);
  assertSemSigiloVisivel(jovem.questoes, 'Jovem Aprendiz neutra');

  const jovemPersonalizada = personalizacao.gerarPersonalizacaoProva(jovem.questoes, {
    vaga: 'Jovem Aprendiz',
    trilha: 'Operação',
    nivelProva: '1',
    operacao: 'Davita',
    clientesOperacoes: ['Davita'],
    tiposAtendimento: ['Atendimento ao paciente'],
    nivelPersonalizacao: 'situacional',
    usuario: 'smoke-test',
  });
  assert.ok(
    jovemPersonalizada.questoes.filter((q) => q.questaoReformulada && q.personalizacaoInteligente?.mecanismo === 'banco_personalizado').length >= 9,
    'Jovem Aprendiz personalizada deve usar variações por cliente do DOCX.',
  );
  assert.ok(
    jovemPersonalizada.questoes.some((q) => q.stageKey === 'professional_essay' && q.personalizacaoInteligente?.mecanismo === 'banco_reformulado_neutro'),
    'Redação de Jovem Aprendiz não deve ser personalizada.',
  );
  assertSemSigiloVisivel(jovemPersonalizada.questoes, 'Jovem Aprendiz personalizada');

  const operador = gerar(perguntas, 'Operador', '2', 'Operação');
  assert.equal(operador.questoes.length, 14, 'Operador neutra deve usar Word/Redação reformulados.');
  assert.equal(operador.questoes.filter((q) => q.questaoReformulada).length, 8);
  assertGrupoCompacto(operador.questoes, [15, 20], 'Operador neutra');
  assertExcelPreservado(operador.questoes, 'qualid_exam', 'Operador');
  assertSemSigiloVisivel(operador.questoes, 'Operador neutra');

  const operadorPersonalizada = personalizacao.gerarPersonalizacaoProva(operador.questoes, {
    vaga: 'Operador',
    trilha: 'Operação',
    nivelProva: '2',
    operacao: 'Davita',
    clientesOperacoes: ['Davita'],
    tiposAtendimento: ['Atendimento ao paciente'],
    nivelPersonalizacao: 'situacional',
    usuario: 'smoke-test',
  });
  assert.ok(
    operadorPersonalizada.questoes.filter((q) => q.questaoReformulada && q.personalizacaoInteligente?.mecanismo === 'banco_personalizado').length >= 8,
    'Operador personalizada deve usar blocos por cliente do DOCX.',
  );
  assertSemSigiloVisivel(operadorPersonalizada.questoes, 'Operador personalizada');

  const estagiario = gerar(perguntas, 'Estagiário', '2', 'TI');
  assert.equal(estagiario.questoes.length, 29, 'Estagiário TI neutra deve incluir Word, Gerais, Técnicos e Redação reformulados.');
  assert.equal(estagiario.questoes.filter((q) => q.questaoReformulada).length, 28);
  assert.deepEqual(contarPor(estagiario.questoes, (q) => q.stageKey), {
    word_basic: 5,
    excel_basic: 1,
    general_basic: 10,
    tech_ti_basic: 10,
    writing_logic: 2,
    professional_essay: 1,
  });
  assertGrupoCompacto(estagiario.questoes, [15, 20], 'Estagiário TI neutra');
  assertExcelPreservado(estagiario.questoes, 'qualid_exam', 'Estagiário TI');
  assertSemSigiloVisivel(estagiario.questoes, 'Estagiário TI neutra');

  const estagiarioPersonalizada = personalizacao.gerarPersonalizacaoProva(estagiario.questoes, {
    vaga: 'Estagiário',
    trilha: 'TI',
    nivelProva: '2',
    operacao: 'Davita',
    clientesOperacoes: ['Davita'],
    tiposAtendimento: ['Suporte Técnico'],
    nivelPersonalizacao: 'situacional',
    usuario: 'smoke-test',
  });
  assert.ok(
    estagiarioPersonalizada.questoes.filter((q) => q.questaoReformulada && q.personalizacaoInteligente?.mecanismo === 'banco_personalizado').length >= 8,
    'Estagiário personalizada deve usar variações por área do DOCX.',
  );
  assertSemSigiloVisivel(estagiarioPersonalizada.questoes, 'Estagiário personalizada');

  const supervisor = gerar(perguntas, 'Supervisor', '3', 'Operação / Gestão');
  assert.equal(supervisor.questoes.length, 11, 'Supervisor neutra deve evitar duplicação dos DOCX repetidos.');
  assert.equal(supervisor.questoes.filter((q) => q.questaoReformulada).length, 10);
  assert.deepEqual(contarPor(supervisor.questoes, (q) => q.stageKey), {
    word_basic: 7,
    excel_mid: 1,
    general_adv_people: 2,
    professional_essay: 1,
  });
  assertExcelPreservado(supervisor.questoes, 'qualid_exam', 'Supervisor');
  assertSemSigiloVisivel(supervisor.questoes, 'Supervisor neutra');

  const supervisorPersonalizada = personalizacao.gerarPersonalizacaoProva(supervisor.questoes, {
    vaga: 'Supervisor',
    trilha: 'Operação / Gestão',
    nivelProva: '3',
    operacao: 'Davita',
    clientesOperacoes: ['Davita'],
    tiposAtendimento: ['Atendimento ao paciente'],
    nivelPersonalizacao: 'situacional',
    usuario: 'smoke-test',
  });
  assert.ok(
    supervisorPersonalizada.questoes.filter((q) => q.questaoReformulada && q.personalizacaoInteligente?.mecanismo === 'banco_personalizado').length >= 8,
    'Supervisor personalizada deve usar blocos por cliente do DOCX.',
  );
  assert.ok(
    supervisorPersonalizada.questoes.some((q) => q.stageKey === 'professional_essay' && q.personalizacaoInteligente?.mecanismo === 'banco_reformulado_neutro'),
    'Redação de Supervisor não deve ser personalizada.',
  );
  assertSemSigiloVisivel(supervisorPersonalizada.questoes, 'Supervisor personalizada');

  for (const prova of [jovemPersonalizada, operadorPersonalizada, estagiarioPersonalizada, supervisorPersonalizada]) {
    assert.equal(
      prova.questoes.some((q) => q.questaoReformulada && q.personalizacaoInteligente?.mecanismo === 'template_local'),
      false,
      'Questões reformuladas não devem passar por personalização automática por template.',
    );
  }

  const analista = gerar(perguntas, 'Analista', '4', 'ADM / Gestão');
  assert.equal(
    analista.questoes.filter((q) => q.questaoReformulada).length,
    0,
    'Cargo não reformulado deve continuar no banco antigo.',
  );
  assertExcelPreservado(analista.questoes, 'advanced_exam', 'Analista');

  const editorSource = fs.readFileSync(
    path.join(rootDir, 'fonte', 'ui', 'components', 'exam-fields.js'),
    'utf8',
  );
  for (const comando of ['bold', 'italic', 'underline', 'strikeThrough', 'fontSize', 'justifyLeft', 'justifyCenter', 'justifyRight', 'justifyFull', 'insertUnorderedList', 'insertOrderedList']) {
    assert.ok(editorSource.includes(comando), `Editor deve expor comando ${comando}`);
  }

  console.log('RH business rules smoke passed.');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
