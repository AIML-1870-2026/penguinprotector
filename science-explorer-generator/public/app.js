// ===== CONFETTI =====
(function () {
  const canvas = document.getElementById('confetti-canvas');
  const ctx    = canvas.getContext('2d');
  const COLORS = ['#7C3AED','#EC4899','#FBBF24','#10B981','#F97316','#0EA5E9','#A78BFA','#F472B6'];
  const SHAPES = ['rect', 'circle', 'star'];
  const COUNT  = 90;
  let pieces = [], W, H;

  function resize() { W = canvas.width = window.innerWidth; H = canvas.height = window.innerHeight; }
  function rand(a, b) { return Math.random() * (b - a) + a; }

  function starPath(cx, cy, r) {
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const a = (i * 4 * Math.PI) / 5 - Math.PI / 2;
      const b = a + (2 * Math.PI) / 5;
      ctx.lineTo(cx + r * Math.cos(a), cy + r * Math.sin(a));
      ctx.lineTo(cx + r * 0.45 * Math.cos(b), cy + r * 0.45 * Math.sin(b));
    }
    ctx.closePath();
  }

  function makePiece() {
    return { x: rand(0, W), y: rand(-H, 0), size: rand(7, 15), color: COLORS[Math.floor(rand(0, COLORS.length))],
      shape: SHAPES[Math.floor(rand(0, SHAPES.length))], speed: rand(1.2, 3), drift: rand(-0.6, 0.6),
      spin: rand(-0.06, 0.06), angle: rand(0, Math.PI * 2), wobble: rand(0, Math.PI * 2), wobbleSpeed: rand(0.02, 0.06) };
  }

  function init() {
    resize();
    pieces = Array.from({ length: COUNT }, makePiece);
    pieces.forEach((p, i) => { if (i < COUNT / 2) p.y = rand(0, H); });
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    pieces.forEach(p => {
      p.y += p.speed; p.x += p.drift + Math.sin(p.wobble) * 0.5;
      p.angle += p.spin; p.wobble += p.wobbleSpeed;
      if (p.y > H + 20) Object.assign(p, makePiece(), { y: -20, x: rand(0, W) });
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.angle);
      ctx.fillStyle = p.color; ctx.globalAlpha = 0.82;
      if (p.shape === 'rect') {
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      } else if (p.shape === 'circle') {
        ctx.beginPath(); ctx.arc(0, 0, p.size / 2.5, 0, Math.PI * 2); ctx.fill();
      } else { starPath(0, 0, p.size / 2); ctx.fill(); }
      ctx.restore();
    });
    requestAnimationFrame(draw);
  }

  window.addEventListener('resize', resize);
  init(); draw();
})();

// ===== STATE =====
let providers     = [];
const history     = [];
let activePillIdx = -1;

// ===== ELEMENTS =====
const gradeSelect     = document.getElementById('gradeSelect');
const familySelect    = document.getElementById('familySelect');
const modelSelect     = document.getElementById('modelSelect');
const generateBtn     = document.getElementById('generateBtn');
const outputEmpty     = document.getElementById('outputEmpty');
const outputCard      = document.getElementById('outputCard');
const outputLoading   = document.getElementById('outputLoading');
const outputError     = document.getElementById('outputError');
const outputBody      = document.getElementById('outputBody');
const difficultyBadge = document.getElementById('difficultyBadge');
const copyBtn         = document.getElementById('copyBtn');
const saveBtn         = document.getElementById('saveBtn');
const historyToggle   = document.getElementById('historyToggle');
const historyClose    = document.getElementById('historyClose');
const historyDrawer   = document.getElementById('historyDrawer');
const historyOverlay  = document.getElementById('historyOverlay');
const historyList     = document.getElementById('historyList');
const historyPillsBar = document.getElementById('historyPillsBar');
const historyPills    = document.getElementById('historyPills');
const clearHistoryBtn = document.getElementById('clearHistoryBtn');
const chipGrid        = document.getElementById('chipGrid');
const substToggle     = document.getElementById('substToggle');
const substPanel      = document.getElementById('substPanel');
const substInput      = document.getElementById('substInput');
const substBtn        = document.getElementById('substBtn');
const substResult     = document.getElementById('substResult');
const providerStatus  = document.getElementById('providerStatus');
const noBanner        = document.getElementById('noBanner');
const suppliesInput   = document.getElementById('suppliesInput');

// ===== LOAD PROVIDERS FROM SERVER =====
async function loadProviders() {
  try {
    const res = await fetch('/api/providers');
    providers = await res.json();

    familySelect.innerHTML = '';
    if (providers.length === 0) {
      familySelect.innerHTML = '<option value="">No providers configured</option>';
      modelSelect.innerHTML  = '<option value="">—</option>';
      noBanner.classList.remove('hidden');
      setProviderStatus('error', 'No API keys set');
      return;
    }

    providers.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = p.name;
      familySelect.appendChild(opt);
    });

    updateModelDropdown();
    setProviderStatus('ok', providers.map(p => p.name).join(' + '));
  } catch {
    familySelect.innerHTML = '<option value="">Server unreachable</option>';
    setProviderStatus('error', 'Server offline');
  }
}

function updateModelDropdown() {
  const selected = providers.find(p => p.id === familySelect.value);
  modelSelect.innerHTML = '';
  if (!selected) return;
  selected.models.forEach(m => {
    const opt = document.createElement('option');
    opt.value = m.id;
    opt.textContent = m.label;
    modelSelect.appendChild(opt);
  });
  checkCanGenerate();
}

function setProviderStatus(state, label) {
  providerStatus.className = 'provider-status ' + state;
  providerStatus.querySelector('.ps-label').textContent = label;
}

familySelect.addEventListener('change', updateModelDropdown);

// ===== VALIDATION =====
function checkCanGenerate() {
  generateBtn.disabled = !(gradeSelect.value && suppliesInput.value.trim() && familySelect.value && modelSelect.value);
}

gradeSelect.addEventListener('change', checkCanGenerate);
suppliesInput.addEventListener('input', checkCanGenerate);
familySelect.addEventListener('change', checkCanGenerate);

// ===== QUICK-ADD CHIPS =====
chipGrid.addEventListener('click', e => {
  const chip = e.target.closest('.chip');
  if (!chip) return;
  const supply = chip.dataset.supply;
  const lines  = suppliesInput.value.split('\n').map(l => l.trim()).filter(Boolean);
  if (!lines.includes(supply)) {
    suppliesInput.value = suppliesInput.value ? suppliesInput.value.trimEnd() + '\n' + supply : supply;
    chip.classList.add('active');
  } else {
    suppliesInput.value = lines.filter(l => l !== supply).join('\n');
    chip.classList.remove('active');
  }
  checkCanGenerate();
});

// ===== DIFFICULTY =====
const DIFFICULTY_MAP = {
  'K–2':  { label: '⭐ Beginner',       cls: 'beginner' },
  '3–5':  { label: '⭐⭐ Intermediate',  cls: 'intermediate' },
  '6–8':  { label: '⭐⭐ Intermediate',  cls: 'intermediate' },
  '9–12': { label: '⭐⭐⭐ Advanced',    cls: 'advanced' },
};

function setDifficultyBadge(grade) {
  const d = DIFFICULTY_MAP[grade] || { label: 'Unknown', cls: '' };
  difficultyBadge.textContent = d.label;
  difficultyBadge.className   = 'difficulty-badge ' + d.cls;
}

// ===== OUTPUT STATE =====
function showState(state) {
  outputEmpty.hidden   = state !== 'empty';
  outputCard.hidden    = state !== 'result';
  outputLoading.hidden = state !== 'loading';
  outputError.hidden   = state !== 'error';
}

// ===== GENERATE =====
generateBtn.addEventListener('click', generateExperiment);

async function generateExperiment() {
  const grade    = gradeSelect.value;
  const supplies = suppliesInput.value.trim();
  const provider = familySelect.value;
  const model    = modelSelect.value;

  showState('loading');
  generateBtn.disabled = true;

  try {
    const res  = await fetch('/api/generate', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ provider, model, grade, supplies }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `Server error ${res.status}`);
    if (!data.markdown) throw new Error('Empty response from server.');
    renderResult(data.markdown, grade);
  } catch (err) {
    showError('Generation failed', err.message);
  } finally {
    checkCanGenerate();
  }
}

// ===== RENDER RESULT =====
let lastMarkdown = '';
let lastGrade    = '';

function renderResult(markdown, grade) {
  lastMarkdown = markdown;
  lastGrade    = grade;
  outputBody.innerHTML = marked.parse(markdown);
  setDifficultyBadge(grade);
  showState('result');
}

function showError(title, msg) {
  document.getElementById('errorTitle').textContent = title;
  document.getElementById('errorMsg').textContent   = msg;
  showState('error');
}

// ===== COPY =====
copyBtn.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(lastMarkdown);
    copyBtn.textContent = '✓ Copied!';
    setTimeout(() => { copyBtn.textContent = '⎘ Copy'; }, 2000);
  } catch { copyBtn.textContent = 'Failed'; }
});

// ===== SAVE TO HISTORY =====
saveBtn.addEventListener('click', () => {
  if (!lastMarkdown) return;
  const titleMatch = lastMarkdown.match(/^#\s+(.+)/m);
  const title = titleMatch ? titleMatch[1].trim() : 'Untitled Experiment';
  history.unshift({ grade: lastGrade, title, markdown: lastMarkdown, time: new Date() });
  renderHistory();
  saveBtn.textContent = '✓ Saved!';
  setTimeout(() => { saveBtn.textContent = '+ Save'; }, 2000);
});

// ===== HISTORY =====
function renderHistory() {
  if (history.length === 0) {
    historyPillsBar.classList.add('hidden');
    historyList.innerHTML = '<div class="history-empty">No experiments saved yet.<br>Generate one and click <strong>+ Save</strong>!</div>';
    return;
  }
  historyPillsBar.classList.remove('hidden');
  historyPills.innerHTML = '';
  history.forEach((entry, idx) => {
    const pill = document.createElement('button');
    pill.className   = 'history-pill' + (idx === activePillIdx ? ' active' : '');
    pill.title       = entry.title;
    pill.textContent = `Gr.${entry.grade} — ${entry.title.slice(0, 22)}${entry.title.length > 22 ? '…' : ''}`;
    pill.addEventListener('click', () => { activePillIdx = idx; renderResult(entry.markdown, entry.grade); renderHistory(); });
    historyPills.appendChild(pill);
  });
  historyList.innerHTML = '';
  history.forEach((entry, idx) => {
    const item = document.createElement('div');
    item.className = 'history-item';
    item.innerHTML = `<div class="history-item-grade">Grade ${entry.grade}</div>
      <div class="history-item-title">${escapeHtml(entry.title)}</div>
      <div class="history-item-time">${formatTime(entry.time)}</div>`;
    item.addEventListener('click', () => { activePillIdx = idx; renderResult(entry.markdown, entry.grade); renderHistory(); closeHistory(); });
    historyList.appendChild(item);
  });
}

clearHistoryBtn.addEventListener('click', () => { history.length = 0; activePillIdx = -1; renderHistory(); });

// ===== HISTORY DRAWER =====
function openHistory()  { historyDrawer.classList.add('open');    historyOverlay.hidden = false; }
function closeHistory() { historyDrawer.classList.remove('open'); historyOverlay.hidden = true; }
historyToggle.addEventListener('click', openHistory);
historyClose.addEventListener('click', closeHistory);
historyOverlay.addEventListener('click', closeHistory);

// ===== SUPPLY SUBSTITUTION =====
substToggle.addEventListener('click', () => { substPanel.hidden = !substPanel.hidden; if (!substPanel.hidden) substInput.focus(); });
substBtn.addEventListener('click', suggestSubstitutions);
substInput.addEventListener('keydown', e => { if (e.key === 'Enter') suggestSubstitutions(); });

async function suggestSubstitutions() {
  const supply = substInput.value.trim();
  if (!supply) return;
  substResult.className   = 'subst-result loading';
  substResult.textContent = `Finding alternatives for "${supply}"…`;
  substBtn.disabled = true;
  try {
    const res  = await fetch('/api/substitute', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ provider: familySelect.value, supply }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    substResult.className = 'subst-result';
    substResult.innerHTML = marked.parse(data.text);
  } catch (err) {
    substResult.className   = 'subst-result error';
    substResult.textContent = 'Error: ' + (err.message || 'Could not fetch alternatives.');
  } finally {
    substBtn.disabled = false;
  }
}

// ===== UTILS =====
function escapeHtml(s) { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function formatTime(d) { return d.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}) + ' · ' + d.toLocaleDateString([],{month:'short',day:'numeric'}); }

// ===== BOOT =====
loadProviders();
