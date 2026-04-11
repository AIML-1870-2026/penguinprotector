// ═══════════════════════════════════════════════════════
//  PRODUCT REVIEW GENERATOR — script.js
//  OpenAI Chat Completions. API key in-memory only. Markdown → HTML.
// ═══════════════════════════════════════════════════════

// ── Constants ──────────────────────────────────────────

const FALLBACK_MODELS = [
  'gpt-4o',
  'gpt-4o-mini',
  'gpt-4-turbo',
  'gpt-3.5-turbo',
];

// Pricing per 1M tokens (input / output) — update as OpenAI adjusts rates
const MODEL_PRICING = {
  'gpt-4o':        { input: 2.50,  output: 10.00 },
  'gpt-4o-mini':   { input: 0.15,  output: 0.60  },
  'gpt-4-turbo':   { input: 10.00, output: 30.00 },
  'gpt-3.5-turbo': { input: 0.50,  output: 1.50  },
};

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

const PERSONA_INSTRUCTIONS = {
  None:            null,
  TechEnthusiast:  'You are a tech enthusiast who loves gadgets, follows technology news closely, and uses advanced features regularly. Your review reflects deep familiarity with the product category.',
  BudgetShopper:   'You are a budget-conscious shopper who compares prices carefully and prioritizes value for money above all else. You mention alternatives and whether this product justifies its cost.',
  SkepticalParent: 'You are a skeptical parent who scrutinizes safety, durability, and age-appropriateness. You are wary of marketing claims and highlight any concerns a family would care about.',
  ExpertCritic:    'You are an expert product critic with years of industry experience. You compare against professional standards and benchmarks, and your review is authoritative and precise.',
  FirstTimeBuyer:  'You are a first-time buyer with no prior experience with this type of product — excited but uncertain, sharing a genuinely fresh perspective on what surprised you.',
  PowerUser:       'You are a power user who pushes products to their limits, tests edge cases, and expects maximum performance and customizability. You notice things casual users miss.',
  CasualUser:      'You are a casual user who just wants something simple that works without a steep learning curve. Your review is brief, practical, and focused on day-to-day use.',
};

const PLATFORM_INSTRUCTIONS = {
  None:       null,
  Amazon:     'Format this as an Amazon review: include a punchy one-line headline, star rating line, then pros/cons, and a "Bottom Line" paragraph. Mention whether you would recommend it.',
  Yelp:       'Format this as a Yelp review: personal and story-driven, written in first person with specific anecdotal details. 2–4 paragraphs, conversational and vivid.',
  Google:     'Format this as a Google Review: brief and direct (2–3 paragraphs max), focused on the overall recommendation. Most Google reviewers are concise.',
  AppStore:   'Format this as an App Store review: short (under 200 words), punchy, focused on usability and specific features. Start with a star rating and a bold title.',
  Reddit:     'Format this as a Reddit post in a product subreddit: opinionated, direct, and informal. Use markdown with headers, bullet lists, and end with a TL;DR.',
  Trustpilot: 'Format this as a Trustpilot review: professional and factual, focused on overall experience and customer satisfaction. Include a headline and a clear rating statement.',
};

const SURPRISE_PRODUCTS = [
  { name: 'Noise-Cancelling Headphones',         category: 'Electronics'     },
  { name: 'Self-Warming Coffee Mug',              category: 'Electronics'     },
  { name: 'Himalayan Salt Chocolate Bar',         category: 'Food & Beverage' },
  { name: 'Weighted Blanket',                     category: 'Home & Garden'   },
  { name: 'Ergonomic Standing Desk',              category: 'Home & Garden'   },
  { name: 'Sourdough Starter Kit',                category: 'Food & Beverage' },
  { name: 'Smart Water Bottle',                   category: 'Electronics'     },
  { name: 'Vintage Denim Jacket',                 category: 'Clothing'        },
  { name: 'Indoor Herb Garden Kit',               category: 'Home & Garden'   },
  { name: 'Portable Espresso Maker',              category: 'Electronics'     },
  { name: 'Foam Roller Set',                      category: 'Sports'          },
  { name: "The Hitchhiker's Guide to the Galaxy", category: 'Books'           },
  { name: 'Mechanical Keyboard',                  category: 'Electronics'     },
  { name: 'Oat Milk Barista Edition',             category: 'Food & Beverage' },
  { name: 'Trail Running Shoes',                  category: 'Sports'          },
  { name: 'Bamboo Cutting Board Set',             category: 'Home & Garden'   },
  { name: 'Wireless Charging Pad',                category: 'Electronics'     },
  { name: 'Cold Brew Coffee Kit',                 category: 'Food & Beverage' },
];

const MAX_HISTORY = 5;

// ── State ──────────────────────────────────────────────

const state = {
  apiKey:           null,
  model:            '',
  modelsCache:      null,
  abortController:  null,
  compareAborts:    [],
  history:          [],
  activeHistoryIdx: null,
  reviewText:       null,
  reviewProduct:    null,
  lastPrompt:       null,
};

// ── DOM refs ───────────────────────────────────────────

const $ = id => document.getElementById(id);

const el = {
  btnAbout:           $('btn-about'),
  btnShortcuts:       $('btn-shortcuts'),
  btnSurprise:        $('btn-surprise'),
  inlineKeyInput:     $('inline-key-input'),
  btnSetKeyInline:    $('btn-set-key-inline'),
  btnClearKeyInline:  $('btn-clear-key-inline'),
  keyInlineStatus:    $('key-inline-status'),
  productName:        $('product-name'),
  category:           $('category'),
  personaSelect:      $('persona-select'),
  platformSelect:     $('platform-select'),
  lengthSelect:       $('length-select'),
  styleSelect:        $('style-select'),
  comments:           $('comments'),
  commentsCount:      $('comments-count'),
  llmFamily:          $('llm-family'),
  modelSelect:        $('model-select'),
  modelLoadStatus:    $('model-load-status'),
  overallSlider:      $('overall-slider'),
  overallEmoji:       $('overall-emoji'),
  overallVal:         $('overall-val'),
  starDisplay:        $('star-display'),
  starDesc:           $('star-desc'),
  priceSlider:        $('price-slider'),
  priceEmoji:         $('price-emoji'),
  priceVal:           $('price-val'),
  featuresSlider:     $('features-slider'),
  featuresEmoji:      $('features-emoji'),
  featuresVal:        $('features-val'),
  usabilitySlider:    $('usability-slider'),
  usabilityEmoji:     $('usability-emoji'),
  usabilityVal:       $('usability-val'),
  btnGenerate:        $('btn-generate'),
  btnCancel:          $('btn-cancel'),
  btnCompare:         $('btn-compare'),
  btnDownload:        $('btn-download'),
  btnDownloadMd:      $('btn-download-md'),
  reviewHistory:      $('review-history'),
  historyPills:       $('history-pills'),
  outPlaceholder:     $('out-placeholder'),
  outLoading:         $('out-loading'),
  outReview:          $('out-review'),
  outError:           $('out-error'),
  outModelTag:        $('out-model-tag'),
  outProductTag:      $('out-product-tag'),
  outStarRating:      $('out-star-rating'),
  mTime:              $('m-time'),
  mWords:             $('m-words'),
  mCost:              $('m-cost'),
  btnTogglePrompt:    $('btn-toggle-prompt'),
  promptInspector:    $('prompt-inspector'),
  piContent:          $('pi-content'),
  btnCopyPrompt:      $('btn-copy-prompt'),
  btnCopy:            $('btn-copy'),
  btnCopyHtml:        $('btn-copy-html'),
  btnRegenerate:      $('btn-regenerate'),
  outContent:         $('out-content'),
  errMessage:         $('err-message'),
  btnErrRetry:        $('btn-err-retry'),
  compareCard:        $('compare-card'),
  compareLoading:     $('compare-loading'),
  compareGrid:        $('compare-grid'),
  compareNegative:    $('compare-negative'),
  comparePositive:    $('compare-positive'),
  keyModalOverlay:    $('key-modal-overlay'),
  keyDisplay:         $('key-display'),
  keyModalInput:      $('key-modal-input'),
  keyModalClose:      $('key-modal-close'),
  keyModalConfirm:    $('key-modal-confirm'),
  keyModalCancel:     $('key-modal-cancel'),
  btnClearKey:        $('btn-clear-key'),
  fileKey:            $('file-key'),
  shortcutsOverlay:   $('shortcuts-modal-overlay'),
  shortcutsClose:     $('shortcuts-modal-close'),
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
    el.keyDisplay.innerHTML = `<span style="color:#5E72EB;font-family:monospace">${masked}</span>`;
    el.btnClearKey.classList.remove('hidden');
    el.inlineKeyInput.value = '';
    el.inlineKeyInput.placeholder = masked;
    el.keyInlineStatus.textContent = '● Key set';
    el.keyInlineStatus.classList.add('is-set');
    el.btnSetKeyInline.classList.add('hidden');
    el.btnClearKeyInline.classList.remove('hidden');
  } else {
    el.keyDisplay.innerHTML = '<span class="unset-text">not set</span>';
    el.btnClearKey.classList.add('hidden');
    el.inlineKeyInput.placeholder = 'Paste your OpenAI API key (sk-...)';
    el.keyInlineStatus.textContent = '';
    el.keyInlineStatus.classList.remove('is-set');
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
    if (key) { setKey(key); showToast('API key loaded from file.'); }
    else      { showToast('No OpenAI key found. Use OPENAI_API_KEY=sk-... format.'); }
  };
  reader.readAsText(file);
}

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
      .filter(id => /^gpt-/.test(id) &&
        !id.includes('instruct') && !id.includes('realtime') &&
        !id.includes('audio')    && !id.includes('vision'))
      .sort((a, b) => {
        const rank = id => {
          if (id.startsWith('gpt-4o'))      return 0;
          if (id.startsWith('gpt-4-turbo')) return 1;
          if (id.startsWith('gpt-4'))       return 2;
          return 3;
        };
        return rank(a) - rank(b) || a.localeCompare(b);
      });

    const models = gptModels.length ? gptModels : FALLBACK_MODELS;
    state.modelsCache = models;
    populateModelSelect(models, false);
    el.llmFamily.options[0].text = `OpenAI (${models.length} models)`;
    el.modelLoadStatus.textContent = 'Models discovered successfully (cached)';
    el.modelLoadStatus.style.color = '#16a34a';
  } catch (err) {
    console.warn('Model fetch failed, using fallback:', err.message);
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
//  SENTIMENT & STAR RATING
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

function sentimentToStars(val) {
  if (val <= 15) return { stars: '★☆☆☆☆', label: '1 star'  };
  if (val <= 35) return { stars: '★★☆☆☆', label: '2 stars' };
  if (val <= 55) return { stars: '★★★☆☆', label: '3 stars' };
  if (val <= 75) return { stars: '★★★★☆', label: '4 stars' };
  return              { stars: '★★★★★', label: '5 stars' };
}

function updateSentiment() {
  const v = parseInt(el.overallSlider.value);
  el.overallEmoji.textContent = sentimentEmoji(v);
  el.overallVal.textContent   = v;
  const { stars, label } = sentimentToStars(v);
  el.starDisplay.textContent  = stars;
  el.starDesc.textContent     = label;
}

function updateAspectSlider(slider, emojiEl, valEl) {
  const v = parseInt(slider.value);
  emojiEl.textContent = sentimentEmoji(v);
  valEl.textContent   = v;
}

function extractStarRating(text) {
  const match = text.match(/[★☆]{3,5}/);
  return match ? match[0] : null;
}

// ════════════════════════════════════════════════════════
//  COST ESTIMATION
// ════════════════════════════════════════════════════════

function estimateCost(model, usage) {
  if (!usage) return null;
  // Find longest matching pricing key (handles versioned model IDs like gpt-4o-2024-11-20)
  const keys = Object.keys(MODEL_PRICING).filter(k => model === k || model.startsWith(k + '-'));
  if (keys.length === 0) return null;
  const key = keys.sort((a, b) => b.length - a.length)[0];
  const p = MODEL_PRICING[key];
  return (usage.prompt_tokens / 1e6) * p.input + (usage.completion_tokens / 1e6) * p.output;
}

function formatCost(cost) {
  if (cost === null) return null;
  if (cost < 0.00005) return '< $0.0001';
  return `~$${cost.toFixed(4)}`;
}

// ════════════════════════════════════════════════════════
//  SURPRISE ME
// ════════════════════════════════════════════════════════

function surpriseMe() {
  const pick = SURPRISE_PRODUCTS[Math.floor(Math.random() * SURPRISE_PRODUCTS.length)];
  el.productName.value = pick.name;
  for (const opt of el.category.options) {
    if (opt.value === pick.category) { opt.selected = true; break; }
  }
  el.productName.style.transition = 'background 0.15s';
  el.productName.style.background = '#eef0fd';
  setTimeout(() => { el.productName.style.background = ''; }, 350);
  showToast(`Loaded: ${pick.name}`);
}

// ════════════════════════════════════════════════════════
//  REVIEW HISTORY
// ════════════════════════════════════════════════════════

function addToHistory(entry) {
  state.history.unshift(entry);
  if (state.history.length > MAX_HISTORY) state.history.pop();
  state.activeHistoryIdx = 0;
  renderHistory();
}

function renderHistory() {
  if (state.history.length === 0) {
    el.reviewHistory.classList.add('hidden');
    return;
  }
  el.reviewHistory.classList.remove('hidden');
  el.historyPills.innerHTML = state.history
    .map((entry, i) => {
      const label = entry.product || 'Review';
      const cls   = i === state.activeHistoryIdx ? 'history-pill active' : 'history-pill';
      return `<button class="${cls}" data-idx="${i}" title="${label}">${label}</button>`;
    })
    .join('');
  el.historyPills.querySelectorAll('.history-pill').forEach(btn => {
    btn.addEventListener('click', () => restoreHistory(parseInt(btn.dataset.idx)));
  });
}

function restoreHistory(idx) {
  const entry = state.history[idx];
  if (!entry) return;

  state.activeHistoryIdx = idx;
  state.reviewText    = entry.text;
  state.reviewProduct = entry.product;
  state.lastPrompt    = entry.prompt || null;

  el.outContent.innerHTML      = marked.parse(entry.text);
  el.outModelTag.textContent   = entry.model;
  el.outProductTag.textContent = entry.product;
  el.outStarRating.textContent = entry.stars || '';
  el.mTime.textContent         = entry.elapsed ? `${(entry.elapsed / 1000).toFixed(1)}s` : '—';
  el.mWords.textContent        = `${entry.words} words`;

  if (entry.cost) {
    el.mCost.textContent = entry.cost;
    el.mCost.classList.remove('hidden');
  } else {
    el.mCost.classList.add('hidden');
  }

  if (state.lastPrompt) el.piContent.textContent = state.lastPrompt;

  el.btnDownload.disabled   = false;
  el.btnDownloadMd.disabled = false;
  showPanel('review');
  renderHistory();
}

// ════════════════════════════════════════════════════════
//  PROMPT BUILDER
// ════════════════════════════════════════════════════════

function buildPrompt(overrideSentiment = null) {
  const name       = el.productName.value.trim() || 'this product';
  const category   = el.category.value;
  const persona    = el.personaSelect.value;
  const platform   = el.platformSelect.value;
  const lengthKey  = el.lengthSelect.value;
  const styleKey   = el.styleSelect.value;
  const comments   = el.comments.value.trim();
  const overall    = overrideSentiment !== null ? overrideSentiment : parseInt(el.overallSlider.value);
  const price      = parseInt(el.priceSlider.value);
  const features   = parseInt(el.featuresSlider.value);
  const usability  = parseInt(el.usabilitySlider.value);

  const personaBlock  = PERSONA_INSTRUCTIONS[persona]
    ? `Reviewer persona: ${PERSONA_INSTRUCTIONS[persona]}\n\n`
    : '';
  const platformBlock = PLATFORM_INSTRUCTIONS[platform]
    ? `\nPlatform: ${PLATFORM_INSTRUCTIONS[platform]}`
    : '';
  const commentsBlock = comments
    ? `\nAdditional context / requirements:\n${comments}`
    : '';

  return `You are writing a product review for educational and development purposes only.

${personaBlock}Product: "${name}"
Category: ${category}

${LENGTH_INSTRUCTIONS[lengthKey]}
${STYLE_INSTRUCTIONS[styleKey]}

Overall sentiment: ${overall}/100 — ${sentimentDesc(overall)}.

Aspect sentiments (0 = very negative, 50 = neutral, 100 = very positive):
- Price / Value: ${price}/100 — ${sentimentDesc(price)}
- Features: ${features}/100 — ${sentimentDesc(features)}
- Usability: ${usability}/100 — ${sentimentDesc(usability)}
${commentsBlock}${platformBlock}

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
      messages:    [{ role: 'user', content: prompt }],
      max_tokens:  1500,
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
  const usage   = data.usage || null;

  return { text, elapsed, usage };
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
  el.btnGenerate.disabled   = true;
  el.btnCancel.classList.remove('hidden');
  el.btnDownload.disabled   = true;
  el.btnDownloadMd.disabled = true;
  el.promptInspector.classList.add('hidden');
  el.btnTogglePrompt.classList.remove('active');

  try {
    const prompt = buildPrompt();
    state.lastPrompt = prompt;
    el.piContent.textContent = prompt;

    const { text, elapsed, usage } = await callOpenAI(prompt, model, state.abortController.signal);

    const wordCount = text.trim().split(/\s+/).length;
    const stars     = extractStarRating(text);
    const cost      = estimateCost(model, usage);
    const costStr   = formatCost(cost);

    el.outContent.innerHTML      = marked.parse(text);
    el.outModelTag.textContent   = model;
    el.outProductTag.textContent = productName;
    el.outStarRating.textContent = stars || '';
    el.mTime.textContent         = `${(elapsed / 1000).toFixed(1)}s`;
    el.mWords.textContent        = `${wordCount} words`;

    if (costStr) {
      el.mCost.textContent = costStr;
      el.mCost.classList.remove('hidden');
    } else {
      el.mCost.classList.add('hidden');
    }

    state.reviewText    = text;
    state.reviewProduct = productName;
    el.btnDownload.disabled   = false;
    el.btnDownloadMd.disabled = false;

    addToHistory({ text, model, product: productName, elapsed, words: wordCount, stars, cost: costStr, prompt });
    showPanel('review');

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

// ════════════════════════════════════════════════════════
//  COMPARE MODE
// ════════════════════════════════════════════════════════

async function generateBoth() {
  if (!state.apiKey) { openKeyModal(); showToast('Set your OpenAI API key first.'); return; }

  const model = el.modelSelect.value;
  if (!model) { showToast('Select a model first.'); return; }

  state.compareAborts.forEach(c => c.abort());
  state.compareAborts = [new AbortController(), new AbortController()];

  el.compareCard.classList.remove('hidden');
  el.compareGrid.classList.add('hidden');
  el.compareLoading.classList.remove('hidden');
  setTimeout(() => el.compareCard.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);

  el.btnCompare.disabled  = true;
  el.btnGenerate.disabled = true;
  el.btnCancel.classList.remove('hidden');

  try {
    const negPrompt = buildPrompt(10);
    const posPrompt = buildPrompt(90);

    const [negResult, posResult] = await Promise.all([
      callOpenAI(negPrompt, model, state.compareAborts[0].signal),
      callOpenAI(posPrompt, model, state.compareAborts[1].signal),
    ]);

    el.compareNegative.innerHTML = marked.parse(negResult.text);
    el.comparePositive.innerHTML = marked.parse(posResult.text);
    el.compareLoading.classList.add('hidden');
    el.compareGrid.classList.remove('hidden');

  } catch (err) {
    if (err.name !== 'AbortError') {
      showToast('Compare failed: ' + err.message);
    }
    el.compareCard.classList.add('hidden');
  } finally {
    el.btnCompare.disabled  = false;
    el.btnGenerate.disabled = false;
    el.btnCancel.classList.add('hidden');
    state.compareAborts = [];
  }
}

function cancelGenerate() {
  state.abortController?.abort();
  state.compareAborts.forEach(c => c.abort());
}

// ════════════════════════════════════════════════════════
//  PROMPT INSPECTOR
// ════════════════════════════════════════════════════════

function togglePromptInspector() {
  const nowHidden = el.promptInspector.classList.toggle('hidden');
  el.btnTogglePrompt.classList.toggle('active', !nowHidden);
}

// ════════════════════════════════════════════════════════
//  DOWNLOAD / EXPORT
// ════════════════════════════════════════════════════════

function makeFilename(ext) {
  return (state.reviewProduct || 'review')
    .toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') + '-review.' + ext;
}

function downloadBlob(content, filename, type) {
  const blob = new Blob([content], { type });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function downloadReview()   { if (state.reviewText) downloadBlob(state.reviewText, makeFilename('txt'), 'text/plain'); }
function downloadReviewMd() { if (state.reviewText) downloadBlob(state.reviewText, makeFilename('md'),  'text/markdown'); }

// ════════════════════════════════════════════════════════
//  SHORTCUTS MODAL
// ════════════════════════════════════════════════════════

function openShortcuts()  { el.shortcutsOverlay.classList.remove('hidden'); }
function closeShortcuts() { el.shortcutsOverlay.classList.add('hidden'); }

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
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), 2800);
}

// ════════════════════════════════════════════════════════
//  EVENT LISTENERS
// ════════════════════════════════════════════════════════

el.btnAbout.addEventListener('click', openKeyModal);
el.btnShortcuts.addEventListener('click', openShortcuts);
el.btnSurprise.addEventListener('click', surpriseMe);

// Inline key
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

// Key modal
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

// Shortcuts modal
el.shortcutsClose.addEventListener('click', closeShortcuts);
el.shortcutsOverlay.addEventListener('click', e => { if (e.target === el.shortcutsOverlay) closeShortcuts(); });

// Model
el.modelSelect.addEventListener('change', () => { state.model = el.modelSelect.value; });

// Sentiment sliders
el.overallSlider.addEventListener('input', updateSentiment);
el.priceSlider.addEventListener('input',     () => updateAspectSlider(el.priceSlider,     el.priceEmoji,     el.priceVal));
el.featuresSlider.addEventListener('input',  () => updateAspectSlider(el.featuresSlider,  el.featuresEmoji,  el.featuresVal));
el.usabilitySlider.addEventListener('input', () => updateAspectSlider(el.usabilitySlider, el.usabilityEmoji, el.usabilityVal));

// Comments character counter
el.comments.addEventListener('input', () => {
  const len = el.comments.value.length;
  el.commentsCount.textContent = len;
  el.commentsCount.parentElement.classList.toggle('near-limit', len >= 800 && len < 1000);
  el.commentsCount.parentElement.classList.toggle('at-limit',   len >= 1000);
});

// Generate / cancel / compare
el.btnGenerate.addEventListener('click', generate);
el.btnCancel.addEventListener('click', cancelGenerate);
el.btnRegenerate.addEventListener('click', generate);
el.btnErrRetry.addEventListener('click', generate);
el.btnCompare.addEventListener('click', generateBoth);

// Prompt inspector
el.btnTogglePrompt.addEventListener('click', togglePromptInspector);
el.btnCopyPrompt.addEventListener('click', () => {
  if (!state.lastPrompt) return;
  navigator.clipboard.writeText(state.lastPrompt).then(
    () => showToast('Prompt copied to clipboard.'),
    () => showToast('Copy failed.'),
  );
});

// Copy / export
el.btnCopy.addEventListener('click', () => {
  navigator.clipboard.writeText(el.outContent.innerText).then(
    () => showToast('Review copied to clipboard.'),
    () => showToast('Copy failed — try selecting manually.'),
  );
});
el.btnCopyHtml.addEventListener('click', () => {
  navigator.clipboard.writeText(el.outContent.innerHTML).then(
    () => showToast('HTML copied to clipboard.'),
    () => showToast('Copy failed.'),
  );
});
el.btnDownload.addEventListener('click', downloadReview);
el.btnDownloadMd.addEventListener('click', downloadReviewMd);

// Keyboard shortcuts
document.addEventListener('keydown', e => {
  const mod = e.metaKey || e.ctrlKey;

  if (mod && !e.shiftKey && e.key === 'Enter') {
    e.preventDefault();
    if (!el.btnGenerate.disabled) generate();
  }
  if (mod && e.shiftKey && e.key === 'B') {
    e.preventDefault();
    if (!el.btnCompare.disabled) generateBoth();
  }
  if (mod && e.shiftKey && e.key === 'C') {
    e.preventDefault();
    if (state.reviewText) {
      navigator.clipboard.writeText(el.outContent.innerText).then(
        () => showToast('Review copied to clipboard.'),
        () => {},
      );
    }
  }
  if (mod && e.shiftKey && e.key === 'P') {
    e.preventDefault();
    if (!el.outReview.classList.contains('hidden')) togglePromptInspector();
  }
  if (e.key === 'Escape') {
    if (!el.keyModalOverlay.classList.contains('hidden'))   { closeKeyModal();   return; }
    if (!el.shortcutsOverlay.classList.contains('hidden'))  { closeShortcuts();  return; }
    cancelGenerate();
  }
});

// ════════════════════════════════════════════════════════
//  INIT
// ════════════════════════════════════════════════════════

(function init() {
  updateSentiment();
  updateAspectSlider(el.priceSlider,     el.priceEmoji,     el.priceVal);
  updateAspectSlider(el.featuresSlider,  el.featuresEmoji,  el.featuresVal);
  updateAspectSlider(el.usabilitySlider, el.usabilityEmoji, el.usabilityVal);
  showPanel('placeholder');
})();
