# Color Quest: RGB Color Studio

## Overview
Interactive RGB Color Studio with two integrated tools:
- **Animated Color Explorer** - Draggable RGB spotlights with additive blending and particles
- **Palette Generator** - Harmony-based palette generation with color wheel visualization

## File Structure
- `index.html` - Main page layout (dual-panel: explorer | palette)
- `style.css` - Dark theme styling with rainbow accents
- `color-utils.js` - HSL/RGB conversion, color naming, WCAG contrast
- `explorer.js` - Canvas spotlight rendering, dragging, particles, blending
- `palette.js` - Harmony algorithms, swatches, color wheel, sample UI card
- `accessibility.js` - Contrast checker, color blindness simulator, accessible mode
- `main.js` - Shared state management, UI wiring, integration

## Key Colors
- Background: `#0f0f14`
- Panels: `#1a1a24`
- Red spotlight: `#ff0000`
- Green spotlight: `#00ff00`
- Blue spotlight: `#0000ff`

## Color Harmony Algorithms (HSL-based)
- Complementary: base hue + 180
- Analogous: base hue +/- 30, +/- 60
- Triadic: base hue + 120, + 240
- Split-Complementary: base hue + 150, + 210
