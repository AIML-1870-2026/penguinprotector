// ═══════════════════════════════════════════════════════
//  PRODUCT REVIEW GENERATOR — script.js
//  OpenAI only. API key in-memory only. Markdown → HTML.
// ═══════════════════════════════════════════════════════

// ── Constants ──────────────────────────────────────────

const FALLBACK_MODELS = [
  'gpt-4o',
  'gpt-4o-mini',
  'gpt-4-turbo',
  'gpt-3.5-turbo',
];

const LENGTH_INSTRUCTIONS = {
  Short:  'Write a short review of 2–3 paragraphs.',
  Medium: 'Write a medium-length review of 4–6 paragraphs.',
  Long:   'Write a detailed, thorough review of 7–10 paragraphs covering multiple aspects.',
};

const STYLE_INSTRUCTIONS = {
  Formal:         'Use a formal, professional tone — objective, measured, and precise.',
  Conversational: 'Use a natural, conversational tone — like talking to a friend.',
  Technical:      'Use a technical tone — focus on specs, performance metrics, and details.',
  Enthusiastic:   'Use an enthusiastic, energetic tone — vivid and expressive.',
};

// ── State ──────────────────────────────────────────────

const state = {
  apiKey:          null,
  model:           '',
  modelsCache:     null,
  abortController: null,
};

// ── DOM refs ───────────────────────────────────────────

const $ = id => document.getElementById(id);

const el = {
  // About / key modal trigger
  btnAbout:          $('btn-about'),
  // Inline key input
  inlineKeyInput:    $('inline-key-input'),
  btnSetKeyInline:   $('btn-set-key-inline'),
  btnClearKeyInline: $('btn-clear-key-inline'),
  keyInlineStatus:   $('key-inline-status'),
  // Product info
  productName:     $('product-name'),
  category:        $('category'),
  lengthSelect:    $('length-select'),
  styleSelect:     $('style-select'),
  comments:        $('comments'),
  // LLM selection
  llmFamily:       $('llm-family'),
  modelSelect:     $('model-select'),
  modelLoadStatus: $('model-load-status'),
  // Sentiment
  overallSlider:   $('overall-slider'),
  overallEmoji:    $('overall-emoji'),
  overallVal:      $('overall-val'),
  // Actions
  btnGenerate:     $('btn-generate'),
  btnCancel:       $('btn-cancel'),
  btnDownload:     $('btn-download'),
  // Output panels
  outPlaceholder:  $('out-placeholder'),
  outLoading:      $('out-loading'),
  outReview:       $('out-review'),
  outError:        $('out-error'),
  outModelTag:     $('out-model-tag'),
  outProductTag:   $('out-product-tag'),
  mTime:           $('m-time'),
  mWords:          $('m-words'),
  btnCopy:         $('btn-copy'),
  btnRegenerate:   $('btn-regenerate'),
  outContent:      $('out-content'),
  errMessage:      $('err-message'),
  btnErrRetry:     $('btn-err-retry'),
  // Key modal
  keyModalOverlay: $('key-modal-overlay'),
  keyDisplay:      $('key-display'),
  keyModalInput:   $('key-modal-input'),
  keyModalClose:   $('key-modal-close'),
  keyModalConfirm: $('key-modal-confirm'),
  keyModalCancel:  $('key-modal-cancel'),
  btnClearKey:     $('btn-clear-key'),
  fileKey:         $('file-key'),
};

// ════════════════════════════════════════════════════════
//  KEY MANAGEMENT
// ════════════════════════════════════════════════════════

function setKey(key) {
  state.apiKey = key.trim();
  updateKeyUI();
  fetchModels();
}

function clearKey() {
  state.apiKey = null;
  state.modelsCache = null;
  state.model = '';
  updateKeyUI();
  resetModelSelect();
}

function updateKeyUI() {
  const key = state.apiKey;
  if (key) {
    const masked = key.slice(0, 6) + '••••••••' + key.slice(-4);
    // Modal display
    el.keyDisplay.innerHTML = `<span style="color:#5E72EB;font-family:monospace">${masked}</span>`;
    el.btnClearKey.classList.remove('hidden');
    // Inline display
    el.inlineKeyInput.value = '';
    el.inlineKeyInput.placeholder = masked;
    el.keyInlineStatus.textContent = '● Key set';
    el.keyInlineStatus.style.color = '#5E72EB';
    el.btnSetKeyInline.classList.add('hidden');
    el.btnClearKeyInline.classList.remove('hidden');
  } else {
    el.keyDisplay.innerHTML = '<span class="unset-text">not set</span>';
    el.btnClearKey.classList.add('hidden');
    // Inline display
    el.inlineKeyInput.placeholder = 'Paste your OpenAI API key (sk-...)';
    el.keyInlineStatus.textContent = '';
    el.btnSetKeyInline.classList.remove('hidden');
    el.btnClearKeyInline.classList.add('hidden');
  }
}

function parseKeyFile(text) {
  const envMatch = text.match(/OPENAI[_A-Z]*\s*=\s*(.+)/i);
  if (envMatch) return envMatch[1].trim();

  for (const line of text.split('\n')) {
    const [col0, col1] = line.split(',').map(s => s.trim());
    if (col0?.toLowerCase().includes('openai') && col1) return col1;
  }

  const bare = text.trim();
  if (bare.startsWith('sk-') && bare.length > 10) return bare;

  return null;
}

function handleFileUpload(file) {
  const reader = new FileReader();
  reader.onload = e => {
    const key = parseKeyFile(e.target.result);
    if (key) {
      setKey(key);
      showToast('API key loaded from file.');
    } else {
      showToast('No OpenAI key found. Use OPENAI_API_KEY=sk-... format.');
    }
  };
  reader.readAsText(file);
}

// ── Key modal ──

function openKeyModal() {
  el.keyModalInput.value = '';
  el.keyModalOverlay.classList.remove('hidden');
  setTimeout(() => el.keyModalInput.focus(), 50);
}

function closeKeyModal() {
  el.keyModalOverlay.classList.add('hidden');
  el.keyModalInput.value = '';
}

function confirmKeyModal() {
  const val = el.keyModalInput.value.trim();
  if (!val) return;
  setKey(val);
  closeKeyModal();
  showToast('API key saved.');
}

// ════════════════════════════════════════════════════════
//  MODEL FETCHING
// ════════════════════════════════════════════════════════

async function fetchModels() {
  if (!state.apiKey) return;
  if (state.modelsCache) { populateModelSelect(state.modelsCache, true); return; }

  el.modelLoadStatus.textContent = 'Fetching models…';
  el.modelLoadStatus.style.color = '#6b7280';

  try {
    const resp = await fetch('https://api.openai.com/v1/models', {
      headers: { 'Authorization': `Bearer ${state.apiKey}` },
    });

    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

    const data = await resp.json();

    const gptModels = data.data
      .map(m => m.id)
      .filter(id => /^gpt-/.test(id) && !id.includes('instruct') && !id.includes('realtime') && !id.includes('audio') && !id.includes('vision'))
      .sort((a, b) => {
        const rank = id => {
          if (id.startsWith('gpt-4o')) return 0;
          if (id.startsWith('gpt-4-turbo')) return 1;
          if (id.startsWith('gpt-4')) return 2;
          return 3;
        };
        return rank(a) - rank(b) || a.localeCompare(b);
      });

    const models = gptModels.length ? gptModels : FALLBACK_MODELS;
    state.modelsCache = models;
    populateModelSelect(models, false);

    // Update LLM Family label with count
    el.llmFamily.options[0].text = `OpenAI (${models.length} models)`;
    el.modelLoadStatus.textContent = 'Models discovered successfully (cached)';
    el.modelLoadStatus.style.color = '#16a34a';
  } catch (err) {
    console.warn('Model fetch failed, using fallback list:', err.message);
    state.modelsCache = FALLBACK_MODELS;
    populateModelSelect(FALLBACK_MODELS, false);
    el.modelLoadStatus.textContent = 'Using default model list.';
    el.modelLoadStatus.style.color = '#6b7280';
  }
}

function populateModelSelect(models, cached) {
  el.modelSelect.innerHTML = models
    .map((m, i) => `<option value="${m}">${i === 0 ? '⭐ ' : ''}${m}</option>`)
    .join('');
  state.model = models[0];
  if (cached) {
    el.modelLoadStatus.textContent = 'Models discovered successfully (cached)';
    el.modelLoadStatus.style.color = '#16a34a';
  }
}

function resetModelSelect() {
  el.modelSelect.innerHTML = '<option value="">— set API key to load models —</option>';
  el.llmFamily.options[0].text = 'OpenAI';
  el.modelLoadStatus.textContent = '';
}

// ════════════════════════════════════════════════════════
//  SENTIMENT HELPERS
// ════════════════════════════════════════════════════════

function sentimentEmoji(val) {
  if (val <= 15) return '😡';
  if (val <= 30) return '😠';
  if (val <= 45) return '😕';
  if (val <= 55) return '😐';
  if (val <= 70) return '🙂';
  if (val <= 85) return '😊';
  return '🤩';
}

function sentimentDesc(val) {
  if (val <= 15) return 'very negative — harsh criticism';
  if (val <= 30) return 'negative — mostly critical';
  if (val <= 45) return 'slightly negative — more cons than pros';
  if (val <= 55) return 'neutral — balanced pros and cons';
  if (val <= 70) return 'slightly positive — more pros than cons';
  if (val <= 85) return 'positive — mostly praising';
  return 'very positive — glowing endorsement';
}

function updateSentiment() {
  const v = parseInt(el.overallSlider.value);
  el.overallEmoji.textContent = sentimentEmoji(v);
  el.overallVal.textContent   = v;
}

// ════════════════════════════════════════════════════════
//  PROMPT BUILDER
// ════════════════════════════════════════════════════════

function buildPrompt() {
  const name       = el.productName.value.trim() || 'this product';
  const category   = el.category.value;
  const lengthKey  = el.lengthSelect.value;
  const styleKey   = el.styleSelect.value;
  const comments   = el.comments.value.trim();
  const overall    = parseInt(el.overallSlider.value);

  const commentsBlock = comments
    ? `\nAdditional context / requirements:\n${comments}`
    : '';

  return `You are writing a product review for educational and development purposes only.

Product: "${name}"
Category: ${category}

${LENGTH_INSTRUCTIONS[lengthKey]}
${STYLE_INSTRUCTIONS[styleKey]}

Overall sentiment: ${overall}/100 — ${sentimentDesc(overall)}.
${commentsBlock}

Format your response as a well-structured review using markdown:
- Use a heading with the product name and a star rating (e.g., ★★★★☆)
- Use bold for key points or section headers where helpful
- Use bullet points or numbered lists for pros/cons if appropriate
- Include a brief summary or verdict at the end

Write only the review — no preamble, no meta-commentary.`.trim();
}

// ════════════════════════════════════════════════════════
//  API CALL
// ════════════════════════════════════════════════════════

async function callOpenAI(prompt, model, signal) {
  const start = performance.now();

  const resp = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${state.apiKey}`,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 1500,
      temperature: 0.85,
    }),
    signal,
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.error?.message || `OpenAI error ${resp.status}`);
  }

  const data    = await resp.json();
  const elapsed = Math.round(performance.now() - start);
  const text    = data.choices?.[0]?.message?.content ?? '';

  return { text, elapsed };
}

// ════════════════════════════════════════════════════════
//  GENERATE
// ════════════════════════════════════════════════════════

async function generate() {
  if (!state.apiKey) { openKeyModal(); showToast('Set your OpenAI API key first.'); return; }

  const model = el.modelSelect.value;
  if (!model) { showToast('Select a model first.'); return; }

  const productName = el.productName.value.trim() || 'Product';

  state.model = model;
  state.abortController = new AbortController();

  showPanel('loading');
  el.btnGenerate.disabled = true;
  el.btnCancel.classList.remove('hidden');
  el.btnDownload.disabled = true;

  try {
    const prompt = buildPrompt();
    const { text, elapsed } = await callOpenAI(prompt, model, state.abortController.signal);

    el.outContent.innerHTML = marked.parse(text);

    const wordCount = text.trim().split(/\s+/).length;
    el.outModelTag.textContent   = model;
    el.outProductTag.textContent = productName;
    el.mTime.textContent         = `${(elapsed / 1000).toFixed(1)}s`;
    el.mWords.textContent        = `${wordCount} words`;

    showPanel('review');

    // Enable download
    el.btnDownload.disabled = false;
    el.btnDownload._reviewText = text;
    el.btnDownload._productName = productName;
  } catch (err) {
    if (err.name === 'AbortError') {
      showPanel('placeholder');
    } else {
      el.errMessage.textContent = err.message;
      showPanel('error');
    }
  } finally {
    el.btnGenerate.disabled = false;
    el.btnCancel.classList.add('hidden');
    state.abortController = null;
  }
}

function cancelGenerate() {
  state.abortController?.abort();
}

// ════════════════════════════════════════════════════════
//  DOWNLOAD
// ════════════════════════════════════════════════════════

function downloadReview() {
  const text = el.btnDownload._reviewText;
  if (!text) return;

  const filename = (el.btnDownload._productName || 'review')
    .toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') + '-review.txt';

  const blob = new Blob([text], { type: 'text/plain' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ════════════════════════════════════════════════════════
//  UI HELPERS
// ════════════════════════════════════════════════════════

function showPanel(name) {
  el.outPlaceholder.classList.add('hidden');
  el.outLoading.classList.add('hidden');
  el.outReview.classList.add('hidden');
  el.outError.classList.add('hidden');

  if (name === 'placeholder') el.outPlaceholder.classList.remove('hidden');
  if (name === 'loading')     el.outLoading.classList.remove('hidden');
  if (name === 'review')      el.outReview.classList.remove('hidden');
  if (name === 'error')       el.outError.classList.remove('hidden');
}

function showToast(msg) {
  let t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), 2800);
}

// ════════════════════════════════════════════════════════
//  EVENT LISTENERS
// ════════════════════════════════════════════════════════

el.btnAbout.addEventListener('click', openKeyModal);

// Inline key input
el.btnSetKeyInline.addEventListener('click', () => {
  const val = el.inlineKeyInput.value.trim();
  if (!val) { showToast('Paste an API key first.'); return; }
  setKey(val);
  showToast('API key saved.');
});
el.inlineKeyInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') el.btnSetKeyInline.click();
});
el.btnClearKeyInline.addEventListener('click', () => { clearKey(); showToast('API key cleared.'); });

el.keyModalClose.addEventListener('click', closeKeyModal);
el.keyModalCancel.addEventListener('click', closeKeyModal);
el.keyModalConfirm.addEventListener('click', confirmKeyModal);
el.keyModalOverlay.addEventListener('click', e => { if (e.target === el.keyModalOverlay) closeKeyModal(); });
el.keyModalInput.addEventListener('keydown', e => { if (e.key === 'Enter') confirmKeyModal(); });

el.btnClearKey.addEventListener('click', () => { clearKey(); showToast('API key cleared.'); });
el.fileKey.addEventListener('change', e => {
  if (e.target.files[0]) handleFileUpload(e.target.files[0]);
  e.target.value = '';
});

el.modelSelect.addEventListener('change', () => { state.model = el.modelSelect.value; });

el.overallSlider.addEventListener('input', updateSentiment);

el.btnGenerate.addEventListener('click', generate);
el.btnCancel.addEventListener('click', cancelGenerate);
el.btnRegenerate.addEventListener('click', generate);
el.btnErrRetry.addEventListener('click', generate);

el.btnCopy.addEventListener('click', () => {
  navigator.clipboard.writeText(el.outContent.innerText).then(
    () => showToast('Review copied to clipboard.'),
    () => showToast('Copy failed — try selecting the text manually.'),
  );
});

el.btnDownload.addEventListener('click', downloadReview);

document.addEventListener('keydown', e => {
  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
    e.preventDefault();
    if (!el.btnGenerate.disabled) generate();
  }
});

// ════════════════════════════════════════════════════════
//  INIT
// ════════════════════════════════════════════════════════

(function init() {
  updateSentiment();
  showPanel('placeholder');
})();
