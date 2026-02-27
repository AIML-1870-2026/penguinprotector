# Rat Race — Endless Runner

## Overview
City rooftop endless runner. You play as a rat sprinting across rooftops,
jumping over hazards, and surviving as long as possible.

## File Structure
- `index.html` — Canvas shell, screen overlays (start / game-over / leaderboard), HUD
- `style.css` — Dark theme, screen/HUD layout, button styles
- `script.js` — Full game engine: physics, chunks, rendering, audio, ghost

## Architecture
- All game logic in `script.js` — no external libs or image files
- Canvas 800×400 logical, scaled to window via CSS
- All world coords: player.x = scrollX + 150 (fixed screen position 150)
- Render: convert world → screen with `worldX - gs.scrollX`

## Key Constants (script.js)
- `GROUND_Y = 320` — y coordinate of the rooftop surface
- `BASE_SPEED = 4` — initial scroll speed (px/frame)
- `COYOTE_TIME = 80ms`, `JUMP_BUFFER = 100ms`

## Game Systems
- **Chunk system** — 11 hand-crafted obstacle patterns, weighted by difficulty
- **Parallax** — 3 building layers (far/mid/near) loop infinitely
- **Time of Day** — 6 phases (Sunset → Day) cycling every 60s each, sky gradient
- **Zone progression** — 4 zones (Downtown/Industrial/Neon/Skyline) by distance
- **Ghost racing** — best run replayed alongside player, stored in localStorage
- **Scoring** — distance × speed multiplier, saved to leaderboard (top 5)

## Controls
- Space / W / ↑ = Jump (hold for higher, double-tap for double jump)
- S / ↓ = Slide
- Touch: tap = jump, swipe down = slide

## localStorage Keys
- `rr_muted` — mute state
- `rr_highscore` — all-time best score
- `rr_leaderboard` — JSON array of top 5 {score, date}
- `rr_ghost` — JSON array of ghost frames
- `rr_ghost_score` — score of saved ghost run
