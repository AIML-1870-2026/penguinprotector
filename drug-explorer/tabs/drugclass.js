import { fetchDrugsByClass, fetchAdverseCount, fetchRecallCount } from '../api.js';
import { escHtml, fmtNum } from '../utils.js';

// Predefined drug classes mapped to their OpenFDA pharm_class_epc search strings
export const DRUG_CLASSES = {
  'SSRIs (Antidepressants)':       'Selective Serotonin Reuptake Inhibitor [EPC]',
  'Statins (Cholesterol)':          'HMG-CoA Reductase Inhibitor [EPC]',
  'ACE Inhibitors (Blood Pressure)':'Angiotensin-Converting Enzyme Inhibitor [EPC]',
  'Beta Blockers (Heart)':          'beta-Adrenergic Blocker [EPC]',
  'Benzodiazepines (Anxiety)':      'Benzodiazepine [EPC]',
  'NSAIDs (Pain/Inflammation)':     'Nonsteroidal Anti-inflammatory Drug [EPC]',
  'Proton Pump Inhibitors (GERD)':  'Proton Pump Inhibitor [EPC]',
  'Opioids (Pain)':                 'Opioid Agonist [EPC]',
};

let initialized = false;

export function initDrugClass() {
  if (initialized) return;
  initialized = true;

  const container = document.getElementById('content-drugclass');
  if (!container) return;

  container.innerHTML = '';

  const wrap = document.createElement('div');

  // Intro text
  const intro = document.createElement('p');
  intro.className = 'dc-intro';
  intro.textContent = 'Select a drug class to explore its members and compare their safety profiles — adverse event burden, recall history, and relative risk within the class.';
  wrap.appendChild(intro);

  // Controls row
  const controls = document.createElement('div');
  controls.className = 'dc-controls';

  const select = document.createElement('select');
  select.className = 'dc-class-select';
  select.setAttribute('aria-label', 'Select a drug class to explore');
  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = '— Choose a drug class —';
  select.appendChild(placeholder);
  for (const label of Object.keys(DRUG_CLASSES)) {
    const opt = document.createElement('option');
    opt.value = label;
    opt.textContent = label;
    select.appendChild(opt);
  }
  controls.appendChild(select);

  const exploreBtn = document.createElement('button');
  exploreBtn.className = 'dc-explore-btn';
  exploreBtn.textContent = 'Explore Class';
  controls.appendChild(exploreBtn);

  wrap.appendChild(controls);

  // Results area
  const results = document.createElement('div');
  results.id = 'dc-results';
  wrap.appendChild(results);

  container.appendChild(wrap);

  exploreBtn.addEventListener('click', () => {
    const chosen = select.value;
    if (!chosen) return;
    exploreClass(chosen, DRUG_CLASSES[chosen], results);
  });

  // Also trigger on Enter in select
  select.addEventListener('keydown', e => {
    if (e.key === 'Enter') exploreBtn.click();
  });
}

async function exploreClass(label, pharmClassEpc, resultsEl) {
  resultsEl.innerHTML = '';

  const loading = document.createElement('div');
  loading.className = 'dc-loading';
  loading.textContent = `Loading drugs in ${label}…`;
  resultsEl.appendChild(loading);

  let drugs;
  try {
    drugs = await fetchDrugsByClass(pharmClassEpc);
  } catch {
    resultsEl.innerHTML = `<p class="dc-error">Could not load drug class data. Try again.</p>`;
    return;
  }

  resultsEl.innerHTML = '';

  if (!drugs || drugs.length === 0) {
    resultsEl.innerHTML = `<p class="dc-error">No drugs found for this class in the FDA database.</p>`;
    return;
  }

  // Heading
  const heading = document.createElement('div');
  heading.className = 'dc-results-heading';
  heading.innerHTML = `<strong>${escHtml(label)}</strong> — ${drugs.length} drugs found. Fetching safety data…`;
  resultsEl.appendChild(heading);

  // Table shell
  const table = document.createElement('table');
  table.className = 'dc-table';
  table.setAttribute('aria-label', `Drug class comparison for ${label}`);
  table.innerHTML = `
    <thead>
      <tr>
        <th scope="col" class="dc-th-rank">#</th>
        <th scope="col" class="dc-th-drug">Drug (Generic Name)</th>
        <th scope="col" class="dc-th-ae">AE Reports</th>
        <th scope="col" class="dc-th-recalls">Recalls</th>
        <th scope="col" class="dc-th-action">Compare</th>
      </tr>
    </thead>
    <tbody id="dc-tbody"></tbody>
  `;
  resultsEl.appendChild(table);

  const tbody = table.querySelector('#dc-tbody');

  // Insert placeholder rows
  for (let i = 0; i < drugs.length; i++) {
    const tr = document.createElement('tr');
    tr.id = `dc-row-${i}`;
    tr.className = 'dc-row dc-row-loading';
    tr.innerHTML = `
      <td class="dc-td-rank">${i + 1}</td>
      <td class="dc-td-drug">${escHtml(titleCase(drugs[i]))}</td>
      <td class="dc-td-ae dc-shimmer" aria-label="Loading">—</td>
      <td class="dc-td-recalls dc-shimmer" aria-label="Loading">—</td>
      <td class="dc-td-action">
        <button class="dc-set-btn dc-set-a" data-drug="${escHtml(drugs[i])}" title="Set as Drug A">A</button>
        <button class="dc-set-btn dc-set-b" data-drug="${escHtml(drugs[i])}" title="Set as Drug B">B</button>
      </td>
    `;
    tbody.appendChild(tr);
  }

  // Wire up Set A / Set B buttons
  tbody.addEventListener('click', e => {
    const btn = e.target.closest('.dc-set-btn');
    if (!btn) return;
    const drug = btn.dataset.drug;
    const isA = btn.classList.contains('dc-set-a');
    const inputId = isA ? 'input-a' : 'input-b';
    const selectId = isA ? 'select-a' : 'select-b';
    document.getElementById(inputId).value = drug;
    document.getElementById(selectId).value = '';
    document.getElementById(inputId).scrollIntoView({ behavior: 'smooth', block: 'center' });

    const orig = btn.textContent;
    btn.textContent = '✓';
    btn.disabled = true;
    btn.classList.add('dc-set-confirmed');
    setTimeout(() => {
      btn.textContent = orig;
      btn.disabled = false;
      btn.classList.remove('dc-set-confirmed');
    }, 900);
  });

  // Fetch AE + recall counts for each drug concurrently, update rows as they arrive
  const rowData = drugs.map((drug, i) => ({ drug, i, ae: null, recalls: null }));

  const updateRow = (idx, ae, recalls) => {
    const tr = document.getElementById(`dc-row-${idx}`);
    if (!tr) return;
    tr.classList.remove('dc-row-loading');
    tr.querySelector('.dc-td-ae').classList.remove('dc-shimmer');
    tr.querySelector('.dc-td-recalls').classList.remove('dc-shimmer');
    tr.querySelector('.dc-td-ae').textContent = fmtNum(ae);
    tr.querySelector('.dc-td-recalls').textContent = recalls.toLocaleString();
    tr.querySelector('.dc-td-ae').setAttribute('data-val', ae);
  };

  await Promise.all(rowData.map(async ({ drug, i }) => {
    const [ae, recalls] = await Promise.all([
      fetchAdverseCount(drug).catch(() => 0),
      fetchRecallCount(drug).catch(() => 0),
    ]);
    updateRow(i, ae, recalls);
    rowData[i].ae = ae;
    rowData[i].recalls = recalls;
  }));

  // Sort rows by AE count descending
  const rows = [...tbody.querySelectorAll('tr')].sort((a, b) => {
    const aeA = parseInt(a.querySelector('.dc-td-ae').getAttribute('data-val') ?? '0');
    const aeB = parseInt(b.querySelector('.dc-td-ae').getAttribute('data-val') ?? '0');
    return aeB - aeA;
  });
  rows.forEach((tr, i) => {
    tr.querySelector('.dc-td-rank').textContent = i + 1;
    tbody.appendChild(tr);
  });

  heading.innerHTML = `<strong>${escHtml(label)}</strong> — ${drugs.length} drugs, ranked by adverse event reports`;

  // Insight callout
  const sorted = [...rowData].sort((a, b) => (b.ae ?? 0) - (a.ae ?? 0));
  if (sorted.length >= 2 && sorted[0].ae != null && sorted[1].ae != null) {
    const callout = document.createElement('div');
    callout.className = 'dc-insight';
    const top = sorted[0];
    const bottom = sorted[sorted.length - 1];
    callout.innerHTML = `<strong>${escHtml(titleCase(top.drug))}</strong> has the highest FAERS report volume in this class. ` +
      `<strong>${escHtml(titleCase(bottom.drug))}</strong> has the lowest. ` +
      `Report volume often reflects prescription volume, not relative risk.`;
    resultsEl.appendChild(callout);
  }
}

function titleCase(str) {
  return str.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
}
