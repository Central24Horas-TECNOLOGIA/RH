const RH_USER = 'rh';
const RH_PASS = '1234';
const HISTORY_CSV_KEY = 'rh_exam_history_csv';
const ANSWER_FILES_KEY = 'rh_exam_answer_files';

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
  currentResultId: null,
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

  ['history-filter-name', 'history-filter-role', 'history-filter-date'].forEach(
    (id) => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('input', renderHistoryTable);
    },
  );

  ensureHistoryCsv();
  updateFlowPreview();
  renderMenuRecentTests();
});

function showScreen(id) {
  document
    .querySelectorAll('.screen')
    .forEach((s) => s.classList.remove('active'));
  const target = document.getElementById(id);
  if (target) target.classList.add('active');

  if (id === 'screen-menu') renderMenuRecentTests();
  if (id === 'screen-history') renderHistoryTable();
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

function buildChecklistResult(tasks, points, notes = []) {
  const validTasks = Array.isArray(tasks) ? tasks : [];
  const total = validTasks.length;
  const doneCount = validTasks.filter((task) => !!task.done).length;
  const score = total > 0 ? Math.round((doneCount / total) * points) : 0;

  return {
    score,
    max: points,
    notes,
    pendingManual: true,
    completedTasks: validTasks.map(
      (task) => `${task.done ? '✔️' : '❌'} ${task.label}`,
    ),
  };
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
function getCell(ws, addr) {
  return ws && ws[addr] ? ws[addr] : null;
}
function cellHasData(ws, addr) {
  const cell = getCell(ws, addr);
  if (!cell) return false;
  if (cell.f !== undefined && cell.f !== null && String(cell.f).trim() !== '')
    return true;
  const value = cellValue(ws, addr);
  return String(value ?? '').trim() !== '';
}
function findHeaderColumn(ws, rowNumber, headerText) {
  if (!ws || !headerText) return null;
  const wanted = safeUpper(headerText);
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1:A1');
  for (let c = range.s.c; c <= range.e.c; c += 1) {
    const addr = XLSX.utils.encode_cell({ r: rowNumber - 1, c });
    if (safeUpper(cellValue(ws, addr)) === wanted) {
      return XLSX.utils.encode_col(c);
    }
  }
  return null;
}
function collectColumnValuesUntilBlank(ws, column, startRow, maxRow = 500) {
  const values = [];
  for (let row = startRow; row <= maxRow; row += 1) {
    const value = String(cellValue(ws, `${column}${row}`) || '').trim();
    if (!value) break;
    values.push(value);
  }
  return values;
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

function ensureHistoryCsv() {
  const current = localStorage.getItem(HISTORY_CSV_KEY);
  if (current) return current;
  const header = [
    'id_teste',
    'nome_candidato',
    'vaga',
    'nivel',
    'trilha',
    'data_iso',
    'data_exibicao',
    'pontuacao_final',
    'status',
    'tempo_minutos',
    'arquivo_gabarito',
  ].join(',');
  localStorage.setItem(HISTORY_CSV_KEY, header);
  return header;
}

function escapeCsvValue(value) {
  const text = String(value ?? '');
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function parseCsvLine(line) {
  const values = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      values.push(current);
      current = '';
      continue;
    }

    current += char;
  }

  values.push(current);
  return values;
}

function readHistoryRows() {
  const csv = ensureHistoryCsv();
  const lines = csv.split(/\r?\n/).filter((line) => line.trim());
  if (lines.length <= 1) return [];

  const headers = parseCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const cols = parseCsvLine(line);
    const row = {};
    headers.forEach((header, index) => {
      row[header] = cols[index] ?? '';
    });
    return row;
  });
}

function saveHistoryRow(row) {
  const csv = ensureHistoryCsv();
  const line = [
    row.id_teste,
    row.nome_candidato,
    row.vaga,
    row.nivel,
    row.trilha,
    row.data_iso,
    row.data_exibicao,
    row.pontuacao_final,
    row.status,
    row.tempo_minutos,
    row.arquivo_gabarito,
  ]
    .map(escapeCsvValue)
    .join(',');
  localStorage.setItem(HISTORY_CSV_KEY, `${csv}\n${line}`);
}

function getAnswerFiles() {
  return JSON.parse(localStorage.getItem(ANSWER_FILES_KEY) || '{}');
}

function saveAnswerFile(recordId, payload) {
  const files = getAnswerFiles();
  files[recordId] = payload;
  localStorage.setItem(ANSWER_FILES_KEY, JSON.stringify(files));
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function normalizeRecentStatus(row) {
  const files = getAnswerFiles();
  const saved = files[row?.id_teste];
  const rawStatus = String(row?.status || '').trim();
  if (rawStatus) return rawStatus;
  return saved?.content ? 'Finalizado' : 'Não salvo';
}

function getRecentStatusClass(status) {
  const normalized = safeUpper(status).normalize('NFD').replace(/[̀-ͯ]/g, '');
  if (normalized.includes('FINALIZADO')) return 'is-finished';
  if (normalized.includes('NAO SALVO')) return 'is-unsaved';
  return 'is-neutral';
}

function renderMenuRecentTests() {
  const list = document.getElementById('menu-recent-list');
  const empty = document.getElementById('menu-recent-empty');
  if (!list) return;

  const rows = readHistoryRows()
    .sort((a, b) => (a.data_iso < b.data_iso ? 1 : -1))
    .slice(0, 6);

  if (!rows.length) {
    list.innerHTML = '';
    if (empty) empty.classList.remove('d-none');
    return;
  }

  if (empty) empty.classList.add('d-none');

  list.innerHTML = rows
    .map((row) => {
      const status = normalizeRecentStatus(row);
      const statusClass = getRecentStatusClass(status);
      return `
        <button type="button" class="rh-recent-card btn text-start" onclick="openRecentTestDetails('${row.id_teste}')">
          <div class="rh-recent-card-top">
            <span class="rh-recent-name">${escapeHtml(row.nome_candidato || 'Sem nome')}</span>
            <span class="rh-recent-date">${escapeHtml(row.data_exibicao || '-')}</span>
          </div>
          <div class="rh-recent-card-bottom">
            <span class="rh-recent-role">${escapeHtml(row.vaga || '-')}</span>
            <span class="rh-status-pill ${statusClass}">${escapeHtml(status)}</span>
          </div>
        </button>
      `;
    })
    .join('');
}

function openRecentTestDetails(recordId) {
  const overlay = document.getElementById('recent-test-details-overlay');
  const title = document.getElementById('recent-test-details-title');
  const body = document.getElementById('recent-test-details-body');
  const downloadBtn = document.getElementById('recent-test-download-btn');
  if (!overlay || !title || !body) return;

  const row = readHistoryRows().find((item) => item.id_teste === recordId);
  if (!row) {
    body.innerHTML =
      '<div class="alert alert-danger mb-0">Não foi possível localizar os dados desta prova.</div>';
    title.textContent = 'Detalhes da prova';
    if (downloadBtn) downloadBtn.disabled = true;
    overlay.classList.remove('d-none');
    return;
  }

  const savedFiles = getAnswerFiles();
  const saved = savedFiles[recordId];
  let payload = null;

  if (saved?.content) {
    try {
      payload = JSON.parse(saved.content);
    } catch (error) {
      console.error('Erro ao ler detalhes salvos da prova:', error);
    }
  }

  const candidate = payload?.candidate || {};
  const stageSummary = Array.isArray(payload?.stageSummary)
    ? payload.stageSummary
    : [];
  const fullLog = payload?.textContent || '';
  const status = normalizeRecentStatus(row);
  const statusClass = getRecentStatusClass(status);
  const stageCardsHtml = stageSummary.length
    ? `
        <div class="rh-detail-stage-grid">
          ${stageSummary
            .map(
              (stage) => `
                <div class="rh-detail-stage-card">
                  <div class="rh-detail-stage-top">
                    <div class="rh-detail-stage-name">${escapeHtml(stage.label || '-')}</div>
                    <span class="rh-detail-stage-weight">Peso ${escapeHtml(stage.weight ?? '-')}%</span>
                  </div>
                  <div class="rh-detail-stage-score">${escapeHtml(stage.rawScore ?? 0)}/${escapeHtml(stage.rawMax ?? 0)}</div>
                  <div class="rh-detail-stage-meta">
                    Aproveitamento: ${escapeHtml(((stage.percent || 0) * 100).toFixed ? ((stage.percent || 0) * 100).toFixed(1) : '0.0')}%<br>
                    Nota ponderada: ${escapeHtml((stage.weightedScore ?? 0).toFixed ? stage.weightedScore.toFixed(2) : (stage.weightedScore ?? '0.00'))}<br>
                    Itens avaliados: ${escapeHtml(stage.questionCount ?? 0)}${stage.pendings ? `<br>Pendências de revisão: ${escapeHtml(stage.pendings)}` : ''}
                  </div>
                </div>
              `,
            )
            .join('')}
        </div>
      `
    : '<div class="alert alert-warning mb-0">As notas por etapa não foram encontradas neste registro.</div>';

  title.textContent = `Detalhes da prova • ${row.nome_candidato || 'Candidato'}`;

  body.innerHTML = `
    <section class="rh-details-section">
      <h4 class="rh-details-section-title">Resumo geral</h4>
      <div class="rh-details-grid">
        <div class="rh-detail-card">
          <span class="rh-detail-label">Candidato</span>
          <span class="rh-detail-value">${escapeHtml(candidate.name || row.nome_candidato || '-')}</span>
        </div>
        <div class="rh-detail-card">
          <span class="rh-detail-label">Vaga</span>
          <span class="rh-detail-value">${escapeHtml(candidate.role || row.vaga || '-')}</span>
        </div>
        <div class="rh-detail-card">
          <span class="rh-detail-label">Nível</span>
          <span class="rh-detail-value">${escapeHtml(candidate.level || row.nivel || '-')}</span>
        </div>
        <div class="rh-detail-card">
          <span class="rh-detail-label">Status</span>
          <span class="rh-status-pill ${statusClass}">${escapeHtml(status)}</span>
        </div>
        <div class="rh-detail-card">
          <span class="rh-detail-label">Data</span>
          <span class="rh-detail-value">${escapeHtml(row.data_exibicao || '-')}</span>
        </div>
        <div class="rh-detail-card">
          <span class="rh-detail-label">Trilha</span>
          <span class="rh-detail-value">${escapeHtml(payload?.blueprint?.label || row.trilha || '-')}</span>
        </div>
        <div class="rh-detail-card">
          <span class="rh-detail-label">Nota final</span>
          <span class="rh-detail-value">${escapeHtml(row.pontuacao_final || (payload?.weightedFinalScore ?? '-'))}</span>
        </div>
        <div class="rh-detail-card">
          <span class="rh-detail-label">Tempo</span>
          <span class="rh-detail-value">${escapeHtml(row.tempo_minutos ? `${row.tempo_minutos} min` : '-')}</span>
        </div>
      </div>
    </section>

    <section class="rh-details-section">
      <h4 class="rh-details-section-title">Notas por etapa</h4>
      ${stageCardsHtml}
    </section>

    <section class="rh-details-section">
      <h4 class="rh-details-section-title">Registro completo</h4>
      ${fullLog ? `<pre class="rh-detail-log">${escapeHtml(fullLog)}</pre>` : '<div class="alert alert-warning mb-0">Os detalhes completos desta prova não foram encontrados no navegador.</div>'}
    </section>
  `;

  if (downloadBtn) {
    downloadBtn.disabled = !saved?.content;
    downloadBtn.setAttribute('data-record-id', recordId);
    downloadBtn.setAttribute(
      'data-candidate-name',
      sanitizeFileName(candidate.name || row.nome_candidato || 'candidato'),
    );
  }

  overlay.classList.remove('d-none');
}
function closeRecentTestDetails() {
  const overlay = document.getElementById('recent-test-details-overlay');
  const body = document.getElementById('recent-test-details-body');
  const downloadBtn = document.getElementById('recent-test-download-btn');
  if (body) body.innerHTML = '';
  if (downloadBtn) {
    downloadBtn.disabled = true;
    downloadBtn.removeAttribute('data-record-id');
    downloadBtn.removeAttribute('data-candidate-name');
  }
  if (overlay) overlay.classList.add('d-none');
}

function handleRecentDetailsOverlayClick(event) {
  if (event.target?.id === 'recent-test-details-overlay') {
    closeRecentTestDetails();
  }
}
function downloadRecentTestAnswerKey() {
  const downloadBtn = document.getElementById('recent-test-download-btn');
  const recordId = downloadBtn?.getAttribute('data-record-id') || '';
  const candidateName =
    downloadBtn?.getAttribute('data-candidate-name') || 'candidato';

  if (!recordId) {
    alert('Nenhum gabarito foi associado a este registro.');
    return;
  }

  downloadHistoryAnswerKey(recordId, candidateName);
}
function buildResultId() {
  const now = new Date();
  const pad = (v) => String(v).padStart(2, '0');
  return `TESTE-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}

function formatDateToInput(dateValue) {
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (v) => String(v).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function buildAnswerKeyPayload(recordId) {
  return {
    id_teste: recordId,
    candidate: state.candidate,
    blueprint: state.blueprint,
    stageSummary: state.stageSummary,
    totalScore: state.totalScore,
    totalMax: state.totalMax,
    weightedFinalScore: state.weightedFinalScore,
    generatedAt: new Date().toISOString(),
    textContent: buildFullAnswerKeyText(),
  };
}

function doLogin() {
  const user = document.getElementById('login-user')?.value.trim() || '';
  const pass = document.getElementById('login-pass')?.value.trim() || '';
  const alertEl = document.getElementById('login-alert');

  if (user === RH_USER && pass === RH_PASS) {
    state.logged = true;
    ensureHistoryCsv();
    alertEl?.classList.add('d-none');
    showScreen('screen-menu');
  } else if (alertEl) {
    alertEl.textContent = 'Usuário ou senha inválidos.';
    alertEl.classList.remove('d-none');
  }
}

function resetExamEntryFields() {
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
}

function startNewTestFlow() {
  resetExamEntryFields();
  showScreen('screen-config');
}

function backToMenu() {
  clearInterval(state.timerHandle);
  state.finished = false;
  showScreen('screen-menu');
}

function goToHistory() {
  showScreen('screen-history');
  renderHistoryTable();
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
  state.currentResultId = null;

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
      'Criar coluna Subtotal ao final da tabela',
      'Calcular Subtotal = Valor do produto × Quantidade',
      'Formatar Valor Unitário e Subtotal como contábil',
      'Aplicar à nova coluna o mesmo estilo visual da planilha',
      'Alterar as cores de A1 e da linha A2',
      'Aplicar filtro e ordenar do maior para o menor valor unitário',
      'Criar linha de total e somar Quantidade e Valor R$',
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

function hasBoldInHtml(html) {
  // Detects bold via <b>, <strong>, or inline style font-weight bold/700+
  if (/<(b|strong)[^>]*>[\s\S]*?<\/(b|strong)>/i.test(html)) return true;
  if (/font-weight\s*:\s*(bold|[6-9]\d{2}|[1-9]\d{3})/i.test(html)) return true;
  return false;
}

function hasCenterInHtml(html) {
  // Detects centering via text-align style, align attribute, or justifyCenter div
  if (/text-align\s*:\s*center/i.test(html)) return true;
  if (/align\s*=\s*["']?center["']?/i.test(html)) return true;
  if (/<div[^>]*style\s*=\s*["'][^"']*center[^"']*["']/i.test(html))
    return true;
  return false;
}

function titleIsBoldInHtml(html, titleText) {
  if (!titleText) return false;
  const escapedTitle = titleText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // Check if the title text appears inside a bold tag or bold-styled element
  const boldTagPattern = new RegExp(
    '<(b|strong)[^>]*>[\\s\\S]*?' + escapedTitle + '[\\s\\S]*?<\\/(b|strong)>',
    'i',
  );
  if (boldTagPattern.test(html)) return true;
  // Check if title is in an element with font-weight bold
  const boldStylePattern = new RegExp(
    'font-weight\\s*:\\s*(bold|[6-9]\\d{2}|[1-9]\\d{3})[^"\']*["\'][^>]*>[\\s\\S]*?' +
      escapedTitle,
    'i',
  );
  if (boldStylePattern.test(html)) return true;
  // Fallback: any bold exists and title text is present
  return hasBoldInHtml(html);
}

function titleIsCenteredInHtml(html, titleText) {
  if (!titleText) return false;
  // Check if title appears in a centered context
  const escapedTitle = titleText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const centerPattern = new RegExp(
    '(text-align\\s*:\\s*center|align\\s*=\\s*["\']?center["\']?)[\\s\\S]{0,300}' +
      escapedTitle,
    'i',
  );
  if (centerPattern.test(html)) return true;
  const centerPattern2 = new RegExp(
    escapedTitle +
      '[\\s\\S]{0,300}(text-align\\s*:\\s*center|align\\s*=\\s*["\']?center["\']?)',
    'i',
  );
  if (centerPattern2.test(html)) return true;
  // Fallback: any centering in document and title text present
  return hasCenterInHtml(html);
}

function evaluateWord(answer, expected, points) {
  if (!answer || !answer.content) return 0;
  const html = answer.content;
  const plain = stripHtml(html);
  const upper = plain.toUpperCase();

  // If the content is essentially empty, return 0
  if (plain.trim().length < 5) return 0;

  let score = 0;
  let totalWeight = 0;
  const checks = [
    expected.titleText
      ? { ok: upper.includes(expected.titleText.toUpperCase()), weight: 2 }
      : null,
    expected.titleBold
      ? { ok: titleIsBoldInHtml(html, expected.titleText), weight: 1.5 }
      : null,
    expected.titleCenter
      ? { ok: titleIsCenteredInHtml(html, expected.titleText), weight: 1.5 }
      : null,
    expected.minTextLength
      ? { ok: plain.length >= expected.minTextLength, weight: 1.5 }
      : null,
    expected.requiresList
      ? {
          ok: /<(ul|ol)[^>]*>/i.test(html) || /^\s*[-•*]\s+/m.test(plain),
          weight: 1.5,
        }
      : null,
    expected.minListItems
      ? {
          ok:
            countListItemsFromHtml(html) >= expected.minListItems ||
            (plain.match(/^\s*[-•*]\s+\S/gm) || []).length >=
              expected.minListItems,
          weight: 1.5,
        }
      : null,
    expected.anyBold ? { ok: hasBoldInHtml(html), weight: 1.2 } : null,
    expected.minSentences
      ? { ok: countSentences(plain) >= expected.minSentences, weight: 1.3 }
      : null,
  ].filter(Boolean);

  checks.forEach((item) => {
    totalWeight += item.weight;
    if (item.ok) score += item.weight;
  });

  if (!checks.length) return 0;

  // Partial credit: proportional scoring. Minimum 1 point if any text was written.
  const raw = (score / totalWeight) * points;
  return Math.max(plain.trim().length >= 5 ? 1 : 0, Math.round(raw));
}
function evaluateMultiple(answer, correctIndex, points) {
  return answer && answer.selected === correctIndex ? points : 0;
}

async function downloadExcelTask(questionIndex) {
  const q = state.questions[questionIndex];
  const candidateName = sanitizeFileName(state.candidate?.name || 'candidato');

  try {
    const fileInfo = await loadExcelTemplateFile(q.taskId);
    const filename = sanitizeFileName(
      `${fileInfo.outputBaseName}_${candidateName}.xlsx`,
    );

    const blob = new Blob([fileInfo.arrayBuffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });

    downloadBlob(filename, blob);
  } catch (error) {
    console.error('Erro ao baixar arquivo-base do Excel:', error);
    alert(
      'Não foi possível localizar o arquivo-base da prova de Excel. Verifique se os arquivos .xlsx estão na mesma pasta do sistema.',
    );
  }
}

function getExcelTemplateConfig(taskId) {
  const map = {
    basic_exam: {
      fileName: 'exame_basico.xlsx',
      outputBaseName: 'exame_basico',
    },
    qualid_exam: {
      fileName: 'exame_medio.xlsx',
      outputBaseName: 'exame_medio',
    },
    planning_exam: {
      fileName: 'exame_avancado_nvl2.xlsx',
      outputBaseName: 'exame_avancado_nvl2',
    },
    advanced_exam: {
      fileName: 'exame_avancado.xlsx',
      outputBaseName: 'exame_avancado',
    },
  };

  return map[taskId] || null;
}

async function loadExcelTemplateFile(taskId) {
  const config = getExcelTemplateConfig(taskId);

  if (!config) {
    throw new Error(`Nenhum arquivo-base configurado para o taskId: ${taskId}`);
  }

  const response = await fetch(config.fileName, { cache: 'no-store' });

  if (!response.ok) {
    throw new Error(
      `Falha ao carregar o arquivo-base ${config.fileName}. Status: ${response.status}`,
    );
  }

  const arrayBuffer = await response.arrayBuffer();

  return {
    ...config,
    arrayBuffer,
  };
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
      [
        "4) Formate os resultados da coluna'Valor (R$)' e da coluna 'Valor Total' para o fomrato contábil.",
      ],
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

  if (!ws) {
    return buildChecklistResult(
      [
        { label: 'Coluna Subtotal criada e preenchida', done: false },
        { label: 'Valor Unitário e Subtotal em formato contábil', done: false },
        { label: 'Nova coluna com estilo visual aplicado', done: false },
        { label: 'Cores alteradas em A1 e na linha A2', done: false },
        {
          label: 'Filtro aplicado e ordenação por maior valor unitário',
          done: false,
        },
        { label: 'Linha de total criada com soma final', done: false },
      ],
      points,
      ["Aba 'Teste de Excel' não encontrada."],
    );
  }

  const notes = [
    'Formatação visual, cores e estilo devem ser revisados visualmente pelo RH.',
  ];

  function normalizeHeader(value) {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .replace(/[()]/g, '')
      .trim()
      .toUpperCase();
  }

  function getHeaderInfo() {
    const range = XLSX.utils.decode_range(ws['!ref'] || 'A1:Z50');

    for (let row = range.s.r + 1; row <= Math.min(range.e.r + 1, 20); row++) {
      let produtoCol = null;
      let quantidadeCol = null;
      let valorCol = null;
      let subtotalCol = null;

      for (let c = range.s.c; c <= range.e.c; c++) {
        const col = XLSX.utils.encode_col(c);
        const raw = cellValue(ws, `${col}${row}`);
        const header = normalizeHeader(raw);

        if (header === 'PRODUTO') produtoCol = col;
        if (header === 'QUANTIDADE') quantidadeCol = col;
        if (
          header === 'VALOR UNITARIO R$' ||
          header === 'VALOR UNITARIO R' ||
          header === 'VALOR UNITARIO' ||
          header === 'VALOR R$' ||
          header === 'VALOR R'
        ) {
          valorCol = col;
        }
        if (header === 'SUBTOTAL') subtotalCol = col;
      }

      if (produtoCol && quantidadeCol && valorCol) {
        return {
          headerRow: row,
          produtoCol,
          quantidadeCol,
          valorCol,
          subtotalCol,
        };
      }
    }

    return null;
  }

  function isRowHidden(ws, rowNumber) {
    return !!(
      ws &&
      ws['!rows'] &&
      ws['!rows'][rowNumber - 1] &&
      ws['!rows'][rowNumber - 1].hidden
    );
  }

  function getDataRows(produtoCol, startRow, maxRows = 100) {
    const rows = [];
    for (let r = startRow; r <= startRow + maxRows; r++) {
      const value = String(cellValue(ws, `${produtoCol}${r}`) || '').trim();
      if (!value) break;
      rows.push(r);
    }
    return rows;
  }

  const info = getHeaderInfo();

  if (!info) {
    return buildChecklistResult(
      [
        { label: 'Coluna Subtotal criada e preenchida', done: false },
        { label: 'Valor Unitário e Subtotal em formato contábil', done: false },
        { label: 'Nova coluna com estilo visual aplicado', done: false },
        { label: 'Cores alteradas em A1 e na linha A2', done: false },
        {
          label: 'Filtro aplicado e ordenação por maior valor unitário',
          done: false,
        },
        { label: 'Linha de total criada com soma final', done: false },
      ],
      points,
      [
        'Não foi possível localizar a estrutura principal da tabela na aba Teste de Excel.',
      ],
    );
  }

  const { headerRow, produtoCol, quantidadeCol, valorCol, subtotalCol } = info;
  const dataStartRow = headerRow + 1;
  const dataRows = getDataRows(produtoCol, dataStartRow, 100);
  const lastDataRow = dataRows.length
    ? dataRows[dataRows.length - 1]
    : dataStartRow;
  const totalRow = lastDataRow + 1;

  const subtotalCreated =
    !!subtotalCol &&
    normalizeHeader(cellValue(ws, `${subtotalCol}${headerRow}`)) === 'SUBTOTAL';

  const subtotalFilled =
    subtotalCreated &&
    dataRows.length > 0 &&
    dataRows.filter((row) => cellHasData(ws, `${subtotalCol}${row}`)).length >=
      Math.max(1, dataRows.length - 1);

  const accountingLike =
    !!subtotalCol &&
    dataRows.some((row) => {
      const valorCell = ws[`${valorCol}${row}`];
      const subtotalCell = ws[`${subtotalCol}${row}`];
      const valorFmt = String(
        (valorCell && valorCell.z) || (valorCell && valorCell.w) || '',
      ).toUpperCase();
      const subtotalFmt = String(
        (subtotalCell && subtotalCell.z) ||
          (subtotalCell && subtotalCell.w) ||
          '',
      ).toUpperCase();

      return (
        valorFmt.includes('R$') ||
        subtotalFmt.includes('R$') ||
        valorFmt.includes('#,##0') ||
        subtotalFmt.includes('#,##0') ||
        valorFmt.includes('_-') ||
        subtotalFmt.includes('_-')
      );
    });

  const styledNewColumn =
    !!subtotalCol &&
    dataRows.length > 0 &&
    !!ws[`${valorCol}${dataRows[0]}`] &&
    !!ws[`${subtotalCol}${dataRows[0]}`] &&
    !!ws[`${valorCol}${dataRows[0]}`].s &&
    !!ws[`${subtotalCol}${dataRows[0]}`].s;

  const colorsChanged =
    !!(ws['A1'] && ws['A1'].s) || !!(ws['A2'] && ws['A2'].s);

  const visibleRows = dataRows.filter((row) => !isRowHidden(ws, row));
  const visibleValues = visibleRows
    .map((row) => Number(cellValue(ws, `${valorCol}${row}`)))
    .filter((v) => !Number.isNaN(v));

  let sortedDesc = false;
  if (visibleValues.length >= 2) {
    sortedDesc = visibleValues.every((value, index, arr) => {
      if (index === 0) return true;
      return arr[index - 1] >= value;
    });
  }

  const filterAndSortDone = hasAutoFilter(ws) && sortedDesc;

  const totalLineCreated =
    dataRows.length > 0 &&
    (normalizeHeader(cellValue(ws, `${produtoCol}${totalRow}`)).includes(
      'TOTAL',
    ) ||
      cellHasData(ws, `${quantidadeCol}${totalRow}`) ||
      cellHasData(ws, `${subtotalCol || valorCol}${totalRow}`));

  const tasks = [
    {
      label: 'Coluna Subtotal criada e preenchida',
      done: subtotalCreated && subtotalFilled,
    },
    {
      label: 'Valor Unitário e Subtotal em formato contábil',
      done: accountingLike,
    },
    {
      label: 'Nova coluna com estilo visual aplicado',
      done: styledNewColumn,
    },
    {
      label: 'Cores alteradas em A1 e na linha A2',
      done: colorsChanged,
    },
    {
      label: 'Filtro aplicado e ordenação por maior valor unitário',
      done: filterAndSortDone,
    },
    {
      label: 'Linha de total criada com soma final',
      done: totalLineCreated,
    },
  ];

  return buildChecklistResult(tasks, points, notes);
}

function validateAdvancedExam(wb, points) {
  const base = validatePlanningExam(wb, points);
  const q6 = getSheetFlex(wb, 'Q6.', 'Q6');
  const q7 = getSheetFlex(wb, 'Q7.', 'Q7');

  const notes = [...(base.notes || [])];
  const tasks = (base.completedTasks || []).map((item) => ({
    label: String(item).replace(/^✔️\s|^❌\s/, ''),
    done: String(item).startsWith('✔️'),
  }));

  if (q6) {
    const chartDataTouched = Array.from({ length: 20 }, (_, i) =>
      ['J', 'K', 'L', 'M', 'E', 'F', 'G', 'H'].some((col) =>
        cellHasData(q6, `${col}${i + 1}`),
      ),
    ).some(Boolean);

    tasks.push({
      label: 'Gráfico combinado sinalizado para revisão',
      done: chartDataTouched || !!q6['!ref'],
    });

    notes.push(
      'Gráfico combinado e eixo secundário devem ser revisados visualmente pelo RH.',
    );
  } else {
    tasks.push({
      label: 'Gráfico combinado sinalizado para revisão',
      done: false,
    });
  }

  tasks.push({
    label: 'Soma do RJ em F10',
    done: !!q7 && cellHasData(q7, 'F10'),
  });

  return buildChecklistResult(tasks, points, notes);
}

function validateQualidExam(wb, points) {
  const notes = [];

  function getSheetByNames(wbRef, names) {
    for (const name of names) {
      const ws = getSheet(wbRef, name);
      if (ws) return ws;
    }
    return null;
  }

  function isRowHidden(ws, rowNumber) {
    return !!(
      ws &&
      ws['!rows'] &&
      ws['!rows'][rowNumber - 1] &&
      ws['!rows'][rowNumber - 1].hidden
    );
  }

  function getVisibleValues(ws, col, startRow = 1, endRow = 200) {
    const values = [];
    for (let r = startRow; r <= endRow; r++) {
      const value = String(cellValue(ws, `${col}${r}`) || '').trim();
      if (!value) continue;
      if (!isRowHidden(ws, r)) values.push(safeUpper(value));
    }
    return values;
  }

  const q1 = getSheetByNames(wb, ['Q1', 'Q1.']);
  const q2 = getSheetByNames(wb, ['Q2', 'Q2.']);
  const q3 = getSheetByNames(wb, ['Q3', 'Q3.']);
  const q4 = getSheetByNames(wb, ['Q4', 'Q4.']);

  const isNewModel = !!(q1 || q2 || q3 || q4);

  if (isNewModel) {
    const tasks = [];

    if (q1) {
      const operators = [];
      for (let r = 3; r <= 100; r++) {
        const name = String(cellValue(q1, `A${r}`) || '').trim();
        if (!name) break;
        operators.push(name);
      }

      const sortedCheck =
        operators.length > 0
          ? [...operators].sort((a, b) => a.localeCompare(b, 'pt-BR'))
          : [];

      tasks.push({
        label: 'Planilha ordenada',
        done:
          operators.length > 0 &&
          JSON.stringify(operators) === JSON.stringify(sortedCheck),
      });

      tasks.push({
        label: 'Coluna Valor Total criada',
        done: safeUpper(cellValue(q1, 'F2')) === 'VALOR TOTAL',
      });

      tasks.push({
        label: 'Valor Total preenchido',
        done:
          operators.length > 0 &&
          operators.every((_, i) => cellHasData(q1, `F${i + 3}`)),
      });
    } else {
      tasks.push(
        { label: 'Planilha ordenada', done: false },
        { label: 'Coluna Valor Total criada', done: false },
        { label: 'Valor Total preenchido', done: false },
      );
    }

    if (q2) {
      const visibleOps = getVisibleValues(q2, 'A', 6, 100);
      tasks.push({
        label: 'Tabela copiada e filtrada para Wesley Nunes',
        done:
          safeUpper(cellValue(q2, 'A5')) === 'OPERADOR' &&
          hasAutoFilter(q2) &&
          visibleOps.length === 1 &&
          visibleOps[0] === 'WESLEY NUNES',
      });
    } else {
      tasks.push({
        label: 'Tabela copiada e filtrada para Wesley Nunes',
        done: false,
      });
    }

    if (q3) {
      const visibleSupervisors = getVisibleValues(q3, 'B', 6, 100);
      tasks.push({
        label: 'Resumo do supervisor Lula',
        done:
          safeUpper(cellValue(q3, 'A5')) === 'OPERADOR' &&
          hasAutoFilter(q3) &&
          visibleSupervisors.length >= 1 &&
          visibleSupervisors.every((name) => name === 'LULA'),
      });
    } else {
      tasks.push({
        label: 'Resumo do supervisor Lula',
        done: false,
      });
    }

    tasks.push({
      label: 'Gráfico criado / sinalizado para revisão',
      done: !!q4,
    });

    if (q4) {
      notes.push('O gráfico deve ser revisado visualmente pelo RH.');
    }

    return buildChecklistResult(tasks, points, notes);
  }

  const planA = getSheet(wb, 'Planilha A');
  const procv = getSheet(wb, 'PROCV');
  const tabdin = getSheet(wb, 'TAB_DIN');
  const copiar = getSheet(wb, 'Copiar_Colar');
  const graf = getSheet(wb, 'Gráfico');

  const tasks = [];

  if (planA) {
    const operatorValues = collectColumnValuesUntilBlank(planA, 'A', 3, 100);
    const sortedCheck =
      operatorValues.length > 0
        ? [...operatorValues].sort((a, b) => a.localeCompare(b, 'pt-BR'))
        : [];

    tasks.push({
      label: 'Planilha A ordenada',
      done:
        operatorValues.length >= 3 &&
        JSON.stringify(operatorValues) === JSON.stringify(sortedCheck),
    });

    tasks.push({
      label: 'Coluna Valor Total criada',
      done: safeUpper(cellValue(planA, 'F2')) === 'VALOR TOTAL',
    });

    tasks.push({
      label: 'Valor Total preenchido',
      done:
        operatorValues.length > 0 &&
        operatorValues.every((_, i) => cellHasData(planA, `F${i + 3}`)),
    });
  } else {
    tasks.push(
      { label: 'Planilha A ordenada', done: false },
      { label: 'Coluna Valor Total criada', done: false },
      { label: 'Valor Total preenchido', done: false },
    );
  }

  tasks.push({
    label: 'PROCV preenchido',
    done:
      !!procv &&
      Array.from({ length: 13 }, (_, i) =>
        cellHasData(procv, `C${i + 2}`),
      ).some(Boolean),
  });

  tasks.push({
    label: 'Não encontrados listados em BC255',
    done:
      !!procv &&
      ['BC255', 'BC256', 'BC257', 'BC258'].some((c) => cellHasData(procv, c)),
  });

  tasks.push({
    label: 'Resumo do supervisor Lula',
    done:
      !!tabdin &&
      ['A5', 'B5', 'C5', 'A6', 'B6', 'C6'].some((c) => cellHasData(tabdin, c)),
  });

  tasks.push({
    label: 'Tabela copiada/filtrada',
    done: !!copiar && safeUpper(cellValue(copiar, 'A5')) === 'OPERADOR',
  });

  tasks.push({
    label: 'Gráfico criado / sinalizado para revisão',
    done: !!graf,
  });

  if (graf) {
    notes.push('O gráfico deve ser revisado visualmente pelo RH.');
  }

  return buildChecklistResult(tasks, points, notes);
}

function getSheetFlex(wb, ...names) {
  for (const name of names) {
    const ws = wb.Sheets[name];
    if (ws) return ws;
  }
  return null;
}

function validatePlanningExam(wb, points) {
  const notes = [];
  const q1 = getSheetFlex(wb, 'Q1.', 'Q1');
  const q2 = getSheetFlex(wb, 'Q2.', 'Q2');
  const q3 = getSheetFlex(wb, 'Q3.', 'Q3');
  const q4 = getSheetFlex(wb, 'Q4.', 'Q4');
  const q5 = getSheetFlex(wb, 'Q5.', 'Q5');

  const tasks = [];

  if (q1) {
    const filledAt6 = Array.from({ length: 12 }, (_, i) =>
      cellHasData(q1, `B${i + 6}`),
    ).filter(Boolean).length;
    const filledAt5 = Array.from({ length: 12 }, (_, i) =>
      cellHasData(q1, `B${i + 5}`),
    ).filter(Boolean).length;
    const filled = Math.max(filledAt6, filledAt5);

    tasks.push({
      label: 'CONT.SE por cidade preenchido',
      done: filled >= 6,
    });
  } else {
    tasks.push({
      label: 'CONT.SE por cidade preenchido',
      done: false,
    });
  }

  if (q2) {
    const filledAt5 = Array.from({ length: 16 }, (_, i) =>
      cellHasData(q2, `B${i + 5}`),
    ).filter(Boolean).length;
    const filledAt4 = Array.from({ length: 16 }, (_, i) =>
      cellHasData(q2, `B${i + 4}`),
    ).filter(Boolean).length;
    const filled = Math.max(filledAt5, filledAt4);

    tasks.push({
      label: 'PROCV de status preenchido',
      done: filled >= 8,
    });
  } else {
    tasks.push({
      label: 'PROCV de status preenchido',
      done: false,
    });
  }

  if (q3) {
    const dddTableCreated = Array.from(
      { length: 60 },
      (_, i) =>
        cellHasData(q3, `A${i + 5}`) ||
        cellHasData(q3, `B${i + 5}`) ||
        cellHasData(q3, `C${i + 5}`) ||
        cellHasData(q3, `D${i + 5}`),
    ).some(Boolean);

    tasks.push({
      label: 'Tabela por DDD criada',
      done: dddTableCreated,
    });

    notes.push(
      'Gráfico Pizza 3D, título e rótulos devem ser revisados visualmente pelo RH.',
    );
  } else {
    tasks.push({
      label: 'Tabela por DDD criada',
      done: false,
    });
  }

  if (q4) {
    const percentuais = Array.from({ length: 9 }, (_, i) =>
      cellHasData(q4, `C${i + 8}`),
    ).filter(Boolean).length;
    const situacoes = Array.from({ length: 9 }, (_, i) =>
      cellHasData(q4, `D${i + 8}`),
    ).filter(Boolean).length;

    tasks.push({
      label: 'Percentuais por zona preenchidos',
      done: percentuais >= 6,
    });

    tasks.push({
      label: 'Situação por zona preenchida',
      done: situacoes >= 6,
    });

    notes.push('Formatação condicional deve ser revisada visualmente pelo RH.');
  } else {
    tasks.push(
      { label: 'Percentuais por zona preenchidos', done: false },
      { label: 'Situação por zona preenchida', done: false },
    );
  }

  if (q5) {
    const vendas = Array.from({ length: 13 }, (_, i) => i + 6).filter((row) =>
      ['B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'].some((col) =>
        cellHasData(q5, `${col}${row}`),
      ),
    ).length;

    tasks.push({
      label: 'Análise de vendas preenchida',
      done: vendas >= 8,
    });
  } else {
    tasks.push({
      label: 'Análise de vendas preenchida',
      done: false,
    });
  }

  return buildChecklistResult(tasks, points, notes);
}

function validateAdvancedExam(wb, points) {
  const base = validatePlanningExam(wb, points);
  const q6 = getSheetFlex(wb, 'Q6.', 'Q6');
  const q7 = getSheetFlex(wb, 'Q7.', 'Q7');

  const notes = [...(base.notes || [])];
  const tasks = (base.completedTasks || []).map((item) => ({
    label: String(item).replace(/^✔️\s|^❌\s/, ''),
    done: String(item).startsWith('✔️'),
  }));

  if (q6) {
    const chartDataTouched = Array.from({ length: 20 }, (_, i) =>
      ['J', 'K', 'L', 'M', 'E', 'F', 'G', 'H'].some((col) =>
        cellHasData(q6, `${col}${i + 1}`),
      ),
    ).some(Boolean);

    tasks.push({
      label: 'Gráfico combinado sinalizado para revisão',
      done: chartDataTouched || !!q6['!ref'],
    });

    notes.push(
      'Gráfico combinado e eixo secundário devem ser revisados visualmente pelo RH.',
    );
  } else {
    tasks.push({
      label: 'Gráfico combinado sinalizado para revisão',
      done: false,
    });
  }

  tasks.push({
    label: 'Soma do RJ em F10',
    done: !!q7 && cellHasData(q7, 'F10'),
  });

  return buildChecklistResult(tasks, points, notes);
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

  const printDateEl = document.getElementById('print-generated-at');
  const printNameEl = document.getElementById('print-name');
  const printRoleEl = document.getElementById('print-role');
  const printLevelEl = document.getElementById('print-level');
  const printScoreEl = document.getElementById('print-score');
  const printStageBox = document.getElementById('print-stage-results');
  const printManualBox = document.getElementById('print-manual-review');

  if (printDateEl) printDateEl.textContent = new Date().toLocaleString('pt-BR');
  if (printNameEl) printNameEl.textContent = state.candidate.name || '';
  if (printRoleEl) printRoleEl.textContent = state.candidate.role || '';
  if (printLevelEl)
    printLevelEl.textContent = `${state.candidate.level} • ${state.blueprint.label}`;
  if (printScoreEl)
    printScoreEl.textContent = state.weightedFinalScore.toFixed(2);

  if (printStageBox) {
    printStageBox.innerHTML = state.stageSummary
      .map(
        (data) => `
        <div class="print-stage-item">
          <div class="print-stage-item-title">${data.label}</div>
          <div class="print-stage-item-count">${data.questionCount} itens avaliados</div>
          <strong>Nota: ${data.rawScore}/${data.rawMax}</strong>
          <strong>Aproveitamento: ${(data.percent * 100).toFixed(1)}%</strong>
          <strong>Nota ponderada: ${data.weightedScore.toFixed(2)}</strong>
        </div>`,
      )
      .join('');
  }

  if (printManualBox) {
    if (!state.manualReviewItems.length) {
      printManualBox.innerHTML = 'Nenhuma pendência.';
    } else {
      printManualBox.innerHTML = state.manualReviewItems
        .map(
          (item) => `
          <div class="mb-2"><strong>${item.title}</strong>${item.completedTasks?.length ? `<ul>${item.completedTasks.map((x) => `<li>${x}</li>`).join('')}</ul>` : ''}${item.answerKey?.length ? `<ul>${item.answerKey.map((x) => `<li>${x}</li>`).join('')}</ul>` : ''}${item.notes?.length ? `<div>${item.notes.join(' | ')}</div>` : ''}</div>`,
        )
        .join('');
    }
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
  const alertBox = document.getElementById('save-alert');
  if (!state?.candidate?.name) {
    alertBox.textContent =
      'Não foi possível salvar: candidato não identificado.';
    alertBox.classList.remove('d-none', 'alert-success');
    alertBox.classList.add('alert-danger');
    return;
  }

  const recordId = state.currentResultId || buildResultId();
  state.currentResultId = recordId;
  const now = new Date();
  const displayDate = now.toLocaleString('pt-BR');
  const answerFileName = `gabarito_${recordId}.json`;

  saveHistoryRow({
    id_teste: recordId,
    nome_candidato: state.candidate.name,
    vaga: state.candidate.role,
    nivel: state.candidate.level,
    trilha: state.blueprint?.label || state.candidate.track || '',
    data_iso: now.toISOString(),
    data_exibicao: displayDate,
    pontuacao_final: state.weightedFinalScore.toFixed(2),
    status: 'Finalizado',
    tempo_minutos: state.candidate.time,
    arquivo_gabarito: answerFileName,
  });

  saveAnswerFile(recordId, {
    fileName: answerFileName,
    content: JSON.stringify(buildAnswerKeyPayload(recordId), null, 2),
    mimeType: 'application/json',
    candidateName: state.candidate.name,
  });

  alertBox.textContent =
    'Resultado salvo com sucesso no histórico CSV do navegador.';
  alertBox.classList.remove('d-none', 'alert-danger');
  alertBox.classList.add('alert-success');
}

function clearHistoryFilters() {
  document.getElementById('history-filter-name').value = '';
  document.getElementById('history-filter-role').value = '';
  document.getElementById('history-filter-date').value = '';
  renderHistoryTable();
}

function renderHistoryTable() {
  const body = document.getElementById('history-table-body');
  const alertEl = document.getElementById('history-alert');
  if (!body || !alertEl) return;

  const nameFilter = safeUpper(
    document.getElementById('history-filter-name')?.value || '',
  );
  const roleFilter = safeUpper(
    document.getElementById('history-filter-role')?.value || '',
  );
  const dateFilter =
    document.getElementById('history-filter-date')?.value || '';

  const rows = readHistoryRows().sort((a, b) =>
    a.data_iso < b.data_iso ? 1 : -1,
  );
  const filtered = rows.filter((row) => {
    const matchesName =
      !nameFilter || safeUpper(row.nome_candidato).includes(nameFilter);
    const matchesRole = !roleFilter || safeUpper(row.vaga).includes(roleFilter);
    const matchesDate =
      !dateFilter || formatDateToInput(row.data_iso) === dateFilter;
    return matchesName && matchesRole && matchesDate;
  });

  if (!rows.length) {
    alertEl.textContent = 'Nenhum resultado salvo até o momento.';
    alertEl.classList.remove('d-none', 'alert-danger');
    alertEl.classList.add('alert-info');
    body.innerHTML =
      '<tr><td colspan="8" class="text-center text-muted py-4">Nenhum resultado salvo até o momento.</td></tr>';
    return;
  }

  alertEl.classList.add('d-none');

  if (!filtered.length) {
    body.innerHTML =
      '<tr><td colspan="8" class="text-center text-muted py-4">Nenhum resultado encontrado para os filtros informados.</td></tr>';
    return;
  }

  body.innerHTML = filtered
    .map(
      (row) => `
    <tr>
      <td>${row.id_teste}</td>
      <td>${row.nome_candidato}</td>
      <td>${row.vaga}</td>
      <td>${row.nivel}${row.trilha ? `<div class="small text-muted">${row.trilha}</div>` : ''}</td>
      <td>${row.data_exibicao}</td>
      <td>${row.pontuacao_final}</td>
      <td><span class="badge text-bg-success">${row.status || 'Finalizado'}</span></td>
      <td class="text-end">
        <button class="btn btn-sm btn-outline-primary" onclick="downloadHistoryAnswerKey('${row.id_teste}', '${sanitizeFileName(row.nome_candidato)}')">Baixar gabarito</button>
      </td>
    </tr>
  `,
    )
    .join('');
}

function downloadHistoryAnswerKey(recordId, candidateName = 'candidato') {
  const files = getAnswerFiles();
  const saved = files[recordId];
  if (!saved?.content) {
    alert('O gabarito desse candidato não foi encontrado neste navegador.');
    return;
  }
  const blob = new Blob([saved.content], {
    type: saved.mimeType || 'application/json',
  });
  downloadBlob(
    saved.fileName || `gabarito_${sanitizeFileName(candidateName)}.json`,
    blob,
  );
}

function downloadCurrentAnswerKey() {
  if (!state.currentResultId) {
    alert('Salve o resultado antes de baixar o gabarito individual.');
    return;
  }
  downloadHistoryAnswerKey(
    state.currentResultId,
    state.candidate?.name || 'candidato',
  );
}

function exportHistoryCsv() {
  const csv = ensureHistoryCsv();
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  downloadBlob('historico_testes.csv', blob);
}

function openAdminResult() {
  const pass = document.getElementById('admin-pass').value.trim();
  const alert = document.getElementById('admin-alert');
  if (pass !== RH_PASS) {
    alert.textContent = 'Senha inválida.';
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
  resetExamEntryFields();
  showScreen('screen-config');
}
