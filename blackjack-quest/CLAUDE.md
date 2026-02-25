# Blackjack Quest

## Overview
A fully-featured browser Blackjack game with classic casino aesthetics.

## File Structure
- `index.html` — Layout: dealer area, player area, controls, stats panel
- `style.css` — Casino theme (green felt, gold accents), card flip animations, responsive
- `script.js` — All game logic, state machine, sound, stats, strategy hints

## Key Design Decisions
- Separate files (index.html / style.css / script.js) per project standards
- Web Audio API for sound (no external deps)
- CSS 3D transforms for card flip animations
- Fisher-Yates shuffle for fairness
- Hi-Lo card counting display (educational, toggleable)
- Three themes: Classic Casino, Modern Dark, Retro

## Game States
1. betting → 2. playing → 3. dealerTurn → 4. roundComplete → back to 1

## Keyboard Shortcuts
- H = Hit, S = Stand, D = Deal/Double Down, B = Increase Bet, M = Mute, U = Surrender

## Features Added
- **Achievements** — 12 unlockable badges (trophy wall via 🏆 button), persisted in localStorage
- **Daily Challenge** — seeded PRNG deck (same for everyone each day), personal best tracked in localStorage
- **Surrender** — forfeit half your bet; available only on initial 2-card hand before any action
- **Strategy Accuracy Tracker** — logs every decision vs. basic strategy, shows % in stats panel
- **Multi-deck Shoe** — 1/2/4/6/8 deck options (Settings); persistent shoe across rounds, cut card at ~75% penetration triggers reshuffle flag; Hi-Lo count + True Count persist across rounds; daily challenge stays 1-deck seeded
- **Card Back Picker** — 4 designs in Settings: Classic Navy (theme-aware), Crimson (red diagonal stripe ♥), Jade (green crosshatch ♦), Midnight (dark concentric circles ♣)
