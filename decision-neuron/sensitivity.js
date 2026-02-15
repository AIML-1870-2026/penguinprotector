// === Sensitivity Analysis ===

const SENSITIVITY = {
  canvas: null,
  ctx: null,
  barCanvas: null,
  barCtx: null,
  showBars: false,
  width: 500,
  height: 300,

  COLORS: {
    tiredness: '#6366f1',
    timeSinceSlept: '#8b5cf6',
    stress: '#a78bfa',
    urgency: '#d97706',
    workLength: '#f59e0b',
  },

  LABELS: {
    tiredness: 'Tiredness',
    timeSinceSlept: 'Hrs Since Sleep',
    stress: 'Stress',
    urgency: 'Deadline',
    workLength: 'Work Length',
  },

  init() {
    this.canvas = document.getElementById('sensitivity-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.barCanvas = document.getElementById('sensitivity-bar-canvas');
    this.barCtx = this.barCanvas.getContext('2d');
    this.resize();
  },

  resize() {
    // Line chart
    const rect = this.canvas.getBoundingClientRect();
    if (rect.width > 0) {
      const dpr = window.devicePixelRatio || 1;
      this.canvas.width = rect.width * dpr;
      this.canvas.height = rect.height * dpr;
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      this.width = rect.width;
      this.height = rect.height;
    }

    // Bar chart
    const barRect = this.barCanvas.getBoundingClientRect();
    if (barRect.width > 0) {
      const dpr = window.devicePixelRatio || 1;
      this.barCanvas.width = barRect.width * dpr;
      this.barCanvas.height = barRect.height * dpr;
      this.barCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
  },

  draw(state) {
    this.drawLineChart(state);
    if (this.showBars) {
      this.barCanvas.style.display = 'block';
      this.drawBarChart(state);
    } else {
      this.barCanvas.style.display = 'none';
    }
  },

  drawLineChart(state) {
    const ctx = this.ctx;
    const W = this.width;
    const H = this.height;
    const pad = { top: 20, right: 20, bottom: 36, left: 48 };
    const plotW = W - pad.left - pad.right;
    const plotH = H - pad.top - pad.bottom;

    ctx.clearRect(0, 0, W, H);

    const keys = ['tiredness', 'timeSinceSlept', 'stress', 'urgency', 'workLength'];
    const steps = 80;

    // Draw grid
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.15)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = pad.top + (plotH * i) / 4;
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(pad.left + plotW, y);
      ctx.stroke();
    }

    // Y-axis labels
    ctx.font = '10px "Fira Code", monospace';
    ctx.fillStyle = '#94a3b8';
    ctx.textAlign = 'right';
    for (let i = 0; i <= 4; i++) {
      const val = 1 - i * 0.25;
      const y = pad.top + (plotH * i) / 4;
      ctx.fillText(val.toFixed(2), pad.left - 6, y + 3);
    }

    // X-axis labels
    ctx.textAlign = 'center';
    for (let i = 0; i <= 4; i++) {
      const val = i * 0.25;
      const x = pad.left + (plotW * i) / 4;
      ctx.fillText(val.toFixed(1), x, pad.top + plotH + 14);
    }

    // Axis titles
    ctx.fillStyle = '#94a3b8';
    ctx.font = '10px "Fira Code", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('Input Value (0 → 1)', pad.left + plotW / 2, H - 4);

    ctx.save();
    ctx.translate(10, pad.top + plotH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('Output (σ)', 0, 0);
    ctx.restore();

    // 0.5 threshold line
    const threshY = pad.top + plotH * 0.5;
    ctx.strokeStyle = 'rgba(124, 58, 237, 0.25)';
    ctx.setLineDash([4, 4]);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(pad.left, threshY);
    ctx.lineTo(pad.left + plotW, threshY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Threshold label
    ctx.fillStyle = 'rgba(124, 58, 237, 0.5)';
    ctx.font = '9px "Fira Code", monospace';
    ctx.textAlign = 'left';
    ctx.fillText('threshold 0.50', pad.left + plotW - 80, threshY - 5);

    // Draw sweep curves
    for (const key of keys) {
      const color = this.COLORS[key];
      const points = [];

      for (let i = 0; i <= steps; i++) {
        const xVal = i / steps;
        // Build inputs with this key swept, others held at current
        const testInputs = { ...state.inputs, [key]: xVal };
        const result = forwardPass(testInputs, state.weights, state.bias, 'sigmoid');
        points.push({ x: xVal, y: result.probability });
      }

      // Draw curve
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      for (let i = 0; i < points.length; i++) {
        const px = pad.left + points[i].x * plotW;
        const py = pad.top + (1 - points[i].y) * plotH;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();

      // Draw current value marker
      const curVal = state.inputs[key];
      const curInputs = { ...state.inputs };
      const curResult = forwardPass(curInputs, state.weights, state.bias, 'sigmoid');
      const markerX = pad.left + curVal * plotW;

      // Find the y value at the current input
      const sweepInputs = { ...state.inputs, [key]: curVal };
      const sweepResult = forwardPass(sweepInputs, state.weights, state.bias, 'sigmoid');
      const markerY = pad.top + (1 - sweepResult.probability) * plotH;

      // Vertical dashed line from x-axis to curve
      ctx.strokeStyle = color;
      ctx.globalAlpha = 0.3;
      ctx.setLineDash([3, 3]);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(markerX, pad.top + plotH);
      ctx.lineTo(markerX, markerY);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;

      // Dot on the curve
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(markerX, markerY, 5, 0, Math.PI * 2);
      ctx.fill();

      // White inner dot
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(markerX, markerY, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Legend
    const legendY = pad.top + 4;
    let legendX = pad.left + 4;
    ctx.font = '10px "Inter", sans-serif';
    for (const key of keys) {
      const label = this.LABELS[key];
      ctx.fillStyle = this.COLORS[key];
      ctx.beginPath();
      ctx.arc(legendX + 5, legendY + 3, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#64748b';
      ctx.textAlign = 'left';
      ctx.fillText(label, legendX + 12, legendY + 7);
      legendX += ctx.measureText(label).width + 22;
    }
  },

  drawBarChart(state) {
    const ctx = this.barCtx;
    const rect = this.barCanvas.getBoundingClientRect();
    const W = rect.width;
    const H = rect.height;
    const pad = { top: 12, right: 16, bottom: 24, left: 100 };
    const plotW = W - pad.left - pad.right;
    const plotH = H - pad.top - pad.bottom;

    ctx.clearRect(0, 0, W, H);

    const keys = ['tiredness', 'timeSinceSlept', 'stress', 'urgency', 'workLength'];

    // Compute sensitivity for each input: delta output when sweeping 0→1
    const sensitivities = [];
    for (const key of keys) {
      const inputs0 = { ...state.inputs, [key]: 0 };
      const inputs1 = { ...state.inputs, [key]: 1 };
      const out0 = forwardPass(inputs0, state.weights, state.bias, 'sigmoid').probability;
      const out1 = forwardPass(inputs1, state.weights, state.bias, 'sigmoid').probability;
      const delta = out1 - out0;
      sensitivities.push({ key, delta, absDelta: Math.abs(delta) });
    }

    // Sort by absolute influence descending
    sensitivities.sort((a, b) => b.absDelta - a.absDelta);

    const maxDelta = Math.max(...sensitivities.map(s => s.absDelta), 0.01);
    const barH = Math.min(28, (plotH - (sensitivities.length - 1) * 6) / sensitivities.length);
    const gap = 6;
    const totalBarsH = sensitivities.length * barH + (sensitivities.length - 1) * gap;
    const startY = pad.top + (plotH - totalBarsH) / 2;

    for (let i = 0; i < sensitivities.length; i++) {
      const s = sensitivities[i];
      const y = startY + i * (barH + gap);
      const barW = (s.absDelta / maxDelta) * plotW;
      const isPositive = s.delta >= 0;

      // Bar
      ctx.fillStyle = this.COLORS[s.key];
      ctx.globalAlpha = 0.85;
      ctx.beginPath();
      ctx.roundRect(pad.left, y, barW, barH, [0, 6, 6, 0]);
      ctx.fill();
      ctx.globalAlpha = 1;

      // Label on left
      ctx.fillStyle = '#475569';
      ctx.font = '11px "Inter", sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(this.LABELS[s.key], pad.left - 8, y + barH / 2 + 4);

      // Value on bar
      ctx.fillStyle = barW > 50 ? '#ffffff' : '#475569';
      ctx.font = '10px "Fira Code", monospace';
      ctx.textAlign = barW > 50 ? 'right' : 'left';
      const valX = barW > 50 ? pad.left + barW - 6 : pad.left + barW + 6;
      const sign = isPositive ? '+' : '';
      ctx.fillText(sign + s.delta.toFixed(3), valX, y + barH / 2 + 4);

      // Rank badge
      ctx.fillStyle = this.COLORS[s.key];
      ctx.globalAlpha = 0.15;
      ctx.beginPath();
      ctx.arc(pad.left - 50, y + barH / 2, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = this.COLORS[s.key];
      ctx.font = 'bold 10px "Inter", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('#' + (i + 1), pad.left - 50, y + barH / 2 + 4);
    }
  },

  setShowBars(show) {
    this.showBars = show;
  },
};
