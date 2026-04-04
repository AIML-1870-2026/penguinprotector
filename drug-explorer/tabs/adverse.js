import { fetchAdverseEvents, fetchAdverseCount, fetchSeverityBreakdown, fetchReportingTimeline } from '../api.js';
import { escHtml, makeErrorEl, fmtNum } from '../utils.js';

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

  const [eventsA, eventsB, sevA, sevB, timelineA, timelineB, totalA, totalB] = await Promise.all([
    fetchAdverseEvents(drugA).catch(e => ({ _error: e })),
    fetchAdverseEvents(drugB).catch(e => ({ _error: e })),
    fetchSeverityBreakdown(drugA).catch(() => null),
    fetchSeverityBreakdown(drugB).catch(() => null),
    fetchReportingTimeline(drugA).catch(() => null),
    fetchReportingTimeline(drugB).catch(() => null),
    fetchAdverseCount(drugA).catch(() => 0),
    fetchAdverseCount(drugB).catch(() => 0),
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
  wrap.appendChild(headingRow);

  // Charts side-by-side
  const row = document.createElement('div');
  row.className = 'side-by-side';
  const retryFn = () => renderAdverse(drugA, drugB);
  row.appendChild(buildChartPanel(drugA, eventsA, 'a', 'chart-a', retryFn));
  row.appendChild(buildChartPanel(drugB, eventsB, 'b', 'chart-b', retryFn));
  wrap.appendChild(row);

  container.appendChild(wrap);

  // Render frequency charts (after DOM is attached)
  if (!eventsA?._error && eventsA) renderChart('chart-a', drugA, eventsA, '#0d9488');
  if (!eventsB?._error && eventsB) renderChart('chart-b', drugB, eventsB, '#7c3aed');

  // Top reaction in common callout
  if (eventsA && eventsB && !eventsA._error && !eventsB._error) {
    const setA = new Set((eventsA).map(r => r.term?.toLowerCase()).filter(Boolean));
    const common = (eventsB).find(r => r.term && setA.has(r.term.toLowerCase()));
    if (common) {
      const callout = document.createElement('div');
      callout.className = 'common-reaction-callout';
      callout.textContent = `Both drugs share a top-reported reaction: "${common.term}"`;
      wrap.appendChild(callout);
    }
  }

  // ── Severity Breakdown ─────────────────────────────────────────────
  if (sevA || sevB) {
    const sevSection = document.createElement('div');
    sevSection.className = 'sev-section';

    const sevHeading = document.createElement('div');
    sevHeading.className = 'section-heading-row';
    sevHeading.innerHTML = `
      Severity Profile
      <button class="help-icon" data-help="severity" aria-label="What serious means in FAERS">?</button>
    `;
    sevSection.appendChild(sevHeading);

    const sevNote = document.createElement('p');
    sevNote.className = 'sev-note';
    sevNote.textContent = 'Share of reports classified as "serious" by the reporter (hospitalization, disability, death, or other significant outcome).';
    sevSection.appendChild(sevNote);

    const sevRows = document.createElement('div');
    sevRows.className = 'sev-rows';
    if (sevA) sevRows.appendChild(buildSeverityRow(drugA, sevA, 'a'));
    if (sevB) sevRows.appendChild(buildSeverityRow(drugB, sevB, 'b'));
    sevSection.appendChild(sevRows);

    wrap.appendChild(sevSection);
  }

  // ── Reporting Timeline ─────────────────────────────────────────────
  if ((timelineA && timelineA.length > 1) || (timelineB && timelineB.length > 1)) {
    const timelineSection = document.createElement('div');
    timelineSection.className = 'timeline-section';

    const tlHeading = document.createElement('div');
    tlHeading.className = 'section-heading-row';
    tlHeading.textContent = 'Reporting Trend (Reports per Year)';
    timelineSection.appendChild(tlHeading);

    const tlNote = document.createElement('p');
    tlNote.className = 'sev-note';
    tlNote.textContent = 'Annual FAERS report volume over time. Spikes may reflect increased prescribing, media attention, or labeling changes — not necessarily worsening safety.';
    timelineSection.appendChild(tlNote);

    const tlWrap = document.createElement('div');
    tlWrap.className = 'timeline-chart-wrapper';
    const tlCanvas = document.createElement('canvas');
    tlCanvas.id = 'chart-timeline';
    tlCanvas.setAttribute('role', 'img');
    tlCanvas.setAttribute('aria-label', `Line chart comparing ${escHtml(drugA)} and ${escHtml(drugB)} adverse event reporting trends over time`);
    tlWrap.appendChild(tlCanvas);
    timelineSection.appendChild(tlWrap);

    wrap.appendChild(timelineSection);

    // Render after DOM attach
    renderTimelineChart('chart-timeline', drugA, timelineA, drugB, timelineB);
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
  wrap.appendChild(volumeCallout);

  return { totalA, totalB };
}

function buildChartPanel(drugName, events, side, canvasId, retryFn) {
  const panel = document.createElement('div');
  panel.className = `drug-panel drug-${side}-border`;

  const heading = document.createElement('div');
  heading.className = 'panel-heading';
  heading.innerHTML = `<h3 class="drug-${side}-heading">${escHtml(drugName)}</h3>`;
  panel.appendChild(heading);

  if (events?._error) {
    panel.appendChild(errorEl(events._error, drugName, retryFn));
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
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', `Bar chart of top 10 adverse event reactions reported for ${escHtml(drugName)}`);
  chartWrap.appendChild(canvas);
  panel.appendChild(chartWrap);

  return panel;
}

function buildSeverityRow(drugName, sev, side) {
  const { serious, notSerious } = sev;
  const total = serious + notSerious;
  const pct = total > 0 ? Math.round((serious / total) * 100) : 0;

  const row = document.createElement('div');
  row.className = 'sev-row';

  const label = document.createElement('div');
  label.className = `sev-label drug-${side}-text`;
  label.textContent = drugName;
  row.appendChild(label);

  const barTrack = document.createElement('div');
  barTrack.className = 'sev-bar-track';

  const barFill = document.createElement('div');
  barFill.className = `sev-bar-fill sev-bar-${side}`;
  barFill.style.width = `${pct}%`;
  barFill.setAttribute('role', 'progressbar');
  barFill.setAttribute('aria-valuenow', pct);
  barFill.setAttribute('aria-valuemin', 0);
  barFill.setAttribute('aria-valuemax', 100);
  barTrack.appendChild(barFill);
  row.appendChild(barTrack);

  const meta = document.createElement('div');
  meta.className = 'sev-meta';
  meta.innerHTML = `<strong>${pct}%</strong> serious &nbsp;·&nbsp; ${fmtNum(serious)} serious / ${fmtNum(notSerious)} not`;
  row.appendChild(meta);

  return row;
}

function renderChart(canvasId, drugName, events, color) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  const labels = events.map(r => r.term ?? '');
  const counts = events.map(r => r.count ?? 0);

  const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const gridColor  = isDark ? '#334155' : '#e2e8f0';
  const tickColor  = isDark ? '#94a3b8' : '#64748b';

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
            color: tickColor,
            font: { family: 'monospace', size: 11 }
          },
          grid: { color: gridColor }
        },
        y: {
          ticks: { color: tickColor, font: { size: 11 } },
          grid: { display: false }
        }
      }
    }
  });
}

function renderTimelineChart(canvasId, drugA, timelineA, drugB, timelineB) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  // Build unified year axis
  const yearSet = new Set();
  for (const { year } of timelineA ?? []) yearSet.add(year);
  for (const { year } of timelineB ?? []) yearSet.add(year);
  const years = [...yearSet].sort();

  const mapCounts = (timeline) => {
    const m = Object.fromEntries((timeline ?? []).map(({ year, count }) => [year, count]));
    return years.map(y => m[y] ?? null);
  };

  const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const gridColor = isDark ? '#334155' : '#e2e8f0';
  const tickColor = isDark ? '#94a3b8' : '#64748b';

  charts[canvasId] = new Chart(canvas, {
    type: 'line',
    data: {
      labels: years,
      datasets: [
        {
          label: drugA,
          data: mapCounts(timelineA),
          borderColor: '#0d9488',
          backgroundColor: 'rgba(13,148,136,.1)',
          borderWidth: 2,
          pointRadius: 3,
          tension: 0.3,
          fill: true,
          spanGaps: true,
        },
        {
          label: drugB,
          data: mapCounts(timelineB),
          borderColor: '#7c3aed',
          backgroundColor: 'rgba(124,58,237,.1)',
          borderWidth: 2,
          pointRadius: 3,
          tension: 0.3,
          fill: true,
          spanGaps: true,
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          display: true,
          labels: { color: tickColor, font: { size: 12 }, boxWidth: 12 }
        },
        tooltip: {
          callbacks: {
            label: ctx => ` ${ctx.dataset.label}: ${(ctx.raw ?? 0).toLocaleString()} reports`
          }
        }
      },
      scales: {
        x: {
          ticks: { color: tickColor, font: { size: 11 } },
          grid: { color: gridColor }
        },
        y: {
          beginAtZero: true,
          ticks: {
            callback: v => v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v,
            color: tickColor,
            font: { family: 'monospace', size: 11 }
          },
          grid: { color: gridColor }
        }
      }
    }
  });
}

function errorEl(err, drugName, retryFn) {
  return makeErrorEl(drugName, err.message, retryFn);
}
