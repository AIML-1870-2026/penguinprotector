/* Explorer — HSL color wheel with draggable selector and lightness bar */

const Explorer = (() => {
    let canvas, ctx;
    let selectedH = 0, selectedS = 80, selectedL = 50;
    let draggingWheel = false;
    let draggingBar = false;
    let colorChangeCallback = null;
    let ignoreSetIntensities = false;
    let wheelCache = null;
    let animId = null;

    const WHEEL_PAD = 12; // px between wheel edge and canvas edge
    const BAR_H     = 20; // lightness bar height
    const BAR_GAP   = 14; // gap between wheel area and bar
    const BAR_BOT   = 10; // bottom padding

    // Computed layout (recalculated on resize)
    function layout() {
        const by = canvas.height - BAR_H - BAR_BOT;
        const wh = by - BAR_GAP;          // height of the wheel region
        const cx = canvas.width  / 2;
        const cy = wh / 2;
        const r  = Math.min(cx, cy) - WHEEL_PAD;
        return { cx, cy, r, wh, by };
    }

    // ─── Init ────────────────────────────────────────────────────────────────

    function init(canvasEl) {
        canvas = canvasEl;
        ctx    = canvas.getContext('2d');
        resizeCanvas();

        canvas.addEventListener('mousedown',  onMouseDown);
        canvas.addEventListener('mousemove',  onMouseMove);
        canvas.addEventListener('mouseup',    onMouseUp);
        canvas.addEventListener('mouseleave', onMouseUp);
        canvas.addEventListener('touchstart', onTouchStart, { passive: false });
        canvas.addEventListener('touchmove',  onTouchMove,  { passive: false });
        canvas.addEventListener('touchend',   onTouchEnd);

        startLoop();
    }

    function resizeCanvas() {
        const w = canvas.parentElement.clientWidth;
        canvas.width  = w;
        canvas.height = Math.min(w * 0.8, 400);
        buildWheelCache();
    }

    // ─── Wheel cache (pixel-perfect, built once per resize) ──────────────────

    function buildWheelCache() {
        if (!canvas || canvas.width === 0) return;
        const { cx, cy, r, wh } = layout();

        wheelCache        = document.createElement('canvas');
        wheelCache.width  = canvas.width;
        wheelCache.height = wh;
        const wCtx      = wheelCache.getContext('2d');
        const imageData = wCtx.createImageData(canvas.width, wh);

        for (let y = 0; y < wh; y++) {
            for (let x = 0; x < canvas.width; x++) {
                const dx   = x - cx;
                const dy   = y - cy;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist > r) continue;

                const hue = ((Math.atan2(dy, dx) * 180 / Math.PI) + 360) % 360;
                const sat = (dist / r) * 100;
                const rgb = hslToRgb(hue, sat, 50);
                const i   = (y * canvas.width + x) * 4;
                imageData.data[i]     = rgb.r;
                imageData.data[i + 1] = rgb.g;
                imageData.data[i + 2] = rgb.b;
                imageData.data[i + 3] = 255;
            }
        }
        wCtx.putImageData(imageData, 0, 0);
    }

    // ─── Input helpers ───────────────────────────────────────────────────────

    function getCanvasPos(e) {
        const rect = canvas.getBoundingClientRect();
        return {
            x: (e.clientX - rect.left) * (canvas.width  / rect.width),
            y: (e.clientY - rect.top)  * (canvas.height / rect.height)
        };
    }

    function inWheel(pos) {
        const { cx, cy, r } = layout();
        return Math.hypot(pos.x - cx, pos.y - cy) <= r;
    }

    function inBar(pos) {
        const { by } = layout();
        return pos.y >= by && pos.y <= by + BAR_H;
    }

    // ─── Color update from interaction ───────────────────────────────────────

    function updateFromWheelPos(pos) {
        const { cx, cy, r } = layout();
        const dx   = pos.x - cx;
        const dy   = pos.y - cy;
        const dist = Math.min(Math.hypot(dx, dy), r);
        selectedH  = ((Math.atan2(dy, dx) * 180 / Math.PI) + 360) % 360;
        selectedS  = (dist / r) * 100;
        fireColorChange();
    }

    function updateFromBarPos(pos) {
        selectedL = Math.max(0, Math.min(100, (pos.x / canvas.width) * 100));
        fireColorChange();
    }

    function fireColorChange() {
        if (!colorChangeCallback) return;
        ignoreSetIntensities = true;
        colorChangeCallback(getMixedColor());
        ignoreSetIntensities = false;
    }

    // ─── Mouse events ────────────────────────────────────────────────────────

    function onMouseDown(e) {
        const pos = getCanvasPos(e);
        if      (inWheel(pos)) { draggingWheel = true; updateFromWheelPos(pos); }
        else if (inBar(pos))   { draggingBar   = true; updateFromBarPos(pos);   }
    }

    function onMouseMove(e) {
        const pos = getCanvasPos(e);
        if      (draggingWheel) updateFromWheelPos(pos);
        else if (draggingBar)   updateFromBarPos(pos);
    }

    function onMouseUp() { draggingWheel = false; draggingBar = false; }

    // ─── Touch events ────────────────────────────────────────────────────────

    function onTouchStart(e) {
        e.preventDefault();
        const pos = getCanvasPos(e.touches[0]);
        if      (inWheel(pos)) { draggingWheel = true; updateFromWheelPos(pos); }
        else if (inBar(pos))   { draggingBar   = true; updateFromBarPos(pos);   }
    }

    function onTouchMove(e) {
        e.preventDefault();
        const pos = getCanvasPos(e.touches[0]);
        if      (draggingWheel) updateFromWheelPos(pos);
        else if (draggingBar)   updateFromBarPos(pos);
    }

    function onTouchEnd() { draggingWheel = false; draggingBar = false; }

    // ─── Public API (called by main.js) ──────────────────────────────────────

    function setIntensities(r, g, b) {
        if (ignoreSetIntensities) return;
        const hsl = rgbToHsl(r, g, b);
        selectedH = hsl.h;
        selectedS = hsl.s;
        selectedL = hsl.l;
    }

    function getMixedColor() {
        return hslToRgb(selectedH, selectedS, selectedL);
    }

    function onColorChange(fn) {
        colorChangeCallback = fn;
    }

    // ─── Drawing ─────────────────────────────────────────────────────────────

    function draw() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const { cx, cy, r, by } = layout();

        // 1. Cached color wheel (rendered at L=50)
        if (wheelCache) ctx.drawImage(wheelCache, 0, 0);

        // 2. Lightness overlay — darken or lighten the wheel
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.clip();
        if (selectedL < 50) {
            ctx.fillStyle = `rgba(0,0,0,${(50 - selectedL) / 50})`;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        } else if (selectedL > 50) {
            ctx.fillStyle = `rgba(255,255,255,${(selectedL - 50) / 50})`;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
        ctx.restore();

        // 3. Wheel border ring
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255,255,255,0.15)';
        ctx.lineWidth   = 1.5;
        ctx.stroke();

        // 4. Hue tick marks at every 30°
        ctx.save();
        for (let deg = 0; deg < 360; deg += 30) {
            const rad = deg * Math.PI / 180;
            ctx.beginPath();
            ctx.moveTo(cx + Math.cos(rad) * (r - 6), cy + Math.sin(rad) * (r - 6));
            ctx.lineTo(cx + Math.cos(rad) * (r + 4), cy + Math.sin(rad) * (r + 4));
            ctx.strokeStyle = 'rgba(255,255,255,0.4)';
            ctx.lineWidth   = 1.5;
            ctx.stroke();
        }
        ctx.restore();

        // 5. Selector dot on wheel
        const angleRad = selectedH * Math.PI / 180;
        const satR     = (selectedS / 100) * r;
        const sx       = cx + Math.cos(angleRad) * satR;
        const sy       = cy + Math.sin(angleRad) * satR;
        const { r: cr, g: cg, b: cb } = getMixedColor();

        ctx.beginPath();
        ctx.arc(sx, sy, 11, 0, Math.PI * 2);
        ctx.fillStyle   = `rgb(${cr}, ${cg}, ${cb})`;
        ctx.shadowColor = `rgb(${cr}, ${cg}, ${cb})`;
        ctx.shadowBlur  = 12;
        ctx.fill();
        ctx.shadowBlur  = 0;
        ctx.strokeStyle = 'rgba(255,255,255,0.9)';
        ctx.lineWidth   = 2.5;
        ctx.stroke();

        // 6. Lightness bar (black → full color → white)
        const barGrad = ctx.createLinearGradient(0, by, canvas.width, by);
        barGrad.addColorStop(0,   `hsl(${selectedH}, ${selectedS}%, 0%)`);
        barGrad.addColorStop(0.5, `hsl(${selectedH}, ${selectedS}%, 50%)`);
        barGrad.addColorStop(1,   `hsl(${selectedH}, ${selectedS}%, 100%)`);

        ctx.beginPath();
        ctx.roundRect(0, by, canvas.width, BAR_H, BAR_H / 2);
        ctx.fillStyle = barGrad;
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.12)';
        ctx.lineWidth   = 1;
        ctx.stroke();

        // 7. Lightness bar thumb
        const halfH  = BAR_H / 2;
        const thumbX = Math.max(halfH, Math.min(canvas.width - halfH, (selectedL / 100) * canvas.width));
        ctx.beginPath();
        ctx.arc(thumbX, by + halfH, halfH - 1, 0, Math.PI * 2);
        ctx.fillStyle   = `hsl(${selectedH}, ${selectedS}%, ${selectedL}%)`;
        ctx.shadowColor = `hsl(${selectedH}, ${selectedS}%, ${selectedL}%)`;
        ctx.shadowBlur  = 8;
        ctx.fill();
        ctx.shadowBlur  = 0;
        ctx.strokeStyle = 'rgba(255,255,255,0.9)';
        ctx.lineWidth   = 2;
        ctx.stroke();
    }

    function startLoop() {
        function loop() {
            draw();
            animId = requestAnimationFrame(loop);
        }
        loop();
    }

    function destroy() {
        if (animId) cancelAnimationFrame(animId);
    }

    return { init, setIntensities, getMixedColor, onColorChange, resizeCanvas, destroy };
})();
