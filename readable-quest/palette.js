/* ============================================================
   palette.js — Harmony Palette Generation + UI
   ============================================================ */

// ── Harmony Generators ────────────────────────────────────────
function normalizeHsl(h, s, l) {
  return {
    h: ((h % 360) + 360) % 360,
    s: Math.max(0, Math.min(100, s)),
    l: Math.max(5,  Math.min(95,  l)),
  };
}

function colorFromHsl(h, s, l) {
  const { h: nh, s: ns, l: nl } = normalizeHsl(h, s, l);
  const rgb = hslToRgb(nh, ns, nl);
  return { h: nh, s: ns, l: nl, ...rgb, hex: rgbToHex(rgb.r, rgb.g, rgb.b), name: getColorName(rgb.r, rgb.g, rgb.b) };
}

function generateHarmony(h, s, l, type) {
  const base = { h, s: Math.max(s, 30), l: l < 20 ? 50 : l > 80 ? 50 : l };
  switch (type) {
    case 'complementary':
      return [
        colorFromHsl(base.h, base.s, base.l),
        colorFromHsl(base.h + 180, base.s, base.l),
      ];
    case 'analogous':
      return [
        colorFromHsl(base.h - 60, base.s * 0.85, base.l),
        colorFromHsl(base.h - 30, base.s * 0.92, base.l),
        colorFromHsl(base.h,      base.s,         base.l),
        colorFromHsl(base.h + 30, base.s * 0.92, base.l),
        colorFromHsl(base.h + 60, base.s * 0.85, base.l),
      ];
    case 'triadic':
      return [
        colorFromHsl(base.h,       base.s, base.l),
        colorFromHsl(base.h + 120, base.s, base.l),
        colorFromHsl(base.h + 240, base.s, base.l),
      ];
    case 'split-complementary':
      return [
        colorFromHsl(base.h,       base.s, base.l),
        colorFromHsl(base.h + 150, base.s, base.l),
        colorFromHsl(base.h + 210, base.s, base.l),
      ];
    case 'monochromatic':
      return [
        colorFromHsl(base.h, base.s * 0.5, 20),
        colorFromHsl(base.h, base.s * 0.75, 35),
        colorFromHsl(base.h, base.s,        50),
        colorFromHsl(base.h, base.s * 0.9,  65),
        colorFromHsl(base.h, base.s * 0.55, 80),
      ];
    case 'tetradic':
      return [
        colorFromHsl(base.h,       base.s, base.l),
        colorFromHsl(base.h + 90,  base.s, base.l),
        colorFromHsl(base.h + 180, base.s, base.l),
        colorFromHsl(base.h + 270, base.s, base.l),
      ];
    default:
      return [colorFromHsl(base.h, base.s, base.l)];
  }
}

// ── PalettePanel ──────────────────────────────────────────────
class PalettePanel {
  constructor() {
    this.currentPalette = [];
    this.pinnedPalettes = [];
    this.expandedSwatchIdx = null;
  }

  init() {
    this.swatchesEl    = document.getElementById('swatches-container');
    this.shadeScaleEl  = document.getElementById('shade-scale');
    this.wheelCanvas   = document.getElementById('color-wheel-canvas');
    this.pinnedEl      = document.getElementById('pinned-palettes');
    this.pinnedCont    = document.getElementById('pinned-container');
    this.previewNav    = document.getElementById('preview-nav');
    this.previewCard   = document.getElementById('preview-card');
    this.previewBtn    = document.getElementById('preview-btn');
    this.previewBadge  = document.getElementById('preview-badge');
    this.previewInput  = document.getElementById('preview-input');
    this.previewCardTitle = document.getElementById('preview-card-title');
    this.previewCardBody  = document.getElementById('preview-card-body');

    document.getElementById('randomize-btn').addEventListener('click', () => this.randomize());
    document.getElementById('pin-btn').addEventListener('click',       () => this.pinCurrentPalette());

    document.querySelectorAll('.harmony-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.harmony-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        colorState.harmony = btn.dataset.harmony;
        this.generate(colorState.h, colorState.s, colorState.l);
      });
    });

    document.getElementById('accessible-mode-toggle').addEventListener('change', e => {
      colorState.accessibleMode = e.target.checked;
      const bgWrapper = document.getElementById('accessible-bg-wrapper');
      bgWrapper.classList.toggle('visible', e.target.checked);
      this.generate(colorState.h, colorState.s, colorState.l);
    });

    document.getElementById('accessible-bg-color').addEventListener('input', e => {
      colorState.accessibleBg = e.target.value;
      if (colorState.accessibleMode) this.generate(colorState.h, colorState.s, colorState.l);
    });

    // Temperature Shift Slider
    const tempShiftSlider = document.getElementById('temp-shift-slider');
    const tempShiftVal    = document.getElementById('temp-shift-val');
    const tempShiftReset  = document.getElementById('temp-shift-reset');

    const resetTempShift = () => {
      colorState.tempShift = 0;
      tempShiftSlider.value = 0;
      tempShiftVal.textContent = '0°';
      this.generate(colorState.h, colorState.s, colorState.l);
      showToast('Temperature reset');
    };

    if (tempShiftSlider) {
      tempShiftSlider.addEventListener('input', () => {
        const shift = parseInt(tempShiftSlider.value);
        colorState.tempShift = shift;
        tempShiftVal.textContent = (shift >= 0 ? '+' : '') + shift + '°';
        this.generate(colorState.h, colorState.s, colorState.l);
      });
      tempShiftSlider.addEventListener('dblclick', resetTempShift);
    }
    if (tempShiftReset) tempShiftReset.addEventListener('click', resetTempShift);

    // Fix My Palette
    initFixMyPalette();
  }

  applyTempShift(palette, shift) {
    return palette.map(c => colorFromHsl(c.h + shift, c.s, c.l));
  }

  generate(h, s, l) {
    let palette = generateHarmony(h, s, l, colorState.harmony);

    if (colorState.tempShift !== 0) {
      palette = this.applyTempShift(palette, colorState.tempShift);
    }

    if (colorState.accessibleMode) {
      palette = this.makeAccessible(palette, colorState.accessibleBg);
    }

    this.currentPalette = palette;
    this.renderSwatches(palette);
    this.drawColorWheel(palette);
    this.renderUIPreview(palette);
    this.expandedSwatchIdx = null;
    this.shadeScaleEl.classList.add('hidden');

    // Sync accessibility simulator
    if (window.accessibilityPanel) accessibilityPanel.updateSimulator(palette);
  }

  // ── Accessible Mode ───────────────────────────────────────
  makeAccessible(palette, bgHex) {
    const bg = hexToRgb(bgHex) || { r: 15, g: 15, b: 20 };
    return palette.map(c => {
      let { h, s } = c;
      let l = c.l;
      let attempts = 0;
      while (attempts < 20) {
        const ratio = contrastRatio(hslToRgb(h, s, l).r, hslToRgb(h, s, l).g, hslToRgb(h, s, l).b, bg.r, bg.g, bg.b);
        if (ratio >= 4.5) break;
        // Adjust lightness away from background
        const bgLum = relativeLuminance(bg.r, bg.g, bg.b);
        l = bgLum > 0.5 ? Math.max(5, l - 6) : Math.min(95, l + 6);
        attempts++;
      }
      return colorFromHsl(h, s, l);
    });
  }

  // ── Swatch Rendering ──────────────────────────────────────
  renderSwatches(palette) {
    this.swatchesEl.innerHTML = '';
    const bg = hexToRgb(colorState.accessibleBg) || { r: 15, g: 15, b: 20 };

    palette.forEach((color, idx) => {
      const ratio = contrastRatio(color.r, color.g, color.b, bg.r, bg.g, bg.b);
      const passAA  = ratio >= 4.5;
      const passAAA = ratio >= 7.0;

      const swatch = document.createElement('div');
      swatch.className = 'swatch';
      swatch.style.animationDelay = `${idx * 80}ms`;

      const badgesHtml = colorState.accessibleMode
        ? `<div class="swatch-badges">
            <span class="swatch-badge-${passAA ? 'pass' : 'fail'}">AA ${passAA ? '✓' : '✗'}</span>
            <span class="swatch-badge-${passAAA ? 'pass' : 'fail'}">AAA ${passAAA ? '✓' : '✗'}</span>
           </div>`
        : '';

      swatch.innerHTML = `
        <div class="swatch-block" style="background:${color.hex}; box-shadow: 0 2px 12px ${color.hex}44;"></div>
        <div class="swatch-hex">${color.hex}</div>
        <div class="swatch-name">${color.name}</div>
        ${badgesHtml}
      `;

      // Click: copy hex + seed explorer
      swatch.addEventListener('click', () => {
        showToast(`Copied ${color.hex}`);
        navigator.clipboard.writeText(color.hex).catch(() => {});
        // Seed explorer
        const rgb = { r: color.r, g: color.g, b: color.b };
        window.mainSetColor && mainSetColor(rgb.r, rgb.g, rgb.b);
      });

      // Double-click / long-press: open shade scale
      let longPressTimer = null;
      swatch.addEventListener('dblclick', () => this.toggleShadeScale(idx, color));
      swatch.addEventListener('pointerdown', () => {
        longPressTimer = setTimeout(() => this.toggleShadeScale(idx, color), 500);
      });
      swatch.addEventListener('pointerup',    () => clearTimeout(longPressTimer));
      swatch.addEventListener('pointerleave', () => clearTimeout(longPressTimer));

      this.swatchesEl.appendChild(swatch);
    });
  }

  // ── Shade Scale ───────────────────────────────────────────
  toggleShadeScale(idx, color) {
    if (this.expandedSwatchIdx === idx) {
      this.expandedSwatchIdx = null;
      this.shadeScaleEl.classList.add('hidden');
      return;
    }
    this.expandedSwatchIdx = idx;
    this.renderShadeScale(color);
    this.shadeScaleEl.classList.remove('hidden');
  }

  renderShadeScale(color) {
    const steps = generateShadeScale(color.h, color.s);
    this.shadeScaleEl.innerHTML = `<div class="shade-scale-title">${color.name} — Tint/Shade Scale</div>
      <div class="shade-scale-row">
        ${steps.map(step => `
          <div class="shade-step" data-hex="${step.hex}" title="${step.hex}">
            <div class="shade-block" style="background:${step.hex};"></div>
            <div class="shade-step-label">${step.step}</div>
          </div>
        `).join('')}
      </div>`;

    this.shadeScaleEl.querySelectorAll('.shade-step').forEach(el => {
      el.addEventListener('click', () => {
        showToast(`Copied ${el.dataset.hex}`);
        navigator.clipboard.writeText(el.dataset.hex).catch(() => {});
      });
    });
  }

  // ── Color Wheel Canvas ────────────────────────────────────
  drawColorWheel(palette) {
    const canvas = this.wheelCanvas;
    const ctx    = canvas.getContext('2d');
    const size   = canvas.width;
    const cx = size / 2;
    const cy = size / 2;
    const outerR = cx - 4;
    const innerR = outerR * 0.55;

    ctx.clearRect(0, 0, size, size);

    // Hue ring — 1 degree at a time
    for (let deg = 0; deg < 360; deg++) {
      const a0 = (deg - 90 - 0.5) * Math.PI / 180;
      const a1 = (deg - 90 + 1.5) * Math.PI / 180;
      const rgb = hslToRgb(deg, 100, 50);
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, outerR, a0, a1);
      ctx.closePath();
      ctx.fillStyle = `rgb(${rgb.r},${rgb.g},${rgb.b})`;
      ctx.fill();
    }

    // Inner mask
    ctx.beginPath();
    ctx.arc(cx, cy, innerR, 0, Math.PI * 2);
    ctx.fillStyle = '#1a1a24';
    ctx.fill();

    // Palette color dots
    palette.forEach(color => {
      const angle = (color.h - 90) * Math.PI / 180;
      const r = (outerR + innerR) / 2;
      const x = cx + r * Math.cos(angle);
      const y = cy + r * Math.sin(angle);
      ctx.beginPath();
      ctx.arc(x, y, 7, 0, Math.PI * 2);
      ctx.fillStyle = color.hex;
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.8)';
      ctx.lineWidth = 2;
      ctx.stroke();
    });

    // Connect dots with lines
    if (palette.length > 1) {
      ctx.beginPath();
      palette.forEach((color, i) => {
        const angle = (color.h - 90) * Math.PI / 180;
        const r = (outerR + innerR) / 2;
        const x = cx + r * Math.cos(angle);
        const y = cy + r * Math.sin(angle);
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      });
      ctx.closePath();
      ctx.strokeStyle = 'rgba(255,255,255,0.2)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }

  // ── UI Preview ────────────────────────────────────────────
  renderUIPreview(palette) {
    if (!palette || palette.length < 2) return;
    const [p0, p1, p2, p3, p4] = palette;
    const base    = p0;
    const accent  = p1 || p0;
    const comp    = p2 || p0;
    const light   = palette.find(c => c.l > 55) || p0;
    const dark    = palette.find(c => c.l < 40) || p0;

    // Nav: bg=base, text=auto-contrast white or dark
    const navTextColor = relativeLuminance(base.r, base.g, base.b) > 0.3 ? '#0f0f14' : '#ffffff';
    this.previewNav.style.background = base.hex;
    this.previewNav.style.color      = navTextColor;

    // Card: bg=panel-alt tinted, border=accent
    const cardTextColor = '#e0e0f0';
    this.previewCard.style.background   = `color-mix(in srgb, ${dark.hex} 20%, #1a1a24)`;
    this.previewCard.style.borderColor  = accent.hex;
    this.previewCard.style.color        = cardTextColor;
    this.previewCardTitle.style.color   = light.hex;
    this.previewCardBody.style.color    = '#b0b0c8';

    // Button: bg=accent
    const btnText = relativeLuminance(accent.r, accent.g, accent.b) > 0.3 ? '#0f0f14' : '#ffffff';
    this.previewBtn.style.background = accent.hex;
    this.previewBtn.style.color      = btnText;
    this.previewBtn.style.border     = 'none';

    // Badge: bg=comp
    const badgeText = relativeLuminance(comp.r, comp.g, comp.b) > 0.3 ? '#0f0f14' : '#ffffff';
    this.previewBadge.style.background = comp.hex;
    this.previewBadge.style.color      = badgeText;

    // Input border
    this.previewInput.style.borderColor = accent.hex;
    this.previewInput.style.color       = '#e0e0f0';
  }

  // ── Pin / Compare ─────────────────────────────────────────
  pinCurrentPalette() {
    if (!this.currentPalette.length) return;
    if (this.pinnedPalettes.length >= 2) this.pinnedPalettes.shift();
    this.pinnedPalettes.push([...this.currentPalette]);
    this.renderPinnedPalettes();
    showToast('Palette pinned!');
  }

  renderPinnedPalettes() {
    if (!this.pinnedPalettes.length) {
      this.pinnedEl.classList.add('hidden');
      return;
    }
    this.pinnedEl.classList.remove('hidden');
    this.pinnedCont.innerHTML = '';

    this.pinnedPalettes.forEach((palette, pi) => {
      const row = document.createElement('div');
      row.className = 'pinned-row';
      row.innerHTML = `<span class="pinned-label">${pi + 1}</span>`;
      palette.forEach(color => {
        const sw = document.createElement('div');
        sw.className = 'pinned-swatch';
        sw.style.background = color.hex;
        sw.title = `${color.hex} — ${color.name}`;
        sw.addEventListener('click', () => {
          showToast(`Copied ${color.hex}`);
          navigator.clipboard.writeText(color.hex).catch(() => {});
        });
        row.appendChild(sw);
      });

      const clearBtn = document.createElement('button');
      clearBtn.textContent = '✕';
      clearBtn.title = 'Remove';
      clearBtn.style.cssText = 'margin-left:auto;font-size:0.7rem;color:var(--text-muted);background:none;border:none;cursor:pointer;padding:4px;';
      clearBtn.addEventListener('click', () => {
        this.pinnedPalettes.splice(pi, 1);
        this.renderPinnedPalettes();
      });
      row.appendChild(clearBtn);
      this.pinnedCont.appendChild(row);
    });
  }

  // ── Randomize ─────────────────────────────────────────────
  randomize() {
    const h = Math.random() * 360;
    const s = 55 + Math.random() * 40;
    const l = 40 + Math.random() * 20;
    const rgb = hslToRgb(h, s, l);
    if (window.mainSetColor) mainSetColor(rgb.r, rgb.g, rgb.b);
    else this.generate(h, s, l);
  }
}

// ── Fix My Palette ─────────────────────────────────────────────
let fixColors = [];

function initFixMyPalette() {
  const addBtn     = document.getElementById('fix-palette-add-btn');
  const analyzeBtn = document.getElementById('fix-palette-analyze-btn');
  const clearBtn   = document.getElementById('fix-palette-clear-btn');
  if (!addBtn) return;

  addFixColorRow('#040D1E');
  addFixColorRow('#C8E8FF');

  addBtn.addEventListener('click', () => {
    if (fixColors.length >= 6) { showToast('Maximum 6 colors'); return; }
    addFixColorRow('#888888');
  });

  clearBtn.addEventListener('click', () => {
    fixColors = [];
    document.getElementById('fix-palette-inputs').innerHTML = '';
    const resultsEl = document.getElementById('fix-palette-results');
    resultsEl.innerHTML = '';
    resultsEl.classList.add('hidden');
    addFixColorRow('#040D1E');
    addFixColorRow('#C8E8FF');
  });

  analyzeBtn.addEventListener('click', runFixAnalysis);
}

function addFixColorRow(defaultHex) {
  if (fixColors.length >= 6) return;
  const idx = fixColors.length;
  fixColors.push(defaultHex);

  const inputsEl = document.getElementById('fix-palette-inputs');
  const row = document.createElement('div');
  row.className = 'fix-color-row';
  row.dataset.idx = idx;

  const swatch = document.createElement('div');
  swatch.className = 'fix-color-swatch';
  swatch.style.background = defaultHex;

  const picker = document.createElement('input');
  picker.type = 'color';
  picker.className = 'fix-color-picker';
  picker.value = defaultHex.toLowerCase();

  const hexIn = document.createElement('input');
  hexIn.type = 'text';
  hexIn.className = 'rd-hex-input';
  hexIn.value = defaultHex.toUpperCase();
  hexIn.maxLength = 7;
  hexIn.spellcheck = false;

  const removeBtn = document.createElement('button');
  removeBtn.className = 'fix-color-remove';
  removeBtn.textContent = '✕';
  removeBtn.title = 'Remove color';

  picker.addEventListener('input', () => {
    const i = parseInt(row.dataset.idx);
    fixColors[i] = picker.value;
    swatch.style.background = picker.value;
    hexIn.value = picker.value.toUpperCase();
  });

  hexIn.addEventListener('input', () => {
    const parsed = parseFixHex(hexIn.value);
    if (parsed) {
      const i = parseInt(row.dataset.idx);
      fixColors[i] = parsed;
      swatch.style.background = parsed;
      picker.value = parsed;
    }
  });

  hexIn.addEventListener('blur', () => {
    const parsed = parseFixHex(hexIn.value);
    const i = parseInt(row.dataset.idx);
    hexIn.value = (parsed || fixColors[i]).toUpperCase();
  });

  removeBtn.addEventListener('click', () => {
    const i = parseInt(row.dataset.idx);
    fixColors.splice(i, 1);
    row.remove();
    document.querySelectorAll('.fix-color-row').forEach((r, newIdx) => { r.dataset.idx = newIdx; });
    const resultsEl = document.getElementById('fix-palette-results');
    resultsEl.innerHTML = '';
    resultsEl.classList.add('hidden');
  });

  row.appendChild(swatch);
  row.appendChild(picker);
  row.appendChild(hexIn);
  row.appendChild(removeBtn);
  inputsEl.appendChild(row);
}

function parseFixHex(val) {
  val = val.trim().replace(/^#/, '');
  if (val.length === 3) val = val[0]+val[0]+val[1]+val[1]+val[2]+val[2];
  if (!/^[0-9a-fA-F]{6}$/.test(val)) return null;
  return '#' + val.toLowerCase();
}

function runFixAnalysis() {
  const resultsEl = document.getElementById('fix-palette-results');
  if (fixColors.length < 2) { showToast('Add at least 2 colors to analyze'); return; }

  resultsEl.innerHTML = '';
  resultsEl.classList.remove('hidden');

  const pairs = [];
  for (let i = 0; i < fixColors.length; i++) {
    for (let j = i + 1; j < fixColors.length; j++) {
      const c1 = hexToRgb(fixColors[i]);
      const c2 = hexToRgb(fixColors[j]);
      if (!c1 || !c2) continue;
      const ratio = contrastRatio(c1.r, c1.g, c1.b, c2.r, c2.g, c2.b);
      pairs.push({ hex1: fixColors[i], c1, hex2: fixColors[j], c2, ratio, idx1: i, idx2: j });
    }
  }

  pairs.sort((a, b) => a.ratio - b.ratio);

  const failCount = pairs.filter(p => p.ratio < 4.5).length;
  const headerEl = document.createElement('div');
  headerEl.className = 'fix-results-header';
  headerEl.textContent = `${pairs.length} pair${pairs.length !== 1 ? 's' : ''} · ${failCount} fail AA`;
  headerEl.style.color = failCount > 0 ? '#ff8888' : '#44dd99';
  resultsEl.appendChild(headerEl);

  pairs.forEach(pair => {
    const passAA  = pair.ratio >= 4.5;
    const passAAA = pair.ratio >= 7;

    const pairEl = document.createElement('div');
    pairEl.className = 'fix-pair-row' + (passAA ? '' : ' fix-pair-fail');

    const sw1 = document.createElement('div');
    sw1.className = 'fix-pair-swatch';
    sw1.style.background = pair.hex1;
    sw1.title = pair.hex1.toUpperCase();

    const sw2 = document.createElement('div');
    sw2.className = 'fix-pair-swatch';
    sw2.style.background = pair.hex2;
    sw2.title = pair.hex2.toUpperCase();

    const ratioEl = document.createElement('div');
    ratioEl.className = 'fix-pair-ratio';
    ratioEl.textContent = pair.ratio.toFixed(2) + ':1';

    const gradeEl = document.createElement('span');
    gradeEl.className = passAAA ? 'swatch-badge-pass' : passAA ? 'swatch-badge-pass' : 'swatch-badge-fail';
    gradeEl.textContent = passAAA ? 'AAA' : passAA ? 'AA' : 'Fail';

    pairEl.appendChild(sw1);
    pairEl.appendChild(sw2);
    pairEl.appendChild(ratioEl);
    pairEl.appendChild(gradeEl);

    if (!passAA) {
      const fixBtn = document.createElement('button');
      fixBtn.className = 'action-btn fix-pair-fix-btn';
      fixBtn.textContent = 'Fix';
      fixBtn.title = 'Auto-adjust to reach WCAG AA (4.5:1)';
      fixBtn.addEventListener('click', () => fixPair(pair.idx1, pair.idx2, pair.c1, pair.c2));
      pairEl.appendChild(fixBtn);
    }

    resultsEl.appendChild(pairEl);
  });
}

function fixPair(idx1, idx2, c1, c2) {
  const lum1 = relativeLuminance(c1.r, c1.g, c1.b);
  const lum2 = relativeLuminance(c2.r, c2.g, c2.b);

  // Adjust the lighter color (push further toward white to increase contrast)
  const adjustIdx = lum1 >= lum2 ? idx1 : idx2;
  const adjustC   = lum1 >= lum2 ? c1 : c2;
  const otherLum  = Math.min(lum1, lum2);

  const { h, s } = rgbToHsl(adjustC.r, adjustC.g, adjustC.b);

  const trySweep = (startL, step, maxSteps) => {
    for (let i = 0; i <= maxSteps; i++) {
      const l = Math.max(2, Math.min(98, startL + i * step));
      const rgb = hslToRgb(h, s, l);
      const adjLum = relativeLuminance(rgb.r, rgb.g, rgb.b);
      const hi = Math.max(adjLum, otherLum), lo = Math.min(adjLum, otherLum);
      if ((hi + 0.05) / (lo + 0.05) >= 4.5) return rgbToHex(rgb.r, rgb.g, rgb.b);
    }
    return null;
  };

  const { l: startL } = rgbToHsl(adjustC.r, adjustC.g, adjustC.b);
  const fixed = trySweep(startL, 1, 95) || trySweep(startL, -1, 95);

  if (fixed) {
    fixColors[adjustIdx] = fixed;
    updateFixColorRow(adjustIdx, fixed);
    showToast('Fixed! Re-analyzing…');
    runFixAnalysis();
  } else {
    showToast('Could not fix automatically');
  }
}

function updateFixColorRow(idx, newHex) {
  const row = document.querySelector(`.fix-color-row[data-idx="${idx}"]`);
  if (!row) return;
  const swatch = row.querySelector('.fix-color-swatch');
  const picker = row.querySelector('.fix-color-picker');
  const hexIn  = row.querySelector('.rd-hex-input');
  if (swatch) swatch.style.background = newHex;
  if (picker) picker.value = newHex.toLowerCase();
  if (hexIn)  hexIn.value  = newHex.toUpperCase();
}
