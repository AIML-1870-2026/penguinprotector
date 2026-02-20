/* ============================================================
   main.js — Shared State + Integration Layer
   ============================================================ */

// ── Shared State ──────────────────────────────────────────────
const colorState = {
  r: 255, g: 0, b: 0,
  h: 0, s: 100, l: 50,
  harmony: 'complementary',
  accessibleMode: false,
  accessibleBg: '#0f0f14',
};

// ── Toast ─────────────────────────────────────────────────────
let toastTimer = null;
function showToast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
}

// ── DOM Refs ──────────────────────────────────────────────────
let rSlider, gSlider, bSlider;
let rVal, gVal, bVal;
let hexReadout, rgbReadout, hslReadout, cmykReadout;
let readoutSwatch, readoutName;
let tempBadge, tempMarker;
let recipeDesc, ingR, ingG, ingB;
let recipeFmtHex, recipeFmtRgb, recipeFmtHsl, recipeFmtCmyk;

// ── Singletons ────────────────────────────────────────────────
let explorerCanvas;
let palettePanel;
let accessibilityPanel;

// ── Update All Readouts ───────────────────────────────────────
function updateReadouts() {
  const { r, g, b } = colorState;
  const hex  = rgbToHex(r, g, b);
  const hsl  = rgbToHsl(r, g, b);
  const cmyk = rgbToCmyk(r, g, b);
  const name = getColorName(r, g, b);

  // Store derived HSL
  colorState.h = hsl.h;
  colorState.s = hsl.s;
  colorState.l = hsl.l;

  // Swatch + name
  readoutSwatch.style.backgroundColor = hex;
  readoutSwatch.style.boxShadow = `0 0 12px ${hex}66`;
  readoutName.textContent = name;

  // Text readouts
  hexReadout.textContent  = hex;
  rgbReadout.textContent  = `rgb(${r}, ${g}, ${b})`;
  hslReadout.textContent  = `hsl(${Math.round(hsl.h)}°, ${Math.round(hsl.s)}%, ${Math.round(hsl.l)}%)`;
  cmykReadout.textContent = `C:${cmyk.c} M:${cmyk.m} Y:${cmyk.y} K:${cmyk.k}`;

  // Temperature
  const temp    = colorTemperature(hsl.h, hsl.s);
  const tempPos = temperaturePosition(hsl.h, hsl.s);
  tempBadge.textContent = temp === 'warm' ? 'Warm 🔴' : temp === 'cool' ? 'Cool 🔵' : 'Neutral ⚪';
  tempBadge.className   = 'temp-badge temp-' + temp;
  tempMarker.style.left = (tempPos * 100) + '%';

  // Recipe
  const total = r + g + b || 1;
  const rPct  = Math.round(r / 255 * 100);
  const gPct  = Math.round(g / 255 * 100);
  const bPct  = Math.round(b / 255 * 100);

  let recipeText = 'Mix ';
  const parts = [];
  if (r > 0) parts.push(`${rPct}% Red`);
  if (g > 0) parts.push(`${gPct}% Green`);
  if (b > 0) parts.push(`${bPct}% Blue`);
  recipeDesc.textContent = parts.length ? recipeText + parts.join(', ') : 'Pure Black (no channels active)';

  // Ingredient bar proportions
  ingR.style.flex = r;
  ingG.style.flex = g;
  ingB.style.flex = b;
  if (r === 0 && g === 0 && b === 0) { ingR.style.flex = 1; ingR.style.background = '#333'; ingG.style.flex = 0; ingB.style.flex = 0; }
  else { ingR.style.background = '#ff3333'; }

  // Recipe format blocks
  recipeFmtHex.textContent  = `HEX  ${hex}`;
  recipeFmtRgb.textContent  = `RGB  ${r}, ${g}, ${b}`;
  recipeFmtHsl.textContent  = `HSL  ${Math.round(hsl.h)}° ${Math.round(hsl.s)}% ${Math.round(hsl.l)}%`;
  recipeFmtCmyk.textContent = `CMYK ${cmyk.c} ${cmyk.m} ${cmyk.y} ${cmyk.k}`;
}

// ── Set Color (called by palette clicks, randomize, etc.) ─────
function mainSetColor(r, g, b) {
  r = Math.max(0, Math.min(255, Math.round(r)));
  g = Math.max(0, Math.min(255, Math.round(g)));
  b = Math.max(0, Math.min(255, Math.round(b)));

  colorState.r = r; colorState.g = g; colorState.b = b;

  // Update sliders (without retriggering palette)
  rSlider.value = r; rVal.textContent = r;
  gSlider.value = g; gVal.textContent = g;
  bSlider.value = b; bVal.textContent = b;

  // Update canvas spotlights
  explorerCanvas.setChannelIntensity('r', r);
  explorerCanvas.setChannelIntensity('g', g);
  explorerCanvas.setChannelIntensity('b', b);

  updateReadouts();

  // Regenerate palette
  const hsl = rgbToHsl(r, g, b);
  palettePanel.generate(hsl.h, hsl.s, hsl.l);
}
window.mainSetColor = mainSetColor;

// ── Clipboard helpers for readout clicks ──────────────────────
function makeClickToCopy(el, getValue) {
  el.addEventListener('click', () => {
    const text = getValue();
    navigator.clipboard.writeText(text).catch(() => {});
    showToast(`Copied: ${text}`);
  });
}

function makeClickToCopyEl(el) {
  makeClickToCopy(el, () => el.textContent.trim());
}

// ── Color Presets ─────────────────────────────────────────────
const COLOR_PRESETS = [
  { label: 'Pure', colors: [
    { name: 'Red',     r: 255, g: 0,   b: 0   },
    { name: 'Green',   r: 0,   g: 255, b: 0   },
    { name: 'Blue',    r: 0,   g: 0,   b: 255 },
    { name: 'Yellow',  r: 255, g: 255, b: 0   },
    { name: 'Cyan',    r: 0,   g: 255, b: 255 },
    { name: 'Magenta', r: 255, g: 0,   b: 255 },
    { name: 'White',   r: 255, g: 255, b: 255 },
    { name: 'Black',   r: 0,   g: 0,   b: 0   },
  ]},
  { label: 'Warm', colors: [
    { name: 'Coral',       r: 255, g: 127, b: 80  },
    { name: 'Orange',      r: 255, g: 165, b: 0   },
    { name: 'Gold',        r: 255, g: 215, b: 0   },
    { name: 'Crimson',     r: 220, g: 20,  b: 60  },
    { name: 'Salmon',      r: 250, g: 128, b: 114 },
    { name: 'Amber',       r: 255, g: 191, b: 0   },
    { name: 'Tomato',      r: 255, g: 99,  b: 71  },
    { name: 'Hot Pink',    r: 255, g: 105, b: 180 },
  ]},
  { label: 'Cool', colors: [
    { name: 'Sky Blue',   r: 135, g: 206, b: 235 },
    { name: 'Teal',       r: 0,   g: 128, b: 128 },
    { name: 'Indigo',     r: 75,  g: 0,   b: 130 },
    { name: 'Violet',     r: 138, g: 43,  b: 226 },
    { name: 'Mint',       r: 62,  g: 180, b: 137 },
    { name: 'Steel Blue', r: 70,  g: 130, b: 180 },
    { name: 'Periwinkle', r: 102, g: 130, b: 255 },
    { name: 'Turquoise',  r: 64,  g: 224, b: 208 },
  ]},
  { label: 'Pastel', colors: [
    { name: 'Lavender',   r: 230, g: 190, b: 255 },
    { name: 'Peach',      r: 255, g: 218, b: 185 },
    { name: 'Mint Cream', r: 185, g: 240, b: 200 },
    { name: 'Rose',       r: 255, g: 182, b: 193 },
    { name: 'Baby Blue',  r: 173, g: 216, b: 230 },
    { name: 'Lemon',      r: 255, g: 250, b: 170 },
    { name: 'Lilac',      r: 200, g: 162, b: 200 },
    { name: 'Blush',      r: 255, g: 200, b: 200 },
  ]},
  { label: 'Earthy', colors: [
    { name: 'Terracotta', r: 204, g: 78,  b: 44  },
    { name: 'Olive',      r: 107, g: 142, b: 35  },
    { name: 'Chocolate',  r: 123, g: 63,  b: 0   },
    { name: 'Sand',       r: 194, g: 178, b: 128 },
    { name: 'Forest',     r: 34,  g: 85,  b: 34  },
    { name: 'Rust',       r: 183, g: 65,  b: 14  },
    { name: 'Sienna',     r: 160, g: 82,  b: 45  },
    { name: 'Khaki',      r: 189, g: 183, b: 107 },
  ]},
];

function initColorPresets() {
  const grid = document.getElementById('color-presets-grid');
  COLOR_PRESETS.forEach(({ label, colors }) => {
    const row = document.createElement('div');
    row.className = 'preset-category';

    const labelEl = document.createElement('span');
    labelEl.className = 'preset-category-label';
    labelEl.textContent = label;
    row.appendChild(labelEl);

    const swatchesEl = document.createElement('div');
    swatchesEl.className = 'preset-swatches';

    colors.forEach(({ name, r, g, b }) => {
      const hex = `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`;
      const btn = document.createElement('button');
      btn.className = 'color-preset';
      btn.style.background = hex;
      btn.title = name;
      btn.setAttribute('aria-label', name);
      btn.addEventListener('click', () => {
        mainSetColor(r, g, b);
        showToast(`Preset: ${name}`);
      });
      swatchesEl.appendChild(btn);
    });

    row.appendChild(swatchesEl);
    grid.appendChild(row);
  });
}

// ── Background Presets ────────────────────────────────────────
function darkenHex(hex, factor) {
  const r = Math.round(parseInt(hex.slice(1, 3), 16) * factor);
  const g = Math.round(parseInt(hex.slice(3, 5), 16) * factor);
  const b = Math.round(parseInt(hex.slice(5, 7), 16) * factor);
  return `rgb(${r}, ${g}, ${b})`;
}

function applyBgPreset(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  const isLight = lum >= 0.45;
  const bt = isLight ? 0 : 255; // blend target: dark for light bg, light for dark bg

  const mix = (v, t, a) => Math.round(v + (t - v) * a);
  const rgb  = a => `rgb(${mix(r,bt,a)},${mix(g,bt,a)},${mix(b,bt,a)})`;

  // Update CSS variables so all components using them repaint automatically
  const root = document.documentElement;
  root.style.setProperty('--bg',         hex);
  root.style.setProperty('--panel',      rgb(0.07));
  root.style.setProperty('--panel-alt',  rgb(0.13));
  root.style.setProperty('--border',     rgb(0.23));
  root.style.setProperty('--text',       isLight ? '#1a1a2e' : '#e0e0f0');
  root.style.setProperty('--text-muted', isLight ? '#55566a' : '#888898');

  // Clear any previously applied inline overrides so CSS vars take effect
  document.querySelectorAll('.panel').forEach(p => p.style.backgroundColor = '');
  document.getElementById('main-panels').style.background = '';

  // Header has its own hardcoded bg — set directly
  document.querySelector('.app-header').style.backgroundColor = rgb(0.15);

  // Canvas interior: keep dark enough for spotlight blending
  if (explorerCanvas) explorerCanvas.setBgColor(rgb(isLight ? 0.88 : 0.08));
}

// ── Tab Switching ─────────────────────────────────────────────
function initTabs() {
  const panels = document.getElementById('main-panels');
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const tab = btn.dataset.tab;
      panels.className = `dual-panel${tab !== 'both' ? ' tab-' + tab : ''}`;
      if (tab !== 'palette') {
        // Re-size canvas after layout changes
        setTimeout(() => {
          explorerCanvas.resize();
          for (const s of explorerCanvas.spotlights) { s.x = explorerCanvas.cx + (s.x - explorerCanvas.cx); }
        }, 50);
      }
    });
  });
}

// ── Init ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // DOM refs
  rSlider = document.getElementById('r-slider');
  gSlider = document.getElementById('g-slider');
  bSlider = document.getElementById('b-slider');
  rVal    = document.getElementById('r-val');
  gVal    = document.getElementById('g-val');
  bVal    = document.getElementById('b-val');

  hexReadout  = document.getElementById('hex-readout');
  rgbReadout  = document.getElementById('rgb-readout');
  hslReadout  = document.getElementById('hsl-readout');
  cmykReadout = document.getElementById('cmyk-readout');
  readoutSwatch = document.getElementById('readout-swatch');
  readoutName   = document.getElementById('readout-name');

  tempBadge  = document.getElementById('temp-badge');
  tempMarker = document.getElementById('temp-marker');

  recipeDesc    = document.getElementById('recipe-desc');
  ingR          = document.getElementById('ing-r');
  ingG          = document.getElementById('ing-g');
  ingB          = document.getElementById('ing-b');
  recipeFmtHex  = document.getElementById('recipe-hex');
  recipeFmtRgb  = document.getElementById('recipe-rgb');
  recipeFmtHsl  = document.getElementById('recipe-hsl');
  recipeFmtCmyk = document.getElementById('recipe-cmyk');

  // Click-to-copy on readouts
  [hexReadout, rgbReadout, hslReadout, cmykReadout].forEach(makeClickToCopyEl);
  [recipeFmtHex, recipeFmtRgb, recipeFmtHsl, recipeFmtCmyk].forEach(el => {
    el.addEventListener('click', () => {
      const text = el.textContent.replace(/^[A-Z]+\s+/, '').trim();
      navigator.clipboard.writeText(text).catch(() => {});
      showToast(`Copied!`);
    });
  });

  // Slider events
  function onSliderChange() {
    const r = parseInt(rSlider.value);
    const g = parseInt(gSlider.value);
    const b = parseInt(bSlider.value);

    colorState.r = r; colorState.g = g; colorState.b = b;
    rVal.textContent = r; gVal.textContent = g; bVal.textContent = b;

    explorerCanvas.setChannelIntensity('r', r);
    explorerCanvas.setChannelIntensity('g', g);
    explorerCanvas.setChannelIntensity('b', b);

    updateReadouts();

    const hsl = rgbToHsl(r, g, b);
    palettePanel.generate(hsl.h, hsl.s, hsl.l);
  }

  rSlider.addEventListener('input', onSliderChange);
  gSlider.addEventListener('input', onSliderChange);
  bSlider.addEventListener('input', onSliderChange);

  // Explorer canvas
  explorerCanvas = new ExplorerCanvas(document.getElementById('explorer-canvas'));
  explorerCanvas.init();
  window.explorerCanvas = explorerCanvas;

  // Two-way sync: dragging a spotlight updates the corresponding slider
  explorerCanvas.onDragUpdate = (channel, value255) => {
    colorState[channel] = value255;
    const sliderMap = { r: rSlider, g: gSlider, b: bSlider };
    const valMap    = { r: rVal,    g: gVal,    b: bVal    };
    sliderMap[channel].value    = value255;
    valMap[channel].textContent = value255;
    updateReadouts();
    const hsl = rgbToHsl(colorState.r, colorState.g, colorState.b);
    palettePanel.generate(hsl.h, hsl.s, hsl.l);
  };

  // Palette panel
  palettePanel = new PalettePanel();
  palettePanel.init();
  window.palettePanel = palettePanel;

  // Accessibility panel
  accessibilityPanel = new AccessibilityPanel();
  accessibilityPanel.init();
  window.accessibilityPanel = accessibilityPanel;

  // Snap-to-home button
  document.getElementById('snap-home-btn').addEventListener('click', () => {
    explorerCanvas.snapToHome();
  });
  explorerCanvas.onSnapHome = () => {
    colorState.r = 255; colorState.g = 0; colorState.b = 0;
    rSlider.value = 255; rVal.textContent = 255;
    gSlider.value = 0;   gVal.textContent = 0;
    bSlider.value = 0;   bVal.textContent = 0;
    updateReadouts();
    palettePanel.generate(0, 100, 50);
  };

  // Background preset buttons
  applyBgPreset('#000000');
  document.querySelectorAll('.bg-preset').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.bg-preset').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      applyBgPreset(btn.dataset.bg);
    });
  });

  // Color presets
  initColorPresets();

  // Tabs
  initTabs();

  // Initial render with default color (red)
  explorerCanvas.setChannelIntensity('r', 255);
  explorerCanvas.setChannelIntensity('g', 0);
  explorerCanvas.setChannelIntensity('b', 0);
  updateReadouts();
  palettePanel.generate(0, 100, 50);
});
