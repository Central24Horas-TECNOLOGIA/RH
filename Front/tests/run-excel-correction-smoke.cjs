const fs = require('node:fs');
const path = require('node:path');

function decodeAddress(address) {
  const match = String(address || '').toUpperCase().match(/^([A-Z]+)(\d+)$/);
  if (!match) throw new Error(`Invalid address: ${address}`);
  let col = 0;
  for (const letter of match[1]) col = col * 26 + (letter.charCodeAt(0) - 64);
  return { c: col - 1, r: Number(match[2]) - 1 };
}

const sandbox = {
  ROTULOS_ETAPAS: {},
  window: {
    XLSX: {
      utils: {
        decode_range(ref) {
          const [start, end = start] = String(ref || 'A1:A1').split(':');
          return { s: decodeAddress(start), e: decodeAddress(end) };
        },
        encode_col(index) {
          let number = Number(index) + 1;
          let text = '';
          while (number > 0) {
            const rest = (number - 1) % 26;
            text = String.fromCharCode(65 + rest) + text;
            number = Math.floor((number - 1) / 26);
          }
          return text || 'A';
        },
      },
    },
  },
  obterDadosBaseExcel: async () => ({}),
  baixarBlob: () => null,
  contarFrases: () => 0,
  contarItensListaNoHtml: () => 0,
  removerHtml: (value) => String(value || '').replace(/<[^>]*>/g, ''),
  sanitizarNomeArquivo: (value) => String(value || '').replace(/[^\w.-]/g, '_'),
  textoMaiusculoSeguro: (value) => String(value || '').trim().toUpperCase(),
  Blob,
  Date,
  Math,
  Number,
  Object,
  RegExp,
  String,
  Array,
  Set,
};

function loadCorrectionModule() {
  const sourcePath = path.resolve(__dirname, '../fonte/regras-prova.js');
  let source = fs.readFileSync(sourcePath, 'utf8');
  source = source.replace(/import[\s\S]*?from\s+['"][^'"]+['"];\s*/g, '');
  source = source.replace(/export\s+async\s+function\s+/g, 'async function ');
  source = source.replace(/export\s+function\s+/g, 'function ');
  source = source.replace(/export\s*\{[\s\S]*?\};\s*/g, '');

  const factory = new Function(
    'sandbox',
    `with (sandbox) { ${source}; return { validarWorkbookPorTarefa, montarTextoCompletoDoGabarito }; }`,
  );
  return factory(sandbox);
}

const {
  montarTextoCompletoDoGabarito,
  validarWorkbookPorTarefa,
} = loadCorrectionModule();

function cell(value = '', formula = '', extra = {}) {
  const item = { ...extra };
  if (value !== undefined && value !== null) {
    item.v = value;
    item.w = String(value);
  }
  if (formula) item.f = formula.replace(/^=/, '');
  return item;
}

function workbook(sheets) {
  return { SheetNames: Object.keys(sheets), Sheets: sheets };
}

function detail(result, label) {
  return (result.taskDetails || []).find((item) => item.label === label);
}

function done(result, label) {
  return detail(result, label)?.done === true;
}

function doneCount(result) {
  return (result.taskDetails || []).filter((item) => item.done).length;
}

const results = [];
function test(name, fn) {
  try {
    fn();
    results.push({ name, ok: true });
  } catch (error) {
    results.push({ name, ok: false, message: error?.message || String(error) });
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

test('resposta na celula esperada', () => {
  const result = validarWorkbookPorTarefa('planning_exam', workbook({
    'Q2.': {
      '!ref': 'A1:B8',
      A4: cell('DISPONIBILIDADE / CSO'),
      B4: cell(10),
      A5: cell('ERRO DE CADASTRO'),
      B5: cell(20),
      A6: cell('FAX'),
      B6: cell(30),
    },
  }), 50);
  assert(done(result, 'PROCV preenchido na aba Q2.'), 'Q2 esperada deveria ser identificada.');
});

test('resposta em coluna ao lado e formula em local diferente', () => {
  const result = validarWorkbookPorTarefa('qualid_exam', workbook({
    Resposta: {
      '!ref': 'A1:G5',
      A1: cell('Operador'),
      B1: cell('Supervisor'),
      C1: cell('Produto'),
      D1: cell('Valor (R$)'),
      E1: cell('Quantidade'),
      G1: cell('Valor Total'),
      A2: cell('Amanda Gilena'),
      D2: cell(60),
      E2: cell(2),
      G2: cell(120, '=D2*E2'),
      A3: cell('Wesley Nunes'),
      D3: cell(8),
      E3: cell(7),
      G3: cell(56, '=D3*E3'),
      A4: cell('Rafael Luiz'),
      D4: cell(25),
      E4: cell(8),
      G4: cell(200, '=D4*E4'),
    },
  }), 50);
  assert(done(result, 'Coluna F com titulo Valor Total'), 'Cabecalho Valor Total movido deveria ser identificado.');
  assert(done(result, 'Valor Total = Valor (R$) x Quantidade'), 'Formula de Valor Total movida deveria ser identificada.');
});

test('resposta em linha abaixo', () => {
  const result = validarWorkbookPorTarefa('qualid_exam', workbook({
    TAB_DIN: {
      '!ref': 'A1:D8',
      A1: cell('Resumo Lula'),
      A6: cell('Lula'),
      B6: cell('Virtua 6 MB'),
      C6: cell(60),
      D6: cell('Valor Total'),
    },
  }), 50);
  assert(done(result, 'Resumo do supervisor Lula criado na aba TAB_DIN'), 'Resumo em linha abaixo deveria ser identificado.');
});

test('resposta em outra aba', () => {
  const result = validarWorkbookPorTarefa('planning_exam', workbook({
    'Minha Q1': {
      '!ref': 'A1:B5',
      A1: cell('Cidade'),
      B1: cell('Qtde de Nomes'),
      A2: cell('Campinas'),
      B2: cell(3, '=CONT.SE(Base!A:A,A2)'),
      A3: cell('Guarulhos'),
      B3: cell(2, '=CONT.SE(Base!A:A,A3)'),
      A4: cell('Limeira'),
      B4: cell(1, '=CONT.SE(Base!A:A,A4)'),
    },
  }), 50);
  assert(done(result, 'CONT.SE preenchido por cidade e ordenado'), 'CONT.SE em outra aba deveria ser identificado.');
});

test('formula correta em local diferente', () => {
  const result = validarWorkbookPorTarefa('advanced_exam', workbook({
    'Q7.': {
      '!ref': 'A1:H10',
      A1: cell('Estado'),
      B1: cell('Valores'),
      A2: cell('RJ'),
      B2: cell(10),
      H2: cell(168, '=SOMASE(A:A,"RJ",B:B)'),
    },
  }), 50);
  assert(done(result, 'Soma do RJ em F10'), 'Soma do RJ fora de F10 deveria ser identificada por formula/valor.');
});

test('texto com pequena variacao', () => {
  const result = validarWorkbookPorTarefa('qualid_exam', workbook({
    PROCV: {
      '!ref': 'A1:BD256',
      BC255: cell('Tânia Santana'),
      BC256: cell('Luzia Mendonça'),
    },
  }), 50);
  assert(done(result, 'Operadores nao encontrados listados a partir de BC255'), 'Nomes com acento deveriam ser normalizados.');
});

test('resposta vazia', () => {
  const result = validarWorkbookPorTarefa('qualid_exam', workbook({ Resposta: { '!ref': 'A1:A1' } }), 50);
  assert(doneCount(result) === 0, 'Planilha vazia nao deve marcar tarefas.');
});

test('valor aleatorio sem relacao', () => {
  const result = validarWorkbookPorTarefa('planning_exam', workbook({
    Aleatoria: {
      '!ref': 'Z20:Z20',
      Z20: cell('qualquer coisa'),
    },
  }), 50);
  assert(doneCount(result) === 0, 'Valor aleatorio nao deve marcar tarefas.');
});

test('prova de Operador nao retorna zero quando respondida', () => {
  const result = validarWorkbookPorTarefa('qualid_exam', workbook({
    'Planilha A': {
      '!ref': 'A1:F5',
      A1: cell('Operador'),
      D1: cell('Valor (R$)'),
      E1: cell('Quantidade'),
      F1: cell('Valor Total'),
      A2: cell('Amanda Gilena'),
      D2: cell(60),
      E2: cell(2),
      F2: cell(120, '=D2*E2'),
      A3: cell('Rafael Luiz'),
      D3: cell(25),
      E3: cell(8),
      F3: cell(200, '=D3*E3'),
      A4: cell('Wesley Nunes'),
      D4: cell(8),
      E4: cell(7),
      F4: cell(56, '=D4*E4'),
    },
  }), 50);
  assert(doneCount(result) > 0, 'Operador respondido nao deve ficar com zero tarefas.');
});

test('prova de Analista nao retorna zero quando respondida', () => {
  const result = validarWorkbookPorTarefa('advanced_exam', workbook({
    'Q7.': {
      '!ref': 'A1:F10',
      A1: cell('Estado'),
      B1: cell('Valores'),
      A2: cell('RJ'),
      B2: cell(10),
      F10: cell(168, '=SOMASE(A:A,"RJ",B:B)'),
    },
  }), 50);
  assert(doneCount(result) > 0, 'Analista respondido nao deve ficar com zero tarefas.');
});

test('prova basica com 6 tarefas respondidas', () => {
  const result = validarWorkbookPorTarefa('basic_exam', workbook({
    'Teste de Excel': {
      '!ref': 'A1:D20',
      '!autofilter': { ref: 'A9:D12' },
      A1: cell('Titulo', '', { s: { fill: { fgColor: { rgb: '99CCFF' } } } }),
      A9: cell('Produto', '', { s: { fill: { fgColor: { rgb: '99CCFF' } } } }),
      B9: cell('Quantidade'),
      C9: cell('Valor (R$)', '', { z: 'R$ #,##0.00' }),
      D9: cell('Sub Total', '', { s: { fill: { fgColor: { rgb: '99CCFF' } } } }),
      A10: cell('Placa mae'),
      B10: cell(7),
      C10: cell(250, '', { z: 'R$ #,##0.00' }),
      D10: cell(1750, '=B10*C10', { z: 'R$ #,##0.00', s: { fill: { fgColor: { rgb: '99CCFF' } } } }),
      A11: cell('Processador'),
      B11: cell(2),
      C11: cell(170, '', { z: 'R$ #,##0.00' }),
      D11: cell(340, '=B11*C11', { z: 'R$ #,##0.00', s: { fill: { fgColor: { rgb: '99CCFF' } } } }),
      A12: cell('Indira'),
      B12: cell(4),
      C12: cell(120, '', { z: 'R$ #,##0.00' }),
      D12: cell(480, '=B12*C12', { z: 'R$ #,##0.00', s: { fill: { fgColor: { rgb: '99CCFF' } } } }),
      A13: cell('TOTAL'),
      B13: cell(13, '=SOMA(B10:B12)'),
      D13: cell(2570, '=SOMA(D10:D12)'),
    },
  }), 50);
  assert(doneCount(result) === 6, `Esperava 6 tarefas; recebeu ${doneCount(result)}.`);
});

test('descricao da correcao entra no gabarito', () => {
  const validation = validarWorkbookPorTarefa('advanced_exam', workbook({
    'Q7.': {
      '!ref': 'A1:F10',
      A1: cell('Estado'),
      B1: cell('Valores'),
      F10: cell(168, '=SOMASE(A:A,"RJ",B:B)'),
    },
  }), 50);
  const text = montarTextoCompletoDoGabarito({
    candidato: { name: 'Teste', role: 'Analista', level: '4' },
    questoes: [{ type: 'excel_external', taskId: 'advanced_exam', stage: 'Excel', title: 'Excel', description: 'Teste' }],
    respostas: [{ filename: 'resposta.xlsx', uploaded: true, validation }],
    resultados: [{ score: validation.score, max: validation.max, taskDetails: validation.taskDetails }],
    notaFinalPonderada: 10,
    observacaoRh: '',
  });
  assert(text.includes('Descrição da correção'), 'Gabarito deve conter descricao detalhada da correcao.');
  assert(text.includes('Soma do RJ em F10'), 'Gabarito deve listar a tarefa corrigida.');
});

const failed = results.filter((item) => !item.ok);
for (const item of results) {
  console.log(item.ok ? `OK ${item.name}` : `FAIL ${item.name}: ${item.message}`);
}

if (failed.length) {
  process.exitCode = 1;
}
