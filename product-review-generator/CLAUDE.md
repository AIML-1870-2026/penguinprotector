# Product Review Generator — Assignment Context

## Overview
A single-page OpenAI-powered product review generator. Users configure a product, tune sentiment and style sliders, and receive a formatted AI-generated review. Built entirely to spec from `reviewspec.md`.

## Stack
Vanilla HTML/CSS/JS — no frameworks, no bundlers, no npm.
Separate files: `index.html`, `style.css`, `script.js`.

## API
- **OpenAI Chat Completions:** `https://api.openai.com/v1/chat/completions`
- **OpenAI Models List:** `https://api.openai.com/v1/models` (fetched dynamically, cached in-memory)
- Key loaded from `.env` file or manual entry — in-memory only, never persisted

## Key Patterns (from switchboard-explorer reference)
- `parseKeyFile(text)` — parses `.env` (KEY=value) and `.csv` (provider,key) formats
- `fetch()` to OpenAI directly from browser (CORS allowed; Anthropic is not)
- Markdown rendered as HTML via marked.js CDN

## Stretch Features Implemented
- **Aspect Sentiment Sliders** — separate Price/Value, Features, and Usability sliders incorporated into the prompt
- **Rich UI Sliders** — Length and Style are sliders, not dropdowns

## FTC Compliance
This tool is for educational/development use only. AI-generated reviews must not be published as genuine consumer reviews (FTC rule effective Oct 21, 2024, fines up to $51,744/violation).
