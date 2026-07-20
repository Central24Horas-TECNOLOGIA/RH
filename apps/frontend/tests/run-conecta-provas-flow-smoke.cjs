const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const rootDir = path.resolve(__dirname, '..');
const source = fs.readFileSync(
  path.join(rootDir, 'fonte', 'features', 'conecta-provas', 'index.js'),
  'utf8',
);

assert.ok(source.includes('>Começar</button>'));
assert.ok(source.includes("const bloqueada = (!somenteCadastro && !cadastroConcluido) || indisponivel"));
assert.ok(source.includes('concluirEtapaConectaProvas(token, respostas, etapaSelecionadaKey, indiceAtual)'));
assert.ok(source.includes('interromperEtapaConectaProvas('));
assert.ok(!source.includes('Ver etapas'));
assert.ok(source.includes("setEtapa('etapas')"));
assert.ok(source.includes('localStorage.setItem(CHAVE_TOKEN_PUBLICO'));
assert.ok(source.includes("dados?.candidato?.dados_confirmados"));
assert.ok(source.includes('conecta-provas-essay-keywords'));
assert.ok(source.includes('Boa sorte!'));
assert.ok(source.includes('conecta-provas-copy-text'));
assert.ok(source.includes('function normalizarQuebrasTextoQuestao'));
assert.ok(source.includes('function BlocosTextoQuestao'));
assert.ok(source.includes('conecta-provas-question-heading'));
assert.ok(source.includes('conecta-provas-question-quote'));
assert.ok(source.includes('conecta-provas-question-command'));
assert.ok(source.includes("return limparTextoVisivelCandidato(temaNaProposta) || 'Tema Livre'"));

const regrasSource = fs.readFileSync(path.join(rootDir, 'fonte', 'regras-prova.js'), 'utf8');
const helpersSource = fs.readFileSync(
  path.join(rootDir, 'fonte', 'shared', 'helpers-visuais.js'),
  'utf8',
);
assert.doesNotMatch(
  `${regrasSource}\n${helpersSource}`,
  /from ['"].*(?:perguntas|banco-questoes|personalizacao-inteligente)/,
  'A rota pública não deve carregar indiretamente o banco interno de questões/rubricas.',
);

console.log('Conecta Provas flow smoke passed.');
