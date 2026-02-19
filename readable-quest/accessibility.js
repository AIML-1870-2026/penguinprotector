/* ============================================================
   accessibility.js — Contrast Checker + Color Blindness Simulator
   ============================================================ */

class AccessibilityPanel {
  init() {
    this.fgInput  = document.getElementById('fg-color');
    this.bgInput  = document.getElementById('bg-color');
    this.fgHexEl  = document.getElementById('fg-hex');
    this.bgHexEl  = document.getElementById('bg-hex');
    this.preview  = document.getElementById('contrast-preview');
    this.sampleEl = document.getElementById('contrast-sample-text');
    this.ratioEl  = document.getElementById('contrast-ratio');
    this.badgesEl = document.getElementById('contrast-badges');
    this.cbRows   = document.getElementById('colorblind-rows');

    this.fgInput.addEventListener('input', () => this.updateContrast());
    this.bgInput.addEventListener('input', () => this.updateContrast());

    this.updateContrast();
    this.renderSimulatorPlaceholder();
  }

  // ── Contrast Checker ──────────────────────────────────────
  updateContrast() {
    const fg = hexToRgb(this.fgInput.value);
    const bg = hexToRgb(this.bgInput.value);
    if (!fg || !bg) return;

    this.fgHexEl.textContent = this.fgInput.value;
    this.bgHexEl.textContent = this.bgInput.value;

    this.preview.style.background = this.bgInput.value;
    this.sampleEl.style.color     = this.fgInput.value;

    const ratio = contrastRatio(fg.r, fg.g, fg.b, bg.r, bg.g, bg.b);
    this.ratioEl.textContent = ratio.toFixed(2) + ':1';

    this.renderContrastBadges(ratio);
  }

  renderContrastBadges(ratio) {
    const tests = [
      { label: 'AA Normal',  threshold: 4.5 },
      { label: 'AA Large',   threshold: 3.0 },
      { label: 'AAA Normal', threshold: 7.0 },
      { label: 'AAA Large',  threshold: 4.5 },
    ];
    this.badgesEl.innerHTML = tests.map(t => {
      const pass = ratio >= t.threshold;
      return `<span class="contrast-badge badge-${pass ? 'pass' : 'fail'}">${t.label} ${pass ? '✓' : '✗'}</span>`;
    }).join('');
  }

  // ── Color Blindness Simulator ─────────────────────────────
  updateSimulator(palette) {
    if (!palette || !palette.length) return;
    this.cbRows.innerHTML = '';

    const types = [
      { key: 'protanopia',   label: 'Protanopia (red-blind)' },
      { key: 'deuteranopia', label: 'Deuteranopia (green-blind)' },
      { key: 'tritanopia',   label: 'Tritanopia (blue-blind)' },
    ];

    types.forEach(({ key, label }) => {
      const row = document.createElement('div');
      row.className = 'colorblind-row';

      const swatchesHtml = palette.map(color => {
        const sim = simulateColorBlindness(color.r, color.g, color.b, key);
        const hex = rgbToHex(sim.r, sim.g, sim.b);
        return `<div class="colorblind-swatch" style="background:${hex}" title="${hex} (${color.hex} simulated)"></div>`;
      }).join('');

      row.innerHTML = `
        <div class="colorblind-row-label">${label}</div>
        <div class="colorblind-swatches">${swatchesHtml}</div>
      `;
      this.cbRows.appendChild(row);
    });
  }

  renderSimulatorPlaceholder() {
    this.cbRows.innerHTML = `<div style="font-size:0.78rem;color:var(--text-muted);padding:0.25rem 0">
      Generate a palette to see color blindness simulations.
    </div>`;
  }
}
