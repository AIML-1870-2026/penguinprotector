import { fetchLabel, fetchCoAdmin } from '../api.js';
import { openHelp } from '../help.js';

export async function renderInteractions(drugA, drugB) {
  const skeleton  = document.getElementById('skeleton-interactions');
  const container = document.getElementById('content-interactions');

  skeleton.style.display  = 'block';
  container.innerHTML     = '';

  // Fetch both labels in parallel, then co-admin check
  const [labelA, labelB] = await Promise.all([
    fetchLabel(drugA).catch(e => ({ _error: e })),
    fetchLabel(drugB).catch(e => ({ _error: e }))
  ]);

  skeleton.style.display = 'none';

  const wrap = document.createElement('div');

  // Side-by-side panels
  const row = document.createElement('div');
  row.className = 'side-by-side';
  row.appendChild(buildPanel(drugA, labelA, 'a'));
  row.appendChild(buildPanel(drugB, labelB, 'b'));
  wrap.appendChild(row);

  container.appendChild(wrap);

  // Co-admin callout (async, non-blocking)
  if (!labelA?._error && !labelB?._error) {
    fetchCoAdmin(drugA, drugB)
      .then(total => {
        if (total > 0) {
          const callout = document.createElement('div');
          callout.className = 'coadmin-callout';
          callout.innerHTML = `⚠️ <strong>${total.toLocaleString()} FAERS report${total !== 1 ? 's' : ''}</strong> exist where both <strong>${escHtml(drugA)}</strong> and <strong>${escHtml(drugB)}</strong> were administered together. This does not imply causation.`;
          wrap.appendChild(callout);
        }
      })
      .catch(() => {});
  }
}

function buildPanel(drugName, label, side) {
  const panel = document.createElement('div');
  panel.className = `drug-panel drug-${side}-border`;

  const heading = document.createElement('div');
  heading.className = 'panel-heading';
  heading.innerHTML = `
    <h3 class="drug-${side}-heading">${escHtml(drugName)}</h3>
    <button class="help-icon" data-help="labels" aria-label="What drug labels tell you">?</button>
  `;
  heading.querySelector('[data-help]').addEventListener('click', () => openHelp('labels'));
  panel.appendChild(heading);

  if (label?._error) {
    panel.appendChild(errorEl(label._error, drugName));
    return panel;
  }

  const text = label?.drug_interactions?.[0] ?? null;

  if (!text) {
    const p = document.createElement('p');
    p.className = 'no-data-text';
    p.textContent = label
      ? 'No drug interaction information found in the FDA label.'
      : `No FDA label data found for '${drugName}'.`;
    panel.appendChild(p);
  } else {
    const p = document.createElement('p');
    p.className = 'interaction-text';
    p.textContent = text;
    panel.appendChild(p);
  }

  return panel;
}

function errorEl(err, drugName) {
  const div = document.createElement('div');
  div.className = 'error-card';
  div.innerHTML = `<span>Could not load label data for <strong>${escHtml(drugName)}</strong>: ${escHtml(err.message)}</span>`;
  return div;
}

function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
