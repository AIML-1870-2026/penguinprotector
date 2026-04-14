// ===== STATE =====
let apiKey = null;
const history = [];
let activePillIdx = -1;

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

  const systemPrompt = `You are a creative science teacher who designs safe, engaging, grade-appropriate experiments. When given a grade level and a list of available supplies, you generate a complete experiment plan using only those materials. Format your response in markdown with clear sections: Experiment Title, Objective, Materials Needed, Step-by-Step Instructions, Expected Results, and a Discussion Question. Keep safety appropriate for the stated grade level.`;

  const userPrompt = `Grade Level: ${grade}\n\nAvailable Supplies:\n${supplies}\n\nPlease generate a science experiment using only the supplies listed above, appropriate for the selected grade level.`;

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
  } catch {
    copyBtn.textContent = 'Failed';
  }
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
