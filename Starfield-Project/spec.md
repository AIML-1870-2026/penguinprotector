# Starfield Particle System - Project Specification

## Project Overview

A colorful, interactive rave-themed starfield particle system built with HTML5 Canvas. Features dynamic rainbow-colored stars that cycle through the color spectrum, creating a hypnotic visual experience with multiple effect modes and real-time controls.

**Live Demo:** https://reesestowe.github.io/starfield-quest/

**Repository:** https://github.com/reesestowe/starfield-quest

## Features & Requirements

### Core Features

1. **Rainbow Starfield**
   - Stars rendered as 5-pointed star shapes (not circles)
   - Each star cycles through HSL color spectrum (hue 0-360)
   - Stars move toward viewer in 3D perspective
   - Configurable particle count, speed, size, and spread

2. **Visual Effects**
   - Motion blur trails with configurable length
   - Bloom/glow effect for closer stars
   - Background ambient particles that drift slowly

3. **Interactive Effect Modes** (Toggle switches)
   - **Kaleidoscope Mode:** 4-quadrant mirrored symmetry
   - **Chromatic Aberration:** RGB channel splitting for glitch effect
   - **Mouse Reactive:** Stars warp toward cursor position
   - **Rotation Mode:** Entire starfield slowly rotates

4. **Real-time Controls** (Sliders)
   - Star Count: 50-500 stars
   - Speed: 0.5-10x
   - Trail Length: 1-15 frames
   - Star Size: 1-5x
   - Spread: 0.5-3x (field of view)
   - Bloom Intensity: 1-8x (glow size)

### User Experience

- All controls visible in fixed bottom bar
- Controls positioned outside animation area to prevent obstruction
- Responsive to window resize
- Touch support for mobile devices
- Smooth mouse tracking with easing

## Technical Specifications

### Architecture

**Single-page Application**
- Pure vanilla JavaScript (no frameworks)
- HTML5 Canvas 2D rendering context
- Class-based object-oriented design
- Real-time animation loop using requestAnimationFrame

### Key Classes

1. **Star Class**
   - Properties: x, y, z (3D position), hue, prevX, prevY
   - Methods: reset(), update(), draw()
   - Color cycling: hue += 2 per frame
   - 3D to 2D projection: `screenX = (x / z) * width * spread`

2. **BackgroundParticle Class**
   - Slow drifting ambient particles
   - Random velocities and colors
   - Wraps around screen edges

### Rendering Pipeline

1. **Trail Effect:** Semi-transparent black overlay (alpha = 1/trailLength)
2. **Background Particles:** Drawn first (behind stars)
3. **Effect Modes:**
   - **Normal Mode:** Direct star rendering
   - **Kaleidoscope Mode:** Render to quarter canvas, mirror to 4 quadrants
4. **Star Rendering:**
   - Draw motion trail (line from previous position)
   - Draw star shape (5-pointed using trigonometry)
   - Draw bloom glow (radial gradient) for close stars
5. **Chromatic Aberration:** RGB split with offset stars

### Color System

**HSL Color Space**
- Hue: 0-360 (full rainbow spectrum, cycles continuously)
- Saturation: 100% (fully vibrant)
- Lightness: 60% (balanced brightness)

**UI Colors**
- Background: Deep purple `#0a0015`
- Controls: Black background `rgba(0, 0, 0, 0.95)`
- Accent: Neon pink/cyan gradient
- Border: Magenta `#ff00ff`
- Glow effects: Cyan `#00ffff`

### Performance Considerations

- Efficient particle system (200 stars default)
- Canvas clearing optimized with trail effect
- Mouse position smoothing to reduce jitter
- Minimal DOM manipulation (event listeners only)

## File Structure

```
Starfield-Project/
├── index.html          # Complete application (HTML + CSS + JS)
├── spec.md            # This specification document
└── README.md          # (Future) Project documentation
```

### Code Organization (within index.html)

1. **HTML Structure** (lines 1-237)
   - Canvas element
   - Controls container with sliders and toggles

2. **CSS Styles** (lines 7-162)
   - Layout and positioning
   - Control styling
   - Animations (rainbow gradient)

3. **JavaScript** (lines 239-646)
   - Configuration object
   - Helper functions (drawStar)
   - Class definitions (Star, BackgroundParticle)
   - Animation loop
   - Event handlers
   - Initialization

## Color Palette & Typography

### Color Palette

**Primary Colors:**
- Deep Purple: `#0a0015` (background)
- Royal Blue (hue 240): Primary star color in cycle
- Magenta: `#ff00ff` (accent, borders)
- Cyan: `#00ffff` (accent, value displays)

**Rainbow Spectrum:**
- Red (hue 0)
- Orange (hue 30)
- Yellow (hue 60)
- Green (hue 120)
- Cyan (hue 180)
- Blue (hue 240)
- Magenta (hue 300)

**UI Gradients:**
- Slider thumbs: `linear-gradient(135deg, #ff00ff, #00ffff)`
- Active toggles: `linear-gradient(135deg, #ff00ff, #00ffff)`
- Title text: `linear-gradient(90deg, #ff00ff, #00ffff, #ff00ff)`

### Typography

- Font Family: Arial, sans-serif
- Title: 16px, gradient animated
- Labels: 12px, white
- Values: Cyan with glow effect

## Development Notes

### Implementation Journey

1. **Initial Request:** Transform white starfield to colorful rave theme
2. **Star Shapes:** Changed from circles to 5-pointed stars using trigonometry
3. **Effect Modes:** Added kaleidoscope, chromatic aberration, rotation
4. **Bloom Control:** Variable intensity glow for visual impact
5. **UI Layout:** Fixed bottom bar to prevent animation obstruction

### Key Technical Decisions

**Why 5-pointed stars?**
- More visually interesting than circles
- Reinforces "starfield" theme
- Creates more dynamic light patterns with bloom

**Why HSL over RGB?**
- Easy color cycling by incrementing hue
- Consistent saturation and brightness
- Full spectrum coverage

**Why single HTML file?**
- Easy deployment (no build process)
- Self-contained for sharing
- Minimal dependencies

**Why kaleidoscope uses quarter canvas?**
- Enables 4-quadrant mirroring
- Uses canvas transforms (scale, translate)
- Creates symmetrical mandala effect

### Math & Algorithms

**5-Pointed Star Drawing:**
```javascript
// 10 points total: 5 outer, 5 inner
// Rotate by 72° (360° / 5) for each point
// Alternate between outer and inner radius
const step = Math.PI / spikes;  // Half angle between points
for (let i = 0; i < spikes; i++) {
    // Outer point
    x = cx + Math.cos(rot) * outerRadius;
    y = cy + Math.sin(rot) * outerRadius;
    // Inner point
    x = cx + Math.cos(rot + step) * innerRadius;
    y = cy + Math.sin(rot + step) * innerRadius;
}
```

**3D Projection:**
```javascript
// Perspective divide
screenX = (x / z) * canvasWidth * spread;
screenY = (y / z) * canvasHeight * spread;
// Center on screen
screenX += canvasWidth / 2;
screenY += canvasHeight / 2;
```

**Mouse Reactive Force:**
```javascript
// Calculate distance from star to mouse
distance = sqrt(dx² + dy²);
// Apply inverse force (closer = stronger)
force = (1 - distance / maxDistance) * 50;
// Adjust by depth (closer stars more reactive)
force *= (1 - z / canvasWidth);
```

### Known Behaviors

- Kaleidoscope mode creates quarter canvas each frame (performance impact)
- Chromatic aberration renders 3x stars (red, green, blue channels)
- Mouse reactive can create interesting clustering effects
- Very high star counts (500+) may reduce framerate on slower devices

### Future Enhancement Ideas

- Particle explosion on click
- Beat-reactive mode (Web Audio API)
- Color scheme presets (not just rainbow)
- Turbulence/noise field for organic motion
- Save/load configuration presets
- Screenshot/recording capability

## Git & Deployment

### Repository Setup

```bash
git init
git add index.html
git commit -m "Initial commit: Colorful rave starfield"
git remote add origin https://github.com/reesestowe/starfield-quest.git
git push -u origin main
```

### GitHub Pages Deployment

```bash
# Enable GitHub Pages via API
gh api repos/reesestowe/starfield-quest/pages \
  -X POST \
  -F source[branch]=main \
  -F source[path]=/
```

**Deployment URL:** https://reesestowe.github.io/starfield-quest/

### Commit History Highlights

1. Colorful rave theme implementation
2. Added background particles and kaleidoscope mode
3. Added rotation mode and bloom control
4. Changed stars from dots to 5-pointed shapes
5. Final deployment

## Browser Compatibility

**Tested & Working:**
- Chrome/Edge (Chromium)
- Firefox
- Safari (WebKit)

**Requirements:**
- HTML5 Canvas support
- CSS3 transforms and gradients
- ES6 JavaScript (classes, arrow functions)
- requestAnimationFrame API

**Mobile Support:**
- Touch events for mouse reactive mode
- Responsive canvas sizing
- Performance may vary on older devices

## Credits

**Created by:** Reese Stowe
**AI Assistant:** Claude Sonnet 4.5
**Date:** January 2026
**Course:** AIML-1870

---

*"In the depths of space, colors dance and stars sing the song of the cosmos."*
