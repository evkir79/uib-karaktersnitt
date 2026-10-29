'use strict';

/* ================= UiB-regler ================= */

const GRADE_VALUES = { A: 5, B: 4, C: 3, D: 2, E: 1, F: 0 };
const PASS = 'Bestått';
const FAIL = 'Ikke bestått';
const ALL_GRADES = ['A', 'B', 'C', 'D', 'E', 'F', PASS, FAIL];

// Nedre grense for hver bokstav. Snittet avrundes til nærmeste hele karakter,
// der x,5 rundes opp (f.eks. 3,50 = B-snitt, 3,49 = C-snitt).
const THRESHOLDS = [
  ['A', 4.5],
  ['B', 3.5],
  ['C', 2.5],
  ['D', 1.5],
  ['E', 0.5],
  ['F', 0],
];
const EPS = 1e-9;

function letterFor(avg) {
  for (const [letter, min] of THRESHOLDS) {
    if (avg >= min - EPS) return letter;
  }
  return 'F';
}

function thresholdOf(letter) {
  return THRESHOLDS.find(([l]) => l === letter)[1];
}

/**
 * Vektet snitt: Σ(karakterverdi × stp) / Σ(stp), kun for bokstavkarakterer.
 * Bestått/ikke bestått teller ikke i snittet. F teller som 0 med mindre includeF er av.
 */
function computeStats(courses, includeF) {
  let weighted = 0;
  let graded = 0;
  let total = 0;
  let passed = 0;

  for (const c of courses) {
    total += c.credits;
    if (c.grade === PASS) {
      passed += c.credits;
      continue;
    }
    if (c.grade === FAIL) continue;
    if (c.grade !== 'F') passed += c.credits;
    if (c.grade === 'F' && !includeF) continue;
    weighted += GRADE_VALUES[c.grade] * c.credits;
    graded += c.credits;
  }

  const avg = graded > 0 ? weighted / graded : null;
  return { weighted, graded, total, passed, avg, letter: avg === null ? null : letterFor(avg) };
}

/** Snittet du trenger på `planned` nye stp for å nå `target`. */
function requiredAverage(stats, target, planned) {
  return (target * (stats.graded + planned) - stats.weighted) / planned;
}

/** Minste antall nye stp med bare A for å nå `target`. */
function creditsOfANeeded(stats, target) {
  return Math.max(0, (target * stats.graded - stats.weighted) / (GRADE_VALUES.A - target));
}

/* ================= Lagring ================= */

const STORAGE_KEY = 'uib-karaktersnitt';

const storage = window.api
  ? { load: () => window.api.load(), save: (d) => window.api.save(d) }
  : {
      // Nettleser-fallback (nyttig for testing uten Electron).
      load: async () => {
        try { return JSON.parse(localStorage.getItem(STORAGE_KEY)); } catch { return null; }
      },
      save: async (d) => {
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(d)); } catch { /* ignorer */ }
      },
    };

const state = {
  courses: [],
  settings: { theme: 'system', includeF: true, planned: 30, target: null },
  editingId: null,
  sort: { key: null, asc: true },
};

function persist() {
  storage.save({ version: 1, courses: state.courses, settings: state.settings });
}

function sanitizeCourse(c) {
  const credits = Number(c && c.credits);
  if (!c || typeof c.name !== 'string' || !ALL_GRADES.includes(c.grade) || !(credits > 0)) return null;
  return { id: typeof c.id === 'string' ? c.id : newId(), name: c.name.slice(0, 120), grade: c.grade, credits };
}

function newId() {
  return (crypto.randomUUID && crypto.randomUUID()) || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/* ================= Hjelpere ================= */

const $ = (sel) => document.querySelector(sel);

function fmt(n, digits = 2) {
  return n.toFixed(digits);
}

function fmtCredits(n) {
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 10) / 10);
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

function gradeClass(grade) {
  if (grade === PASS) return 'P';
  if (grade === FAIL) return 'NP';
  return grade;
}

/* ================= Tema ================= */

const THEME_LABELS = { system: 'System', light: 'Lys', dark: 'Mørk' };

function applyTheme() {
  const t = state.settings.theme;
  if (t === 'system') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', t);
  $('#themeLabel').textContent = `Tema: ${THEME_LABELS[t]}`;
  if (window.api) window.api.setTheme(t);
}

$('#themeBtn').addEventListener('click', () => {
  const order = ['system', 'light', 'dark'];
  state.settings.theme = order[(order.indexOf(state.settings.theme) + 1) % order.length];
  applyTheme();
  persist();
});

/* ================= Skjema ================= */

const form = $('#courseForm');
const nameInput = $('#name');
const creditsInput = $('#credits');
const formError = $('#formError');

function selectedGrade() {
  const el = form.querySelector('input[name="grade"]:checked');
  return el ? el.value : null;
}

function setGrade(grade) {
  for (const el of form.querySelectorAll('input[name="grade"]')) el.checked = el.value === grade;
}

function syncQuickCredits() {
  const v = Number(creditsInput.value);
  for (const b of document.querySelectorAll('#quickCredits button')) {
    b.classList.toggle('active', Number(b.dataset.v) === v);
  }
}

$('#quickCredits').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  creditsInput.value = b.dataset.v;
  syncQuickCredits();
});
creditsInput.addEventListener('input', syncQuickCredits);

function showError(msg, field) {
  formError.textContent = msg;
  formError.hidden = false;
  if (field) {
    field.classList.add('invalid');
    field.focus();
  }
}

function clearError() {
  formError.hidden = true;
  nameInput.classList.remove('invalid');
  creditsInput.classList.remove('invalid');
}

function resetForm() {
  state.editingId = null;
  form.reset();
  creditsInput.value = '10';
  setGrade(null);
  clearError();
  syncQuickCredits();
  $('#formTitle').textContent = 'Legg til emne';
  $('#submitBtn').textContent = 'Legg til emne';
  $('#cancelEdit').hidden = true;
}

function startEdit(id) {
  const c = state.courses.find((x) => x.id === id);
  if (!c) return;
  state.editingId = id;
  nameInput.value = c.name;
  setGrade(c.grade);
  creditsInput.value = String(c.credits);
  syncQuickCredits();
  clearError();
  $('#formTitle').textContent = 'Rediger emne';
  $('#submitBtn').textContent = 'Lagre endringer';
  $('#cancelEdit').hidden = false;
  renderTable();
  nameInput.focus();
  nameInput.select();
}

$('#cancelEdit').addEventListener('click', () => {
  resetForm();
  renderTable();
});

form.addEventListener('submit', (e) => {
  e.preventDefault();
  clearError();

  const name = nameInput.value.trim();
  const grade = selectedGrade();
  const credits = Number(String(creditsInput.value).replace(',', '.'));

  if (!name) return showError('Skriv inn emnekode eller fagnavn.', nameInput);
  if (!grade) return showError('Velg en karakter.');
  if (!(credits > 0) || credits > 120) return showError('Studiepoeng må være et tall mellom 0.5 og 120.', creditsInput);

  if (state.editingId) {
    const c = state.courses.find((x) => x.id === state.editingId);
    if (c) Object.assign(c, { name, grade, credits });
  } else {
    state.courses.push({ id: newId(), name, grade, credits });
  }

  hideToast(); // en gammel «Angre» ville ellers overskrevet emnet som nettopp ble lagt til
  const keepCredits = creditsInput.value;
  resetForm();
  creditsInput.value = keepCredits; // de fleste emner har samme stp – behold forrige verdi
  syncQuickCredits();
  persist();
  render();
  nameInput.focus();
});

form.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && state.editingId) {
    resetForm();
    renderTable();
  }
});

/* ================= Slett / angre ================= */

let toastTimer = null;
let undoSnapshot = null;

function showToast(text, snapshot) {
  undoSnapshot = snapshot;
  $('#toastText').textContent = text;
  $('#toast').hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(hideToast, 6000);
}

function hideToast() {
  $('#toast').hidden = true;
  undoSnapshot = null;
}

$('#toastUndo').addEventListener('click', () => {
  if (undoSnapshot) {
    state.courses = undoSnapshot;
    persist();
    render();
  }
  hideToast();
});

function deleteCourse(id) {
  const c = state.courses.find((x) => x.id === id);
  if (!c) return;
  const snapshot = state.courses.slice();
  state.courses = state.courses.filter((x) => x.id !== id);
  if (state.editingId === id) resetForm();
  persist();
  render();
  showToast(`«${c.name}» ble slettet.`, snapshot);
}

const resetBtn = $('#resetBtn');
let resetArmed = null;

resetBtn.addEventListener('click', () => {
  if (!state.courses.length) return;
  if (!resetArmed) {
    // To-trinns bekreftelse i stedet for en blokkerende dialog.
    resetBtn.textContent = 'Klikk igjen for å bekrefte';
    resetBtn.classList.add('confirm');
    resetArmed = setTimeout(disarmReset, 3500);
    return;
  }
  disarmReset();
  const snapshot = state.courses.slice();
  state.courses = [];
  resetForm();
  persist();
  render();
  showToast(`Alle ${snapshot.length} emner ble slettet.`, snapshot);
});

function disarmReset() {
  clearTimeout(resetArmed);
  resetArmed = null;
  resetBtn.textContent = 'Slett alle';
  resetBtn.classList.remove('confirm');
}

/* ================= Tabell ================= */

const ICON_EDIT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>';
const ICON_DEL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/></svg>';

function sortedCourses() {
  const { key, asc } = state.sort;
  if (!key) return state.courses;
  const dir = asc ? 1 : -1;
  return state.courses.slice().sort((a, b) => {
    if (key === 'name') return dir * a.name.localeCompare(b.name, 'nb', { numeric: true });
    if (key === 'credits') return dir * (a.credits - b.credits);
    return dir * (ALL_GRADES.indexOf(a.grade) - ALL_GRADES.indexOf(b.grade));
  });
}

document.querySelectorAll('#courseTable th[data-sort]').forEach((th) => {
  th.addEventListener('click', () => {
    const key = th.dataset.sort;
    if (state.sort.key === key) {
      if (state.sort.asc) state.sort.asc = false;
      else state.sort = { key: null, asc: true }; // tredje klikk: tilbake til rekkefølgen de ble lagt til
    } else {
      state.sort = { key, asc: true };
    }
    renderTable();
  });
});

function renderTable() {
  const tbody = $('#courseTable tbody');
  const includeF = state.settings.includeF;

  tbody.innerHTML = sortedCourses().map((c) => {
    const isLetter = c.grade in GRADE_VALUES;
    const counts = isLetter && (c.grade !== 'F' || includeF);
    const points = counts ? fmtCredits(GRADE_VALUES[c.grade] * c.credits) : '–';
    const note = !isLetter ? '<span class="excluded">teller ikke</span>'
      : !counts ? '<span class="excluded">utelatt</span>' : '';
    return `
      <tr data-id="${c.id}" class="${c.id === state.editingId ? 'editing' : ''}">
        <td class="name">${escapeHtml(c.name)}</td>
        <td><span class="grade-pill ${gradeClass(c.grade)}">${escapeHtml(c.grade)}</span>${note}</td>
        <td class="num">${fmtCredits(c.credits)}</td>
        <td class="num hide-sm">${points}</td>
        <td class="actions">
          <button class="icon-btn edit" type="button" title="Rediger" aria-label="Rediger ${escapeHtml(c.name)}">${ICON_EDIT}</button>
          <button class="icon-btn del" type="button" title="Slett" aria-label="Slett ${escapeHtml(c.name)}">${ICON_DEL}</button>
        </td>
      </tr>`;
  }).join('');

  document.querySelectorAll('#courseTable th[data-sort]').forEach((th) => {
    const active = th.dataset.sort === state.sort.key;
    th.classList.toggle('sorted', active);
    th.classList.toggle('asc', active && state.sort.asc);
  });

  $('#emptyState').hidden = state.courses.length > 0;
  $('#courseCount').textContent = String(state.courses.length);
  resetBtn.disabled = state.courses.length === 0;
}

$('#courseTable tbody').addEventListener('click', (e) => {
  const btn = e.target.closest('button');
  const row = e.target.closest('tr');
  if (!btn || !row) return;
  if (btn.classList.contains('edit')) startEdit(row.dataset.id);
  else if (btn.classList.contains('del')) deleteCourse(row.dataset.id);
});

$('#courseTable tbody').addEventListener('dblclick', (e) => {
  const row = e.target.closest('tr');
  if (row && !e.target.closest('button')) startEdit(row.dataset.id);
});

/* ================= Resultat ================= */

function renderSummary(stats) {
  const avgEl = $('#avgValue');
  const letterEl = $('#avgLetter');
  const hint = $('#avgHint');
  const marker = $('#scaleMarker');

  $('#statTotal').textContent = fmtCredits(stats.total);
  $('#statPassed').textContent = fmtCredits(stats.passed);
  $('#statGraded').textContent = fmtCredits(stats.graded);

  if (stats.avg === null) {
    avgEl.textContent = '–';
    letterEl.textContent = state.courses.length ? 'Ingen bokstavkarakterer' : 'Ingen karakterer';
    letterEl.removeAttribute('data-l');
    hint.textContent = state.courses.length
      ? 'Emner med bestått/ikke bestått teller ikke i snittet.'
      : 'Legg til emner for å se snittet ditt.';
    marker.hidden = true;
    return;
  }

  avgEl.textContent = fmt(stats.avg);
  letterEl.textContent = `${stats.letter}-snitt`;
  letterEl.dataset.l = stats.letter;

  const idx = THRESHOLDS.findIndex(([l]) => l === stats.letter);
  if (idx > 0) {
    const [nextLetter, nextMin] = THRESHOLDS[idx - 1];
    hint.textContent = `${fmt(nextMin - stats.avg)} poeng opp til ${nextLetter}-snitt (grense ${fmt(nextMin, 1)}).`;
  } else {
    hint.textContent = 'Toppkarakter – sterkt!';
  }

  marker.hidden = false;
  marker.style.left = `${(Math.min(5, Math.max(0, stats.avg)) / 5) * 100}%`;
}

function renderDistribution() {
  const totals = Object.fromEntries(ALL_GRADES.map((g) => [g, 0]));
  for (const c of state.courses) totals[c.grade] += c.credits;
  const max = Math.max(1, ...Object.values(totals));
  const colorVar = { A: '--g-A', B: '--g-B', C: '--g-C', D: '--g-D', E: '--g-E', F: '--g-F', [PASS]: '--g-P', [FAIL]: '--danger' };

  const dist = $('#dist');
  dist.innerHTML = ALL_GRADES.map((g) => `
    <div class="dist-row">
      <span>${escapeHtml(g)}</span>
      <div class="dist-bar"><div class="dist-fill" data-g="${escapeHtml(g)}"></div></div>
      <span class="num">${fmtCredits(totals[g])} stp</span>
    </div>`).join('');

  dist.querySelectorAll('.dist-fill').forEach((el) => {
    const g = el.dataset.g;
    el.style.width = `${(totals[g] / max) * 100}%`;
    el.style.background = `var(${colorVar[g]})`;
  });

  $('#distCard').hidden = state.courses.length === 0;
}

/* ================= Hva må jeg få? ================= */

const targetSelect = $('#targetLetter');
const plannedInput = $('#planned');

function gradeMixFor(required, planned) {
  // Foreslå en enkel kombinasjon av to nabokarakterer som gir minst `required` i snitt.
  const hi = Math.min(5, Math.ceil(required - EPS));
  const lo = hi - 1;
  const letterOf = (v) => Object.keys(GRADE_VALUES).find((k) => GRADE_VALUES[k] === v);
  if (lo < 0 || Math.abs(required - hi) < EPS || required <= lo + EPS) {
    return `alt ${letterOf(Math.max(0, hi))}`;
  }
  const unit = planned % 5 === 0 ? 5 : 0.5;
  const hiCredits = Math.min(planned, Math.ceil(((required - lo) * planned) / unit - EPS) * unit);
  const loCredits = planned - hiCredits;
  if (loCredits <= 0) return `alt ${letterOf(hi)}`;
  return `f.eks. ${fmtCredits(hiCredits)} stp ${letterOf(hi)} og ${fmtCredits(loCredits)} stp ${letterOf(lo)}`;
}

function renderWhatIf(stats) {
  const current = stats.letter;
  const targets = THRESHOLDS.filter(([l]) => l !== 'F').map(([l]) => l);

  // Standard: neste bokstav over nåværende snitt.
  let target = state.settings.target;
  if (!targets.includes(target)) {
    const idx = THRESHOLDS.findIndex(([l]) => l === current);
    target = current && idx > 0 ? THRESHOLDS[idx - 1][0] : current === 'A' ? 'A' : 'C';
  }

  targetSelect.innerHTML = targets
    .map((l) => `<option value="${l}" ${l === target ? 'selected' : ''}>${l}-snitt (≥ ${fmt(thresholdOf(l), 1)})</option>`)
    .join('');

  const planned = Number(String(plannedInput.value).replace(',', '.'));
  const box = $('#whatifResult');
  const tbody = $('#whatifTable tbody');

  if (!(planned > 0)) {
    box.className = 'whatif-result impossible';
    box.innerHTML = '<span class="muted">Skriv inn hvor mange studiepoeng du har igjen.</span>';
    tbody.innerHTML = '';
    return;
  }

  const t = thresholdOf(target);
  const req = requiredAverage(stats, t, planned);

  if (req <= 0) {
    box.className = 'whatif-result ok';
    box.innerHTML = `<span class="big">${target}-snitt er sikret</span>
      <span class="muted">Uansett karakter på de neste ${fmtCredits(planned)} stp.</span>`;
  } else if (req > 5 + EPS) {
    const needA = creditsOfANeeded(stats, t);
    box.className = 'whatif-result impossible';
    box.innerHTML = `<span class="big">Ikke mulig på ${fmtCredits(planned)} stp</span>
      <span class="muted">Du trenger ${fmt(req)} i snitt – over 5.00. Med bare A-er må du ta minst ${fmtCredits(Math.ceil(needA))} stp til.</span>`;
  } else {
    const keeping = stats.avg !== null && stats.avg >= t - EPS;
    box.className = keeping ? 'whatif-result ok' : 'whatif-result';
    box.innerHTML = `<span class="muted">${keeping ? `Du har ${target}-snitt nå. For å beholde det trenger du minst` : `For ${target}-snitt trenger du i snitt`}</span>
      <span class="big">${fmt(req)}</span>
      <span class="muted">på de neste ${fmtCredits(planned)} stp – ${gradeMixFor(req, planned)}.</span>`;
  }

  tbody.innerHTML = targets.map((l) => {
    const thr = thresholdOf(l);
    const r = requiredAverage(stats, thr, planned);
    const needA = creditsOfANeeded(stats, thr);
    const reqCell = r <= 0 ? '<span class="na">sikret</span>'
      : r > 5 + EPS ? '<span class="na">ikke mulig</span>'
      : fmt(r);
    const aCell = needA <= 0 ? '<span class="na">–</span>' : `${fmtCredits(Math.ceil(needA))} stp`;
    return `<tr><td><strong>${l}</strong></td><td>${reqCell}</td><td>${aCell}</td></tr>`;
  }).join('');
}

targetSelect.addEventListener('change', () => {
  state.settings.target = targetSelect.value;
  persist();
  renderWhatIf(currentStats());
});

plannedInput.addEventListener('input', () => {
  const v = Number(String(plannedInput.value).replace(',', '.'));
  if (v > 0) {
    state.settings.planned = v;
    persist();
  }
  renderWhatIf(currentStats());
});

/* ================= Innstillinger ================= */

$('#includeF').addEventListener('change', (e) => {
  state.settings.includeF = e.target.checked;
  persist();
  render();
});

/* ================= Oppstart ================= */

function currentStats() {
  return computeStats(state.courses, state.settings.includeF);
}

function render() {
  const stats = currentStats();
  renderSummary(stats);
  renderTable();
  renderDistribution();
  renderWhatIf(stats);
}

async function init() {
  if (window.api && window.api.platform) document.body.classList.add(`platform-${window.api.platform}`);

  const data = await storage.load();
  if (data && Array.isArray(data.courses)) {
    state.courses = data.courses.map(sanitizeCourse).filter(Boolean);
  }
  if (data && data.settings) Object.assign(state.settings, data.settings);
  if (!THEME_LABELS[state.settings.theme]) state.settings.theme = 'system';

  $('#includeF').checked = state.settings.includeF !== false;
  plannedInput.value = String(state.settings.planned || 30);
  applyTheme();
  resetForm();
  render();
  nameInput.focus();
}

init();
