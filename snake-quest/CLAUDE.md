# snake-quest

## Overview
A cyberpunk/rave-themed snake game with progressive difficulty, dynamic procedural music, power-ups, persistent leaderboards, and achievements. Built with HTML5 Canvas and Web Audio API.

## Structure
- `index.html` - Page structure: canvas, menus, HUD overlays
- `styles.css` - All styling: neon effects, animations, responsive layout
- `script.js` - All game logic: snake, food, obstacles, audio, leaderboard, achievements
- `spec.md` - Full project specification

## Live URL
https://aiml-1870-2026.github.io/penguinprotector/snake-quest/

## Key Features
- Arrow keys / WASD controls, Space to pause
- 4-stage progressive difficulty (speed + obstacles scale with score)
- 5 power-up types: Speed Boost, Invincibility, Magnet, Score Multiplier, Slow-Mo
- Dash/Teleport special ability (E or Shift, 10s cooldown)
- Procedural house/EDM music that evolves per stage (Web Audio API)
- Persistent top-10 leaderboard (localStorage)
- 7 achievements with unlock notifications
- Particle effects, neon glow, pulsing grid, snake trails

## Tech Stack
- Vanilla JavaScript (no frameworks)
- HTML5 Canvas 2D rendering
- Web Audio API for procedural music and SFX
- CSS3 for UI styling with neon effects
- localStorage for persistence

## Controls
- Arrow keys / WASD: Move snake
- Space: Pause / Start
- E / Shift: Dash ability

## Notes
- Multi-file project (HTML + CSS + JS)
- Refer to `spec.md` for full specification and design details
