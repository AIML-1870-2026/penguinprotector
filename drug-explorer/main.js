import { fetchAutocomplete } from './api.js';
import { renderInteractions } from './tabs/interactions.js';
import { renderAdverse }      from './tabs/adverse.js';
import { renderRecalls }      from './tabs/recalls.js';

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
const exampleP   = document.getElementById('example-prompt');
const tryLink    = document.getElementById('try-own-link');
const results    = document.getElementById('results-section');

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
}

// ── Compare Logic ───────────────────────────────────────────────────
async function runCompare(drugA, drugB) {
  validMsg.textContent = '';
  setLoading(true);

  results.hidden = false;
  switchTab('interactions');

  // Show all skeletons
  document.querySelectorAll('.skeleton-container').forEach(s => s.style.display = 'block');
  document.querySelectorAll('[id^="content-"]').forEach(c => c.innerHTML = '');

  // Render each tab independently (stagger reveal as data arrives)
  const p1 = renderInteractions(drugA, drugB).catch(showGlobalError);
  const p2 = renderAdverse(drugA, drugB).catch(showGlobalError);
  const p3 = renderRecalls(drugA, drugB).catch(showGlobalError);

  await Promise.all([p1, p2, p3]);
  setLoading(false);
}

compareBtn.addEventListener('click', () => {
  const drugA = inputA.value.trim();
  const drugB = inputB.value.trim();

  if (!drugA || !drugB) {
    validMsg.textContent = 'Please enter a drug name for both fields.';
    if (!drugA) inputA.focus();
    else inputB.focus();
    return;
  }

  exampleP.hidden = true;
  runCompare(drugA, drugB);
});

function setLoading(on) {
  compareBtn.disabled = on;
  btnText.textContent = on ? 'Comparing…' : 'Compare';
  spinner.hidden = !on;
}

function showGlobalError(err) {
  console.error('Tab render error:', err);
}

// ── "Try your own" link ─────────────────────────────────────────────
tryLink.addEventListener('click', e => {
  e.preventDefault();
  inputA.value = '';
  inputB.value = '';
  selectA.value = '';
  selectB.value = '';
  exampleP.hidden = true;
  inputA.focus();
});

// ── Boot: pre-populate Warfarin + Ibuprofen ─────────────────────────
inputA.value = 'Warfarin';
inputB.value = 'Ibuprofen';
selectA.value = 'Warfarin';
selectB.value = 'Ibuprofen';
runCompare('Warfarin', 'Ibuprofen');
