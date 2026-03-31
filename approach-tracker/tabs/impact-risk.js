// ===================== TAB 5: IMPACT RISK (JPL Sentry) =====================
// Data source: https://ssd-api.jpl.nasa.gov/sentry.api (no API key needed)

const SENTRY_URL = 'https://ssd-api.jpl.nasa.gov/sentry.api';

let sentryData = [];
let sortKey = 'ps_cum';
let sortDir = -1; // descending by default (most dangerous first)

function torinoClass(ts) {
  const t = parseInt(ts, 10) || 0;
  if (t >= 4) return 'ts-4p';
  if (t >= 1) return 'ts-1-3';
  return 'ts-0';
}

function renderTable(filter = '') {
  let rows = [...sentryData];

  if (filter) {
    const q = filter.toLowerCase();
    rows = rows.filter(r =>
      (r.fullname || r.des || '').toLowerCase().includes(q)
    );
  }

  rows.sort((a, b) => {
    const av = parseFloat(a[sortKey]) || 0;
    const bv = parseFloat(b[sortKey]) || 0;
    return (av - bv) * sortDir;
  });

  document.getElementById('sentry-tbody').innerHTML = rows.map(r => {
    const name    = r.fullname || r.des || '—';
    const yearMin = r.range_year_min  || r.year_min  || '?';
    const yearMax = r.range_year_max  || r.year_max  || '?';
    const nImp    = r.n_imp           || r.n_impacts || '—';
    // ip is cumulative impact probability (0–1)
    const ipPct   = r.ip !== undefined
      ? (parseFloat(r.ip) * 100).toExponential(2) + '%'
      : '—';
    const ps      = r.ps_cum !== undefined ? parseFloat(r.ps_cum).toFixed(2) : '—';
    const ts      = parseInt(r.ts_max || r.ts || 0, 10);
    const diam    = r.diameter ? parseFloat(r.diameter).toFixed(3) + ' km' : '—';

    return `
      <tr>
        <td>${name}</td>
        <td>${yearMin}–${yearMax}</td>
        <td>${nImp}</td>
        <td>${ipPct}</td>
        <td class="${torinoClass(ts)}">${ps}</td>
        <td class="${torinoClass(ts)}">${ts}</td>
        <td>${diam}</td>
      </tr>
    `;
  }).join('');
}

export async function initImpactRisk(state) {
  document.getElementById('sentry-tbody').innerHTML =
    '<tr><td colspan="7"><div class="skeleton" style="height:300px"></div></td></tr>';

  try {
    const resp = await fetch(SENTRY_URL);
    if (!resp.ok) throw new Error(`Sentry API error ${resp.status}`);
    const data = await resp.json();
    sentryData = data.data || [];
  } catch (err) {
    document.getElementById('sentry-table-wrapper').innerHTML = `
      <div class="error-card">
        <p>Sentry API unavailable: ${err.message}</p>
        <p class="error-time">Last attempted: ${new Date().toLocaleTimeString()}</p>
        <button class="retry-btn" onclick="location.reload()">Retry</button>
      </div>
    `;
    return;
  }

  renderTable();

  // Name search filter
  document.getElementById('sentry-search').addEventListener('input', e => {
    renderTable(e.target.value);
  });

  // Sort dropdown
  document.getElementById('sentry-sort').addEventListener('change', e => {
    sortKey = e.target.value;
    sortDir = -1;
    renderTable(document.getElementById('sentry-search').value);
  });

  // Column header sort
  const colKeys = ['fullname', 'range_year_min', 'n_imp', 'ip', 'ps_cum', 'ts_max', 'diameter'];
  document.querySelectorAll('#sentry-table thead th').forEach((th, i) => {
    th.addEventListener('click', () => {
      const key = colKeys[i];
      if (!key) return;
      if (sortKey === key) sortDir *= -1;
      else { sortKey = key; sortDir = -1; }
      renderTable(document.getElementById('sentry-search').value);
    });
  });
}
