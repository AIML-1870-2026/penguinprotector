/* Color Mixer — blend two colors at an adjustable ratio */

const ColorMixer = (() => {
    let colorA = { r: 200, g: 100, b: 150 };
    let colorB = { r: 100, g: 150, b: 220 };
    let ratio  = 50; // 0 = pure A, 100 = pure B
    let onUse  = null;

    function init(useCallback) {
        onUse = useCallback;

        const pickerB    = document.getElementById('mix-color-b');
        const ratioSlider = document.getElementById('mix-ratio');
        const ratioVal   = document.getElementById('mix-ratio-val');

        pickerB.addEventListener('input', () => {
            colorB = hexToRgb(pickerB.value);
            document.getElementById('mix-swatch-b').style.background = pickerB.value;
            document.getElementById('mix-hex-b').textContent = pickerB.value;
            render();
        });

        ratioSlider.addEventListener('input', () => {
            ratio = parseInt(ratioSlider.value);
            ratioVal.textContent = `${ratio}%`;
            render();
        });

        document.getElementById('mix-use-btn').addEventListener('click', () => {
            if (onUse) onUse(getMix());
        });

        // Init B display
        const initHexB = rgbToHex(colorB.r, colorB.g, colorB.b);
        document.getElementById('mix-swatch-b').style.background = initHexB;
        document.getElementById('mix-hex-b').textContent = initHexB;
        pickerB.value = initHexB;

        render();
    }

    function setColorA(r, g, b) {
        colorA = { r, g, b };
        const hex = rgbToHex(r, g, b);
        document.getElementById('mix-swatch-a').style.background = hex;
        document.getElementById('mix-hex-a').textContent = hex;
        render();
    }

    function getMix() {
        const t = ratio / 100;
        return {
            r: Math.round(colorA.r + (colorB.r - colorA.r) * t),
            g: Math.round(colorA.g + (colorB.g - colorA.g) * t),
            b: Math.round(colorA.b + (colorB.b - colorA.b) * t)
        };
    }

    function render() {
        const mix = getMix();
        const hex  = rgbToHex(mix.r, mix.g, mix.b);
        const name = nearestColorName(mix.r, mix.g, mix.b);
        document.getElementById('mix-result-swatch').style.background = hex;
        document.getElementById('mix-result-hex').textContent  = hex;
        document.getElementById('mix-result-name').textContent = `≈ ${name}`;
    }

    return { init, setColorA };
})();
