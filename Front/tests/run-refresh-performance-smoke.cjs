const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const rootDir = path.resolve(__dirname, '..');
const read = (...parts) => fs.readFileSync(path.join(rootDir, ...parts), 'utf8');

const core = read('fonte', 'services', 'api', 'core.js');
const processesApi = read('fonte', 'services', 'api', 'processes.js');
const processesScreen = read('fonte', 'features', 'processos', 'index.js');
const appRoot = read('fonte', 'app', 'aplicacao-raiz.js');

assert.ok(core.includes("PREFIXO_CACHE_SESSAO = 'rh_api_cache_v2:'"));
assert.ok(core.includes('sessionStorage.setItem(chaveCacheSessao(chave), serializado)'));
assert.ok(processesApi.includes('processos:detalhe:'));
assert.ok(processesScreen.includes('aplicarDetalhePrincipal(detalhe || {})'));
assert.ok(processesScreen.includes('setCarregando(false);'));
assert.equal(processesScreen.includes('lerBancoTalentos({ forcar: true })'), false);
assert.ok(appRoot.includes('function carregarTela(importador, nomeExportado)'));
assert.ok(appRoot.includes('<${Suspense}'));

console.log('Refresh performance smoke passed.');
