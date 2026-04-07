# Switchboard Explorer — Assignment Context

## Overview
A single-page LLM comparison tool. Send prompts to OpenAI and Anthropic models, compare responses side-by-side, and analyze structured JSON outputs against a user-defined schema.

## Stack
Vanilla HTML/CSS/JS — no frameworks, no bundlers, no npm. No ES modules (single script.js).

## Design
Terminal/code-editor dark theme with JetBrains Mono throughout. Split-panel layout (left: config, right: output). Status bar at bottom. Visually distinct from the frosted-glassmorphism reference.

## Core Requirements (all implemented)
1. **API Key Handling** — manual entry via modal or file upload (.env / .csv). In-memory only, never persisted.
2. **Provider & Model Selection** — OpenAI (gpt-4o, gpt-4o-mini, gpt-4-turbo) and Anthropic (claude-opus-4-5, claude-sonnet-4-5, claude-haiku-4-5).
3. **Dual Output Modes** — Free Text and JSON Schema (with structured output instructions to the model).
4. **Example Prompts & Schemas** — 4 free-text + 3 JSON schema examples, loaded via dropdown.

## Stretch Features (all implemented)
- **Side-by-Side Comparison** — ⇄ COMPARE button runs two models in parallel.
- **Response Metrics Dashboard** — response time (ms), token count, word count.
- **Prompt Library** — in-memory list; save/load/delete prompts via ⊞ library panel.
- **Structured Output Validator** — validates JSON response against user schema; shows ✅/❌/⚠/➕ per field.

## APIs
- OpenAI: `https://api.openai.com/v1/chat/completions`
- Anthropic: `https://api.anthropic.com/v1/messages` (requires `anthropic-dangerous-allow-browser: true` header for browser use)

## Security
API keys stored in `state.keys` object only. Never written to localStorage, sessionStorage, or cookies. Cleared on page close.
