/* Gradient Builder — live two-stop gradient with CSS output */

const GradientBuilder = (() => {
    let colorA = { r: 200, g: 100, b: 150 };
    let colorB = { r: 100, g: 150, b: 220 };
    let direction = 'to right';

    function init() {
        const pickerB = document.getElementById('grad-color-b');

        pickerB.addEventListener('input', () => {
            colorB = hexToRgb(pickerB.value);
            document.getElementById('grad-stop-b').style.backgroundColor = pickerB.value;
            document.getElementById('grad-hex-b').textContent = pickerB.value;
            render();
        });

        document.querySelectorAll('.grad-dir-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.grad-dir-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                direction = btn.dataset.dir;
                render();
            });
        });

        document.getElementById('grad-swap').addEventListener('click', () => {
            [colorA, colorB] = [colorB, colorA];
            const hexA = rgbToHex(colorA.r, colorA.g, colorA.b);
            const hexB = rgbToHex(colorB.r, colorB.g, colorB.b);
            document.getElementById('grad-stop-a').style.backgroundColor = hexA;
            document.getElementById('grad-hex-a').textContent = hexA;
            document.getElementById('grad-stop-b').style.backgroundColor = hexB;
            document.getElementById('grad-hex-b').textContent = hexB;
            pickerB.value = hexB;
            render();
        });

        document.getElementById('gradient-copy-btn').addEventListener('click', () => {
            copyToClipboard(getCssValue());
        });

        // Init color B display
        const initHexB = rgbToHex(colorB.r, colorB.g, colorB.b);
        document.getElementById('grad-stop-b').style.backgroundColor = initHexB;
        document.getElementById('grad-hex-b').textContent = initHexB;
        pickerB.value = initHexB;

        render();
    }

    function setColorA(r, g, b) {
        colorA = { r, g, b };
        const hex = rgbToHex(r, g, b);
        document.getElementById('grad-stop-a').style.backgroundColor = hex;
        document.getElementById('grad-hex-a').textContent = hex;
        render();
    }

    function getCssValue() {
        const hexA = rgbToHex(colorA.r, colorA.g, colorA.b);
        const hexB = rgbToHex(colorB.r, colorB.g, colorB.b);
        if (direction === 'radial') {
            return `background: radial-gradient(circle, ${hexA}, ${hexB});`;
        }
        return `background: linear-gradient(${direction}, ${hexA}, ${hexB});`;
    }

    function render() {
        const hexA = rgbToHex(colorA.r, colorA.g, colorA.b);
        const hexB = rgbToHex(colorB.r, colorB.g, colorB.b);
        const preview = document.getElementById('gradient-preview');
        const code = document.getElementById('gradient-code');

        if (direction === 'radial') {
            preview.style.background = `radial-gradient(circle, ${hexA}, ${hexB})`;
        } else {
            preview.style.background = `linear-gradient(${direction}, ${hexA}, ${hexB})`;
        }

        code.textContent = getCssValue();
    }

    return { init, setColorA };
})();
