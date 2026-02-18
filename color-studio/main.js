/* Main — shared state, UI wiring, integration between Explorer and Palette */

const colorState = {
    r: 200, g: 100, b: 150,
    harmony: 'complementary',
    accessibleMode: false,
    accessibleBg: '#0f0f14'
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

    // Background preset buttons — change the explorer panel and page background
    const explorerPanel = document.getElementById('explorer-panel');
    explorerPanel.style.backgroundColor = '#000000'; // match initial active preset
    document.querySelectorAll('.bg-preset').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.bg-preset').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            explorerPanel.style.backgroundColor = btn.dataset.bg;
            document.body.style.backgroundColor = btn.dataset.bg;
        });
    });


    // Tab switching
    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            const mode = tab.dataset.tab;
            const explorerPanel = document.getElementById('explorer-panel');
            const palettePanel = document.getElementById('palette-panel');
            const accessPanel = document.getElementById('accessibility-panel');

            explorerPanel.classList.remove('hidden');
            palettePanel.classList.remove('hidden');
            accessPanel.classList.remove('hidden');

            if (mode === 'explorer') {
                palettePanel.classList.add('hidden');
                accessPanel.classList.add('hidden');
            } else if (mode === 'palette') {
                explorerPanel.classList.add('hidden');
                accessPanel.classList.add('hidden');
            } else if (mode === 'accessibility') {
                explorerPanel.classList.add('hidden');
                palettePanel.classList.add('hidden');
            }
            // 'both' shows explorer + palette, hides accessibility
            if (mode === 'both') {
                accessPanel.classList.add('hidden');
            }
        });
    });

    // Set initial tab state — hide accessibility
    document.getElementById('accessibility-panel').classList.add('hidden');

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
        colorPreview.style.backgroundColor = hex;

        // Dynamic slider fill: filled portion shows actual channel shade, unfilled is dark
        const pctR = (colorState.r / 255) * 100;
        const pctG = (colorState.g / 255) * 100;
        const pctB = (colorState.b / 255) * 100;
        const dark = 'rgba(255,255,255,0.08)';
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
        Accessibility.setForeground(hex);
        updatePalette();
    }

    function updatePalette() {
        const base = { r: colorState.r, g: colorState.g, b: colorState.b };
        const palette = Palette.generate(base, colorState.harmony, colorState.accessibleMode, colorState.accessibleBg);
        Palette.renderSwatches(swatchesEl, palette, colorState.accessibleMode);
        Palette.updateSampleCard(sampleCard, palette);
        Palette.renderCVD(palette);

        if (palette.length > 0) {
            document.querySelector('.rainbow-text').style.color = rgbToHex(palette[0].r, palette[0].g, palette[0].b);
        }
    }

    // Window resize (reserved for future use)

    // Initial render
    updateAll();
});
