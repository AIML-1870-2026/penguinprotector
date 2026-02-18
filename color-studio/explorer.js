/* Explorer — read-only HSL color wheel with slider-driven marker */

const Explorer = (() => {
    let wheelCanvas, wheelCtx, wheelCache = null;
    let wheelMarkerH = 0, wheelMarkerS = 0;
    let currentR = 200, currentG = 100, currentB = 150;

    function buildWheelCache() {
        if (!wheelCanvas) return;
        const w = wheelCanvas.width, h = wheelCanvas.height;
        const wc = document.createElement('canvas');
        wc.width = w; wc.height = h;
        const wcCtx = wc.getContext('2d');
        const img = wcCtx.createImageData(w, h);
        const cx = w / 2, cy = h / 2, r = Math.min(cx, cy) - 4;

        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                const dx = x - cx, dy = y - cy;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist > r) continue;
                const hue = ((Math.atan2(dy, dx) * 180 / Math.PI) + 360) % 360;
                const sat = (dist / r) * 100;
                const rgb = hslToRgb(hue, sat, 50);
                const i = (y * w + x) * 4;
                img.data[i] = rgb.r; img.data[i + 1] = rgb.g; img.data[i + 2] = rgb.b;
                img.data[i + 3] = dist > r - 2 ? Math.round(255 * (r - dist) / 2) : 255;
            }
        }
        wcCtx.putImageData(img, 0, 0);
        wheelCache = wc;
    }

    function initWheel(canvasEl) {
        wheelCanvas = canvasEl;
        wheelCtx = canvasEl.getContext('2d');
        buildWheelCache();
        (function loop() { drawWheelCanvas(); requestAnimationFrame(loop); })();
    }

    function updateWheelMarker(r, g, b) {
        currentR = r; currentG = g; currentB = b;
        const hsl = rgbToHsl(r, g, b);
        wheelMarkerH = hsl.h;
        wheelMarkerS = hsl.s;
    }

    function drawWheelCanvas() {
        if (!wheelCtx || !wheelCanvas) return;
        const w = wheelCanvas.width, h = wheelCanvas.height;
        const cx = w / 2, cy = h / 2;
        const r = Math.min(cx, cy) - 4;

        wheelCtx.clearRect(0, 0, w, h);
        if (wheelCache) wheelCtx.drawImage(wheelCache, 0, 0);

        // Subtle border ring
        wheelCtx.beginPath();
        wheelCtx.arc(cx, cy, r, 0, Math.PI * 2);
        wheelCtx.strokeStyle = 'rgba(255,255,255,0.1)';
        wheelCtx.lineWidth = 1.5;
        wheelCtx.stroke();

        // Marker position from H/S
        const angle = wheelMarkerH * Math.PI / 180;
        const dist  = (wheelMarkerS / 100) * r;
        const mx = cx + Math.cos(angle) * dist;
        const my = cy + Math.sin(angle) * dist;

        // Shadow for contrast against any wheel color
        wheelCtx.beginPath();
        wheelCtx.arc(mx, my, 13, 0, Math.PI * 2);
        wheelCtx.strokeStyle = 'rgba(0,0,0,0.55)';
        wheelCtx.lineWidth = 4;
        wheelCtx.stroke();

        // White ring
        wheelCtx.beginPath();
        wheelCtx.arc(mx, my, 13, 0, Math.PI * 2);
        wheelCtx.strokeStyle = 'rgba(255,255,255,0.95)';
        wheelCtx.lineWidth = 2.5;
        wheelCtx.stroke();

        // Inner dot filled with the actual selected color
        wheelCtx.beginPath();
        wheelCtx.arc(mx, my, 8, 0, Math.PI * 2);
        wheelCtx.fillStyle = `rgb(${currentR}, ${currentG}, ${currentB})`;
        wheelCtx.fill();
    }

    return { initWheel, updateWheelMarker };
})();
