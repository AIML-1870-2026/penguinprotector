const express = require('express');
const path    = require('path');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── Provider config ──────────────────────────────────────
// Only providers with keys set will be returned to the client.

const PROVIDERS = {
  openai: {
    name: 'OpenAI',
    key:  process.env.OPENAI_API_KEY,
    models: [
      { id: 'gpt-4o-mini', label: 'gpt-4o-mini — Fast & Efficient' },
      { id: 'gpt-4o',      label: 'gpt-4o — Most Capable' },
    ],
  },
  anthropic: {
    name: 'Anthropic',
    key:  process.env.ANTHROPIC_API_KEY,
    models: [
      { id: 'claude-haiku-4-5-20251001', label: 'claude-haiku-4-5 — Fast & Efficient' },
      { id: 'claude-sonnet-4-6',         label: 'claude-sonnet-4-6 — Most Capable' },
    ],
  },
};

// ── GET /api/providers ───────────────────────────────────
// Returns only the providers that have API keys configured.

app.get('/api/providers', (req, res) => {
  const available = Object.entries(PROVIDERS)
    .filter(([, p]) => p.key)
    .map(([id, p]) => ({ id, name: p.name, models: p.models }));
  res.json(available);
});

// ── POST /api/generate ───────────────────────────────────

app.post('/api/generate', async (req, res) => {
  const { provider, model, grade, supplies } = req.body;

  if (!provider || !model || !grade || !supplies) {
    return res.status(400).json({ error: 'Missing required fields.' });
  }

  const pConfig = PROVIDERS[provider];
  if (!pConfig || !pConfig.key) {
    return res.status(400).json({ error: `Provider "${provider}" is not configured on this server.` });
  }

  const systemPrompt = `You are a creative science teacher who designs safe, engaging, grade-appropriate experiments. When given a grade level and a list of available supplies, you generate a complete experiment plan using only those materials. Format your response in markdown with clear sections: Experiment Title, Objective, Materials Needed, Step-by-Step Instructions, Expected Results, and a Discussion Question. Keep safety appropriate for the stated grade level.`;

  const userPrompt = `Grade Level: ${grade}\n\nAvailable Supplies:\n${supplies}\n\nPlease generate a science experiment using only the supplies listed above, appropriate for the selected grade level.`;

  try {
    let markdown;

    if (provider === 'openai') {
      const r = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${pConfig.key}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user',   content: userPrompt },
          ],
        }),
      });
      if (!r.ok) {
        const e = await r.json().catch(() => ({}));
        throw new Error(e.error?.message || `OpenAI error ${r.status}`);
      }
      const data = await r.json();
      markdown = data.choices[0].message.content;

    } else if (provider === 'anthropic') {
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type':      'application/json',
          'x-api-key':         pConfig.key,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model,
          max_tokens: 2048,
          system:   systemPrompt,
          messages: [{ role: 'user', content: userPrompt }],
        }),
      });
      if (!r.ok) {
        const e = await r.json().catch(() => ({}));
        throw new Error(e.error?.message || `Anthropic error ${r.status}`);
      }
      const data = await r.json();
      markdown = data.content[0].text;
    }

    res.json({ markdown });

  } catch (err) {
    res.status(500).json({ error: err.message || 'Generation failed.' });
  }
});

// ── POST /api/substitute ─────────────────────────────────

app.post('/api/substitute', async (req, res) => {
  const { provider, supply } = req.body;
  if (!supply) return res.status(400).json({ error: 'Missing supply.' });

  // Fall back to openai if requested provider isn't available
  const p = PROVIDERS[provider]?.key ? PROVIDERS[provider] : PROVIDERS.openai;
  const pid = PROVIDERS[provider]?.key ? provider : 'openai';
  if (!p?.key) return res.status(400).json({ error: 'No provider configured.' });

  try {
    let text;
    if (pid === 'openai') {
      const r = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${p.key}` },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          max_tokens: 200,
          messages: [
            { role: 'system', content: 'You are a helpful science teacher. Suggest 3–4 common household alternatives for the given supply. Respond with one brief sentence then a bulleted list only.' },
            { role: 'user',   content: `Alternatives to "${supply}" for science experiments?` },
          ],
        }),
      });
      const d = await r.json();
      text = d.choices[0].message.content;
    } else {
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': p.key, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 200,
          messages: [{ role: 'user', content: `Suggest 3–4 common household alternatives to "${supply}" for science experiments. One brief sentence then a bulleted list only.` }],
        }),
      });
      const d = await r.json();
      text = d.content[0].text;
    }
    res.json({ text });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Start ────────────────────────────────────────────────

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Science Explorer running on http://localhost:${PORT}`));
