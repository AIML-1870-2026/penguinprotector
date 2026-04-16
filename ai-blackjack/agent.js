'use strict';

// ── State ──────────────────────────────────────────────────────────────────────
// API key lives in memory only — never written to localStorage, cookies, etc.
let _apiKey = null;

// ── Key Management ─────────────────────────────────────────────────────────────

// Parse a .env or plain-text file for ANTHROPIC_API_KEY.
// Supports: KEY=value, provider,key (CSV), or bare key string.
function parseEnvFile(text) {
  // .env format: ANTHROPIC_API_KEY=sk-ant-...
  const envMatches = text.matchAll(/^([A-Z_]+)\s*=\s*(.+)$/gm);
  for (const [, k, v] of envMatches) {
    if (k.includes('ANTHROPIC')) return v.trim();
  }

  // CSV format: anthropic,sk-ant-...
  for (const line of text.split('\n').map(l => l.trim()).filter(Boolean)) {
    const [col0, col1] = line.split(',').map(s => s.trim());
    if (col1 && col0.toLowerCase().includes('anthropic')) return col1;
  }

  // Bare key fallback: entire file is the key
  const bare = text.trim().replace(/\s+/g, '');
  if (bare.startsWith('sk-ant-') && bare.length > 20) return bare;

  return null;
}

// Read a File object, extract the key, store in memory.
// Returns a Promise that resolves to the masked key string.
function loadKeyFromFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      const key = parseEnvFile(e.target.result);
      if (key) {
        _apiKey = key;
        const masked = key.slice(0, 7) + '••••••' + key.slice(-4);
        resolve(masked);
      } else {
        reject(new Error(
          'No ANTHROPIC_API_KEY found. Expected format: ANTHROPIC_API_KEY=sk-ant-...'
        ));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file.'));
    reader.readAsText(file);
  });
}

function hasApiKey()  { return !!_apiKey; }
function clearApiKey() { _apiKey = null; }

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
  const handStr = gs.playerCards.map(c => `${c.rank}${c.suit}`).join(', ');
  const softStr = gs.isSoft ? 'Soft' : 'Hard';
  const splitNote = gs.isAfterSplit ? '\nNote: This hand resulted from a split.' : '';
  return `Game state:
- Player hand: [${handStr}] → ${softStr} ${gs.playerTotal}
- Dealer up card: ${gs.dealerUpCard.rank}${gs.dealerUpCard.suit}
- Available actions: ${gs.availableActions.join(', ')}
- Current bet: $${gs.bet}
- Balance: $${gs.balance}${splitNote}

What is the optimal action?`;
}

// ── API Call ───────────────────────────────────────────────────────────────────

// Calls the Anthropic Messages API and returns a parsed recommendation object.
// Logs the full request/response cycle to the browser console per spec.
async function askAgent(gameState, model) {
  if (!_apiKey) throw new Error('No API key loaded. Please upload your .env file.');

  // ── Required console logging ─────────────────────────────────────────────────
  const handStr = gameState.playerCards.map(c => `${c.rank}${c.suit}`).join(', ');
  const softStr = gameState.isSoft ? 'Soft' : 'Hard';
  console.log('[BJ Agent] --- New Hand ---');
  console.log(`[BJ Agent] Player hand: [${handStr}] → ${softStr} ${gameState.playerTotal}`);
  console.log(`[BJ Agent] Dealer up card: ${gameState.dealerUpCard.rank}${gameState.dealerUpCard.suit}`);
  console.log(`[BJ Agent] Available actions: ${gameState.availableActions.join(', ')}`);
  console.log('[BJ Agent] Sending request to Anthropic API...');

  const body = {
    model,
    system:     _systemPrompt(),
    messages:   [{ role: 'user', content: _userMessage(gameState) }],
    max_tokens: 1024,
    temperature: 0,  // deterministic for strategy consistency
  };

  // Exact fetch() structure adapted from switchboard-explorer reference
  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key':                       _apiKey,
      'anthropic-version':               '2023-06-01',
      'anthropic-dangerous-allow-browser': 'true',
      'Content-Type':                    'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    const msg = err.error?.message || `Anthropic API error ${resp.status}`;
    console.error('[BJ Agent] API error:', msg);
    throw new Error(msg);
  }

  const data = await resp.json();
  console.log('[BJ Agent] Raw API response:', data);

  const rawText = data.content[0]?.text ?? '';
  const parsed  = _extractJSON(rawText);

  // Validate that the recommended action is actually available
  if (!gameState.availableActions.includes(parsed.action)) {
    console.warn(`[BJ Agent] Action "${parsed.action}" not in available actions — falling back to "stand"`);
    parsed.action = gameState.availableActions.includes('stand') ? 'stand' : gameState.availableActions[0];
  }

  console.log(`[BJ Agent] Parsed action: "${parsed.action}"  confidence: ${parsed.confidence}`);
  console.log(`[BJ Agent] Executing action: ${parsed.action.toUpperCase()}`);

  return parsed;
}

// Strip markdown code fences if the model wrapped the JSON, then parse.
function _extractJSON(text) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw    = fenced ? fenced[1].trim() : text.trim();
  try {
    return JSON.parse(raw);
  } catch {
    // Last resort: grab the first {...} block
    const m = raw.match(/\{[\s\S]*\}/);
    if (m) return JSON.parse(m[0]);
    throw new Error('Agent response could not be parsed as JSON: ' + text.slice(0, 200));
  }
}
