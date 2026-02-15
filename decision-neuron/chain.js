// === Two-Neuron Chain Visualization ===

const CHAIN = {
  canvas: null,
  ctx: null,
  particles: [],
  animFrame: null,
  w: 0,
  h: 0,

  init() {
    this.canvas = document.getElementById('chain-canvas');
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');
    this.resize();
    this.startAnimation();
  },

  resize() {
    if (!this.canvas) return;
    const rect = this.canvas.getBoundingClientRect();
    if (rect.width === 0) return;
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    this.ctx.scale(dpr, dpr);
    this.w = rect.width;
    this.h = rect.height;
  },

  draw(state) {
    if (!this.w || this.w === 0 || !this.ctx) return;
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.w, this.h);

    const chainWeight = state.chainWeight || 0.8;
    const a1 = state.probability;
    const magnitude = Math.abs(chainWeight);
    const isPositive = chainWeight >= 0;

    // Positions
    const fromX = 20;
    const fromY = this.h / 2;
    const toX = this.w - 20;
    const toY = this.h / 2;
    const cpX = this.w / 2;
    const cpY = this.h / 2 - 30;

    // Draw synapse line
    const color = isPositive ? '#818cf8' : '#f59e0b';
    ctx.beginPath();
    ctx.moveTo(fromX, fromY);
    ctx.quadraticCurveTo(cpX, cpY, toX, toY);
    ctx.strokeStyle = color;
    ctx.lineWidth = 2 + magnitude * 4;
    ctx.globalAlpha = 0.3 + magnitude * 0.4;
    ctx.stroke();
    ctx.globalAlpha = 1;

    // Weight label
    ctx.fillStyle = '#64748b';
    ctx.font = '10px "Fira Code", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('w: ' + (chainWeight >= 0 ? '+' : '') + chainWeight.toFixed(2), this.w / 2, this.h / 2 + 20);

    // Draw particles
    this.updateParticles(a1, chainWeight, fromX, fromY, toX, toY, cpX, cpY);
    for (const p of this.particles) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.alpha;
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // Draw N1 output dot (left)
    const n1Color = a1 >= 0.5 ? '#6366f1' : '#d97706';
    ctx.beginPath();
    ctx.arc(fromX, fromY, 8, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.strokeStyle = n1Color;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Draw N2 input dot (right)
    ctx.beginPath();
    ctx.arc(toX, toY, 8, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.strokeStyle = '#6366f1';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Arrow direction indicator
    const arrowX = toX - 14;
    const arrowY = toY;
    ctx.beginPath();
    ctx.moveTo(arrowX - 5, arrowY - 4);
    ctx.lineTo(arrowX, arrowY);
    ctx.lineTo(arrowX - 5, arrowY + 4);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.globalAlpha = 0.6;
    ctx.stroke();
    ctx.globalAlpha = 1;
  },

  updateParticles(a1, chainWeight, fromX, fromY, toX, toY, cpX, cpY) {
    const isPositive = chainWeight >= 0;
    const magnitude = Math.abs(chainWeight);
    const color = isPositive ? '#818cf8' : '#f59e0b';

    // Spawn particles based on a1 value (more signal = more particles)
    if (Math.random() < 0.08 + a1 * 0.12) {
      this.particles.push({
        t: 0,
        speed: 0.008 + a1 * 0.012,
        color: color,
        alpha: 0.8,
        x: fromX,
        y: fromY,
        fromX, fromY, toX, toY, cpX, cpY,
      });
    }

    for (let j = this.particles.length - 1; j >= 0; j--) {
      const p = this.particles[j];
      p.t += p.speed;

      // Quadratic bezier interpolation
      const t = p.t;
      p.x = (1 - t) * (1 - t) * p.fromX + 2 * (1 - t) * t * p.cpX + t * t * p.toX;
      p.y = (1 - t) * (1 - t) * p.fromY + 2 * (1 - t) * t * p.cpY + t * t * p.toY;
      p.alpha = t > 0.8 ? 1 - (t - 0.8) / 0.2 : 0.8;

      if (p.t >= 1) {
        this.particles.splice(j, 1);
      }
    }

    if (this.particles.length > 20) {
      this.particles = this.particles.slice(-20);
    }
  },

  startAnimation() {
    const loop = () => {
      if (window._neuronState && this.w > 0) {
        this.draw(window._neuronState);
      }
      this.animFrame = requestAnimationFrame(loop);
    };
    loop();
  },
};
