import { fetchRecalls } from '../api.js';
import { openHelp } from '../help.js';
import { escHtml, makeErrorEl } from '../utils.js';

export async function renderRecalls(drugA, drugB) {
  const skeleton  = document.getElementById('skeleton-recalls');
  const container = document.getElementById('content-recalls');

  skeleton.style.display = 'block';
  container.innerHTML    = '';

  const [recallsA, recallsB] = await Promise.all([
    fetchRecalls(drugA).catch(e => ({ _error: e })),
    fetchRecalls(drugB).catch(e => ({ _error: e }))
  ]);

  skeleton.style.display = 'none';

  const wrap = document.createElement('div');

  // Section heading
  const headingRow = document.createElement('div');
  headingRow.className = 'section-heading-row';
  headingRow.innerHTML = `
    Recall History
    <button class="help-icon" data-help="recalls" aria-label="Understanding recall classifications">?</button>
  `;
  headingRow.querySelector('[data-help]').addEventListener('click', () => openHelp('recalls'));
  wrap.appendChild(headingRow);

  // Side-by-side panels
  const row = document.createElement('div');
  row.className = 'side-by-side';
  const retryFn = () => renderRecalls(drugA, drugB);
  row.appendChild(buildRecallPanel(drugA, recallsA, 'a', retryFn));
  row.appendChild(buildRecallPanel(drugB, recallsB, 'b', retryFn));
  wrap.appendChild(row);

  container.appendChild(wrap);

  const countA = recallsA && !recallsA._error ? recallsA.length : 0;
  const countB = recallsB && !recallsB._error ? recallsB.length : 0;
  return { countA, countB };
}

function buildRecallPanel(drugName, recalls, side, retryFn) {
  const panel = document.createElement('div');
  panel.className = `drug-panel drug-${side}-border`;

  const heading = document.createElement('div');
  heading.className = 'panel-heading';
  heading.innerHTML = `<h3 class="drug-${side}-heading">${escHtml(drugName)}</h3>`;
  panel.appendChild(heading);

  if (recalls?._error) {
    panel.appendChild(errorEl(recalls._error, drugName, retryFn));
    return panel;
  }

  if (!recalls || recalls.length === 0) {
    const p = document.createElement('p');
    p.className = 'no-data-text';
    p.textContent = 'No recalls found in the OpenFDA database.';
    panel.appendChild(p);
    return panel;
  }

  // Sort by recall_initiation_date descending
  const sorted = [...recalls].sort((a, b) => {
    const da = a.recall_initiation_date ?? '';
    const db = b.recall_initiation_date ?? '';
    return db.localeCompare(da);
  });

  const list = document.createElement('div');
  list.className = 'recall-list';

  for (const recall of sorted) {
    list.appendChild(buildRecallCard(recall));
  }

  panel.appendChild(list);
  return panel;
}

function buildRecallCard(recall) {
  const card = document.createElement('div');
  card.className = 'recall-card';

  const classNum = (recall.classification ?? '').replace(/class\s+/i, '').trim();
  const badgeClass = classNum === 'I' ? 'badge-i' : classNum === 'II' ? 'badge-ii' : 'badge-iii';
  const dateStr = formatDate(recall.recall_initiation_date);
  const fullReason = recall.reason_for_recall ?? 'Reason not specified';
  const truncated = fullReason.length > 120;
  const preview = truncated ? fullReason.slice(0, 120) + '…' : fullReason;

  const header = document.createElement('div');
  header.className = 'recall-card-header';
  header.innerHTML = `
    <span class="recall-date">${escHtml(dateStr)}</span>
    <span class="badge ${badgeClass}">${escHtml(recall.classification ?? 'Unknown')}</span>
  `;
  card.appendChild(header);

  const reason = document.createElement('p');
  reason.className = 'recall-reason';
  reason.textContent = preview;
  card.appendChild(reason);

  if (truncated) {
    let expanded = false;
    const expandBtn = document.createElement('button');
    expandBtn.className = 'recall-expand-btn';
    expandBtn.textContent = 'Show more';
    expandBtn.addEventListener('click', () => {
      expanded = !expanded;
      reason.textContent = expanded ? fullReason : preview;
      expandBtn.textContent = expanded ? 'Show less' : 'Show more';
    });
    card.appendChild(expandBtn);
  }

  return card;
}

function formatDate(raw) {
  if (!raw || raw.length < 8) return raw ?? '—';
  // Format: YYYYMMDD → YYYY-MM-DD
  return `${raw.slice(0,4)}-${raw.slice(4,6)}-${raw.slice(6,8)}`;
}

function errorEl(err, drugName, retryFn) {
  return makeErrorEl(drugName, err.message, retryFn);
}
