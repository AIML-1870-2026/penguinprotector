/* ============================================================
   color-utils.js — Color Conversion & Analysis Utilities
   ============================================================ */

// ── RGB ↔ HSL ─────────────────────────────────────────────────
function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0, s = 0;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return { h: h * 360, s: s * 100, l: l * 100 };
}

function hslToRgb(h, s, l) {
  h /= 360; s /= 100; l /= 100;

  if (s === 0) {
    const v = Math.round(l * 255);
    return { r: v, g: v, b: v };
  }

  const hue2rgb = (p, q, t) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return {
    r: Math.round(hue2rgb(p, q, h + 1 / 3) * 255),
    g: Math.round(hue2rgb(p, q, h) * 255),
    b: Math.round(hue2rgb(p, q, h - 1 / 3) * 255),
  };
}

// ── RGB ↔ CMYK ────────────────────────────────────────────────
function rgbToCmyk(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const k = 1 - Math.max(r, g, b);
  if (k >= 1) return { c: 0, m: 0, y: 0, k: 100 };
  return {
    c: Math.round((1 - r - k) / (1 - k) * 100),
    m: Math.round((1 - g - k) / (1 - k) * 100),
    y: Math.round((1 - b - k) / (1 - k) * 100),
    k: Math.round(k * 100),
  };
}

// ── Hex Conversions ───────────────────────────────────────────
function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('').toUpperCase();
}

function hexToRgb(hex) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex.trim());
  return m ? { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) } : null;
}

// ── WCAG Contrast ─────────────────────────────────────────────
function relativeLuminance(r, g, b) {
  const [rl, gl, bl] = [r, g, b].map(v => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rl + 0.7152 * gl + 0.0722 * bl;
}

function contrastRatio(r1, g1, b1, r2, g2, b2) {
  const l1 = relativeLuminance(r1, g1, b1);
  const l2 = relativeLuminance(r2, g2, b2);
  const lighter = Math.max(l1, l2);
  const darker  = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

// ── Color Temperature ─────────────────────────────────────────
// Returns 'warm' | 'cool' | 'neutral'
function colorTemperature(h, s) {
  if (s < 15) return 'neutral';
  if ((h >= 0 && h <= 60) || (h >= 300 && h <= 360)) return 'warm';
  if (h >= 120 && h <= 240) return 'cool';
  return 'neutral';
}

// Returns 0–1 position on warm-to-cool scale (0 = very cool, 1 = very warm)
function temperaturePosition(h, s) {
  if (s < 15) return 0.5;
  // Map hue 0–360 to a warm/cool position
  // Warm peak at 30 (orange), cool peak at 210 (cyan-blue)
  const normalized = h / 360;
  // sin-based mapping: peak warm at ~0.083 (30°), peak cool at ~0.583 (210°)
  return 0.5 + 0.5 * Math.cos((normalized * 2 * Math.PI) - (Math.PI / 6));
}

// ── Shade Scale Generator ─────────────────────────────────────
// Returns 9 steps from very light (50) to very dark (900)
function generateShadeScale(h, s) {
  const lightnesses = [95, 85, 74, 63, 52, 41, 30, 20, 11];
  const labels      = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900];
  return lightnesses.map((l, i) => {
    const adjustedS = s * (0.6 + 0.4 * (1 - Math.abs(l - 50) / 100));
    const rgb = hslToRgb(h, Math.min(100, adjustedS), l);
    return {
      step: labels[i],
      hex: rgbToHex(rgb.r, rgb.g, rgb.b),
      ...rgb,
    };
  });
}

// ── Color Blindness Matrices ──────────────────────────────────
// Based on Brettel/Viénot research (linearized RGB approximations)
const COLORBLIND_MATRICES = {
  protanopia: [
    [0.567, 0.433, 0.000],
    [0.558, 0.442, 0.000],
    [0.000, 0.242, 0.758],
  ],
  deuteranopia: [
    [0.625, 0.375, 0.000],
    [0.700, 0.300, 0.000],
    [0.000, 0.300, 0.700],
  ],
  tritanopia: [
    [0.950, 0.050, 0.000],
    [0.000, 0.433, 0.567],
    [0.000, 0.475, 0.525],
  ],
};

function simulateColorBlindness(r, g, b, type) {
  const m = COLORBLIND_MATRICES[type];
  if (!m) return { r, g, b };
  return {
    r: Math.round(Math.min(255, m[0][0] * r + m[0][1] * g + m[0][2] * b)),
    g: Math.round(Math.min(255, m[1][0] * r + m[1][1] * g + m[1][2] * b)),
    b: Math.round(Math.min(255, m[2][0] * r + m[2][1] * g + m[2][2] * b)),
  };
}

// ── Color Naming ──────────────────────────────────────────────
// Nearest-neighbor match against a curated list of ~150 named colors
const COLOR_NAMES = [
  { name: 'Black',          r:   0, g:   0, b:   0 },
  { name: 'White',          r: 255, g: 255, b: 255 },
  { name: 'Red',            r: 255, g:   0, b:   0 },
  { name: 'Lime',           r:   0, g: 255, b:   0 },
  { name: 'Blue',           r:   0, g:   0, b: 255 },
  { name: 'Yellow',         r: 255, g: 255, b:   0 },
  { name: 'Cyan',           r:   0, g: 255, b: 255 },
  { name: 'Magenta',        r: 255, g:   0, b: 255 },
  { name: 'Silver',         r: 192, g: 192, b: 192 },
  { name: 'Gray',           r: 128, g: 128, b: 128 },
  { name: 'Maroon',         r: 128, g:   0, b:   0 },
  { name: 'Olive',          r: 128, g: 128, b:   0 },
  { name: 'Green',          r:   0, g: 128, b:   0 },
  { name: 'Purple',         r: 128, g:   0, b: 128 },
  { name: 'Teal',           r:   0, g: 128, b: 128 },
  { name: 'Navy',           r:   0, g:   0, b: 128 },
  { name: 'Orange',         r: 255, g: 165, b:   0 },
  { name: 'Coral',          r: 255, g: 127, b:  80 },
  { name: 'Salmon',         r: 250, g: 128, b: 114 },
  { name: 'Tomato',         r: 255, g:  99, b:  71 },
  { name: 'Crimson',        r: 220, g:  20, b:  60 },
  { name: 'Firebrick',      r: 178, g:  34, b:  34 },
  { name: 'Dark Red',       r: 139, g:   0, b:   0 },
  { name: 'Hot Pink',       r: 255, g: 105, b: 180 },
  { name: 'Deep Pink',      r: 255, g:  20, b: 147 },
  { name: 'Pink',           r: 255, g: 192, b: 203 },
  { name: 'Orchid',         r: 218, g: 112, b: 214 },
  { name: 'Violet',         r: 238, g: 130, b: 238 },
  { name: 'Plum',           r: 221, g: 160, b: 221 },
  { name: 'Thistle',        r: 216, g: 191, b: 216 },
  { name: 'Lavender',       r: 230, g: 230, b: 250 },
  { name: 'Indigo',         r:  75, g:   0, b: 130 },
  { name: 'Midnight Blue',  r:  25, g:  25, b: 112 },
  { name: 'Dark Blue',      r:   0, g:   0, b: 139 },
  { name: 'Medium Blue',    r:   0, g:   0, b: 205 },
  { name: 'Royal Blue',     r:  65, g: 105, b: 225 },
  { name: 'Dodger Blue',    r:  30, g: 144, b: 255 },
  { name: 'Deep Sky Blue',  r:   0, g: 191, b: 255 },
  { name: 'Sky Blue',       r: 135, g: 206, b: 235 },
  { name: 'Light Blue',     r: 173, g: 216, b: 230 },
  { name: 'Steel Blue',     r:  70, g: 130, b: 180 },
  { name: 'Cadet Blue',     r:  95, g: 158, b: 160 },
  { name: 'Dark Cyan',      r:   0, g: 139, b: 139 },
  { name: 'Aquamarine',     r: 127, g: 255, b: 212 },
  { name: 'Turquoise',      r:  64, g: 224, b: 208 },
  { name: 'Pale Turquoise', r: 175, g: 238, b: 238 },
  { name: 'Spring Green',   r:   0, g: 255, b: 127 },
  { name: 'Mint Green',     r: 152, g: 255, b: 152 },
  { name: 'Lime Green',     r:  50, g: 205, b:  50 },
  { name: 'Forest Green',   r:  34, g: 139, b:  34 },
  { name: 'Dark Green',     r:   0, g: 100, b:   0 },
  { name: 'Olive Drab',     r: 107, g: 142, b:  35 },
  { name: 'Yellow Green',   r: 154, g: 205, b:  50 },
  { name: 'Chartreuse',     r: 127, g: 255, b:   0 },
  { name: 'Lawn Green',     r: 124, g: 252, b:   0 },
  { name: 'Sea Green',      r:  46, g: 139, b:  87 },
  { name: 'Khaki',          r: 240, g: 230, b: 140 },
  { name: 'Dark Khaki',     r: 189, g: 183, b: 107 },
  { name: 'Gold',           r: 255, g: 215, b:   0 },
  { name: 'Goldenrod',      r: 218, g: 165, b:  32 },
  { name: 'Amber',          r: 255, g: 191, b:   0 },
  { name: 'Peach',          r: 255, g: 218, b: 185 },
  { name: 'Moccasin',       r: 255, g: 228, b: 181 },
  { name: 'Wheat',          r: 245, g: 222, b: 179 },
  { name: 'Burly Wood',     r: 222, g: 184, b: 135 },
  { name: 'Tan',            r: 210, g: 180, b: 140 },
  { name: 'Sandy Brown',    r: 244, g: 164, b:  96 },
  { name: 'Peru',           r: 205, g: 133, b:  63 },
  { name: 'Sienna',         r: 160, g:  82, b:  45 },
  { name: 'Saddle Brown',   r: 139, g:  69, b:  19 },
  { name: 'Chocolate',      r: 210, g: 105, b:  30 },
  { name: 'Dark Orange',    r: 255, g: 140, b:   0 },
  { name: 'Orange Red',     r: 255, g:  69, b:   0 },
  { name: 'Brown',          r: 165, g:  42, b:  42 },
  { name: 'Slate Gray',     r: 112, g: 128, b: 144 },
  { name: 'Light Gray',     r: 211, g: 211, b: 211 },
  { name: 'Dim Gray',       r: 105, g: 105, b: 105 },
  { name: 'Dark Gray',      r: 169, g: 169, b: 169 },
  { name: 'Cornflower Blue',r: 100, g: 149, b: 237 },
  { name: 'Medium Slate Blue',r:123, g: 104, b: 238 },
  { name: 'Slate Blue',     r: 106, g:  90, b: 205 },
  { name: 'Blue Violet',    r: 138, g:  43, b: 226 },
  { name: 'Dark Violet',    r: 148, g:   0, b: 211 },
  { name: 'Dark Orchid',    r: 153, g:  50, b: 204 },
  { name: 'Medium Purple',  r: 147, g: 112, b: 219 },
  { name: 'Dark Magenta',   r: 139, g:   0, b: 139 },
  { name: 'Fuchsia',        r: 255, g:   0, b: 255 },
  { name: 'Rose',           r: 255, g:   0, b: 127 },
  { name: 'Ruby',           r: 155, g:  17, b:  30 },
  { name: 'Scarlet',        r: 255, g:  36, b:   0 },
  { name: 'Rust',           r: 183, g:  65, b:  14 },
  { name: 'Terracotta',     r: 226, g: 114, b:  91 },
  { name: 'Copper',         r: 184, g: 115, b:  51 },
  { name: 'Bronze',         r: 205, g: 127, b:  50 },
  { name: 'Brass',          r: 181, g: 166, b:  66 },
  { name: 'Moss Green',     r: 138, g: 154, b:  91 },
  { name: 'Sage',           r: 176, g: 208, b: 176 },
  { name: 'Jade',           r:   0, g: 168, b: 107 },
  { name: 'Emerald',        r:  80, g: 200, b: 120 },
  { name: 'Ice Blue',       r: 153, g: 255, b: 255 },
  { name: 'Baby Blue',      r: 137, g: 207, b: 240 },
  { name: 'Periwinkle',     r: 204, g: 204, b: 255 },
  { name: 'Mauve',          r: 224, g: 176, b: 255 },
  { name: 'Lilac',          r: 200, g: 162, b: 200 },
  { name: 'Blush',          r: 222, g:  93, b: 131 },
  { name: 'Burgundy',       r: 128, g:   0, b:  32 },
  { name: 'Wine',           r: 114, g:  47, b:  55 },
  { name: 'Claret',         r: 127, g:   0, b:  30 },
  { name: 'Champagne',      r: 247, g: 231, b: 206 },
  { name: 'Cream',          r: 255, g: 253, b: 208 },
  { name: 'Ivory',          r: 255, g: 255, b: 240 },
  { name: 'Linen',          r: 250, g: 240, b: 230 },
  { name: 'Beige',          r: 245, g: 245, b: 220 },
  { name: 'Bisque',         r: 255, g: 228, b: 196 },
  { name: 'Seashell',       r: 255, g: 245, b: 238 },
  { name: 'Snow',           r: 255, g: 250, b: 250 },
  { name: 'Ghost White',    r: 248, g: 248, b: 255 },
  { name: 'Azure',          r: 240, g: 255, b: 255 },
  { name: 'Honeydew',       r: 240, g: 255, b: 240 },
  { name: 'Mint Cream',     r: 245, g: 255, b: 250 },
  { name: 'Alice Blue',     r: 240, g: 248, b: 255 },
  { name: 'Lavender Blush', r: 255, g: 240, b: 245 },
  { name: 'Misty Rose',     r: 255, g: 228, b: 225 },
  { name: 'Light Yellow',   r: 255, g: 255, b: 224 },
  { name: 'Light Cyan',     r: 224, g: 255, b: 255 },
  { name: 'Light Pink',     r: 255, g: 182, b: 193 },
  { name: 'Light Salmon',   r: 255, g: 160, b: 122 },
  { name: 'Light Coral',    r: 240, g: 128, b: 128 },
  { name: 'Light Steel Blue',r:176, g: 196, b: 222 },
  { name: 'Light Sea Green',r:  32, g: 178, b: 170 },
  { name: 'Light Sky Blue', r: 135, g: 206, b: 250 },
  { name: 'Medium Aquamarine',r:102,g: 205, b: 170 },
  { name: 'Medium Sea Green',r:  60, g: 179, b: 113 },
  { name: 'Medium Spring Green',r:0,g: 250, b: 154 },
  { name: 'Medium Turquoise',r: 72, g: 209, b: 204 },
  { name: 'Pale Green',     r: 152, g: 251, b: 152 },
  { name: 'Pale Goldenrod', r: 238, g: 232, b: 170 },
  { name: 'Dark Olive Green',r: 85, g: 107, b:  47 },
  { name: 'Dark Sea Green', r: 143, g: 188, b: 143 },
  { name: 'Dark Turquoise', r:   0, g: 206, b: 209 },
  { name: 'Dark Slate Gray',r:  47, g:  79, b:  79 },
  { name: 'Dark Slate Blue',r:  72, g:  61, b: 139 },
  { name: 'Dark Goldenrod', r: 184, g: 134, b:  11 },
];

function getColorName(r, g, b) {
  let minDist = Infinity;
  let bestName = 'Unknown';
  for (const c of COLOR_NAMES) {
    const dist = (r - c.r) ** 2 + (g - c.g) ** 2 + (b - c.b) ** 2;
    if (dist < minDist) { minDist = dist; bestName = c.name; }
  }
  return bestName;
}
