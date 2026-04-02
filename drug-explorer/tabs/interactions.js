import { fetchLabel, fetchCoAdmin } from '../api.js';
import { openHelp } from '../help.js';

export async function renderInteractions(drugA, drugB) {
  const skeleton  = document.getElementById('skeleton-interactions');
  const container = document.getElementById('content-interactions');

  skeleton.style.display  = 'block';
  container.innerHTML     = '';

  const [labelA, labelB] = await Promise.all([
    fetchLabel(drugA).catch(e => ({ _error: e })),
    fetchLabel(drugB).catch(e => ({ _error: e }))
  ]);

  skeleton.style.display = 'none';

  const wrap = document.createElement('div');

  // Interaction Analysis card (cross-reference before side-by-side panels)
  if (!labelA?._error && !labelB?._error && labelA && labelB) {
    const analysisCard = buildInteractionAnalysis(drugA, labelA, drugB, labelB);
    wrap.appendChild(analysisCard);
  }

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

// Fields to scan for cross-references, in priority order
const SCAN_FIELDS = [
  'contraindications',
  'boxed_warning',
  'warnings_and_cautions',
  'warnings',
  'drug_interactions',
  'precautions',
];

function buildInteractionAnalysis(drugA, labelA, drugB, labelB) {
  const card = document.createElement('div');
  card.className = 'interaction-analysis-card';

  const heading = document.createElement('div');
  heading.className = 'ia-heading';
  heading.innerHTML = `<span class="ia-icon">⚡</span> Interaction Analysis`;
  card.appendChild(heading);

  const hitsA = extractMentions(labelA, drugB);
  const hitsB = extractMentions(labelB, drugA);

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

function buildPanel(drugName, label, side) {
  const panel = document.createElement('div');
  panel.className = `drug-panel drug-${side}-border`;

  // Heading
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

  const toggle = document.createElement('button');
  toggle.className = 'label-section-toggle';
  toggle.setAttribute('aria-expanded', startOpen);
  toggle.innerHTML = `<span>${escHtml(title)}</span><span class="label-section-chevron">${startOpen ? '▲' : '▼'}</span>`;

  const body = document.createElement('div');
  body.className = 'label-section-body';
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

function errorEl(err, drugName) {
  const div = document.createElement('div');
  div.className = 'error-card';
  div.innerHTML = `<span>Could not load label data for <strong>${escHtml(drugName)}</strong>: ${escHtml(err.message)}</span>`;
  return div;
}

function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
