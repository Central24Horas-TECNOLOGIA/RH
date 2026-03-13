const RH_USER = 'rh';
const RH_PASS = '1234';

const state = {
  logged: false,
  candidate: null,
  blueprint: null,
  questions: [],
  currentIndex: 0,
  answers: [],
  timerSeconds: 0,
  timerHandle: null,
  finished: false,
  finalResults: [],
  totalScore: 0,
  totalMax: 0,
  weightedFinalScore: 0,
  stageSummary: [],
  manualReviewItems: [],
};

document.addEventListener('DOMContentLoaded', () => {
  const roleEl = document.getElementById('candidate-role');
  const levelEl = document.getElementById('candidate-level');
  const trackEl = document.getElementById('candidate-track');

  if (roleEl) {
    roleEl.addEventListener('change', function () {
      const suggestedLevel = ROLE_LEVEL_SUGGESTIONS[this.value];
      if (suggestedLevel && levelEl) levelEl.value = suggestedLevel;
      if (this.value === 'Estagiário' && !trackEl.value) trackEl.value = 'ti';
      if (
        (this.value === 'Analista' || this.value === 'Outros') &&
        !trackEl.value
      )
        trackEl.value = 'adm';
      if (this.value === 'TI') trackEl.value = 'ti';
      if (this.value === 'Supervisor') trackEl.value = 'operacao';
      if (this.value === 'Help Desk' || this.value === 'Planejamento')
        trackEl.value = 'adm';
      updateFlowPreview();
    });
  }
  if (levelEl) levelEl.addEventListener('change', updateFlowPreview);
  if (trackEl) trackEl.addEventListener('change', updateFlowPreview);
  updateFlowPreview();
});

function showScreen(id) {
  document
    .querySelectorAll('.screen')
    .forEach((s) => s.classList.remove('active'));
  const target = document.getElementById(id);
  if (target) target.classList.add('active');
}

function sanitizeFileName(name) {
  return String(name).replace(/[^\w\-\.À-ÿ]/g, '_');
}

function safeUpper(v) {
  return String(v || '')
    .trim()
    .toUpperCase();
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

function updateFlowPreview() {
  const role = document.getElementById('candidate-role')?.value || '';
  const level = document.getElementById('candidate-level')?.value || '';
  const track = document.getElementById('candidate-track')?.value || '';
  const box = document.getElementById('flow-preview');
  if (!box) return;
  if (!role && !level) {
    box.textContent = 'Selecione a vaga para visualizar a trilha.';
    return;
  }
  const blueprint = resolveExamBlueprint(role, level, track);
  box.innerHTML = `
    <div class="mb-2"><strong>${blueprint.label}</strong></div>
    <div>${blueprint.stages.map((s) => `${STAGE_LABELS[s.key]} (${s.weight}%)`).join(' → ')}</div>
  `;
}

function doLogin() {
  const user = document.getElementById('login-user')?.value.trim() || '';
  const pass = document.getElementById('login-pass')?.value.trim() || '';
  const alertEl = document.getElementById('login-alert');

  if (user === RH_USER && pass === RH_PASS) {
    state.logged = true;
    alertEl?.classList.add('d-none');
    showScreen('screen-config');
  } else if (alertEl) {
    alertEl.textContent = 'Usuário ou senha inválidos.';
    alertEl.classList.remove('d-none');
  }
}

function logout() {
  clearInterval(state.timerHandle);
  state.logged = false;
  state.finished = false;
  showScreen('screen-login');
}

function proceedToCandidate() {
  const role = document.getElementById('candidate-role').value.trim();
  const level = document.getElementById('candidate-level').value;
  const track = document.getElementById('candidate-track').value.trim();
  const time = parseInt(document.getElementById('candidate-time').value, 10);
  const alert = document.getElementById('config-alert');

  if (!role || !level || !time) {
    alert.textContent = 'Preencha os campos da configuração para prosseguir.';
    alert.classList.remove('d-none');
    return;
  }

  alert.classList.add('d-none');
  const blueprint = resolveExamBlueprint(role, level, track);
  state.candidate = {
    ...(state.candidate || {}),
    role,
    level,
    time,
    track: track || 'automático',
  };
  state.blueprint = blueprint;

  const rolePreview = document.getElementById('candidate-role-preview');
  if (rolePreview) rolePreview.value = `${role} • ${blueprint.label}`;
  renderCandidateRules();
  showScreen('screen-candidate');
}

function renderCandidateRules() {
  const box = document.getElementById('candidate-rules-summary');
  if (!box || !state.blueprint) return;
  box.innerHTML = `<ul class="candidate-summary-list">${state.blueprint.stages.map((stage) => `<li><strong>${STAGE_LABELS[stage.key]}</strong>: serão avaliados os conteúdos previstos para esta etapa da vaga.</li>`).join('')}</ul>`;
}

function startExam() {
  const name = document.getElementById('candidate-name').value.trim();
  const role =
    state.candidate?.role ||
    document.getElementById('candidate-role').value.trim();
  const level =
    state.candidate?.level || document.getElementById('candidate-level').value;
  const track =
    state.candidate?.track ||
    document.getElementById('candidate-track').value.trim();
  const time = parseInt(
    state.candidate?.time || document.getElementById('candidate-time').value,
    10,
  );
  const alert = document.getElementById('candidate-alert');

  if (!name) {
    alert.textContent = 'Informe o nome do candidato para iniciar a prova.';
    alert.classList.remove('d-none');
    return;
  }

  const blueprint = state.blueprint || resolveExamBlueprint(role, level, track);

  if (alert) alert.classList.add('d-none');
  state.candidate = { name, role, level, time, track: track || 'automático' };
  state.blueprint = blueprint;
  state.questions = buildExamFromBlueprint(blueprint);
  state.currentIndex = 0;
  state.answers = new Array(state.questions.length).fill(null);
  state.timerSeconds = time * 60;
  state.finished = false;
  state.finalResults = [];
  state.totalScore = 0;
  state.totalMax = 0;
  state.weightedFinalScore = 0;
  state.stageSummary = [];
  state.manualReviewItems = [];

  const examCandidateEl = document.getElementById('exam-candidate');
  const examRoleEl = document.getElementById('exam-role');
  const examTrackEl = document.getElementById('exam-track');
  if (examCandidateEl) examCandidateEl.textContent = name;
  if (examRoleEl) examRoleEl.textContent = role;
  if (examTrackEl) examTrackEl.textContent = blueprint.label;

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

function renderQuestion() {
  const q = state.questions[state.currentIndex];
  document.getElementById('stage-badge').textContent = q.stage;
  document.getElementById('question-title').textContent = q.title;
  document.getElementById('question-description').textContent = q.description;
  const pointsBox = document.getElementById('question-points');
  if (pointsBox) {
    pointsBox.textContent = '';
    pointsBox.classList.add('hidden-for-candidate');
  }

  const progress = ((state.currentIndex + 1) / state.questions.length) * 100;
  document.getElementById('progress-bar').style.width = `${progress}%`;
  document.getElementById('progress-text').textContent =
    `Questão ${state.currentIndex + 1} de ${state.questions.length}`;

  const prevBtn = document.getElementById('prev-btn');
  const nextBtn = document.getElementById('next-btn');
  prevBtn.disabled = state.currentIndex === 0;
  nextBtn.textContent =
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
    <div class="card border-0 bg-light"><div class="card-body">
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
    </div></div>
  `;
}

function renderExcelExternalQuestion(area, q) {
  const ans = state.answers[state.currentIndex] || {};
  const uploadId = `excel-file-input-${state.currentIndex}`;
  area.innerHTML = `
    <div class="excel-card">
      <div class="row g-3">
        <div class="col-lg-7">
          <div class="excel-step mb-3">
            <h4 class="h6 fw-bold">Como funciona esta etapa</h4>
            <ol class="mb-0">
              <li>Baixe a planilha desta etapa.</li>
              <li>Abra no LibreOffice Calc ou Excel.</li>
              <li>Realize todas as atividades descritas.</li>
              <li>Salve o arquivo e envie abaixo.</li>
            </ol>
          </div>
          <div class="d-flex flex-wrap gap-2 mb-3">
            <button class="btn btn-success" onclick="downloadExcelTask(${state.currentIndex})">Baixar arquivo .xlsx</button>
          </div>
          <div class="excel-step">
            <h4 class="h6 fw-bold">O que será testado neste arquivo</h4>
            <ul class="muted-list">${getTaskCapabilities(q.taskId)
              .map((item) => `<li>${item}</li>`)
              .join('')}</ul>
          </div>
        </div>
        <div class="col-lg-5">
          <div class="excel-upload-box">
            <label class="form-label fw-semibold">Enviar arquivo respondido</label>
            <input id="${uploadId}" class="upload-hidden-input" type="file" accept=".xlsx,.xlsm" onchange="handleExcelUpload(event, ${state.currentIndex})">
            <div class="d-grid gap-2"><button type="button" class="btn btn-outline-secondary" onclick="document.getElementById('${uploadId}').click()">Selecionar arquivo</button></div>
            <span class="upload-file-name">${ans.filename ? `Arquivo selecionado: ${ans.filename}` : 'Nenhum arquivo selecionado.'}</span>
            <div id="excel-upload-status" class="${ans.statusClass || 'text-muted'} mt-2">${ans.statusText || 'Nenhum arquivo enviado ainda.'}</div>
            <div class="small text-muted mt-2">Formatos aceitos: .xlsx e .xlsm</div>
          </div>
        </div>
      </div>
    </div>`;
}

function formatDoc(command) {
  document.execCommand(command, false, null);
  const editor = document.getElementById('word-editor');
  if (editor) editor.focus();
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
      'Coluna F com título Valor Total',
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
  if (q.type === 'excel_external' && !state.answers[state.currentIndex]) {
    state.answers[state.currentIndex] = {
      type: 'excel_external',
      uploaded: false,
      validation: null,
    };
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

function appendBaseDataSheets(wb) {
  if (typeof EXCEL_BASE_DATA === 'undefined') return;
  Object.entries(EXCEL_BASE_DATA).forEach(([sheetName, rows]) => {
    const safeName = `Base - ${sheetName}`.slice(0, 31);
    if (wb.SheetNames.includes(safeName)) return;
    const ws = aoaToSheet(
      rows.map((row) => row.map((cell) => (cell === undefined ? null : cell))),
    );
    XLSX.utils.book_append_sheet(wb, ws, safeName);
  });
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
  PROCV_OPERADORES.forEach((nome, i) =>
    appendRows(procv, [[nome, '', '']], `A${i + 2}`),
  );
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
  appendBaseDataSheets(wb);
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
  appendBaseDataSheets(wb);
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
          'Arquivo recebido com sucesso. O RH poderá revisar os itens visuais.',
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

function validateWorkbookForTask(taskId, wb, points) {
  if (taskId === 'basic_exam') return validateBasicExam(wb, points);
  if (taskId === 'qualid_exam') return validateQualidExam(wb, points);
  if (taskId === 'planning_exam') return validatePlanningExam(wb, points);
  if (taskId === 'advanced_exam') return validateAdvancedExam(wb, points);
  return scoreResult(0, points, ['Validação não implementada.'], true);
}

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
    if (JSON.stringify(sortedOps) === JSON.stringify(sortedCheck))
      completed.push('Planilha A ordenada');
    if (safeUpper(cellValue(planA, 'F2')) === 'VALOR TOTAL')
      completed.push('Coluna Valor Total criada');
    const formulasFilled = Array.from(
      { length: 9 },
      (_, i) => cellValue(planA, `F${i + 3}`) !== '',
    ).every(Boolean);
    if (formulasFilled) completed.push('Valor Total preenchido');
  }
  if (procv) {
    const procvFilled = Array.from(
      { length: 13 },
      (_, i) => cellValue(procv, `C${i + 2}`) !== '',
    ).some(Boolean);
    if (procvFilled) completed.push('PROCV preenchido');
    const missingListed = ['BC255', 'BC256', 'BC257', 'BC258'].some(
      (c) => cellValue(procv, c) !== '',
    );
    if (missingListed) completed.push('Não encontrados listados em BC255');
  }
  if (tabdin) {
    const tabdinFilled = ['A5', 'B5', 'C5', 'A6', 'B6', 'C6'].some(
      (c) => cellValue(tabdin, c) !== '',
    );
    if (tabdinFilled) completed.push('Resumo do supervisor Lula');
  }
  if (copiar && safeUpper(cellValue(copiar, 'A5')) === 'OPERADOR')
    completed.push('Tabela copiada/filtrada');
  if (graf) {
    completed.push('Gráfico sinalizado para revisão');
    notes.push('O gráfico deve ser revisado visualmente pelo RH.');
  }
  return scoreResult(
    Math.round((completed.length / 8) * points),
    points,
    notes,
    true,
    completed,
  );
}

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
  return scoreResult(
    Math.round((completed.length / 6) * points),
    points,
    notes,
    true,
    completed,
  );
}

function validateAdvancedExam(wb, points) {
  const base = validatePlanningExam(wb, points);
  const q6 = getSheet(wb, 'Q6.');
  const q7 = getSheet(wb, 'Q7.');
  const completed = [...(base.completedTasks || [])];
  const notes = [...(base.notes || [])];
  if (q6) {
    completed.push('Gráfico combinado sinalizado para revisão');
    notes.push(
      'Gráfico combinado e eixo secundário devem ser revisados visualmente pelo RH.',
    );
  }
  if (q7 && cellValue(q7, 'F10') !== '') completed.push('Soma do RJ em F10');
  return scoreResult(
    Math.round((completed.length / 8) * points),
    points,
    notes,
    true,
    completed,
  );
}

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
    if (q.type === 'word') score = evaluateWord(ans, q.expected, q.points);
    if (q.type === 'multiple')
      score = evaluateMultiple(ans, q.answer, q.points);
    if (q.type === 'excel_external') {
      if (ans && ans.validation) {
        score = ans.validation.score;
        notes = ans.validation.notes || [];
        pendingManual = !!ans.validation.pendingManual;
        completedTasks = ans.validation.completedTasks || [];
      } else {
        notes = ['Arquivo não enviado ou não analisado.'];
      }
    }
    return {
      stageKey: q.stageKey,
      stage: q.stage,
      stageWeight: q.stageWeight,
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
  state.stageSummary = computeStageSummary(results, state.blueprint);
  state.weightedFinalScore = Number(
    state.stageSummary
      .reduce((sum, item) => sum + item.weightedScore, 0)
      .toFixed(2),
  );

  renderResults();
  showScreen('screen-thanks');
}

function computeStageSummary(results, blueprint) {
  return blueprint.stages.map((stage) => {
    const stageResults = results.filter((r) => r.stageKey === stage.key);
    const rawScore = stageResults.reduce((s, x) => s + x.score, 0);
    const rawMax = stageResults.reduce((s, x) => s + x.max, 0);
    const percent = rawMax ? rawScore / rawMax : 0;
    const weightedScore = percent * stage.weight * 0.1;
    return {
      key: stage.key,
      label: STAGE_LABELS[stage.key],
      weight: stage.weight,
      rawScore,
      rawMax,
      percent,
      weightedScore,
      questionCount: stageResults.length,
      pendings: stageResults.filter((x) => x.pendingManual).length,
    };
  });
}

function renderResults() {
  document.getElementById('result-name').textContent = state.candidate.name;
  document.getElementById('result-role').textContent = state.candidate.role;
  document.getElementById('result-level').textContent =
    `${state.candidate.level} • ${state.blueprint.label}`;
  document.getElementById('result-score').textContent =
    state.weightedFinalScore.toFixed(2);

  const box = document.getElementById('stage-results');
  box.innerHTML = state.stageSummary
    .map((data) => {
      const cls =
        data.percent >= 0.7 ? 'good' : data.percent >= 0.4 ? 'warn' : 'bad';
      return `
      <div class="col-md-6">
        <div class="result-item h-100">
          <div class="d-flex justify-content-between align-items-center gap-2 mb-1">
            <div class="text-muted">${data.label}</div>
            <span class="weight-badge">Peso ${data.weight}%</span>
          </div>
          <div class="fw-bold">${data.questionCount} item(ns) avaliados</div>
          <div class="mt-2 stage-card-score ${cls} fs-5">${data.rawScore}/${data.rawMax}</div>
          <div class="small text-muted mt-1">Aproveitamento: ${(data.percent * 100).toFixed(1)}% • Nota ponderada: ${data.weightedScore.toFixed(2)}</div>
          ${data.pendings ? `<div class="small text-muted mt-2">Pendências de revisão: ${data.pendings}</div>` : ''}
        </div>
      </div>`;
    })
    .join('');

  const manualBox = document.getElementById('manual-review-box');
  if (!state.manualReviewItems.length) {
    manualBox.innerHTML = `<div class="text-muted">Nenhuma pendência.</div>`;
  } else {
    manualBox.innerHTML = state.manualReviewItems
      .map(
        (item) => `
      <div class="mb-4">
        <div><strong>${item.title}</strong></div>
        ${item.completedTasks?.length ? `<div class="small text-muted mt-2"><strong>Resultado automático:</strong></div><ul class="small text-muted">${item.completedTasks.map((x) => `<li>${x}</li>`).join('')}</ul>` : ''}
        ${item.answerKey?.length ? `<div class="small text-muted mt-2"><strong>Checklist do RH:</strong></div><ul class="small text-muted">${item.answerKey.map((x) => `<li>${x}</li>`).join('')}</ul>` : ''}
        ${item.notes?.length ? `<div class="small text-muted">${item.notes.join(' | ')}</div>` : ''}
      </div>`,
      )
      .join('');
  }
}

function getQuestionExpectedAnswerText(q) {
  if (q.type === 'multiple')
    return q.options && q.options[q.answer] !== undefined
      ? `Resposta correta: ${q.options[q.answer]}`
      : 'Resposta correta: não identificada';
  if (q.type === 'word') {
    const expected = [];
    if (q.expected?.titleText)
      expected.push(`Título esperado: ${q.expected.titleText}`);
    if (q.expected?.minTextLength)
      expected.push(`Texto mínimo: ${q.expected.minTextLength} caracteres`);
    if (q.expected?.minSentences)
      expected.push(`Frases mínimas: ${q.expected.minSentences}`);
    if (q.expected?.requiresList) expected.push('Deve conter lista');
    if (q.expected?.minListItems)
      expected.push(`Itens mínimos na lista: ${q.expected.minListItems}`);
    if (q.expected?.titleBold) expected.push('Título em negrito');
    if (q.expected?.titleCenter) expected.push('Título centralizado');
    if (q.expected?.anyBold)
      expected.push('Deve conter ao menos um trecho em negrito');
    return expected.length
      ? expected.join(' | ')
      : 'Critérios práticos definidos no sistema.';
  }
  if (q.type === 'excel_external') {
    const key = getTaskAnswerKey(q.taskId);
    return key.length ? key.join(' | ') : 'Checklist prático do Excel.';
  }
  return '';
}

function getCandidateAnswerText(q, ans) {
  if (!ans) return 'Sem resposta.';
  if (q.type === 'multiple')
    return ans.selected === null || ans.selected === undefined
      ? 'Sem resposta.'
      : (q.options?.[ans.selected] ?? `Opção ${ans.selected}`);
  if (q.type === 'word') return stripHtml(ans.content || '') || 'Sem resposta.';
  if (q.type === 'excel_external') {
    const parts = [];
    parts.push(
      ans.filename
        ? `Arquivo enviado: ${ans.filename}`
        : 'Arquivo não enviado.',
    );
    if (ans.validation?.completedTasks?.length)
      parts.push(
        `Itens detectados: ${ans.validation.completedTasks.join('; ')}`,
      );
    if (ans.validation?.notes?.length)
      parts.push(`Observações: ${ans.validation.notes.join('; ')}`);
    return parts.join(' | ');
  }
  return 'Sem resposta.';
}

function buildFullAnswerKeyText() {
  const lines = [
    `Candidato: ${state.candidate.name}`,
    `Perfil: ${state.candidate.role}`,
    `Nível: ${state.candidate.level}`,
    `Nota final: ${state.weightedFinalScore?.toFixed ? state.weightedFinalScore.toFixed(2) : state.totalScore}/${state.totalMax}`,
    `Data: ${new Date().toLocaleString('pt-BR')}`,
    '',
    '=== GABARITO COMPLETO ===',
  ];

  state.questions.forEach((q, idx) => {
    const ans = state.answers[idx];
    const result = state.finalResults[idx];
    lines.push(`Questão ${idx + 1}`);
    lines.push(`Etapa: ${q.stage}`);
    lines.push(`Título: ${q.title}`);
    lines.push(`Enunciado: ${q.description}`);
    lines.push(`Gabarito / critério: ${getQuestionExpectedAnswerText(q)}`);
    lines.push(`Resposta do candidato: ${getCandidateAnswerText(q, ans)}`);
    if (result) lines.push(`Pontuação obtida: ${result.score}/${result.max}`);
    lines.push('');
  });

  return lines.join('\n');
}
function downloadBlob(filename, blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1000);
}
async function downloadExamPackage() {
  try {
    if (typeof JSZip === 'undefined') {
      alert('Não foi possível gerar o pacote automaticamente neste navegador.');
      return;
    }

    if (!state?.candidate?.name) {
      alert('Nome do candidato não encontrado.');
      return;
    }

    const zip = new JSZip();

    const answerKeyText = buildFullAnswerKeyText();
    zip.file(
      `gabarito_${sanitizeFileName(state.candidate.name)}.txt`,
      answerKeyText || 'Sem conteúdo de gabarito disponível.',
    );

    let excelCount = 0;

    state.answers.forEach((ans, index) => {
      if (!ans) return;

      if (ans.uploadedArrayBuffer && ans.filename) {
        zip.file(
          `excel_respondido_${index + 1}_${sanitizeFileName(ans.filename)}`,
          ans.uploadedArrayBuffer,
        );
        excelCount++;
        return;
      }

      if (ans.uploadedFile instanceof File) {
        zip.file(
          `excel_respondido_${index + 1}_${sanitizeFileName(ans.uploadedFile.name)}`,
          ans.uploadedFile,
        );
        excelCount++;
      }
    });

    if (excelCount === 0) {
      console.warn(
        'Nenhum arquivo de Excel foi encontrado para incluir no pacote.',
      );
    }

    const blob = await zip.generateAsync({ type: 'blob' });

    if (!blob || blob.size === 0) {
      alert('Não foi possível gerar o arquivo ZIP.');
      return;
    }

    downloadBlob(`prova_${sanitizeFileName(state.candidate.name)}.zip`, blob);
  } catch (error) {
    console.error('Erro ao gerar pacote da prova:', error);
    alert('Ocorreu um erro ao baixar o pacote da prova.');
  }
}

function saveResult() {
  const notes = '';
  const payload = {
    candidate: state.candidate,
    blueprint: state.blueprint,
    results: state.finalResults,
    stageSummary: state.stageSummary,
    totalScore: state.totalScore,
    totalMax: state.totalMax,
    weightedFinalScore: state.weightedFinalScore,
    manualReviewItems: state.manualReviewItems,
    notes,
    savedAt: new Date().toLocaleString('pt-BR'),
  };
  const history = JSON.parse(localStorage.getItem('rh_exam_results') || '[]');
  history.push(payload);
  localStorage.setItem('rh_exam_results', JSON.stringify(history));
  document.getElementById('save-alert').classList.remove('d-none');
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
  const currentScreenCandidate = document.getElementById('screen-candidate');
  const isCandidateScreen =
    currentScreenCandidate &&
    currentScreenCandidate.classList.contains('active');
  if (isCandidateScreen) {
    showScreen('screen-config');
    return;
  }
  document.getElementById('candidate-name').value = '';
  document.getElementById('candidate-role').value = '';
  document.getElementById('candidate-level').value = '';
  document.getElementById('candidate-track').value = '';
  document.getElementById('candidate-time').value = '40';
  const candidateRolePreviewEl = document.getElementById(
    'candidate-role-preview',
  );
  if (candidateRolePreviewEl) candidateRolePreviewEl.value = '';
  document.getElementById('admin-pass').value = '';
  document.getElementById('save-alert').classList.add('d-none');
  updateFlowPreview();
  showScreen('screen-config');
}
