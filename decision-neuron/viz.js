// === Neural Network Visualization ===

const VIZ = {
  canvas: null,
  ctx: null,
  particles: [],
  animFrame: null,

  inputLabels: ['Tired', 'Urgency', 'Work Len', 'Sleep', 'Stress'],
  inputKeys: ['tiredness', 'urgency', 'workLength', 'timeSinceSlept', 'stress'],

  init() {
    this.canvas = document.getElementById('nn-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.resize();
    this.startAnimation();
  },

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    if (rect.width === 0) return; // hidden
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    this.ctx.scale(dpr, dpr);
    this.w = rect.width;
    this.h = rect.height;
  },

  getInputNodePositions() {
    const positions = [];
    const x = 50;
    const startY = 30;
    const spacing = (this.h - 60) / 4;
    for (let i = 0; i < 5; i++) {
      positions.push({ x, y: startY + i * spacing });
    }
    return positions;
  },

  getOutputNodePosition() {
    return { x: this.w - 60, y: this.h / 2 };
  },

  draw(state) {
    if (!this.w || this.w === 0) return;
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.w, this.h);

    const inputNodes = this.getInputNodePositions();
    const outputNode = this.getOutputNodePosition();

    // Draw connections
    for (let i = 0; i < 5; i++) {
      const key = this.inputKeys[i];
      const weight = state.weights[key];
      const magnitude = Math.abs(weight);
      const isPositive = weight >= 0;
      const color = isPositive ? '#818cf8' : '#f59e0b';

      ctx.beginPath();
      ctx.moveTo(inputNodes[i].x + 16, inputNodes[i].y);
      ctx.lineTo(outputNode.x - 28, outputNode.y);
      ctx.strokeStyle = color;
      ctx.lineWidth = 1 + magnitude * 3;
      ctx.globalAlpha = 0.25 + magnitude * 0.35;
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // Draw particles along connections
    this.updateParticles(state, inputNodes, outputNode);
    for (const p of this.particles) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.alpha;
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // Draw input nodes
    for (let i = 0; i < 5; i++) {
      const key = this.inputKeys[i];
      const value = state.inputs[key];
      const weight = state.weights[key];
      const isPositive = weight >= 0;

      // Node circle
      ctx.beginPath();
      ctx.arc(inputNodes[i].x, inputNodes[i].y, 16, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.strokeStyle = isPositive ? '#818cf8' : '#f59e0b';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Value text inside node
      ctx.fillStyle = '#1e293b';
      ctx.font = '10px "Fira Code", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(value.toFixed(1), inputNodes[i].x, inputNodes[i].y);

      // Label to the left
      ctx.fillStyle = '#64748b';
      ctx.font = '9px "Fira Code", monospace';
      ctx.textAlign = 'right';
      ctx.fillText(this.inputLabels[i], inputNodes[i].x - 22, inputNodes[i].y);
    }

    // Draw output neuron
    const prob = state.probability;
    const napR = 99, napG = 102, napB = 241;
    const grindR = 217, grindG = 119, grindB = 6;
    const r = Math.round(grindR + (napR - grindR) * prob);
    const g = Math.round(grindG + (napG - grindG) * prob);
    const b = Math.round(grindB + (napB - grindB) * prob);

    // Glow
    const pulseScale = 1 + Math.sin(Date.now() / 600) * 0.06;
    const glowRadius = 28 * pulseScale;

    ctx.beginPath();
    ctx.arc(outputNode.x, outputNode.y, glowRadius + 10, 0, Math.PI * 2);
    const gradient = ctx.createRadialGradient(
      outputNode.x, outputNode.y, glowRadius - 5,
      outputNode.x, outputNode.y, glowRadius + 15
    );
    gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0.2)`);
    gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
    ctx.fillStyle = gradient;
    ctx.fill();

    // Main circle
    ctx.beginPath();
    ctx.arc(outputNode.x, outputNode.y, 28, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.strokeStyle = `rgb(${r}, ${g}, ${b})`;
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Probability text
    ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
    ctx.font = 'bold 14px "Fira Code", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(Math.round(prob * 100) + '%', outputNode.x, outputNode.y);

    // Label
    ctx.fillStyle = '#64748b';
    ctx.font = '9px "Fira Code", monospace';
    ctx.fillText(state.decision, outputNode.x, outputNode.y + 42);
  },

  updateParticles(state, inputNodes, outputNode) {
    if (Math.random() < 0.15) {
      const i = Math.floor(Math.random() * 5);
      const key = this.inputKeys[i];
      const weight = state.weights[key];
      const inputVal = state.inputs[key];
      const isPositive = weight >= 0;

      this.particles.push({
        fromX: inputNodes[i].x + 16,
        fromY: inputNodes[i].y,
        toX: outputNode.x - 28,
        toY: outputNode.y,
        t: 0,
        speed: 0.008 + inputVal * 0.012,
        color: isPositive ? '#818cf8' : '#f59e0b',
        alpha: 0.8,
        x: inputNodes[i].x + 16,
        y: inputNodes[i].y,
      });
    }

    for (let j = this.particles.length - 1; j >= 0; j--) {
      const p = this.particles[j];
      p.t += p.speed;
      p.x = p.fromX + (p.toX - p.fromX) * p.t;
      p.y = p.fromY + (p.toY - p.fromY) * p.t;
      p.alpha = p.t > 0.8 ? 1 - (p.t - 0.8) / 0.2 : 0.8;

      if (p.t >= 1) {
        this.particles.splice(j, 1);
      }
    }

    if (this.particles.length > 40) {
      this.particles = this.particles.slice(-40);
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
