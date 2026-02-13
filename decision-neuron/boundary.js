// === Decision Boundary Visualization ===

const BOUNDARY = {
  canvas: null,
  ctx: null,
  size: 400,
  padding: 40,

  init() {
    this.canvas = document.getElementById('boundary-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.resize();
  },

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    this.ctx.scale(dpr, dpr);
    this.size = rect.width;
    this.padding = 40;
  },

  draw(state) {
    const ctx = this.ctx;
    const s = this.size;
    const p = this.padding;
    const plotSize = s - p * 2;

    ctx.clearRect(0, 0, s, s);

    // Draw region colors by sampling the neuron
    const resolution = 50;
    const cellSize = plotSize / resolution;

    for (let i = 0; i < resolution; i++) {
      for (let j = 0; j < resolution; j++) {
        const xNorm = (i + 0.5) / resolution; // timeSinceSlept
        const yNorm = 1 - (j + 0.5) / resolution; // stress (inverted for canvas)

        const fullInput = {
          tiredness: state.inputs.tiredness,
          urgency: state.inputs.urgency,
          workLength: state.inputs.workLength,
          timeSinceSlept: xNorm,
          stress: yNorm,
        };

        const result = forwardPass(fullInput, state.weights, state.bias);
        const prob = result.probability;

        // Nap region: indigo, Grind region: amber
        if (prob >= 0.5) {
          const intensity = (prob - 0.5) * 2;
          ctx.fillStyle = `rgba(30, 27, 75, ${0.3 + intensity * 0.5})`;
        } else {
          const intensity = (0.5 - prob) * 2;
          ctx.fillStyle = `rgba(28, 18, 0, ${0.3 + intensity * 0.5})`;
        }

        ctx.fillRect(p + i * cellSize, p + j * cellSize, cellSize + 0.5, cellSize + 0.5);
      }
    }

    // Draw decision boundary line (where sigmoid = 0.5, i.e., z = 0)
    // z = w_tired*tired + w_urg*urg + w_work*work + w_sleep*sleepX + w_stress*stressY + b = 0
    // Solve for stressY: stressY = -(w_tired*tired + w_urg*urg + w_work*work + w_sleep*sleepX + b) / w_stress
    const wStress = state.weights.stress;
    if (Math.abs(wStress) > 0.001) {
      const constant = state.weights.tiredness * state.inputs.tiredness
        + state.weights.urgency * state.inputs.urgency
        + state.weights.workLength * state.inputs.workLength
        + state.bias;

      ctx.beginPath();
      ctx.strokeStyle = '#c4b5fd';
      ctx.lineWidth = 2;
      ctx.shadowColor = '#c4b5fd';
      ctx.shadowBlur = 6;

      let started = false;
      for (let px = 0; px <= plotSize; px++) {
        const xNorm = px / plotSize; // timeSinceSlept
        const stressVal = -(constant + state.weights.timeSinceSlept * xNorm) / wStress;

        if (stressVal >= 0 && stressVal <= 1) {
          const canvasX = p + px;
          const canvasY = p + (1 - stressVal) * plotSize;
          if (!started) {
            ctx.moveTo(canvasX, canvasY);
            started = true;
          } else {
            ctx.lineTo(canvasX, canvasY);
          }
        }
      }
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    // Draw axes
    ctx.strokeStyle = '#2d2b50';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(p, p);
    ctx.lineTo(p, s - p);
    ctx.lineTo(s - p, s - p);
    ctx.stroke();

    // Tick marks
    ctx.fillStyle = '#94a3b8';
    ctx.font = '9px "Fira Code", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    for (let t = 0; t <= 4; t++) {
      const val = t * 0.25;
      const x = p + (val * plotSize);
      ctx.beginPath();
      ctx.moveTo(x, s - p);
      ctx.lineTo(x, s - p + 4);
      ctx.strokeStyle = '#94a3b8';
      ctx.stroke();
      ctx.fillText(val.toFixed(2), x, s - p + 6);
    }

    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (let t = 0; t <= 4; t++) {
      const val = t * 0.25;
      const y = p + ((1 - val) * plotSize);
      ctx.beginPath();
      ctx.moveTo(p, y);
      ctx.lineTo(p - 4, y);
      ctx.strokeStyle = '#94a3b8';
      ctx.stroke();
      ctx.fillText(val.toFixed(2), p - 6, y);
    }

    // Draw training points
    for (const point of state.trainingPoints) {
      const cx = p + point.x * plotSize;
      const cy = p + (1 - point.y) * plotSize;
      const isNap = point.label === 1;

      ctx.beginPath();
      ctx.arc(cx, cy, 6, 0, Math.PI * 2);
      ctx.fillStyle = isNap ? 'rgba(165, 180, 252, 0.7)' : 'rgba(251, 191, 36, 0.7)';
      ctx.fill();
      ctx.strokeStyle = isNap ? '#a5b4fc' : '#fbbf24';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Flash effect for triggered point
      if (point.flash) {
        ctx.beginPath();
        ctx.arc(cx, cy, 10, 0, Math.PI * 2);
        ctx.strokeStyle = isNap ? '#a5b4fc' : '#fbbf24';
        ctx.lineWidth = 2;
        ctx.globalAlpha = point.flash;
        ctx.stroke();
        ctx.globalAlpha = 1;
        point.flash -= 0.02;
        if (point.flash <= 0) point.flash = null;
      }
    }

    // Draw "You are here" dot
    const youX = p + state.inputs.timeSinceSlept * plotSize;
    const youY = p + (1 - state.inputs.stress) * plotSize;

    // Glow
    ctx.beginPath();
    ctx.arc(youX, youY, 10, 0, Math.PI * 2);
    const glow = ctx.createRadialGradient(youX, youY, 2, youX, youY, 12);
    glow.addColorStop(0, 'rgba(255, 255, 255, 0.6)');
    glow.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = glow;
    ctx.fill();

    // Dot
    ctx.beginPath();
    ctx.arc(youX, youY, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();

    // Label
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '9px "Fira Code", monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    ctx.fillText('You are here', youX + 8, youY - 4);
  },

  getPlotCoords(event) {
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = rect.width;
    const scaleY = rect.height;
    const plotSize = this.size - this.padding * 2;

    const mouseX = (event.clientX - rect.left);
    const mouseY = (event.clientY - rect.top);

    const xNorm = (mouseX - this.padding) / plotSize;
    const yNorm = 1 - (mouseY - this.padding) / plotSize;

    if (xNorm >= 0 && xNorm <= 1 && yNorm >= 0 && yNorm <= 1) {
      return { x: xNorm, y: yNorm };
    }
    return null;
  },
};
