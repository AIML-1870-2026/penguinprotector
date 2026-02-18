/* Explorer — HSV color picker: flower-shaped hue ring + rotating triangle */

const Explorer = (() => {
    let canvas, ctx;
    let selectedH = 30, selectedS = 80, selectedV = 80;
    let draggingRing     = false;
    let draggingTriangle = false;
    let colorChangeCallback  = null;
    let ignoreSetIntensities = false;
    let ringCache  = null;           // offscreen canvas for the hue ring
    let triCache   = null;           // { canvas, x, y } offscreen triangle
    let triCacheH  = -1;             // hue when triangle was last built
    let triCacheW  = 0, triCacheHd = 0; // canvas size when built
    let animId = null;

    const RING_PAD    = 8;   // px gap between canvas edge and ring outer base edge
    const RING_WIDTH  = 28;  // px width of the hue ring
    const TRI_GAP     = 8;   // px gap between ring inner edge and triangle vertices
    const PETALS      = 6;   // flower petal count
    const PETAL_DEPTH = 0.22; // petal protrusion (0 = circle, higher = more petal-y)
    const FEATHER     = 3;   // edge softness in pixels

    // ─── Geometry ─────────────────────────────────────────────────────────────

    function cx() { return canvas.width  / 2; }
    function cy() { return canvas.height / 2; }
    function oR() { return Math.min(cx(), cy()) - RING_PAD; }
    function iR() { return oR() - RING_WIDTH; }
    function tR() { return iR() - TRI_GAP; }

    // Flower outer radius at a given angle — petals bulge out from the base ring
    function flowerOuterR(angle) {
        return oR() * (1 + PETAL_DEPTH * Math.cos(PETALS * angle));
    }

    // Equilateral triangle vertices — v0 points toward selected hue on ring
    function triVerts() {
        const a = (selectedH - 90) * Math.PI / 180;
        const r = tR(), x = cx(), y = cy();
        return [
            { x: x + r * Math.cos(a),               y: y + r * Math.sin(a)               }, // v0 pure hue
            { x: x + r * Math.cos(a + 2*Math.PI/3), y: y + r * Math.sin(a + 2*Math.PI/3) }, // v1 black
            { x: x + r * Math.cos(a - 2*Math.PI/3), y: y + r * Math.sin(a - 2*Math.PI/3) }, // v2 white
        ];
    }

    // Barycentric coords of (px,py) relative to triangle (v0,v1,v2)
    function bary(px, py, v0, v1, v2) {
        const d = (v1.y - v2.y) * (v0.x - v2.x) + (v2.x - v1.x) * (v0.y - v2.y);
        const a = ((v1.y - v2.y) * (px - v2.x) + (v2.x - v1.x) * (py - v2.y)) / d;
        const b = ((v2.y - v0.y) * (px - v2.x) + (v0.x - v2.x) * (py - v2.y)) / d;
        return { a, b, g: 1 - a - b };
    }

    function insideTri(px, py, v) {
        const { a, b, g } = bary(px, py, v[0], v[1], v[2]);
        return a >= 0 && b >= 0 && g >= 0;
    }

    function inRing(pos) {
        const dx = pos.x - cx(), dy = pos.y - cy();
        const d  = Math.hypot(dx, dy);
        return d >= iR() && d <= flowerOuterR(Math.atan2(dy, dx));
    }

    // ─── HSV ↔ RGB ────────────────────────────────────────────────────────────

    function hsvToRgb(h, s, v) {
        h /= 360; s /= 100; v /= 100;
        const i = Math.floor(h * 6), f = h * 6 - i;
        const p = v*(1-s), q = v*(1-f*s), t = v*(1-(1-f)*s);
        let r, g, b;
        switch (i % 6) {
            case 0: r=v;g=t;b=p; break; case 1: r=q;g=v;b=p; break;
            case 2: r=p;g=v;b=t; break; case 3: r=p;g=q;b=v; break;
            case 4: r=t;g=p;b=v; break; case 5: r=v;g=p;b=q; break;
        }
        return { r: Math.round(r*255), g: Math.round(g*255), b: Math.round(b*255) };
    }

    function rgbToHsv(r, g, b) {
        r /= 255; g /= 255; b /= 255;
        const max = Math.max(r,g,b), min = Math.min(r,g,b), d = max - min;
        let h = 0, s = max === 0 ? 0 : d/max, v = max;
        if (d !== 0) {
            switch (max) {
                case r: h = ((g-b)/d + (g<b?6:0)) / 6; break;
                case g: h = ((b-r)/d + 2) / 6; break;
                case b: h = ((r-g)/d + 4) / 6; break;
            }
        }
        return { h: h*360, s: s*100, v: v*100 };
    }

    // Position inside triangle that corresponds to current S/V
    function triSelectorPos() {
        const v = triVerts();
        const s = selectedS/100, val = selectedV/100;
        const wa = s * val, wb = 1 - val, wg = (1 - s) * val;
        return {
            x: wa * v[0].x + wb * v[1].x + wg * v[2].x,
            y: wa * v[0].y + wb * v[1].y + wg * v[2].y
        };
    }

    // Read S/V from a click/drag position inside the triangle
    function svFromPos(px, py) {
        const v = triVerts();
        let { a, b, g } = bary(px, py, v[0], v[1], v[2]);
        a = Math.max(0, a); b = Math.max(0, b); g = Math.max(0, g);
        const sum = a + b + g; a /= sum; b /= sum; g /= sum;
        const val = 1 - b;
        return {
            s: Math.max(0, Math.min(100, (val < 0.001 ? 0 : a / val) * 100)),
            v: Math.max(0, Math.min(100, val * 100))
        };
    }

    // ─── Caches ───────────────────────────────────────────────────────────────

    function buildRingCache() {
        if (!canvas || canvas.width === 0) return;
        ringCache = document.createElement('canvas');
        ringCache.width  = canvas.width;
        ringCache.height = canvas.height;
        const rc  = ringCache.getContext('2d');
        const img = rc.createImageData(canvas.width, canvas.height);
        const x0 = cx(), y0 = cy(), inner = iR();

        for (let y = 0; y < canvas.height; y++) {
            for (let x = 0; x < canvas.width; x++) {
                const dx    = x - x0, dy = y - y0;
                const d     = Math.sqrt(dx * dx + dy * dy);
                const angle = Math.atan2(dy, dx);
                const outer = flowerOuterR(angle);

                if (d < inner - FEATHER || d > outer + FEATHER) continue;

                const hue = ((angle * 180 / Math.PI) + 90 + 360) % 360;
                const rgb = hsvToRgb(hue, 100, 100);
                const i   = (y * canvas.width + x) * 4;
                img.data[i]     = rgb.r;
                img.data[i + 1] = rgb.g;
                img.data[i + 2] = rgb.b;

                // Smooth feathering at both inner and outer edges
                let alpha = 255;
                if (d < inner + FEATHER)
                    alpha = Math.min(alpha, Math.round(255 * (d - (inner - FEATHER)) / (FEATHER * 2)));
                if (d > outer - FEATHER)
                    alpha = Math.min(alpha, Math.round(255 * (outer + FEATHER - d) / (FEATHER * 2)));
                img.data[i + 3] = Math.max(0, Math.min(255, alpha));
            }
        }
        rc.putImageData(img, 0, 0);
    }

    function buildTriCache() {
        const v = triVerts();
        const pureHue = hsvToRgb(selectedH, 100, 100);
        const minX = Math.floor(Math.min(v[0].x, v[1].x, v[2].x)) - 1;
        const maxX = Math.ceil( Math.max(v[0].x, v[1].x, v[2].x)) + 1;
        const minY = Math.floor(Math.min(v[0].y, v[1].y, v[2].y)) - 1;
        const maxY = Math.ceil( Math.max(v[0].y, v[1].y, v[2].y)) + 1;
        const w = maxX - minX, h = maxY - minY;
        if (w <= 0 || h <= 0) return;

        const off = document.createElement('canvas');
        off.width = w; off.height = h;
        const offCtx = off.getContext('2d');
        const img = offCtx.createImageData(w, h);

        for (let py = minY; py < maxY; py++) {
            for (let px = minX; px < maxX; px++) {
                const { a, b, g } = bary(px, py, v[0], v[1], v[2]);
                if (a < 0 || b < 0 || g < 0) continue;
                const r = Math.round(a * pureHue.r + g * 255);
                const gr = Math.round(a * pureHue.g + g * 255);
                const bl = Math.round(a * pureHue.b + g * 255);
                const i = ((py - minY) * w + (px - minX)) * 4;
                img.data[i] = r; img.data[i+1] = gr; img.data[i+2] = bl; img.data[i+3] = 255;
            }
        }
        offCtx.putImageData(img, 0, 0);
        triCache = { canvas: off, x: minX, y: minY };
        triCacheH  = Math.round(selectedH * 10) / 10;
        triCacheW  = canvas.width;
        triCacheHd = canvas.height;
    }

    // ─── Init / resize ────────────────────────────────────────────────────────

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
        canvas.height = Math.min(w * 0.85, 420);
        buildRingCache();
        triCache = null; // force rebuild
    }

    // ─── Events ───────────────────────────────────────────────────────────────

    function getPos(e) {
        const rect = canvas.getBoundingClientRect();
        return {
            x: (e.clientX - rect.left) * (canvas.width  / rect.width),
            y: (e.clientY - rect.top)  * (canvas.height / rect.height)
        };
    }

    function onMouseDown(e) {
        const pos = getPos(e);
        if (inRing(pos)) { draggingRing = true; updateRing(pos); }
        else {
            const v = triVerts();
            if (insideTri(pos.x, pos.y, v)) { draggingTriangle = true; updateTri(pos); }
        }
    }

    function onMouseMove(e) {
        const pos = getPos(e);
        if      (draggingRing)     updateRing(pos);
        else if (draggingTriangle) updateTri(pos);
    }

    function onMouseUp() { draggingRing = false; draggingTriangle = false; }

    function onTouchStart(e) {
        e.preventDefault();
        const pos = getPos(e.touches[0]);
        if (inRing(pos)) { draggingRing = true; updateRing(pos); }
        else {
            const v = triVerts();
            if (insideTri(pos.x, pos.y, v)) { draggingTriangle = true; updateTri(pos); }
        }
    }

    function onTouchMove(e) {
        e.preventDefault();
        const pos = getPos(e.touches[0]);
        if      (draggingRing)     updateRing(pos);
        else if (draggingTriangle) updateTri(pos);
    }

    function onTouchEnd() { draggingRing = false; draggingTriangle = false; }

    function updateRing(pos) {
        selectedH = ((Math.atan2(pos.y - cy(), pos.x - cx()) * 180 / Math.PI) + 90 + 360) % 360;
        triCache = null; // hue changed → rebuild triangle
        fireColorChange();
    }

    function updateTri(pos) {
        const sv = svFromPos(pos.x, pos.y);
        selectedS = sv.s; selectedV = sv.v;
        fireColorChange();
    }

    function fireColorChange() {
        if (!colorChangeCallback) return;
        ignoreSetIntensities = true;
        colorChangeCallback(getMixedColor());
        ignoreSetIntensities = false;
    }

    // ─── Public API ───────────────────────────────────────────────────────────

    function setIntensities(r, g, b) {
        if (ignoreSetIntensities) return;
        const hsv = rgbToHsv(r, g, b);
        const hChanged = Math.abs(hsv.h - selectedH) > 0.5;
        selectedH = hsv.h; selectedS = hsv.s; selectedV = hsv.v;
        if (hChanged) triCache = null;
    }

    function getMixedColor() {
        return hsvToRgb(selectedH, selectedS, selectedV);
    }

    function onColorChange(fn) { colorChangeCallback = fn; }

    // ─── Draw ─────────────────────────────────────────────────────────────────

    function draw() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // 1. Hue ring
        if (ringCache) ctx.drawImage(ringCache, 0, 0);

        // 2. Ring highlight at selected hue — follows the flower outer edge
        const selA  = (selectedH - 90) * Math.PI / 180;
        const HSPAN = 0.07; // half-width in radians
        const STEPS = 24;
        ctx.save();
        ctx.beginPath();
        for (let i = 0; i <= STEPS; i++) {
            const a  = selA - HSPAN + (2 * HSPAN * i / STEPS);
            const fr = flowerOuterR(a);
            const px = cx() + Math.cos(a) * fr;
            const py = cy() + Math.sin(a) * fr;
            i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
        }
        for (let i = STEPS; i >= 0; i--) {
            const a  = selA - HSPAN + (2 * HSPAN * i / STEPS);
            ctx.lineTo(cx() + Math.cos(a) * iR(), cy() + Math.sin(a) * iR());
        }
        ctx.closePath();
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.fill();
        ctx.restore();

        // 3. Triangle (build cache if needed)
        if (!triCache || triCacheH !== Math.round(selectedH * 10) / 10
                      || triCacheW !== canvas.width || triCacheHd !== canvas.height) {
            buildTriCache();
        }
        if (triCache) ctx.drawImage(triCache.canvas, triCache.x, triCache.y);

        // 4. Triangle border
        const v = triVerts();
        ctx.beginPath();
        ctx.moveTo(v[0].x, v[0].y);
        ctx.lineTo(v[1].x, v[1].y);
        ctx.lineTo(v[2].x, v[2].y);
        ctx.closePath();
        ctx.strokeStyle = 'rgba(255,255,255,0.18)';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // 5. Vertex labels
        ctx.save();
        ctx.font = 'bold 10px system-ui';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const labels = [
            { ...v[0], text: 'H', color: `hsl(${selectedH},100%,65%)` },
            { ...v[1], text: '●', color: 'rgba(255,255,255,0.3)' },  // black vertex
            { ...v[2], text: '○', color: 'rgba(255,255,255,0.7)' },  // white vertex
        ];
        for (const l of labels) {
            // Nudge label slightly outward from center
            const dx = l.x - cx(), dy = l.y - cy();
            const len = Math.hypot(dx, dy) || 1;
            ctx.fillStyle = l.color;
            ctx.fillText(l.text, l.x + dx/len * 14, l.y + dy/len * 14);
        }
        ctx.restore();

        // 6. Triangle selector dot
        const sp = triSelectorPos();
        const { r, g: gr, b } = getMixedColor();
        ctx.beginPath();
        ctx.arc(sp.x, sp.y, 10, 0, Math.PI * 2);
        ctx.fillStyle = `rgb(${r},${gr},${b})`;
        ctx.shadowColor = `rgb(${r},${gr},${b})`;
        ctx.shadowBlur  = 14;
        ctx.fill();
        ctx.shadowBlur  = 0;
        ctx.strokeStyle = 'rgba(255,255,255,0.9)';
        ctx.lineWidth   = 2.5;
        ctx.stroke();
    }

    function startLoop() {
        function loop() { draw(); animId = requestAnimationFrame(loop); }
        loop();
    }

    function destroy() { if (animId) cancelAnimationFrame(animId); }

    return { init, setIntensities, getMixedColor, onColorChange, resizeCanvas, destroy };
})();
