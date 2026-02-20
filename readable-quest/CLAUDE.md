# Readable Quest: Jellyfish Lab

## Assignment Overview
Interactive RGB Color Studio and Readability Lab themed around jellyfish (deep ocean aesthetic).
Demonstrates RGB additive color mixing, harmony-based palette generation, WCAG accessibility tools,
and a live readability tester with color-vision simulation.

## File Structure
- `index.html` — Main page: 4 tabs (Both | Explorer | Palette | Readable)
- `style.css` — Deep ocean/jellyfish dark theme, bioluminescent accents, responsive
- `color-utils.js` — HSL/RGB/CMYK conversion, color naming, WCAG contrast, shade scale, color blindness matrices
- `explorer.js` — Canvas spotlight rendering, drag-to-move, scroll-to-resize, particles, additive blending
- `palette.js` — Harmony algorithms, swatch rendering, color wheel canvas, shade/tint scale, palette comparison, UI preview
- `accessibility.js` — Contrast checker, color blindness simulator, accessible palette mode
- `main.js` — Shared `colorState` + `rdState` objects, UI wiring, two-way sync, Readable Lab logic

## Jellyfish Theme Colors
- Background: `#040d1e` (deep ocean)
- Panels: `#071527` (dark navy)
- Panel-alt: `#0c1e38`
- Border: `#1a3a5c`
- Text: `#c8e8ff` (pale blue-white)
- Text-muted: `#5a8eb8`
- Accent: `#00d4ff` (bioluminescent cyan)
- Title gradient: cyan → blue → purple → pink → blue → cyan (animated shimmer)

## Readable Lab (4th Tab)
Live readability tester with jellyfish-themed text passage (about Aurelia aurita).
- `rdState` in `main.js`: `{ bgR, bgG, bgB, txtR, txtG, txtB, fontSize, vision }`
- Default: deep ocean background (#040d1e), pale blue text (#c8e8ff)
- Vision types: Normal | Protanopia | Deuteranopia | Tritanopia | Monochromacy
- Vision simulation via 3×3 RGB matrix transforms (Brettel/Viénot) — same as Explorer
- Live stats: BG luminosity, Text luminosity, Contrast ratio, WCAG grade (AAA/AA/AA Large/Fail)
- WCAG contrast: (L1 + 0.05) / (L2 + 0.05), L = linearized 0.2126R + 0.7152G + 0.0722B

## Color Presets (Explorer Panel)
Built-in preset categories: Pure | Warm | Cool | Pastel | Earthy (8 colors each)
Custom presets: save current color to `localStorage` key `colorquest-custom-presets`

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
- Main color state: `colorState` object (Explorer ↔ Palette sync)
- Readable state: `rdState` object (self-contained, independent of colorState)
- Color temperature: hue 0–60° and 300–360° = Warm; 120–240° = Cool; else Neutral; saturation < 15% = always Neutral
- Shade scale: 9 steps, lightness 95% → 15% (Tailwind 50–900 style)
