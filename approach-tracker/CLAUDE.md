# Approach Tracker — Assignment Context

## Overview
A single-page NEO (Near-Earth Object) dashboard with 5 tabs, built to spec from `earthspec.md`.
Mission-control dark aesthetic. All data live from NASA/JPL APIs — no hardcoded values.

## Stack
Vanilla HTML/CSS/JS — no frameworks, no bundlers, no npm.
ES modules via `<script type="module">`.
CDN libraries: `globe.gl`, `Chart.js`.

## APIs
- **NeoWs feed:** `https://api.nasa.gov/neo/rest/v1/feed`
  - Key stored as `NASA_API_KEY` const in `shared.js` (default: `DEMO_KEY`)
  - Max date range per request: 7 days (schedule tab fetches 5 weekly chunks)
- **JPL Sentry:** `https://ssd-api.jpl.nasa.gov/sentry.api` (no key needed)

## File Structure
```
index.html         ← markup + CDN script tags
style.css          ← full design system
shared.js          ← constants, shared state, fetchFeed, parseNeo, spinner
main.js            ← tab routing, refresh, boot
tabs/
  globe.js         ← globe.gl 3D earth, asteroid dots, click-to-select
  this-week.js     ← stat cards, sortable/filterable NEO table
  size-speed.js    ← size & velocity bar charts, distance panel
  schedule.js      ← 30-day timeline + calendar toggle
  impact-risk.js   ← JPL Sentry table, search, sort
```

## Tab Summary
| Tab | Key Feature |
|-----|-------------|
| 🌍 Globe | Interactive 3D Earth with asteroid dots color-coded by PHA status |
| 📅 This Week | Headline stat cards + sortable/filterable NEO table for current week |
| 📏 Size & Speed | Log-scale bar charts comparing asteroid to real-world references |
| 🗓️ Schedule | 30-day timeline + calendar grid view with click-to-expand days |
| ⚠️ Impact Risk | JPL Sentry watch list ranked by Palermo Scale |

## Design Tokens
- Background: `#0a0e1a`, Surface: `#111827`, Accent: `#00d4aa`, Amber: `#f59e0b`, Danger: `#ef4444`
- Fonts: Inter (body), JetBrains Mono (numbers/code)
