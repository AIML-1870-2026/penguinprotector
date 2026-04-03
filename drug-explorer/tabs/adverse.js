import { fetchAdverseEvents } from '../api.js';
import { openHelp } from '../help.js';

// Track Chart instances so we can destroy them on re-render
const charts = {};

export async function renderAdverse(drugA, drugB) {
  const skeleton  = document.getElementById('skeleton-adverse');
  const container = document.getElementById('content-adverse');

  skeleton.style.display = 'block';
  container.innerHTML    = '';

  // Destroy old charts
  for (const key of Object.keys(charts)) {
    charts[key]?.destroy();
    delete charts[key];
  }

  const [eventsA, eventsB] = await Promise.all([
    fetchAdverseEvents(drugA).catch(e => ({ _error: e })),
    fetchAdverseEvents(drugB).catch(e => ({ _error: e }))
  ]);

  skeleton.style.display = 'none';

  const wrap = document.createElement('div');

  // Section heading row
  const headingRow = document.createElement('div');
  headingRow.className = 'section-heading-row';
  headingRow.innerHTML = `
    Adverse Events (Top 10 Reported Reactions)
    <button class="help-icon" data-help="adverse" aria-label="How to interpret adverse event data">?</button>
  `;
  headingRow.querySelector('[data-help]').addEventListener('click', () => openHelp('adverse'));
  wrap.appendChild(headingRow);

  // Charts side-by-side
  const row = document.createElement('div');
  row.className = 'side-by-side';
  row.appendChild(buildChartPanel(drugA, eventsA, 'a', 'chart-a'));
  row.appendChild(buildChartPanel(drugB, eventsB, 'b', 'chart-b'));
  wrap.appendChild(row);

  container.appendChild(wrap);

  // Render charts (after DOM is attached)
  if (!eventsA?._error && eventsA) renderChart('chart-a', drugA, eventsA, '#0d9488');
  if (!eventsB?._error && eventsB) renderChart('chart-b', drugB, eventsB, '#0284c7');

  // Top reaction in common callout
  if (eventsA && eventsB && !eventsA._error && !eventsB._error) {
    const setA = new Set((eventsA).map(r => r.term?.toLowerCase()));
    const common = (eventsB).find(r => setA.has(r.term?.toLowerCase()));
    if (common) {
      const callout = document.createElement('div');
      callout.className = 'common-reaction-callout';
      callout.textContent = `Both drugs share a top-reported reaction: "${common.term}"`;
      wrap.appendChild(callout);
    }
  }

  // Report volume info callout
  const volumeCallout = document.createElement('div');
  volumeCallout.className = 'report-volume-callout';
  volumeCallout.innerHTML = `
    <span role="img" aria-label="Information">ℹ️</span>
    <span>Report volume reflects how widely a drug is prescribed, not how dangerous it is.
      <button class="help-icon" style="margin-left:6px" data-help="volume" aria-label="Why some drugs have more reports">?</button>
    </span>
  `;
  volumeCallout.querySelector('[data-help]').addEventListener('click', () => openHelp('volume'));
  wrap.appendChild(volumeCallout);
}

function buildChartPanel(drugName, events, side, canvasId) {
  const panel = document.createElement('div');
  panel.className = `drug-panel drug-${side}-border`;

  const heading = document.createElement('div');
  heading.className = 'panel-heading';
  heading.innerHTML = `<h3 class="drug-${side}-heading">${escHtml(drugName)}</h3>`;
  panel.appendChild(heading);

  if (events?._error) {
    panel.appendChild(errorEl(events._error, drugName));
    return panel;
  }

  if (!events || events.length === 0) {
    const p = document.createElement('p');
    p.className = 'no-data-text';
    p.textContent = 'No adverse event reports found.';
    panel.appendChild(p);
    return panel;
  }

  const chartWrap = document.createElement('div');
  chartWrap.className = 'chart-wrapper';
  const canvas = document.createElement('canvas');
  canvas.id = canvasId;
  chartWrap.appendChild(canvas);
  panel.appendChild(chartWrap);

  return panel;
}

function renderChart(canvasId, drugName, events, color) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  const labels = events.map(r => r.term ?? '');
  const counts = events.map(r => r.count ?? 0);

  charts[canvasId] = new Chart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Reports',
        data: counts,
        backgroundColor: color + 'cc',
        borderColor: color,
        borderWidth: 1,
        borderRadius: 4,
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => ` ${ctx.raw.toLocaleString()} reports`
          }
        }
      },
      scales: {
        x: {
          beginAtZero: true,
          ticks: {
            callback: v => v.toLocaleString(),
            font: { family: 'monospace', size: 11 }
          },
          grid: { color: '#e2e8f0' }
        },
        y: {
          ticks: { font: { size: 11 } },
          grid: { display: false }
        }
      }
    }
  });
}

function errorEl(err, drugName) {
  const div = document.createElement('div');
  div.className = 'error-card';
  div.innerHTML = `<span>Could not load adverse event data for <strong>${escHtml(drugName)}</strong>: ${escHtml(err.message)}</span>`;
  return div;
}

function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
