// ===================== TAB 5: IMPACT RISK (JPL Sentry) =====================
// Data source: https://ssd-api.jpl.nasa.gov/sentry.api (no API key needed)

const SENTRY_BASE = 'https://ssd-api.jpl.nasa.gov/sentry.api';
const PROXIES = [
  url => `https://corsproxy.io/?url=${url}`,
  url => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
];

let sentryData = [];
let sortKey = 'ps_cum';
let sortDir = -1; // descending by default (most dangerous first)
let _ac = null; // AbortController — cancelled on re-init to prevent listener accumulation

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

  document.querySelectorAll('#sentry-table thead th').forEach(th => {
    th.classList.remove('sorted-asc', 'sorted-desc');
    if (th.dataset.col === sortKey) th.classList.add(sortDir === -1 ? 'sorted-desc' : 'sorted-asc');
  });

  document.getElementById('sentry-tbody').innerHTML = rows.map(r => {
    const name              = r.fullname || r.des || '—';
    // API returns a range string like "2056-2113"; guard against missing hyphen
    const rangeParts = (r.range || '').split('-');
    const yearMin = rangeParts[0] || '?';
    const yearMax = rangeParts[1] || yearMin || '?';
    const nImp              = r.n_imp ?? '—';
    // ip is cumulative impact probability (0–1); display as "1 in N"
    const ipRaw = r.ip !== undefined ? parseFloat(r.ip) : NaN;
    const ipPct = (!isNaN(ipRaw) && ipRaw > 0)
      ? `1 in ${Math.round(1 / ipRaw).toLocaleString()}`
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

export async function initImpactRisk(_state) {
  if (_ac) _ac.abort();
  _ac = new AbortController();
  const { signal } = _ac;
  document.getElementById('sentry-tbody').innerHTML =
    '<tr><td colspan="7"><div class="skeleton" style="height:300px"></div></td></tr>';

  let lastErr;
  for (const proxy of PROXIES) {
    try {
      const resp = await fetch(proxy(SENTRY_BASE));
      if (!resp.ok) throw new Error(`Sentry API error ${resp.status}`);
      const data = await resp.json();
      sentryData = data.data || [];
      lastErr = null;
      break;
    } catch (err) {
      lastErr = err;
    }
  }

  if (lastErr) {
    document.getElementById('sentry-table-wrapper').innerHTML = `
      <div class="error-card">
        <p>JPL Sentry data unavailable — both CORS proxies failed.</p>
        <p class="muted" style="font-size:0.8rem;margin-top:4px">${lastErr.message}</p>
        <p class="error-time">Last attempted: ${new Date().toLocaleTimeString()}</p>
        <button class="retry-btn" onclick="location.reload()">Retry</button>
      </div>
    `;
    return;
  }

  renderTable();

  // Name search filter + clear button
  const clearBtn = document.getElementById('sentry-clear');
  document.getElementById('sentry-search').addEventListener('input', e => {
    clearBtn.classList.toggle('hidden', !e.target.value);
    renderTable(e.target.value);
  }, { signal });
  clearBtn.addEventListener('click', () => {
    document.getElementById('sentry-search').value = '';
    clearBtn.classList.add('hidden');
    renderTable('');
  }, { signal });

  // Column header sort
  document.querySelectorAll('#sentry-table thead th').forEach(th => {
    th.addEventListener('click', () => {
      const key = th.dataset.col;
      if (!key) return;
      if (sortKey === key) sortDir *= -1;
      else { sortKey = key; sortDir = -1; }
      renderTable(document.getElementById('sentry-search').value);
    }, { signal });
  });
}
