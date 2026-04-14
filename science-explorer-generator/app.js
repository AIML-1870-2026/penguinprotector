// ===== STATE =====
let apiKey = null;
const history = [];

// ===== ELEMENTS =====
const envFileInput   = document.getElementById('envFile');
const keyStatus      = document.getElementById('keyStatus');
const keyLabel       = keyStatus.querySelector('.key-label');
const gradeSelect    = document.getElementById('gradeSelect');
const suppliesInput  = document.getElementById('suppliesInput');
const modelSelect    = document.getElementById('modelSelect');
const generateBtn    = document.getElementById('generateBtn');
const outputEmpty    = document.getElementById('outputEmpty');
const outputCard     = document.getElementById('outputCard');
const outputLoading  = document.getElementById('outputLoading');
const outputError    = document.getElementById('outputError');
const outputBody     = document.getElementById('outputBody');
const difficultyBadge = document.getElementById('difficultyBadge');
const copyBtn        = document.getElementById('copyBtn');
const saveBtn        = document.getElementById('saveBtn');
const historyToggle  = document.getElementById('historyToggle');
const historyClose   = document.getElementById('historyClose');
const historyDrawer  = document.getElementById('historyDrawer');
const historyOverlay = document.getElementById('historyOverlay');
const historyList    = document.getElementById('historyList');
const clearHistoryBtn = document.getElementById('clearHistoryBtn');
const chipGrid       = document.getElementById('chipGrid');

// ===== MANUAL KEY ENTRY =====
const typeKeyBtn     = document.getElementById('typeKeyBtn');
const keyInputRow    = document.getElementById('keyInputRow');
const keyInput       = document.getElementById('keyInput');
const keySubmit      = document.getElementById('keySubmit');
const keyInputClose  = document.getElementById('keyInputClose');

typeKeyBtn.addEventListener('click', () => {
  keyInputRow.hidden = false;
  typeKeyBtn.hidden  = true;
  keyInput.focus();
});

keyInputClose.addEventListener('click', () => {
  keyInputRow.hidden = true;
  typeKeyBtn.hidden  = false;
  keyInput.value = '';
});

function submitManualKey() {
  const val = keyInput.value.trim();
  if (!val) return;
  apiKey = val;
  setKeyStatus('loaded', 'Key loaded');
  keyInputRow.hidden = true;
  typeKeyBtn.hidden  = false;
  keyInput.value = '';
}

keySubmit.addEventListener('click', submitManualKey);
keyInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') submitManualKey(); });

// ===== API KEY LOADING =====
function parseKeyFile(text) {
  // .csv format: provider,key
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
  // .env format: KEY=value
  const match = text.match(/OPENAI_API_KEY\s*=\s*(.+)/i);
  if (match) return match[1].trim();
  // bare key
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
      apiKey = key;
      setKeyStatus('loaded', 'Key loaded');
    } else {
      apiKey = null;
      setKeyStatus('error', 'Key not found');
    }
    envFileInput.value = '';
  };
  reader.readAsText(file);
});

function setKeyStatus(state, label) {
  keyStatus.className = 'key-status ' + state;
  keyLabel.textContent = label;
}

// ===== VALIDATION =====
function checkCanGenerate() {
  const ready = gradeSelect.value && suppliesInput.value.trim().length > 0;
  generateBtn.disabled = !ready;
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
    checkCanGenerate();
  } else {
    // Remove it
    const filtered = lines.filter(l => l !== supply);
    suppliesInput.value = filtered.join('\n');
    chip.classList.remove('active');
    checkCanGenerate();
  }
});

// ===== DIFFICULTY =====
const DIFFICULTY_MAP = {
  'K–2':  { label: '⭐ Beginner',      cls: 'beginner' },
  '3–5':  { label: '⭐⭐ Intermediate', cls: 'intermediate' },
  '6–8':  { label: '⭐⭐ Intermediate', cls: 'intermediate' },
  '9–12': { label: '⭐⭐⭐ Advanced',   cls: 'advanced' },
};

function setDifficultyBadge(grade) {
  const d = DIFFICULTY_MAP[grade] || { label: 'Unknown', cls: '' };
  difficultyBadge.textContent = d.label;
  difficultyBadge.className = 'difficulty-badge ' + d.cls;
}

// ===== OUTPUT VISIBILITY =====
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
    showError('No API key loaded', 'Please load your .env file using the button in the header before generating.');
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
        setKeyStatus('error', 'Invalid key');
        throw new Error('Invalid API key. Please check your .env file and reload.');
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
    checkCanGenerate(); // re-enables button if fields are still filled
  }
}

// ===== RENDER RESULT =====
let lastMarkdown = '';
let lastGrade = '';

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
    setTimeout(() => {
      copyBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg> Copy`;
    }, 2000);
  } catch {
    copyBtn.textContent = 'Failed';
  }
});

// ===== SAVE TO HISTORY =====
saveBtn.addEventListener('click', () => {
  if (!lastMarkdown) return;

  // Extract title from first # heading
  const titleMatch = lastMarkdown.match(/^#\s+(.+)/m);
  const title = titleMatch ? titleMatch[1].trim() : 'Untitled Experiment';

  const entry = {
    grade:    lastGrade,
    title,
    markdown: lastMarkdown,
    time:     new Date(),
  };

  history.unshift(entry);
  renderHistory();

  saveBtn.textContent = '✓ Saved!';
  setTimeout(() => {
    saveBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg> Save`;
  }, 2000);
});

// ===== HISTORY =====
function renderHistory() {
  if (history.length === 0) {
    historyList.innerHTML = '<div class="history-empty">No experiments saved yet. Generate one and click <strong>Save</strong>!</div>';
    return;
  }

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
      renderResult(entry.markdown, entry.grade);
      closeHistory();
    });
    historyList.appendChild(item);
  });
}

clearHistoryBtn.addEventListener('click', () => {
  history.length = 0;
  renderHistory();
});

function openHistory() {
  historyDrawer.classList.add('open');
  historyOverlay.hidden = false;
}

function closeHistory() {
  historyDrawer.classList.remove('open');
  historyOverlay.hidden = true;
}

historyToggle.addEventListener('click', openHistory);
historyClose.addEventListener('click', closeHistory);
historyOverlay.addEventListener('click', closeHistory);

// ===== SUPPLY SUBSTITUTION =====
const substToggle = document.getElementById('substToggle');
const substPanel  = document.getElementById('substPanel');
const substInput  = document.getElementById('substInput');
const substBtn    = document.getElementById('substBtn');
const substResult = document.getElementById('substResult');

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
    substResult.textContent = 'Load your .env key first.';
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
          {
            role: 'system',
            content: 'You are a helpful science teacher. When given a supply name, suggest 3–4 common household alternatives that could serve a similar role in science experiments. Be brief — respond with a short intro sentence and a bulleted list only. No extra commentary.',
          },
          {
            role: 'user',
            content: `What are common household alternatives to "${supply}" for science experiments?`,
          },
        ],
        max_tokens: 200,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error?.message || `HTTP ${res.status}`);
    }

    const data = await res.json();
    const text = data.choices?.[0]?.message?.content || '';
    substResult.className = 'subst-result';
    substResult.innerHTML = marked.parse(text);

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
