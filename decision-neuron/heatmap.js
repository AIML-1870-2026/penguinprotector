// === Decision Boundary Visualizer (Heatmap) ===

const INPUT_LABELS = {
  tiredness: 'Tiredness',
  urgency: 'Deadline Pressure',
  workLength: 'Work Length',
  timeSinceSlept: 'Hours Since Sleep',
  stress: 'Stress',
};

const HEATMAP = {
  canvas: null,
  ctx: null,
  size: 400,
  padding: 44,
  xAxis: 'timeSinceSlept',
  yAxis: 'stress',
  imageData: null,

  init() {
    this.canvas = document.getElementById('heatmap-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.resize();
  },

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    if (rect.width === 0) return;
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    this.ctx.scale(dpr, dpr);
    this.size = rect.width;
    this.padding = 44;
    this.imageData = null;
  },

  setAxes(xKey, yKey) {
    this.xAxis = xKey;
    this.yAxis = yKey;
    this.imageData = null;
  },

  // Map probability [0,1] to blue → white → magenta
  probToColor(prob) {
    // prob >= 0.5: Nap side → white to magenta
    // prob < 0.5: Grind side → white to cool blue
    if (prob >= 0.5) {
      const t = (prob - 0.5) * 2; // 0 at boundary, 1 at full nap
      const r = Math.round(255);
      const g = Math.round(255 - t * 255);
      const b = Math.round(255);
      return { r, g, b };
    } else {
      const t = (0.5 - prob) * 2; // 0 at boundary, 1 at full grind
      const r = Math.round(255 - t * 195);
      const g = Math.round(255 - t * 155);
      const b = Math.round(255);
      return { r, g, b };
    }
  },

  draw(state) {
    if (!this.size || this.size === 0) return;
    const ctx = this.ctx;
    const colors = getThemeColors();
    const s = this.size;
    const p = this.padding;
    const plotSize = s - p * 2;

    ctx.clearRect(0, 0, s, s);

    // Build the heatmap
    const resolution = 80;
    const cellSize = plotSize / resolution;
    const keys = Object.keys(state.inputs);

    for (let i = 0; i < resolution; i++) {
      for (let j = 0; j < resolution; j++) {
        const xNorm = (i + 0.5) / resolution;
        const yNorm = 1 - (j + 0.5) / resolution;

        // Build input: use slider values for held inputs, grid values for axes
        const fullInput = {};
        for (const key of keys) {
          if (key === this.xAxis) fullInput[key] = xNorm;
          else if (key === this.yAxis) fullInput[key] = yNorm;
          else fullInput[key] = state.inputs[key];
        }

        const result = forwardPass(fullInput, state.weights, state.bias);
        const color = this.probToColor(result.probability);

        ctx.fillStyle = `rgb(${color.r},${color.g},${color.b})`;
        ctx.fillRect(p + i * cellSize, p + j * cellSize, cellSize + 0.5, cellSize + 0.5);
      }
    }

    // Draw gold contour line at decision boundary (z = 0)
    this.drawContour(state, plotSize, p);

    // Draw axes
    ctx.strokeStyle = colors.textLight;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(p, p);
    ctx.lineTo(p, s - p);
    ctx.lineTo(s - p, s - p);
    ctx.stroke();

    // Tick marks + labels
    ctx.fillStyle = colors.textMuted;
    ctx.font = '9px "Fira Code", monospace';

    // X axis ticks
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    for (let t = 0; t <= 4; t++) {
      const val = t * 0.25;
      const x = p + val * plotSize;
      ctx.beginPath();
      ctx.moveTo(x, s - p);
      ctx.lineTo(x, s - p + 4);
      ctx.strokeStyle = colors.textMuted;
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillText(val.toFixed(2), x, s - p + 7);
    }

    // Y axis ticks
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (let t = 0; t <= 4; t++) {
      const val = t * 0.25;
      const y = p + (1 - val) * plotSize;
      ctx.beginPath();
      ctx.moveTo(p, y);
      ctx.lineTo(p - 4, y);
      ctx.strokeStyle = colors.textMuted;
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillText(val.toFixed(2), p - 7, y);
    }

    // Y axis label (rotated)
    ctx.save();
    ctx.translate(12, p + plotSize / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.font = '10px "Fira Code", monospace';
    ctx.fillStyle = colors.textMuted;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(INPUT_LABELS[this.yAxis], 0, 0);
    ctx.restore();

    // Draw crosshair at current slider position
    this.drawCrosshair(state, plotSize, p);
  },

  drawContour(state, plotSize, p) {
    const ctx = this.ctx;
    const keys = Object.keys(state.inputs);
    const resolution = 200;

    // March along X, find where z = 0 for each column
    // z = sum(w_i * x_i) + bias = 0
    // For the two axis inputs, solve for yAxis given xAxis:
    // w_y * y + w_x * x + constant = 0
    // y = -(constant + w_x * x) / w_y

    const wY = state.weights[this.yAxis];
    if (Math.abs(wY) < 0.0001) return; // Can't draw if weight is ~0

    // Constant part: sum of all non-axis weights * their input values + bias
    let constant = state.bias;
    for (const key of keys) {
      if (key !== this.xAxis && key !== this.yAxis) {
        constant += state.weights[key] * state.inputs[key];
      }
    }

    const wX = state.weights[this.xAxis];

    ctx.beginPath();
    ctx.strokeStyle = '#d4a017';
    ctx.lineWidth = 3;
    ctx.shadowColor = 'rgba(212, 160, 23, 0.6)';
    ctx.shadowBlur = 6;

    let started = false;
    for (let i = 0; i <= resolution; i++) {
      const xNorm = i / resolution;
      const yNorm = -(constant + wX * xNorm) / wY;

      if (yNorm >= 0 && yNorm <= 1) {
        const canvasX = p + xNorm * plotSize;
        const canvasY = p + (1 - yNorm) * plotSize;
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
  },

  drawCrosshair(state, plotSize, p) {
    const ctx = this.ctx;
    const colors = getThemeColors();
    const xVal = state.inputs[this.xAxis];
    const yVal = state.inputs[this.yAxis];
    const cx = p + xVal * plotSize;
    const cy = p + (1 - yVal) * plotSize;

    // Crosshair lines
    ctx.strokeStyle = hexToRgba(colors.textPrimary, 0.3);
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);

    // Vertical line
    ctx.beginPath();
    ctx.moveTo(cx, p);
    ctx.lineTo(cx, p + plotSize);
    ctx.stroke();

    // Horizontal line
    ctx.beginPath();
    ctx.moveTo(p, cy);
    ctx.lineTo(p + plotSize, cy);
    ctx.stroke();

    ctx.setLineDash([]);

    // Dot at intersection
    ctx.beginPath();
    ctx.arc(cx, cy, 6, 0, Math.PI * 2);
    ctx.fillStyle = colors.textPrimary;
    ctx.fill();
    ctx.strokeStyle = colors.card;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Outer glow ring
    ctx.beginPath();
    ctx.arc(cx, cy, 10, 0, Math.PI * 2);
    ctx.strokeStyle = hexToRgba(colors.textPrimary, 0.2);
    ctx.lineWidth = 1.5;
    ctx.stroke();
  },

  getHeldInputsText(state) {
    const keys = Object.keys(state.inputs);
    const held = keys.filter(k => k !== this.xAxis && k !== this.yAxis);
    return 'Held: ' + held.map(k => `${k}=${state.inputs[k].toFixed(2)}`).join('  ');
  },
};
