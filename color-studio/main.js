/* Main — shared state, UI wiring, integration between Explorer and Palette */

const colorState = {
    r: 200, g: 100, b: 150,
    harmony: 'complementary',
    accessibleMode: false,
    accessibleBg: '#0f0f14',
    paletteContrastMode: false
};

document.addEventListener('DOMContentLoaded', () => {
    // DOM refs
    const sliderR = document.getElementById('slider-r');
    const sliderG = document.getElementById('slider-g');
    const sliderB = document.getElementById('slider-b');
    const valR = document.getElementById('val-r');
    const valG = document.getElementById('val-g');
    const valB = document.getElementById('val-b');
    const dotR = document.getElementById('dot-r');
    const dotG = document.getElementById('dot-g');
    const dotB = document.getElementById('dot-b');
    const hexCode = document.getElementById('hex-code');
    const rgbCode = document.getElementById('rgb-code');
    const colorPreview = document.getElementById('color-preview');
    const swatchesEl = document.getElementById('swatches');
    const sampleCard = document.getElementById('sample-card');
    const randomizeBtn = document.getElementById('randomize-btn');
    const accessibleToggle = document.getElementById('accessible-mode-toggle');
    const accessibleBgInput = document.getElementById('accessible-bg');
    const accessibleBgHex = document.getElementById('accessible-bg-hex');

    // Init modules
    Explorer.initWheel(document.getElementById('explorer-wheel'));
    Palette.init(null, onSwatchClick);
    Accessibility.init();
    GradientBuilder.init();
    ColorGame.init();
    ColorMixer.init(rgb => {
        colorState.r = rgb.r; colorState.g = rgb.g; colorState.b = rgb.b;
        document.getElementById('slider-r').value = rgb.r;
        document.getElementById('slider-g').value = rgb.g;
        document.getElementById('slider-b').value = rgb.b;
        updateAll();
    });
    ImageExtractor.init();
    ImageExtractor.setOnColorPick(rgb => {
        colorState.r = rgb.r; colorState.g = rgb.g; colorState.b = rgb.b;
        document.getElementById('slider-r').value = rgb.r;
        document.getElementById('slider-g').value = rgb.g;
        document.getElementById('slider-b').value = rgb.b;
        updateAll();
        // Switch to explorer tab so the user can see the picked color
        document.querySelector('[data-tab="explorer"]').click();
    });

    // Background preset buttons — change the explorer panel, page, and header background
    const explorerPanel = document.getElementById('explorer-panel');
    const siteHeader = document.querySelector('header');

    function darkenHex(hex, factor) {
        const r = Math.round(parseInt(hex.slice(1, 3), 16) * factor);
        const g = Math.round(parseInt(hex.slice(3, 5), 16) * factor);
        const b = Math.round(parseInt(hex.slice(5, 7), 16) * factor);
        return `rgb(${r}, ${g}, ${b})`;
    }

    function applyPreset(hex) {
        explorerPanel.style.backgroundColor = hex;
        document.body.style.backgroundColor = hex;
        siteHeader.style.backgroundColor = darkenHex(hex, 0.75);

        // Switch to dark text on light body backgrounds
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        const brightness = (r * 299 + g * 587 + b * 114) / 1000;
        document.body.classList.toggle('theme-light', brightness > 128);

        // Separate check for header (which is 60% darker than preset)
        const hr = Math.round(r * 0.75), hg = Math.round(g * 0.75), hb = Math.round(b * 0.75);
        const headerBrightness = (hr * 299 + hg * 587 + hb * 114) / 1000;
        siteHeader.classList.toggle('header-light', headerBrightness > 100);

        // Re-evaluate rainbow-text color and slider tracks for new theme
        updatePalette();
    }

    applyPreset('#000000'); // match initial active preset
    document.querySelectorAll('.bg-preset').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.bg-preset').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            applyPreset(btn.dataset.bg);
        });
    });


    // Tab switching
    const allPanelIds = ['explorer-panel', 'palette-panel', 'accessibility-panel', 'custom-panel', 'gradient-panel', 'game-panel', 'mix-panel', 'image-panel'];
    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            const mode = tab.dataset.tab;
            allPanelIds.forEach(id => document.getElementById(id).classList.remove('hidden'));
            const hide = (...ids) => ids.forEach(id => document.getElementById(id).classList.add('hidden'));
            if (mode === 'both')               hide('accessibility-panel', 'custom-panel', 'gradient-panel', 'game-panel', 'mix-panel', 'image-panel');
            else if (mode === 'explorer')      hide('palette-panel', 'accessibility-panel', 'custom-panel', 'gradient-panel', 'game-panel', 'mix-panel', 'image-panel');
            else if (mode === 'palette')       hide('explorer-panel', 'accessibility-panel', 'custom-panel', 'gradient-panel', 'game-panel', 'mix-panel', 'image-panel');
            else if (mode === 'accessibility') hide('explorer-panel', 'palette-panel', 'custom-panel', 'gradient-panel', 'game-panel', 'mix-panel', 'image-panel');
            else if (mode === 'custom')        hide('explorer-panel', 'palette-panel', 'accessibility-panel', 'gradient-panel', 'game-panel', 'mix-panel', 'image-panel');
            else if (mode === 'gradient')      hide('explorer-panel', 'palette-panel', 'accessibility-panel', 'custom-panel', 'game-panel', 'mix-panel', 'image-panel');
            else if (mode === 'game')          hide('explorer-panel', 'palette-panel', 'accessibility-panel', 'custom-panel', 'gradient-panel', 'mix-panel', 'image-panel');
            else if (mode === 'mix')           hide('explorer-panel', 'palette-panel', 'accessibility-panel', 'custom-panel', 'gradient-panel', 'game-panel', 'image-panel');
            else if (mode === 'image')         hide('explorer-panel', 'palette-panel', 'accessibility-panel', 'custom-panel', 'gradient-panel', 'game-panel', 'mix-panel');
        });
    });

    // Set initial tab state — hide secondary panels
    document.getElementById('accessibility-panel').classList.add('hidden');
    document.getElementById('custom-panel').classList.add('hidden');
    document.getElementById('gradient-panel').classList.add('hidden');
    document.getElementById('game-panel').classList.add('hidden');
    document.getElementById('mix-panel').classList.add('hidden');
    document.getElementById('image-panel').classList.add('hidden');

    // Harmony buttons
    document.querySelectorAll('.harmony-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.harmony-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            colorState.harmony = btn.dataset.harmony;
            updatePalette();
        });
    });

    // Sliders
    function onSliderChange() {
        colorState.r = parseInt(sliderR.value);
        colorState.g = parseInt(sliderG.value);
        colorState.b = parseInt(sliderB.value);
        updateAll();
    }

    sliderR.addEventListener('input', onSliderChange);
    sliderG.addEventListener('input', onSliderChange);
    sliderB.addEventListener('input', onSliderChange);

    // Hex click to copy
    hexCode.addEventListener('click', () => {
        copyToClipboard(hexCode.textContent);
    });

    // Randomize
    randomizeBtn.addEventListener('click', () => {
        colorState.r = Math.floor(Math.random() * 256);
        colorState.g = Math.floor(Math.random() * 256);
        colorState.b = Math.floor(Math.random() * 256);
        sliderR.value = colorState.r;
        sliderG.value = colorState.g;
        sliderB.value = colorState.b;
        updateAll();
    });

    // Accessible mode
    accessibleToggle.addEventListener('change', () => {
        colorState.accessibleMode = accessibleToggle.checked;
        updatePalette();
    });

    // Palette pair contrast mode
    document.getElementById('palette-contrast-toggle').addEventListener('change', e => {
        colorState.paletteContrastMode = e.target.checked;
        updatePalette();
    });

    accessibleBgInput.addEventListener('input', () => {
        colorState.accessibleBg = accessibleBgInput.value;
        accessibleBgHex.textContent = accessibleBgInput.value;
        updatePalette();
    });

    // Swatch click → set as explorer color
    function onSwatchClick(rgb) {
        colorState.r = rgb.r;
        colorState.g = rgb.g;
        colorState.b = rgb.b;
        sliderR.value = rgb.r;
        sliderG.value = rgb.g;
        sliderB.value = rgb.b;
        updateAll();
    }

    // Update everything
    function updateAll() {
        valR.textContent = colorState.r;
        valG.textContent = colorState.g;
        valB.textContent = colorState.b;

        const hex = rgbToHex(colorState.r, colorState.g, colorState.b);
        hexCode.textContent = hex;
        rgbCode.textContent = `rgb(${colorState.r}, ${colorState.g}, ${colorState.b})`;

        const hsl  = rgbToHsl(colorState.r, colorState.g, colorState.b);
        const cmyk = rgbToCmyk(colorState.r, colorState.g, colorState.b);
        document.getElementById('hsl-code').textContent =
            `hsl(${Math.round(hsl.h)}, ${Math.round(hsl.s)}%, ${Math.round(hsl.l)}%)`;
        document.getElementById('cmyk-code').textContent =
            `cmyk(${cmyk.c}%, ${cmyk.m}%, ${cmyk.y}%, ${cmyk.k}%)`;
        document.getElementById('color-name-tag').textContent =
            `≈ ${nearestColorName(colorState.r, colorState.g, colorState.b)}`;

        GradientBuilder.setColorA(colorState.r, colorState.g, colorState.b);
        ColorMixer.setColorA(colorState.r, colorState.g, colorState.b);
        colorPreview.style.backgroundColor = hex;

        // Dynamic slider fill: filled portion shows actual channel shade, unfilled is dark
        const pctR = (colorState.r / 255) * 100;
        const pctG = (colorState.g / 255) * 100;
        const pctB = (colorState.b / 255) * 100;
        const dark = document.body.classList.contains('theme-light') ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.08)';
        sliderR.style.background = `linear-gradient(to right, rgb(${colorState.r},0,0) 0%, rgb(${colorState.r},0,0) ${pctR}%, ${dark} ${pctR}%, ${dark} 100%)`;
        sliderG.style.background = `linear-gradient(to right, rgb(0,${colorState.g},0) 0%, rgb(0,${colorState.g},0) ${pctG}%, ${dark} ${pctG}%, ${dark} 100%)`;
        sliderB.style.background = `linear-gradient(to right, rgb(0,0,${colorState.b}) 0%, rgb(0,0,${colorState.b}) ${pctB}%, ${dark} ${pctB}%, ${dark} 100%)`;

        // Thumb color = exact channel shade
        sliderR.style.setProperty('--thumb-color', `rgb(${colorState.r}, 0, 0)`);
        sliderG.style.setProperty('--thumb-color', `rgb(0, ${colorState.g}, 0)`);
        sliderB.style.setProperty('--thumb-color', `rgb(0, 0, ${colorState.b})`);

        // Thumb glow = faint channel color
        sliderR.style.setProperty('--thumb-glow', `rgba(${colorState.r}, 0, 0, 0.25)`);
        sliderG.style.setProperty('--thumb-glow', `rgba(0, ${colorState.g}, 0, 0.25)`);
        sliderB.style.setProperty('--thumb-glow', `rgba(0, 0, ${colorState.b}, 0.25)`);

        // Channel dots show the exact per-channel shade
        dotR.style.backgroundColor = `rgb(${colorState.r}, 0, 0)`;
        dotG.style.backgroundColor = `rgb(0, ${colorState.g}, 0)`;
        dotB.style.backgroundColor = `rgb(0, 0, ${colorState.b})`;

        Explorer.updateWheelMarker(colorState.r, colorState.g, colorState.b);
        renderTintsShades(colorState.r, colorState.g, colorState.b);
        Accessibility.setForeground(hex);
        updatePalette();
        updateFavBtn();
        updateLore();
    }

    function updateLore() {
        const lore = getColorLore(colorState.r, colorState.g, colorState.b);
        document.getElementById('lore-moods').innerHTML =
            lore.moods.map(m => `<span class="lore-tag mood">${m}</span>`).join('');
        document.getElementById('lore-uses').innerHTML =
            lore.uses.map(u => `<span class="lore-tag use">${u}</span>`).join('');
        document.getElementById('lore-brands').innerHTML =
            lore.brands.map(b => `<span class="lore-tag brand">${b}</span>`).join('');
    }

    function updatePalette() {
        const base = { r: colorState.r, g: colorState.g, b: colorState.b };
        const palette = Palette.generate(base, colorState.harmony, colorState.accessibleMode, colorState.accessibleBg, colorState.paletteContrastMode);
        Palette.renderSwatches(swatchesEl, palette, colorState.accessibleMode, colorState.paletteContrastMode);
        Palette.updateSampleCard(sampleCard, palette);
        Palette.renderCVD(palette);

    }

    // Window resize (reserved for future use)

    // ─── Tints & Shades ──────────────────────────────────────────────────────
    function renderTintsShades(r, g, b) {
        const strip = document.getElementById('tints-shades');
        if (!strip) return;
        strip.innerHTML = '';
        const hsl = rgbToHsl(r, g, b);
        [10, 20, 30, 40, 50, 60, 70, 80, 90].forEach(l => {
            const c = hslToRgb(hsl.h, hsl.s, l);
            const hex = rgbToHex(c.r, c.g, c.b);
            const chip = document.createElement('div');
            chip.className = 'shade-chip';
            chip.style.backgroundColor = hex;
            chip.title = hex;
            if (Math.abs(l - hsl.l) < 6) chip.classList.add('is-current');
            chip.addEventListener('click', () => copyToClipboard(hex));
            strip.appendChild(chip);
        });
    }

    // ─── Custom Palette Builder ───────────────────────────────────────────────
    let customPalette = Array(8).fill(null);
    let targetCount = 3;

    function getCurrentColor() {
        const hex = rgbToHex(colorState.r, colorState.g, colorState.b);
        return { r: colorState.r, g: colorState.g, b: colorState.b, hex };
    }

    function renderCustomPalette() {
        const grid = document.getElementById('custom-palette-grid');
        const exportBar = document.getElementById('export-bar');
        if (!grid) return;
        grid.innerHTML = '';

        const hasAny = customPalette.slice(0, targetCount).some(c => c !== null);
        exportBar.style.display = hasAny ? 'flex' : 'none';

        for (let i = 0; i < targetCount; i++) {
            const color = customPalette[i];
            const slot = document.createElement('div');
            slot.className = 'palette-slot';

            const removeBtn = document.createElement('button');
            removeBtn.className = 'palette-slot-remove' + (color ? ' has-color' : '');
            removeBtn.textContent = '×';
            removeBtn.title = 'Clear slot';
            removeBtn.addEventListener('click', e => {
                e.stopPropagation();
                customPalette[i] = null;
                renderCustomPalette();
            });

            const swatch = document.createElement('div');
            swatch.className = 'palette-slot-swatch ' + (color ? 'filled' : 'empty');
            if (color) {
                swatch.style.backgroundColor = color.hex;
                swatch.title = 'Click to update with current color';
            } else {
                swatch.innerHTML = '+';
                swatch.title = 'Click to set with current color';
            }
            swatch.addEventListener('click', () => {
                customPalette[i] = getCurrentColor();
                renderCustomPalette();
            });

            const hexEl = document.createElement('div');
            hexEl.className = 'palette-slot-hex' + (color ? '' : ' empty');
            hexEl.textContent = color ? color.hex : '—';
            if (color) {
                hexEl.title = 'Click to copy';
                hexEl.addEventListener('click', () => copyToClipboard(color.hex));
            }

            const shadesEl = document.createElement('div');
            shadesEl.className = 'palette-slot-shades';
            if (color) {
                const hsl = rgbToHsl(color.r, color.g, color.b);
                [15, 30, 50, 70, 85].forEach(l => {
                    const c = hslToRgb(hsl.h, hsl.s, l);
                    const hex = rgbToHex(c.r, c.g, c.b);
                    const chip = document.createElement('div');
                    chip.className = 'palette-shade-chip';
                    chip.style.backgroundColor = hex;
                    chip.title = hex;
                    chip.addEventListener('click', () => copyToClipboard(hex));
                    shadesEl.appendChild(chip);
                });
            }

            slot.appendChild(removeBtn);
            slot.appendChild(swatch);
            slot.appendChild(hexEl);
            if (color) slot.appendChild(shadesEl);
            grid.appendChild(slot);
        }
    }

    document.getElementById('add-color-btn').addEventListener('click', () => {
        let idx = -1;
        for (let i = 0; i < targetCount; i++) {
            if (!customPalette[i]) { idx = i; break; }
        }
        if (idx >= 0) {
            customPalette[idx] = getCurrentColor();
        } else if (targetCount < 8) {
            targetCount++;
            document.getElementById('target-count').textContent = targetCount;
            customPalette[targetCount - 1] = getCurrentColor();
        }
        renderCustomPalette();
    });

    document.getElementById('clear-palette-btn').addEventListener('click', () => {
        customPalette.fill(null);
        renderCustomPalette();
    });

    document.getElementById('count-dec').addEventListener('click', () => {
        if (targetCount > 1) {
            targetCount--;
            document.getElementById('target-count').textContent = targetCount;
            renderCustomPalette();
        }
    });

    document.getElementById('count-inc').addEventListener('click', () => {
        if (targetCount < 8) {
            targetCount++;
            document.getElementById('target-count').textContent = targetCount;
            renderCustomPalette();
        }
    });

    document.getElementById('export-css-btn').addEventListener('click', () => {
        const lines = [':root {'];
        customPalette.slice(0, targetCount).forEach((color, i) => {
            if (!color) return;
            const hsl = rgbToHsl(color.r, color.g, color.b);
            const dark = hslToRgb(hsl.h, hsl.s, 25);
            const light = hslToRgb(hsl.h, hsl.s, 75);
            lines.push(`  --color-${i + 1}: ${color.hex};`);
            lines.push(`  --color-${i + 1}-dark: ${rgbToHex(dark.r, dark.g, dark.b)};`);
            lines.push(`  --color-${i + 1}-light: ${rgbToHex(light.r, light.g, light.b)};`);
        });
        lines.push('}');
        copyToClipboard(lines.join('\n'));
    });

    renderCustomPalette();

    // ─── Favorites ────────────────────────────────────────────────────────────
    const FAV_KEY = 'cq_favorites';
    const FAV_MAX = 24;
    let favorites = JSON.parse(localStorage.getItem(FAV_KEY) || '[]');

    function saveFavorites() {
        localStorage.setItem(FAV_KEY, JSON.stringify(favorites));
    }

    function updateFavBtn() {
        const hex = rgbToHex(colorState.r, colorState.g, colorState.b);
        const btn = document.getElementById('save-fav-btn');
        const isSaved = favorites.includes(hex);
        btn.textContent = isSaved ? '♥' : '♡';
        btn.classList.toggle('saved', isSaved);
        btn.title = isSaved ? 'Saved! Right-click a chip to remove' : 'Save to favorites';
    }

    function saveFavorite() {
        const hex = rgbToHex(colorState.r, colorState.g, colorState.b);
        if (favorites.includes(hex)) return; // already saved
        if (favorites.length >= FAV_MAX) favorites.shift(); // drop oldest
        favorites.push(hex);
        saveFavorites();
        renderFavorites();
        updateFavBtn();
    }

    function renderFavorites() {
        const strip = document.getElementById('favorites-strip');
        if (!strip) return;
        strip.innerHTML = '';
        if (favorites.length === 0) {
            strip.innerHTML = '<span class="favorites-empty">Click ♡ to save colors here</span>';
            return;
        }
        favorites.forEach((hex, i) => {
            const chip = document.createElement('div');
            chip.className = 'fav-chip';
            chip.style.backgroundColor = hex;
            chip.title = `${hex} — click to restore · right-click to remove`;

            chip.addEventListener('click', () => {
                const rgb = hexToRgb(hex);
                colorState.r = rgb.r; colorState.g = rgb.g; colorState.b = rgb.b;
                document.getElementById('slider-r').value = rgb.r;
                document.getElementById('slider-g').value = rgb.g;
                document.getElementById('slider-b').value = rgb.b;
                updateAll();
            });

            chip.addEventListener('contextmenu', e => {
                e.preventDefault();
                favorites.splice(i, 1);
                saveFavorites();
                renderFavorites();
                updateFavBtn();
            });

            strip.appendChild(chip);
        });
    }

    document.getElementById('save-fav-btn').addEventListener('click', saveFavorite);
    document.getElementById('favorites-clear-btn').addEventListener('click', () => {
        favorites = [];
        saveFavorites();
        renderFavorites();
        updateFavBtn();
    });

    renderFavorites();

    // Initial render
    updateAll();
});
