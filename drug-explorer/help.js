// ── Help Modal System ────────────────────────────────────────────

const POPUPS = {
  about: {
    title: 'About This Tool',
    body: `<p>This tool queries publicly available FDA data for educational purposes. It is not a substitute for professional medical advice.</p>
<p>Data quality varies by drug — some labels are detailed, others sparse. The absence of data does not mean a drug is safe.</p>
<p>Always consult a licensed healthcare professional before making any medical decisions.</p>`
  },
  adverse: {
    title: 'How to Interpret Adverse Event Data',
    body: `<p>FAERS (FDA Adverse Event Reporting System) collects <strong>voluntary reports</strong> from patients, doctors, and pharmacists. Because reporting is voluntary, the data is incomplete.</p>
<p>A drug with 50,000 reports isn't necessarily more dangerous than one with 500 — it may simply be prescribed to far more people.</p>
<p><strong>Correlation in FAERS does not imply causation.</strong></p>`
  },
  recalls: {
    title: 'Understanding Recall Classifications',
    body: `<p><strong>Class I (red):</strong> The most serious type. There is a reasonable probability that using the product will cause serious health consequences or death. Example: contaminated injectable drugs.</p>
<p><strong>Class II (amber):</strong> The product may cause temporary or reversible health consequences, or the probability of serious harm is remote. Example: mislabeled dosage strength.</p>
<p><strong>Class III (gray):</strong> The product is unlikely to cause any health consequences, but it violates FDA regulations. Example: minor labeling errors.</p>`
  },
  pairs: {
    title: 'Drug Pairs with Known Dangerous Interactions',
    body: `<p>Classic high-risk pairs include:</p>
<p><strong>Warfarin + NSAIDs</strong> — increased bleeding risk<br/>
<strong>MAO inhibitors + serotonergic drugs</strong> — serotonin syndrome<br/>
<strong>Methotrexate + NSAIDs</strong> — methotrexate toxicity</p>
<p>These are well-established in clinical literature — this tool surfaces FDA label warnings about them.</p>`
  },
  labels: {
    title: 'What Drug Labels Actually Tell You',
    body: `<p>FDA-approved drug labels (package inserts) are the most authoritative source of prescribing information. They are reviewed by the FDA before a drug is approved and updated when new safety information emerges.</p>
<p>The interactions section lists drugs that are known or suspected to interact based on clinical studies.</p>`
  },
  volume: {
    title: 'Why Some Drugs Have More Reports Than Others',
    body: `<p>A drug prescribed to 50 million people will accumulate far more adverse event reports than one prescribed to 50,000 — even if the rarer drug is more dangerous per patient.</p>
<p>Always consider the drug's market prevalence when interpreting report volumes.</p>`
  },
  severity: {
    title: 'What "Serious" Means in FAERS',
    body: `<p>FAERS classifies a report as <strong>serious</strong> if it involved one or more of the following outcomes: hospitalization, disability or permanent damage, life-threatening situation, congenital anomaly, or death.</p>
<p>A high serious-report percentage does not automatically mean a drug is more dangerous — it may reflect the severity of the underlying condition being treated, or the population using the drug.</p>
<p>Always interpret severity data alongside prescription volume and patient demographics.</p>`
  },
  dosage: {
    title: 'About Dosage & Forms Data',
    body: `<p>Dosage and administration information comes directly from the FDA-approved drug label (package insert).</p>
<p>This includes approved dosage forms (tablet, capsule, injection), available strengths, and standard dosing regimens.</p>
<p>Actual dosing should always be determined by a licensed healthcare provider based on the individual patient.</p>`
  }
};

const backdrop = document.getElementById('modal-backdrop');
const modal    = backdrop.querySelector('.modal');
const titleEl  = document.getElementById('modal-title');
const bodyEl   = document.getElementById('modal-body');
const closeBtn = document.getElementById('modal-close');

const FOCUSABLE_SEL = 'a[href], button:not([disabled]), input, textarea, select, [tabindex]:not([tabindex="-1"])';

let openerEl = null;

export function openHelp(key) {
  const popup = POPUPS[key];
  if (!popup) return;
  openerEl = document.activeElement;
  titleEl.textContent = popup.title;
  bodyEl.innerHTML    = popup.body;
  backdrop.hidden     = false;
  backdrop.setAttribute('aria-hidden', 'false');
  closeBtn.focus();
}

function closeHelp() {
  backdrop.hidden = true;
  backdrop.setAttribute('aria-hidden', 'true');
  openerEl?.focus();
}

closeBtn.addEventListener('click', closeHelp);

backdrop.addEventListener('click', e => {
  if (e.target === backdrop) closeHelp();
});

// Focus trap
backdrop.addEventListener('keydown', e => {
  if (backdrop.hidden) return;
  if (e.key === 'Escape') { closeHelp(); return; }
  if (e.key !== 'Tab') return;

  const focusable = [...modal.querySelectorAll(FOCUSABLE_SEL)].filter(el => !el.closest('[hidden]'));
  if (focusable.length === 0) return;

  const first = focusable[0];
  const last  = focusable[focusable.length - 1];

  if (e.shiftKey) {
    if (document.activeElement === first) {
      e.preventDefault();
      last.focus();
    }
  } else {
    if (document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }
});

// Wire up all static help buttons (header button, etc.)
document.addEventListener('click', e => {
  const btn = e.target.closest('[data-help]');
  if (btn) openHelp(btn.dataset.help);
});
