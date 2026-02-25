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
- H = Hit, S = Stand, D = Deal/Double Down, B = Increase Bet, M = Mute
