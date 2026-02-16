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
    if (rect.width === 0) return; // hidden
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    this.ctx.scale(dpr, dpr);
    this.size = rect.width;
    this.padding = 40;
  },

  draw(state) {
    if (!this.size || this.size === 0) return;
    const ctx = this.ctx;
    const colors = getThemeColors();
    const s = this.size;
    const p = this.padding;
    const plotSize = s - p * 2;

    ctx.clearRect(0, 0, s, s);

    // Draw region colors — soft tints for light theme
    const resolution = 50;
    const cellSize = plotSize / resolution;

    for (let i = 0; i < resolution; i++) {
      for (let j = 0; j < resolution; j++) {
        const xNorm = (i + 0.5) / resolution;
        const yNorm = 1 - (j + 0.5) / resolution;

        const fullInput = {
          tiredness: state.inputs.tiredness,
          urgency: state.inputs.urgency,
          workLength: state.inputs.workLength,
          timeSinceSlept: xNorm,
          stress: yNorm,
        };

        const result = forwardPass(fullInput, state.weights, state.bias);
        const prob = result.probability;

        // Nap region: soft indigo, Grind region: soft amber
        if (prob >= 0.5) {
          const intensity = (prob - 0.5) * 2;
          ctx.fillStyle = `rgba(99, 102, 241, ${0.06 + intensity * 0.18})`;
        } else {
          const intensity = (0.5 - prob) * 2;
          ctx.fillStyle = `rgba(217, 119, 6, ${0.06 + intensity * 0.18})`;
        }

        ctx.fillRect(p + i * cellSize, p + j * cellSize, cellSize + 0.5, cellSize + 0.5);
      }
    }

    // Draw decision boundary line
    const wStress = state.weights.stress;
    if (Math.abs(wStress) > 0.001) {
      const constant = state.weights.tiredness * state.inputs.tiredness
        + state.weights.urgency * state.inputs.urgency
        + state.weights.workLength * state.inputs.workLength
        + state.bias;

      ctx.beginPath();
      ctx.strokeStyle = '#7c3aed';
      ctx.lineWidth = 2.5;
      ctx.shadowColor = '#7c3aed';
      ctx.shadowBlur = 4;

      let started = false;
      for (let px = 0; px <= plotSize; px++) {
        const xNorm = px / plotSize;
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
    ctx.strokeStyle = colors.cardBorder;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(p, p);
    ctx.lineTo(p, s - p);
    ctx.lineTo(s - p, s - p);
    ctx.stroke();

    // Tick marks
    ctx.fillStyle = colors.textMuted;
    ctx.font = '9px "Fira Code", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    for (let t = 0; t <= 4; t++) {
      const val = t * 0.25;
      const x = p + (val * plotSize);
      ctx.beginPath();
      ctx.moveTo(x, s - p);
      ctx.lineTo(x, s - p + 4);
      ctx.strokeStyle = colors.textMuted;
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
      ctx.strokeStyle = colors.textMuted;
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
      ctx.fillStyle = isNap ? 'rgba(99, 102, 241, 0.6)' : 'rgba(217, 119, 6, 0.6)';
      ctx.fill();
      ctx.strokeStyle = isNap ? '#6366f1' : '#d97706';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Flash effect
      if (point.flash) {
        ctx.beginPath();
        ctx.arc(cx, cy, 10, 0, Math.PI * 2);
        ctx.strokeStyle = isNap ? '#6366f1' : '#d97706';
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
    glow.addColorStop(0, hexToRgba(colors.textPrimary, 0.5));
    glow.addColorStop(1, hexToRgba(colors.textPrimary, 0));
    ctx.fillStyle = glow;
    ctx.fill();

    // Dot
    ctx.beginPath();
    ctx.arc(youX, youY, 4, 0, Math.PI * 2);
    ctx.fillStyle = colors.textPrimary;
    ctx.fill();
    ctx.strokeStyle = colors.card;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Label
    ctx.fillStyle = colors.textPrimary;
    ctx.font = '9px "Fira Code", monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    ctx.fillText('You are here', youX + 8, youY - 4);
  },

  getPlotCoords(event) {
    const rect = this.canvas.getBoundingClientRect();
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
