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
  }

  generate(h, s, l) {
    let palette = generateHarmony(h, s, l, colorState.harmony);

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
