// === Weight History Visualization ===

const WEIGHT_HISTORY = {
  canvas: null,
  ctx: null,
  width: 500,
  height: 300,
  history: [],
  maxSteps: 200,

  COLORS: {
    tiredness: '#6366f1',
    timeSinceSlept: '#8b5cf6',
    stress: '#a78bfa',
    urgency: '#d97706',
    workLength: '#f59e0b',
    bias: '#7c3aed',
  },

  LABELS: {
    tiredness: 'Tiredness',
    timeSinceSlept: 'Hrs Sleep',
    stress: 'Stress',
    urgency: 'Deadline',
    workLength: 'Work Len',
    bias: 'Bias',
  },

  init() {
    this.canvas = document.getElementById('weight-history-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.resize();
  },

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    if (rect.width === 0) return;
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.width = rect.width;
    this.height = rect.height;
  },

  recordSnapshot(state) {
    this.history.push({
      step: state.stepCount,
      weights: { ...state.weights },
      bias: state.bias,
    });
    if (this.history.length > this.maxSteps) {
      this.history.shift();
    }
  },

  clear() {
    this.history = [];
  },

  draw(state) {
    const ctx = this.ctx;
    const W = this.width;
    const H = this.height;
    const pad = { top: 30, right: 20, bottom: 40, left: 50 };
    const plotW = W - pad.left - pad.right;
    const plotH = H - pad.top - pad.bottom;

    ctx.clearRect(0, 0, W, H);

    if (this.history.length === 0) {
      ctx.font = '13px "Inter", sans-serif';
      ctx.fillStyle = '#94a3b8';
      ctx.textAlign = 'center';
      ctx.fillText('Train your neuron to see weight changes!', W / 2, H / 2 - 8);
      ctx.font = '11px "Inter", sans-serif';
      ctx.fillText('Place points on the Training tab, then click Step or Train.', W / 2, H / 2 + 12);
      return;
    }

    // Determine Y-axis range from all recorded values
    let minVal = Infinity;
    let maxVal = -Infinity;
    for (const snapshot of this.history) {
      for (const v of Object.values(snapshot.weights)) {
        if (v < minVal) minVal = v;
        if (v > maxVal) maxVal = v;
      }
      if (snapshot.bias < minVal) minVal = snapshot.bias;
      if (snapshot.bias > maxVal) maxVal = snapshot.bias;
    }
    const yPad = Math.max((maxVal - minVal) * 0.15, 0.25);
    const yMin = minVal - yPad;
    const yMax = maxVal + yPad;

    const xMin = this.history[0].step;
    const xMax = this.history[this.history.length - 1].step;
    const xRange = Math.max(xMax - xMin, 1);

    const toX = (step) => pad.left + ((step - xMin) / xRange) * plotW;
    const toY = (val) => pad.top + (1 - (val - yMin) / (yMax - yMin)) * plotH;

    // Grid lines
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.15)';
    ctx.lineWidth = 1;
    const numYTicks = 5;
    for (let i = 0; i <= numYTicks; i++) {
      const y = pad.top + (plotH * i) / numYTicks;
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(pad.left + plotW, y);
      ctx.stroke();
    }

    // Y-axis labels
    ctx.font = '10px "Fira Code", monospace';
    ctx.fillStyle = '#94a3b8';
    ctx.textAlign = 'right';
    for (let i = 0; i <= numYTicks; i++) {
      const val = yMax - (yMax - yMin) * (i / numYTicks);
      const y = pad.top + (plotH * i) / numYTicks;
      ctx.fillText(val.toFixed(2), pad.left - 6, y + 3);
    }

    // X-axis labels
    ctx.textAlign = 'center';
    const numXTicks = Math.min(4, xRange);
    for (let i = 0; i <= numXTicks; i++) {
      const step = Math.round(xMin + (xRange * i) / numXTicks);
      const x = toX(step);
      ctx.fillText(step.toString(), x, pad.top + plotH + 16);
    }

    // Axis titles
    ctx.fillStyle = '#94a3b8';
    ctx.font = '10px "Fira Code", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('Training Step', pad.left + plotW / 2, H - 4);

    ctx.save();
    ctx.translate(10, pad.top + plotH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('Weight Value', 0, 0);
    ctx.restore();

    // Zero line
    if (yMin <= 0 && yMax >= 0) {
      const zeroY = toY(0);
      ctx.strokeStyle = 'rgba(124, 58, 237, 0.2)';
      ctx.setLineDash([4, 4]);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(pad.left, zeroY);
      ctx.lineTo(pad.left + plotW, zeroY);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Draw weight lines
    const keys = ['tiredness', 'timeSinceSlept', 'stress', 'urgency', 'workLength', 'bias'];

    for (const key of keys) {
      const color = this.COLORS[key];

      // Line
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < this.history.length; i++) {
        const snapshot = this.history[i];
        const val = key === 'bias' ? snapshot.bias : snapshot.weights[key];
        const x = toX(snapshot.step);
        const y = toY(val);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // End marker (dot on latest value)
      const last = this.history[this.history.length - 1];
      const lastVal = key === 'bias' ? last.bias : last.weights[key];
      const lx = toX(last.step);
      const ly = toY(lastVal);

      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(lx, ly, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(lx, ly, 2, 0, Math.PI * 2);
      ctx.fill();
    }

    // Legend (two rows)
    ctx.font = '9px "Inter", sans-serif';
    let legendX = pad.left + 4;
    let legendY = pad.top + 4;
    const rowHeight = 14;

    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      const label = this.LABELS[key];
      const color = this.COLORS[key];

      // Wrap to second row after 3 items
      if (i === 3) {
        legendX = pad.left + 4;
        legendY += rowHeight;
      }

      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(legendX + 4, legendY + 3, 3.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#64748b';
      ctx.textAlign = 'left';
      ctx.fillText(label, legendX + 11, legendY + 6);
      legendX += ctx.measureText(label).width + 20;
    }
  },
};
