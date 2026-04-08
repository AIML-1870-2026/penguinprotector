// ═══════════════════════════════════════════════════════
//  SWITCHBOARD EXPLORER — script.js
// ═══════════════════════════════════════════════════════

// ── Constants ──────────────────────────────────────────

const MODELS = {
  openai:    ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo'],
  anthropic: ['claude-opus-4-6', 'claude-sonnet-4-6', 'claude-haiku-4-5-20251001'],
};

const EXAMPLES = {
  unstructured: [
    {
      label: 'Neural Networks (ELI10)',
      prompt: 'Explain how neural networks learn to a 10-year-old.',
    },
    {
      label: 'Haiku — Distributed Systems',
      prompt: 'Write a haiku about distributed systems.',
    },
    {
      label: 'Underrated Python Libraries',
      prompt: 'What are three underrated Python libraries and why are they worth knowing?',
    },
    {
      label: 'The Halting Problem',
      prompt: 'Explain the Halting Problem and why it matters, in plain language.',
    },
  ],
  structured: [
    {
      label: 'Researcher Profile',
      prompt: 'Generate a fictional AI researcher profile.',
      schema: JSON.stringify({
        type: 'object',
        properties: {
          name:       { type: 'string' },
          age:        { type: 'number' },
          university: { type: 'string' },
          bio:        { type: 'string' },
          interests:  { type: 'array', items: { type: 'string' } },
        },
        required: ['name', 'age', 'university', 'bio', 'interests'],
      }, null, 2),
    },
    {
      label: 'AI Paper Summary',
      prompt: 'Summarize a recent breakthrough in AI research (real or plausible).',
      schema: JSON.stringify({
        type: 'object',
        properties: {
          title:   { type: 'string' },
          summary: { type: 'string' },
          year:    { type: 'number' },
          tags:    { type: 'array', items: { type: 'string' } },
        },
        required: ['title', 'summary', 'year', 'tags'],
      }, null, 2),
    },
    {
      label: 'Programming Language Profile',
      prompt: 'Generate a profile for a real or fictional programming language.',
      schema: JSON.stringify({
        type: 'object',
        properties: {
          name:      { type: 'string' },
          paradigm:  { type: 'string' },
          year:      { type: 'number' },
          strengths: { type: 'array', items: { type: 'string' } },
          weaknesses:{ type: 'array', items: { type: 'string' } },
          motto:     { type: 'string' },
        },
        required: ['name', 'paradigm', 'year', 'strengths', 'weaknesses'],
      }, null, 2),
    },
  ],
};

// ── State ──────────────────────────────────────────────

const state = {
  keys: { openai: null, anthropic: null },
  provider: 'openai',
  model: 'gpt-4o',
  mode: 'unstructured',        // 'unstructured' | 'structured'
  compareActive: false,
  cmpProvider: 'anthropic',
  cmpModel: 'claude-sonnet-4-5',
  library: [],                 // in-memory prompt library
  modalTarget: null,           // 'openai' | 'anthropic'
  history: [],                 // response history entries
  histIdx: -1,                 // index into history (-1 = none)
};

// ── DOM refs ───────────────────────────────────────────

const $ = id => document.getElementById(id);

const el = {
  // Key management
  kvOpenai:      $('kv-openai'),
  kvAnthropic:   $('kv-anthropic'),
  btnSetOai:     $('btn-set-openai'),
  btnSetAnt:     $('btn-set-anthropic'),
  btnClrOai:     $('btn-clr-openai'),
  btnClrAnt:     $('btn-clr-anthropic'),
  fileOai:       $('file-openai'),
  fileAnt:       $('file-anthropic'),
  // Provider / model
  providerTabs:  $('provider-tabs'),
  modelSelect:   $('model-select'),
  // Mode
  modeTabs:      $('mode-tabs'),
  schemaBlock:   $('schema-block'),
  schemaInput:   $('schema-input'),
  // Examples
  exampleSelect: $('example-select'),
  // System prompt
  systemInput:   $('system-input'),
  btnToggleSys:  $('btn-toggle-system'),
  systemWrap:    $('system-prompt-wrap'),
  // Prompt
  promptInput:   $('prompt-input'),
  btnSend:       $('btn-send'),
  btnCompare:    $('btn-compare-toggle'),
  btnSave:       $('btn-save-prompt'),
  // Compare cfg
  compareCfg:    $('compare-cfg'),
  cmpProvTabs:   $('compare-provider-tabs'),
  cmpModelSel:   $('compare-model-select'),
  // Output
  outPlaceholder:$('out-placeholder'),
  outLoading:    $('out-loading'),
  outSingle:     $('out-single'),
  outCompare:    $('out-compare'),
  loadingText:   $('loading-text'),
  // Single output
  outModelTag:   $('out-model-tag'),
  metricsRow:    $('metrics-row'),
  mTime:         $('m-time'),
  mTokens:       $('m-tokens'),
  mWords:        $('m-words'),
  outContent:    $('out-content'),
  validatorPanel:$('validator-panel'),
  validatorRes:  $('validator-results'),
  btnCopy:       $('btn-copy'),
  btnHistPrev:   $('btn-hist-prev'),
  btnHistNext:   $('btn-hist-next'),
  histPos:       $('hist-pos'),
  // Compare output
  cmpTagA:       $('cmp-tag-a'),
  cmpTagB:       $('cmp-tag-b'),
  cmpMetricsA:   $('cmp-metrics-a'),
  cmpMetricsB:   $('cmp-metrics-b'),
  cmpContentA:   $('cmp-content-a'),
  cmpContentB:   $('cmp-content-b'),
  cmpValA:       $('cmp-validator-a'),
  cmpValB:       $('cmp-validator-b'),
  btnCopyA:      $('btn-copy-a'),
  btnCopyB:      $('btn-copy-b'),
  // Status bar
  sbStatus:      $('sb-status'),
  sbProvider:    $('sb-provider'),
  sbModel:       $('sb-model'),
  sbMode:        $('sb-mode'),
  sbOai:         $('sb-oai'),
  sbAnt:         $('sb-ant'),
  // Key modal
  keyModalOverlay: $('key-modal-overlay'),
  keyModalTitle:   $('key-modal-title'),
  keyModalInput:   $('key-modal-input'),
  keyModalConfirm: $('key-modal-confirm'),
  keyModalCancel:  $('key-modal-cancel'),
  keyModalClose:   $('key-modal-close'),
  // Library
  btnLibrary:    $('btn-library'),
  libOverlay:    $('lib-modal-overlay'),
  libClose:      $('lib-close'),
  libEmpty:      $('lib-empty'),
  libList:       $('lib-list'),
};

// ════════════════════════════════════════════════════════
//  KEY MANAGEMENT
// ════════════════════════════════════════════════════════

function setKey(provider, key) {
  state.keys[provider] = key.trim();
  updateKeyUI(provider);
  updateStatusBar();
}

function clearKey(provider) {
  state.keys[provider] = null;
  updateKeyUI(provider);
  updateStatusBar();
}

function updateKeyUI(provider) {
  const key   = state.keys[provider];
  const valEl = provider === 'openai' ? el.kvOpenai : el.kvAnthropic;
  const clrEl = provider === 'openai' ? el.btnClrOai : el.btnClrAnt;

  if (key) {
    const masked = key.slice(0, 6) + '••••••••' + key.slice(-4);
    valEl.innerHTML = `<span style="color:var(--green)">${masked}</span>`;
    clrEl.classList.remove('hidden');
  } else {
    valEl.innerHTML = '<span class="unset-text">not set</span>';
    clrEl.classList.add('hidden');
  }
}

function parseKeyFile(text, hintProvider) {
  const found = {};

  // .env format: KEY=value
  const envMatches = text.matchAll(/^([A-Z_]+)\s*=\s*(.+)$/gm);
  for (const [, k, v] of envMatches) {
    const val = v.trim();
    if (k.includes('OPENAI'))    found.openai    = val;
    if (k.includes('ANTHROPIC')) found.anthropic = val;
  }

  // .csv format: provider,key
  const csvLines = text.split('\n').map(l => l.trim()).filter(Boolean);
  for (const line of csvLines) {
    const [col0, col1] = line.split(',').map(s => s.trim());
    if (!col1) continue;
    if (col0.toLowerCase().includes('openai'))    found.openai    = col1;
    if (col0.toLowerCase().includes('anthropic')) found.anthropic = col1;
  }

  // Raw key fallback: if only one key found and it's a bare API key string
  const bareKey = text.trim().replace(/\s+/g, '');
  if (Object.keys(found).length === 0 && bareKey.length > 10) {
    if (hintProvider) found[hintProvider] = bareKey;
  }

  return found;
}

function handleFileUpload(file, hintProvider) {
  const reader = new FileReader();
  reader.onload = e => {
    const parsed = parseKeyFile(e.target.result, hintProvider);
    let count = 0;
    for (const [provider, key] of Object.entries(parsed)) {
      if (MODELS[provider]) { setKey(provider, key); count++; }
    }
    if (count === 0) showToast('No API keys found in file. Use KEY=value or provider,key format.');
    else showToast(`Loaded ${count} key${count > 1 ? 's' : ''} from file.`);
  };
  reader.readAsText(file);
}

// ─ Key Modal ─

function openKeyModal(provider) {
  state.modalTarget = provider;
  el.keyModalTitle.textContent = `Set ${provider === 'openai' ? 'OpenAI' : 'Anthropic'} API Key`;
  el.keyModalInput.value = '';
  el.keyModalOverlay.classList.remove('hidden');
  setTimeout(() => el.keyModalInput.focus(), 50);
}

function closeKeyModal() {
  el.keyModalOverlay.classList.add('hidden');
  el.keyModalInput.value = '';
  state.modalTarget = null;
}

function confirmKeyModal() {
  const val = el.keyModalInput.value.trim();
  if (!val) return;
  setKey(state.modalTarget, val);
  closeKeyModal();
  showToast(`${state.modalTarget === 'openai' ? 'OpenAI' : 'Anthropic'} key saved.`);
}

// ════════════════════════════════════════════════════════
//  PROVIDER & MODEL
// ════════════════════════════════════════════════════════

function setProvider(provider) {
  state.provider = provider;
  const models = MODELS[provider];
  state.model = models[0];

  el.modelSelect.innerHTML = models.map(m =>
    `<option value="${m}">${m}</option>`
  ).join('');

  document.querySelectorAll('#provider-tabs .segtab').forEach(t =>
    t.classList.toggle('active', t.dataset.provider === provider)
  );

  updateStatusBar();
}

function setCompareProvider(provider) {
  state.cmpProvider = provider;
  const models = MODELS[provider];
  state.cmpModel = models[0];

  el.cmpModelSel.innerHTML = models.map(m =>
    `<option value="${m}">${m}</option>`
  ).join('');

  document.querySelectorAll('#compare-provider-tabs .segtab').forEach(t =>
    t.classList.toggle('active', t.dataset.provider2 === provider)
  );
}

// ════════════════════════════════════════════════════════
//  MODE
// ════════════════════════════════════════════════════════

function setMode(mode) {
  state.mode = mode;

  document.querySelectorAll('#mode-tabs .segtab').forEach(t =>
    t.classList.toggle('active', t.dataset.mode === mode)
  );

  el.schemaBlock.classList.toggle('hidden', mode !== 'structured');
  populateExamples();
  updateStatusBar();
}

// ════════════════════════════════════════════════════════
//  EXAMPLES
// ════════════════════════════════════════════════════════

function populateExamples() {
  const list = EXAMPLES[state.mode];
  el.exampleSelect.innerHTML =
    '<option value="">— load an example —</option>' +
    list.map((ex, i) => `<option value="${i}">${ex.label}</option>`).join('');
}

function loadExample(idx) {
  const list = EXAMPLES[state.mode];
  const ex = list[parseInt(idx)];
  if (!ex) return;
  el.promptInput.value = ex.prompt;
  if (state.mode === 'structured' && ex.schema) {
    el.schemaInput.value = ex.schema;
  }
}

// ════════════════════════════════════════════════════════
//  COMPARE MODE
// ════════════════════════════════════════════════════════

function toggleCompare() {
  state.compareActive = !state.compareActive;
  el.btnCompare.classList.toggle('active', state.compareActive);
  el.compareCfg.classList.toggle('hidden', !state.compareActive);
}

// ════════════════════════════════════════════════════════
//  API CALLS
// ════════════════════════════════════════════════════════

async function callOpenAI(key, model, prompt, schema, isStructured, systemPrompt) {
  const messages = [];

  const sysContent = isStructured
    ? `You must respond with a JSON object that exactly matches this schema:\n\n${schema}\n\nReturn ONLY valid JSON. No explanation, no markdown, no code fences.`
    : (systemPrompt || null);

  if (sysContent) {
    messages.push({ role: 'system', content: sysContent });
  }

  messages.push({ role: 'user', content: prompt });

  const body = {
    model,
    messages,
    max_tokens: 2048,
    ...(isStructured ? { response_format: { type: 'json_object' } } : {}),
  };

  const start = performance.now();
  const resp = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const elapsed = Math.round(performance.now() - start);

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.error?.message || `OpenAI error ${resp.status}`);
  }

  const data = await resp.json();
  return {
    text:    data.choices[0].message.content,
    tokens:  data.usage?.total_tokens ?? null,
    elapsed,
  };
}

async function callAnthropic(key, model, prompt, schema, isStructured, systemPrompt) {
  const system = isStructured
    ? `You must respond with a JSON object that exactly matches this schema:\n\n${schema}\n\nReturn ONLY valid JSON. No explanation, no markdown, no code fences.`
    : (systemPrompt || null);

  const body = {
    model,
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 2048,
    ...(system ? { system } : {}),
  };

  const start = performance.now();
  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-allow-browser': 'true',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const elapsed = Math.round(performance.now() - start);

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.error?.message || `Anthropic error ${resp.status}`);
  }

  const data = await resp.json();
  const text = data.content[0]?.text ?? '';
  const tokens = (data.usage?.input_tokens ?? 0) + (data.usage?.output_tokens ?? 0);
  return { text, tokens, elapsed };
}

async function callModel(provider, model, prompt, schema, isStructured, systemPrompt) {
  const key = state.keys[provider];
  if (!key) throw new Error(`No ${provider} API key set. Click "set" next to the ${provider} key.`);
  return provider === 'openai'
    ? callOpenAI(key, model, prompt, schema, isStructured, systemPrompt)
    : callAnthropic(key, model, prompt, schema, isStructured, systemPrompt);
}

// ════════════════════════════════════════════════════════
//  JSON HANDLING
// ════════════════════════════════════════════════════════

function extractJSON(text) {
  // Strip markdown code fences if the model wrapped the JSON
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) return fenced[1].trim();
  return text.trim();
}

function syntaxHighlight(json) {
  const str = typeof json === 'string' ? json : JSON.stringify(json, null, 2);
  return str
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(
      /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g,
      match => {
        if (/^"/.test(match)) {
          if (/:$/.test(match)) return `<span class="json-key">${match}</span>`;
          return `<span class="json-string">${match}</span>`;
        }
        if (/true|false/.test(match)) return `<span class="json-bool">${match}</span>`;
        if (/null/.test(match))       return `<span class="json-null">${match}</span>`;
        return `<span class="json-number">${match}</span>`;
      }
    );
}

// ════════════════════════════════════════════════════════
//  SCHEMA VALIDATOR
// ════════════════════════════════════════════════════════

function validateSchema(jsonObj, schemaStr) {
  let schema;
  try { schema = JSON.parse(schemaStr); } catch { return null; }

  const props    = schema.properties || {};
  const required = schema.required   || [];
  const results  = [];

  // Check declared properties
  for (const [field, def] of Object.entries(props)) {
    const exists = field in jsonObj;
    if (!exists) {
      const isMissing = required.includes(field);
      results.push({ field, status: isMissing ? 'missing' : 'absent', expected: def.type });
      continue;
    }
    const val          = jsonObj[field];
    const actualType   = Array.isArray(val) ? 'array' : typeof val;
    const expectedType = def.type;
    const typeOk       = !expectedType || actualType === expectedType;
    results.push({ field, status: typeOk ? 'ok' : 'type-mismatch', expected: expectedType, actual: actualType });
  }

  // Flag extra fields
  for (const field of Object.keys(jsonObj)) {
    if (!(field in props)) {
      results.push({ field, status: 'extra', actual: typeof jsonObj[field] });
    }
  }

  return results;
}

function renderValidation(results, container) {
  if (!results || results.length === 0) {
    container.innerHTML = '<div style="color:var(--dim);font-size:11px;padding:6px">No validation results.</div>';
    return;
  }

  container.innerHTML = results.map(r => {
    let cls, icon, desc;
    switch (r.status) {
      case 'ok':
        cls  = 'vrow-ok';
        icon = '✅';
        desc = `<span style="color:var(--dim)">${r.expected ?? 'any'}</span>`;
        break;
      case 'missing':
        cls  = 'vrow-miss';
        icon = '❌';
        desc = `<span style="color:var(--red)">required field missing</span>`;
        break;
      case 'absent':
        cls  = 'vrow-extra';
        icon = '⬜';
        desc = `<span style="color:var(--dim)">optional, not returned</span>`;
        break;
      case 'type-mismatch':
        cls  = 'vrow-type';
        icon = '⚠️';
        desc = `<span style="color:var(--yellow)">expected ${r.expected}, got ${r.actual}</span>`;
        break;
      case 'extra':
        cls  = 'vrow-extra';
        icon = '➕';
        desc = `<span style="color:var(--dim)">extra field (${r.actual})</span>`;
        break;
      default:
        cls = ''; icon = '?'; desc = '';
    }
    return `<div class="vrow ${cls}">
      <span class="vrow-icon">${icon}</span>
      <span class="vrow-field">${r.field}</span>
      <span class="vrow-desc">${desc}</span>
    </div>`;
  }).join('');
}

// ════════════════════════════════════════════════════════
//  OUTPUT RENDERING
// ════════════════════════════════════════════════════════

function renderResult(result, isStructured, schema,
                      contentEl, validatorEl, modelTag, metricsEl) {
  modelTag.textContent = result.model;

  // Metrics
  const wordCount = result.text.trim().split(/\s+/).filter(Boolean).length;
  if (metricsEl) {
    metricsEl.innerHTML =
      `<span class="metric-chip" title="Response time">${result.elapsed} ms</span>` +
      `<span class="metric-chip" title="Total tokens">${result.tokens != null ? result.tokens + ' tok' : '— tok'}</span>` +
      `<span class="metric-chip" title="Word count">${wordCount} words</span>`;
  } else {
    el.mTime.textContent   = `${result.elapsed} ms`;
    el.mTokens.textContent = result.tokens != null ? `${result.tokens} tok` : '— tok';
    el.mWords.textContent  = `${wordCount} words`;
  }

  // Content
  if (result.error) {
    contentEl.className = 'out-content';
    contentEl.innerHTML = `<div class="error-card"><strong>Error</strong>${escHtml(result.error)}</div>`;
    if (validatorEl) validatorEl.classList.add('hidden');
    return;
  }

  if (isStructured) {
    const raw = extractJSON(result.text);
    let parsed = null;
    try { parsed = JSON.parse(raw); } catch (_) {}

    if (parsed) {
      contentEl.className = 'out-content json-content';
      contentEl.innerHTML = `<pre>${syntaxHighlight(parsed)}</pre>`;

      if (validatorEl && schema) {
        const results = validateSchema(parsed, schema);
        if (results) {
          validatorEl.classList.remove('hidden');
          const inner = validatorEl.querySelector('.validator-results') || validatorEl;
          if (!validatorEl.querySelector('.validator-hdr')) {
            validatorEl.innerHTML =
              '<div class="validator-hdr">⊞ Schema Validation Report</div>' +
              '<div class="validator-results"></div>';
          }
          renderValidation(results, validatorEl.querySelector('.validator-results') || validatorEl);
        }
      }
    } else {
      // Couldn't parse JSON — show raw with warning
      contentEl.className = 'out-content';
      contentEl.innerHTML =
        `<div class="error-card" style="margin-bottom:10px"><strong>⚠ JSON Parse Error</strong>The model returned text that could not be parsed as JSON. Showing raw output below.</div>` +
        `<pre style="white-space:pre-wrap">${escHtml(result.text)}</pre>`;
      if (validatorEl) validatorEl.classList.add('hidden');
    }
  } else {
    contentEl.className = 'out-content md-content';
    contentEl.innerHTML = renderMarkdown(result.text);
    if (validatorEl) validatorEl.classList.add('hidden');
  }
}

function escHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ════════════════════════════════════════════════════════
//  MARKDOWN RENDERER (lightweight, no dependencies)
// ════════════════════════════════════════════════════════

function renderMarkdown(text) {
  // Escape HTML first, then selectively re-introduce markup
  let s = text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

  // Fenced code blocks (``` or ~~~)
  s = s.replace(/^```(\w*)\n?([\s\S]*?)```$/gm, (_match, _lang, code) =>
    `<pre class="md-code-block"><code>${code.trimEnd()}</code></pre>`);

  // Headings
  s = s.replace(/^######\s+(.+)$/gm, '<h6 class="md-h">$1</h6>');
  s = s.replace(/^#####\s+(.+)$/gm,  '<h5 class="md-h">$1</h5>');
  s = s.replace(/^####\s+(.+)$/gm,   '<h4 class="md-h">$1</h4>');
  s = s.replace(/^###\s+(.+)$/gm,    '<h3 class="md-h">$1</h3>');
  s = s.replace(/^##\s+(.+)$/gm,     '<h2 class="md-h">$1</h2>');
  s = s.replace(/^#\s+(.+)$/gm,      '<h1 class="md-h">$1</h1>');

  // Horizontal rule
  s = s.replace(/^(-{3,}|\*{3,}|_{3,})$/gm, '<hr class="md-hr">');

  // Blockquote
  s = s.replace(/^&gt;\s?(.+)$/gm, '<blockquote class="md-bq">$1</blockquote>');

  // Unordered lists — wrap consecutive items
  s = s.replace(/((?:^[-*+]\s.+\n?)+)/gm, block => {
    const items = block.trim().split('\n').map(l =>
      `<li>${l.replace(/^[-*+]\s/, '')}</li>`).join('');
    return `<ul class="md-ul">${items}</ul>`;
  });

  // Ordered lists
  s = s.replace(/((?:^\d+\.\s.+\n?)+)/gm, block => {
    const items = block.trim().split('\n').map(l =>
      `<li>${l.replace(/^\d+\.\s/, '')}</li>`).join('');
    return `<ol class="md-ol">${items}</ol>`;
  });

  // Inline: bold, italic, code
  s = s.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
  s = s.replace(/\*\*(.+?)\*\*/g,     '<strong>$1</strong>');
  s = s.replace(/\*(.+?)\*/g,         '<em>$1</em>');
  s = s.replace(/`([^`]+)`/g,         '<code class="md-code">$1</code>');

  // Paragraphs: blank-line-separated blocks not already tagged
  s = s.replace(/\n{2,}/g, '\n\n');
  const lines = s.split('\n\n');
  s = lines.map(block => {
    const trimmed = block.trim();
    if (!trimmed) return '';
    if (/^<(h[1-6]|ul|ol|pre|blockquote|hr)/.test(trimmed)) return trimmed;
    return `<p class="md-p">${trimmed.replace(/\n/g, '<br>')}</p>`;
  }).join('\n');

  return s;
}

// ════════════════════════════════════════════════════════
//  SEND
// ════════════════════════════════════════════════════════

async function send() {
  const prompt = el.promptInput.value.trim();
  if (!prompt) { showToast('Enter a prompt first.'); return; }

  const isStructured = state.mode === 'structured';
  const schema       = isStructured ? el.schemaInput.value.trim() : null;
  const systemPrompt = el.systemInput.value.trim() || null;

  showOutput('loading');
  el.btnSend.disabled = true;
  updateStatus('RUNNING');

  if (state.compareActive) {
    await sendCompare(prompt, schema, isStructured, systemPrompt);
  } else {
    await sendSingle(prompt, schema, isStructured, systemPrompt);
  }

  el.btnSend.disabled = false;
  updateStatus('READY');
}

async function sendSingle(prompt, schema, isStructured, systemPrompt) {
  let result;
  try {
    const raw = await callModel(state.provider, state.model, prompt, schema, isStructured, systemPrompt);
    result = { ...raw, model: state.model, error: null };
  } catch (err) {
    result = { text: '', tokens: null, elapsed: 0, model: state.model, error: err.message };
  }

  if (!result.error) {
    // Push to history, discarding any forward entries if we branched
    state.history = state.history.slice(0, state.histIdx + 1);
    state.history.push({ result, isStructured, schema });
    state.histIdx = state.history.length - 1;
  }

  showOutput('single');
  renderResult(result, isStructured, schema,
    el.outContent, el.validatorPanel, el.outModelTag, null);

  if (!result.error && !isStructured) {
    el.validatorPanel.classList.add('hidden');
  }

  updateHistoryNav();
}

async function sendCompare(prompt, schema, isStructured, systemPrompt) {
  el.cmpTagA.textContent = state.model;
  el.cmpTagB.textContent = state.cmpModel;
  el.cmpContentA.className = 'out-content';
  el.cmpContentB.className = 'out-content';
  el.cmpContentA.textContent = '...';
  el.cmpContentB.textContent = '...';
  el.cmpMetricsA.innerHTML = '';
  el.cmpMetricsB.innerHTML = '';
  el.cmpValA.classList.add('hidden');
  el.cmpValB.classList.add('hidden');

  showOutput('compare');

  const [resA, resB] = await Promise.allSettled([
    callModel(state.provider, state.model, prompt, schema, isStructured, systemPrompt),
    callModel(state.cmpProvider, state.cmpModel, prompt, schema, isStructured, systemPrompt),
  ]);

  const resultA = resA.status === 'fulfilled'
    ? { ...resA.value, model: state.model, error: null }
    : { text: '', tokens: null, elapsed: 0, model: state.model, error: resA.reason.message };

  const resultB = resB.status === 'fulfilled'
    ? { ...resB.value, model: state.cmpModel, error: null }
    : { text: '', tokens: null, elapsed: 0, model: state.cmpModel, error: resB.reason.message };

  renderResult(resultA, isStructured, schema,
    el.cmpContentA, el.cmpValA, el.cmpTagA, el.cmpMetricsA);
  renderResult(resultB, isStructured, schema,
    el.cmpContentB, el.cmpValB, el.cmpTagB, el.cmpMetricsB);
}

// ════════════════════════════════════════════════════════
//  HISTORY & COPY
// ════════════════════════════════════════════════════════

function updateHistoryNav() {
  const len = state.history.length;
  const idx = state.histIdx;
  el.btnHistPrev.disabled = idx <= 0;
  el.btnHistNext.disabled = idx >= len - 1;
  el.histPos.textContent  = len > 0 ? `${idx + 1}/${len}` : '';
}

function navigateHistory(dir) {
  const next = state.histIdx + dir;
  if (next < 0 || next >= state.history.length) return;
  state.histIdx = next;
  const { result, isStructured, schema } = state.history[next];
  showOutput('single');
  renderResult(result, isStructured, schema,
    el.outContent, el.validatorPanel, el.outModelTag, null);
  if (!isStructured) el.validatorPanel.classList.add('hidden');
  updateHistoryNav();
}

function copyOutput() {
  copyCol(el.outContent, el.btnCopy);
}

function copyCol(contentEl, btnEl) {
  const text = contentEl.innerText || contentEl.textContent;
  navigator.clipboard.writeText(text).then(() => {
    btnEl.textContent = '✓ copied';
    setTimeout(() => { btnEl.textContent = '⎘ copy'; }, 1500);
  }).catch(() => showToast('Copy failed — check browser permissions.'));
}

// ════════════════════════════════════════════════════════
//  PROMPT LIBRARY
// ════════════════════════════════════════════════════════

function savePrompt() {
  const prompt = el.promptInput.value.trim();
  if (!prompt) { showToast('Nothing to save — enter a prompt first.'); return; }

  const entry = {
    id:      Date.now(),
    mode:    state.mode,
    prompt,
    schema:  state.mode === 'structured' ? el.schemaInput.value.trim() : '',
    model:   state.model,
    ts:      new Date().toLocaleTimeString(),
  };

  state.library.unshift(entry);
  showToast('Prompt saved to library.');
  renderLibrary();
}

function loadFromLibrary(id) {
  const entry = state.library.find(e => e.id === id);
  if (!entry) return;

  if (entry.mode !== state.mode) setMode(entry.mode);
  el.promptInput.value = entry.prompt;
  if (entry.schema) el.schemaInput.value = entry.schema;

  closeLibrary();
  showToast('Prompt loaded.');
}

function deleteFromLibrary(id) {
  state.library = state.library.filter(e => e.id !== id);
  renderLibrary();
}

function renderLibrary() {
  if (state.library.length === 0) {
    el.libEmpty.style.display = '';
    el.libList.innerHTML = '';
    return;
  }
  el.libEmpty.style.display = 'none';
  el.libList.innerHTML = state.library.map(entry => `
    <li class="lib-item" data-id="${entry.id}">
      <span class="lib-item-mode ${entry.mode === 'structured' ? 'mode-json' : 'mode-free'}">
        ${entry.mode === 'structured' ? 'JSON' : 'TEXT'}
      </span>
      <div class="lib-item-body">
        <div class="lib-item-prompt">${escHtml(entry.prompt)}</div>
        <div class="lib-item-meta">${entry.model} · ${entry.ts}</div>
      </div>
      <button class="lib-item-del" data-del="${entry.id}" title="Delete">✕</button>
    </li>
  `).join('');
}

function openLibrary() {
  renderLibrary();
  el.libOverlay.classList.remove('hidden');
}

function closeLibrary() {
  el.libOverlay.classList.add('hidden');
}

// ════════════════════════════════════════════════════════
//  UI HELPERS
// ════════════════════════════════════════════════════════

function showOutput(which) {
  el.outPlaceholder.classList.add('hidden');
  el.outLoading.classList.add('hidden');
  el.outSingle.classList.add('hidden');
  el.outCompare.classList.add('hidden');

  if (which === 'loading')  el.outLoading.classList.remove('hidden');
  if (which === 'single')   el.outSingle.classList.remove('hidden');
  if (which === 'compare')  el.outCompare.classList.remove('hidden');
}

function updateStatus(status) {
  el.sbStatus.textContent = status;
}

function updateStatusBar() {
  el.sbProvider.textContent = state.provider;
  el.sbModel.textContent    = state.model;
  el.sbMode.textContent     = state.mode === 'structured' ? 'json schema' : 'free text';

  const oaiSet = !!state.keys.openai;
  const antSet = !!state.keys.anthropic;

  el.sbOai.textContent = (oaiSet ? '● ' : '○ ') + 'openai';
  el.sbOai.className   = 'sb-key ' + (oaiSet ? 'sb-set' : 'sb-unset');

  el.sbAnt.textContent = (antSet ? '● ' : '○ ') + 'anthropic';
  el.sbAnt.className   = 'sb-key ' + (antSet ? 'sb-set' : 'sb-unset');
}

// ── Toast ──

let _toastTimer;
function showToast(msg) {
  let toast = document.getElementById('toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast';
    Object.assign(toast.style, {
      position: 'fixed', bottom: '40px', left: '50%',
      transform: 'translateX(-50%)',
      background: 'var(--surface)',
      border: '1px solid var(--border-hi)',
      color: 'var(--text)',
      fontFamily: 'var(--font-ui)',
      fontSize: '12px',
      padding: '8px 16px',
      borderRadius: '6px',
      zIndex: '200',
      pointerEvents: 'none',
      transition: 'opacity 0.3s',
      boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
    });
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.style.opacity = '1';
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => { toast.style.opacity = '0'; }, 2500);
}

// ════════════════════════════════════════════════════════
//  EVENT WIRING
// ════════════════════════════════════════════════════════

function wire() {
  // Key management
  el.btnSetOai.addEventListener('click', () => openKeyModal('openai'));
  el.btnSetAnt.addEventListener('click', () => openKeyModal('anthropic'));
  el.btnClrOai.addEventListener('click', () => { clearKey('openai'); showToast('OpenAI key cleared.'); });
  el.btnClrAnt.addEventListener('click', () => { clearKey('anthropic'); showToast('Anthropic key cleared.'); });

  el.fileOai.addEventListener('change', e => {
    if (e.target.files[0]) { handleFileUpload(e.target.files[0], 'openai'); e.target.value = ''; }
  });
  el.fileAnt.addEventListener('change', e => {
    if (e.target.files[0]) { handleFileUpload(e.target.files[0], 'anthropic'); e.target.value = ''; }
  });

  // Key modal
  el.keyModalConfirm.addEventListener('click', confirmKeyModal);
  el.keyModalCancel.addEventListener('click', closeKeyModal);
  el.keyModalClose.addEventListener('click', closeKeyModal);
  el.keyModalInput.addEventListener('keydown', e => { if (e.key === 'Enter') confirmKeyModal(); });
  el.keyModalOverlay.addEventListener('click', e => { if (e.target === el.keyModalOverlay) closeKeyModal(); });
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    if (!el.keyModalOverlay.classList.contains('hidden')) closeKeyModal();
    else if (!el.libOverlay.classList.contains('hidden')) closeLibrary();
  });

  // Provider tabs
  el.providerTabs.addEventListener('click', e => {
    const p = e.target.dataset.provider;
    if (p) setProvider(p);
  });
  el.modelSelect.addEventListener('change', e => {
    state.model = e.target.value;
    updateStatusBar();
  });

  // Compare provider tabs
  el.cmpProvTabs.addEventListener('click', e => {
    const p = e.target.dataset.provider2;
    if (p) setCompareProvider(p);
  });
  el.cmpModelSel.addEventListener('change', e => { state.cmpModel = e.target.value; });

  // Mode
  el.modeTabs.addEventListener('click', e => {
    const m = e.target.dataset.mode;
    if (m) setMode(m);
  });

  // Examples
  el.exampleSelect.addEventListener('change', e => {
    if (e.target.value !== '') { loadExample(e.target.value); e.target.value = ''; }
  });

  // Send
  el.btnSend.addEventListener('click', send);
  el.promptInput.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') send();
  });

  // Compare toggle
  el.btnCompare.addEventListener('click', toggleCompare);

  // System prompt toggle
  el.btnToggleSys.addEventListener('click', () => {
    const hidden = el.systemWrap.classList.toggle('hidden');
    el.btnToggleSys.textContent = hidden ? 'show' : 'hide';
  });

  // Copy & history
  el.btnCopy.addEventListener('click', copyOutput);
  el.btnCopyA.addEventListener('click', () => copyCol(el.cmpContentA, el.btnCopyA));
  el.btnCopyB.addEventListener('click', () => copyCol(el.cmpContentB, el.btnCopyB));
  el.btnHistPrev.addEventListener('click', () => navigateHistory(-1));
  el.btnHistNext.addEventListener('click', () => navigateHistory(1));

  // Save prompt
  el.btnSave.addEventListener('click', savePrompt);

  // Library
  el.btnLibrary.addEventListener('click', openLibrary);
  el.libClose.addEventListener('click', closeLibrary);
  el.libOverlay.addEventListener('click', e => { if (e.target === el.libOverlay) closeLibrary(); });

  el.libList.addEventListener('click', e => {
    const delId = e.target.dataset.del;
    if (delId) { e.stopPropagation(); deleteFromLibrary(Number(delId)); return; }
    const item = e.target.closest('.lib-item');
    if (item) loadFromLibrary(Number(item.dataset.id));
  });
}

// ════════════════════════════════════════════════════════
//  INIT
// ════════════════════════════════════════════════════════

function init() {
  wire();
  setProvider('openai');
  setCompareProvider('anthropic');
  setMode('unstructured');
  populateExamples();
  updateStatusBar();
}

init();
