// ===================== TAB 2: THIS WEEK IN SPACE ROCKS =====================
import { fetchFeed, parseNeo } from '../shared.js';

let allNeos = [];
let sortCol = 'date';
let sortDir = 1;

function renderCards(neos) {
  const closest = [...neos].sort((a, b) => a.ld - b.ld)[0];
  const largest = [...neos].sort((a, b) => b.diameter - a.diameter)[0];
  const fastest = [...neos].sort((a, b) => b.vel - a.vel)[0];
  const phaCount = neos.filter(n => n.isPha).length;

  document.getElementById('stat-cards').innerHTML = `
    <div class="stat-card">
      <div class="card-label">Total NEOs This Week</div>
      <div class="card-value">${neos.length}</div>
    </div>
    <div class="stat-card">
      <div class="card-label">Closest Approach</div>
      <div class="card-value">${closest.ld.toFixed(2)}<span class="card-unit">LD</span></div>
      <div class="card-sub">${closest.name}</div>
    </div>
    <div class="stat-card">
      <div class="card-label">Largest Object</div>
      <div class="card-value">${closest ? largest.diameter.toFixed(0) : '—'}<span class="card-unit">m</span></div>
      <div class="card-sub">${largest.name}</div>
    </div>
    <div class="stat-card">
      <div class="card-label">Fastest Flyby</div>
      <div class="card-value">${fastest.vel.toFixed(1)}<span class="card-unit">km/s</span></div>
      <div class="card-sub">${fastest.name}</div>
    </div>
    <div class="stat-card danger">
      <div class="card-label">Potentially Hazardous</div>
      <div class="card-value">${phaCount}</div>
    </div>
  `;
}

function applyFilters(neos) {
  let rows = [...neos];

  if (document.getElementById('pha-only-toggle')?.checked) {
    rows = rows.filter(n => n.isPha);
  }

  const maxLd = parseFloat(document.getElementById('max-ld')?.value ?? 500);
  if (!isNaN(maxLd)) rows = rows.filter(n => n.ld <= maxLd);

  const colMap = { date: 'date', distance: 'ld', diameter: 'diameter', velocity: 'vel', name: 'name', hazardous: 'isPha' };
  const key = colMap[sortCol] || 'date';

  rows.sort((a, b) => {
    const av = a[key], bv = b[key];
    if (typeof av === 'string') return av.localeCompare(bv) * sortDir;
    return (av - bv) * sortDir;
  });

  return rows;
}

function renderTable() {
  const rows = applyFilters(allNeos);
  document.getElementById('neo-tbody').innerHTML = rows.map(n => `
    <tr data-id="${n.id}">
      <td>${n.name}</td>
      <td>${n.date}</td>
      <td>${n.ld.toFixed(3)}</td>
      <td>${n.diameter.toFixed(0)}</td>
      <td>${n.vel.toFixed(2)}</td>
      <td class="${n.isPha ? 'hazard-yes' : 'hazard-no'}">${n.isPha ? '✓' : '✗'}</td>
    </tr>
  `).join('');

  // Row click → switch to Size & Speed with this asteroid pre-selected
  document.querySelectorAll('#neo-tbody tr').forEach(row => {
    row.addEventListener('click', () => {
      document.querySelectorAll('#neo-tbody tr').forEach(r => r.classList.remove('selected'));
      row.classList.add('selected');
      window.__preselectNeoId = row.dataset.id;
      document.dispatchEvent(new CustomEvent('preselect-neo', { detail: row.dataset.id }));
      document.querySelector('[data-tab="size-speed"]').click();
    });
  });
}

export async function initThisWeek(state) {
  // Show skeletons
  document.getElementById('stat-cards').innerHTML =
    '<div class="skeleton" style="height:90px;grid-column:1/-1"></div>';
  document.getElementById('neo-tbody').innerHTML =
    '<tr><td colspan="6"><div class="skeleton" style="height:200px"></div></td></tr>';

  try {
    allNeos = (await fetchFeed()).map(parseNeo);
  } catch (err) {
    document.getElementById('stat-cards').innerHTML =
      `<div class="error-card"><p>${err.message}</p><button class="retry-btn" onclick="location.reload()">Retry</button></div>`;
    return;
  }

  renderCards(allNeos);
  renderTable();

  // Column header sort
  document.querySelectorAll('#neo-table th').forEach(th => {
    th.addEventListener('click', () => {
      const col = th.dataset.col;
      if (sortCol === col) sortDir *= -1;
      else { sortCol = col; sortDir = 1; }
      renderTable();
    });
  });

  // Filter controls
  document.getElementById('pha-only-toggle').addEventListener('change', renderTable);
  document.getElementById('max-ld').addEventListener('input', renderTable);
  document.getElementById('sort-select').addEventListener('change', e => {
    sortCol = e.target.value;
    sortDir = 1;
    renderTable();
  });
}
