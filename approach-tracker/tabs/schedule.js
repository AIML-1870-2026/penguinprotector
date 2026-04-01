// ===================== TAB 4: SCHEDULE (30-day timeline + calendar) =====================
import { NASA_API_KEY, showSpinner, hideSpinner } from '../shared.js';

let _ac = null; // AbortController — cancelled on re-init to prevent listener accumulation
let _calendarRendered = false;

// Fetch 30 days in weekly chunks (NeoWs max range = 7 days per request)
async function fetch30Days(state) {
  if (state.scheduleCache) return state.scheduleCache;
  showSpinner();

  const chunks = [];
  const start = new Date();
  const end30 = new Date(start);
  end30.setDate(end30.getDate() + 29); // inclusive day 29 = exactly 30 days

  for (let i = 0; i < 5; i++) {
    const s = new Date(start);
    s.setDate(s.getDate() + i * 7);
    if (s > end30) break; // no chunk starts beyond day 29
    const e = new Date(s);
    e.setDate(e.getDate() + 6);
    if (e > end30) e.setTime(end30.getTime()); // cap last chunk at day 29
    chunks.push({
      start: s.toISOString().split('T')[0],
      end:   e.toISOString().split('T')[0],
    });
  }

  try {
    const byDate = {};
    let rateLimited = false;
    let failedChunks = 0;
    // Fetch chunks sequentially to avoid bursting DEMO_KEY's rate limit
    for (const { start, end } of chunks) {
      const chunkAc = new AbortController();
      const timer = setTimeout(() => chunkAc.abort(), 10_000);
      try {
        const url = `https://api.nasa.gov/neo/rest/v1/feed?start_date=${start}&end_date=${end}&api_key=${NASA_API_KEY}`;
        const resp = await fetch(url, { signal: chunkAc.signal });
        if (resp.status === 429) { rateLimited = true; break; }
        if (!resp.ok) { failedChunks++; continue; }
        const data = await resp.json();
        Object.entries(data.near_earth_objects).forEach(([date, list]) => {
          byDate[date] = list.flatMap(neo => {
            const ca = neo.close_approach_data?.[0];
            if (!ca) return [];
            return [{
              id:    neo.id,
              name:  neo.name,
              ld:    parseFloat(ca.miss_distance.lunar),
              isPha: neo.is_potentially_hazardous_asteroid,
            }];
          });
        });
      } catch {
        failedChunks++; // network error or timeout on one chunk — keep what we have
      } finally {
        clearTimeout(timer);
      }
    }

    if (!Object.keys(byDate).length) {
      throw new Error(rateLimited ? 'RATE_LIMIT' : 'Failed to fetch NEO data');
    }

    state.scheduleCache = byDate;
    state.schedulePartial = rateLimited || failedChunks > 0;
    return byDate;
  } finally {
    hideSpinner();
  }
}

function renderNext5(byDate) {
  const all = [];
  Object.entries(byDate).forEach(([date, neos]) =>
    neos.forEach(n => all.push({ ...n, date }))
  );
  // Sort chronologically, then by miss distance within the same day
  all.sort((a, b) => a.date.localeCompare(b.date) || a.ld - b.ld);
  const next5 = all.slice(0, 5);

  document.getElementById('next-5-list').innerHTML = next5.map(n => `
    <div class="approach-chip">
      <div class="chip-name">${n.name}</div>
      <div class="chip-date">${n.date}</div>
      <div class="chip-dist">
        ${n.ld.toFixed(2)} LD
        ${n.isPha ? '<span class="pha-badge">PHA</span>' : ''}
      </div>
    </div>
  `).join('');
}

function renderTimeline(byDate) {
  const dates = Object.keys(byDate).sort();
  document.getElementById('timeline-list').innerHTML = dates.map(date => {
    const neos = byDate[date].slice().sort((a, b) => a.ld - b.ld);
    return `
      <div class="timeline-date-group">
        <div class="timeline-date-header">${date} — ${neos.length} object${neos.length !== 1 ? 's' : ''}</div>
        <div class="timeline-cards">
          ${neos.map(n => {
            const ldClass = n.ld < 1 ? 'dist-near' : n.ld < 5 ? 'dist-close' : '';
            return `
            <div class="timeline-card">
              <span class="tc-name">${n.name}</span>
              <span class="tc-dist ${ldClass}">${n.ld.toFixed(3)} LD</span>
              ${n.isPha ? '<span class="tc-pha">PHA</span>' : ''}
            </div>`;
          }).join('')}
        </div>
      </div>
    `;
  }).join('');
}

function renderCalendar(byDate) {
  const dates = Object.keys(byDate).sort();
  if (!dates.length) return;

  const firstDate = new Date(dates[0] + 'T12:00:00');
  const lastDate  = new Date(dates[dates.length - 1] + 'T12:00:00');

  // Start at the Sunday of the week containing the first data date
  const calStart = new Date(firstDate);
  calStart.setDate(calStart.getDate() - calStart.getDay()); // rewind to Sunday

  const grid = document.getElementById('calendar-grid');
  const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  let html = dayLabels.map(d => `<div class="cal-day-label">${d}</div>`).join('');

  const cursor = new Date(calStart);
  while (cursor <= lastDate) {
    const ds = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`;
    const dayNeos = byDate[ds] || [];
    const hasPha  = dayNeos.some(n => n.isPha);
    const badge   = dayNeos.length
      ? `<div class="cal-badge ${hasPha ? 'has-pha' : ''}">${dayNeos.length} NEO${dayNeos.length > 1 ? 's' : ''}</div>`
      : '';
    html += `
      <div class="cal-cell${dayNeos.length ? '' : ' no-neos'}" data-date="${ds}">
        <div class="cal-date">${cursor.getDate()}</div>
        ${badge}
      </div>`;
    cursor.setDate(cursor.getDate() + 1);
  }

  grid.innerHTML = html;

  // Click-to-expand rows
  let expandedDate = null;
  grid.querySelectorAll('.cal-cell[data-date]').forEach(cell => {
    cell.addEventListener('click', () => {
      const ds = cell.dataset.date;
      const neos = byDate[ds] || [];
      if (!neos.length) return;

      grid.querySelectorAll('.cal-expanded').forEach(el => el.remove());
      if (expandedDate === ds) { expandedDate = null; return; }

      expandedDate = ds;
      const div = document.createElement('div');
      div.className = 'cal-expanded';
      div.innerHTML = `<strong>${ds}</strong><br>` +
        neos.slice().sort((a, b) => a.ld - b.ld).map(n =>
          `${n.name} — ${n.ld.toFixed(3)} LD ${n.isPha ? '<span class="pha-badge">PHA</span>' : ''}`
        ).join('<br>');
      cell.after(div);
    });
  });
}

export async function initSchedule(state) {
  if (_ac) _ac.abort();
  _ac = new AbortController();
  const { signal } = _ac;

  // Reset to timeline view so stale calendar data isn't left visible after refresh
  _calendarRendered = false;
  document.getElementById('timeline-view-btn').classList.add('active');
  document.getElementById('calendar-view-btn').classList.remove('active');
  document.getElementById('timeline-view').classList.remove('hidden');
  document.getElementById('calendar-view').classList.add('hidden');

  document.getElementById('next-5-list').innerHTML =
    '<div class="skeleton" style="height:60px;width:100%"></div>';
  document.getElementById('timeline-list').innerHTML =
    '<div class="skeleton" style="height:300px"></div>';

  let byDate;
  try {
    byDate = await fetch30Days(state);
  } catch (err) {
    const msg = err.message === 'RATE_LIMIT'
      ? 'NASA API rate limit hit (DEMO_KEY allows 30 req/hr). Wait a minute and retry, or swap in a free key at api.nasa.gov.'
      : err.message;
    document.getElementById('timeline-list').innerHTML =
      `<div class="error-card"><p>${msg}</p><button class="retry-btn" onclick="location.reload()">Retry</button></div>`;
    return;
  }

  // Remove any existing banner before conditionally re-inserting (prevents duplicates on refresh)
  document.querySelectorAll('.warning-banner').forEach(el => el.remove());
  if (state.schedulePartial) {
    document.getElementById('timeline-list').insertAdjacentHTML('beforebegin',
      '<div class="warning-banner">⚠ Some date ranges failed to load — data may be incomplete. Try refreshing.</div>'
    );
  }

  renderNext5(byDate);
  renderTimeline(byDate);

  // View toggle buttons
  document.getElementById('timeline-view-btn').addEventListener('click', () => {
    document.getElementById('timeline-view-btn').classList.add('active');
    document.getElementById('calendar-view-btn').classList.remove('active');
    document.getElementById('timeline-view').classList.remove('hidden');
    document.getElementById('calendar-view').classList.add('hidden');
  }, { signal });

  document.getElementById('calendar-view-btn').addEventListener('click', () => {
    document.getElementById('calendar-view-btn').classList.add('active');
    document.getElementById('timeline-view-btn').classList.remove('active');
    document.getElementById('calendar-view').classList.remove('hidden');
    document.getElementById('timeline-view').classList.add('hidden');
    if (!_calendarRendered) {
      renderCalendar(byDate);
      _calendarRendered = true;
    }
  }, { signal });
}
