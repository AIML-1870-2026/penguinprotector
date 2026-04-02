# Drug Safety Explorer — Assignment Context

## Overview
An interactive single-page tool querying the **OpenFDA API** for drug safety information.
Users compare two drugs side-by-side across three data types: labeling, adverse events, FAERS, recalls.

## Stack
Vanilla HTML/CSS/JS — no frameworks, no bundlers, no npm.
ES modules via `<script type="module">`.
CDN library: `Chart.js` (adverse event bar charts).

## API Endpoints (OpenFDA, no key required)
- **Labels:** `https://api.fda.gov/drug/label.json`
- **Adverse Events (FAERS):** `https://api.fda.gov/drug/event.json`
- **Recalls:** `https://api.fda.gov/drug/enforcement.json`

## File Structure
```
index.html        ← markup, disclaimer banner, drug inputs, tab shell, footer
style.css         ← design system (light theme, teal/purple drug accents)
main.js           ← input handling, autocomplete, tab routing, shared state
api.js            ← all OpenFDA fetch functions and error handling
tabs/
  interactions.js ← Tab 1: FDA label drug_interactions + co-admin callout
  adverse.js      ← Tab 2: FAERS horizontal bar charts (Chart.js)
  recalls.js      ← Tab 3: recall timeline with Class I/II/III badges
help.js           ← modal system and all 6 help popup contents
```

## Design Tokens
- Background: `#f8fafc`, Surface: `#ffffff`, Border: `#e2e8f0`
- Drug A accent: `#0d9488` (teal), Drug B accent: `#7c3aed` (purple)
- Danger: `#dc2626`, Warning: `#d97706`, Muted: `#94a3b8`
- Disclaimer bg: `#fefce8` (soft yellow)

## Key Behaviors
- Pre-populated with Warfarin + Ibuprofen on load
- Autocomplete: queries label endpoint after 3 chars, 300ms debounce
- Staggered reveal: show each tab's data as it arrives
- Skeleton shimmer while fetching
