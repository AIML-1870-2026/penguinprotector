# Science Explorer Generator — Assignment Context

## Overview
A single-page OpenAI-powered science experiment generator. Users select a grade level, enter available supplies, and receive a fully formatted AI-generated experiment plan. Built to spec from `sciencespec.md` in Downloads.

## Stack
Vanilla HTML/CSS/JS — no frameworks, no bundlers, no npm.
Separate files: `index.html`, `style.css`, `app.js`.

## API
- **OpenAI Chat Completions:** `https://api.openai.com/v1/chat/completions`
- **Models:** `gpt-4o-mini` (default), `gpt-4o`
- Key loaded from `.env` file via file picker — in-memory only, never persisted

## Key Patterns
- `parseKeyFile(text)` — parses `.env` (KEY=value) and `.csv` (provider,key) formats
- `fetch()` to OpenAI directly from browser (CORS allowed)
- Markdown rendered as HTML via marked.js CDN

## Features Implemented
- Grade level dropdown (K–2, 3–5, 6–8, 9–12)
- Multi-line supplies textarea with Quick-Add chip buttons + emoji icons
- Supply substitution — AI-powered alternative suggestion per supply
- Model selector (gpt-4o-mini / gpt-4o)
- Generate button disabled until grade + supplies filled
- Animated pulsing dots + skeleton loading state
- Difficulty badge (Beginner / Intermediate / Advanced) derived from grade
- Copy to Clipboard + Save to in-session History
- Collapsible history drawer (slide-in from right)

## Design
- Deep navy base (`#0f172a`) with teal accent (`#0d9488`)
- Two-column desktop, single-column mobile
- DM Sans Google Font
- Chips styled as pill tags with emoji icons

## FTC Compliance
For educational use only. AI-generated content must not be published as genuine consumer reviews.
