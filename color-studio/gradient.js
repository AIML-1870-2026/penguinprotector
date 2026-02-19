/* Gradient Builder — dynamic multi-stop gradient (up to 5 stops) */

const GradientBuilder = (() => {
    const MAX_STOPS = 5;

    // stops: [{r,g,b, source:'explorer'|'picker'}]
    let stops = [
        { r: 200, g: 100, b: 150, source: 'explorer' },
        { r: 100, g: 150, b: 220, source: 'picker'   }
    ];
    let direction = 'to right';

    function init() {
        document.getElementById('grad-add-stop-btn').addEventListener('click', addStop);

        document.querySelectorAll('.grad-dir-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.grad-dir-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                direction = btn.dataset.dir;
                render();
            });
        });

        document.getElementById('gradient-copy-btn').addEventListener('click', () => {
            copyToClipboard(getCssValue());
        });

        renderStops();
        render();
    }

    function addStop() {
        if (stops.length >= MAX_STOPS) return;
        // Interpolate a new stop between the last two
        const a = stops[stops.length - 2];
        const b = stops[stops.length - 1];
        stops.push({
            r: Math.round((a.r + b.r) / 2),
            g: Math.round((a.g + b.g) / 2),
            b: Math.round((a.b + b.b) / 2),
            source: 'picker'
        });
        renderStops();
        render();
    }

    function removeStop(idx) {
        if (stops.length <= 2) return;
        stops.splice(idx, 1);
        renderStops();
        render();
    }

    function renderStops() {
        const row = document.getElementById('gradient-stops-row');
        const addBtn = document.getElementById('grad-add-stop-btn');
        row.innerHTML = '';

        stops.forEach((stop, i) => {
            const hex = rgbToHex(stop.r, stop.g, stop.b);
            const wrap = document.createElement('div');
            wrap.className = 'grad-stop-row';

            const isExplorer = stop.source === 'explorer';
            const hint = isExplorer ? '← from explorer' : 'click to pick';

            wrap.innerHTML = `
                <div class="grad-stop-picker-wrap" title="${hint}">
                    <div class="grad-stop-swatch-sm" style="background:${hex}"></div>
                    ${isExplorer ? '' : `<input type="color" value="${hex}">`}
                </div>
                <span class="grad-stop-hex-sm">${hex}</span>
                <span class="grad-stop-hint-sm">${hint}</span>
                ${stops.length > 2 ? `<button class="grad-stop-remove-btn" title="Remove stop">×</button>` : ''}
            `;

            if (!isExplorer) {
                const picker = wrap.querySelector('input[type="color"]');
                picker.addEventListener('input', () => {
                    const rgb = hexToRgb(picker.value);
                    stops[i] = { ...rgb, source: 'picker' };
                    wrap.querySelector('.grad-stop-swatch-sm').style.background = picker.value;
                    wrap.querySelector('.grad-stop-hex-sm').textContent = picker.value;
                    render();
                });
            }

            const removeBtn = wrap.querySelector('.grad-stop-remove-btn');
            if (removeBtn) {
                removeBtn.addEventListener('click', () => removeStop(i));
            }

            row.appendChild(wrap);
        });

        // Disable add button at max
        addBtn.disabled = stops.length >= MAX_STOPS;
    }

    function setColorA(r, g, b) {
        stops[0] = { r, g, b, source: 'explorer' };
        renderStops();
        render();
    }

    function getPositions() {
        return stops.map((_, i) => (stops.length === 1 ? 0 : (i / (stops.length - 1)) * 100));
    }

    function getCssValue() {
        const positions = getPositions();
        const stopStr = stops.map((s, i) =>
            `${rgbToHex(s.r, s.g, s.b)} ${Math.round(positions[i])}%`
        ).join(', ');

        if (direction === 'radial') {
            return `background: radial-gradient(circle, ${stopStr});`;
        }
        return `background: linear-gradient(${direction}, ${stopStr});`;
    }

    function render() {
        const positions = getPositions();
        const stopStr = stops.map((s, i) =>
            `${rgbToHex(s.r, s.g, s.b)} ${Math.round(positions[i])}%`
        ).join(', ');

        const preview = document.getElementById('gradient-preview');
        const code    = document.getElementById('gradient-code');

        if (direction === 'radial') {
            preview.style.background = `radial-gradient(circle, ${stopStr})`;
        } else {
            preview.style.background = `linear-gradient(${direction}, ${stopStr})`;
        }

        code.textContent = getCssValue();
    }

    return { init, setColorA };
})();
