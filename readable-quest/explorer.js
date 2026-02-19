/* ============================================================
   explorer.js — Animated RGB Spotlight Canvas Explorer
   ============================================================ */

class ExplorerCanvas {
  constructor(canvasEl) {
    this.canvas  = canvasEl;
    this.ctx     = canvasEl.getContext('2d');
    this.spotlights = [];
    this.particles  = [];
    this.breathPhase = 0;
    this.dragging    = null;
    this.animId      = null;
    this.cx = 0;
    this.cy = 0;
  }

  init() {
    this.resize();
    this.initSpotlights();
    this.bindEvents();
    this.startLoop();
  }

  resize() {
    const canvas = this.canvas;
    const wrapper = canvas.parentElement;
    canvas.width  = wrapper.clientWidth  || 500;
    canvas.height = 340;
    this.cx = canvas.width  / 2;
    this.cy = canvas.height / 2;
  }

  initSpotlights() {
    const { cx, cy } = this;
    this.spotlights = [
      { x: cx - 90, y: cy + 70, radius: 130, channel: 'r', baseColor: [255, 0, 0], intensity: 1.0 },
      { x: cx + 90, y: cy + 70, radius: 130, channel: 'g', baseColor: [0, 255, 0], intensity: 0.0 },
      { x: cx,      y: cy - 80, radius: 130, channel: 'b', baseColor: [0, 0, 255], intensity: 0.0 },
    ];
  }

  // Called from main.js when sliders change
  setChannelIntensity(channel, value255) {
    const intensity = value255 / 255;
    const s = this.spotlights.find(sp => sp.channel === channel);
    if (!s) return;
    if (Math.abs(intensity - s.intensity) > 0.08) {
      this.emitParticles(18 + Math.round(Math.abs(intensity - s.intensity) * 25));
    }
    s.intensity = intensity;
  }

  emitParticles(count) {
    const { cx, cy } = this;
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x:     cx + (Math.random() - 0.5) * 50,
        y:     cy + (Math.random() - 0.5) * 50,
        vx:    (Math.random() - 0.5) * 3.5,
        vy:    (Math.random() - 0.5) * 3.5 - 0.5,
        life:  1.0,
        decay: 0.018 + Math.random() * 0.025,
        size:  1.5 + Math.random() * 2.5,
        hue:   Math.random() * 360,
      });
    }
  }

  startLoop() {
    const loop = () => {
      this.render();
      this.animId = requestAnimationFrame(loop);
    };
    this.animId = requestAnimationFrame(loop);
  }

  render() {
    const { ctx, canvas } = this;

    // Dark background
    ctx.fillStyle = '#0a0a10';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Subtle beam lines converging to center
    this.drawBeams();

    // Additive spotlight blending
    ctx.globalCompositeOperation = 'screen';
    for (const s of this.spotlights) {
      if (s.intensity < 0.005) continue;
      this.drawSpotlight(s);
    }
    ctx.globalCompositeOperation = 'source-over';

    // Breathing center glow
    this.drawBreathingGlow();

    // Particles
    this.updateAndDrawParticles();

    // Label rings
    this.drawSpotlightRings();

    this.breathPhase += 0.018;
  }

  drawSpotlight(s) {
    const { ctx } = this;
    const [r, g, b] = s.baseColor;
    const alpha = s.intensity;

    ctx.save();
    ctx.shadowColor = `rgba(${r}, ${g}, ${b}, ${alpha * 0.7})`;
    ctx.shadowBlur  = 28;

    const grad = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.radius);
    grad.addColorStop(0,   `rgba(${r}, ${g}, ${b}, ${alpha})`);
    grad.addColorStop(0.45,`rgba(${r}, ${g}, ${b}, ${alpha * 0.55})`);
    grad.addColorStop(1,   `rgba(${r}, ${g}, ${b}, 0)`);

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  drawBeams() {
    const { ctx, cx, cy } = this;
    for (const s of this.spotlights) {
      if (s.intensity < 0.04) continue;
      const [r, g, b] = s.baseColor;
      ctx.save();
      const grad = ctx.createLinearGradient(s.x, s.y, cx, cy);
      grad.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${s.intensity * 0.15})`);
      grad.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
      ctx.strokeStyle = grad;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(cx, cy);
      ctx.stroke();
      ctx.restore();
    }
  }

  drawBreathingGlow() {
    const { ctx, cx, cy, breathPhase } = this;
    const { r, g, b } = colorState;
    if (r === 0 && g === 0 && b === 0) return;

    const pulse = Math.sin(breathPhase) * 0.25 + 0.75; // 0.5–1.0
    const glowR = 28 + Math.sin(breathPhase) * 7;

    ctx.save();
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, glowR);
    grad.addColorStop(0,   `rgba(${r}, ${g}, ${b}, ${pulse * 0.95})`);
    grad.addColorStop(0.5, `rgba(${r}, ${g}, ${b}, ${pulse * 0.4})`);
    grad.addColorStop(1,   `rgba(${r}, ${g}, ${b}, 0)`);
    ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, glowR, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  drawSpotlightRings() {
    const { ctx } = this;
    const labels = [
      { s: this.spotlights[0], label: 'R', stroke: 'rgba(255,80,80,0.5)' },
      { s: this.spotlights[1], label: 'G', stroke: 'rgba(80,255,80,0.5)' },
      { s: this.spotlights[2], label: 'B', stroke: 'rgba(80,120,255,0.5)' },
    ];
    ctx.save();
    for (const { s, label, stroke } of labels) {
      if (s.intensity < 0.02) continue;
      // Dashed outer ring
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 6]);
      ctx.stroke();
      ctx.setLineDash([]);
      // Label
      ctx.font = 'bold 13px system-ui';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = stroke.replace('0.5', '0.9');
      ctx.fillText(label, s.x, s.y);
    }
    ctx.restore();
  }

  updateAndDrawParticles() {
    const { ctx } = this;
    ctx.save();
    this.particles = this.particles.filter(p => {
      p.x  += p.vx;
      p.y  += p.vy;
      p.vy -= 0.04;
      p.life -= p.decay;
      if (p.life <= 0) return false;
      ctx.globalAlpha = p.life * 0.9;
      ctx.fillStyle = `hsl(${p.hue}, 100%, 70%)`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
      ctx.fill();
      return true;
    });
    ctx.restore();
  }

  // ── Event Handling ─────────────────────────────────────────
  bindEvents() {
    const c = this.canvas;
    c.addEventListener('mousedown', e => this.onDown(this.canvasPos(e)));
    c.addEventListener('mousemove', e => this.onMove(this.canvasPos(e)));
    c.addEventListener('mouseup',   () => this.onUp());
    c.addEventListener('mouseleave',() => this.onUp());
    c.addEventListener('wheel',     e => this.onWheel(e), { passive: false });
    c.addEventListener('touchstart', e => { e.preventDefault(); this.onDown(this.touchPos(e)); }, { passive: false });
    c.addEventListener('touchmove',  e => { e.preventDefault(); this.onMove(this.touchPos(e)); }, { passive: false });
    c.addEventListener('touchend',   () => this.onUp());
    window.addEventListener('resize', () => {
      const prevCx = this.cx, prevCy = this.cy;
      this.resize();
      const dx = this.cx - prevCx, dy = this.cy - prevCy;
      for (const s of this.spotlights) { s.x += dx; s.y += dy; }
    });
  }

  canvasPos(e) {
    const rect = this.canvas.getBoundingClientRect();
    const sx = this.canvas.width  / rect.width;
    const sy = this.canvas.height / rect.height;
    return { x: (e.clientX - rect.left) * sx, y: (e.clientY - rect.top) * sy };
  }

  touchPos(e) {
    return this.canvasPos(e.touches[0]);
  }

  hitTest(x, y) {
    for (let i = this.spotlights.length - 1; i >= 0; i--) {
      const s = this.spotlights[i];
      if (Math.hypot(x - s.x, y - s.y) < s.radius) return s;
    }
    return null;
  }

  onDown({ x, y }) {
    const s = this.hitTest(x, y);
    if (s) {
      this.dragging = { s, ox: s.x - x, oy: s.y - y };
      this.canvas.style.cursor = 'grabbing';
    }
  }

  onMove({ x, y }) {
    if (this.dragging) {
      this.dragging.s.x = x + this.dragging.ox;
      this.dragging.s.y = y + this.dragging.oy;
    } else {
      this.canvas.style.cursor = this.hitTest(x, y) ? 'grab' : 'default';
    }
  }

  onUp() {
    this.dragging = null;
    this.canvas.style.cursor = 'default';
  }

  onWheel(e) {
    e.preventDefault();
    const pos = this.canvasPos(e);
    const s = this.hitTest(pos.x, pos.y);
    if (s) {
      s.radius = Math.max(50, Math.min(220, s.radius - e.deltaY * 0.18));
    }
  }
}

// Instantiated and stored on window by main.js
