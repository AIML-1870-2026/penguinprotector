// === Activation Function Showdown ===

const ACTIVATION = (() => {
  let canvas, ctx;
  let compareMode = false;

  const FUNCTIONS = {
    sigmoid: {
      name: 'Sigmoid',
      era: 'Classic \u2014 smooth gradient, used everywhere',
      formula: '\u03c3(z) = 1 / (1 + e<sup>-z</sup>)',
      fn: z => 1 / (1 + Math.exp(-z)),
      color: '#6366f1',
      range: { yMin: -0.1, yMax: 1.1 },
    },
    step: {
      name: 'Step Function',
      era: '1958 Perceptron \u2014 all or nothing, no gradient',
      formula: 'f(z) = z \u2265 0 ? 1 : 0',
      fn: z => z >= 0 ? 1 : 0,
      color: '#d97706',
      range: { yMin: -0.1, yMax: 1.1 },
    },
    relu: {
      name: 'ReLU',
      era: 'Modern deep learning \u2014 simple, fast, effective',
      formula: 'f(z) = max(0, z)',
      fn: z => Math.max(0, z),
      color: '#22c55e',
      range: { yMin: -1, yMax: 5 },
    },
  };

  const Z_MIN = -6;
  const Z_MAX = 6;
  const PLOT_PADDING = { top: 20, right: 20, bottom: 36, left: 46 };

  function init() {
    canvas = document.getElementById('activation-canvas');
    if (!canvas) return;
    ctx = canvas.getContext('2d');
  }

  function resize() {
    if (!canvas) return;
    const rect = canvas.parentElement.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function getActiveFn() {
    return window._neuronState ? (window._neuronState.activationFn || 'sigmoid') : 'sigmoid';
  }

  function toPlotX(z, w) {
    return PLOT_PADDING.left + ((z - Z_MIN) / (Z_MAX - Z_MIN)) * w;
  }

  function toPlotY(val, h, yMin, yMax) {
    return PLOT_PADDING.top + (1 - (val - yMin) / (yMax - yMin)) * h;
  }

  function drawGrid(w, h, yMin, yMax) {
    const colors = getThemeColors();
    ctx.strokeStyle = colors.cardBorder;
    ctx.lineWidth = 0.5;
    ctx.font = '10px "Fira Code", monospace';
    ctx.fillStyle = colors.textLight;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';

    // Y-axis grid lines
    const ySteps = yMax - yMin <= 2 ? [0, 0.25, 0.5, 0.75, 1.0] : [0, 1, 2, 3, 4, 5];
    for (const val of ySteps) {
      if (val < yMin || val > yMax) continue;
      const y = toPlotY(val, h, yMin, yMax);
      ctx.beginPath();
      ctx.moveTo(PLOT_PADDING.left, y);
      ctx.lineTo(PLOT_PADDING.left + w, y);
      ctx.stroke();
      ctx.fillText(val.toFixed(val % 1 === 0 ? 0 : 2), PLOT_PADDING.left - 6, y);
    }

    // X-axis grid lines
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    for (let z = Z_MIN; z <= Z_MAX; z += 2) {
      const x = toPlotX(z, w);
      ctx.beginPath();
      ctx.moveTo(x, PLOT_PADDING.top);
      ctx.lineTo(x, PLOT_PADDING.top + h);
      ctx.stroke();
      ctx.fillText(z, x, PLOT_PADDING.top + h + 6);
    }

    // Zero axis
    ctx.strokeStyle = colors.textLight;
    ctx.lineWidth = 1;
    const zeroX = toPlotX(0, w);
    ctx.beginPath();
    ctx.moveTo(zeroX, PLOT_PADDING.top);
    ctx.lineTo(zeroX, PLOT_PADDING.top + h);
    ctx.stroke();

    if (yMin < 0) {
      const zeroY = toPlotY(0, h, yMin, yMax);
      ctx.beginPath();
      ctx.moveTo(PLOT_PADDING.left, zeroY);
      ctx.lineTo(PLOT_PADDING.left + w, zeroY);
      ctx.stroke();
    }

    // Axis label
    ctx.fillStyle = colors.textLight;
    ctx.textAlign = 'center';
    ctx.fillText('z', PLOT_PADDING.left + w / 2, PLOT_PADDING.top + h + 22);
  }

  function drawCurve(fnObj, w, h, yMin, yMax, alpha) {
    ctx.beginPath();
    ctx.strokeStyle = fnObj.color;
    ctx.globalAlpha = alpha;
    ctx.lineWidth = 2.5;

    const steps = 300;
    for (let i = 0; i <= steps; i++) {
      const z = Z_MIN + (Z_MAX - Z_MIN) * (i / steps);
      let val = fnObj.fn(z);
      val = Math.max(yMin, Math.min(yMax, val));
      const x = toPlotX(z, w);
      const y = toPlotY(val, h, yMin, yMax);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  function drawMarker(fnObj, z, w, h, yMin, yMax) {
    let val = fnObj.fn(z);
    val = Math.max(yMin, Math.min(yMax, val));
    const x = toPlotX(z, w);
    const y = toPlotY(val, h, yMin, yMax);

    // Vertical dashed line from z-axis to point
    ctx.save();
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = fnObj.color;
    ctx.globalAlpha = 0.3;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, toPlotY(0, h, yMin, yMax));
    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.restore();

    // Horizontal dashed line from point to y-axis
    ctx.save();
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = fnObj.color;
    ctx.globalAlpha = 0.3;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(PLOT_PADDING.left, y);
    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.restore();

    // Marker dot
    ctx.beginPath();
    ctx.arc(x, y, 6, 0, Math.PI * 2);
    ctx.fillStyle = fnObj.color;
    ctx.fill();
    ctx.strokeStyle = getThemeColors().card;
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  function draw(state) {
    if (!canvas || !ctx) return;

    const displayW = canvas.width / (window.devicePixelRatio || 1);
    const displayH = canvas.height / (window.devicePixelRatio || 1);
    ctx.clearRect(0, 0, displayW, displayH);

    const activeFnKey = state.activationFn || 'sigmoid';
    const activeFn = FUNCTIONS[activeFnKey];
    const z = state.z;

    // Determine Y range
    let yMin, yMax;
    if (compareMode) {
      yMin = -1;
      yMax = 5;
    } else {
      yMin = activeFn.range.yMin;
      yMax = activeFn.range.yMax;
    }

    const plotW = displayW - PLOT_PADDING.left - PLOT_PADDING.right;
    const plotH = displayH - PLOT_PADDING.top - PLOT_PADDING.bottom;

    drawGrid(plotW, plotH, yMin, yMax);

    if (compareMode) {
      // Draw all three, active one on top
      const order = Object.keys(FUNCTIONS).filter(k => k !== activeFnKey);
      order.push(activeFnKey);
      for (const key of order) {
        const fn = FUNCTIONS[key];
        const alpha = key === activeFnKey ? 1 : 0.3;
        drawCurve(fn, plotW, plotH, yMin, yMax, alpha);

        // Label
        const labelZ = key === 'sigmoid' ? 3.5 : key === 'step' ? -4 : 4.5;
        let labelVal = fn.fn(labelZ);
        labelVal = Math.max(yMin, Math.min(yMax, labelVal));
        const lx = toPlotX(labelZ, plotW);
        const ly = toPlotY(labelVal, plotH, yMin, yMax);
        ctx.font = '10px "Fira Code", monospace';
        ctx.fillStyle = fn.color;
        ctx.globalAlpha = key === activeFnKey ? 1 : 0.5;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'bottom';
        ctx.fillText(fn.name, lx + 4, ly - 4);
        ctx.globalAlpha = 1;
      }

      // Markers for all three
      for (const key of order) {
        const fn = FUNCTIONS[key];
        if (key !== activeFnKey) {
          // Small marker for inactive
          let val = fn.fn(z);
          val = Math.max(yMin, Math.min(yMax, val));
          const mx = toPlotX(z, plotW);
          const my = toPlotY(val, plotH, yMin, yMax);
          ctx.beginPath();
          ctx.arc(mx, my, 4, 0, Math.PI * 2);
          ctx.fillStyle = fn.color;
          ctx.globalAlpha = 0.4;
          ctx.fill();
          ctx.globalAlpha = 1;
        }
      }
      drawMarker(activeFn, z, plotW, plotH, yMin, yMax);
    } else {
      drawCurve(activeFn, plotW, plotH, yMin, yMax, 1);
      drawMarker(activeFn, z, plotW, plotH, yMin, yMax);
    }
  }

  function setCompareMode(enabled) {
    compareMode = enabled;
  }

  function getCompareMode() {
    return compareMode;
  }

  return { init, resize, draw, setCompareMode, getCompareMode, FUNCTIONS };
})();
