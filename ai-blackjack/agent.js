'use strict';

// ── State ──────────────────────────────────────────────────────────────────────
// Keys live in memory only — never written to localStorage, cookies, etc.
const _keys = { anthropic: null, openai: null };

// ── Key Management ─────────────────────────────────────────────────────────────

// Parse a .env or CSV file for both ANTHROPIC_API_KEY and OPENAI_API_KEY.
// Returns { anthropic: string|null, openai: string|null }.
function parseEnvFile(text) {
  const found = { anthropic: null, openai: null };

  // .env format: KEY=value
  const envMatches = text.matchAll(/^([A-Z_]+)\s*=\s*(.+)$/gm);
  for (const [, k, v] of envMatches) {
    if (k.includes('ANTHROPIC')) found.anthropic = v.trim();
    if (k.includes('OPENAI'))    found.openai    = v.trim();
  }

  // CSV format: provider,key
  for (const line of text.split('\n').map(l => l.trim()).filter(Boolean)) {
    const [col0, col1] = line.split(',').map(s => s.trim());
    if (!col1) continue;
    if (col0.toLowerCase().includes('anthropic')) found.anthropic = col1;
    if (col0.toLowerCase().includes('openai'))    found.openai    = col1;
  }

  // Bare key fallback: single key on its own line
  if (!found.anthropic && !found.openai) {
    const bare = text.trim().replace(/\s+/g, '');
    if (bare.startsWith('sk-ant-') && bare.length > 20) found.anthropic = bare;
    else if (bare.startsWith('sk-')  && bare.length > 20) found.openai  = bare;
  }

  return found;
}

// Read a File object, store all found keys in memory.
// Resolves to a summary string of what was loaded.
function loadKeyFromFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      const found = parseEnvFile(e.target.result);
      let count = 0;
      if (found.anthropic) { _keys.anthropic = found.anthropic; count++; }
      if (found.openai)    { _keys.openai    = found.openai;    count++; }

      if (count === 0) {
        reject(new Error('No API keys found. Expected ANTHROPIC_API_KEY or OPENAI_API_KEY.'));
        return;
      }

      const parts = [];
      if (found.anthropic) parts.push('Anthropic (' + found.anthropic.slice(0,7) + '••••' + found.anthropic.slice(-4) + ')');
      if (found.openai)    parts.push('OpenAI ('    + found.openai.slice(0,7)    + '••••' + found.openai.slice(-4)    + ')');
      resolve(parts.join('  ·  '));
    };
    reader.onerror = () => reject(new Error('Failed to read file.'));
    reader.readAsText(file);
  });
}

function hasApiKey(provider) { return !!_keys[provider]; }
function hasAnyKey()         { return !!(_keys.anthropic || _keys.openai); }

// Store a raw key string pasted directly by the user.
// Auto-detects provider from prefix: sk-ant- → anthropic, sk- → openai.
// Returns a summary string on success, throws on unrecognised format.
function setKeyDirectly(raw) {
  const key = raw.trim().replace(/\s+/g, '');
  if (key.startsWith('sk-ant-') && key.length > 20) {
    _keys.anthropic = key;
    return 'anthropic';
  }
  if (key.startsWith('sk-') && key.length > 20) {
    _keys.openai = key;
    return 'openai';
  }
  throw new Error('Unrecognised key format. Expected sk-ant-… (Anthropic) or sk-… (OpenAI).');
}

// ── Prompt Construction ────────────────────────────────────────────────────────

function _systemPrompt() {
  return `You are an expert Blackjack strategy advisor. Analyze the game state and recommend the optimal action based on basic strategy, probability, and expected value.

CRITICAL REQUIREMENT: Respond ONLY with a single valid JSON object — no prose, no markdown fences, no explanation outside the JSON. The JSON must match this exact shape:

{
  "action": "stand",
  "confidence": 0.92,
  "brief_reason": "Hard 18 vs dealer 6 — dealer bust probability is high.",
  "full_analysis": "Your hard 18 is a strong hand. The dealer showing 6 is in a weak position, likely to bust. Standing maximizes EV here.",
  "basic_strategy_action": "stand"
}

Rules:
- action: must be one of the values in available_actions
- confidence: float 0.0–1.0
- brief_reason: one sentence
- full_analysis: 2–4 sentences of strategic reasoning
- basic_strategy_action: the pure basic strategy recommendation (may differ from action)`;
}

function _userMessage(gs) {
  const handStr  = gs.playerCards.map(c => `${c.rank}${c.suit}`).join(', ');
  const softStr  = gs.isSoft ? 'Soft' : 'Hard';
  const splitNote = gs.isAfterSplit ? '\nNote: This hand resulted from a split.' : '';
  return `Game state:
- Player hand: [${handStr}] → ${softStr} ${gs.playerTotal}
- Dealer up card: ${gs.dealerUpCard.rank}${gs.dealerUpCard.suit}
- Available actions: ${gs.availableActions.join(', ')}
- Current bet: $${gs.bet}
- Balance: $${gs.balance}${splitNote}

What is the optimal action?`;
}

// ── API Calls ──────────────────────────────────────────────────────────────────

async function _callAnthropic(key, model, gs) {
  console.log('[BJ Agent] Sending request to Anthropic API...');
  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key':                         key,
      'anthropic-version':                 '2023-06-01',
      'anthropic-dangerous-allow-browser': 'true',
      'Content-Type':                      'application/json',
    },
    body: JSON.stringify({
      model,
      system:      _systemPrompt(),
      messages:    [{ role: 'user', content: _userMessage(gs) }],
      max_tokens:  1024,
      temperature: 0,
    }),
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.error?.message || `Anthropic API error ${resp.status}`);
  }

  const data = await resp.json();
  console.log('[BJ Agent] Raw API response:', data);
  return data.content[0]?.text ?? '';
}

async function _callOpenAI(key, model, gs) {
  console.log('[BJ Agent] Sending request to OpenAI API...');
  const resp = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${key}`,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: _systemPrompt() },
        { role: 'user',   content: _userMessage(gs) },
      ],
      max_tokens:      1024,
      temperature:     0,
      response_format: { type: 'json_object' },
    }),
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.error?.message || `OpenAI API error ${resp.status}`);
  }

  const data = await resp.json();
  console.log('[BJ Agent] Raw API response:', data);
  return data.choices[0]?.message?.content ?? '';
}

// ── Main Entry Point ───────────────────────────────────────────────────────────

// Calls the selected provider's API and returns a parsed recommendation object.
// provider: 'anthropic' | 'openai'
async function askAgent(gameState, model, provider) {
  const key = _keys[provider];
  if (!key) throw new Error(`No ${provider} API key loaded. Please upload your .env file.`);

  // Required console logging
  const handStr = gameState.playerCards.map(c => `${c.rank}${c.suit}`).join(', ');
  const softStr = gameState.isSoft ? 'Soft' : 'Hard';
  console.log('[BJ Agent] --- New Hand ---');
  console.log(`[BJ Agent] Player hand: [${handStr}] → ${softStr} ${gameState.playerTotal}`);
  console.log(`[BJ Agent] Dealer up card: ${gameState.dealerUpCard.rank}${gameState.dealerUpCard.suit}`);
  console.log(`[BJ Agent] Available actions: ${gameState.availableActions.join(', ')}`);
  console.log(`[BJ Agent] Provider: ${provider}  Model: ${model}`);

  let rawText;
  try {
    rawText = provider === 'openai'
      ? await _callOpenAI(_keys.openai, model, gameState)
      : await _callAnthropic(_keys.anthropic, model, gameState);
  } catch (err) {
    console.error('[BJ Agent] API error:', err.message);
    throw err;
  }

  const parsed = _extractJSON(rawText);

  // Validate action is available
  if (!gameState.availableActions.includes(parsed.action)) {
    console.warn(`[BJ Agent] Action "${parsed.action}" not available — falling back`);
    parsed.action = gameState.availableActions.includes('stand')
      ? 'stand' : gameState.availableActions[0];
  }

  console.log(`[BJ Agent] Parsed action: "${parsed.action}"  confidence: ${parsed.confidence}`);
  console.log(`[BJ Agent] Executing action: ${parsed.action.toUpperCase()}`);
  return parsed;
}

// Strip markdown code fences if present, then parse JSON.
function _extractJSON(text) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw    = fenced ? fenced[1].trim() : text.trim();
  try {
    return JSON.parse(raw);
  } catch {
    const m = raw.match(/\{[\s\S]*\}/);
    if (m) return JSON.parse(m[0]);
    throw new Error('Agent response could not be parsed as JSON: ' + text.slice(0, 200));
  }
}
