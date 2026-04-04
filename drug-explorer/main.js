import { fetchAutocomplete } from './api.js';
import { renderInteractions } from './tabs/interactions.js';
import { renderAdverse }      from './tabs/adverse.js';
import { renderRecalls }      from './tabs/recalls.js';
import { renderDosage }       from './tabs/dosage.js';
import { initDrugClass }      from './tabs/drugclass.js';

// ── Common Drugs ────────────────────────────────────────────────────
const COMMON_DRUGS = [
  'Warfarin', 'Ibuprofen', 'Aspirin', 'Metformin', 'Lisinopril',
  'Atorvastatin', 'Metoprolol', 'Amoxicillin', 'Omeprazole', 'Sertraline',
  'Fluoxetine', 'Methotrexate', 'Prednisone', 'Levothyroxine', 'Gabapentin',
  'Amlodipine', 'Losartan', 'Simvastatin', 'Ciprofloxacin', 'Acetaminophen',
  'Escitalopram'
];

// ── State ───────────────────────────────────────────────────────────
let activeTab = 'interactions';

// ── Sticky tab bar: compute banner height ────────────────────────────
const disclaimerBanner = document.querySelector('.disclaimer-banner');
if (disclaimerBanner) {
  document.documentElement.style.setProperty('--banner-h', `${disclaimerBanner.offsetHeight}px`);
}

// ── Elements ────────────────────────────────────────────────────────
const selectA    = document.getElementById('select-a');
const selectB    = document.getElementById('select-b');
const inputA     = document.getElementById('input-a');
const inputB     = document.getElementById('input-b');
const acA        = document.getElementById('autocomplete-a');
const acB        = document.getElementById('autocomplete-b');
const compareBtn = document.getElementById('compare-btn');
const btnText    = compareBtn.querySelector('.compare-btn-text');
const spinner    = compareBtn.querySelector('.compare-spinner');
const validMsg   = document.getElementById('validation-msg');
const swapBtn    = document.getElementById('swap-btn');
const exampleP   = document.getElementById('example-prompt');
const tryLink    = document.getElementById('try-own-link');
const results       = document.getElementById('results-section');
const recentEl      = document.getElementById('recent-comparisons');
const summaryEl     = document.getElementById('summary-banner');
const globalErrEl   = document.getElementById('global-error-banner');

// ── Populate Dropdowns ──────────────────────────────────────────────
for (const name of COMMON_DRUGS) {
  const optA = new Option(name, name);
  const optB = new Option(name, name);
  selectA.appendChild(optA);
  selectB.appendChild(optB);
}

// ── Dropdown → text input sync ──────────────────────────────────────
selectA.addEventListener('change', () => { if (selectA.value) inputA.value = selectA.value; });
selectB.addEventListener('change', () => { if (selectB.value) inputB.value = selectB.value; });

// ── Recent Comparisons ───────────────────────────────────────────────
const RECENT_KEY = 'drugexp_recent';
const RECENT_MAX = 5;

function loadRecent() {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY)) ?? []; }
  catch { return []; }
}

function saveRecent(drugA, drugB) {
  const list = loadRecent().filter(r => !(r.a === drugA && r.b === drugB));
  list.unshift({ a: drugA, b: drugB });
  try { localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, RECENT_MAX))); } catch { /* storage full */ }
}

function renderRecentChips() {
  const list = loadRecent();
  if (list.length === 0) { recentEl.hidden = true; return; }
  recentEl.hidden = false;
  recentEl.innerHTML = '';

  const lbl = document.createElement('span');
  lbl.className = 'recent-label';
  lbl.textContent = 'Recent:';
  recentEl.appendChild(lbl);

  for (const { a, b } of list) {
    const chip = document.createElement('button');
    chip.className = 'recent-chip';
    chip.textContent = `${a} + ${b}`;
    chip.addEventListener('click', () => {
      inputA.value = a;
      inputB.value = b;
      selectA.value = COMMON_DRUGS.includes(a) ? a : '';
      selectB.value = COMMON_DRUGS.includes(b) ? b : '';
      exampleP.hidden = true;
      runCompare(a, b);
    });
    recentEl.appendChild(chip);
  }
}

renderRecentChips();

// ── Autocomplete ────────────────────────────────────────────────────
function setupAutocomplete(input, listEl) {
  let timer = null;
  let activeIdx = -1;

  function setActive(idx) {
    const items = listEl.querySelectorAll('li');
    if (activeIdx >= 0 && activeIdx < items.length) {
      items[activeIdx].classList.remove('autocomplete-highlighted');
      items[activeIdx].setAttribute('aria-selected', 'false');
    }
    activeIdx = idx;
    if (activeIdx >= 0 && activeIdx < items.length) {
      const item = items[activeIdx];
      item.classList.add('autocomplete-highlighted');
      item.setAttribute('aria-selected', 'true');
      input.setAttribute('aria-activedescendant', item.id);
      item.scrollIntoView({ block: 'nearest' });
    } else {
      input.removeAttribute('aria-activedescendant');
    }
  }

  input.addEventListener('input', () => {
    clearTimeout(timer);
    activeIdx = -1;
    const q = input.value.trim();
    if (q.length < 3) { listEl.innerHTML = ''; return; }
    timer = setTimeout(async () => {
      const suggestions = await fetchAutocomplete(q).catch(() => []);
      listEl.innerHTML = '';
      activeIdx = -1;
      input.removeAttribute('aria-activedescendant');
      const prefix = listEl.id;
      for (let i = 0; i < suggestions.length; i++) {
        const name = suggestions[i];
        const li = document.createElement('li');
        li.id = `${prefix}-opt-${i}`;
        li.textContent = name;
        li.setAttribute('role', 'option');
        li.setAttribute('aria-selected', 'false');
        li.addEventListener('mousedown', e => {
          e.preventDefault();
          input.value = name;
          listEl.innerHTML = '';
          activeIdx = -1;
          input.removeAttribute('aria-activedescendant');
        });
        listEl.appendChild(li);
      }
    }, 300);
  });

  input.addEventListener('keydown', e => {
    const items = listEl.querySelectorAll('li');
    if (!items.length) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive(Math.min(activeIdx + 1, items.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive(Math.max(activeIdx - 1, 0));
    } else if (e.key === 'Enter' && activeIdx >= 0) {
      e.preventDefault();
      input.value = items[activeIdx].textContent;
      listEl.innerHTML = '';
      activeIdx = -1;
      input.removeAttribute('aria-activedescendant');
    } else if (e.key === 'Escape') {
      listEl.innerHTML = '';
      activeIdx = -1;
      input.removeAttribute('aria-activedescendant');
    }
  });

  input.addEventListener('blur', () => {
    setTimeout(() => {
      listEl.innerHTML = '';
      activeIdx = -1;
    }, 200);
  });
}

setupAutocomplete(inputA, acA);
setupAutocomplete(inputB, acB);

// ── Tab Routing ─────────────────────────────────────────────────────
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const tab = btn.dataset.tab;
    switchTab(tab);
  });
});

function switchTab(tab) {
  activeTab = tab;

  document.querySelectorAll('.tab-btn').forEach(b => {
    const isActive = b.dataset.tab === tab;
    b.classList.toggle('active', isActive);
    b.setAttribute('aria-selected', isActive);
  });

  document.querySelectorAll('.tab-panel').forEach(panel => {
    const isActive = panel.id === `panel-${tab}`;
    panel.classList.toggle('active', isActive);
    panel.hidden = !isActive;
  });

  if (tab === 'drugclass') initDrugClass();
}

// ── Compare Logic ───────────────────────────────────────────────────
async function runCompare(drugA, drugB, isExample = false) {
  validMsg.textContent = '';
  setLoading(true);
  summaryEl.hidden = true;
  globalErrEl.hidden = true;

  // Reset recall tab badge
  document.getElementById('tab-recalls').textContent = 'Recall History';

  results.hidden = false;
  switchTab('interactions');

  // Show all skeletons
  document.querySelectorAll('.skeleton-container').forEach(s => s.style.display = 'block');
  document.querySelectorAll('[id^="content-"]').forEach(c => c.innerHTML = '');

  // Render each tab independently (stagger reveal as data arrives)
  const [intSum, advSum, recSum] = await Promise.all([
    renderInteractions(drugA, drugB).catch(e => { showGlobalError(e); return null; }),
    renderAdverse(drugA, drugB).catch(e => { showGlobalError(e); return null; }),
    renderRecalls(drugA, drugB).catch(e => { showGlobalError(e); return null; }),
    renderDosage(drugA, drugB).catch(e => { showGlobalError(e); return null; }),
  ]);

  setLoading(false);

  // Recall tab badge
  if (recSum) {
    const total = (recSum.countA ?? 0) + (recSum.countB ?? 0);
    if (total > 0) {
      document.getElementById('tab-recalls').textContent = `Recall History · ${total}`;
    }
  }

  // Summary banner
  buildSummaryBanner(intSum, advSum, recSum);

  // Save to recent and update URL hash (not for the boot example)
  if (!isExample) {
    saveRecent(drugA, drugB);
    renderRecentChips();
    location.hash = `${encodeURIComponent(drugA)}+${encodeURIComponent(drugB)}`;
  }
}

function buildSummaryBanner(intSum, advSum, recSum) {
  const mentions = (intSum?.hitsA ?? 0) + (intSum?.hitsB ?? 0);
  const reports  = (advSum?.totalA  ?? 0) + (advSum?.totalB  ?? 0);
  const recalls  = (recSum?.countA  ?? 0) + (recSum?.countB  ?? 0);

  summaryEl.innerHTML = '';

  const stats = [
    { icon: '⚡', label: 'Interaction mentions', value: mentions.toString() },
    { icon: '📊', label: 'Adverse reports',      value: fmtNum(reports) },
    { icon: '⚠️',  label: 'Recalls',              value: recalls.toString() },
  ];

  stats.forEach((s, i) => {
    const stat = document.createElement('span');
    stat.className = 'summary-stat';
    stat.innerHTML = `<span aria-hidden="true">${s.icon}</span> ${s.label}: <strong>${s.value}</strong>`;
    summaryEl.appendChild(stat);
    if (i < stats.length - 1) {
      const sep = document.createElement('span');
      sep.className = 'summary-sep';
      sep.setAttribute('aria-hidden', 'true');
      sep.textContent = '·';
      summaryEl.appendChild(sep);
    }
  });

  summaryEl.hidden = false;
}

function fmtNum(n) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(0)}K`;
  return n.toString();
}

// ── Swap Button ─────────────────────────────────────────────────────
swapBtn.addEventListener('click', () => {
  const tmp = inputA.value;
  inputA.value = inputB.value;
  inputB.value = tmp;
  const tmpSel = selectA.value;
  selectA.value = selectB.value;
  selectB.value = tmpSel;
});

compareBtn.addEventListener('click', () => {
  const drugA = inputA.value.trim();
  const drugB = inputB.value.trim();

  if (!drugA || !drugB) {
    validMsg.textContent = 'Please enter a drug name for both fields.';
    if (!drugA) inputA.focus();
    else inputB.focus();
    return;
  }

  if (drugA.toLowerCase() === drugB.toLowerCase()) {
    validMsg.textContent = 'Please enter two different drug names.';
    inputB.focus();
    return;
  }

  exampleP.hidden = true;
  runCompare(drugA, drugB, false);
});

function setLoading(on) {
  compareBtn.disabled = on;
  btnText.textContent = on ? 'Comparing…' : 'Compare';
  spinner.hidden = !on;
  recentEl.querySelectorAll('.recent-chip').forEach(c => { c.disabled = on; });
}

function showGlobalError(err) {
  console.error('Tab render error:', err);
  globalErrEl.hidden = false;
}

// ── "Try your own" link ─────────────────────────────────────────────
tryLink.addEventListener('click', e => {
  e.preventDefault();
  inputA.value = '';
  inputB.value = '';
  selectA.value = '';
  selectB.value = '';
  exampleP.hidden = true;
  summaryEl.hidden = true;
  inputA.focus();
});

// ── Boot: load from URL hash or fall back to Warfarin + Ibuprofen ──
(function boot() {
  const hash = location.hash.slice(1);
  if (hash) {
    const parts = hash.split('+').map(p => decodeURIComponent(p));
    if (parts.length === 2 && parts[0] && parts[1]) {
      const [a, b] = parts;
      inputA.value = a; selectA.value = COMMON_DRUGS.includes(a) ? a : '';
      inputB.value = b; selectB.value = COMMON_DRUGS.includes(b) ? b : '';
      exampleP.hidden = true;
      runCompare(a, b, false);
      return;
    }
  }
  inputA.value = 'Warfarin';
  inputB.value = 'Ibuprofen';
  selectA.value = 'Warfarin';
  selectB.value = 'Ibuprofen';
  runCompare('Warfarin', 'Ibuprofen', true);
}());
