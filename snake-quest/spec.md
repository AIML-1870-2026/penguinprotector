# Neon Rave Snake Game - Specification

## Overview
A cyberpunk/rave-themed snake game with progressive difficulty, dynamic music, power-ups, and persistent leaderboards. The visual style features neon colors, particle effects, and a pulsing grid that syncs with house/EDM music.

## Core Gameplay

### Controls
- **Movement**: Arrow keys OR WASD
- **Pause**: Spacebar
- Snake cannot reverse direction (can't go directly backwards)

### Basic Mechanics
- Snake grows by eating food
- Game ends on collision with walls, obstacles, or self
- Score increases with each food eaten
- Progressive difficulty - speed and obstacles increase over time

## Visual Style - Rave/Cyberpunk Theme

### Color Palette (by stage)
- **Stage 1 (0-50 pts)**: Blue (#00f3ff) and purple (#b300ff) - cool vibes
- **Stage 2 (50-150 pts)**: Pink (#ff006e) and cyan (#00f5ff) - warming up
- **Stage 3 (150-300 pts)**: Hot pink (#ff0080) and electric green (#00ff41) - peak energy
- **Stage 4 (300+ pts)**: Multi-color strobing/cycling - rave chaos

### Visual Effects
- Dark background (#0a0a0a or similar)
- Glowing neon grid
- Snake has glow/bloom effect
- Snake leaves a fading trail
- Particle burst effects when eating food (confetti/light explosion)
- Grid pulses with the beat (optional: sync with music)
- Smooth animations and transitions

## Progressive Difficulty System

### Stage Progression
- **Stage 1**: 0-50 points - Slow, minimal obstacles
- **Stage 2**: 50-150 points - Moderate speed, more obstacles
- **Stage 3**: 150-300 points - Fast, frequent obstacles
- **Stage 4**: 300+ points - Very fast, maximum obstacles

### Difficulty Scaling
- Snake speed increases every 25-50 points
- Obstacle spawn rate increases with each stage
- Obstacles appear randomly on the grid (not on snake or food)
- Visual indicator: Quick popup when entering new stage ("STAGE 2" with neon glow, fades quickly)

## Power-ups & Special Abilities

### Power-up Types (spawn randomly, consistent rate across all stages)
1. **Speed Boost**: Temporary speed increase (5 seconds)
2. **Invincibility**: Ghost mode - phase through obstacles/walls (3 seconds)
3. **Magnet**: Attracts nearby food (5 seconds)
4. **Score Multiplier**: 2x points (10 seconds)
5. **Slow-Mo**: Reduces speed temporarily (5 seconds)

### Special Abilities (on cooldown, activated by player)
- **Dash/Teleport**: Move through obstacles once (cooldown: 10 seconds, press 'E' or 'Shift')
- Consider: 180° emergency turn, shield

### Visual Indicators
- Active power-ups shown with icons and timers
- Glow effect on snake when power-up is active
- Cooldown timer for special abilities

## Obstacles
- Random walls/barriers spawn as difficulty increases
- Obstacles are static once placed
- Clear visual distinction from food and snake
- Never spawn on snake, food, or power-ups

## Music System

### Dynamic Music (copyright-free house/EDM tracks)
- Music changes based on score/stage
- **Stage 1**: Warm-up beat, minimal bass, slower BPM (~110-120 BPM)
- **Stage 2**: Beat builds, add synths, tempo increases (~120-128 BPM)
- **Stage 3**: Full drop, heavy bass, peak energy (~128-135 BPM)
- **Stage 4**: Intense, layered, occasional breakdowns (~135+ BPM)

### Music Implementation
- Smooth transitions between stage tracks
- Volume control option
- Mute option

## Leaderboard & Scoring

### Persistent Leaderboard
- Save top 10 scores locally (browser localStorage)
- Each entry: player name, score, date
- Display in a neon-styled popup or side panel
- Highlight personal best in different color

### High Score Entry
- When player achieves top 10 score:
  - Game pauses
  - Popup: "NEW HIGH SCORE! Enter your name:"
  - Input field with neon styling
  - Shows updated leaderboard after entry

### Scoring System
- Base points per food eaten
- Bonus points from score multiplier power-up
- Track longest snake length
- Track survival time

## Achievements/Unlockables

### Achievement Ideas
- "First Drop" - Reach 100 points
- "All Night Long" - Survive 5 minutes
- "Bass Boost" - Collect 10 power-ups in one game
- "Rave Legend" - Reach top of leaderboard
- "Stage Diver" - Reach Stage 4
- "Marathon Raver" - Snake length reaches 50+
- "Perfectionist" - Reach 200 points without using power-ups

### Unlockables
- Different snake skins (glow patterns, trail colors)
- Different color schemes
- New music tracks
- Display achievements in a dedicated menu

## UI/UX

### HUD Elements
- Current score (top left)
- High score (top left, below current)
- Current stage indicator
- Active power-ups with timers
- Special ability cooldown

### Menus
- **Start Screen**: Title, "Press SPACE to start", leaderboard preview
- **Pause Menu**: Resume, restart, view leaderboard, settings (volume/mute)
- **Game Over Screen**: Final score, high score status, "Press SPACE to restart"
- **Leaderboard View**: Full top 10 with names, scores, dates

### Smooth UX
- Instant restart (no loading)
- Responsive controls (no input lag)
- Clear visual feedback for all actions
- Smooth animations

## Technical Requirements

### Technology Stack
- HTML5 Canvas for rendering
- Vanilla JavaScript
- CSS for UI styling
- localStorage for persistent data
- Audio API for music playback

### Performance
- 60 FPS target
- Smooth animations
- No noticeable lag
- Efficient collision detection
- Optimized particle effects

### File Structure
```
snake-quest/
├── index.html (structure only - canvas, UI containers)
├── styles.css (all styling - neon effects, animations, UI)
├── script.js (all game logic - snake, food, obstacles, audio, leaderboard, UI)
└── spec.md (this specification document)
```

### Code Organization in script.js
Organize code with clear sections/comments:
1. Constants and configuration
2. Game state variables
3. Snake class/logic
4. Food and power-up logic
5. Obstacle spawning and management
6. Collision detection
7. Rendering and visual effects
8. Audio/music management
9. Leaderboard and localStorage
10. Achievement system
11. UI and menu logic
12. Input handling
13. Game loop and initialization

## Development Phases

### Phase 1: Core Game Mechanics
- [x] Basic snake movement (arrow keys + WASD)
- [x] Food spawning and eating
- [x] Collision detection (walls, self)
- [x] Score tracking
- [x] Game over logic

### Phase 2: Neon Visual Style
- [x] Dark background with neon grid
- [x] Glowing snake with trail effect
- [x] Neon color palette implementation
- [x] Particle effects for eating food
- [x] Smooth animations

### Phase 3: Progressive Difficulty
- [x] Speed scaling system
- [x] Stage progression (1-4)
- [x] Stage transition popups
- [x] Random obstacle spawning
- [x] Difficulty curve tuning

### Phase 4: Power-ups & Abilities
- [x] Power-up types implementation
- [x] Power-up spawn system
- [x] Special ability (dash/teleport)
- [x] Visual indicators and timers
- [x] Cooldown system

### Phase 5: Music & Audio
- [x] Procedural house/EDM music via Web Audio API
- [x] Music stage transitions
- [x] Volume controls
- [x] Sound effects for eating, power-ups, collisions

### Phase 6: Leaderboard & Persistence
- [x] localStorage implementation
- [x] Top 10 score tracking
- [x] High score name entry popup
- [x] Leaderboard display
- [x] Personal best highlighting

### Phase 7: Achievements & Polish
- [x] Achievement system
- [x] Achievement notifications
- [x] Pause menu
- [x] Settings menu
- [x] Final visual polish

## Success Criteria
- Smooth, responsive gameplay at 60 FPS
- Clear visual distinction between game elements
- Intuitive controls and UI
- Satisfying progression and difficulty curve
- Music enhances the rave atmosphere
- Leaderboard persists across sessions
- Fun and replayable

## Implementation Notes

### Music System
- Uses Web Audio API for procedural music generation
- No external audio files needed (no copyright issues)
- Procedural kick, hi-hat, snare, bass, and synth per stage
- BPM and complexity increase with each stage

### Credits
**Course:** AIML-1870
**Date:** January 2026
