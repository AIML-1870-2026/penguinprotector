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

const LENGTH_LABELS  = ['Short', 'Medium', 'Long'];
const STYLE_LABELS   = ['Formal', 'Conversational', 'Technical', 'Enthusiastic'];

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
  modelsCache:     null,  // cached list from OpenAI /v1/models
  abortController: null,
  aspectOpen:      false,
};

// ── DOM refs ───────────────────────────────────────────

const $ = id => document.getElementById(id);

const el = {
  // Key
  keyDisplay:      $('key-display'),
  btnSetKey:       $('btn-set-key'),
  fileKey:         $('file-key'),
  btnClearKey:     $('btn-clear-key'),
  keyStatusDot:    $('key-status-dot'),
  keyStatusText:   $('key-status-text'),
  // Model
  modelSelect:     $('model-select'),
  modelLoadStatus: $('model-load-status'),
  // Product info
  productName:     $('product-name'),
  category:        $('category'),
  lengthSlider:    $('length-slider'),
  lengthLabel:     $('length-label'),
  styleSlider:     $('style-slider'),
  styleLabel:      $('style-label'),
  comments:        $('comments'),
  // Sentiment
  overallSlider:   $('overall-slider'),
  overallEmoji:    $('overall-emoji'),
  overallVal:      $('overall-val'),
  btnAspect:       $('btn-aspect-toggle'),
  aspectSliders:   $('aspect-sliders'),
  priceSlider:     $('price-slider'),
  priceEmoji:      $('price-emoji'),
  priceVal:        $('price-val'),
  featuresSlider:  $('features-slider'),
  featuresEmoji:   $('features-emoji'),
  featuresVal:     $('features-val'),
  usabilitySlider: $('usability-slider'),
  usabilityEmoji:  $('usability-emoji'),
  usabilityVal:    $('usability-val'),
  // Actions
  btnGenerate:     $('btn-generate'),
  btnCancel:       $('btn-cancel'),
  // Output
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
  // Status bar
  sbStatus:        $('sb-status'),
  sbModel:         $('sb-model'),
  sbSentiment:     $('sb-sentiment'),
  sbKey:           $('sb-key'),
  // Key modal
  keyModalOverlay: $('key-modal-overlay'),
  keyModalInput:   $('key-modal-input'),
  keyModalClose:   $('key-modal-close'),
  keyModalConfirm: $('key-modal-confirm'),
  keyModalCancel:  $('key-modal-cancel'),
};

// ════════════════════════════════════════════════════════
//  KEY MANAGEMENT  (pattern from switchboard-explorer)
// ════════════════════════════════════════════════════════

function setKey(key) {
  state.apiKey = key.trim();
  updateKeyUI();
  updateStatusBar();
  fetchModels();
}

function clearKey() {
  state.apiKey = null;
  state.modelsCache = null;
  state.model = '';
  updateKeyUI();
  resetModelSelect();
  updateStatusBar();
}

function updateKeyUI() {
  const key = state.apiKey;
  if (key) {
    const masked = key.slice(0, 6) + '••••••••' + key.slice(-4);
    el.keyDisplay.innerHTML = `<span style="color:var(--green);font-family:var(--font-mono)">${masked}</span>`;
    el.btnClearKey.classList.remove('hidden');
    el.keyStatusDot.className = 'key-dot set';
    el.keyStatusText.textContent = 'API Key Set';
  } else {
    el.keyDisplay.innerHTML = '<span class="unset-text">not set</span>';
    el.btnClearKey.classList.add('hidden');
    el.keyStatusDot.className = 'key-dot unset';
    el.keyStatusText.textContent = 'No API Key';
  }
}

// Parse .env (KEY=value) or .csv (provider,key) — same as switchboard-explorer
function parseKeyFile(text) {
  // .env format: OPENAI_API_KEY=sk-...
  const envMatch = text.match(/OPENAI[_A-Z]*\s*=\s*(.+)/i);
  if (envMatch) return envMatch[1].trim();

  // .csv format: openai,sk-...
  for (const line of text.split('\n')) {
    const [col0, col1] = line.split(',').map(s => s.trim());
    if (col0?.toLowerCase().includes('openai') && col1) return col1;
  }

  // Raw key fallback: bare sk-... string
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
//  MODEL FETCHING  (dynamic from OpenAI, cached)
// ════════════════════════════════════════════════════════

async function fetchModels() {
  if (!state.apiKey) return;
  if (state.modelsCache) { populateModelSelect(state.modelsCache); return; }

  el.modelLoadStatus.textContent = 'Fetching model list…';

  try {
    const resp = await fetch('https://api.openai.com/v1/models', {
      headers: { 'Authorization': `Bearer ${state.apiKey}` },
    });

    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

    const data = await resp.json();

    // Filter to GPT chat models, sort
    const gptModels = data.data
      .map(m => m.id)
      .filter(id => /^gpt-/.test(id) && !id.includes('instruct') && !id.includes('realtime') && !id.includes('audio') && !id.includes('vision'))
      .sort((a, b) => {
        // Prioritize gpt-4o > gpt-4-turbo > gpt-4 > gpt-3.5
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
    populateModelSelect(models);
    el.modelLoadStatus.textContent = `${models.length} models loaded.`;
  } catch (err) {
    console.warn('Model fetch failed, using fallback list:', err.message);
    state.modelsCache = FALLBACK_MODELS;
    populateModelSelect(FALLBACK_MODELS);
    el.modelLoadStatus.textContent = 'Using default model list.';
  }
}

function populateModelSelect(models) {
  el.modelSelect.innerHTML = models
    .map(m => `<option value="${m}">${m}</option>`)
    .join('');
  state.model = models[0];
  updateStatusBar();
}

function resetModelSelect() {
  el.modelSelect.innerHTML = '<option value="">— set API key to load models —</option>';
  el.modelLoadStatus.textContent = '';
}

// ════════════════════════════════════════════════════════
//  SLIDER HELPERS
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

function updateSentimentSlider(slider, emojiEl, valEl) {
  const v = parseInt(slider.value);
  emojiEl.textContent = sentimentEmoji(v);
  valEl.textContent   = v;
  slider.style.setProperty('--pct', `${v}%`);
}

// ════════════════════════════════════════════════════════
//  PROMPT BUILDER
// ════════════════════════════════════════════════════════

function buildPrompt() {
  const name       = el.productName.value.trim() || 'this product';
  const category   = el.category.value;
  const lengthKey  = LENGTH_LABELS[parseInt(el.lengthSlider.value)];
  const styleKey   = STYLE_LABELS[parseInt(el.styleSlider.value)];
  const comments   = el.comments.value.trim();
  const overall    = parseInt(el.overallSlider.value);

  const lengthInstr = LENGTH_INSTRUCTIONS[lengthKey];
  const styleInstr  = STYLE_INSTRUCTIONS[styleKey];

  let sentimentBlock = `Overall sentiment: ${overall}/100 — ${sentimentDesc(overall)}.`;

  if (state.aspectOpen) {
    const price    = parseInt(el.priceSlider.value);
    const features = parseInt(el.featuresSlider.value);
    const usability= parseInt(el.usabilitySlider.value);
    sentimentBlock += `\n  • Price/Value sentiment: ${price}/100 — ${sentimentDesc(price)}\n  • Features sentiment: ${features}/100 — ${sentimentDesc(features)}\n  • Usability sentiment: ${usability}/100 — ${sentimentDesc(usability)}`;
  }

  const commentsBlock = comments
    ? `\nAdditional context / requirements:\n${comments}`
    : '';

  return `You are writing a product review for educational and development purposes only.

Product: "${name}"
Category: ${category}

${lengthInstr}
${styleInstr}

${sentimentBlock}
${commentsBlock}

Format your response as a well-structured review using markdown:
- Use a heading with the product name and a star rating (e.g., ★★★★☆)
- Use bold for key points or section headers where helpful
- Use bullet points or numbered lists for pros/cons if appropriate
- Include a brief summary or verdict at the end

Write only the review — no preamble, no meta-commentary.`.trim();
}

// ════════════════════════════════════════════════════════
//  API CALL  (pattern from switchboard-explorer)
// ════════════════════════════════════════════════════════

async function callOpenAI(prompt, model, signal) {
  const body = {
    model,
    messages: [
      { role: 'user', content: prompt },
    ],
    max_tokens: 1500,
    temperature: 0.85,
  };

  const start = performance.now();

  const resp = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization':  `Bearer ${state.apiKey}`,
      'Content-Type':   'application/json',
    },
    body: JSON.stringify(body),
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
  if (!state.apiKey) { showToast('Set your OpenAI API key first.'); return; }

  const model = el.modelSelect.value;
  if (!model) { showToast('Select a model first.'); return; }

  const productName = el.productName.value.trim() || 'Product';

  state.model = model;
  state.abortController = new AbortController();

  showPanel('loading');
  setStatus('GENERATING…', 'working');
  el.btnGenerate.disabled = true;
  el.btnCancel.classList.remove('hidden');

  try {
    const prompt = buildPrompt();
    const { text, elapsed } = await callOpenAI(prompt, model, state.abortController.signal);

    // Render markdown
    el.outContent.innerHTML = marked.parse(text);

    // Meta bar
    const wordCount = text.trim().split(/\s+/).length;
    el.outModelTag.textContent   = model;
    el.outProductTag.textContent = productName;
    el.mTime.textContent         = `${(elapsed / 1000).toFixed(1)}s`;
    el.mWords.textContent        = `${wordCount} words`;

    showPanel('review');
    setStatus('READY');
  } catch (err) {
    if (err.name === 'AbortError') {
      showPanel('placeholder');
      setStatus('READY');
    } else {
      el.errMessage.textContent = err.message;
      showPanel('error');
      setStatus('ERROR', 'error');
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

function setStatus(text, cls = '') {
  el.sbStatus.textContent = text;
  el.sbStatus.className   = 'sb-status' + (cls ? ` ${cls}` : '');
}

function updateStatusBar() {
  el.sbModel.textContent     = state.model || 'no model';
  el.sbSentiment.textContent = `sentiment: ${el.overallSlider.value}/100`;

  if (state.apiKey) {
    el.sbKey.textContent  = '● openai key set';
    el.sbKey.className    = 'sb-key set';
  } else {
    el.sbKey.textContent  = '○ openai key not set';
    el.sbKey.className    = 'sb-key unset';
  }
}

function showToast(msg) {
  let t = document.getElementById('toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'toast';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), 2800);
}

// ════════════════════════════════════════════════════════
//  EVENT LISTENERS
// ════════════════════════════════════════════════════════

// Key management
el.btnSetKey.addEventListener('click', openKeyModal);
el.btnClearKey.addEventListener('click', () => { clearKey(); showToast('API key cleared.'); });
el.fileKey.addEventListener('change', e => {
  if (e.target.files[0]) handleFileUpload(e.target.files[0]);
  e.target.value = '';
});

// Key modal
el.keyModalClose.addEventListener('click', closeKeyModal);
el.keyModalCancel.addEventListener('click', closeKeyModal);
el.keyModalConfirm.addEventListener('click', confirmKeyModal);
el.keyModalOverlay.addEventListener('click', e => { if (e.target === el.keyModalOverlay) closeKeyModal(); });
el.keyModalInput.addEventListener('keydown', e => { if (e.key === 'Enter') confirmKeyModal(); });

// Model
el.modelSelect.addEventListener('change', () => {
  state.model = el.modelSelect.value;
  updateStatusBar();
});

// Length slider
el.lengthSlider.addEventListener('input', () => {
  el.lengthLabel.textContent = LENGTH_LABELS[parseInt(el.lengthSlider.value)];
});

// Style slider
el.styleSlider.addEventListener('input', () => {
  el.styleLabel.textContent = STYLE_LABELS[parseInt(el.styleSlider.value)];
});

// Sentiment sliders
el.overallSlider.addEventListener('input', () => {
  updateSentimentSlider(el.overallSlider, el.overallEmoji, el.overallVal);
  updateStatusBar();
});

el.priceSlider.addEventListener('input', () =>
  updateSentimentSlider(el.priceSlider, el.priceEmoji, el.priceVal)
);
el.featuresSlider.addEventListener('input', () =>
  updateSentimentSlider(el.featuresSlider, el.featuresEmoji, el.featuresVal)
);
el.usabilitySlider.addEventListener('input', () =>
  updateSentimentSlider(el.usabilitySlider, el.usabilityEmoji, el.usabilityVal)
);

// Aspect toggle
el.btnAspect.addEventListener('click', () => {
  state.aspectOpen = !state.aspectOpen;
  el.aspectSliders.classList.toggle('hidden', !state.aspectOpen);
  el.btnAspect.textContent = state.aspectOpen ? '− Aspect Sliders' : '+ Aspect Sliders';
});

// Generate / cancel
el.btnGenerate.addEventListener('click', generate);
el.btnCancel.addEventListener('click', cancelGenerate);
el.btnRegenerate.addEventListener('click', generate);
el.btnErrRetry.addEventListener('click', generate);

// Copy review
el.btnCopy.addEventListener('click', () => {
  const text = el.outContent.innerText;
  navigator.clipboard.writeText(text).then(
    () => showToast('Review copied to clipboard.'),
    () => showToast('Copy failed — try manually selecting the text.'),
  );
});

// Keyboard shortcut: Cmd/Ctrl + Enter to generate
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
  // Initialize slider labels
  el.lengthLabel.textContent = LENGTH_LABELS[parseInt(el.lengthSlider.value)];
  el.styleLabel.textContent  = STYLE_LABELS[parseInt(el.styleSlider.value)];

  // Initialize sentiment displays
  updateSentimentSlider(el.overallSlider,    el.overallEmoji,    el.overallVal);
  updateSentimentSlider(el.priceSlider,      el.priceEmoji,      el.priceVal);
  updateSentimentSlider(el.featuresSlider,   el.featuresEmoji,   el.featuresVal);
  updateSentimentSlider(el.usabilitySlider,  el.usabilityEmoji,  el.usabilityVal);

  updateStatusBar();
  showPanel('placeholder');
})();
