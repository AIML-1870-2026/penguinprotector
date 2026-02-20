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
  tempShift: 0,
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

// ── Readable Lab ──────────────────────────────────────────────
const VISION_MATRICES = {
  normal:       null,
  protanopia:   [[0.567,0.433,0],[0.558,0.442,0],[0,0.242,0.758]],
  deuteranopia: [[0.625,0.375,0],[0.7,0.3,0],[0,0.3,0.7]],
  tritanopia:   [[0.95,0.05,0],[0,0.433,0.567],[0,0.475,0.525]],
  monochromacy: [[0.299,0.587,0.114],[0.299,0.587,0.114],[0.299,0.587,0.114]],
};

function applyVision(r, g, b, type) {
  const m = VISION_MATRICES[type];
  if (!m) return [r, g, b];
  return [
    Math.min(255, Math.round(m[0][0]*r + m[0][1]*g + m[0][2]*b)),
    Math.min(255, Math.round(m[1][0]*r + m[1][1]*g + m[1][2]*b)),
    Math.min(255, Math.round(m[2][0]*r + m[2][1]*g + m[2][2]*b)),
  ];
}

function rdLinearize(c) {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}
function rdLuminance(r, g, b) {
  return 0.2126 * rdLinearize(r) + 0.7152 * rdLinearize(g) + 0.0722 * rdLinearize(b);
}

const rdState = {
  bgR: 4, bgG: 13, bgB: 30,
  txtR: 200, txtG: 232, txtB: 255,
  fontSize: 18,
  vision: 'normal',
  fontFamily: 'system-ui,-apple-system,sans-serif',
};

function toHex(r, g, b) {
  return '#' + [r,g,b].map(v => v.toString(16).padStart(2,'0')).join('');
}

// ── Preset Schemes ────────────────────────────────────────────
const RD_SCHEMES = [
  { name: 'Ocean',     bgR: 4,   bgG: 13,  bgB: 30,  txtR: 200, txtG: 232, txtB: 255 },
  { name: 'Jelly',    bgR: 10,  bgG: 5,   bgB: 32,  txtR: 0,   txtG: 229, txtB: 255 },
  { name: 'Night',    bgR: 18,  bgG: 18,  bgB: 18,  txtR: 220, txtG: 220, txtB: 220 },
  { name: 'Paper',    bgR: 255, bgG: 252, bgB: 245, txtR: 30,  txtG: 30,  txtB: 30  },
  { name: 'Sepia',    bgR: 244, bgG: 236, bgB: 216, txtR: 91,  txtG: 70,  txtB: 54  },
  { name: 'Forest',   bgR: 20,  bgG: 40,  bgB: 20,  txtR: 180, txtG: 230, txtB: 180 },
  { name: 'Sunset',   bgR: 45,  bgG: 27,  bgB: 14,  txtR: 255, txtG: 204, txtB: 153 },
  { name: 'Slate',    bgR: 30,  bgG: 39,  bgB: 48,  txtR: 184, txtG: 208, txtB: 232 },
  { name: 'Hi-Con',   bgR: 0,   bgG: 0,   bgB: 0,   txtR: 255, txtG: 255, txtB: 0   },
  { name: 'Candy',    bgR: 255, bgG: 240, bgB: 245, txtR: 140, txtG: 0,   txtB: 80  },
];

function syncRdSliders(prefix, r, g, b) {
  [['r', r], ['g', g], ['b', b]].forEach(([ch, val]) => {
    const el  = document.getElementById(`rd-${prefix}-${ch}`);
    const vEl = document.getElementById(`rd-${prefix}-${ch}v`);
    if (el)  el.value = val;
    if (vEl) vEl.textContent = val;
  });
}

function applyRdScheme(scheme) {
  Object.assign(rdState, {
    bgR: scheme.bgR, bgG: scheme.bgG, bgB: scheme.bgB,
    txtR: scheme.txtR, txtG: scheme.txtG, txtB: scheme.txtB,
  });
  syncRdSliders('bg',  rdState.bgR,  rdState.bgG,  rdState.bgB);
  syncRdSliders('txt', rdState.txtR, rdState.txtG, rdState.txtB);
  updateReadableDisplay();
  showToast(`Scheme: ${scheme.name}`);
}

function renderSchemesPopup() {
  const grid = document.getElementById('schemes-popup-grid');
  if (!grid) return;
  grid.innerHTML = '';
  RD_SCHEMES.forEach(scheme => {
    const card = document.createElement('div');
    card.className = 'popup-scheme-card';

    const preview = document.createElement('div');
    preview.className = 'popup-scheme-preview';
    preview.style.background = toHex(scheme.bgR, scheme.bgG, scheme.bgB);
    preview.style.color       = toHex(scheme.txtR, scheme.txtG, scheme.txtB);
    preview.innerHTML = '<span class="popup-scheme-big">Aa</span><span class="popup-scheme-small">jellyfish</span>';

    const name = document.createElement('div');
    name.className = 'popup-scheme-name';
    name.textContent = scheme.name;

    card.appendChild(preview);
    card.appendChild(name);
    card.addEventListener('click', () => {
      document.querySelectorAll('.popup-scheme-card').forEach(c => c.classList.remove('active'));
      card.classList.add('active');
      applyRdScheme(scheme);
      setTimeout(closeSchemesPopup, 300);
    });
    grid.appendChild(card);
  });
}

// ── Swap + Auto-contrast ──────────────────────────────────────
function swapRdColors() {
  [rdState.bgR, rdState.txtR] = [rdState.txtR, rdState.bgR];
  [rdState.bgG, rdState.txtG] = [rdState.txtG, rdState.bgG];
  [rdState.bgB, rdState.txtB] = [rdState.txtB, rdState.bgB];
  syncRdSliders('bg',  rdState.bgR,  rdState.bgG,  rdState.bgB);
  syncRdSliders('txt', rdState.txtR, rdState.txtG, rdState.txtB);
  updateReadableDisplay();
  showToast('Colors swapped');
}

function autoContrastText(targetRatio) {
  const { bgR, bgG, bgB, txtR, txtG, txtB } = rdState;
  const bgLum = rdLuminance(bgR, bgG, bgB);

  // Preserve hue & saturation of current text, sweep lightness
  const { h, s } = rgbToHsl(txtR, txtG, txtB);
  const goLighter = bgLum < 0.18;

  let found = false;
  for (let i = 0; i <= 100; i++) {
    const l = goLighter ? Math.min(98, 50 + i * 0.48) : Math.max(2, 50 - i * 0.48);
    const rgb = hslToRgb(h, Math.max(s, 20), l);
    const txtLum = rdLuminance(rgb.r, rgb.g, rgb.b);
    const hi = Math.max(bgLum, txtLum), lo = Math.min(bgLum, txtLum);
    if ((hi + 0.05) / (lo + 0.05) >= targetRatio) {
      rdState.txtR = rgb.r; rdState.txtG = rgb.g; rdState.txtB = rgb.b;
      syncRdSliders('txt', rgb.r, rgb.g, rgb.b);
      found = true;
      break;
    }
  }
  updateReadableDisplay();
  showToast(found ? `Auto-contrast: ${targetRatio >= 7 ? 'AAA' : 'AA'} achieved` : 'Could not reach target — try a different hue');
}

// ── Text Color Suggestions (palette harmony logic) ────────────
function updateTextSuggestions() {
  const row = document.getElementById('rd-suggestions-row');
  if (!row) return;
  const { bgR, bgG, bgB, txtR, txtG, txtB } = rdState;
  const bgLum = rdLuminance(bgR, bgG, bgB);
  const { h, s } = rgbToHsl(bgR, bgG, bgB);

  // Harmony-based + practical candidates (palette algorithms applied to readability)
  const goLight = bgLum < 0.18;
  const lBase   = goLight ? 85 : 15;
  const lAlt    = goLight ? 92 : 8;
  const sSug    = Math.min(90, Math.max(s, 50));

  const candidates = [
    { label: 'White',       ...(() => { const rgb = { r: 255, g: 255, b: 255 }; return rgb; })() },
    { label: 'Black',       r: 0,   g: 0,   b: 0   },
    { label: 'Complement',  ...hslToRgb((h + 180) % 360, sSug, lBase) },
    { label: 'Split +150',  ...hslToRgb((h + 150) % 360, sSug, lBase) },
    { label: 'Split −150',  ...hslToRgb((h + 210) % 360, sSug, lBase) },
    { label: 'Triadic',     ...hslToRgb((h + 120) % 360, sSug, lBase) },
    { label: 'Analogous',   ...hslToRgb((h + 30)  % 360, sSug, lAlt)  },
    { label: 'Current hue', ...hslToRgb(h,               sSug, lBase) },
  ];

  const currentTxtHex = toHex(txtR, txtG, txtB);

  row.innerHTML = '';
  candidates.forEach(({ label, r, g, b }) => {
    const hex    = toHex(r, g, b);
    const txtLum = rdLuminance(r, g, b);
    const hi     = Math.max(bgLum, txtLum), lo = Math.min(bgLum, txtLum);
    const ratio  = (hi + 0.05) / (lo + 0.05);
    const grade  = ratio >= 7 ? 'AAA' : ratio >= 4.5 ? 'AA' : ratio >= 3 ? '~AA' : '✕';
    const gradeColor = ratio >= 7 ? '#00ff9d' : ratio >= 4.5 ? '#44ddaa' : ratio >= 3 ? '#ffcc44' : '#ff5566';
    const isActive = hex === currentTxtHex;

    const wrap = document.createElement('div');
    wrap.className = 'rd-suggestion' + (isActive ? ' active' : '');
    wrap.title = `${label}: ${ratio.toFixed(1)}:1 ${grade}`;

    const dot = document.createElement('div');
    dot.className = 'rd-suggestion-dot';
    dot.style.background = hex;

    const ratioEl = document.createElement('div');
    ratioEl.className = 'rd-suggestion-ratio';
    ratioEl.textContent = ratio.toFixed(1);
    ratioEl.style.color = gradeColor;

    const labelEl = document.createElement('div');
    labelEl.className = 'rd-suggestion-label';
    labelEl.textContent = label;

    wrap.appendChild(dot);
    wrap.appendChild(ratioEl);
    wrap.appendChild(labelEl);

    wrap.addEventListener('click', () => {
      rdState.txtR = r; rdState.txtG = g; rdState.txtB = b;
      syncRdSliders('txt', r, g, b);
      updateReadableDisplay();
      showToast(`Text: ${label} (${ratio.toFixed(1)}:1)`);
    });

    row.appendChild(wrap);
  });
}

const VISION_LABELS = {
  normal: 'Normal', protanopia: 'Protanopia',
  deuteranopia: 'Deuteranopia', tritanopia: 'Tritanopia', monochromacy: 'Monochromacy',
};

function updateVisionGrid() {
  const grid = document.getElementById('rd-vision-grid');
  if (!grid) return;
  const { bgR, bgG, bgB, txtR, txtG, txtB } = rdState;

  grid.innerHTML = '';
  Object.keys(VISION_LABELS).forEach(type => {
    const [vBgR,  vBgG,  vBgB]  = applyVision(bgR,  bgG,  bgB,  type);
    const [vTxtR, vTxtG, vTxtB] = applyVision(txtR, txtG, txtB, type);

    const card = document.createElement('div');
    card.className = 'vision-card' + (rdState.vision === type ? ' active' : '');

    const preview = document.createElement('div');
    preview.className = 'vision-card-preview';
    preview.style.background = toHex(vBgR, vBgG, vBgB);
    preview.style.color      = toHex(vTxtR, vTxtG, vTxtB);
    preview.innerHTML = `<span class="vision-card-big">Aa</span><span class="vision-card-small">jellyfish</span>`;

    const label = document.createElement('div');
    label.className = 'vision-card-label';
    label.textContent = VISION_LABELS[type];

    card.appendChild(preview);
    card.appendChild(label);
    card.addEventListener('click', () => {
      rdState.vision = type;
      const radio = document.querySelector(`input[name="rd-vision"][value="${type}"]`);
      if (radio) radio.checked = true;
      updateReadableDisplay();
    });

    grid.appendChild(card);
  });
}

function updateReadableDisplay() {
  const { bgR, bgG, bgB, txtR, txtG, txtB, fontSize, vision } = rdState;

  const [vBgR,  vBgG,  vBgB]  = applyVision(bgR,  bgG,  bgB,  vision);
  const [vTxtR, vTxtG, vTxtB] = applyVision(txtR, txtG, txtB, vision);

  const display = document.getElementById('rd-display');
  if (!display) return;
  display.style.background = toHex(vBgR, vBgG, vBgB);
  display.style.color       = toHex(vTxtR, vTxtG, vTxtB);
  display.style.fontSize    = fontSize + 'px';
  display.style.fontFamily  = rdState.fontFamily;

  document.getElementById('rd-bg-swatch').style.background  = toHex(bgR,  bgG,  bgB);
  document.getElementById('rd-txt-swatch').style.background = toHex(txtR, txtG, txtB);
  const _bgHexEl  = document.getElementById('rd-bg-hex-input');
  const _txtHexEl = document.getElementById('rd-txt-hex-input');
  if (_bgHexEl  && _bgHexEl  !== document.activeElement) _bgHexEl.value  = toHex(bgR,  bgG,  bgB).toUpperCase();
  if (_txtHexEl && _txtHexEl !== document.activeElement) _txtHexEl.value = toHex(txtR, txtG, txtB).toUpperCase();

  const lumBg  = rdLuminance(vBgR,  vBgG,  vBgB);
  const lumTxt = rdLuminance(vTxtR, vTxtG, vTxtB);
  const [hi, lo] = lumBg > lumTxt ? [lumBg, lumTxt] : [lumTxt, lumBg];
  const ratio    = (hi + 0.05) / (lo + 0.05);

  document.getElementById('rd-lum-bg').textContent  = lumBg.toFixed(3);
  document.getElementById('rd-lum-txt').textContent = lumTxt.toFixed(3);
  document.getElementById('rd-contrast').textContent = ratio.toFixed(2);

  let grade = 'Fail', gradeColor = '#ff5566';
  if (ratio >= 7)   { grade = 'AAA';      gradeColor = '#00ff9d'; }
  else if (ratio >= 4.5) { grade = 'AA'; gradeColor = '#44ddaa'; }
  else if (ratio >= 3)   { grade = 'AA\u2009Large'; gradeColor = '#ffcc44'; }

  const wcagEl = document.getElementById('rd-wcag');
  wcagEl.textContent = grade;
  wcagEl.style.color = gradeColor;

  updateVisionGrid();
  updateTextSuggestions();
}

function parseHex(val) {
  val = val.trim().replace(/^#/, '');
  if (val.length === 3) val = val[0]+val[0]+val[1]+val[1]+val[2]+val[2];
  if (!/^[0-9a-fA-F]{6}$/.test(val)) return null;
  return { r: parseInt(val.slice(0,2),16), g: parseInt(val.slice(2,4),16), b: parseInt(val.slice(4,6),16) };
}

function openSchemesPopup() {
  const el = document.getElementById('schemes-popup-overlay');
  if (el) el.style.display = 'flex';
}
function closeSchemesPopup() {
  const el = document.getElementById('schemes-popup-overlay');
  if (el) el.style.display = 'none';
}

// ── Custom Text Toggle ────────────────────────────────────────
let rdCustomTextMode = false;
let rdOriginalHTML = '';

function enableCustomText() {
  const display = document.getElementById('rd-display');
  if (!rdOriginalHTML) rdOriginalHTML = display.innerHTML;
  display.innerHTML = `<div id="rd-custom-textarea" contenteditable="true" spellcheck="false" aria-label="Custom text input">Type your text here…</div>`;
  rdCustomTextMode = true;
  document.getElementById('rd-custom-text-btn').classList.add('active');
  showToast('Custom text mode on');
}

function disableCustomText() {
  document.getElementById('rd-display').innerHTML = rdOriginalHTML;
  rdCustomTextMode = false;
  document.getElementById('rd-custom-text-btn').classList.remove('active');
  showToast('Restored jellyfish text');
}

function initReadablePanel() {
  const bind = (sliderId, valId, key) => {
    const slider = document.getElementById(sliderId);
    const valEl  = document.getElementById(valId);
    if (!slider) return;
    slider.addEventListener('input', () => {
      rdState[key] = parseInt(slider.value);
      valEl.textContent = slider.value;
      updateReadableDisplay();
    });
  };
  bind('rd-bg-r',  'rd-bg-rv',  'bgR');
  bind('rd-bg-g',  'rd-bg-gv',  'bgG');
  bind('rd-bg-b',  'rd-bg-bv',  'bgB');
  bind('rd-txt-r', 'rd-txt-rv', 'txtR');
  bind('rd-txt-g', 'rd-txt-gv', 'txtG');
  bind('rd-txt-b', 'rd-txt-bv', 'txtB');

  const fontSlider = document.getElementById('rd-font-size');
  const fontVal    = document.getElementById('rd-font-size-v');
  if (fontSlider) {
    fontSlider.addEventListener('input', () => {
      rdState.fontSize = parseInt(fontSlider.value);
      fontVal.textContent = fontSlider.value + 'px';
      updateReadableDisplay();
    });
  }

  document.querySelectorAll('input[name="rd-vision"]').forEach(radio => {
    radio.addEventListener('change', () => {
      rdState.vision = radio.value;
      updateReadableDisplay();
    });
  });

  // Hex inputs for bg and text color
  function wireHexInput(inputId, type) {
    const el = document.getElementById(inputId);
    if (!el) return;
    function apply() {
      const parsed = parseHex(el.value);
      if (!parsed) {
        const { bgR, bgG, bgB, txtR, txtG, txtB } = rdState;
        el.value = toHex(type === 'bg' ? bgR : txtR, type === 'bg' ? bgG : txtG, type === 'bg' ? bgB : txtB).toUpperCase();
        return;
      }
      const { r, g, b } = parsed;
      if (type === 'bg') { rdState.bgR = r; rdState.bgG = g; rdState.bgB = b; syncRdSliders('bg', r, g, b); }
      else               { rdState.txtR = r; rdState.txtG = g; rdState.txtB = b; syncRdSliders('txt', r, g, b); }
      updateReadableDisplay();
    }
    el.addEventListener('keydown', e => { if (e.key === 'Enter') { apply(); el.blur(); } });
    el.addEventListener('blur', apply);
    el.addEventListener('input', () => {
      const parsed = parseHex(el.value);
      if (parsed) {
        const { r, g, b } = parsed;
        if (type === 'bg') { rdState.bgR = r; rdState.bgG = g; rdState.bgB = b; syncRdSliders('bg', r, g, b); }
        else               { rdState.txtR = r; rdState.txtG = g; rdState.txtB = b; syncRdSliders('txt', r, g, b); }
        updateReadableDisplay();
      }
    });
  }
  wireHexInput('rd-bg-hex-input', 'bg');
  wireHexInput('rd-txt-hex-input', 'txt');

  // Preset schemes popup
  renderSchemesPopup();

  const rdPresetsBtn = document.getElementById('rd-presets-btn');
  const schemesOverlay = document.getElementById('schemes-popup-overlay');
  const schemesClose = document.getElementById('schemes-popup-close');

  if (rdPresetsBtn) rdPresetsBtn.onclick = openSchemesPopup;
  if (schemesClose) schemesClose.onclick = closeSchemesPopup;
  if (schemesOverlay) {
    schemesOverlay.onclick = e => { if (e.target === schemesOverlay) closeSchemesPopup(); };
  }
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeSchemesPopup(); });

  // Swap + Auto-contrast buttons
  document.getElementById('rd-swap-btn')    ?.addEventListener('click', swapRdColors);
  document.getElementById('rd-auto-btn')    ?.addEventListener('click', () => autoContrastText(4.5));
  document.getElementById('rd-auto-aaa-btn')?.addEventListener('click', () => autoContrastText(7));

  // Custom Text Toggle
  document.getElementById('rd-custom-text-btn')?.addEventListener('click', () => {
    rdCustomTextMode ? disableCustomText() : enableCustomText();
  });

  // Font Family Picker
  document.querySelectorAll('.rd-font-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      rdState.fontFamily = btn.dataset.font;
      document.querySelectorAll('.rd-font-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      updateReadableDisplay();
      showToast('Font: ' + btn.dataset.label);
    });
  });

  updateReadableDisplay();
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
      if (tab === 'explorer' || tab === 'both') {
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

  // Readable lab
  initReadablePanel();

  // Tabs
  initTabs();

  // Initial render with default color (red)
  explorerCanvas.setChannelIntensity('r', 255);
  explorerCanvas.setChannelIntensity('g', 0);
  explorerCanvas.setChannelIntensity('b', 0);
  updateReadouts();
  palettePanel.generate(0, 100, 50);

  // ── Floating Jellyfish ──────────────────────────────────────
  const JELLY_EMOJIS = ['🪼', '🪼', '🪼', '🌊', '✨'];
  let jellyEnabled = true;
  let jellyInterval = null;

  function spawnJellyfish() {
    if (!jellyEnabled) return;
    const el = document.createElement('div');
    el.className = 'jellyfish-float';
    el.textContent = JELLY_EMOJIS[Math.floor(Math.random() * JELLY_EMOJIS.length)];
    const size = 1.2 + Math.random() * 2.2;          // 1.2rem – 3.4rem
    const duration = 9 + Math.random() * 10;          // 9s – 19s
    const startX = 5 + Math.random() * 90;            // 5% – 95% from left
    el.style.fontSize  = `${size}rem`;
    el.style.left      = `${startX}vw`;
    el.style.animationDuration = `${duration}s`;
    el.style.opacity   = '0';
    document.body.appendChild(el);
    el.addEventListener('animationend', () => el.remove(), { once: true });
  }

  function toggleJellyfish() {
    jellyEnabled = !jellyEnabled;
    const btn = document.getElementById('jelly-toggle');
    if (jellyEnabled) {
      jellyInterval = setInterval(spawnJellyfish, 2800);
      spawnJellyfish();
      if (btn) { btn.classList.remove('jelly-off'); btn.title = 'Pause jellyfish'; }
    } else {
      clearInterval(jellyInterval);
      document.querySelectorAll('.jellyfish-float').forEach(j => j.remove());
      if (btn) { btn.classList.add('jelly-off'); btn.title = 'Resume jellyfish'; }
    }
  }

  document.getElementById('jelly-toggle')?.addEventListener('click', toggleJellyfish);

  spawnJellyfish();
  jellyInterval = setInterval(spawnJellyfish, 2800);
});
