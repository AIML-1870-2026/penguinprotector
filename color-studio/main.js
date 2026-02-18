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
    Explorer.init(document.getElementById('explorer-canvas'));
    Palette.init(document.getElementById('color-wheel'), onSwatchClick);
    Accessibility.init();

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

        Explorer.setIntensities(colorState.r, colorState.g, colorState.b);
        Accessibility.setForeground(hex);
        updatePalette();
    }

    function updatePalette() {
        const base = { r: colorState.r, g: colorState.g, b: colorState.b };
        const palette = Palette.generate(base, colorState.harmony, colorState.accessibleMode, colorState.accessibleBg);
        Palette.renderSwatches(swatchesEl, palette, colorState.accessibleMode);
        Palette.drawWheel(palette);
        Palette.updateSampleCard(sampleCard, palette);
        Palette.renderCVD(palette);

        if (palette.length > 0) {
            document.querySelector('.rainbow-text').style.color = rgbToHex(palette[0].r, palette[0].g, palette[0].b);
        }
    }

    // Window resize
    window.addEventListener('resize', () => {
        Explorer.resizeCanvas();
    });

    // Initial render
    updateAll();
});
