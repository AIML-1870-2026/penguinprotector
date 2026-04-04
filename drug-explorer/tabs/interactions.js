import { fetchLabel, fetchCoAdmin } from '../api.js';
import { escHtml, makeErrorEl } from '../utils.js';

export async function renderInteractions(drugA, drugB) {
  const skeleton  = document.getElementById('skeleton-interactions');
  const container = document.getElementById('content-interactions');

  skeleton.style.display  = 'block';
  container.innerHTML     = '';

  sectionCounter = 0; // reset per render to avoid ever-growing IDs

  const [labelA, labelB] = await Promise.all([
    fetchLabel(drugA).catch(e => ({ _error: e })),
    fetchLabel(drugB).catch(e => ({ _error: e }))
  ]);

  skeleton.style.display = 'none';

  const wrap = document.createElement('div');

  // Interaction Analysis card (cross-reference before side-by-side panels)
  let hitsA = [], hitsB = [];
  if (!labelA?._error && !labelB?._error && labelA && labelB) {
    hitsA = extractMentions(labelA, drugB);
    hitsB = extractMentions(labelB, drugA);
    const analysisCard = buildInteractionAnalysis(drugA, hitsA, drugB, hitsB);
    wrap.appendChild(analysisCard);
  }

  // Expand / Collapse all toggle row
  const toggleRow = document.createElement('div');
  toggleRow.className = 'expand-collapse-row';
  const expandAllBtn = document.createElement('button');
  expandAllBtn.className = 'expand-all-btn';
  expandAllBtn.textContent = 'Expand all sections';
  let allExpanded = false;
  expandAllBtn.addEventListener('click', () => {
    allExpanded = !allExpanded;
    wrap.querySelectorAll('.label-section-body').forEach(body => {
      body.hidden = !allExpanded;
    });
    wrap.querySelectorAll('.label-section-toggle').forEach(btn => {
      btn.setAttribute('aria-expanded', allExpanded);
      btn.querySelector('.label-section-chevron').textContent = allExpanded ? '▲' : '▼';
    });
    expandAllBtn.textContent = allExpanded ? 'Collapse all sections' : 'Expand all sections';
  });
  toggleRow.appendChild(expandAllBtn);
  wrap.appendChild(toggleRow);

  const row = document.createElement('div');
  row.className = 'side-by-side';
  const retryFn = () => renderInteractions(drugA, drugB);
  row.appendChild(buildPanel(drugA, labelA, 'a', retryFn));
  row.appendChild(buildPanel(drugB, labelB, 'b', retryFn));
  wrap.appendChild(row);

  container.appendChild(wrap);

  const summary = { hitsA: hitsA.length, hitsB: hitsB.length };

  // Co-admin callout (async, non-blocking)
  if (!labelA?._error && !labelB?._error) {
    fetchCoAdmin(drugA, drugB)
      .then(total => {
        if (total > 0) {
          const callout = document.createElement('div');
          callout.className = 'coadmin-callout';
          callout.innerHTML = `<span role="img" aria-label="Warning">⚠️</span> <strong>${total.toLocaleString()} FAERS report${total !== 1 ? 's' : ''}</strong> exist where both <strong>${escHtml(drugA)}</strong> and <strong>${escHtml(drugB)}</strong> were administered together. This does not imply causation.`;
          wrap.appendChild(callout);
        }
      })
      .catch(() => {});
  }

  return summary;
}

// Fields to scan for cross-references, in priority order
const SCAN_FIELDS = [
  'contraindications',
  'boxed_warning',
  'warnings_and_cautions',
  'warnings',
  'drug_interactions',
  'precautions',
];

function buildInteractionAnalysis(drugA, hitsA, drugB, hitsB) {
  const card = document.createElement('div');
  card.className = 'interaction-analysis-card';

  const heading = document.createElement('div');
  heading.className = 'ia-heading';
  heading.innerHTML = `<span class="ia-icon" role="img" aria-label="Interaction">⚡</span> Interaction Analysis <button class="help-icon" data-help="pairs" aria-label="Drug pairs with known dangerous interactions">?</button>`;
  card.appendChild(heading);

  if (hitsA.length === 0 && hitsB.length === 0) {
    const none = document.createElement('p');
    none.className = 'ia-none';
    none.textContent = `No direct mention of ${drugB} in ${drugA}'s FDA label, or ${drugA} in ${drugB}'s label. Check the FAERS co-administration data below and review each drug's full interaction section.`;
    card.appendChild(none);
    return card;
  }

  const grid = document.createElement('div');
  grid.className = 'ia-grid';

  if (hitsA.length > 0) {
    grid.appendChild(buildHitGroup(drugA, drugB, hitsA, 'a'));
  }
  if (hitsB.length > 0) {
    grid.appendChild(buildHitGroup(drugB, drugA, hitsB, 'b'));
  }

  card.appendChild(grid);
  return card;
}

function extractMentions(label, targetDrug) {
  const hits = [];
  const query = targetDrug.toLowerCase();

  for (const field of SCAN_FIELDS) {
    const text = label[field]?.[0];
    if (!text) continue;

    // Split into sentences on '. ', '.\n', or '\n'
    const sentences = text.split(/(?<=\.)\s+|\n+/).map(s => s.trim()).filter(Boolean);

    for (const sentence of sentences) {
      if (sentence.toLowerCase().includes(query)) {
        hits.push({ sentence, field });
        if (hits.length >= 4) return hits; // cap at 4 most relevant
      }
    }
  }
  return hits;
}

function buildHitGroup(sourceDrug, mentionedDrug, hits, side) {
  const group = document.createElement('div');
  group.className = `ia-hit-group ia-hit-group-${side}`;

  const label = document.createElement('p');
  label.className = 'ia-hit-label';
  label.innerHTML = `Found in <strong>${escHtml(sourceDrug)}</strong>'s label — mentions of <strong>${escHtml(mentionedDrug)}</strong>:`;
  group.appendChild(label);

  for (const { sentence, field } of hits) {
    const item = document.createElement('div');
    item.className = 'ia-hit-item';

    const badge = document.createElement('span');
    badge.className = 'ia-field-badge';
    badge.setAttribute('data-field', field);
    badge.textContent = fieldLabel(field);

    const text = document.createElement('p');
    text.className = 'ia-hit-text';
    text.textContent = sentence;

    item.appendChild(badge);
    item.appendChild(text);
    group.appendChild(item);
  }

  return group;
}

function fieldLabel(field) {
  const map = {
    contraindications:      'Contraindication',
    boxed_warning:          'Black Box Warning',
    warnings_and_cautions:  'Warning',
    warnings:               'Warning',
    drug_interactions:      'Drug Interaction',
    precautions:            'Precaution',
  };
  return map[field] ?? field;
}

let sectionCounter = 0; // resets on each renderInteractions call

function buildPanel(drugName, label, side, retryFn) {
  const panel = document.createElement('div');
  panel.className = `drug-panel drug-${side}-border`;

  // Heading
  const heading = document.createElement('div');
  heading.className = 'panel-heading';
  heading.innerHTML = `
    <h3 class="drug-${side}-heading">${escHtml(drugName)}</h3>
    <button class="help-icon" data-help="labels" aria-label="What drug labels tell you">?</button>
  `;
  panel.appendChild(heading);

  if (label?._error) {
    panel.appendChild(errorEl(label._error, drugName, retryFn));
    return panel;
  }

  if (!label) {
    const p = document.createElement('p');
    p.className = 'no-data-text';
    p.textContent = `No FDA label data found for '${drugName}'.`;
    panel.appendChild(p);
    return panel;
  }

  // ── Boxed Warning ─────────────────────────────────────────────
  const boxed = label.boxed_warning?.[0] ?? null;
  if (boxed) {
    const bw = document.createElement('div');
    bw.className = 'boxed-warning';
    bw.innerHTML = `<span class="boxed-warning-badge">BLACK BOX WARNING</span><p>${escHtml(boxed)}</p>`;
    panel.appendChild(bw);
  }

  // ── Drug Interactions ──────────────────────────────────────────
  const interactions = label.drug_interactions?.[0] ?? null;
  panel.appendChild(buildSection(
    'Drug Interactions',
    interactions,
    'No drug interaction information found in the FDA label.',
    true   // expanded by default
  ));

  // ── Warnings & Cautions ────────────────────────────────────────
  const warnings = label.warnings_and_cautions?.[0] ?? label.warnings?.[0] ?? null;
  panel.appendChild(buildSection(
    'Warnings & Cautions',
    warnings,
    'No warnings information found in the FDA label.'
  ));

  // ── Precautions ────────────────────────────────────────────────
  const precautions = label.precautions?.[0] ?? null;
  panel.appendChild(buildSection(
    'Precautions',
    precautions,
    'No precautions information found in the FDA label.'
  ));

  // ── Contraindications ──────────────────────────────────────────
  const contraindications = label.contraindications?.[0] ?? null;
  panel.appendChild(buildSection(
    'Contraindications',
    contraindications,
    'No contraindication information found in the FDA label.'
  ));

  // ── Indications & Usage ────────────────────────────────────────
  const indications = label.indications_and_usage?.[0] ?? null;
  panel.appendChild(buildSection(
    'Indications & Usage',
    indications,
    'No indications information found in the FDA label.'
  ));

  // ── Adverse Reactions (label) ──────────────────────────────────
  const adverseReactions = label.adverse_reactions?.[0] ?? null;
  panel.appendChild(buildSection(
    'Adverse Reactions (Label)',
    adverseReactions,
    'No adverse reactions information found in the FDA label.'
  ));

  // ── Mechanism of Action ────────────────────────────────────────
  const moa = label.mechanism_of_action?.[0] ?? null;
  panel.appendChild(buildSection(
    'Mechanism of Action',
    moa,
    'No mechanism of action information found in the FDA label.'
  ));

  // ── Overdosage ─────────────────────────────────────────────────
  const overdosage = label.overdosage?.[0] ?? null;
  panel.appendChild(buildSection(
    'Overdosage',
    overdosage,
    'No overdosage information found in the FDA label.'
  ));

  // ── Special Populations ────────────────────────────────────────
  const pregnancy  = label.pregnancy?.[0] ?? label.teratogenic_effects?.[0] ?? null;
  const lactation  = label.nursing_mothers?.[0] ?? label.lactation?.[0] ?? null;
  const pediatric  = label.pediatric_use?.[0] ?? null;
  const geriatric  = label.geriatric_use?.[0] ?? null;

  const specialParts = [
    pregnancy  && `PREGNANCY\n${pregnancy}`,
    lactation  && `NURSING MOTHERS / LACTATION\n${lactation}`,
    pediatric  && `PEDIATRIC USE\n${pediatric}`,
    geriatric  && `GERIATRIC USE\n${geriatric}`,
  ].filter(Boolean).join('\n\n');

  panel.appendChild(buildSection(
    'Special Populations',
    specialParts || null,
    'No special populations information found in the FDA label.'
  ));

  // ── Drug Abuse & Dependence ────────────────────────────────────
  const abuse = label.drug_abuse_and_dependence?.[0] ?? null;
  panel.appendChild(buildSection(
    'Drug Abuse & Dependence',
    abuse,
    'No drug abuse and dependence information found in the FDA label.'
  ));

  // ── Patient Counseling ─────────────────────────────────────────
  const counseling = label.patient_counseling_information?.[0] ?? null;
  panel.appendChild(buildSection(
    'Patient Counseling Information',
    counseling,
    'No patient counseling information found in the FDA label.'
  ));

  return panel;
}

function buildSection(title, text, emptyMsg, startOpen = false) {
  const section = document.createElement('div');
  section.className = 'label-section';

  const sectionId = `ls-${++sectionCounter}`;

  const toggle = document.createElement('button');
  toggle.className = 'label-section-toggle';
  toggle.setAttribute('aria-expanded', startOpen);
  toggle.setAttribute('aria-controls', sectionId);
  toggle.innerHTML = `<span>${escHtml(title)}</span><span class="label-section-chevron">${startOpen ? '▲' : '▼'}</span>`;

  const body = document.createElement('div');
  body.className = 'label-section-body';
  body.id = sectionId;
  body.hidden = !startOpen;

  if (text) {
    const p = document.createElement('p');
    p.className = 'interaction-text';
    p.textContent = text;
    body.appendChild(p);
  } else {
    const p = document.createElement('p');
    p.className = 'no-data-text';
    p.textContent = emptyMsg;
    body.appendChild(p);
  }

  toggle.addEventListener('click', () => {
    const open = body.hidden;
    body.hidden = !open;
    toggle.setAttribute('aria-expanded', open);
    toggle.querySelector('.label-section-chevron').textContent = open ? '▲' : '▼';
  });

  section.appendChild(toggle);
  section.appendChild(body);
  return section;
}

function errorEl(err, drugName, retryFn) {
  return makeErrorEl(drugName, err.message, retryFn);
}
