const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const rootDir = path.resolve(__dirname, '..');
const source = fs.readFileSync(
  path.join(rootDir, 'fonte', 'features', 'conecta-provas', 'index.js'),
  'utf8',
);

assert.ok(source.includes('>Começar</button>'));
assert.ok(source.includes("const bloqueada = !somenteCadastro && !cadastroConcluido"));
assert.ok(source.includes("setEtapa('etapas')"));
assert.ok(source.includes('localStorage.setItem(CHAVE_TOKEN_PUBLICO'));
assert.ok(source.includes("dados?.candidato?.dados_confirmados"));
assert.ok(source.includes('conecta-provas-essay-keywords'));
assert.ok(source.includes('Boa sorte!'));
assert.ok(source.includes('conecta-provas-copy-text'));
assert.ok(source.includes("return limparTextoVisivelCandidato(temaNaProposta) || 'Tema Livre'"));

console.log('Conecta Provas flow smoke passed.');
