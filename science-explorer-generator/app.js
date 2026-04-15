// ===== CONFETTI =====
(function () {
  const canvas = document.getElementById('confetti-canvas');
  const ctx    = canvas.getContext('2d');
  const COLORS = ['#7C3AED','#EC4899','#FBBF24','#10B981','#F97316','#0EA5E9','#A78BFA','#F472B6'];
  const SHAPES = ['rect', 'circle', 'star'];
  const COUNT  = 90;

  let pieces = [];
  let W, H;

  function resize() {
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }

  function rand(min, max) { return Math.random() * (max - min) + min; }

  function starPath(cx, cy, r) {
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const a = (i * 4 * Math.PI) / 5 - Math.PI / 2;
      const b = a + (2 * Math.PI) / 5;
      const inner = r * 0.45;
      ctx.lineTo(cx + r * Math.cos(a), cy + r * Math.sin(a));
      ctx.lineTo(cx + inner * Math.cos(b), cy + inner * Math.sin(b));
    }
    ctx.closePath();
  }

  function makePiece() {
    return {
      x:      rand(0, W),
      y:      rand(-H, 0),
      size:   rand(7, 15),
      color:  COLORS[Math.floor(rand(0, COLORS.length))],
      shape:  SHAPES[Math.floor(rand(0, SHAPES.length))],
      speed:  rand(1.2, 3),
      drift:  rand(-0.6, 0.6),
      spin:   rand(-0.06, 0.06),
      angle:  rand(0, Math.PI * 2),
      wobble: rand(0, Math.PI * 2),
      wobbleSpeed: rand(0.02, 0.06),
    };
  }

  function init() {
    resize();
    pieces = Array.from({ length: COUNT }, makePiece);
    // Scatter some already on screen at start
    pieces.forEach((p, i) => { if (i < COUNT / 2) p.y = rand(0, H); });
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    pieces.forEach(p => {
      p.y     += p.speed;
      p.x     += p.drift + Math.sin(p.wobble) * 0.5;
      p.angle += p.spin;
      p.wobble += p.wobbleSpeed;

      if (p.y > H + 20) { Object.assign(p, makePiece(), { y: -20, x: rand(0, W) }); }

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.angle);
      ctx.fillStyle = p.color;
      ctx.globalAlpha = 0.82;

      if (p.shape === 'rect') {
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      } else if (p.shape === 'circle') {
        ctx.beginPath();
        ctx.arc(0, 0, p.size / 2.5, 0, Math.PI * 2);
        ctx.fill();
      } else {
        starPath(0, 0, p.size / 2);
        ctx.fill();
      }
      ctx.restore();
    });
    requestAnimationFrame(draw);
  }

  window.addEventListener('resize', resize);
  init();
  draw();

  // Expose burst for use after generation
  window.confettiBurst = function(count) {
    count = count || 55;
    for (let i = 0; i < count; i++) {
      const p = makePiece();
      p.x     = rand(W * 0.2, W * 0.8);
      p.y     = rand(H * 0.25, H * 0.55);
      p.speed = rand(4, 10);
      p.drift = rand(-4, 4);
      pieces.push(p);
    }
    setTimeout(() => { pieces.splice(COUNT); }, 5000);
  };
})();

// ===== STATE =====
let apiKey = null;
const history = [];
let activePillIdx    = -1;
let activeCategory   = '';
let lastSystemPrompt = '';
let lastUserPrompt   = '';

// ===== ELEMENTS =====
const envFileInput    = document.getElementById('envFile');
const keyInput        = document.getElementById('keyInput');
const keySubmit       = document.getElementById('keySubmit');
const keyInputClose   = document.getElementById('keyInputClose');
const keyStatusEl     = document.getElementById('keyStatus');
const gradeSelect     = document.getElementById('gradeSelect');
const suppliesInput   = document.getElementById('suppliesInput');
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
const surpriseBtn      = document.getElementById('surpriseBtn');
const regenBtn         = document.getElementById('regenBtn');
const printBtn         = document.getElementById('printBtn');
const downloadBtn      = document.getElementById('downloadBtn');
const clearSuppliesBtn = document.getElementById('clearSuppliesBtn');
const categoryGrid     = document.getElementById('categoryGrid');
const rateUp           = document.getElementById('rateUp');
const rateDown         = document.getElementById('rateDown');
const promptToggleBtn  = document.getElementById('promptToggleBtn');
const promptInspector  = document.getElementById('promptInspector');
const piSystem         = document.getElementById('piSystem');
const piUser           = document.getElementById('piUser');

// ===== API KEY — FILE LOADER =====
function parseKeyFile(text) {
  if (text.includes(',')) {
    const lines = text.trim().split('\n');
    for (const line of lines) {
      const parts = line.split(',');
      if (parts.length >= 2) {
        const val = parts[parts.length - 1].trim();
        if (val.startsWith('sk-')) return val;
      }
    }
  }
  const match = text.match(/OPENAI_API_KEY\s*=\s*(.+)/i);
  if (match) return match[1].trim();
  const trimmed = text.trim();
  if (trimmed.startsWith('sk-')) return trimmed;
  return null;
}

envFileInput.addEventListener('change', () => {
  const file = envFileInput.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    const key = parseKeyFile(e.target.result);
    if (key) {
      setKey(key);
    } else {
      setKeyError('Key not found in file');
    }
    envFileInput.value = '';
  };
  reader.readAsText(file);
});

// ===== API KEY — MANUAL ENTRY =====
function submitManualKey() {
  const val = keyInput.value.trim();
  if (!val) return;
  setKey(val);
  keyInput.value = '';
}

keySubmit.addEventListener('click', submitManualKey);
keyInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') submitManualKey(); });

keyInputClose.addEventListener('click', () => {
  apiKey = null;
  keyInput.value = '';
  keyStatusEl.textContent = '';
  keyStatusEl.className = 'key-inline-status';
  keyInputClose.classList.add('hidden');
});

function setKey(val) {
  apiKey = val;
  const masked = val.slice(0, 8) + '••••••••' + val.slice(-4);
  keyStatusEl.textContent = '✓ Key set: ' + masked;
  keyStatusEl.className = 'key-inline-status is-set';
  keyInputClose.classList.remove('hidden');
}

function setKeyError(msg) {
  apiKey = null;
  keyStatusEl.textContent = '✗ ' + msg;
  keyStatusEl.className = 'key-inline-status is-error';
}

// ===== VALIDATION =====
function checkCanGenerate() {
  generateBtn.disabled = !(gradeSelect.value && suppliesInput.value.trim().length > 0);
}

gradeSelect.addEventListener('change', checkCanGenerate);
suppliesInput.addEventListener('input', checkCanGenerate);

// ===== QUICK-ADD CHIPS =====
chipGrid.addEventListener('click', (e) => {
  const chip = e.target.closest('.chip');
  if (!chip) return;
  const supply = chip.dataset.supply;
  const current = suppliesInput.value;
  const lines = current.split('\n').map(l => l.trim()).filter(Boolean);
  if (!lines.includes(supply)) {
    suppliesInput.value = current ? current.trimEnd() + '\n' + supply : supply;
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
  difficultyBadge.className = 'difficulty-badge ' + d.cls;
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
  if (!apiKey) {
    showError('No API key set', 'Enter your OpenAI key in the API Key field above before generating.');
    return;
  }

  const grade    = gradeSelect.value;
  const supplies = suppliesInput.value.trim();
  const model    = modelSelect.value;

  showState('loading');
  generateBtn.disabled = true;

  const systemPrompt = `You are a creative science teacher who designs safe, engaging, grade-appropriate experiments. When given a grade level and a list of available supplies, you generate a complete experiment plan using only those materials.

At the very top of your response, before anything else, output exactly these two metadata lines (no extra text):
SAFETY: Kid-safe
or
SAFETY: Adult supervision required
DURATION: [estimated total experiment time, e.g. "15 minutes" or "30 minutes"]

Then a blank line, then the full experiment in markdown with clear sections: Experiment Title, Objective, Materials Needed, Step-by-Step Instructions, Expected Results, and a Discussion Question. Keep safety appropriate for the stated grade level.`;

  const categoryLine = activeCategory ? `\nScience Category: ${activeCategory}` : '';
  const userPrompt = `Grade Level: ${grade}${categoryLine}\n\nAvailable Supplies:\n${supplies}\n\nPlease generate a science experiment using only the supplies listed above, appropriate for the selected grade level.`;

  lastSystemPrompt = systemPrompt;
  lastUserPrompt   = userPrompt;

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user',   content: userPrompt },
        ],
      }),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      const msg = errData?.error?.message || `HTTP ${res.status}`;
      if (res.status === 401) {
        setKeyError('Invalid key');
        throw new Error('Invalid API key. Please check and re-enter your key.');
      }
      if (res.status === 429) {
        throw new Error('Rate limit reached. Please wait a moment and try again.');
      }
      throw new Error(msg);
    }

    const data = await res.json();
    const markdown = data.choices?.[0]?.message?.content || '';
    if (!markdown) throw new Error('The model returned an empty response. Please try again.');

    renderResult(markdown, grade);

  } catch (err) {
    showError('Generation failed', err.message || 'An unexpected error occurred. Please try again.');
  } finally {
    checkCanGenerate();
  }
}

// ===== RENDER RESULT =====
let lastMarkdown = '';
let lastGrade    = '';

function parseMetadata(raw) {
  const safetyMatch   = raw.match(/^SAFETY:\s*(.+)/im);
  const durationMatch = raw.match(/^DURATION:\s*(.+)/im);
  const safety   = safetyMatch   ? safetyMatch[1].trim()   : null;
  const duration = durationMatch ? durationMatch[1].trim() : null;
  const clean = raw
    .replace(/^SAFETY:\s*.+\r?\n?/im, '')
    .replace(/^DURATION:\s*.+\r?\n?/im, '')
    .trimStart();
  return { safety, duration, clean };
}

function setSafetyBadge(safety, grade) {
  const el = document.getElementById('safetyBadge');
  if (!safety) safety = (grade === '9–12') ? 'Adult supervision required' : 'Kid-safe';
  const isAdult = /adult|supervision/i.test(safety);
  el.textContent = isAdult ? '⚠️ Adult supervision' : '✅ Kid-safe';
  el.className   = 'meta-badge safety-badge ' + (isAdult ? 'adult' : 'safe');
}

function setDurationBadge(duration) {
  const el = document.getElementById('durationBadge');
  if (!duration) { el.textContent = ''; el.className = 'meta-badge duration-badge'; return; }
  el.textContent = '⏱ ' + duration;
  el.className   = 'meta-badge duration-badge visible';
}

function renderResult(markdown, grade) {
  const { safety, duration, clean } = parseMetadata(markdown);
  lastMarkdown = clean;
  lastGrade    = grade;

  outputBody.innerHTML = marked.parse(clean);
  setDifficultyBadge(grade);
  setSafetyBadge(safety, grade);
  setDurationBadge(duration);
  rateUp.classList.remove('active');
  rateDown.classList.remove('active');

  // Populate prompt inspector
  piSystem.textContent = lastSystemPrompt;
  piUser.textContent   = lastUserPrompt;
  promptInspector.classList.add('hidden');
  promptToggleBtn.classList.remove('active');

  showState('result');

  // Animate the result card entrance
  outputCard.classList.remove('result-enter');
  void outputCard.offsetWidth;
  outputCard.classList.add('result-enter');

  // Scroll to output card
  outputCard.closest('.card').scrollIntoView({ behavior: 'smooth', block: 'start' });

  if (window.confettiBurst) window.confettiBurst(55);
}

function showError(title, msg) {
  document.getElementById('errorTitle').textContent = title;
  document.getElementById('errorMsg').textContent   = msg;
  showState('error');
}

// ===== TOAST =====
function showToast(msg, type = 'success') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = msg;
  container.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('toast-show'));
  setTimeout(() => {
    toast.classList.remove('toast-show');
    toast.addEventListener('transitionend', () => toast.remove(), { once: true });
  }, 2600);
}

// ===== COPY =====
copyBtn.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(lastMarkdown);
    showToast('✓ Copied to clipboard!');
  } catch {
    showToast('Could not copy — try again', 'error');
  }
});

// ===== SAVE TO HISTORY =====
saveBtn.addEventListener('click', () => {
  if (!lastMarkdown) return;
  const titleMatch = lastMarkdown.match(/^#\s+(.+)/m);
  const title = titleMatch ? titleMatch[1].trim() : 'Untitled Experiment';
  history.unshift({ grade: lastGrade, title, markdown: lastMarkdown, time: new Date() });
  renderHistory();
  showToast('✓ Saved to history!');
});

// ===== HISTORY PILLS (inside output card) =====
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
    pill.className = 'history-pill' + (idx === activePillIdx ? ' active' : '');
    pill.title = entry.title;
    pill.textContent = 'Gr.' + entry.grade + ' — ' + entry.title.slice(0, 22) + (entry.title.length > 22 ? '…' : '');
    pill.addEventListener('click', () => {
      activePillIdx = idx;
      renderResult(entry.markdown, entry.grade);
      renderHistory();
    });
    historyPills.appendChild(pill);
  });

  // Drawer list
  historyList.innerHTML = '';
  history.forEach((entry, idx) => {
    const item = document.createElement('div');
    item.className = 'history-item';
    item.innerHTML = `
      <div class="history-item-grade">Grade ${entry.grade}</div>
      <div class="history-item-title">${escapeHtml(entry.title)}</div>
      <div class="history-item-time">${formatTime(entry.time)}</div>
    `;
    item.addEventListener('click', () => {
      activePillIdx = idx;
      renderResult(entry.markdown, entry.grade);
      renderHistory();
      closeHistory();
    });
    historyList.appendChild(item);
  });
}

clearHistoryBtn.addEventListener('click', () => {
  history.length = 0;
  activePillIdx = -1;
  renderHistory();
});

// ===== HISTORY DRAWER =====
function openHistory()  { historyDrawer.classList.add('open');    historyOverlay.hidden = false; }
function closeHistory() { historyDrawer.classList.remove('open'); historyOverlay.hidden = true;  }

historyToggle.addEventListener('click', openHistory);
historyClose.addEventListener('click', closeHistory);
historyOverlay.addEventListener('click', closeHistory);

// ===== REGENERATE =====
regenBtn.addEventListener('click', generateExperiment);

// ===== PRINT =====
printBtn.addEventListener('click', () => window.print());

// ===== DOWNLOAD =====
downloadBtn.addEventListener('click', () => {
  if (!lastMarkdown) return;
  const titleMatch = lastMarkdown.match(/^#\s+(.+)/m);
  const filename   = (titleMatch ? titleMatch[1].trim() : 'experiment')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '.md';
  const blob = new Blob([lastMarkdown], { type: 'text/markdown' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
  showToast('⬇ Downloading ' + filename);
});

// ===== PROMPT INSPECTOR =====
promptToggleBtn.addEventListener('click', () => {
  const open = promptInspector.classList.toggle('hidden');
  promptToggleBtn.classList.toggle('active', !open);
});

// ===== CLEAR SUPPLIES =====
clearSuppliesBtn.addEventListener('click', () => {
  suppliesInput.value = '';
  document.querySelectorAll('.chip:not(.cat-chip)').forEach(c => c.classList.remove('active'));
  checkCanGenerate();
});

// ===== SCIENCE CATEGORY CHIPS =====
categoryGrid.addEventListener('click', (e) => {
  const chip = e.target.closest('.cat-chip');
  if (!chip) return;
  const cat = chip.dataset.category;
  if (activeCategory === cat) {
    activeCategory = '';
    chip.classList.remove('active');
  } else {
    activeCategory = cat;
    document.querySelectorAll('.cat-chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
  }
});

// ===== RATINGS =====
rateUp.addEventListener('click', () => {
  rateUp.classList.toggle('active');
  rateDown.classList.remove('active');
});
rateDown.addEventListener('click', () => {
  rateDown.classList.toggle('active');
  rateUp.classList.remove('active');
});

// ===== SURPRISE ME =====
const SURPRISE_GRADES   = ['K–2', '3–5', '6–8', '9–12'];
const SURPRISE_SUPPLIES = [
  'baking soda','vinegar','food coloring','paper towels','balloons','salt','sugar',
  'water','dish soap','cornstarch','rubbing alcohol','plastic cups','rubber bands',
  'toothpicks','aluminum foil','tape','scissors','magnifying glass','string','ice cubes',
];

const SURPRISE_CATEGORIES = ['Chemistry','Biology','Physics','Earth Science','Astronomy','Engineering'];

surpriseBtn.addEventListener('click', () => {
  const grade = SURPRISE_GRADES[Math.floor(Math.random() * SURPRISE_GRADES.length)];
  gradeSelect.value = grade;

  const count    = 4 + Math.floor(Math.random() * 3);
  const shuffled = [...SURPRISE_SUPPLIES].sort(() => Math.random() - 0.5);
  const picked   = shuffled.slice(0, count);

  suppliesInput.value = picked.join('\n');

  // Random category
  activeCategory = SURPRISE_CATEGORIES[Math.floor(Math.random() * SURPRISE_CATEGORIES.length)];
  document.querySelectorAll('.cat-chip').forEach(c => {
    c.classList.toggle('active', c.dataset.category === activeCategory);
  });

  document.querySelectorAll('.chip:not(.cat-chip)').forEach(chip => {
    chip.classList.toggle('active', picked.includes(chip.dataset.supply));
  });

  checkCanGenerate();
  generateExperiment();
});

// ===== SUPPLY SUBSTITUTION =====
substToggle.addEventListener('click', () => {
  substPanel.hidden = !substPanel.hidden;
  if (!substPanel.hidden) substInput.focus();
});

substBtn.addEventListener('click', suggestSubstitutions);
substInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') suggestSubstitutions(); });

async function suggestSubstitutions() {
  const supply = substInput.value.trim();
  if (!supply) return;

  if (!apiKey) {
    substResult.className = 'subst-result error';
    substResult.textContent = 'Enter your API key first.';
    return;
  }

  substResult.className = 'subst-result loading';
  substResult.textContent = `Finding alternatives for "${supply}"…`;
  substBtn.disabled = true;

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are a helpful science teacher. When given a supply name, suggest 3–4 common household alternatives that could serve a similar role in science experiments. Be brief — respond with a short intro sentence and a bulleted list only. No extra commentary.' },
          { role: 'user',   content: `What are common household alternatives to "${supply}" for science experiments?` },
        ],
        max_tokens: 200,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error?.message || `HTTP ${res.status}`);
    }

    const data = await res.json();
    substResult.className = 'subst-result';
    substResult.innerHTML = marked.parse(data.choices?.[0]?.message?.content || '');
  } catch (err) {
    substResult.className = 'subst-result error';
    substResult.textContent = 'Error: ' + (err.message || 'Could not fetch alternatives.');
  } finally {
    substBtn.disabled = false;
  }
}

// ===== UTILS =====
function escapeHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function formatTime(date) {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' · ' +
         date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}
