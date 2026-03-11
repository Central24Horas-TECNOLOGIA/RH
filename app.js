const RH_USER = 'rh';
const RH_PASS = '1234';

const state = {
  logged: false,
  candidate: null,
  questions: [],
  currentIndex: 0,
  answers: [],
  timerSeconds: 0,
  timerHandle: null,
  finished: false,
  finalResults: [],
  totalScore: 0,
  totalMax: 0,
  manualReviewItems: [],
};

/* =========================
   INICIALIZAÇÃO
========================= */

document
  .getElementById('candidate-role')
  .addEventListener('change', function () {
    const suggestedLevel = ROLE_LEVEL_SUGGESTIONS[this.value];
    if (suggestedLevel)
      document.getElementById('candidate-level').value = suggestedLevel;
  });

/* =========================
   UTILITÁRIOS GERAIS
========================= */

function showScreen(id) {
  document
    .querySelectorAll('.screen')
    .forEach((s) => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

function sanitizeFileName(name) {
  return String(name).replace(/[^\w\-\.À-ÿ]/g, '_');
}

function safeUpper(v) {
  return String(v || '')
    .trim()
    .toUpperCase();
}

function approxEqual(a, b, tolerance = 0.01) {
  return Math.abs(Number(a) - Number(b)) <= tolerance;
}

function stripHtml(html) {
  const div = document.createElement('div');
  div.innerHTML = html || '';
  return (div.textContent || div.innerText || '').trim();
}

function countSentences(text) {
  return (text.match(/[.!?](\s|$)/g) || []).length || (text.trim() ? 1 : 0);
}

function countListItemsFromHtml(html) {
  const div = document.createElement('div');
  div.innerHTML = html || '';
  return div.querySelectorAll('li').length;
}

function scoreResult(
  score,
  max,
  notes = [],
  pendingManual = false,
  completedTasks = [],
) {
  return { score, max, notes, pendingManual, completedTasks };
}

function getSheet(wb, name) {
  return wb.Sheets[name];
}

function cellValue(ws, addr) {
  if (!ws || !ws[addr]) return '';
  if (ws[addr].w !== undefined) return ws[addr].w;
  if (ws[addr].v !== undefined) return ws[addr].v;
  return '';
}

function cellFormula(ws, addr) {
  return ws && ws[addr] && ws[addr].f ? String(ws[addr].f).toUpperCase() : '';
}

function hasComment(ws, addr) {
  return !!(ws && ws[addr] && ws[addr].c && ws[addr].c.length);
}

function hasAutoFilter(ws) {
  return !!(ws && ws['!autofilter']);
}

function aoaToSheet(aoa) {
  return XLSX.utils.aoa_to_sheet(aoa);
}

function appendRows(ws, rows, startCell = 'A1') {
  XLSX.utils.sheet_add_aoa(ws, rows, { origin: startCell });
}

/* =========================
   LOGIN / FLUXO
========================= */

function doLogin() {
  const user = document.getElementById('login-user').value.trim();
  const pass = document.getElementById('login-pass').value.trim();
  const alert = document.getElementById('login-alert');

  if (user === RH_USER && pass === RH_PASS) {
    state.logged = true;
    alert.classList.add('d-none');
    showScreen('screen-config');
  } else {
    alert.textContent = 'Usuário ou senha inválidos.';
    alert.classList.remove('d-none');
  }
}

function logout() {
  clearInterval(state.timerHandle);
  state.logged = false;
  state.finished = false;
  showScreen('screen-login');
}

function startExam() {
  const name = document.getElementById('candidate-name').value.trim();
  const role = document.getElementById('candidate-role').value.trim();
  const level = document.getElementById('candidate-level').value;
  const time = parseInt(document.getElementById('candidate-time').value, 10);
  const alert = document.getElementById('config-alert');

  if (!name || !role || !level || !time) {
    alert.textContent = 'Preencha todos os campos para iniciar a prova.';
    alert.classList.remove('d-none');
    return;
  }

  alert.classList.add('d-none');

  state.candidate = { name, role, level, time };
  state.questions = JSON.parse(JSON.stringify(EXAM_MODELS[level]));
  state.currentIndex = 0;
  state.answers = new Array(state.questions.length).fill(null);
  state.timerSeconds = time * 60;
  state.finished = false;
  state.finalResults = [];
  state.totalScore = 0;
  state.totalMax = 0;
  state.manualReviewItems = [];

  document.getElementById('exam-candidate').textContent = name;
  document.getElementById('exam-role').textContent = role;

  clearInterval(state.timerHandle);
  state.timerHandle = setInterval(() => {
    state.timerSeconds--;
    renderTimer();
    if (state.timerSeconds <= 0) {
      clearInterval(state.timerHandle);
      finishExam();
    }
  }, 1000);

  renderTimer();
  showScreen('screen-exam');
  renderQuestion();
}

function renderTimer() {
  const total = Math.max(0, state.timerSeconds);
  const mm = String(Math.floor(total / 60)).padStart(2, '0');
  const ss = String(total % 60).padStart(2, '0');
  document.getElementById('timer').textContent = `${mm}:${ss}`;
}

/* =========================
   RENDERIZAÇÃO DAS QUESTÕES
========================= */

function renderQuestion() {
  const q = state.questions[state.currentIndex];
  document.getElementById('stage-badge').textContent = q.stage;
  document.getElementById('question-title').textContent = q.title;
  document.getElementById('question-description').textContent = q.description;

  const progress = ((state.currentIndex + 1) / state.questions.length) * 100;
  document.getElementById('progress-bar').style.width = `${progress}%`;
  document.getElementById('progress-text').textContent =
    `Questão ${state.currentIndex + 1} de ${state.questions.length}`;
  document.getElementById('prev-btn').disabled = state.currentIndex === 0;
  document.getElementById('next-btn').textContent =
    state.currentIndex === state.questions.length - 1 ? 'Finalizar' : 'Próxima';

  const area = document.getElementById('dynamic-area');
  area.innerHTML = '';

  if (q.type === 'word') renderWordQuestion(area);
  if (q.type === 'multiple') renderMultipleQuestion(area, q);
  if (q.type === 'excel_external') renderExcelExternalQuestion(area, q);
}

function renderWordQuestion(area) {
  area.innerHTML = `
    <div class="card border-0 bg-light">
      <div class="card-body">
        <div class="toolbar d-flex flex-wrap gap-2 mb-3">
          <button class="btn btn-outline-secondary" onclick="formatDoc('bold')"><strong>B</strong></button>
          <button class="btn btn-outline-secondary" onclick="formatDoc('italic')"><em>I</em></button>
          <button class="btn btn-outline-secondary" onclick="formatDoc('underline')"><u>U</u></button>
          <button class="btn btn-outline-secondary" onclick="formatDoc('justifyLeft')">Esq</button>
          <button class="btn btn-outline-secondary" onclick="formatDoc('justifyCenter')">Centro</button>
          <button class="btn btn-outline-secondary" onclick="formatDoc('insertUnorderedList')">• Lista</button>
        </div>
        <div id="word-editor" class="word-editor" contenteditable="true" spellcheck="false"></div>
      </div>
    </div>
  `;

  if (state.answers[state.currentIndex]?.content) {
    document.getElementById('word-editor').innerHTML =
      state.answers[state.currentIndex].content;
  }
}

function renderMultipleQuestion(area, q) {
  const selected = state.answers[state.currentIndex]?.selected;
  area.innerHTML = `
    <div class="card border-0 bg-light">
      <div class="card-body">
        ${q.options
          .map(
            (opt, i) => `
          <div class="form-check mb-3">
            <input class="form-check-input" type="radio" name="mcq" id="opt-${i}" value="${i}" ${selected === i ? 'checked' : ''}>
            <label class="form-check-label" for="opt-${i}">${opt}</label>
          </div>
        `,
          )
          .join('')}
      </div>
    </div>
  `;
}

function renderExcelExternalQuestion(area, q) {
  const ans = state.answers[state.currentIndex] || {};
  area.innerHTML = `
    <div class="excel-card">
      <div class="row g-3">
        <div class="col-lg-7">
          <div class="excel-step mb-3">
            <h4 class="h6 fw-bold">Como funciona esta etapa</h4>
            <ol class="mb-0">
              <li>Baixe a planilha desta etapa.</li>
              <li>Abra no LibreOffice Calc.</li>
              <li>Realize todas as atividades descritas.</li>
              <li>Salve o arquivo e envie abaixo apenas uma vez.</li>
            </ol>
          </div>

          <div class="d-flex flex-wrap gap-2 mb-3">
            <button class="btn btn-success" onclick="downloadExcelTask(${state.currentIndex})">Baixar arquivo .xlsx</button>
          </div>

          <div class="excel-step">
            <h4 class="h6 fw-bold">O que será testado neste arquivo</h4>
            <ul class="muted-list">
              ${getTaskCapabilities(q.taskId)
                .map((item) => `<li>${item}</li>`)
                .join('')}
            </ul>
          </div>
        </div>

        <div class="col-lg-5">
          <div class="excel-upload-box">
            <label class="form-label fw-semibold">Enviar arquivo respondido</label>
            <input class="form-control mb-3" type="file" accept=".xlsx,.xlsm" onchange="handleExcelUpload(event, ${state.currentIndex})">
            <div id="excel-upload-status" class="${ans.statusClass || 'text-muted'}">
              ${ans.statusText || 'Nenhum arquivo enviado ainda.'}
            </div>
            <div class="small text-muted mt-2">Formatos aceitos: .xlsx e .xlsm</div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function formatDoc(command) {
  document.execCommand(command, false, null);
  document.getElementById('word-editor').focus();
}

function getTaskCapabilities(taskId) {
  const caps = {
    basic_exam: [
      'linhas de grade',
      'cópia da tabela para G9',
      'preenchimento de célula',
      'comentário',
      'filtro na tabela',
      'cálculo de total com fórmula',
    ],
    qualid_exam: [
      'ordenação por operador',
      'criação da coluna Valor Total',
      'multiplicação de Valor (R$) por Quantidade',
      'PROCV de supervisores',
      'lista de não encontrados a partir de BC255',
      'resumo do supervisor Lula',
      'copiar e colar',
      'filtro por Wesley Nunes',
      'gráfico de colunas agrupadas',
    ],
    planning_exam: [
      'CONT.SE',
      'ordenação decrescente',
      'PROCV de status',
      'tabela por DDD',
      'gráfico Pizza 3D',
      'média por zona',
      'percentual',
      'SE / condição lógica',
      'formatação condicional',
      'análise de vendas com PROCV e percentuais',
    ],
    advanced_exam: [
      'CONT.SE',
      'ordenação por cidade',
      'PROCV de status',
      'gráfico combinado com eixo secundário',
      'soma do RJ em F10',
      'análise completa de vendas',
      'totais e percentuais',
    ],
  };
  return caps[taskId] || ['atividade de planilha externa'];
}

function getTaskAnswerKey(taskId) {
  const keys = {
    basic_exam: [
      'Tabela copiada para G9',
      'Comentário inserido em A11',
      'Filtro aplicado',
      'Totais calculados com fórmula',
      'Itens visuais revisados pelo RH: linhas de grade e cor de preenchimento',
    ],
    qualid_exam: [
      'Planilha A em ordem alfabética por Operador',
      "Coluna F com título 'Valor Total'",
      'Valor Total = Valor (R$) x Quantidade',
      'PROCV preenchido na aba PROCV',
      'Operadores não encontrados listados a partir de BC255',
      'Resumo do supervisor Lula criado na aba TAB_DIN',
      'Tabela copiada e filtrada para Wesley Nunes',
      'Gráfico de colunas agrupadas criado com supervisores e março',
    ],
    planning_exam: [
      'CONT.SE preenchido por cidade e ordenado',
      'PROCV preenchido na aba Q2.',
      'Tabela por DDD e gráfico Pizza 3D',
      'Percentual e situação por zona',
      'Análise de vendas preenchida com totais e percentuais',
    ],
    advanced_exam: [
      'CONT.SE e ordenação por cidade',
      'PROCV preenchido',
      'Gráfico combinado com eixo secundário',
      'Soma do RJ em F10',
      'Análise de vendas completa',
    ],
  };
  return keys[taskId] || [];
}

/* =========================
   CAPTURA DE RESPOSTAS
========================= */

function captureCurrentAnswer() {
  const q = state.questions[state.currentIndex];

  if (q.type === 'word') {
    const editor = document.getElementById('word-editor');
    state.answers[state.currentIndex] = {
      type: 'word',
      content: editor ? editor.innerHTML : '',
    };
  }

  if (q.type === 'multiple') {
    const checked = document.querySelector('input[name="mcq"]:checked');
    state.answers[state.currentIndex] = {
      type: 'multiple',
      selected: checked ? parseInt(checked.value, 10) : null,
    };
  }

  if (q.type === 'excel_external') {
    if (!state.answers[state.currentIndex]) {
      state.answers[state.currentIndex] = {
        type: 'excel_external',
        uploaded: false,
        validation: null,
      };
    }
  }
}

function prevQuestion() {
  captureCurrentAnswer();
  if (state.currentIndex > 0) {
    state.currentIndex--;
    renderQuestion();
  }
}

function nextQuestion() {
  captureCurrentAnswer();
  if (state.currentIndex < state.questions.length - 1) {
    state.currentIndex++;
    renderQuestion();
  } else {
    finishExam();
  }
}

/* =========================
   AVALIAÇÃO DE WORD / MCQ
========================= */

function evaluateWord(answer, expected, points) {
  if (!answer || !answer.content) return 0;

  const html = answer.content;
  const plain = stripHtml(html);
  const upper = plain.toUpperCase();

  let score = 0;
  let totalWeight = 0;

  const checks = [
    expected.titleText
      ? { ok: upper.includes(expected.titleText.toUpperCase()), weight: 2 }
      : null,
    expected.titleBold
      ? { ok: /<(b|strong)[^>]*>.*?<\/(b|strong)>/is.test(html), weight: 1.5 }
      : null,
    expected.titleCenter
      ? { ok: /text-align:\s*center|align="center"/i.test(html), weight: 1.5 }
      : null,
    expected.minTextLength
      ? { ok: plain.length >= expected.minTextLength, weight: 1.5 }
      : null,
    expected.requiresList
      ? { ok: /<(ul|ol)[^>]*>/i.test(html), weight: 1.5 }
      : null,
    expected.minListItems
      ? {
          ok: countListItemsFromHtml(html) >= expected.minListItems,
          weight: 1.5,
        }
      : null,
    expected.anyBold
      ? { ok: /<(b|strong)[^>]*>.*?<\/(b|strong)>/is.test(html), weight: 1.2 }
      : null,
    expected.minSentences
      ? { ok: countSentences(plain) >= expected.minSentences, weight: 1.3 }
      : null,
  ].filter(Boolean);

  checks.forEach((item) => {
    totalWeight += item.weight;
    if (item.ok) score += item.weight;
  });

  if (!checks.length) return 0;
  return Math.round((score / totalWeight) * points);
}

function evaluateMultiple(answer, correctIndex, points) {
  return answer && answer.selected === correctIndex ? points : 0;
}

/* =========================
   GERAÇÃO DOS ARQUIVOS EXCEL
========================= */

function downloadExcelTask(questionIndex) {
  const q = state.questions[questionIndex];
  const task = buildWorkbookForTask(q.taskId, q.title);
  const filename = sanitizeFileName(
    `${q.taskId}_${state.candidate?.name || 'candidato'}.xlsx`,
  );
  XLSX.writeFile(task.workbook, filename);
}

function buildWorkbookForTask(taskId, title) {
  const wb = XLSX.utils.book_new();

  if (taskId === 'basic_exam') return buildBasicWorkbook(wb);
  if (taskId === 'qualid_exam') return buildQualidWorkbook(wb);
  if (taskId === 'planning_exam') return buildPlanningWorkbook(wb);
  if (taskId === 'advanced_exam') return buildAdvancedWorkbook(wb);

  const ws = aoaToSheet([['Arquivo de prova'], [title]]);
  XLSX.utils.book_append_sheet(wb, ws, 'Questão');
  return { workbook: wb };
}

function buildBasicWorkbook(wb) {
  const ws = aoaToSheet([]);
  appendRows(ws, [['Teste de conhecimentos de Excel']], 'B7');
  appendRows(
    ws,
    [
      ['Produto', 'Quantidade', 'Valor (R$)', 'Sub Total'],
      ['Processador', 2, 170, null],
      ['Indira', 4, 120, null],
      ['Placa mãe', 7, 250, null],
      ['TOTAL', null, null, null],
    ],
    'A9',
  );

  appendRows(
    ws,
    [
      ['1) Insira linhas de grade na planilha acima.'],
      ['2) Copie a planilha acima para a célula G9.'],
      ['3) Coloque o preenchimento Azul claro na célula D9.'],
      ['4) Insira um comentário na célula A11.'],
      ['5) Insira filtro na planilha.'],
      ['6) Calcule o total dos produtos inserindo fórmula.'],
    ],
    'A17',
  );

  XLSX.utils.book_append_sheet(wb, ws, 'Teste de Excel');
  return { workbook: wb };
}

function buildQualidWorkbook(wb) {
  const planilhaA = aoaToSheet([]);
  appendRows(planilhaA, QUALID_PLANILHA_A, 'A2');
  appendRows(
    planilhaA,
    [
      ["1) Coloque a tabela em ordem alfabética crescente por 'Operador';"],
      [
        "2) Insira uma nova coluna à direita de 'Quantidade' e nomeie como 'Valor Total'.",
      ],
      [
        "3) Calcule o 'Valor Total' multiplicando 'Valor (R$)' por 'Quantidade'.",
      ],
      ["4) Formate os resultados da mesma forma da coluna 'Valor (R$)'."],
    ],
    'A16',
  );
  XLSX.utils.book_append_sheet(wb, planilhaA, 'Planilha A');

  const procv = aoaToSheet([['Operador', 'Supervisor', 'Resultado do PROCV']]);
  PROCV_OPERADORES.forEach((nome, i) => {
    appendRows(procv, [[nome, '', '']], `A${i + 2}`);
  });
  appendRows(
    procv,
    [
      [
        '1) Utilize PROCV para localizar os supervisores existentes na Planilha A.',
      ],
      [
        '2) Liste, a partir da célula BC255, os operadores que não foram encontrados.',
      ],
    ],
    'A17',
  );
  XLSX.utils.book_append_sheet(wb, procv, 'PROCV');

  const tabdin = aoaToSheet([
    [
      '1) Crie abaixo, começando na célula A5, um resumo dos produtos do supervisor Lula, contendo o Valor Total desse supervisor.',
    ],
    ['A tabela será criada a partir da tabela da aba Planilha A.'],
  ]);
  XLSX.utils.book_append_sheet(wb, tabdin, 'TAB_DIN');

  const copiar = aoaToSheet([
    [
      '1) Copie a tabela trabalhada na Planilha A e cole a partir da célula A5. Depois, filtre para exibir apenas Wesley Nunes.',
    ],
  ]);
  XLSX.utils.book_append_sheet(wb, copiar, 'Copiar_Colar');

  const graf = aoaToSheet([
    ['META (R$)', 'Jan', 'Fev', 'Mar', 'Abr'],
    ['Angela', 5000, 2000, 6000, 5000],
    ['Barack', 3200, 2500, 4700, 4000],
    ['Lula', 5000, 2000, 6000, 5000],
    ['Tony', 2000, 1200, 3000, 3000],
    [],
    [
      '1) Crie um gráfico de colunas agrupadas com os supervisores e os valores do mês de março.',
    ],
  ]);
  XLSX.utils.book_append_sheet(wb, graf, 'Gráfico');

  return { workbook: wb };
}

function buildPlanningWorkbook(wb) {
  const q1 = aoaToSheet([
    ['Questão 1.'],
    [
      '* Utilize CONT.SE para descobrir quantos nomes foram listados para cada cidade abaixo.',
    ],
    ['* Organize em ordem decrescente de acordo com a quantidade de nomes.'],
    [],
    ['Cidade', 'Qtde de Nomes'],
    ...CIDADES_CONTSE.map((x) => [x[0], '']),
  ]);
  XLSX.utils.book_append_sheet(wb, q1, 'Q1.');

  const q2 = aoaToSheet([
    ['Questão 2.'],
    [
      'Com base na planilha Dados, utilize PROCV e localize o volume de cada um dos status abaixo.',
    ],
    [],
    ['Status da Chamada', 'Volume'],
    ...STATUS_VOLUME.map((x) => [x[0], '']),
  ]);
  XLSX.utils.book_append_sheet(wb, q2, 'Q2.');

  const q3 = aoaToSheet([
    ['Questão 3.'],
    [
      '* Crie uma tabela com todos os DDD e a quantidade de chamadas que cada um recebeu.',
    ],
    ['* Utilizando a tabela criada, insira um gráfico em Pizza 3D.'],
    ['* Título: Controle de Ligação por DDD.'],
    ['* Exibir rótulo em percentual na extremidade externa.'],
  ]);
  XLSX.utils.book_append_sheet(wb, q3, 'Q3.');

  const q4 = aoaToSheet([
    ['Questão 4.'],
    ['Calcule a média da quantidade de clientes por zona.'],
    ['Calcule o percentual de cada zona de acordo com o total de clientes.'],
    ['Utilize SE / lógica para identificar a situação de cada zona.'],
    ['Insira formatação condicional de acordo com a situação.'],
    [],
    ['Zonas', 'Qtde de Clientes', 'Percentual', 'Situação'],
    ...ZONAS.map((x) => [x[0], x[1], '', '']),
    ['Média', ''],
    ['', 2410],
  ]);
  XLSX.utils.book_append_sheet(wb, q4, 'Q4.');

  const q5 = aoaToSheet([
    ['Questão 5.'],
    ['Utilizando PROCV localize as informações dos status de venda.'],
    [
      'Calcule a quantidade não vendida, total de contatos, % de vendido e % não vendido.',
    ],
    [],
    [
      'OPERADOR',
      'VENDA ATENDENTE',
      'NÃO ATENDE',
      'CLIENTE INDISPONÍVEL',
      'OCUPADO',
      'FAX',
      'QTDE NÃO VENDIDA',
      'TOTAL DE CONTATOS',
      '% DE VENDIDO',
      '% NÃO VENDIDO',
    ],
    ...VENDAS_OPERADORES.map((x) => [x, '', '', '', '', '', '', '', '', '']),
  ]);
  XLSX.utils.book_append_sheet(wb, q5, 'Q5.');

  return { workbook: wb };
}

function buildAdvancedWorkbook(wb) {
  buildPlanningWorkbook(wb);

  const q6 = aoaToSheet([
    ['Questão 6.'],
    [
      'Crie um gráfico analítico com colunas para os indicadores gerais e linhas em eixo secundário para Nível de Serviço e % Aban.',
    ],
    [],
    ...GRAFICO_ANALITICO,
  ]);
  XLSX.utils.book_append_sheet(wb, q6, 'Q6.');

  const q7 = aoaToSheet([
    [
      'Questão 7: some todos os valores apenas do Estado do RJ e informe o resultado na célula F10.',
    ],
    [],
    ...MACRO_RJ,
  ]);
  XLSX.utils.book_append_sheet(wb, q7, 'Q7.');

  return { workbook: wb };
}

/* =========================
   UPLOAD E LEITURA DO EXCEL
========================= */

function handleExcelUpload(event, questionIndex) {
  const file = event.target.files[0];
  if (!file) return;

  const q = state.questions[questionIndex];
  const reader = new FileReader();

  reader.onload = function (e) {
    try {
      const arrayBuffer = e.target.result;
      const data = new Uint8Array(arrayBuffer);
      const wb = XLSX.read(data, {
        type: 'array',
        cellFormula: true,
        cellStyles: true,
        cellNF: true,
        cellHTML: false,
      });

      const result = validateWorkbookForTask(q.taskId, wb, q.points);

      state.answers[questionIndex] = {
        type: 'excel_external',
        uploaded: true,
        filename: file.name,
        validation: result,
        statusText:
          'Arquivo recebido com sucesso. O RH irá revisar o resultado.',
        statusClass: 'excel-status-ok',
        uploadedArrayBuffer: arrayBuffer,
      };

      if (state.currentIndex === questionIndex) renderQuestion();
    } catch (err) {
      state.answers[questionIndex] = {
        type: 'excel_external',
        uploaded: false,
        validation: null,
        statusText: 'Não foi possível ler o arquivo enviado.',
        statusClass: 'excel-status-error',
      };

      if (state.currentIndex === questionIndex) renderQuestion();
    }
  };

  reader.readAsArrayBuffer(file);
}

/* =========================
   VALIDAÇÃO DOS ARQUIVOS
========================= */

function validateWorkbookForTask(taskId, wb, points) {
  if (taskId === 'basic_exam') return validateBasicExam(wb, points);
  if (taskId === 'qualid_exam') return validateQualidExam(wb, points);
  if (taskId === 'planning_exam') return validatePlanningExam(wb, points);
  if (taskId === 'advanced_exam') return validateAdvancedExam(wb, points);
  return scoreResult(0, points, ['Validação não implementada.'], true);
}

/* ===== BASIC ===== */

function validateBasicExam(wb, points) {
  const ws = getSheet(wb, 'Teste de Excel');
  if (!ws)
    return scoreResult(
      0,
      points,
      ["Aba 'Teste de Excel' não encontrada."],
      true,
    );

  const completed = [];

  const copied =
    safeUpper(cellValue(ws, 'G9')) === 'PRODUTO' &&
    safeUpper(cellValue(ws, 'G10')) === 'PROCESSADOR';
  if (copied) completed.push('Tabela copiada para G9');

  if (hasComment(ws, 'A11')) completed.push('Comentário em A11');

  if (hasAutoFilter(ws)) completed.push('Filtro aplicado');

  const totalsFilled =
    cellValue(ws, 'B13') !== '' &&
    cellValue(ws, 'C13') !== '' &&
    cellValue(ws, 'D13') !== '';
  if (totalsFilled) completed.push('Totais preenchidos');

  const score = Math.round((completed.length / 4) * points);
  return scoreResult(
    score,
    points,
    [
      'Linhas de grade e preenchimento devem ser revisados manualmente pelo RH.',
    ],
    true,
    completed,
  );
}

/* ===== QUALID ===== */

function validateQualidExam(wb, points) {
  const completed = [];
  const notes = [];

  const planA = getSheet(wb, 'Planilha A');
  const procv = getSheet(wb, 'PROCV');
  const tabdin = getSheet(wb, 'TAB_DIN');
  const copiar = getSheet(wb, 'Copiar_Colar');
  const graf = getSheet(wb, 'Gráfico');

  if (planA) {
    const sortedOps = [];
    for (let r = 3; r <= 11; r++)
      sortedOps.push(String(cellValue(planA, `A${r}`)));
    const sortedCheck = [...sortedOps].sort((a, b) =>
      a.localeCompare(b, 'pt-BR'),
    );
    const headerOk = safeUpper(cellValue(planA, 'F2')) === 'VALOR TOTAL';
    const formulasFilled = Array.from(
      { length: 9 },
      (_, i) => cellValue(planA, `F${i + 3}`) !== '',
    ).every(Boolean);

    if (JSON.stringify(sortedOps) === JSON.stringify(sortedCheck))
      completed.push('Planilha A ordenada');
    if (headerOk) completed.push('Coluna Valor Total criada');
    if (formulasFilled) completed.push('Valor Total preenchido');
  }

  if (procv) {
    const procvFilled = Array.from(
      { length: 13 },
      (_, i) => cellValue(procv, `C${i + 2}`) !== '',
    ).some(Boolean);
    const missingListed = ['BC255', 'BC256', 'BC257', 'BC258'].some(
      (c) => cellValue(procv, c) !== '',
    );
    if (procvFilled) completed.push('PROCV preenchido');
    if (missingListed) completed.push('Não encontrados listados em BC255');
  }

  if (tabdin) {
    const tabdinFilled = ['A5', 'B5', 'C5', 'A6', 'B6', 'C6'].some(
      (c) => cellValue(tabdin, c) !== '',
    );
    if (tabdinFilled) completed.push('Resumo do supervisor Lula');
  }

  if (copiar) {
    const copyFilled = safeUpper(cellValue(copiar, 'A5')) === 'OPERADOR';
    if (copyFilled) completed.push('Tabela copiada/filtrada');
  }

  if (graf) {
    completed.push('Gráfico sinalizado para revisão');
    notes.push(
      'O gráfico de colunas agrupadas deve ser revisado visualmente pelo RH.',
    );
  }

  const totalTasks = 8;
  const score = Math.round((completed.length / totalTasks) * points);
  return scoreResult(score, points, notes, true, completed);
}

/* ===== PLANNING ===== */

function validatePlanningExam(wb, points) {
  const completed = [];
  const notes = [];

  const q1 = getSheet(wb, 'Q1.');
  const q2 = getSheet(wb, 'Q2.');
  const q3 = getSheet(wb, 'Q3.');
  const q4 = getSheet(wb, 'Q4.');
  const q5 = getSheet(wb, 'Q5.');

  if (q1) {
    const filled =
      Array.from(
        { length: 12 },
        (_, i) => cellValue(q1, `B${i + 6}`) !== '',
      ).filter(Boolean).length >= 8;
    if (filled) completed.push('CONT.SE por cidade preenchido');
  }

  if (q2) {
    const filled =
      Array.from(
        { length: 16 },
        (_, i) => cellValue(q2, `B${i + 5}`) !== '',
      ).filter(Boolean).length >= 10;
    if (filled) completed.push('PROCV de status preenchido');
  }

  if (q3) {
    completed.push('Questão de DDD / gráfico sinalizada');
    notes.push(
      'Tabela por DDD e gráfico Pizza 3D devem ser revisados visualmente pelo RH.',
    );
  }

  if (q4) {
    const percentuais =
      Array.from(
        { length: 9 },
        (_, i) => cellValue(q4, `C${i + 8}`) !== '',
      ).filter(Boolean).length >= 6;
    const situacoes =
      Array.from(
        { length: 9 },
        (_, i) => cellValue(q4, `D${i + 8}`) !== '',
      ).filter(Boolean).length >= 6;
    if (percentuais) completed.push('Percentuais por zona preenchidos');
    if (situacoes) completed.push('Situação por zona preenchida');
    notes.push('Formatação condicional deve ser revisada visualmente pelo RH.');
  }

  if (q5) {
    const vendas =
      Array.from(
        { length: 13 },
        (_, i) =>
          cellValue(q5, `B${i + 6}`) !== '' ||
          cellValue(q5, `H${i + 6}`) !== '',
      ).filter(Boolean).length >= 8;
    if (vendas) completed.push('Análise de vendas preenchida');
  }

  const totalTasks = 6;
  const score = Math.round((completed.length / totalTasks) * points);
  return scoreResult(score, points, notes, true, completed);
}

/* ===== ADVANCED ===== */

function validateAdvancedExam(wb, points) {
  const completed = [];
  const notes = [];

  const q1 = getSheet(wb, 'Q1.');
  const q2 = getSheet(wb, 'Q2.');
  const q5 = getSheet(wb, 'Q5.');
  const q6 = getSheet(wb, 'Q6.');
  const q7 = getSheet(wb, 'Q7.');

  if (q1) {
    const filled =
      Array.from(
        { length: 12 },
        (_, i) => cellValue(q1, `B${i + 6}`) !== '',
      ).filter(Boolean).length >= 8;
    if (filled) completed.push('CONT.SE / cidades preenchido');
  }

  if (q2) {
    const filled =
      Array.from(
        { length: 16 },
        (_, i) => cellValue(q2, `B${i + 5}`) !== '',
      ).filter(Boolean).length >= 10;
    if (filled) completed.push('PROCV de status preenchido');
  }

  if (q5) {
    const vendas =
      Array.from(
        { length: 13 },
        (_, i) =>
          cellValue(q5, `B${i + 6}`) !== '' ||
          cellValue(q5, `H${i + 6}`) !== '',
      ).filter(Boolean).length >= 8;
    if (vendas) completed.push('Análise de vendas preenchida');
  }

  if (q6) {
    completed.push('Gráfico combinado sinalizado para revisão');
    notes.push(
      'Gráfico combinado e eixo secundário devem ser revisados visualmente pelo RH.',
    );
  }

  if (q7) {
    if (cellValue(q7, 'F10') !== '') completed.push('Soma do RJ em F10');
  }

  const totalTasks = 5;
  const score = Math.round((completed.length / totalTasks) * points);
  return scoreResult(score, points, notes, true, completed);
}

/* =========================
   FINALIZAÇÃO DA PROVA
========================= */

function finishExam() {
  if (state.finished) return;
  captureCurrentAnswer();
  clearInterval(state.timerHandle);
  state.finished = true;

  const results = state.questions.map((q, i) => {
    const ans = state.answers[i];
    let score = 0;
    let notes = [];
    let pendingManual = false;
    let completedTasks = [];

    if (q.type === 'word') {
      score = evaluateWord(ans, q.expected, q.points);
    }

    if (q.type === 'multiple') {
      score = evaluateMultiple(ans, q.answer, q.points);
    }

    if (q.type === 'excel_external') {
      if (ans && ans.validation) {
        score = ans.validation.score;
        notes = ans.validation.notes || [];
        pendingManual = !!ans.validation.pendingManual;
        completedTasks = ans.validation.completedTasks || [];
      } else {
        score = 0;
        notes = ['Arquivo não enviado ou não analisado.'];
      }
    }

    return {
      stage: q.stage,
      title: q.title,
      score,
      max: q.points,
      notes,
      pendingManual,
      completedTasks,
      answerKey: q.type === 'excel_external' ? getTaskAnswerKey(q.taskId) : [],
    };
  });

  state.finalResults = results;
  state.totalScore = results.reduce((sum, item) => sum + item.score, 0);
  state.totalMax = results.reduce((sum, item) => sum + item.max, 0);
  state.manualReviewItems = results.filter((x) => x.pendingManual);

  renderResults();
  showScreen('screen-thanks');
}

/* =========================
   RESULTADOS / RH
========================= */

function renderResults() {
  document.getElementById('result-name').textContent = state.candidate.name;
  document.getElementById('result-role').textContent = state.candidate.role;
  document.getElementById('result-score').textContent =
    `${state.totalScore}/${state.totalMax}`;

  const grouped = {};
  state.finalResults.forEach((item) => {
    if (!grouped[item.stage])
      grouped[item.stage] = { score: 0, max: 0, titles: [], pendings: [] };
    grouped[item.stage].score += item.score;
    grouped[item.stage].max += item.max;
    grouped[item.stage].titles.push(item.title);
    if (item.pendingManual) grouped[item.stage].pendings.push(item.title);
  });

  const box = document.getElementById('stage-results');
  box.innerHTML = Object.entries(grouped)
    .map(
      ([stage, data]) => `
    <div class="col-md-6">
      <div class="result-item h-100">
        <div class="text-muted mb-1">${stage}</div>
        <div class="fw-bold">${data.titles.length} questões avaliadas</div>
        <div class="mt-2 fs-5 ${data.score >= data.max * 0.7 ? 'text-success' : 'text-warning'}">${data.score}/${data.max}</div>
        ${data.pendings.length ? `<div class="small text-muted mt-2">Pendências de revisão: ${data.pendings.length}</div>` : ''}
      </div>
    </div>
  `,
    )
    .join('');

  const manualBox = document.getElementById('manual-review-box');
  if (!state.manualReviewItems.length) {
    manualBox.innerHTML = `<div class="text-muted">Nenhuma pendência.</div>`;
  } else {
    manualBox.innerHTML = `
      ${state.manualReviewItems
        .map(
          (item) => `
        <div class="mb-4">
          <div><strong>${item.title}</strong></div>
          ${
            item.completedTasks?.length
              ? `
            <div class="small text-muted mt-2"><strong>Tarefas concluídas detectadas:</strong></div>
            <ul class="small text-muted">
              ${item.completedTasks.map((x) => `<li>${x}</li>`).join('')}
            </ul>
          `
              : ''
          }
          ${
            item.answerKey?.length
              ? `
            <div class="small text-muted mt-2"><strong>Gabarito / checklist do RH:</strong></div>
            <ul class="small text-muted">
              ${item.answerKey.map((x) => `<li>${x}</li>`).join('')}
            </ul>
          `
              : ''
          }
          ${item.notes?.length ? `<div class="small text-muted">${item.notes.join(' | ')}</div>` : ''}
        </div>
      `,
        )
        .join('')}
    `;
  }
}

function saveResult() {
  const notesEl = document.getElementById('rh-notes');
  const notes = notesEl ? notesEl.value.trim() : '';

  const payload = {
    candidate: state.candidate,
    results: state.finalResults,
    totalScore: state.totalScore,
    totalMax: state.totalMax,
    manualReviewItems: state.manualReviewItems,
    notes,
    savedAt: new Date().toLocaleString('pt-BR'),
  };

  const history = JSON.parse(localStorage.getItem('rh_exam_results') || '[]');
  history.push(payload);
  localStorage.setItem('rh_exam_results', JSON.stringify(history));

  document.getElementById('save-alert').classList.remove('d-none');
}

function saveCompleteResult() {
  const notes = document.getElementById('rh-notes')?.value?.trim() || '';
  const payload = {
    candidate: state.candidate,
    results: state.finalResults,
    totalScore: state.totalScore,
    totalMax: state.totalMax,
    manualReviewItems: state.manualReviewItems,
    notes,
    savedAt: new Date().toLocaleString('pt-BR'),
  };

  const reportText = [
    `Candidato: ${payload.candidate.name}`,
    `Perfil: ${payload.candidate.role}`,
    `Nível: ${payload.candidate.level}`,
    `Pontuação: ${payload.totalScore}/${payload.totalMax}`,
    `Data: ${payload.savedAt}`,
    '',
    '=== RESULTADOS ===',
    ...payload.results.map((r) =>
      [
        `${r.stage} - ${r.title}`,
        `Pontuação: ${r.score}/${r.max}`,
        r.completedTasks?.length
          ? `Tarefas concluídas: ${r.completedTasks.join('; ')}`
          : '',
        r.answerKey?.length ? `Gabarito RH: ${r.answerKey.join('; ')}` : '',
        r.notes?.length ? `Observações: ${r.notes.join('; ')}` : '',
        '',
      ].join('\n'),
    ),
    notes ? `Observações do RH: ${notes}` : '',
  ].join('\n');

  downloadTextFile(
    `resultado_${sanitizeFileName(payload.candidate.name)}.txt`,
    reportText,
  );

  state.answers.forEach((ans) => {
    if (ans?.uploadedArrayBuffer && ans?.filename) {
      const blob = new Blob([ans.uploadedArrayBuffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      downloadBlob(ans.filename, blob);
    }
  });
}

function downloadTextFile(filename, content) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  downloadBlob(filename, blob);
}

function downloadBlob(filename, blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function openAdminResult() {
  const pass = document.getElementById('admin-pass').value.trim();
  const alert = document.getElementById('admin-alert');

  if (pass !== RH_PASS) {
    alert.textContent = 'Senha do RH inválida.';
    alert.classList.remove('d-none');
    return;
  }

  alert.classList.add('d-none');
  showScreen('screen-result');
}

function printResult() {
  window.print();
}

function backToConfig() {
  document.getElementById('candidate-name').value = '';
  document.getElementById('candidate-role').value = '';
  document.getElementById('candidate-level').value = '';
  document.getElementById('candidate-time').value = '40';
  document.getElementById('rh-notes').value = '';
  document.getElementById('admin-pass').value = '';
  document.getElementById('save-alert').classList.add('d-none');
  showScreen('screen-config');
}
