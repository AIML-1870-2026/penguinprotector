/* Accessibility — contrast checker UI logic */

const Accessibility = (() => {
    let fgInput, bgInput, fgHex, bgHex;
    let ratioEl, badgesEl, previewEl;

    function init() {
        fgInput = document.getElementById('fg-color');
        bgInput = document.getElementById('bg-color');
        fgHex = document.getElementById('fg-hex');
        bgHex = document.getElementById('bg-hex');
        ratioEl = document.getElementById('contrast-ratio');
        badgesEl = document.getElementById('contrast-badges');
        previewEl = document.getElementById('contrast-preview');

        fgInput.addEventListener('input', update);
        bgInput.addEventListener('input', update);
        update();
    }

    function update() {
        const fg = hexToRgb(fgInput.value);
        const bg = hexToRgb(bgInput.value);
        fgHex.textContent = fgInput.value;
        bgHex.textContent = bgInput.value;

        const ratio = contrastRatio(fg, bg);
        ratioEl.textContent = ratio.toFixed(2) + ':1';

        // Determine pass/fail for each level
        const aaNormal = ratio >= 4.5;
        const aaLarge = ratio >= 3;
        const aaaNormal = ratio >= 7;
        const aaaLarge = ratio >= 4.5;

        badgesEl.innerHTML = `
            <span class="badge ${aaNormal ? 'pass' : 'fail'}">AA Normal ${aaNormal ? 'Pass' : 'Fail'}</span>
            <span class="badge ${aaLarge ? 'pass' : 'fail'}">AA Large ${aaLarge ? 'Pass' : 'Fail'}</span>
            <span class="badge ${aaaNormal ? 'pass' : 'fail'}">AAA Normal ${aaaNormal ? 'Pass' : 'Fail'}</span>
            <span class="badge ${aaaLarge ? 'pass' : 'fail'}">AAA Large ${aaaLarge ? 'Pass' : 'Fail'}</span>
        `;

        // Update preview
        previewEl.style.background = bgInput.value;
        previewEl.style.color = fgInput.value;
    }

    function setForeground(hex) {
        fgInput.value = hex;
        fgHex.textContent = hex;
        update();
    }

    return { init, update, setForeground };
})();
