import { fetchLabel } from '../api.js';
import { escHtml, makeErrorEl } from '../utils.js';

export async function renderDosage(drugA, drugB) {
  const skeleton  = document.getElementById('skeleton-dosage');
  const container = document.getElementById('content-dosage');

  skeleton.style.display = 'block';
  container.innerHTML    = '';

  const [labelA, labelB] = await Promise.all([
    fetchLabel(drugA).catch(e => ({ _error: e })),
    fetchLabel(drugB).catch(e => ({ _error: e }))
  ]);

  skeleton.style.display = 'none';

  const wrap = document.createElement('div');

  const headingRow = document.createElement('div');
  headingRow.className = 'section-heading-row';
  headingRow.textContent = 'Dosage & Forms';
  wrap.appendChild(headingRow);

  const row = document.createElement('div');
  row.className = 'side-by-side';
  row.appendChild(buildDosagePanel(drugA, labelA, 'a'));
  row.appendChild(buildDosagePanel(drugB, labelB, 'b'));
  wrap.appendChild(row);

  container.appendChild(wrap);
}

const DOSAGE_FIELDS = [
  { key: 'dosage_forms_and_strengths', title: 'Forms & Strengths' },
  { key: 'dosage_and_administration',  title: 'Dosage & Administration' },
  { key: 'how_supplied',               title: 'How Supplied' },
];

function buildDosagePanel(drugName, label, side) {
  const panel = document.createElement('div');
  panel.className = `drug-panel drug-${side}-border`;

  const heading = document.createElement('div');
  heading.className = 'panel-heading';
  heading.innerHTML = `<h3 class="drug-${side}-heading">${escHtml(drugName)}</h3>`;
  panel.appendChild(heading);

  if (label?._error) {
    panel.appendChild(errorEl(label._error, drugName));
    return panel;
  }

  if (!label) {
    const p = document.createElement('p');
    p.className = 'no-data-text';
    p.textContent = `No FDA label data found for '${drugName}'.`;
    panel.appendChild(p);
    return panel;
  }

  const sections = DOSAGE_FIELDS.map(f => ({ title: f.title, text: label[f.key]?.[0] ?? null }))
                                 .filter(s => s.text);

  if (sections.length === 0) {
    const p = document.createElement('p');
    p.className = 'no-data-text';
    p.textContent = 'No dosage information found in the FDA label.';
    panel.appendChild(p);
    return panel;
  }

  for (const { title, text } of sections) {
    const section = document.createElement('div');
    section.className = 'dosage-section';

    const titleEl = document.createElement('p');
    titleEl.className = 'dosage-section-title';
    titleEl.textContent = title;
    section.appendChild(titleEl);

    const body = document.createElement('p');
    body.className = 'interaction-text';
    body.textContent = text;
    section.appendChild(body);

    panel.appendChild(section);
  }

  return panel;
}

function errorEl(err, drugName) {
  return makeErrorEl(drugName, err.message);
}
