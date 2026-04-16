# AI Blackjack — Assignment Context

## Overview
A fully playable Blackjack game powered by an LLM AI agent (Claude). The agent observes
the game state, calls the Anthropic API for a strategic recommendation, and can automatically
execute that recommendation. Built to spec from `cardspec.md`.

## Stack
Vanilla HTML/CSS/JS — no backend, no build tools, no npm.
Split across: `index.html`, `style.css`, `game.js`, `agent.js`, `ui.js`.

## API
- **Anthropic Messages API:** `https://api.anthropic.com/v1/messages`
- Key loaded in-memory only from `.env` file upload (`ANTHROPIC_API_KEY=sk-ant-...`)
- Never stored in localStorage, sessionStorage, or cookies

## File Structure
```
index.html        ← markup + CDN fonts
style.css         ← full design system (premium dark casino)
game.js           ← Blackjack engine: deck, deal, score, payouts, basicStrategy
agent.js          ← LLM integration: .env parsing, fetch, JSON extraction
ui.js             ← orchestrator: DOM, animations, strategy matrix, analytics
README.md         ← setup + testing notes
temp/             ← reference implementation (NOT deployed)
  reference.html
```

## Design Tokens
- Background: radial deep navy → near-black
- Surface: `#0d1a2e`, Cards: `#111827`
- Gold accent: `#d4af37`, Green: `#22c55e`, Red: `#ef4444`, Amber: `#f59e0b`
- Fonts: Inter (body), JetBrains Mono (numbers)

## AI Response Shape (Structured JSON)
```json
{
  "action": "stand",
  "confidence": 0.92,
  "brief_reason": "Hard 18 vs dealer 6 — dealer bust probability is high.",
  "full_analysis": "Your hard 18 is a strong hand...",
  "basic_strategy_action": "stand"
}
```

## Stretch Features (Both Required)
- **Stretch 1:** Basic Strategy Matrix with current-hand highlight + AI vs basic strategy badge
- **Stretch 2:** Session Analytics Dashboard (hands, win rate, bankroll SVG sparkline, action breakdown)
