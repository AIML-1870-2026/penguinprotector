# Color Quest: RGB Color Studio

## Assignment Overview
Interactive RGB Color Studio built from the readablespec.md specification.
Demonstrates RGB additive color mixing, harmony-based palette generation, and WCAG accessibility tools.

## File Structure
- `index.html` — Main page with dual-panel layout (Explorer | Palette)
- `style.css` — Dark theme styling with rainbow accents, responsive
- `color-utils.js` — HSL/RGB/CMYK conversion, color naming, WCAG contrast, shade scale, color blindness matrices
- `explorer.js` — Canvas spotlight rendering, drag-to-move, scroll-to-resize, particles, additive blending
- `palette.js` — Harmony algorithms, swatch rendering, color wheel canvas, shade/tint scale, palette comparison, UI preview
- `accessibility.js` — Contrast checker, color blindness simulator, accessible palette mode
- `main.js` — Shared `colorState` object, UI wiring, two-way sync between Explorer and Palette

## Key Colors
- Background: `#0f0f14`
- Panels: `#1a1a24`
- Red spotlight: `#ff0000`
- Green spotlight: `#00ff00`
- Blue spotlight: `#0000ff`

## Color Harmony Algorithms (HSL-based)
- Complementary: base hue + 180°
- Analogous: base hue ± 30°, ± 60°
- Triadic: base hue + 120°, + 240°
- Split-Complementary: base hue + 150°, + 210°
- Monochromatic: same hue, varied lightness and saturation
- Tetradic/Square: base hue + 90°, + 180°, + 270°

## Technical Notes
- No external dependencies — vanilla HTML/CSS/JS, Canvas 2D API
- `globalCompositeOperation = 'screen'` for additive spotlight blending
- All state in single `colorState` object in `main.js`
- Color temperature: hue 0–60° and 300–360° = Warm; 120–240° = Cool; else Neutral; saturation < 15% = always Neutral
- Shade scale: 9 steps, lightness 95% → 15% (Tailwind 50–900 style)
- Color blindness simulation via 3×3 RGB matrix transforms (Brettel/Viénot)
- WCAG contrast: (L1 + 0.05) / (L2 + 0.05), L = linearized 0.2126R + 0.7152G + 0.0722B
