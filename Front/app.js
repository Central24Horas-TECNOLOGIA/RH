const RH_USER = 'rh';
const RH_PASS = '1234';
//const HISTORY_CSV_KEY = 'rh_exam_history_csv';
//const ANSWER_FILES_KEY = 'rh_exam_answer_files';
const API_BASE_URL = 'http://127.0.0.1:8000';

const state = {
  logged: false,
  candidate: null,
  selectedProcessId: '',
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
  rhObservation: '',
  finishStatus: 'Finalizado',
  isSavingResult: false,
  resultSaved: false,

  recentPage: 1,
  recentPageSize: 6,

  historyPage: 1,
  historyPageSize: 10,

  processDetailsPage: 1,
  processDetailsPageSize: 5,
  currentProcessDetailsId: '',

  analyticsPage: 1,
  analyticsPageSize: 5,
  currentAnalysisTestId: '',
  analyticsFilters: {
    process: '',
    candidate: '',
    role: '',
    score: '',
  },
};

const PAGE_BY_SCREEN = {
  'screen-login': 'login.html',
  'screen-menu': 'index.html',
  'screen-history': 'history.html',
  'screen-processes': 'processes.html',
  'screen-process-create': 'process-create.html',
  'screen-talent-bank': 'talent-bank.html',
  'screen-config': 'config.html',
  'screen-candidate': 'candidate.html',
  'screen-exam': 'exam.html',
  'screen-thanks': 'thanks.html',
  'screen-result': 'result.html',
  'screen-analysis-candidates': 'analysis-candidates.html',
};

const APP_STATE_STORAGE_KEY = 'rh_app_state_v2';

function getCurrentPageScreenId() {
  return (
    document.body?.dataset?.screen ||
    document.querySelector('.screen.active')?.id ||
    'screen-login'
  );
}

function persistAppState() {
  try {
    const serializable = { ...state };

    serializable.timerHandle = null;

    // Nunca persistir blueprint com funções
    serializable.blueprint = null;

    sessionStorage.setItem(APP_STATE_STORAGE_KEY, JSON.stringify(serializable));
  } catch (error) {
    console.warn('Não foi possível persistir o estado da aplicação:', error);
  }
}

function hydrateAppState() {
  try {
    const raw = sessionStorage.getItem(APP_STATE_STORAGE_KEY);
    if (!raw) return;

    const saved = JSON.parse(raw);
    Object.assign(state, saved || {});
    state.timerHandle = null;

    // Reconstroi o blueprint a partir dos dados do candidato
    if (state.candidate?.role && state.candidate?.level) {
      state.blueprint = resolveExamBlueprint(
        state.candidate.role,
        state.candidate.level,
        state.candidate.track || '',
      );
    } else {
      state.blueprint = null;
    }
  } catch (error) {
    console.warn('Não foi possível restaurar o estado da aplicação:', error);
  }
}

function clearPersistedAppState() {
  try {
    sessionStorage.removeItem(APP_STATE_STORAGE_KEY);
  } catch (error) {
    console.warn('Não foi possível limpar o estado persistido:', error);
  }
}

function renderCurrentPageByScreenId(screenId) {
  syncSidebarActiveState(screenId);

  if (screenId === 'screen-menu') renderMenuRecentTests();
  if (screenId === 'screen-history') renderHistoryTable();
  if (screenId === 'screen-processes') renderProcessesScreen();
  if (screenId === 'screen-talent-bank') renderTalentBankTable();
  if (screenId === 'screen-candidate') renderCandidateRules();
  if (screenId === 'screen-result') renderResults();
  if (screenId === 'screen-analysis-candidates') renderCandidateAnalyticsPage();

  if (screenId === 'screen-exam') {
    restoreExamScreen();
  }
}

function navigateToScreen(screenId, replace = false) {
  const targetPage = PAGE_BY_SCREEN[screenId] || PAGE_BY_SCREEN['screen-login'];
  persistAppState();
  if (replace) {
    window.location.replace(targetPage);
  } else {
    window.location.href = targetPage;
  }
}

function restoreExamScreen() {
  if (
    !state.candidate ||
    !state.blueprint ||
    !Array.isArray(state.questions) ||
    !state.questions.length
  ) {
    navigateToScreen('screen-config', true);
    return;
  }

  const examCandidateEl = document.getElementById('exam-candidate');
  const examRoleEl = document.getElementById('exam-role');
  const examTrackEl = document.getElementById('exam-track');

  if (examCandidateEl) examCandidateEl.textContent = state.candidate.name || '';
  if (examRoleEl) examRoleEl.textContent = state.candidate.role || '';
  if (examTrackEl) examTrackEl.textContent = state.blueprint.label || '';

  if (state.timerEndsAt) {
    state.timerSeconds = Math.max(
      0,
      Math.floor((Number(state.timerEndsAt) - Date.now()) / 1000),
    );
  }

  clearInterval(state.timerHandle);
  renderTimer();
  renderQuestion();

  if (state.timerSeconds <= 0) {
    finishExam();
    return;
  }

  state.timerHandle = setInterval(() => {
    state.timerSeconds--;
    renderTimer();
    if (state.timerSeconds <= 0) {
      clearInterval(state.timerHandle);
      finishExam();
      return;
    }
    persistAppState();
  }, 1000);
}

window.addEventListener('beforeunload', () => {
  persistAppState();
});

document.addEventListener('DOMContentLoaded', async () => {
  hydrateAppState();

  const roleEl = document.getElementById('candidate-role');
  const levelEl = document.getElementById('candidate-level');
  const trackEl = document.getElementById('candidate-track');

  if (roleEl) {
    roleEl.addEventListener('change', function () {
      const role = (this.value || '').trim();

      const levelMap = {
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

      const trackMap = {
        Estagiário: 'ti',
        Analista: 'adm',
        Outros: 'adm',
        TI: 'ti',
        Supervisor: 'operacao',
        'Control Desk': 'adm',
        Planejamento: 'adm',
      };

      if (levelEl && levelMap[role]) {
        levelEl.value = levelMap[role];
        levelEl.dispatchEvent(new Event('change'));
      }

      if (trackEl && trackMap[role]) {
        trackEl.value = trackMap[role];
        trackEl.dispatchEvent(new Event('change'));
      }

      updateFlowPreview();
    });
  }

  if (levelEl) levelEl.addEventListener('change', updateFlowPreview);
  if (trackEl) trackEl.addEventListener('change', updateFlowPreview);

  ['history-filter-name', 'history-filter-role', 'history-filter-date'].forEach(
    (id) => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('input', () => {
          state.historyPage = 1;
          renderHistoryTable();
        });
      }
    },
  );

  const processRoleEl = document.getElementById('process-role');
  const processOperationEl = document.getElementById('process-operation');
  const processTrackEl = document.getElementById('process-track');

  if (processRoleEl) {
    processRoleEl.addEventListener('change', () => {
      const role = processRoleEl.value.trim();
      const rules = getProcessFormRules(role);

      if (processTrackEl) {
        processTrackEl.value = rules.fixedTrack || '';
        processTrackEl.disabled = !!rules.fixedTrack;
      }

      if (processOperationEl) {
        processOperationEl.disabled = false;
      }
    });
  }

  try {
    await ensureHistoryCsv();
  } catch (error) {
    console.error('Erro ao inicializar histórico compartilhado:', error);
  }

  updateFlowPreview();
  try {
    await populateProcessSelect();
  } catch (error) {
    console.warn(
      'Não foi possível carregar os processos seletivos iniciais:',
      error,
    );
  }

  renderCurrentPageByScreenId(getCurrentPageScreenId());
  persistAppState();
});

function syncSidebarActiveState(screenId) {
  document
    .querySelectorAll('.rh-modern-nav-btn[data-nav-screen]')
    .forEach((btn) => {
      const targetScreen = btn.getAttribute('data-nav-screen');
      btn.classList.toggle('is-active', targetScreen === screenId);
    });
}

function pushScreenToHistory(screenId) {
  return screenId;
}

function showScreen(id, options = {}) {
  const currentScreenId = getCurrentPageScreenId();
  if (id === currentScreenId) {
    renderCurrentPageByScreenId(id);
    return;
  }
  navigateToScreen(id, options.replace === true);
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

const APPS_SCRIPT_URL =
  'https://script.google.com/macros/s/AKfycbwutRScD_OqqcnZFIPOQ9Yrl6vbkPe2QnMQnC6y5n3w/exec';

let historyCache = null;
let answerFilesCache = null;

const apiMemoryCache = {
  processes: null,
  processCandidates: null,
  talentBank: null,
};

const API_CACHE_TTL_MS = 15000;

function getCacheEntry(key) {
  const entry = apiMemoryCache[key];
  if (!entry) return null;

  const age = Date.now() - entry.timestamp;
  if (age > API_CACHE_TTL_MS) {
    apiMemoryCache[key] = null;
    return null;
  }

  return entry.data;
}

function setCacheEntry(key, data) {
  apiMemoryCache[key] = {
    data,
    timestamp: Date.now(),
  };
}

function invalidateApiCache(...keys) {
  keys.forEach((key) => {
    if (Object.prototype.hasOwnProperty.call(apiMemoryCache, key)) {
      apiMemoryCache[key] = null;
    }
  });
}

function toggleSectionBlock(contentId, buttonId) {
  const content = document.getElementById(contentId);
  const button = document.getElementById(buttonId);

  if (!content) return;

  const isHidden = content.classList.contains('d-none');
  content.classList.toggle('d-none', !isHidden);

  if (button) {
    const icon = button.querySelector('.material-symbols-outlined');
    if (icon) {
      icon.textContent = isHidden ? 'expand_less' : 'expand_more';
    }
  }
}

function getProcessFilterValues() {
  return {
    vaga:
      document
        .getElementById('process-filter-vaga')
        ?.value?.trim()
        .toLowerCase() || '',
    operacao:
      document
        .getElementById('process-filter-operacao')
        ?.value?.trim()
        .toLowerCase() || '',
    notaCorte:
      document.getElementById('process-filter-cutoff')?.value?.trim() || '',
    status:
      document
        .getElementById('process-filter-status')
        ?.value?.trim()
        .toLowerCase() || '',
  };
}

function buildProcessActionButton(icon, title, className, onClick) {
  return `
    <button
      type="button"
      class="btn btn-sm ${className}"
      onclick="${onClick}"
      title="${escapeHtml(title)}"
      aria-label="${escapeHtml(title)}"
    >
      <span class="material-symbols-outlined" style="font-size:18px;line-height:1;">${icon}</span>
    </button>
  `;
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

function openFinishConfirm() {
  const overlay = document.getElementById('finish-confirm-overlay');
  if (overlay) overlay.classList.remove('d-none');
}

function closeFinishConfirm() {
  const overlay = document.getElementById('finish-confirm-overlay');
  if (overlay) overlay.classList.add('d-none');
}

function handleFinishConfirmOverlayClick(event) {
  if (event.target?.id === 'finish-confirm-overlay') {
    closeFinishConfirm();
  }
}

function confirmFinishExam() {
  state.finishStatus = 'Encerrado pelo candidato';
  closeFinishConfirm();
  finishExam();
}

function handleRhObservationChange() {
  const input = document.getElementById('rh-observation-input');
  const printBox = document.getElementById('print-rh-observation');
  const value = (input?.value || '').trim();

  state.rhObservation = value;

  if (printBox) {
    printBox.textContent =
      value || 'Anotações sobre desempenho, postura, tempo, etc.';
  }
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

async function exportHistoryCsv() {
  try {
    const csv = await ensureHistoryCsv();
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    downloadBlob('historico_testes.csv', blob);
  } catch (error) {
    console.error(error);
    alert('Não foi possível exportar o histórico do servidor.');
  }
}

function clearHistoryFilters() {
  const nameEl = document.getElementById('history-filter-name');
  const roleEl = document.getElementById('history-filter-role');
  const dateEl = document.getElementById('history-filter-date');

  if (nameEl) nameEl.value = '';
  if (roleEl) roleEl.value = '';
  if (dateEl) dateEl.value = '';

  state.historyPage = 1;
  renderHistoryTable();
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

async function ensureHistoryCsv() {
  return 'ok';
}

async function readHistoryRows() {
  const response = await fetch(`${API_BASE_URL}/history`, {
    method: 'GET',
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`Falha ao carregar histórico. Status: ${response.status}`);
  }

  const rows = await response.json();

  if (!Array.isArray(rows)) return [];

  return rows.filter(
    (row) =>
      row &&
      typeof row === 'object' &&
      (row.id_teste || row.nome_candidato || row.vaga || row.data_iso),
  );
}

async function readProcesses(forceRefresh = false) {
  if (!forceRefresh) {
    const cached = getCacheEntry('processes');
    if (cached) return cached;
  }

  const response = await fetch(`${API_BASE_URL}/processes`, {
    method: 'GET',
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`Falha ao carregar processos. Status: ${response.status}`);
  }

  const data = await response.json();
  setCacheEntry('processes', Array.isArray(data) ? data : []);
  return Array.isArray(data) ? data : [];
}

async function saveProcess(processData) {
  const response = await fetch(`${API_BASE_URL}/processes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(processData),
  });

  if (!response.ok) {
    invalidateApiCache('processes');
    const errorText = await response.text();
    throw new Error(`Falha ao criar processo: ${errorText}`);
  }
}

async function updateProcess(idProcesso, processData) {
  const response = await fetch(
    `${API_BASE_URL}/processes/${encodeURIComponent(idProcesso)}`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(processData),
    },
  );

  if (!response.ok) {
    invalidateApiCache('processes');
    const errorText = await response.text();
    throw new Error(`Falha ao atualizar processo: ${errorText}`);
  }
}

async function closeProcess(idProcesso) {
  const response = await fetch(
    `${API_BASE_URL}/processes/${encodeURIComponent(idProcesso)}/close`,
    {
      method: 'POST',
    },
  );

  if (!response.ok) {
    invalidateApiCache('processes');
    const errorText = await response.text();
    throw new Error(`Falha ao encerrar processo: ${errorText}`);
  }
}

async function readProcessCandidates(forceRefresh = false) {
  if (!forceRefresh) {
    const cached = getCacheEntry('processCandidates');
    if (cached) return cached;
  }

  const response = await fetch(`${API_BASE_URL}/process-candidates`, {
    method: 'GET',
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(
      `Falha ao carregar candidatos do processo. Status: ${response.status}`,
    );
  }

  const data = await response.json();
  setCacheEntry('processCandidates', Array.isArray(data) ? data : []);
  return Array.isArray(data) ? data : [];
}

async function saveProcessCandidate(candidateData) {
  const response = await fetch(`${API_BASE_URL}/process-candidates`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(candidateData),
  });

  if (!response.ok) {
    invalidateApiCache('processCandidates', 'talentBank');
    const errorText = await response.text();
    throw new Error(`Falha ao vincular candidato ao processo: ${errorText}`);
  }
}

async function updateProcessCandidateStatus(idRegistro, statusData) {
  const response = await fetch(
    `${API_BASE_URL}/process-candidates/${idRegistro}/status`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(statusData),
    },
  );

  if (!response.ok) {
    invalidateApiCache('processes', 'processCandidates', 'talentBank');
    const errorText = await response.text();
    throw new Error(`Falha ao atualizar status do candidato: ${errorText}`);
  }
}

async function readTalentBank(forceRefresh = false) {
  if (!forceRefresh) {
    const cached = getCacheEntry('talentBank');
    if (cached) return cached;
  }

  const response = await fetch(`${API_BASE_URL}/talent-bank`, {
    method: 'GET',
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(
      `Falha ao carregar banco de talentos. Status: ${response.status}`,
    );
  }

  const data = await response.json();
  setCacheEntry('talentBank', Array.isArray(data) ? data : []);
  return Array.isArray(data) ? data : [];
}

async function buildCandidateCurrentStatusMap() {
  const [processCandidates, talentBank] = await Promise.all([
    readProcessCandidates().catch(() => []),
    readTalentBank().catch(() => []),
  ]);

  const statusMap = {};

  processCandidates.forEach((candidate) => {
    const idTeste = String(candidate.id_teste || '').trim();
    if (!idTeste) return;

    const idProcesso = String(candidate.id_processo || '').trim();
    const status =
      String(candidate.status_candidato || '').trim() || 'Em análise';

    let label = status;
    if (idProcesso) {
      label = `${status} • ${idProcesso}`;
    }

    statusMap[idTeste] = {
      status,
      processId: idProcesso,
      label,
    };
  });

  talentBank.forEach((candidate) => {
    const idTeste = String(candidate.id_teste || '').trim();
    if (!idTeste) return;

    const idProcesso = String(candidate.id_processo || '').trim();

    const existing = statusMap[idTeste];
    const existingStatus = String(existing?.status || '').trim();

    /* Só assume Banco de talentos se não existir status mais atual
       ou se o status atual ainda estiver Em análise */
    if (!existing || existingStatus === 'Em análise' || existingStatus === '') {
      statusMap[idTeste] = {
        status: 'Banco de talentos',
        processId: idProcesso,
        label: idProcesso
          ? `Banco de talentos • ${idProcesso}`
          : 'Banco de talentos',
      };
    }
  });

  return statusMap;
}

function getCurrentSituationLabel(row, statusMap) {
  const idTeste = String(row?.id_teste || '').trim();
  const historyProcessId = String(row?.id_processo || '').trim();
  const mapped = statusMap?.[idTeste];

  if (mapped?.label) return mapped.label;

  if (historyProcessId) {
    return `Em análise • ${historyProcessId}`;
  }

  return 'Processo individual';
}

function getCurrentSituationBadgeClass(label) {
  const normalized = safeUpper(label).normalize('NFD').replace(/[̀-ͯ]/g, '');

  if (normalized.includes('APROVADO')) return 'is-finished';
  if (normalized.includes('ELIMINADO')) return 'is-unsaved';
  if (normalized.includes('BANCO DE TALENTOS')) return 'is-neutral';
  if (normalized.includes('EM ANALISE')) return 'is-neutral';

  return 'is-neutral';
}

function getProcessRoleAbbreviation(role) {
  const map = {
    'Jovem Aprendiz': 'JV.AP',
    Supervisor: 'SUP',
    Operador: 'OPR',
    Analista: 'ANL',
    Estagiário: 'ESTG',
    Outros: 'OUT',
    'Control Desk': 'CTRL',
    Planejamento: 'PLAN',
    TI: 'TI',
  };

  return map[String(role || '').trim()] || 'OUT';
}

function buildProcessId(role) {
  const rolePart = getProcessRoleAbbreviation(role);
  return `PROC.${rolePart}`;
}

function getProcessFormRules(role) {
  const safeRole = String(role || '').trim();

  if (safeRole === 'Operador' || safeRole === 'Supervisor') {
    return {
      requiresOperation: true,
      requiresTrack: false,
      fixedTrack: '',
    };
  }

  if (safeRole === 'Control Desk') {
    return {
      requiresOperation: false,
      requiresTrack: false,
      fixedTrack: '',
    };
  }

  if (safeRole === 'Estagiário') {
    return {
      requiresOperation: false,
      requiresTrack: true,
      fixedTrack: '',
    };
  }

  if (safeRole === 'Analista' || safeRole === 'TI') {
    return {
      requiresOperation: false,
      requiresTrack: false,
      fixedTrack: 'TI',
    };
  }

  if (safeRole === 'Jovem Aprendiz') {
    return {
      requiresOperation: true,
      requiresTrack: false,
      fixedTrack: '',
    };
  }

  return {
    requiresOperation: false,
    requiresTrack: false,
    fixedTrack: '',
  };
}

async function refreshHomeData() {
  try {
    answerFilesCache = null;
    historyCache = null;
    await renderMenuRecentTests();
    alert('Informações atualizadas com sucesso.');
  } catch (error) {
    console.error('Erro ao atualizar dados da tela inicial:', error);
    alert('Não foi possível atualizar as informações.');
  }
}

async function createProcess() {
  const role = document.getElementById('process-role')?.value?.trim() || '';
  const quantity = Number(
    document.getElementById('process-quantity')?.value || 0,
  );
  const endDate = document.getElementById('process-end-date')?.value || '';
  const operation =
    document.getElementById('process-operation')?.value?.trim() || '';
  const trackInput =
    document.getElementById('process-track')?.value?.trim() || '';
  const hasCutoff =
    document.getElementById('process-has-cutoff')?.checked || false;

  const cutoffValueRaw =
    document.getElementById('process-cutoff-value')?.value || '';

  const cutoffValue = cutoffValueRaw ? Number(cutoffValueRaw) : null;
  const alertEl = document.getElementById('process-create-alert');

  const rules = getProcessFormRules(role);
  const finalTrack = rules.fixedTrack || trackInput;

  if (!role || !quantity || !endDate) {
    if (alertEl) {
      alertEl.textContent =
        'Preencha a vaga, a quantidade de vagas e a data de encerramento.';
      alertEl.classList.remove('d-none');
    }
    return;
  }

  if (rules.requiresOperation && !operation) {
    if (alertEl) {
      alertEl.textContent =
        'Para essa vaga, é obrigatório informar a operação.';
      alertEl.classList.remove('d-none');
    }
    return;
  }

  if (rules.requiresTrack && !finalTrack) {
    if (alertEl) {
      alertEl.textContent = 'Para essa vaga, é obrigatório informar a trilha.';
      alertEl.classList.remove('d-none');
    }
    return;
  }

  if (alertEl) {
    alertEl.classList.add('d-none');
  }

  const now = new Date();

  if (hasCutoff) {
    if (cutoffValue === null || Number.isNaN(cutoffValue)) {
      if (alertEl) {
        alertEl.textContent = 'Defina a nota de corte.';
        alertEl.classList.remove('d-none');
      }
      return;
    }

    if (cutoffValue < 4 || cutoffValue > 10) {
      if (alertEl) {
        alertEl.textContent = 'A nota de corte deve estar entre 4 e 10.';
        alertEl.classList.remove('d-none');
      }
      return;
    }
  }

  try {
    await saveProcess({
      id_processo: buildProcessId(role),
      vaga: role,
      quantidade_vagas: quantity,
      vagas_preenchidas: 0,
      data_encerramento: endDate,
      operacao: operation,
      trilha: finalTrack,
      usa_nota_corte: hasCutoff ? 1 : 0,
      nota_corte: hasCutoff ? cutoffValue : null,
      status: 'Aberto',
      data_criacao: now.toISOString(),
    });

    await populateProcessSelect();
    goToProcesses();
  } catch (error) {
    console.error('Erro ao criar processo:', error);

    if (alertEl) {
      alertEl.textContent =
        error?.message ||
        'Não foi possível criar o processo seletivo. Verifique a tabela processos_seletivos no Access e reinicie a API.';
      alertEl.classList.remove('d-none');
    }
  }
}

async function populateProcessSelect() {
  const select = document.getElementById('candidate-process');
  if (!select) return;

  const processes = await readProcesses();
  const openProcesses = processes.filter(
    (p) => String(p.status || '').trim() !== 'Encerrado',
  );

  select.innerHTML =
    '<option value="">Selecione...</option>' +
    '<option value="PROCESSO_UNICO">Processo Único</option>' +
    openProcesses
      .map(
        (p) => `
        <option value="${escapeHtml(p.id_processo)}">
          ${escapeHtml(p.id_processo)} • ${escapeHtml(p.vaga)} • ${escapeHtml(p.operacao || p.trilha || '-')} • ${escapeHtml(p.data_encerramento || '-')}
        </option>
      `,
      )
      .join('');
}

async function renderProcessesScreen() {
  const processBody = document.getElementById('processes-table-body');
  const closedProcessBody = document.getElementById(
    'closed-processes-table-body',
  );
  const candidatesBody = document.getElementById(
    'process-candidates-table-body',
  );

  if (!processBody || !closedProcessBody || !candidatesBody) return;

  const [processes, candidates] = await Promise.all([
    readProcesses(),
    readProcessCandidates(),
  ]);

  const filters = getProcessFilterValues();

  const openProcesses = processes
    .filter((process) => String(process.status || '').trim() !== 'Encerrado')
    .filter((process) => {
      const vaga = String(process.vaga || '').toLowerCase();
      const operacao = String(process.operacao || '').toLowerCase();
      const usaNotaCorte = Number(process.usa_nota_corte || 0) ? 'sim' : 'não';
      const status = String(process.status || '').toLowerCase();

      const matchVaga = !filters.vaga || vaga.includes(filters.vaga);
      const matchOperacao =
        !filters.operacao || operacao.includes(filters.operacao);
      const matchCutoff =
        !filters.notaCorte || usaNotaCorte === filters.notaCorte.toLowerCase();
      const matchStatus = !filters.status || status.includes(filters.status);

      return matchVaga && matchOperacao && matchCutoff && matchStatus;
    });

  const closedProcesses = processes.filter(
    (process) => String(process.status || '').trim() === 'Encerrado',
  );

  const activeCandidates = candidates.filter(
    (candidate) =>
      String(candidate.status_candidato || '').trim() === 'Em análise',
  );

  if (!openProcesses.length) {
    processBody.innerHTML =
      '<tr><td colspan="10" class="text-center text-muted py-4">Nenhum processo aberto encontrado.</td></tr>';
  } else {
    processBody.innerHTML = openProcesses
      .map((process) => {
        const editBtn = buildProcessActionButton(
          'edit',
          'Editar',
          'btn-outline-secondary',
          `openEditProcessModal(
            '${escapeHtml(process.id_processo || '')}',
            '${escapeHtml(process.vaga || '')}',
            ${Number(process.quantidade_vagas || 0)},
            '${escapeHtml(process.data_encerramento || '')}',
            '${escapeHtml(process.operacao || '')}',
            '${escapeHtml(process.trilha || '')}',
            '${escapeHtml(process.status || 'Aberto')}',
            ${Number(process.usa_nota_corte || 0)},
            '${escapeHtml(process.nota_corte || '')}'
          )`,
        );

        const detailBtn = buildProcessActionButton(
          'visibility',
          'Detalhes',
          'btn-outline-primary',
          `openProcessDetails('${escapeHtml(process.id_processo || '')}')`,
        );

        const closeBtn = buildProcessActionButton(
          'cancel',
          'Encerrar',
          'btn-outline-danger',
          `openCloseProcessConfirm('${escapeHtml(process.id_processo || '')}')`,
        );

        return `
          <tr>
            <td>${escapeHtml(process.id_processo || '-')}</td>
            <td>${escapeHtml(process.vaga || '-')}</td>
            <td>${escapeHtml(process.operacao || '-')}</td>
            <td>${escapeHtml(process.trilha || '-')}</td>
            <td>${Number(process.usa_nota_corte || 0) ? 'Sim' : 'Não'}</td>
            <td>${escapeHtml(process.nota_corte || '-')}</td>
            <td>${escapeHtml(`${process.vagas_preenchidas || 0}/${process.quantidade_vagas || 0}`)}</td>
            <td>${escapeHtml(process.data_encerramento || '-')}</td>
            <td><span class="rh-status-pill is-finished">${escapeHtml(process.status || '-')}</span></td>
            <td class="text-end">
              <div class="d-flex justify-content-end gap-2 flex-wrap">
                ${editBtn}
                ${detailBtn}
                ${closeBtn}
              </div>
            </td>
          </tr>
        `;
      })
      .join('');
  }

  if (!closedProcesses.length) {
    closedProcessBody.innerHTML =
      '<tr><td colspan="10" class="text-center text-muted py-4">Nenhum processo encerrado.</td></tr>';
  } else {
    closedProcessBody.innerHTML = closedProcesses
      .map((process) => {
        const detailBtn = buildProcessActionButton(
          'visibility',
          'Detalhes',
          'btn-outline-primary',
          `openProcessDetails('${escapeHtml(process.id_processo || '')}')`,
        );

        return `
          <tr>
            <td>${escapeHtml(process.id_processo || '-')}</td>
            <td>${escapeHtml(process.vaga || '-')}</td>
            <td>${escapeHtml(process.operacao || '-')}</td>
            <td>${escapeHtml(process.trilha || '-')}</td>
            <td>${Number(process.usa_nota_corte || 0) ? 'Sim' : 'Não'}</td>
            <td>${escapeHtml(process.nota_corte || '-')}</td>
            <td>${escapeHtml(`${process.vagas_preenchidas || 0}/${process.quantidade_vagas || 0}`)}</td>
            <td>${escapeHtml(process.data_encerramento || '-')}</td>
            <td><span class="rh-status-pill is-unsaved">${escapeHtml(process.status || '-')}</span></td>
            <td class="text-end">
              <div class="d-flex justify-content-end gap-2 flex-wrap">
                ${detailBtn}
              </div>
            </td>
          </tr>
        `;
      })
      .join('');
  }

  if (!activeCandidates.length) {
    candidatesBody.innerHTML =
      '<tr><td colspan="6" class="text-center text-muted py-4">Nenhum candidato em análise vinculado a processo.</td></tr>';
  } else {
    candidatesBody.innerHTML = activeCandidates
      .map(
        (candidate) => `
        <tr>
          <td>${escapeHtml(candidate.id_processo || '-')}</td>
          <td>${escapeHtml(candidate.nome_candidato || '-')}</td>
          <td>${escapeHtml(candidate.vaga || '-')}</td>
          <td>${escapeHtml(candidate.pontuacao_final || '-')}</td>
          <td>${escapeHtml(candidate.status_candidato || '-')}</td>
          <td class="text-end">
            <div class="d-flex justify-content-end gap-2 flex-wrap">
              ${buildProcessActionButton('check_circle', 'Aprovar', 'btn-outline-success', `setCandidateProcessStatus(${candidate.id_registro}, 'Aprovado', '${escapeHtml(candidate.id_processo || '')}')`)}
              ${buildProcessActionButton('dangerous', 'Eliminar', 'btn-outline-danger', `setCandidateProcessStatus(${candidate.id_registro}, 'Eliminado', '${escapeHtml(candidate.id_processo || '')}')`)}
              ${buildProcessActionButton('groups', 'Banco de talentos', 'btn-outline-secondary', `setCandidateProcessStatus(${candidate.id_registro}, 'Banco de talentos', '${escapeHtml(candidate.id_processo || '')}')`)}
            </div>
          </td>
        </tr>
      `,
      )
      .join('');
  }
}

function toggleProcessCutoffField() {
  const toggle = document.getElementById('process-has-cutoff');
  const input = document.getElementById('process-cutoff-value');
  if (!toggle || !input) return;

  input.disabled = !toggle.checked;

  if (!toggle.checked) {
    input.value = '';
  }
}

function openEditProcessModal(
  idProcesso,
  vaga,
  quantidade,
  dataEncerramento,
  operacao,
  trilha,
) {
  const overlay = document.getElementById('edit-process-overlay');
  if (!overlay) return;

  document.getElementById('edit-process-id').value = idProcesso || '';
  document.getElementById('edit-process-role').value = vaga || '';
  document.getElementById('edit-process-quantity').value = quantidade || 0;
  document.getElementById('edit-process-end-date').value = formatDateToInput(
    dataEncerramento || '',
  );
  document.getElementById('edit-process-operation').value = operacao || '';
  document.getElementById('edit-process-track').value = trilha || '';

  const alertEl = document.getElementById('edit-process-alert');
  if (alertEl) alertEl.classList.add('d-none');

  overlay.classList.remove('d-none');
}

function closeEditProcessModal() {
  const overlay = document.getElementById('edit-process-overlay');
  if (overlay) overlay.classList.add('d-none');
}

function handleEditProcessOverlayClick(event) {
  if (event.target?.id === 'edit-process-overlay') {
    closeEditProcessModal();
  }
}

async function saveEditedProcess() {
  const idProcesso =
    document.getElementById('edit-process-id')?.value?.trim() || '';
  const quantidade = Number(
    document.getElementById('edit-process-quantity')?.value || 0,
  );
  const dataEncerramento =
    document.getElementById('edit-process-end-date')?.value || '';
  const operacao =
    document.getElementById('edit-process-operation')?.value?.trim() || '';
  const trilha =
    document.getElementById('edit-process-track')?.value?.trim() || '';
  const alertEl = document.getElementById('edit-process-alert');

  if (!idProcesso || !quantidade || !dataEncerramento) {
    if (alertEl) {
      alertEl.textContent = 'Preencha os campos obrigatórios.';
      alertEl.classList.remove('d-none');
    }
    return;
  }

  await updateProcess(idProcesso, {
    quantidade_vagas: quantidade,
    data_encerramento: dataEncerramento,
    operacao: operacao,
    trilha: trilha,
  });

  closeEditProcessModal();
  await populateProcessSelect();
  await renderProcessesScreen();
}

async function handleCloseProcess(idProcesso) {
  if (!confirm(`Deseja encerrar o processo ${idProcesso}?`)) {
    return;
  }

  await closeProcess(idProcesso);
  await populateProcessSelect();
  await renderProcessesScreen();
}

async function editProcessPrompt(
  idProcesso,
  quantidadeAtual,
  dataAtual,
  operacaoAtual,
  trilhaAtual,
  statusAtual,
) {
  const novaQuantidade = prompt('Nova quantidade de vagas:', quantidadeAtual);
  if (novaQuantidade === null) return;

  const novaData = prompt('Nova data de encerramento (YYYY-MM-DD):', dataAtual);
  if (novaData === null) return;

  const novaOperacao = prompt('Operação:', operacaoAtual);
  if (novaOperacao === null) return;

  const novaTrilha = prompt('Trilha:', trilhaAtual);
  if (novaTrilha === null) return;

  await updateProcess(idProcesso, {
    quantidade_vagas: Number(novaQuantidade || quantidadeAtual),
    data_encerramento: novaData || dataAtual,
    operacao: novaOperacao || operacaoAtual,
    trilha: novaTrilha || trilhaAtual,
    status: statusAtual || 'Aberto',
  });

  await populateProcessSelect();
  await renderProcessesScreen();
}

async function setCandidateProcessStatus(
  idRegistro,
  statusCandidato,
  idProcesso,
) {
  if (statusCandidato === 'Aprovado') {
    const processes = await readProcesses();
    const process = processes.find(
      (p) => String(p.id_processo) === String(idProcesso),
    );

    if (process && Number(process.quantidade_vagas || 0) === 1) {
      const confirmed = confirm(
        'Este processo possui apenas 1 vaga. Ao aprovar o candidato, o processo será automaticamente finalizado. Deseja continuar?',
      );
      if (!confirmed) return;
    }
  }

  await updateProcessCandidateStatus(idRegistro, {
    status_candidato: statusCandidato,
    data_movimentacao: new Date().toISOString(),
  });

  await renderProcessesScreen();
  await renderTalentBankTable();
  await populateProcessSelect();

  const overlay = document.getElementById('process-details-overlay');
  if (overlay && !overlay.classList.contains('d-none')) {
    await openProcessDetails(idProcesso);
  }
}

async function removeTalentBankCandidate(idBanco) {
  const confirmed = confirm(
    'Deseja eliminar este candidato do banco de talentos? Ele deixará de aparecer nesta lista.',
  );
  if (!confirmed) return;

  const response = await fetch(`${API_BASE_URL}/talent-bank/${idBanco}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Falha ao eliminar candidato do banco de talentos: ${errorText}`,
    );
  }
  invalidateApiCache('talentBank', 'processCandidates', 'processes');
  await renderTalentBankTable();
}

async function useTalentBankCandidate(idBanco) {
  const openProcesses = (await readProcesses()).filter(
    (process) => String(process.status || '').trim() !== 'Encerrado',
  );

  if (!openProcesses.length) {
    alert('Não há processo aberto no momento.');
    return;
  }

  const optionsText = openProcesses
    .map(
      (process, index) =>
        `${index + 1} - ${process.id_processo} | ${process.vaga} | ${process.operacao || process.trilha || '-'}`,
    )
    .join('\n');

  const choice = prompt(
    `Selecione o número do processo para inserir o candidato:\n\n${optionsText}`,
  );

  if (choice === null) return;

  const selectedIndex = Number(choice) - 1;
  const selectedProcess = openProcesses[selectedIndex];

  if (!selectedProcess) {
    alert('Processo inválido.');
    return;
  }

  const response = await fetch(`${API_BASE_URL}/talent-bank/${idBanco}/use`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id_processo: selectedProcess.id_processo,
    }),
  });

  if (!response.ok) {
    invalidateApiCache('talentBank', 'processCandidates', 'processes');
    const errorText = await response.text();
    throw new Error(
      `Falha ao utilizar candidato do banco de talentos: ${errorText}`,
    );
  }

  await renderTalentBankTable();
  await renderProcessesScreen();
}

async function renderTalentBankTable() {
  const body = document.getElementById('talent-bank-table-body');
  if (!body) return;

  const rows = await readTalentBank();

  if (!rows.length) {
    body.innerHTML =
      '<tr><td colspan="7" class="text-center text-muted py-4">Nenhum candidato no banco de talentos.</td></tr>';
    return;
  }

  body.innerHTML = rows
    .map(
      (row) => `
    <tr>
      <td>${escapeHtml(row.id_processo || '-')}</td>
      <td>${escapeHtml(row.nome_candidato || '-')}</td>
      <td>${escapeHtml(row.vaga || '-')}</td>
      <td>${escapeHtml(row.pontuacao_final || '-')}</td>
      <td>${escapeHtml(row.data_movimentacao || '-')}</td>
      <td>${escapeHtml(row.origem || '-')}</td>
      <td class="text-end">
        <div class="d-flex justify-content-end gap-2 flex-wrap">
          <button type="button" class="btn btn-sm btn-outline-danger" onclick="removeTalentBankCandidate(${Number(row.id_banco || 0)})">
            Eliminar candidato
          </button>
          <button type="button" class="btn btn-sm btn-outline-primary" onclick="useTalentBankCandidate(${Number(row.id_banco || 0)})">
            Utilizar candidato
          </button>
        </div>
      </td>
    </tr>
  `,
    )
    .join('');
}

async function saveHistoryRow(row) {
  const response = await fetch(`${API_BASE_URL}/history`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(row),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Falha ao salvar histórico: ${errorText}`);
  }

  historyCache = null;
}

async function getAnswerFiles() {
  if (answerFilesCache) return answerFilesCache;

  const response = await fetch(`${API_BASE_URL}/answer-files`, {
    method: 'GET',
    cache: 'no-store',
  });
  if (!response.ok) {
    throw new Error(`Falha ao carregar gabaritos. Status: ${response.status}`);
  }

  answerFilesCache = await response.json();
  return answerFilesCache || {};
}

async function saveAnswerFile(recordId, payload) {
  const response = await fetch(`${API_BASE_URL}/answer-files`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      recordId,
      payload,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Falha ao salvar gabarito: ${errorText}`);
  }

  answerFilesCache = null;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

async function normalizeRecentStatus(row) {
  const files = await getAnswerFiles();
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

function getPagedItems(items, currentPage, pageSize) {
  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(Math.max(1, currentPage), totalPages);
  const start = (safePage - 1) * pageSize;
  const end = start + pageSize;

  return {
    items: items.slice(start, end),
    totalItems,
    totalPages,
    currentPage: safePage,
  };
}

function buildPaginationHtml(currentPage, totalPages, onClickFnName) {
  if (totalPages <= 1) return '';

  let html = '';

  html += `
    <button type="button" class="btn btn-outline-secondary btn-sm" ${currentPage === 1 ? 'disabled' : ''} onclick="${onClickFnName}(${currentPage - 1})">
      Anterior
    </button>
  `;

  for (let page = 1; page <= totalPages; page += 1) {
    html += `
      <button type="button" class="btn btn-sm ${page === currentPage ? 'btn-primary' : 'btn-outline-primary'}" onclick="${onClickFnName}(${page})">
        ${page}
      </button>
    `;
  }

  html += `
    <button type="button" class="btn btn-outline-secondary btn-sm" ${currentPage === totalPages ? 'disabled' : ''} onclick="${onClickFnName}(${currentPage + 1})">
      Próxima
    </button>
  `;

  return html;
}

function goToRecentPage(page) {
  state.recentPage = page;
  renderMenuRecentTests();
}

function goToHistoryPage(page) {
  state.historyPage = page;
  renderHistoryTable();
}

async function getAnswerFilesSafe() {
  try {
    return await getAnswerFiles();
  } catch (error) {
    console.warn('Não foi possível carregar os gabaritos detalhados:', error);
    return {};
  }
}

async function renderMenuRecentTests() {
  const list = document.getElementById('menu-recent-list');
  const empty = document.getElementById('menu-recent-empty');
  if (!list) return;

  try {
    const rows = (await readHistoryRows()).sort((a, b) =>
      a.data_iso < b.data_iso ? 1 : -1,
    );

    if (!rows.length) {
      list.innerHTML = '';
      if (empty) empty.classList.remove('d-none');
      return;
    }

    if (empty) empty.classList.add('d-none');

    const files = await getAnswerFilesSafe();
    const currentStatusMap = await buildCandidateCurrentStatusMap();
    const recentItems = rows.slice(0, state.recentPageSize);

    const cards = await Promise.all(
      recentItems.map(async (row) => {
        const saved = files[row?.id_teste];
        const rawStatus = String(row?.status || '').trim();
        const status =
          rawStatus || (saved?.content ? 'Finalizado' : 'Finalizado');
        const statusClass = getRecentStatusClass(status);

        const currentSituation = getCurrentSituationLabel(
          row,
          currentStatusMap,
        );
        const currentSituationClass =
          getCurrentSituationBadgeClass(currentSituation);

        return `
  <button type="button" class="rh-recent-card btn text-start" data-record-id="${escapeHtml(row.id_teste)}">
    <div class="rh-recent-avatar-wrap">
      <img
        src="style/avatar-candidato.png"
        alt="Foto de perfil do candidato"
        class="rh-recent-avatar"
      >
    </div>

    <div class="rh-recent-card-top">
      <div class="rh-recent-top-right">
        <span class="rh-recent-score-label">NOTA</span>
        <span class="rh-recent-score">${escapeHtml(formatDetailScore(row.pontuacao_final, saved?.weightedFinalScore || row?.weightedFinalScore || '0,0'))}</span>
      </div>
    </div>

    <span class="rh-recent-name">${escapeHtml(row.nome_candidato || 'Sem nome')}</span>
    <span class="rh-recent-date">${escapeHtml(row.data_exibicao || '-')}</span>

    <div class="rh-recent-card-bottom">
      <span class="rh-recent-role">${escapeHtml(row.vaga || '-')}</span>
      <span class="rh-status-pill ${statusClass}">${escapeHtml(status)}</span>
    </div>

    <div class="mt-2">
      <span class="rh-status-pill ${currentSituationClass}">
        ${escapeHtml(currentSituation)}
      </span>
    </div>
  </button>
`;
      }),
    );

    list.innerHTML = cards.join('');
    list.querySelectorAll('[data-record-id]').forEach((card) => {
      card.addEventListener('click', () => {
        const recordId = card.getAttribute('data-record-id');
        if (recordId) openRecentTestDetails(recordId);
      });
    });
  } catch (error) {
    console.error('Erro ao renderizar últimos testes:', error);
    list.innerHTML = '';
    if (empty) empty.classList.remove('d-none');
  }
}

function getActiveDetailsModalRefs() {
  const historyScreen = document.getElementById('screen-history');
  const isHistoryActive = historyScreen?.classList.contains('active');

  if (isHistoryActive) {
    return {
      overlay: document.getElementById('history-test-details-overlay'),
      title: document.getElementById('history-test-details-title'),
      body: document.getElementById('history-test-details-body'),
      downloadBtn: null,
      closeFn: 'closeHistoryTestDetails',
    };
  }

  return {
    overlay: document.getElementById('recent-test-details-overlay'),
    title: document.getElementById('recent-test-details-title'),
    body: document.getElementById('recent-test-details-body'),
    downloadBtn: document.getElementById('recent-test-download-btn'),
    closeFn: 'closeRecentTestDetails',
  };
}

function closeHistoryTestDetails() {
  const overlay = document.getElementById('history-test-details-overlay');
  const body = document.getElementById('history-test-details-body');
  if (body) body.innerHTML = '';
  if (overlay) overlay.classList.add('d-none');
}

function handleHistoryDetailsOverlayClick(event) {
  if (event.target?.id === 'history-test-details-overlay') {
    closeHistoryTestDetails();
  }
}

async function openRecentTestDetails(recordId) {
  const refs = getActiveDetailsModalRefs();
  const overlay = refs.overlay;
  const title = refs.title;
  const body = refs.body;
  const downloadBtn = refs.downloadBtn;

  if (!overlay || !title || !body) return;

  const rows = await readHistoryRows();
  const row = rows.find((item) => item.id_teste === recordId);
  if (!row) {
    body.innerHTML =
      '<div class="alert alert-danger mb-0">Não foi possível localizar os dados desta prova.</div>';
    title.textContent = 'Detalhes da prova';
    if (downloadBtn) downloadBtn.disabled = true;
    overlay.classList.remove('d-none');
    return;
  }

  const savedFiles = await getAnswerFilesSafe();
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

  let historyStageSummary = [];
  if (row?.etapas_json) {
    try {
      const parsedStages = JSON.parse(row.etapas_json);
      if (Array.isArray(parsedStages)) {
        historyStageSummary = parsedStages;
      }
    } catch (error) {
      console.warn('Erro ao interpretar etapas_json do histórico:', error);
    }
  }

  const stageSummary = Array.isArray(payload?.stageSummary)
    ? payload.stageSummary
    : historyStageSummary;

  const fullLog = payload?.textContent || '';
  const status = await normalizeRecentStatus(row);
  const statusClass = getRecentStatusClass(status);
  const currentStatusMap = await buildCandidateCurrentStatusMap();
  const currentSituation = getCurrentSituationLabel(row, currentStatusMap);
  const currentSituationClass = getCurrentSituationBadgeClass(currentSituation);
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
                  Aproveitamento: ${escapeHtml(((stage.percent || 0) * 100).toFixed(1))}%<br>
                  Nota ponderada: ${escapeHtml(Number(stage.weightedScore || 0).toFixed(1))}<br>
                  Itens avaliados: ${escapeHtml(stage.questionCount ?? 0)}${stage.pendings ? `<br>Pendências de revisão: ${escapeHtml(stage.pendings)}` : ''}
                </div>
              </div>
            `,
          )
          .join('')}
      </div>
    `
    : `
      <div class="alert alert-secondary mb-0">
        Este candidato possui apenas o resumo salvo no histórico. As notas detalhadas por etapa não foram registradas nesta prova.
      </div>
    `;
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
  <span class="rh-detail-value">${escapeHtml(formatDetailScore(row.pontuacao_final, payload?.weightedFinalScore))}</span>
</div>
        <div class="rh-detail-card">
          <span class="rh-detail-label">Tempo</span>
          <span class="rh-detail-value">${escapeHtml(row.tempo_minutos ? `${row.tempo_minutos} min` : '-')}</span>
        </div>
        <div class="rh-detail-card">
  <span class="rh-detail-label">Situação atual</span>
  <span class="rh-status-pill ${currentSituationClass}">
    ${escapeHtml(currentSituation)}
  </span>
</div>
      </div>
      <div class="rh-detail-card">
  <span class="rh-detail-label">Processo seletivo</span>
  <span class="rh-detail-value">
    ${
      row.id_processo && String(row.id_processo).trim()
        ? escapeHtml(row.id_processo)
        : '<span class="rh-status-pill is-neutral">Processo Único</span>'
    }
  </span>
</div>
    </section>

    <section class="rh-details-section">
      <h4 class="rh-details-section-title">Notas por etapa</h4>
      ${stageCardsHtml}
    </section>

    <section class="rh-details-section">
  <h4 class="rh-details-section-title">Registro completo</h4>
  ${
    fullLog
      ? `<pre class="rh-detail-log">${escapeHtml(fullLog)}</pre>`
      : `
        <div class="alert alert-secondary mb-0">
          Esta prova não possui gabarito detalhado salvo para consulta. Apenas o resumo geral foi encontrado no histórico.
        </div>
      `
  }
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

function downloadRecentTestPackage() {
  const downloadBtn = document.getElementById('recent-test-download-btn');
  const recordId = downloadBtn?.getAttribute('data-record-id') || '';
  const candidateName =
    downloadBtn?.getAttribute('data-candidate-name') || 'candidato';

  if (!recordId) {
    alert('Nenhuma prova foi associada a este registro.');
    return;
  }

  downloadHistoryExamPackage(recordId, candidateName);
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

function formatDetailScore(rowScore, payloadScore) {
  const rawValue =
    rowScore !== undefined && rowScore !== null && rowScore !== ''
      ? rowScore
      : payloadScore;

  if (rawValue === undefined || rawValue === null || rawValue === '') {
    return '-';
  }

  const text = String(rawValue).trim();

  if (/^\d+,\d+$/.test(text)) {
    return text;
  }

  const numeric = Number(text.replace(',', '.'));

  if (!Number.isNaN(numeric)) {
    return numeric.toLocaleString('pt-BR', {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    });
  }

  return text;
}

function arrayBufferToBase64(buffer) {
  if (!buffer) return '';
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;

  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary);
}

function base64ToUint8Array(base64) {
  if (!base64) return null;
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes;
}

function buildAnswerKeyPayload(recordId) {
  const uploadedFiles = state.questions
    .map((q, index) => {
      const answer = state.answers[index];
      if (
        q.type !== 'excel_external' ||
        !answer?.uploadedArrayBuffer ||
        !answer?.filename
      ) {
        return null;
      }

      return {
        questionIndex: index,
        taskId: q.taskId || '',
        filename: answer.filename,
        contentBase64: arrayBufferToBase64(answer.uploadedArrayBuffer),
      };
    })
    .filter(Boolean);

  return {
    id_teste: recordId,
    candidate: state.candidate,
    blueprint: state.blueprint,
    stageSummary: state.stageSummary,
    totalScore: state.totalScore,
    totalMax: state.totalMax,
    weightedFinalScore: state.weightedFinalScore,
    rhObservation: state.rhObservation || '',
    generatedAt: new Date().toISOString(),
    textContent: buildFullAnswerKeyText(),
    uploadedFiles,
  };
}

async function doLogin() {
  const user = document.getElementById('login-user')?.value.trim() || '';
  const pass = document.getElementById('login-pass')?.value.trim() || '';
  const alertEl = document.getElementById('login-alert');

  if (user === RH_USER && pass === RH_PASS) {
    try {
      state.logged = true;
      await ensureHistoryCsv();
      alertEl?.classList.add('d-none');
      showScreen('screen-menu');
    } catch (error) {
      console.error(error);
      if (alertEl) {
        alertEl.textContent =
          'Login realizado, mas não foi possível acessar o histórico no servidor.';
        alertEl.classList.remove('d-none');
      }
    }
  } else if (alertEl) {
    alertEl.textContent = 'Usuário ou senha inválidos.';
    alertEl.classList.remove('d-none');
  }
}

function resetExamEntryFields() {
  const candidateNameEl = document.getElementById('candidate-name');
  const candidateRoleEl = document.getElementById('candidate-role');
  const candidateLevelEl = document.getElementById('candidate-level');
  const candidateTrackEl = document.getElementById('candidate-track');
  const candidateTimeEl = document.getElementById('candidate-time');
  const candidateRolePreviewEl = document.getElementById(
    'candidate-role-preview',
  );
  const adminPassEl = document.getElementById('admin-pass');
  const saveAlertEl = document.getElementById('save-alert');

  if (candidateNameEl) candidateNameEl.value = '';
  if (candidateRoleEl) candidateRoleEl.value = '';
  if (candidateLevelEl) candidateLevelEl.value = '';
  if (candidateTrackEl) candidateTrackEl.value = '';
  if (candidateTimeEl) candidateTimeEl.value = '40';
  if (candidateRolePreviewEl) candidateRolePreviewEl.value = '';
  if (adminPassEl) adminPassEl.value = '';
  if (saveAlertEl) saveAlertEl.classList.add('d-none');

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

function goToProcessCreate() {
  showScreen('screen-process-create');
}

function goToProcesses() {
  showScreen('screen-processes');
  renderProcessesScreen();
}

function goToTalentBank() {
  showScreen('screen-talent-bank');
  renderTalentBankTable();
}

function goToHistory() {
  showScreen('screen-history');
  renderHistoryTable();
}

function logout() {
  clearInterval(state.timerHandle);
  state.logged = false;
  state.finished = false;
  clearPersistedAppState();
  showScreen('screen-login');
}
async function proceedToCandidate() {
  const role = document.getElementById('candidate-role').value.trim();
  const level = document.getElementById('candidate-level').value;
  const track = document.getElementById('candidate-track').value.trim();
  const time = parseInt(document.getElementById('candidate-time').value, 10);
  const processId =
    document.getElementById('candidate-process')?.value?.trim() || '';
  const alert = document.getElementById('config-alert');

  if (!role || !level || !time) {
    alert.textContent = 'Preencha os campos da configuração para prosseguir.';
    alert.classList.remove('d-none');
    return;
  }

  if (!processId) {
    alert.textContent = 'Selecione o processo seletivo para prosseguir.';
    alert.classList.remove('d-none');
    return;
  }

  const resolvedProcessId = processId === 'PROCESSO_UNICO' ? '' : processId;

  alert.classList.add('d-none');

  const blueprint = resolveExamBlueprint(role, level, track);

  state.blueprint = blueprint;

  state.candidate = {
    ...(state.candidate || {}),
    id_processo: resolvedProcessId,
    role,
    level,
    time,
    track: track || 'automático',
  };
  state.selectedProcessId = processId;
  state.blueprint = blueprint;

  const rolePreview = document.getElementById('candidate-role-preview');
  if (rolePreview) rolePreview.value = `${role} • ${blueprint.label}`;

  renderCandidateRules();
  showScreen('screen-candidate');
}

function getStageMacroDescription(stageKey) {
  const role = (state.candidate?.role || '').trim();
  const level = String(state.candidate?.level || '').trim();
  const track = (state.candidate?.track || '').trim();
  const roleUpper = safeUpper(role);
  const trackUpper = safeUpper(track);

  const baseMap = {
    word_basic:
      'Será avaliado formatação de texto, organização visual do conteúdo, digitação, interpretação escrita e nível de escrita do candidato.',
    word_intermediate:
      'Será avaliado formatação de texto, estruturação de conteúdo, clareza na escrita, organização de informações e domínio intermediário de edição de documentos.',
    word_advanced:
      'Será avaliado domínio avançado de edição de documentos, padronização visual, construção textual, coesão da escrita e aplicação de recursos de formatação.',
    excel_basic:
      'Será avaliado cálculos básicos, preenchimento de planilhas, organização de dados, formatação de tabelas e interpretação de informações.',
    excel_intermediate:
      'Será avaliado cálculos intermediários, organização e análise de dados, formatação de tabelas, uso de fórmulas e raciocínio em planilhas.',
    excel_advanced:
      'Será avaliado cálculos avançados, análise de dados, construção de tabelas, lógica em planilhas, fórmulas, gráficos e recursos avançados como PROCV.',
    excel_operational:
      'Será avaliado cálculos operacionais, organização de planilhas, controle de dados, formatação de tabelas e aplicação prática de fórmulas no contexto da operação.',
    excel_planning:
      'Será avaliado raciocínio analítico, cálculos em planilhas, organização de bases, construção de tabelas, gráficos, indicadores e uso de PROCV.',
    excel_quality:
      'Será avaliado manipulação de planilhas, cálculos, organização de dados, filtros, formatação de tabelas e uso de PROCV em contexto de controle de qualidade.',
    logic:
      'Será avaliado raciocínio lógico, interpretação de cenários, tomada de decisão e capacidade analítica.',
    technical_support:
      'Será avaliado conhecimento técnico, interpretação de incidentes, raciocínio de suporte, análise de causa e tomada de decisão em cenários práticos.',
    customer_service:
      'Será avaliado comunicação, interpretação de atendimento, postura profissional, clareza de resposta e raciocínio aplicado ao contexto operacional.',
    general_knowledge:
      'Será avaliado conhecimentos gerais, interpretação textual, atenção, raciocínio e repertório básico profissional.',
    adm: 'Será avaliado organização, interpretação de informações, raciocínio administrativo, controles operacionais e análise de dados.',
    rh: 'Será avaliado interpretação de cenário, organização de informações, escrita profissional, raciocínio analítico e conhecimentos aplicados à rotina de RH.',
  };

  if (
    roleUpper.includes('JOVEM APRENDIZ') ||
    roleUpper.includes('OPERADOR') ||
    roleUpper.includes('ESTAGIÁRIO')
  ) {
    if (stageKey.includes('word')) {
      return 'Será avaliado formatação de texto, digitação, organização do conteúdo, compreensão escrita e nível de escrita do candidato.';
    }
    if (stageKey.includes('excel')) {
      return 'Será avaliado cálculos, preenchimento de planilhas, formatação de tabelas, organização de dados e uso de fórmulas básicas e intermediárias, incluindo PROCV quando aplicável.';
    }
  }

  if (
    roleUpper.includes('SUPERVISOR') ||
    roleUpper.includes('CONTROL DESK') ||
    roleUpper.includes('PLANEJAMENTO')
  ) {
    if (stageKey.includes('word')) {
      return 'Será avaliado escrita profissional, clareza textual, organização de informações, estruturação de conteúdo e domínio de formatação de documentos.';
    }
    if (stageKey.includes('excel')) {
      return 'Será avaliado cálculos, análise de indicadores, construção e formatação de tabelas, organização de bases, gráficos e uso de fórmulas como PROCV.';
    }
  }

  if (
    roleUpper.includes('TI') ||
    roleUpper.includes('ANALISTA') ||
    trackUpper === 'TI'
  ) {
    if (stageKey.includes('word')) {
      return 'Será avaliado clareza técnica na escrita, organização de conteúdo, padronização textual, interpretação e estruturação de respostas profissionais.';
    }
    if (stageKey.includes('excel')) {
      return 'Será avaliado análise de dados, cálculos, organização de planilhas, formatação de tabelas, cruzamento de informações e uso de fórmulas como PROCV.';
    }
    if (stageKey.includes('technical')) {
      return 'Será avaliado raciocínio técnico, interpretação de problemas, análise de cenário, lógica de suporte e tomada de decisão.';
    }
  }

  if (trackUpper === 'RH') {
    if (stageKey.includes('word')) {
      return 'Será avaliado escrita corporativa, clareza textual, organização de informações e formatação de documentos.';
    }
    if (stageKey.includes('excel')) {
      return 'Será avaliado cálculos, organização de planilhas, controle de dados, formatação de tabelas e uso de fórmulas aplicadas à rotina administrativa.';
    }
  }

  if (trackUpper === 'ADM') {
    if (stageKey.includes('word')) {
      return 'Será avaliado escrita profissional, clareza, estruturação do conteúdo e padronização de documentos.';
    }
    if (stageKey.includes('excel')) {
      return 'Será avaliado cálculos, organização de dados, formatação de tabelas, análise de informações e uso de fórmulas como PROCV.';
    }
  }

  return (
    baseMap[stageKey] ||
    'Será avaliado conhecimento prático da etapa, interpretação, organização de informações e domínio dos recursos exigidos para a vaga.'
  );
}

function buildCandidateRulesSummary() {
  if (!state.blueprint?.stages?.length) return '';

  return `
    <ul class="candidate-summary-list">
      ${state.blueprint.stages
        .map(
          (stage) => `
            <li>
              <strong>${STAGE_LABELS[stage.key] || 'Etapa'}</strong><br>
              <span>${getStageMacroDescription(stage.key)}</span>
            </li>
          `,
        )
        .join('')}
    </ul>
  `;
}

function renderCandidateRules() {
  const box = document.getElementById('candidate-rules-summary');
  if (!box || !state.blueprint) return;
  box.innerHTML = buildCandidateRulesSummary();
}

async function startExam() {
  const name = document.getElementById('candidate-name')?.value.trim() || '';
  const role =
    state.candidate?.role ||
    document.getElementById('candidate-role')?.value.trim() ||
    '';
  const level =
    state.candidate?.level ||
    document.getElementById('candidate-level')?.value ||
    '';
  const track =
    state.candidate?.track ||
    document.getElementById('candidate-track')?.value.trim() ||
    '';
  const time = parseInt(
    state.candidate?.time || document.getElementById('candidate-time')?.value,
    10,
  );
  const alert = document.getElementById('candidate-alert');

  if (!name) {
    if (alert) {
      alert.textContent = 'Informe o nome do candidato para iniciar a prova.';
      alert.classList.remove('d-none');
    }
    return;
  }

  const blueprint = resolveExamBlueprint(role, level, track);

  if (alert) alert.classList.add('d-none');

  const processId =
    state.candidate?.id_processo || state.selectedProcessId || '';

  state.candidate = {
    ...(state.candidate || {}),
    name,
    role,
    level,
    time,
    track: track || 'automático',
    id_processo: processId,
  };

  state.blueprint = blueprint;
  state.selectedProcessId = state.candidate?.id_processo || '';
  try {
    state.questions = buildExamFromBlueprint(blueprint);
  } catch (error) {
    console.error('Erro ao montar a prova:', error);
    if (alert) {
      alert.textContent =
        error?.message ||
        'Não foi possível montar a prova. Verifique as etapas configuradas no questions.js.';
      alert.classList.remove('d-none');
    }
    return;
  }
  state.currentIndex = 0;
  state.answers = new Array(state.questions.length).fill(null);
  state.timerSeconds = time * 60;
  state.timerEndsAt = Date.now() + state.timerSeconds * 1000;
  state.finished = false;
  state.finalResults = [];
  state.totalScore = 0;
  state.totalMax = 0;
  state.weightedFinalScore = 0;
  state.stageSummary = [];
  state.manualReviewItems = [];
  state.currentResultId = null;
  state.rhObservation = '';
  state.finishStatus = 'Finalizado';
  state.isSavingResult = false;
  state.resultSaved = false;

  clearInterval(state.timerHandle);
  state.timerHandle = null;

  persistAppState();
  showScreen('screen-exam');
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
          <label class="form-check-label" for="opt-${i}">
            <span class="exam-option-letter">${String.fromCharCode(65 + i)}</span>
            <span class="exam-option-text">${opt}</span>
          </label>
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
    return;
  }

  state.finishStatus = 'Finalizado';
  finishExam();
}

function hasBoldInHtml(html) {
  if (/<(b|strong)[^>]*>[\s\S]*?<\/(b|strong)>/i.test(html)) return true;
  if (/font-weight\s*:\s*(bold|[6-9]\d{2}|[1-9]\d{3})/i.test(html)) return true;
  return false;
}

function hasCenterInHtml(html) {
  if (/text-align\s*:\s*center/i.test(html)) return true;
  if (/align\s*=\s*["']?center["']?/i.test(html)) return true;
  if (/<div[^>]*style\s*=\s*["'][^"']*center[^"']*["']/i.test(html))
    return true;
  return false;
}

function titleIsBoldInHtml(html, titleText) {
  if (!titleText) return false;
  const escapedTitle = titleText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const boldTagPattern = new RegExp(
    '<(b|strong)[^>]*>[\\s\\S]*?' + escapedTitle + '[\\s\\S]*?<\\/(b|strong)>',
    'i',
  );
  if (boldTagPattern.test(html)) return true;

  const boldStylePattern = new RegExp(
    'font-weight\\s*:\\s*(bold|[6-9]\\d{2}|[1-9]\\d{3})[^"\']*["\'][^>]*>[\\s\\S]*?' +
      escapedTitle,
    'i',
  );
  if (boldStylePattern.test(html)) return true;

  return hasBoldInHtml(html);
}

function titleIsCenteredInHtml(html, titleText) {
  if (!titleText) return false;
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
  return hasCenterInHtml(html);
}

function evaluateWord(answer, expected, points) {
  if (!answer || !answer.content) return 0;
  const html = answer.content;
  const plain = stripHtml(html);
  const upper = plain.toUpperCase();

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

  const raw = (score / totalWeight) * points;
  return Math.max(plain.trim().length >= 5 ? 1 : 0, Math.round(raw));
}

function evaluateMultiple(answerData, question, points) {
  const expectedIndex =
    question?.answer !== undefined && question?.answer !== null
      ? question.answer
      : question?.correctIndex;

  return answerData && answerData.selected === expectedIndex ? points : 0;
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
  const EXAMS_FOLDER = 'Exames';

  const map = {
    basic_exam: {
      fileName: `${EXAMS_FOLDER}/exame_basico.xlsx`,
      outputBaseName: 'exame_basico',
    },
    qualid_exam: {
      fileName: `${EXAMS_FOLDER}/exame_medio.xlsx`,
      outputBaseName: 'exame_medio',
    },
    planning_exam: {
      fileName: `${EXAMS_FOLDER}/exame_avancado_nvl2.xlsx`,
      outputBaseName: 'exame_avancado_nvl2',
    },
    advanced_exam: {
      fileName: `${EXAMS_FOLDER}/exame_avancado.xlsx`,
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
        valorCell?.z || valorCell?.w || valorCell?.s?.numFmt || '',
      ).toUpperCase();
      const subtotalFmt = String(
        subtotalCell?.z || subtotalCell?.w || subtotalCell?.s?.numFmt || '',
      ).toUpperCase();
      return (
        /R\$|_-\*|[$]/.test(valorFmt) ||
        /R\$|_-\*|[$]/.test(subtotalFmt) ||
        /\d,\d{2}/.test(String(valorCell?.w || '')) ||
        /\d,\d{2}/.test(String(subtotalCell?.w || ''))
      );
    });

  const styleApplied =
    !!subtotalCol &&
    dataRows.some((row) => {
      const baseCell = ws[`${valorCol}${row}`];
      const targetCell = ws[`${subtotalCol}${row}`];
      return !!(baseCell && targetCell);
    });

  const colorChanged =
    !!ws['A1'] ||
    !!ws[`${produtoCol}${headerRow}`] ||
    !!ws[`${quantidadeCol}${headerRow}`];

  let sortedDescending = false;
  if (hasAutoFilter(ws)) {
    const visibleRows = dataRows.filter((row) => !isRowHidden(ws, row));
    const referenceRows = visibleRows.length ? visibleRows : dataRows;
    const values = referenceRows
      .map((row) => {
        const raw = cellValue(ws, `${valorCol}${row}`);
        const num = Number(
          String(raw)
            .replace(/[^\d,.-]/g, '')
            .replace(',', '.'),
        );
        return Number.isNaN(num) ? null : num;
      })
      .filter((num) => num !== null);

    if (values.length >= 2) {
      sortedDescending = values.every(
        (value, index) => index === 0 || values[index - 1] >= value,
      );
    } else {
      sortedDescending = true;
    }
  }

  const totalLabel = safeUpper(
    cellValue(ws, `${produtoCol}${totalRow}`),
  ).includes('TOTAL');
  const totalQuantity = cellHasData(ws, `${quantidadeCol}${totalRow}`);
  const totalValue = cellHasData(ws, `${subtotalCol || valorCol}${totalRow}`);

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
      done: styleApplied,
    },
    {
      label: 'Cores alteradas em A1 e na linha A2',
      done: colorChanged,
    },
    {
      label: 'Filtro aplicado e ordenação por maior valor unitário',
      done: hasAutoFilter(ws) && sortedDescending,
    },
    {
      label: 'Linha de total criada com soma final',
      done: totalLabel && (totalQuantity || totalValue),
    },
  ];

  return buildChecklistResult(tasks, points, notes);
}

function validateQualidExam(wb, points) {
  const tasks = [];
  const notes = [
    'Itens visuais, gráfico e alguns posicionamentos podem precisar de revisão manual do RH.',
  ];

  const planilhaA = getSheet(wb, 'Planilha A');
  const procv = getSheet(wb, 'PROCV');
  const tabdin = getSheet(wb, 'TAB_DIN');
  const copiarColar = getSheet(wb, 'Copiar_Colar');
  const grafico = getSheet(wb, 'Gráfico');

  const sortedOperators = collectColumnValuesUntilBlank(
    planilhaA,
    'A',
    3,
  ).filter((v) => !safeUpper(v).includes('OPERADOR'));
  const isSorted =
    sortedOperators.length > 1
      ? sortedOperators.every(
          (value, index) =>
            index === 0 ||
            safeUpper(sortedOperators[index - 1]) <= safeUpper(value),
        )
      : false;

  tasks.push({
    label: 'Planilha A em ordem alfabética por Operador',
    done: isSorted,
  });

  const valorTotalHeader =
    safeUpper(cellValue(planilhaA, 'F2')) === 'VALOR TOTAL';
  const valorTotalCalculated = ['F3', 'F4', 'F5', 'F6', 'F7', 'F8'].some(
    (addr) => cellHasData(planilhaA, addr),
  );
  tasks.push({
    label: 'Coluna F com título Valor Total',
    done: valorTotalHeader,
  });
  tasks.push({
    label: 'Valor Total = Valor (R$) x Quantidade',
    done: valorTotalCalculated,
  });

  const procvResults = ['C2', 'C3', 'C4', 'C5', 'C6', 'C7'].filter((addr) =>
    cellHasData(procv, addr),
  ).length;
  tasks.push({
    label: 'PROCV preenchido na aba PROCV',
    done: procvResults >= 4,
  });

  const notFoundList =
    cellHasData(procv, 'BC255') ||
    cellHasData(procv, 'BD255') ||
    cellHasData(procv, 'BC256');
  tasks.push({
    label: 'Operadores não encontrados listados a partir de BC255',
    done: notFoundList,
  });

  const tabdinSummary =
    cellHasData(tabdin, 'A5') ||
    cellHasData(tabdin, 'B5') ||
    cellHasData(tabdin, 'C5') ||
    cellHasData(tabdin, 'D5');
  tasks.push({
    label: 'Resumo do supervisor Lula criado na aba TAB_DIN',
    done: tabdinSummary,
  });

  const copiedTable =
    cellHasData(copiarColar, 'A5') &&
    cellHasData(copiarColar, 'B5') &&
    hasAutoFilter(copiarColar);
  tasks.push({
    label: 'Tabela copiada e filtrada para Wesley Nunes',
    done: copiedTable,
  });
  const hasGraphData =
    cellHasData(grafico, 'A2') &&
    cellHasData(grafico, 'D2') &&
    (grafico['!images'] || grafico['!drawings'] || grafico['!charts']);
  tasks.push({
    label: 'Gráfico de colunas agrupadas criado com supervisores e março',
    done: !!hasGraphData,
  });

  return buildChecklistResult(tasks, points, notes);
}

function validatePlanningExam(wb, points) {
  const tasks = [];
  const notes = [
    'Gráficos, formatação condicional e parte visual devem ser validados manualmente pelo RH.',
  ];

  const q1 = getSheet(wb, 'Q1.');
  const q2 = getSheet(wb, 'Q2.');
  const q3 = getSheet(wb, 'Q3.');
  const q4 = getSheet(wb, 'Q4.');
  const q5 = getSheet(wb, 'Q5.');

  const q1Done =
    ['B6', 'B7', 'B8', 'B9', 'B10'].filter((addr) => cellHasData(q1, addr))
      .length >= 3;
  tasks.push({
    label: 'CONT.SE preenchido por cidade e ordenado',
    done: q1Done,
  });

  const q2Done =
    ['B4', 'B5', 'B6', 'B7', 'B8'].filter((addr) => cellHasData(q2, addr))
      .length >= 3;
  tasks.push({
    label: 'PROCV preenchido na aba Q2.',
    done: q2Done,
  });

  const q3Done =
    cellHasData(q3, 'A5') ||
    cellHasData(q3, 'B5') ||
    q3['!images'] ||
    q3['!drawings'] ||
    q3['!charts'];
  tasks.push({
    label: 'Tabela por DDD e gráfico Pizza 3D',
    done: !!q3Done,
  });

  const q4Done =
    ['C7', 'C8', 'C9', 'D7', 'D8', 'D9'].filter((addr) => cellHasData(q4, addr))
      .length >= 4;
  tasks.push({
    label: 'Percentual e situação por zona',
    done: q4Done,
  });

  const q5Done =
    ['G5', 'H5', 'I5', 'J5', 'G6', 'H6', 'I6', 'J6'].filter((addr) =>
      cellHasData(q5, addr),
    ).length >= 4;
  tasks.push({
    label: 'Análise de vendas preenchida com totais e percentuais',
    done: q5Done,
  });

  return buildChecklistResult(tasks, points, notes);
}

function validateAdvancedExam(wb, points) {
  const base = validatePlanningExam(wb, points);
  const tasks = base.completedTasks.map((item) => {
    const cleaned = item.replace(/^[✔️❌]\s*/, '');
    return {
      label: cleaned,
      done: item.startsWith('✔️'),
    };
  });
  const notes = Array.isArray(base.notes) ? [...base.notes] : [];

  const q6 = getSheet(wb, 'Q6.');
  const q7 = getSheet(wb, 'Q7.');

  tasks.push({
    label: 'Gráfico combinado com eixo secundário',
    done: !!(q6 && (q6['!images'] || q6['!drawings'] || q6['!charts'])),
  });
  tasks.push({
    label: 'Soma do RJ em F10',
    done: cellHasData(q7, 'F10'),
  });

  return buildChecklistResult(tasks, points, notes);
}

function finishExam() {
  if (state.finished) return;
  state.finished = true;
  clearInterval(state.timerHandle);
  state.timerEndsAt = null;
  captureCurrentAnswer();

  const results = [];
  let totalScore = 0;
  let totalMax = 0;

  state.questions.forEach((q, idx) => {
    const ans = state.answers[idx];
    let result;

    if (q.type === 'word') {
      const score = evaluateWord(ans, q.expected, q.points);
      result = scoreResult(score, q.points, [], false);
    } else if (q.type === 'multiple') {
      const score = evaluateMultiple(ans, q, q.points);
      result = scoreResult(score, q.points, [], false);
    } else if (q.type === 'excel_external') {
      if (!ans || !ans.uploaded || !ans.validation) {
        result = scoreResult(
          0,
          q.points,
          ['Arquivo não enviado ou inválido.'],
          true,
          [],
        );
      } else {
        result = {
          score: ans.validation.score,
          max: ans.validation.max,
          notes: ans.validation.notes || [],
          pendingManual: !!ans.validation.pendingManual,
          completedTasks: ans.validation.completedTasks || [],
        };
      }
    } else {
      result = scoreResult(0, q.points, ['Tipo de questão não suportado.']);
    }

    results.push(result);
    totalScore += result.score;
    totalMax += result.max;
  });

  state.finalResults = results;
  state.totalScore = totalScore;
  state.totalMax = totalMax;

  const grouped = {};

  state.questions.forEach((q, idx) => {
    const stageKey = q.stageKey || 'geral';
    if (!grouped[stageKey]) {
      const stageConfig = state.blueprint.stages.find(
        (s) => s.key === stageKey,
      );
      grouped[stageKey] = {
        key: stageKey,
        label: STAGE_LABELS[stageKey] || q.stage || 'Etapa',
        weight: stageConfig?.weight || 0,
        rawScore: 0,
        rawMax: 0,
        questionCount: 0,
        pendings: 0,
      };
    }
    grouped[stageKey].rawScore += results[idx].score;
    grouped[stageKey].rawMax += results[idx].max;
    grouped[stageKey].questionCount += 1;
    if (results[idx].pendingManual) grouped[stageKey].pendings += 1;
  });

  const stageSummary = Object.values(grouped).map((stage) => {
    const percent = stage.rawMax ? stage.rawScore / stage.rawMax : 0;
    const stageScore = percent * 10;

    return {
      ...stage,
      percent,
      weightedScore: stageScore,
    };
  });

  const averageFinalScore =
    stageSummary.length > 0
      ? stageSummary.reduce((sum, stage) => {
          const stagePercent = stage.rawMax
            ? (stage.rawScore / stage.rawMax) * 10
            : 0;
          return sum + stagePercent;
        }, 0) / stageSummary.length
      : 0;

  state.stageSummary = stageSummary;
  state.weightedFinalScore = averageFinalScore;
  state.manualReviewItems = state.questions
    .map((q, idx) => ({
      q,
      idx,
      result: results[idx],
      answer: state.answers[idx],
    }))
    .filter((item) => item.result.pendingManual);

  persistAppState();
  showScreen('screen-thanks');
}

function renderResults() {
  updateSaveResultButtonState(state.resultSaved ? 'saved' : 'idle');

  const resultNameEl = document.getElementById('result-name');
  const resultRoleEl = document.getElementById('result-role');
  const resultLevelEl = document.getElementById('result-level');
  const resultScoreEl = document.getElementById('result-score');

  if (!resultNameEl || !resultRoleEl || !resultLevelEl || !resultScoreEl) {
    return;
  }

  resultNameEl.textContent = state.candidate?.name || '';
  resultRoleEl.textContent = state.candidate?.role || '';
  resultLevelEl.textContent = `${state.candidate?.level || ''} • ${state.blueprint?.label || ''}`;
  resultScoreEl.textContent = state.weightedFinalScore.toFixed(2);
  const resultProcessEl = document.getElementById('result-process');
  const printProcessEl = document.getElementById('print-process');

  const processLabel =
    state.candidate?.id_processo && String(state.candidate.id_processo).trim()
      ? state.candidate.id_processo
      : 'Processo Individual';

  if (resultProcessEl) resultProcessEl.textContent = processLabel;
  if (printProcessEl) printProcessEl.textContent = processLabel;
  const box = document.getElementById('stage-results');
  box.innerHTML = state.stageSummary
    .map((data) => {
      const cls =
        data.percent >= 0.7 ? 'good' : data.percent >= 0.4 ? 'warn' : 'bad';
      return `
      <div class="col-md-6">
        <div class="result-item h-100 rh-stage-result-card" style="--stage-progress:${Math.max(8, Math.min(100, data.percent * 100))}%">
          <div class="d-flex justify-content-between align-items-center gap-2 mb-1">
            <div class="text-muted">${data.label}</div>
            <span class="weight-badge">Peso ${data.weight}%</span>
          </div>
          <div class="fw-bold">${data.questionCount} item(ns) avaliados</div>
          <div class="mt-2 stage-card-score ${cls} fs-5">${data.rawScore}/${data.rawMax}</div>
          <div class="small text-muted mt-1">
            Aproveitamento: ${(data.percent * 100).toFixed(1)}% •
            Nota ponderada: ${data.weightedScore.toFixed(2)}
          </div>
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
        <div><strong>${item.title || item.q?.title || 'Item para revisão'}</strong></div>
        ${
          item.completedTasks?.length
            ? `<div class="small text-muted mt-2"><strong>Resultado automático:</strong></div>
               <ul class="small text-muted">${item.completedTasks.map((x) => `<li>${x}</li>`).join('')}</ul>`
            : ''
        }
        ${
          item.answerKey?.length
            ? `<div class="small text-muted mt-2"><strong>Checklist do RH:</strong></div>
               <ul class="small text-muted">${item.answerKey.map((x) => `<li>${x}</li>`).join('')}</ul>`
            : ''
        }
        ${
          item.notes?.length
            ? `<div class="small text-muted">${item.notes.join(' | ')}</div>`
            : ''
        }
      </div>`,
      )
      .join('');
  }

  const rhObservationInput = document.getElementById('rh-observation-input');
  const printDateEl = document.getElementById('print-generated-at');
  const printNameEl = document.getElementById('print-name');
  const printRoleEl = document.getElementById('print-role');
  const printLevelEl = document.getElementById('print-level');
  const printScoreEl = document.getElementById('print-score');
  const printStageBox = document.getElementById('print-stage-results');
  const printManualBox = document.getElementById('print-manual-review');
  const printRhObservationEl = document.getElementById('print-rh-observation');
  if (rhObservationInput) {
    rhObservationInput.value = state.rhObservation || '';
  }

  if (printRhObservationEl) {
    printRhObservationEl.textContent =
      (state.rhObservation || '').trim() ||
      'Anotações sobre desempenho, postura, tempo, etc.';
  }
  if (printNameEl) printNameEl.textContent = state.candidate.name;
  if (printRoleEl) printRoleEl.textContent = state.candidate.role;
  if (printLevelEl) {
    printLevelEl.textContent = `${state.candidate.level} • ${state.blueprint.label}`;
  }
  if (printScoreEl) {
    printScoreEl.textContent = state.weightedFinalScore.toFixed(2);
  }

  if (printStageBox) {
    printStageBox.innerHTML = state.stageSummary
      .map(
        (data) => `
          <div class="print-stage-card">
            <div class="print-stage-title">${data.label}</div>
            <div class="print-stage-score">${data.rawScore}/${data.rawMax}</div>
            <div class="print-stage-meta">
              Peso: ${data.weight}%<br>
              Aproveitamento: ${(data.percent * 100).toFixed(1)}%<br>
              Nota ponderada: ${data.weightedScore.toFixed(2)}
            </div>
          </div>
        `,
      )
      .join('');
  }

  if (printManualBox) {
    printManualBox.innerHTML = state.manualReviewItems.length
      ? state.manualReviewItems
          .map(
            (item) => `
              <div class="mb-3">
                <strong>${item.title || item.q?.title || 'Item para revisão'}</strong>
                ${item.notes?.length ? `<div class="small text-muted">${item.notes.join(' | ')}</div>` : ''}
              </div>
            `,
          )
          .join('')
      : '<div>Nenhuma pendência.</div>';
  }
}

function getQuestionExpectedAnswerText(q) {
  if (q.type === 'multiple') {
    const expectedIndex =
      q?.answer !== undefined && q?.answer !== null
        ? q.answer
        : q?.correctIndex;

    if (
      expectedIndex !== undefined &&
      expectedIndex !== null &&
      Array.isArray(q.options)
    ) {
      return (
        q.options[expectedIndex] ?? 'Alternativa correta definida no sistema.'
      );
    }

    return 'Alternativa correta definida no sistema.';
  }

  if (q.type === 'word') {
    const expected = [];
    if (q.expected?.titleText)
      expected.push(`Título esperado: ${q.expected.titleText}`);
    if (q.expected?.titleBold) expected.push('Título em negrito');
    if (q.expected?.titleCenter) expected.push('Título centralizado');
    if (q.expected?.minTextLength)
      expected.push(
        `Texto com no mínimo ${q.expected.minTextLength} caracteres`,
      );
    if (q.expected?.minSentences)
      expected.push(`Texto com pelo menos ${q.expected.minSentences} frases`);
    if (q.expected?.requiresList) expected.push('Uso de lista');
    if (q.expected?.minListItems)
      expected.push(`Lista com ao menos ${q.expected.minListItems} itens`);
    if (q.expected?.anyBold) expected.push('Uso de negrito no conteúdo');
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

function closeProcessDetails() {
  const overlay = document.getElementById('process-details-overlay');
  const body = document.getElementById('process-details-body');
  if (body) body.innerHTML = '';
  if (overlay) overlay.classList.add('d-none');
}

function handleProcessDetailsOverlayClick(event) {
  if (event.target?.id === 'process-details-overlay') {
    closeProcessDetails();
  }
}

async function openProcessDetails(idProcesso, page = 1) {
  const overlay = document.getElementById('process-details-overlay');
  const title = document.getElementById('process-details-title');
  const body = document.getElementById('process-details-body');
  if (!overlay || !title || !body) return;

  const candidates = await readProcessCandidates();
  const processCandidates = candidates.filter(
    (candidate) =>
      String(candidate.id_processo || '').trim() ===
      String(idProcesso || '').trim(),
  );

  state.currentProcessDetailsId = idProcesso;
  state.processDetailsPage = page;

  title.textContent = `Detalhes do processo • ${idProcesso}`;

  const totalCandidates = processCandidates.length;
  const approvedCount = processCandidates.filter(
    (candidate) =>
      String(candidate.status_candidato || '').trim() === 'Aprovado',
  ).length;
  const eliminatedCount = processCandidates.filter(
    (candidate) =>
      String(candidate.status_candidato || '').trim() === 'Eliminado',
  ).length;
  const talentCount = processCandidates.filter(
    (candidate) =>
      String(candidate.status_candidato || '').trim() === 'Banco de talentos',
  ).length;
  const analysisCount = processCandidates.filter(
    (candidate) =>
      String(candidate.status_candidato || '').trim() === 'Em análise',
  ).length;

  if (!processCandidates.length) {
    body.innerHTML = `
      <div class="process-summary-grid">
        <div class="process-summary-card">
          <span class="process-summary-label">Total</span>
          <span class="process-summary-value">0</span>
        </div>
        <div class="process-summary-card is-approved">
          <span class="process-summary-label">Aprovados</span>
          <span class="process-summary-value">0</span>
        </div>
        <div class="process-summary-card is-eliminated">
          <span class="process-summary-label">Eliminados</span>
          <span class="process-summary-value">0</span>
        </div>
        <div class="process-summary-card is-talent">
          <span class="process-summary-label">Banco de talentos</span>
          <span class="process-summary-value">0</span>
        </div>
        <div class="process-summary-card is-analysis">
          <span class="process-summary-label">Em análise</span>
          <span class="process-summary-value">0</span>
        </div>
      </div>

      <div class="alert alert-secondary mb-0">
        Não há candidatos vinculados a este processo.
      </div>
    `;
    overlay.classList.remove('d-none');
    return;
  }

  const paged = getPagedItems(
    processCandidates,
    state.processDetailsPage,
    state.processDetailsPageSize,
  );

  body.innerHTML = `
    <div class="process-summary-grid">
      <div class="process-summary-card">
        <span class="process-summary-label">Total</span>
        <span class="process-summary-value">${totalCandidates}</span>
      </div>

      <div class="process-summary-card is-approved">
        <span class="process-summary-label">Aprovados</span>
        <span class="process-summary-value">${approvedCount}</span>
      </div>

      <div class="process-summary-card is-eliminated">
        <span class="process-summary-label">Eliminados</span>
        <span class="process-summary-value">${eliminatedCount}</span>
      </div>

      <div class="process-summary-card is-talent">
        <span class="process-summary-label">Banco de talentos</span>
        <span class="process-summary-value">${talentCount}</span>
      </div>

      <div class="process-summary-card is-analysis">
        <span class="process-summary-label">Em análise</span>
        <span class="process-summary-value">${analysisCount}</span>
      </div>
    </div>

    <div class="table-responsive">
      <table class="table align-middle history-table rh-modern-history-table">
        <thead>
          <tr>
            <th>Candidato</th>
            <th>Vaga</th>
            <th>Nota</th>
            <th>Status</th>
            <th class="text-end">Ações</th>
          </tr>
        </thead>
        <tbody>
          ${paged.items
            .map((candidate) => {
              const status = String(candidate.status_candidato || '').trim();

              let statusClass = 'is-analysis';
              if (status === 'Aprovado') statusClass = 'is-approved';
              if (status === 'Eliminado') statusClass = 'is-eliminated';
              if (status === 'Banco de talentos') statusClass = 'is-talent';

              return `
                <tr>
                  <td>${escapeHtml(candidate.nome_candidato || '-')}</td>
                  <td>${escapeHtml(candidate.vaga || '-')}</td>
                  <td>${escapeHtml(candidate.pontuacao_final || '-')}</td>
                  <td>
                    <span class="process-candidate-status-badge ${statusClass}">
                      ${escapeHtml(status || '-')}
                    </span>
                  </td>
                  <td class="text-end">
                    <div class="process-action-stack">
                      <button
                        type="button"
                        class="btn btn-sm btn-outline-success process-action-btn"
                        onclick="setCandidateProcessStatus(${candidate.id_registro}, 'Aprovado', '${escapeHtml(candidate.id_processo || '')}')"
                      >
                        Aprovado
                      </button>

                      <button
                        type="button"
                        class="btn btn-sm btn-outline-danger process-action-btn"
                        onclick="setCandidateProcessStatus(${candidate.id_registro}, 'Eliminado', '${escapeHtml(candidate.id_processo || '')}')"
                      >
                        Eliminado
                      </button>

                      <button
                        type="button"
                        class="btn btn-sm btn-outline-secondary process-action-btn"
                        onclick="setCandidateProcessStatus(${candidate.id_registro}, 'Banco de talentos', '${escapeHtml(candidate.id_processo || '')}')"
                      >
                        Banco de talentos
                      </button>
                    </div>
                  </td>
                </tr>
              `;
            })
            .join('')}
        </tbody>
      </table>
    </div>

    <div class="d-flex justify-content-center gap-2 flex-wrap mt-4">
      ${buildPaginationHtml(
        paged.currentPage,
        paged.totalPages,
        'goToProcessDetailsPage',
      )}
    </div>
  `;

  overlay.classList.remove('d-none');
}

function openCloseProcessConfirm(idProcesso) {
  const overlay = document.getElementById('close-process-overlay');
  const input = document.getElementById('close-process-id');
  if (input) input.value = idProcesso || '';
  if (overlay) overlay.classList.remove('d-none');
}

function closeCloseProcessModal() {
  const overlay = document.getElementById('close-process-overlay');
  if (overlay) overlay.classList.add('d-none');
}

function handleCloseProcessOverlayClick(event) {
  if (event.target?.id === 'close-process-overlay') {
    closeCloseProcessModal();
  }
}

async function confirmCloseProcess() {
  const idProcesso =
    document.getElementById('close-process-id')?.value?.trim() || '';
  if (!idProcesso) return;

  await closeProcess(idProcesso);
  closeCloseProcessModal();
  await populateProcessSelect();
  await renderProcessesScreen();
}

function goToProcessDetailsPage(page) {
  if (!state.currentProcessDetailsId) return;
  openProcessDetails(state.currentProcessDetailsId, page);
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
    `Observações do RH: ${(state.rhObservation || '').trim() || 'Nenhuma observação registrada.'}`,
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
    const baseName = sanitizeFileName(
      `${state.candidate.name}_${state.candidate.role || 'prova'}`,
    );

    zip.file(`gabarito_${baseName}.txt`, buildFullAnswerKeyText());

    for (let i = 0; i < state.questions.length; i += 1) {
      const q = state.questions[i];
      const ans = state.answers[i];
      if (
        q.type === 'excel_external' &&
        ans?.uploadedArrayBuffer &&
        ans?.filename
      ) {
        zip.file(
          `excel_respondido_${sanitizeFileName(ans.filename)}`,
          ans.uploadedArrayBuffer,
        );
      }
    }

    const blob = await zip.generateAsync({ type: 'blob' });
    downloadBlob(`prova_${baseName}.zip`, blob);
  } catch (error) {
    console.error('Erro ao gerar pacote da prova:', error);
    alert('Não foi possível gerar o pacote da prova.');
  }
}

function updateSaveResultButtonState(mode = 'idle') {
  const button = document.getElementById('save-result-btn');
  if (!button) return;

  button.classList.remove('is-saving', 'is-saved');
  button.disabled = false;

  if (mode === 'saving') {
    button.disabled = true;
    button.classList.add('is-saving');
    button.textContent = 'Salvando...';
    return;
  }

  if (mode === 'saved') {
    button.disabled = true;
    button.classList.add('is-saved');
    button.textContent = 'Resultado salvo';
    return;
  }

  button.textContent = 'Salvar resultado';
}

async function saveExamResult() {
  const alertEl = document.getElementById('save-alert');

  if (state.isSavingResult || state.resultSaved) {
    return;
  }

  state.isSavingResult = true;
  updateSaveResultButtonState('saving');

  if (alertEl) {
    alertEl.classList.remove(
      'd-none',
      'alert-danger',
      'alert-warning',
      'alert-info',
      'alert-success',
    );
    alertEl.classList.add('alert-info');
    alertEl.textContent = 'Salvando resultado no sistema...';
  }

  try {
    const recordId = state.currentResultId || buildResultId();
    const now = new Date();

    const row = {
      id_teste: recordId,
      nome_candidato: state.candidate.name,
      id_processo: state.candidate.id_processo || state.selectedProcessId || '',
      vaga: state.candidate.role,
      nivel: state.candidate.level,
      trilha: state.blueprint.label,
      pontuacao_final: state.weightedFinalScore.toFixed(1).replace('.', ','),
      pontuacao_bruta: `${state.totalScore}/${state.totalMax}`,
      tempo_minutos: state.candidate.time,
      data_iso: now.toISOString(),
      data_exibicao: now.toLocaleString('pt-BR'),
      status: state.finishStatus || 'Finalizado',
      etapas_json: JSON.stringify(state.stageSummary || []),
    };

    let initialCandidateStatus = 'Em análise';

    const linkedProcessId =
      state.candidate.id_processo || state.selectedProcessId || '';

    if (linkedProcessId) {
      const processes = await readProcesses();
      const linkedProcess = processes.find(
        (process) =>
          String(process.id_processo || '').trim() ===
          String(linkedProcessId).trim(),
      );

      const usesCutoff = Number(linkedProcess?.usa_nota_corte || 0) === 1;
      const cutoffValue = Number(linkedProcess?.nota_corte || 0);

      if (
        usesCutoff &&
        !Number.isNaN(cutoffValue) &&
        Number(state.weightedFinalScore || 0) < cutoffValue
      ) {
        initialCandidateStatus = 'Eliminado pela nota de corte';
      }
    }

    await saveHistoryRow(row);
    await saveAnswerFile(recordId, buildAnswerKeyPayload(recordId));
    await saveProcessCandidate({
      id_processo: state.candidate.id_processo || state.selectedProcessId || '',
      id_teste: recordId,
      nome_candidato: state.candidate.name,
      vaga: state.candidate.role,
      status_candidato: initialCandidateStatus,
      pontuacao_final: state.weightedFinalScore.toFixed(1).replace('.', ','),
      data_prova: now.toISOString(),
      origem: 'Prova',
    });

    state.currentResultId = recordId;
    state.recentPage = 1;
    state.resultSaved = true;

    renderMenuRecentTests();
    updateSaveResultButtonState('saved');

    if (alertEl) {
      alertEl.classList.remove(
        'd-none',
        'alert-danger',
        'alert-warning',
        'alert-info',
        'alert-success',
      );
      alertEl.classList.add('alert-success');
      alertEl.textContent = 'Resultado salvo com sucesso.';
    }
  } catch (error) {
    console.error('Erro ao salvar prova:', error);
    updateSaveResultButtonState('idle');

    if (alertEl) {
      alertEl.classList.remove(
        'd-none',
        'alert-danger',
        'alert-warning',
        'alert-info',
        'alert-success',
      );
      alertEl.classList.add('alert-danger');
      alertEl.textContent =
        'Não foi possível salvar a prova no servidor. Verifique a API e tente novamente.';
    }
  } finally {
    state.isSavingResult = false;
  }
}

async function downloadHistoryAnswerKey(recordId, candidateName = 'candidato') {
  try {
    const files = await getAnswerFiles();
    const saved = files[recordId];

    if (!saved?.content) {
      alert('Gabarito não encontrado para este registro.');
      return;
    }

    const blob = new Blob([saved.content], { type: 'application/json' });
    downloadBlob(
      `gabarito_${sanitizeFileName(candidateName)}_${sanitizeFileName(recordId)}.json`,
      blob,
    );
  } catch (error) {
    console.error('Erro ao baixar gabarito salvo:', error);
    alert('Não foi possível baixar o gabarito.');
  }
}

async function downloadHistoryExamPackage(
  recordId,
  candidateName = 'candidato',
) {
  try {
    if (typeof JSZip === 'undefined') {
      alert('Não foi possível gerar o pacote automaticamente neste navegador.');
      return;
    }

    const files = await getAnswerFiles();
    const saved = files[recordId];

    if (!saved?.content) {
      alert('Prova não encontrada para este registro.');
      return;
    }

    let payload = null;
    try {
      payload = JSON.parse(saved.content);
    } catch (error) {
      console.warn(
        'Não foi possível interpretar o conteúdo salvo da prova:',
        error,
      );
    }

    const zip = new JSZip();
    const safeCandidateName = sanitizeFileName(candidateName);
    const safeRecordId = sanitizeFileName(recordId);
    const baseName = `${safeCandidateName}_${safeRecordId}`;
    const textContent = payload?.textContent || saved.content;

    zip.file(`gabarito_${baseName}.txt`, textContent);
    zip.file(
      `dados_${baseName}.json`,
      JSON.stringify(payload || saved, null, 2),
    );

    if (Array.isArray(payload?.uploadedFiles)) {
      payload.uploadedFiles.forEach((file) => {
        if (!file?.filename || !file?.contentBase64) return;
        const bytes = base64ToUint8Array(file.contentBase64);
        if (!bytes) return;

        zip.file(`excel_respondido_${sanitizeFileName(file.filename)}`, bytes);
      });
    }

    const blob = await zip.generateAsync({ type: 'blob' });
    downloadBlob(`prova_${baseName}.zip`, blob);
  } catch (error) {
    console.error('Erro ao baixar pacote da prova salva:', error);
    alert('Não foi possível baixar a prova.');
  }
}

async function renderHistoryTable() {
  const tableBody = document.getElementById('history-table-body');
  const pagination = document.getElementById('history-pagination');
  if (!tableBody) return;

  try {
    const rows = await readHistoryRows();
    const currentStatusMap = await buildCandidateCurrentStatusMap();

    const nameFilter =
      document
        .getElementById('history-filter-name')
        ?.value.trim()
        .toLowerCase() || '';
    const roleFilter =
      document
        .getElementById('history-filter-role')
        ?.value.trim()
        .toLowerCase() || '';
    const dateFilter =
      document.getElementById('history-filter-date')?.value || '';

    const filtered = rows
      .filter((row) => {
        const matchName =
          !nameFilter ||
          String(row.nome_candidato || '')
            .toLowerCase()
            .includes(nameFilter);

        const matchRole =
          !roleFilter ||
          String(row.vaga || '')
            .toLowerCase()
            .includes(roleFilter);

        const matchDate =
          !dateFilter ||
          formatDateToInput(row.data_iso || row.data_exibicao) === dateFilter;

        return matchName && matchRole && matchDate;
      })
      .sort((a, b) => (a.data_iso < b.data_iso ? 1 : -1));

    if (!filtered.length) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="7" class="text-center text-muted py-4">
            Nenhum registro encontrado.
          </td>
        </tr>
      `;
      if (pagination) pagination.innerHTML = '';
      return;
    }

    const paged = getPagedItems(
      filtered,
      state.historyPage,
      state.historyPageSize,
    );
    state.historyPage = paged.currentPage;

    tableBody.innerHTML = paged.items
      .map((row) => {
        const currentSituation = getCurrentSituationLabel(
          row,
          currentStatusMap,
        );
        const currentSituationClass =
          getCurrentSituationBadgeClass(currentSituation);

        return `
          <tr>
            <td>${escapeHtml(row.nome_candidato || '-')}</td>
            <td>${escapeHtml(row.vaga || '-')}</td>
            <td>${escapeHtml(row.nivel || '-')}</td>
            <td>${escapeHtml(row.data_exibicao || '-')}</td>
            <td>${escapeHtml(formatDetailScore(row.pontuacao_final || '-', ''))}</td>
            <td>
              <span class="rh-status-pill ${currentSituationClass}">
                ${escapeHtml(currentSituation)}
              </span>
            </td>
            <td>
              <div class="d-flex gap-2 flex-wrap justify-content-end">
                <button type="button" class="btn btn-sm btn-outline-primary" onclick="openRecentTestDetails('${row.id_teste}')">Detalhes</button>
                <button type="button" class="btn btn-sm btn-outline-success" onclick="downloadHistoryExamPackage('${row.id_teste}', '${sanitizeFileName(row.nome_candidato || 'candidato')}')">Baixar prova</button>
              </div>
            </td>
          </tr>
        `;
      })
      .join('');

    if (pagination) {
      pagination.innerHTML = buildPaginationHtml(
        paged.currentPage,
        paged.totalPages,
        'goToHistoryPage',
      );
    }
  } catch (error) {
    console.error('Erro ao renderizar histórico:', error);
    tableBody.innerHTML = `
      <tr>
        <td colspan="7" class="text-center text-danger py-4">
          Não foi possível carregar o histórico.
        </td>
      </tr>
    `;
    if (pagination) pagination.innerHTML = '';
  }
}
function goToCandidateAnalysis() {
  showScreen('screen-analysis-candidates');
}

async function readCandidateAnalytics() {
  const response = await fetch(`${API_BASE_URL}/candidate-analytics`, {
    method: 'GET',
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(
      `Falha ao carregar análises de candidatos. Status: ${response.status}`,
    );
  }

  return await response.json();
}

async function readCandidateAnalysisDetail(idTeste) {
  const response = await fetch(
    `${API_BASE_URL}/candidate-analytics/${encodeURIComponent(idTeste)}`,
    {
      method: 'GET',
      cache: 'no-store',
    },
  );

  if (!response.ok) {
    throw new Error(
      `Falha ao carregar análise detalhada. Status: ${response.status}`,
    );
  }

  return await response.json();
}

/*function formatAnalysisScore(value) {
  let raw = String(value ?? '0').trim();

  if (!raw) return '0,0';

  raw = raw.replace(/\s/g, '');

  if (raw.includes(',') && raw.includes('.')) {
    raw = raw.replace(/\./g, '').replace(',', '.');
  } else if (raw.includes(',')) {
    raw = raw.replace(',', '.');
  } else {
    const parts = raw.split('.');
    if (parts.length > 2) {
      raw = `${parts[0]}.${parts.slice(1).join('')}`;
    }
  }

  let num = Number(raw);

  if (!Number.isFinite(num)) {
    const fallback = raw.match(/-?\d+/);
    num = fallback ? Number(fallback[0]) : 0;
  }

  num = Math.round(num);

  return num.toLocaleString('pt-BR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}*/

function formatAnalysisScore(value) {
  let raw = String(value ?? '0').trim();

  if (!raw) return '0,0';

  raw = raw.replace(/\s/g, '');

  if (raw.includes(',') && raw.includes('.')) {
    raw = raw.replace(/\./g, '').replace(',', '.');
  } else if (raw.includes(',')) {
    raw = raw.replace(',', '.');
  } else {
    const parts = raw.split('.');
    if (parts.length > 2) {
      raw = `${parts[0]}.${parts.slice(1).join('')}`;
    }
  }

  let num = Number(raw);

  if (!Number.isFinite(num)) {
    const fallback = raw.match(/-?\d+/);
    num = fallback ? Number(fallback[0]) : 0;
  }

  num = Math.round(num);

  return num.toLocaleString('pt-BR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}

function getAnalysisFilters() {
  return {
    process:
      document
        .getElementById('analytics-filter-process')
        ?.value?.trim()
        .toLowerCase() || '',
    candidate:
      document
        .getElementById('analytics-filter-candidate')
        ?.value?.trim()
        .toLowerCase() || '',
    role:
      document
        .getElementById('analytics-filter-role')
        ?.value?.trim()
        .toLowerCase() || '',
    score:
      document.getElementById('analytics-filter-score')?.value?.trim() || '',
  };
}

function bindAnalyticsFilters() {
  [
    'analytics-filter-process',
    'analytics-filter-candidate',
    'analytics-filter-role',
    'analytics-filter-score',
  ].forEach((id) => {
    const el = document.getElementById(id);
    if (!el || el.dataset.bound === '1') return;

    el.addEventListener('input', () => {
      state.analyticsPage = 1;
      renderCandidateAnalyticsPage();
    });
    el.dataset.bound = '1';
  });
}

function renderAnalysisBarChart(items = []) {
  if (!Array.isArray(items) || !items.length) {
    return `
      <div class="alert alert-secondary mb-0">
        Não há dados suficientes para exibir o gráfico comparativo.
      </div>
    `;
  }

  const safeItems = items.map((item) => {
    const obtained = Math.max(
      0,
      Math.min(10, Number(String(item.obtained ?? 0).replace(',', '.')) || 0),
    );
    const expected = Math.max(
      0,
      Math.min(10, Number(String(item.expected ?? 0).replace(',', '.')) || 0),
    );

    return {
      label: item.label || '-',
      obtained,
      expected,
    };
  });

  const chartHeight = 260;
  const groupWidth = 92;
  const barWidth = 24;
  const gapBetweenBars = 10;
  const leftPadding = 48;
  const rightPadding = 24;
  const bottomPadding = 70;
  const topPadding = 20;

  const svgWidth = leftPadding + rightPadding + safeItems.length * groupWidth;
  const svgHeight = chartHeight + topPadding + bottomPadding;

  const yTicks = [0, 2, 4, 6, 8, 10];

  const bars = safeItems
    .map((item, index) => {
      const baseX = leftPadding + index * groupWidth + 10;
      const obtainedHeight = (item.obtained / 10) * chartHeight;
      const expectedHeight = (item.expected / 10) * chartHeight;

      const obtainedX = baseX;
      const expectedX = baseX + barWidth + gapBetweenBars;

      const obtainedY = topPadding + (chartHeight - obtainedHeight);
      const expectedY = topPadding + (chartHeight - expectedHeight);

      const labelY = topPadding + chartHeight + 18;
      const valueY = topPadding + chartHeight + 34;

      const shortLabel =
        item.label.length > 14 ? `${item.label.slice(0, 14)}...` : item.label;

      return `
        <rect x="${obtainedX}" y="${obtainedY}" width="${barWidth}" height="${obtainedHeight}" rx="4" fill="#5cb85c"></rect>
        <rect x="${expectedX}" y="${expectedY}" width="${barWidth}" height="${expectedHeight}" rx="4" fill="#5bc0de"></rect>

        <text x="${obtainedX + barWidth / 2}" y="${obtainedY - 6}" text-anchor="middle" font-size="11" fill="#475467">
          ${formatAnalysisScore(item.obtained)}
        </text>
        <text x="${expectedX + barWidth / 2}" y="${expectedY - 6}" text-anchor="middle" font-size="11" fill="#475467">
          ${formatAnalysisScore(item.expected)}
        </text>

        <text x="${baseX + barWidth + gapBetweenBars / 2}" y="${labelY}" text-anchor="middle" font-size="11" fill="#344054">
          ${escapeHtml(shortLabel)}
        </text>
        <text x="${baseX + barWidth + gapBetweenBars / 2}" y="${valueY}" text-anchor="middle" font-size="10" fill="#98A2B3">
          Candidato x Vaga
        </text>
      `;
    })
    .join('');

  const gridLines = yTicks
    .map((tick) => {
      const y = topPadding + chartHeight - (tick / 10) * chartHeight;
      return `
        <line x1="${leftPadding}" y1="${y}" x2="${svgWidth - rightPadding}" y2="${y}" stroke="#EAECF0" stroke-width="1"></line>
        <text x="${leftPadding - 10}" y="${y + 4}" text-anchor="end" font-size="11" fill="#667085">${tick}</text>
      `;
    })
    .join('');

  return `
    <div style="display:grid; gap:16px;">
      <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:12px;">
        <strong style="font-size:16px; color:#101828;">Comparativo por etapa</strong>
        <div style="display:flex; gap:16px; flex-wrap:wrap; font-size:13px; color:#475467;">
          <span style="display:inline-flex; align-items:center; gap:8px;">
            <span style="width:12px; height:12px; border-radius:3px; background:#5cb85c; display:inline-block;"></span>
            Nota do candidato
          </span>
          <span style="display:inline-flex; align-items:center; gap:8px;">
            <span style="width:12px; height:12px; border-radius:3px; background:#5bc0de; display:inline-block;"></span>
            Nota esperada pela vaga
          </span>
        </div>
      </div>

      <div style="overflow-x:auto; border:1px solid #E4E7EC; border-radius:16px; padding:16px; background:#fff;">
        <svg width="${svgWidth}" height="${svgHeight}" viewBox="0 0 ${svgWidth} ${svgHeight}" role="img" aria-label="Gráfico comparativo por etapa">
          ${gridLines}
          ${bars}
        </svg>
      </div>
    </div>
  `;
}

function buildAnalysisObservations(detail) {
  const textAnalysis = detail?.analise_texto || {};
  const remarks = Array.isArray(detail?.ressalvas) ? detail.ressalvas : [];

  const lines = [
    `⭐ Nota textual geral: ${formatAnalysisScore(textAnalysis.overall ?? 0)}`,
    ...remarks.map((item) => `⚠️ ${item}`),
  ];

  return `
    <div style="display:grid; gap:8px;">
      ${lines
        .map(
          (line) => `
            <div style="padding:10px 12px; border:1px solid #e4e7ec; border-radius:12px; background:#f8fafc;">
              ${escapeHtml(line)}
            </div>
          `,
        )
        .join('')}
    </div>
  `;
}

function getAnalysisRecommendationClass(recommendation) {
  const text = String(recommendation || '').trim().toLowerCase();

  if (text.includes('forte aderência')) return 'is-finished';
  if (text.includes('baixa aderência')) return 'is-unsaved';
  if (text.includes('boa regular')) return 'is-info';

  return 'is-neutral';
}

function renderAnalysisRecommendationBadge(recommendation) {
  const cls = getAnalysisRecommendationClass(recommendation);
  return `<span class="rh-status-pill ${cls}">${escapeHtml(recommendation || '-')}</span>`;
}

async function renderCandidateAnalyticsPage() {
  const tbody = document.getElementById('candidate-analytics-table-body');
  const pagination = document.getElementById('candidate-analytics-pagination');

  if (!tbody) return;

  bindAnalyticsFilters();

  try {
    const rows = await readCandidateAnalytics();
    const filters = getAnalysisFilters();

    const filteredRows = (Array.isArray(rows) ? rows : []).filter((row) => {
      const process = String(row.id_processo || '').toLowerCase();
      const candidate = String(row.nome_candidato || '').toLowerCase();
      const role = String(row.vaga || '').toLowerCase();
      const status = String(row.status_candidato || '').trim();
      const score = Number(String(row.nota_final ?? 0).replace(',', '.'));

      const allowedStatuses = ['Em análise', 'Banco de talentos', 'Aprovado'];
      if (!allowedStatuses.includes(status)) return false;
      if (
        !row.id_processo ||
        String(row.id_processo).trim().toUpperCase() === 'PROCESSO_UNICO'
      )
        return false;

      const matchProcess =
        !filters.process || process.includes(filters.process);
      const matchCandidate =
        !filters.candidate || candidate.includes(filters.candidate);
      const matchRole = !filters.role || role.includes(filters.role);

      let matchScore = true;
      if (filters.score) {
        const minScore = Number(String(filters.score).replace(',', '.'));
        if (!Number.isNaN(minScore)) {
          matchScore = score >= minScore;
        }
      }

      return matchProcess && matchCandidate && matchRole && matchScore;
    });

    if (!filteredRows.length) {
      tbody.innerHTML = `
        <tr>
          <td colspan="8" class="text-center text-muted py-4">
            Nenhum candidato encontrado com os filtros aplicados.
          </td>
        </tr>
      `;
      if (pagination) pagination.innerHTML = '';
      return;
    }

    const paged = getPagedItems(
      filteredRows,
      state.analyticsPage,
      state.analyticsPageSize,
    );
    state.analyticsPage = paged.currentPage;

    tbody.innerHTML = paged.items
      .map(
        (row) => `
          <tr>
            <td>${escapeHtml(row.id_processo || '-')}</td>
            <td>${escapeHtml(row.nome_candidato || '-')}</td>
            <td>${escapeHtml(row.vaga || '-')}</td>
<td>${escapeHtml(formatAnalysisScore(row.nota_final))}</td>
<td>${escapeHtml(formatAnalysisScore(row.afinidade_percentual))}%</td>
            <td>${renderAnalysisRecommendationBadge(row.recomendacao || '-')}</td>
            <td>${escapeHtml(row.status_candidato || '-')}</td>
            <td class="text-end">
              <div class="d-flex justify-content-end gap-2 flex-wrap">
                <button
                  type="button"
                  class="btn btn-sm btn-outline-primary"
                  onclick="openCandidateAnalysisDetails('${escapeHtml(row.id_teste)}')"
                >
                  Detalhes
                </button>
              </div>
            </td>
          </tr>
        `,
      )
      .join('');

    if (pagination) {
      pagination.innerHTML = buildPaginationHtml(
        paged.currentPage,
        paged.totalPages,
        'goToAnalyticsPage',
      );
    }
  } catch (error) {
    console.error(error);
    tbody.innerHTML = `
      <tr>
        <td colspan="8" class="text-center text-danger py-4">
          Não foi possível carregar a análise dos candidatos.
        </td>
      </tr>
    `;
    if (pagination) pagination.innerHTML = '';
  }
}

function goToAnalyticsPage(page) {
  state.analyticsPage = page;
  renderCandidateAnalyticsPage();
}

async function openCandidateAnalysisDetails(idTeste) {
  const overlay = document.getElementById('candidate-analysis-overlay');
  const body = document.getElementById('candidate-analysis-body');
  const title = document.getElementById('candidate-analysis-title');

  if (!overlay || !body || !title) return;

  try {
    const detail = await readCandidateAnalysisDetail(idTeste);
    state.currentAnalysisTestId = idTeste;

    title.textContent = `Análise do candidato • ${detail.nome_candidato || 'Candidato'}`;

    body.innerHTML = `
      <section class="rh-details-section">
        <h4 class="rh-details-section-title">Resumo analítico</h4>
        <div class="rh-details-grid">
          <div class="rh-detail-card">
            <span class="rh-detail-label">Processo</span>
            <span class="rh-detail-value">${escapeHtml(detail.id_processo || '-')}</span>
          </div>
          <div class="rh-detail-card">
            <span class="rh-detail-label">Candidato</span>
            <span class="rh-detail-value">${escapeHtml(detail.nome_candidato || '-')}</span>
          </div>
          <div class="rh-detail-card">
            <span class="rh-detail-label">Vaga</span>
            <span class="rh-detail-value">${escapeHtml(detail.vaga || '-')}</span>
          </div>
          <div class="rh-detail-card">
            <span class="rh-detail-label">Nota final</span>
            <span class="rh-detail-value">${escapeHtml(formatAnalysisScore(detail.nota_final))}</span>
          </div>
          <div class="rh-detail-card">
            <span class="rh-detail-label">Afinidade</span>
            <span class="rh-detail-value">${escapeHtml(formatAnalysisScore(detail.afinidade_percentual))}%</span>
          </div>
          <div class="rh-detail-card">
            <span class="rh-detail-label">Parecer final</span>
            <span class="rh-detail-value">${escapeHtml(detail.parecer_final || '-')}</span>
          </div>
        </div>
      </section>

      <section class="rh-details-section">
        <h4 class="rh-details-section-title">Gráfico comparativo por etapa</h4>
        ${renderAnalysisBarChart(detail.grafico || [])}
      </section>

      <section class="rh-details-section">
        <h4 class="rh-details-section-title">Texto e observações</h4>
        ${buildAnalysisObservations(detail)}
      </section>
    `;

    overlay.classList.remove('d-none');
  } catch (error) {
    console.error(error);
    title.textContent = 'Análise do candidato';
    body.innerHTML = `
      <div class="alert alert-danger mb-0">
        Não foi possível carregar a análise detalhada.
      </div>
    `;
    overlay.classList.remove('d-none');
  }
}

function closeCandidateAnalysisDetails() {
  const overlay = document.getElementById('candidate-analysis-overlay');
  const body = document.getElementById('candidate-analysis-body');
  if (body) body.innerHTML = '';
  if (overlay) overlay.classList.add('d-none');
}

function handleCandidateAnalysisOverlayClick(event) {
  if (event.target?.id === 'candidate-analysis-overlay') {
    closeCandidateAnalysisDetails();
  }
}

async function applyCandidateAnalysisAction(statusCandidato) {
  if (!state.currentAnalysisTestId) return;

  const processCandidates = await readProcessCandidates();
  const row = processCandidates.find(
    (item) =>
      String(item.id_teste || '').trim() ===
      String(state.currentAnalysisTestId).trim(),
  );

  if (!row) {
    alert('Não foi possível localizar o vínculo do candidato com o processo.');
    return;
  }

  await setCandidateProcessStatus(
    row.id_registro,
    statusCandidato,
    row.id_processo,
  );

  await renderCandidateAnalyticsPage();
  await openCandidateAnalysisDetails(state.currentAnalysisTestId);
}
