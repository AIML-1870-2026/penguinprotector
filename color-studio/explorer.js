/* Explorer — canvas spotlight rendering, dragging, particles, additive blending */

const Explorer = (() => {
    let canvas, ctx;
    let spotlights = [];
    let particles = [];
    let dragging = null;
    let animId = null;
    let lastValues = { r: 0, g: 0, b: 0 };
    let colorChangeCallback = null;
    let lastMixedStr = '';

    function init(canvasEl) {
        canvas = canvasEl;
        ctx = canvas.getContext('2d');
        resizeCanvas();

        spotlights = [
            { x: canvas.width * 0.3, y: canvas.height * 0.35, radius: 120, color: 'red', intensity: 200 },
            { x: canvas.width * 0.7, y: canvas.height * 0.35, radius: 120, color: 'green', intensity: 100 },
            { x: canvas.width * 0.5, y: canvas.height * 0.65, radius: 120, color: 'blue', intensity: 150 }
        ];

        canvas.addEventListener('mousedown', onMouseDown);
        canvas.addEventListener('mousemove', onMouseMove);
        canvas.addEventListener('mouseup', onMouseUp);
        canvas.addEventListener('mouseleave', onMouseUp);
        canvas.addEventListener('wheel', onWheel, { passive: false });

        // Touch support
        canvas.addEventListener('touchstart', onTouchStart, { passive: false });
        canvas.addEventListener('touchmove', onTouchMove, { passive: false });
        canvas.addEventListener('touchend', onTouchEnd);

        startLoop();
    }

    function resizeCanvas() {
        const wrapper = canvas.parentElement;
        const w = wrapper.clientWidth;
        canvas.width = w;
        canvas.height = Math.min(w * 0.8, 400);
    }

    function getCanvasPos(e) {
        const rect = canvas.getBoundingClientRect();
        return {
            x: (e.clientX - rect.left) * (canvas.width / rect.width),
            y: (e.clientY - rect.top) * (canvas.height / rect.height)
        };
    }

    function findSpotlight(pos) {
        for (let i = spotlights.length - 1; i >= 0; i--) {
            const s = spotlights[i];
            const d = Math.hypot(pos.x - s.x, pos.y - s.y);
            if (d < s.radius) return i;
        }
        return -1;
    }

    function onMouseDown(e) {
        const pos = getCanvasPos(e);
        const idx = findSpotlight(pos);
        if (idx >= 0) {
            dragging = { idx, offsetX: pos.x - spotlights[idx].x, offsetY: pos.y - spotlights[idx].y };
        }
    }

    function onMouseMove(e) {
        if (!dragging) return;
        const pos = getCanvasPos(e);
        spotlights[dragging.idx].x = pos.x - dragging.offsetX;
        spotlights[dragging.idx].y = pos.y - dragging.offsetY;
    }

    function onMouseUp() {
        dragging = null;
    }

    function onWheel(e) {
        e.preventDefault();
        const pos = getCanvasPos(e);
        const idx = findSpotlight(pos);
        if (idx >= 0) {
            spotlights[idx].radius = Math.max(40, Math.min(200, spotlights[idx].radius - e.deltaY * 0.3));
        }
    }

    function onTouchStart(e) {
        e.preventDefault();
        const touch = e.touches[0];
        const pos = getCanvasPos(touch);
        const idx = findSpotlight(pos);
        if (idx >= 0) {
            dragging = { idx, offsetX: pos.x - spotlights[idx].x, offsetY: pos.y - spotlights[idx].y };
        }
    }

    function onTouchMove(e) {
        e.preventDefault();
        if (!dragging) return;
        const touch = e.touches[0];
        const pos = getCanvasPos(touch);
        spotlights[dragging.idx].x = pos.x - dragging.offsetX;
        spotlights[dragging.idx].y = pos.y - dragging.offsetY;
    }

    function onTouchEnd() {
        dragging = null;
    }

    function setIntensities(r, g, b) {
        // Check for rapid changes → spawn particles
        const dr = Math.abs(r - lastValues.r);
        const dg = Math.abs(g - lastValues.g);
        const db = Math.abs(b - lastValues.b);
        if (dr + dg + db > 20) {
            spawnParticles(5);
        }

        spotlights[0].intensity = r;
        spotlights[1].intensity = g;
        spotlights[2].intensity = b;
        lastValues = { r, g, b };
    }

    function getMixedColor() {
        // Sample the additive blend at the canvas center based on each spotlight's distance
        const cx = canvas.width / 2;
        const cy = canvas.height / 2;
        let r = 0, g = 0, b = 0;
        for (const s of spotlights) {
            if (s.intensity <= 0) continue;
            const dist = Math.hypot(cx - s.x, cy - s.y);
            const t = dist / s.radius; // 0 = spotlight center is on canvas center, 1 = edge
            if (t >= 1) continue;
            const contribution = s.intensity * (1 - t);
            if (s.color === 'red')   r += contribution;
            else if (s.color === 'green') g += contribution;
            else if (s.color === 'blue')  b += contribution;
        }
        return {
            r: Math.min(255, Math.round(r)),
            g: Math.min(255, Math.round(g)),
            b: Math.min(255, Math.round(b))
        };
    }

    function onColorChange(fn) {
        colorChangeCallback = fn;
    }

    function spawnParticles(count) {
        const cx = canvas.width / 2;
        const cy = canvas.height / 2;
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 1 + Math.random() * 3;
            particles.push({
                x: cx + (Math.random() - 0.5) * 30,
                y: cy + (Math.random() - 0.5) * 30,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 1,
                decay: 0.01 + Math.random() * 0.02,
                size: 2 + Math.random() * 3,
                color: `hsl(${Math.random() * 360}, 100%, 70%)`
            });
        }
    }

    function updateParticles() {
        for (let i = particles.length - 1; i >= 0; i--) {
            const p = particles[i];
            p.x += p.vx;
            p.y += p.vy;
            p.life -= p.decay;
            if (p.life <= 0) particles.splice(i, 1);
        }
    }

    const SPOTLIGHT_COLORS = { red: '#ff5555', green: '#55ff55', blue: '#5599ff' };

    function draw() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Draw with additive blending
        ctx.globalCompositeOperation = 'lighter';

        for (const s of spotlights) {
            const alpha = Math.pow(s.intensity / 255, 0.65); // gamma boost: brighter at low values
            if (alpha <= 0) continue;

            let r = 0, g = 0, b = 0;
            if (s.color === 'red') r = s.intensity;
            else if (s.color === 'green') g = s.intensity;
            else if (s.color === 'blue') b = s.intensity;

            const gradient = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.radius);
            gradient.addColorStop(0,   `rgba(${r}, ${g}, ${b}, ${Math.min(1, alpha * 1.1)})`);
            gradient.addColorStop(0.35, `rgba(${r}, ${g}, ${b}, ${alpha * 0.65})`);
            gradient.addColorStop(0.7,  `rgba(${r}, ${g}, ${b}, ${alpha * 0.2})`);
            gradient.addColorStop(1,   `rgba(${r}, ${g}, ${b}, 0)`);

            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.globalCompositeOperation = 'source-over';

        // Always-visible spotlight rings — show position even at low intensity
        for (const s of spotlights) {
            ctx.beginPath();
            ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
            ctx.strokeStyle = SPOTLIGHT_COLORS[s.color] + '55'; // ~33% opacity
            ctx.lineWidth = 1.5;
            ctx.setLineDash([5, 5]);
            ctx.stroke();
            ctx.setLineDash([]);
        }

        // Faint background axes — spatial orientation
        ctx.save();
        ctx.globalAlpha = 0.1;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 10]);
        ctx.beginPath(); ctx.moveTo(0, canvas.height / 2); ctx.lineTo(canvas.width, canvas.height / 2); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(canvas.width / 2, 0); ctx.lineTo(canvas.width / 2, canvas.height); ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 0.2;
        ctx.font = '9px system-ui';
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'right'; ctx.textBaseline = 'bottom';
        ctx.fillText('X →', canvas.width - 4, canvas.height / 2 - 4);
        ctx.textAlign = 'left'; ctx.textBaseline = 'top';
        ctx.fillText('Y ↓', canvas.width / 2 + 4, 4);
        ctx.restore();

        // Crosshairs while dragging — colored lines to canvas edges with position %
        if (dragging !== null) {
            const s = spotlights[dragging.idx];
            const color = SPOTLIGHT_COLORS[s.color];
            const xPct = Math.round(s.x / canvas.width * 100);
            const yPct = Math.round(s.y / canvas.height * 100);

            ctx.save();
            ctx.strokeStyle = color;
            ctx.lineWidth = 1;
            ctx.globalAlpha = 0.5;
            ctx.setLineDash([4, 5]);
            // Horizontal crosshair
            ctx.beginPath(); ctx.moveTo(0, s.y); ctx.lineTo(canvas.width, s.y); ctx.stroke();
            // Vertical crosshair
            ctx.beginPath(); ctx.moveTo(s.x, 0); ctx.lineTo(s.x, canvas.height); ctx.stroke();
            ctx.setLineDash([]);

            // Edge labels showing position
            ctx.globalAlpha = 0.9;
            ctx.font = 'bold 10px JetBrains Mono, monospace';
            ctx.fillStyle = color;
            // X% at left edge of horizontal line
            ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
            ctx.fillText(`x: ${xPct}%`, 4, s.y - 3);
            // Y% at top edge of vertical line
            ctx.textAlign = 'left'; ctx.textBaseline = 'top';
            const xLabelX = Math.min(s.x + 4, canvas.width - 48);
            ctx.fillText(`y: ${yPct}%`, xLabelX, 4);
            ctx.restore();
        }

        // Draw center mixed color indicator
        const mixed = getMixedColor();
        const mixedStr = `${mixed.r},${mixed.g},${mixed.b}`;
        if (mixedStr !== lastMixedStr) {
            lastMixedStr = mixedStr;
            if (colorChangeCallback) colorChangeCallback(mixed);
        }
        const cx = canvas.width / 2;
        const cy = canvas.height / 2;
        const pulse = 1 + Math.sin(Date.now() * 0.003) * 0.05;

        ctx.save();
        ctx.translate(cx, cy);
        ctx.scale(pulse, pulse);
        ctx.beginPath();
        ctx.arc(0, 0, 16, 0, Math.PI * 2);
        ctx.fillStyle = `rgb(${mixed.r}, ${mixed.g}, ${mixed.b})`;
        ctx.shadowColor = `rgb(${mixed.r}, ${mixed.g}, ${mixed.b})`;
        ctx.shadowBlur = 25;
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.3)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.restore();

        // Spotlight labels — colored by channel, with intensity value
        ctx.shadowBlur = 0;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        for (const s of spotlights) {
            const labelColor = SPOTLIGHT_COLORS[s.color];
            // Letter
            ctx.font = 'bold 15px system-ui';
            ctx.fillStyle = labelColor;
            ctx.fillText(s.color[0].toUpperCase(), s.x, s.y - 9);
            // Numeric intensity
            ctx.font = '11px JetBrains Mono, monospace';
            ctx.fillStyle = 'rgba(255,255,255,0.75)';
            ctx.fillText(Math.round(s.intensity), s.x, s.y + 9);
        }

        // Draw particles
        for (const p of particles) {
            ctx.globalAlpha = p.life;
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;

        updateParticles();
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
