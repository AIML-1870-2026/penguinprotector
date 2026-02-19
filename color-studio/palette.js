/* Palette Generator — harmony swatches, color wheel diagram, sample card */

const Palette = (() => {
    let wheelCanvas, wheelCtx;
    let currentPalette = [];
    let onSwatchClick = null;

    function init(wheelEl, swatchClickCb) {
        wheelCanvas = wheelEl;
        wheelCtx = wheelEl ? wheelEl.getContext('2d') : null;
        onSwatchClick = swatchClickCb;
    }

    function generate(baseRgb, harmonyType, accessibleMode, accessibleBg, pairContrastMode) {
        const hsl = rgbToHsl(baseRgb.r, baseRgb.g, baseRgb.b);
        let colors = generateHarmony(hsl.h, hsl.s, hsl.l, harmonyType);

        // Convert all to RGB
        currentPalette = colors.map(c => {
            const rgb = hslToRgb(c.h, c.s, c.l);
            return { ...rgb, h: c.h, s: c.s, l: c.l };
        });

        // Accessible mode: adjust lightness to meet AA contrast against background
        if (accessibleMode && accessibleBg) {
            const bgRgb = hexToRgb(accessibleBg);
            currentPalette = currentPalette.map(c => {
                let { h, s, l } = rgbToHsl(c.r, c.g, c.b);
                let rgb = { r: c.r, g: c.g, b: c.b };
                let ratio = contrastRatio(rgb, bgRgb);
                let attempts = 0;

                // Try adjusting lightness up or down to hit 4.5:1
                const bgLum = relativeLuminance(bgRgb.r, bgRgb.g, bgRgb.b);
                const direction = bgLum < 0.5 ? 1 : -1; // lighten on dark bg, darken on light bg

                while (ratio < 4.5 && attempts < 100) {
                    l = Math.max(0, Math.min(100, l + direction * 1));
                    rgb = hslToRgb(h, s, l);
                    ratio = contrastRatio(rgb, bgRgb);
                    attempts++;
                }

                return { ...rgb, h, s, l, meetsAA: ratio >= 4.5 };
            });
        } else {
            // Check contrast for badge display
            const bgRgb = hexToRgb('#0f0f14');
            currentPalette = currentPalette.map(c => {
                const ratio = contrastRatio(c, bgRgb);
                return { ...c, meetsAA: ratio >= 4.5 };
            });
        }

        // Pair contrast mode: adjust each color so it has AA contrast with the previous one
        if (pairContrastMode) {
            currentPalette = enforcePairContrast(currentPalette);
        }

        return currentPalette;
    }

    function enforcePairContrast(palette) {
        if (palette.length < 2) return palette;
        const result = [{ ...palette[0], pairRatio: null, pairOk: true }];

        for (let i = 1; i < palette.length; i++) {
            let { h, s, l } = palette[i];
            const prev = result[i - 1];
            let rgb = hslToRgb(h, s, l);
            let ratio = contrastRatio(rgb, prev);

            if (ratio < 4.5) {
                // Push lightness away from the previous color's luminance
                const prevLum = relativeLuminance(prev.r, prev.g, prev.b);
                const direction = prevLum < 0.5 ? 1 : -1; // lighter if prev is dark, darker if prev is light
                let attempts = 0;
                while (ratio < 4.5 && attempts < 100) {
                    l = Math.max(0, Math.min(100, l + direction * 1));
                    rgb = hslToRgb(h, s, l);
                    ratio = contrastRatio(rgb, prev);
                    attempts++;
                }
            }

            const rounded = Math.round(ratio * 10) / 10;
            result.push({ ...rgb, h, s, l, pairRatio: rounded, pairOk: ratio >= 4.5 });
        }

        return result;
    }

    function renderSwatches(container, palette, accessibleMode, pairContrastMode) {
        container.innerHTML = '';
        palette.forEach((c, i) => {
            const hex = rgbToHex(c.r, c.g, c.b);
            const name = nearestColorName(c.r, c.g, c.b);

            const swatch = document.createElement('div');
            swatch.className = 'swatch';
            swatch.style.animationDelay = `${i * 80}ms`;

            let badgeHtml = '';
            if (pairContrastMode && i > 0) {
                const ratio = c.pairRatio ?? 0;
                const passes = c.pairOk !== false;
                badgeHtml = `<span class="swatch-badge" style="color:${passes ? '#4ade80' : '#f87171'}">${ratio}:1</span>`;
            } else if (accessibleMode) {
                badgeHtml = c.meetsAA
                    ? '<span class="swatch-badge" style="color:#4ade80">&#10003;</span>'
                    : '<span class="swatch-badge" style="color:#f87171">&#9888;</span>';
            }

            swatch.innerHTML = `
                <div class="swatch-color" style="background:${hex}">${badgeHtml}</div>
                <div class="swatch-info">
                    <span class="swatch-hex">${hex}</span>
                    <span class="swatch-name">${name}</span>
                </div>
            `;

            swatch.addEventListener('click', () => {
                copyToClipboard(hex);
                if (onSwatchClick) onSwatchClick(c);
            });

            container.appendChild(swatch);
        });
    }

    function drawWheel(palette) {
        const w = wheelCanvas.width;
        const h = wheelCanvas.height;
        const cx = w / 2;
        const cy = h / 2;
        const outerR = Math.min(cx, cy) - 10;
        const innerR = outerR - 20;

        wheelCtx.clearRect(0, 0, w, h);

        // Draw hue ring
        for (let deg = 0; deg < 360; deg++) {
            const startAngle = (deg - 90) * Math.PI / 180;
            const endAngle = (deg - 89) * Math.PI / 180;
            const rgb = hslToRgb(deg, 80, 55);
            wheelCtx.beginPath();
            wheelCtx.arc(cx, cy, outerR, startAngle, endAngle);
            wheelCtx.arc(cx, cy, innerR, endAngle, startAngle, true);
            wheelCtx.closePath();
            wheelCtx.fillStyle = `rgb(${rgb.r},${rgb.g},${rgb.b})`;
            wheelCtx.fill();
        }

        // Draw palette dots
        palette.forEach((c, i) => {
            const hsl = rgbToHsl(c.r, c.g, c.b);
            const angle = (hsl.h - 90) * Math.PI / 180;
            const dotR = (outerR + innerR) / 2;
            const dx = cx + dotR * Math.cos(angle);
            const dy = cy + dotR * Math.sin(angle);

            wheelCtx.beginPath();
            wheelCtx.arc(dx, dy, 8, 0, Math.PI * 2);
            wheelCtx.fillStyle = rgbToHex(c.r, c.g, c.b);
            wheelCtx.strokeStyle = '#fff';
            wheelCtx.lineWidth = 2;
            wheelCtx.fill();
            wheelCtx.stroke();

            // Base color gets a larger ring
            if (i === 0) {
                wheelCtx.beginPath();
                wheelCtx.arc(dx, dy, 11, 0, Math.PI * 2);
                wheelCtx.strokeStyle = '#fff';
                wheelCtx.lineWidth = 2;
                wheelCtx.stroke();
            }
        });
    }

    function updateSampleCard(cardEl, palette) {
        if (palette.length < 2) return;
        const bg = rgbToHex(palette[0].r, palette[0].g, palette[0].b);
        const accent = rgbToHex(palette[1].r, palette[1].g, palette[1].b);

        // Determine text color based on luminance of bg
        const bgLum = relativeLuminance(palette[0].r, palette[0].g, palette[0].b);
        const textColor = bgLum > 0.5 ? '#111' : '#f0f0f0';

        cardEl.style.background = bg;
        cardEl.style.color = textColor;
        cardEl.style.borderColor = accent;

        const btn = cardEl.querySelector('.sample-btn');
        if (btn) {
            btn.style.background = accent;
            const accentLum = relativeLuminance(palette[1].r, palette[1].g, palette[1].b);
            btn.style.color = accentLum > 0.5 ? '#111' : '#fff';
        }
    }

    function renderCVD(palette) {
        ['protanopia', 'deuteranopia', 'tritanopia'].forEach(type => {
            const row = document.querySelector(`#cvd-${type} .cvd-swatches`);
            if (!row) return;
            row.innerHTML = '';
            palette.forEach(c => {
                const sim = simulateCVD(c.r, c.g, c.b, type);
                const div = document.createElement('div');
                div.className = 'cvd-swatch';
                div.style.background = rgbToHex(sim.r, sim.g, sim.b);
                row.appendChild(div);
            });
        });
    }

    function getPalette() {
        return currentPalette;
    }

    return { init, generate, renderSwatches, drawWheel, updateSampleCard, renderCVD, getPalette };
})();

/* ─── Confetti ──────────────────────────────────────────────────────────── */
let _confettiX = 0, _confettiY = 0;
document.addEventListener('click', e => { _confettiX = e.clientX; _confettiY = e.clientY; });

function spawnConfetti(x, y) {
    const colors = ['#ff6b6b','#ff9f43','#ffd32a','#6bcb77','#4ea8de','#a29bfe','#fd79a8','#fdcb6e'];
    for (let i = 0; i < 22; i++) {
        const el = document.createElement('div');
        el.className = 'confetti-particle';
        const vx = (Math.random() - 0.5) * 170;
        const vy = -(Math.random() * 150 + 40);
        el.style.cssText = `left:${x}px;top:${y}px;background:${colors[Math.floor(Math.random()*colors.length)]};--vx:${vx}px;--vy:${vy}px;`;
        document.body.appendChild(el);
        el.addEventListener('animationend', () => el.remove());
    }
}

function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        const toast = document.getElementById('toast');
        toast.textContent = `Copied ${text}`;
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 1500);
        spawnConfetti(_confettiX, _confettiY);
    });
}
