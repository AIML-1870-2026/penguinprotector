// ==================== FRACTAL PERSONALITY QUIZ ====================
const quizData = {
  currentStep: 0,
  answers: [],
  correctDifficultyIndex: 0,

  questions: [
    {
      question: "When you close your eyes and think about infinity, what do you see?",
      options: [
        "A never-ending spiral staircase going down",
        "Turtles. All the way down.",
        "My browser tabs",
        "A fractal, obviously. That's why I'm here."
      ]
    },
    {
      question: "A complex number walks into a bar. The bartender says, \"We don't serve your kind here.\" The complex number replies:",
      options: [
        "\"But I'm REAL... partly.\"",
        "\"You can't handle my imaginary side.\"",
        "\"I'll just rotate 90 degrees and become real.\"",
        "*silently iterates until escaping to infinity*"
      ]
    },
    {
      question: "What's your preferred method of relaxation?",
      options: [
        "Zooming into fractals until I question reality",
        "Calculating escape velocities by hand",
        "Arguing about whether 0.999... equals 1",
        "Watching paint dry (it forms fractal patterns if you look close enough)"
      ]
    },
    {
      question: "If you were a fractal, what would be your escape radius?",
      options: [
        "2 - I'm a classicist",
        "Infinity - I never escape, I'm part of the set",
        "I don't believe in boundaries",
        "Whatever gets me out of this quiz fastest"
      ]
    },
    {
      // This is the trick question - dynamically built
      type: 'difficulty',
      question: "How easy was it to get access to this website?",
      // Options are in different languages, correct answer randomizes
      allOptions: [
        { label: "Muy dificil", lang: "Spanish", meaning: "Very difficult" },
        { label: "Difficile", lang: "Italian", meaning: "Difficult" },
        { label: "Neutraali", lang: "Finnish", meaning: "Neutral" },
        { label: "Kolay", lang: "Turkish", meaning: "Easy" },
        { label: "Rất dễ dàng", lang: "Vietnamese", meaning: "Very easy" }
      ]
    }
  ],

  personalities: [
    {
      name: "The Dendrite Dreamer",
      desc: "You exist on the boundary between order and chaos. Your Julia set is connected but just barely - one wrong parameter and you dissolve into Cantor dust. You probably also leave 47 browser tabs open.",
      preset: { real: 0, imag: 1 }
    },
    {
      name: "The Spiral Sage",
      desc: "You see patterns within patterns within patterns. People think you're zoning out but really you're computing Fibonacci sequences in your head. Your ideal date is at a zoom level of 10^14.",
      preset: { real: -0.75, imag: 0.11 }
    },
    {
      name: "The Douady Rabbit Enthusiast",
      desc: "Three-fold symmetry speaks to your soul. You see rabbits in clouds, rabbits in fractals, rabbits everywhere. Gaston Julia would be proud. Or concerned.",
      preset: { real: -0.123, imag: 0.745 }
    },
    {
      name: "The Burning Ship Captain",
      desc: "You chose chaos. While others gently iterate z = z\u00b2 + c, you take absolute values and watch the world burn. Your browser history is 90% fractal zoom videos.",
      preset: { real: -0.8, imag: 0.156 }
    }
  ]
};

function startQuiz() {
  quizData.currentStep = 0;
  quizData.answers = [];
  // Randomize which difficulty option is "correct"
  quizData.correctDifficultyIndex = Math.floor(Math.random() * 5);
  document.getElementById('quiz-overlay').classList.add('visible');
  renderQuizStep();
}

function renderQuizStep() {
  const content = document.getElementById('quiz-content');
  const step = quizData.currentStep;
  const total = quizData.questions.length;

  if (step >= total) {
    showQuizResult();
    return;
  }

  const q = quizData.questions[step];

  let optionsHTML = '';

  if (q.type === 'difficulty') {
    // Shuffle the options order for display but track correctness
    const shuffled = [...q.allOptions].sort(() => Math.random() - 0.5);
    const correctMeaning = q.allOptions[quizData.correctDifficultyIndex].meaning;

    optionsHTML = shuffled.map((opt, i) => {
      const isCorrect = opt.meaning === correctMeaning;
      return `<button class="quiz-option" data-correct="${isCorrect}" data-lang="${opt.lang}" data-meaning="${opt.meaning}" onclick="handleDifficultyAnswer(this)">${opt.label}</button>`;
    }).join('');

    content.innerHTML = `
      <h2>Fractal Personality Quiz</h2>
      <div class="quiz-step">Question ${step + 1} of ${total}</div>
      <div class="quiz-question">${q.question}</div>
      <div class="quiz-options">${optionsHTML}</div>
      <div id="quiz-result"></div>
    `;
  } else {
    optionsHTML = q.options.map((opt, i) =>
      `<button class="quiz-option" onclick="handleQuizAnswer(${i})">${opt}</button>`
    ).join('');

    content.innerHTML = `
      <h2>Fractal Personality Quiz</h2>
      <div class="quiz-subtitle">${step === 0 ? 'Discover your inner fractal identity' : ''}</div>
      <div class="quiz-step">Question ${step + 1} of ${total}</div>
      <div class="quiz-question">${q.question}</div>
      <div class="quiz-options">${optionsHTML}</div>
    `;
  }
}

function handleQuizAnswer(index) {
  quizData.answers.push(index);
  quizData.currentStep++;
  renderQuizStep();
}

function handleDifficultyAnswer(btn) {
  const isCorrect = btn.dataset.correct === 'true';
  const lang = btn.dataset.lang;
  const meaning = btn.dataset.meaning;
  const resultDiv = document.getElementById('quiz-result');

  // Disable all buttons
  document.querySelectorAll('.quiz-option').forEach(b => {
    b.style.pointerEvents = 'none';
  });

  if (isCorrect) {
    btn.classList.add('correct');
    resultDiv.innerHTML = `<span style="color:#2ecc71">Correct! That was ${lang} for "${meaning}"</span>`;
    quizData.answers.push('correct');
    setTimeout(() => {
      quizData.currentStep++;
      renderQuizStep();
    }, 1200);
  } else {
    btn.classList.add('wrong');

    // Find and highlight the correct one
    document.querySelectorAll('.quiz-option').forEach(b => {
      if (b.dataset.correct === 'true') b.classList.add('correct');
    });

    resultDiv.innerHTML = `<div class="quiz-restart-msg">WRONG! That was ${lang} for "${meaning}".<br>Back to the beginning...</div>`;

    setTimeout(() => {
      quizData.currentStep = 0;
      quizData.answers = [];
      // Re-randomize the correct answer
      quizData.correctDifficultyIndex = Math.floor(Math.random() * 5);
      renderQuizStep();
    }, 2200);
  }
}

function showQuizResult() {
  const content = document.getElementById('quiz-content');
  unlockAchievement('quiz_done');
  // Pick personality based on sum of answer indices
  const sum = quizData.answers.reduce((a, b) => typeof b === 'number' ? a + b : a, 0);
  const personality = quizData.personalities[sum % quizData.personalities.length];

  // Set the fractal to match personality
  state.c.real = personality.preset.real;
  state.c.imag = personality.preset.imag;
  updateSliders();
  queueRender();

  content.innerHTML = `
    <h2>Quiz Complete!</h2>
    <div class="quiz-personality">
      <h3>You are: ${personality.name}</h3>
      <p>${personality.desc}</p>
    </div>
    <p style="margin-top:12px; color:var(--text-dim); font-size:12px;">Your fractal has been set to match your personality.</p>
    <button class="quiz-close-btn" onclick="closeQuiz()">Explore My Fractal</button>
    <br>
    <button class="quiz-close-btn" style="background:var(--accent); margin-top:8px;" onclick="startQuiz()">Retake Quiz</button>
  `;
}

function closeQuiz() {
  document.getElementById('quiz-overlay').classList.remove('visible');
}

// ==================== STATE ====================
const state = {
  fractalType: 'julia',
  c: { real: -0.7, imag: 0.27 },
  maxIter: 300,
  escapeRadius: 4,
  smooth: true,
  colorScheme: 'ocean',
  customGradientStops: [
    { pos: 0, color: '#000066' },
    { pos: 0.5, color: '#ff0066' },
    { pos: 1, color: '#ffff00' }
  ],
  customLUT: null,
  // View
  centerX: 0,
  centerY: 0,
  zoom: 1,
  // Animation
  animating: false,
  animT: 0,
  animSpeed: 0.5,
  animPath: 'circle',
  // UI
  showCoords: true,
  showOrbit: false,
  controlsVisible: true,
  // Drag
  dragging: false,
  dragStartX: 0,
  dragStartY: 0,
  dragCenterX: 0,
  dragCenterY: 0,
  // DJ mode
  djMode: false,
  djDragging: false,
  // Reactive colors
  reactiveColors: false,
  reactiveOffset: 0,
};

// ==================== CUSTOM GRADIENT ====================
function hexToRGB(hex) {
  const v = parseInt(hex.slice(1), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

function buildCustomLUT(stops) {
  const sorted = [...stops].sort((a, b) => a.pos - b.pos);
  const lut = new Uint8Array(768);
  for (let i = 0; i < 256; i++) {
    const t = i / 255;
    // Find surrounding stops
    let lo = sorted[0], hi = sorted[sorted.length - 1];
    for (let s = 0; s < sorted.length - 1; s++) {
      if (t >= sorted[s].pos && t <= sorted[s + 1].pos) {
        lo = sorted[s]; hi = sorted[s + 1]; break;
      }
    }
    const range = hi.pos - lo.pos;
    const f = range > 0 ? (t - lo.pos) / range : 0;
    const c0 = hexToRGB(lo.color), c1 = hexToRGB(hi.color);
    lut[i * 3]     = Math.round(c0[0] + (c1[0] - c0[0]) * f);
    lut[i * 3 + 1] = Math.round(c0[1] + (c1[1] - c0[1]) * f);
    lut[i * 3 + 2] = Math.round(c0[2] + (c1[2] - c0[2]) * f);
  }
  return lut;
}

state.customLUT = buildCustomLUT(state.customGradientStops);

// ==================== CANVAS SETUP ====================
const canvas = document.getElementById('fractal-canvas');
const ctx = canvas.getContext('2d');
const splitCanvas = document.getElementById('split-canvas');
const splitCtx = splitCanvas.getContext('2d');
let imageData, pixels;
let splitImageData, splitPixels;
let renderQueued = false;
let interacting = false;
let fullResTimeout = null;
const DRAFT_SCALE = 0.75; // render at 75% during interaction

// Web Worker for offloading fractal computation
const workerCode = `
self.onmessage = function(e) {
  const { id, w, h, yStart, fullH, fractalType, cr, ci, centerX, centerY, zoom, maxIter, escapeRadius, smooth, colorScheme, customLUT, colorOffset } = e.data;
  const buf = new ArrayBuffer(w * h * 4);
  const pixels = new Uint8ClampedArray(buf);
  const minDim = Math.min(w, fullH);
  const scale = 3 / (minDim * zoom);
  const halfW = w / 2;
  const halfH = fullH / 2;
  const escR2 = escapeRadius * escapeRadius;
  const log2 = Math.log(2);

  // Color scheme LUT (256 entries)
  let lut;
  if (customLUT) {
    lut = new Uint8Array(customLUT);
  } else {
  lut = new Uint8Array(768);
  for (let n = 0; n < 256; n++) {
    const t = n / 255;
    let r, g, b;
    switch (colorScheme) {
      case 'classic':
        if (t < 0.25) { const s = t / 0.25; r = 0; g = s * 128; b = 128 + s * 127; }
        else if (t < 0.5) { const s = (t - 0.25) / 0.25; r = s * 255; g = 128 + s * 127; b = 255 - s * 128; }
        else if (t < 0.75) { const s = (t - 0.5) / 0.25; r = 255; g = 255 - s * 128; b = 127 - s * 127; }
        else { const s = (t - 0.75) / 0.25; r = 255 - s * 200; g = 127 - s * 127; b = 0; }
        break;
      case 'fire':
        if (t < 0.33) { const s = t / 0.33; r = s * 200; g = 0; b = 0; }
        else if (t < 0.66) { const s = (t - 0.33) / 0.33; r = 200 + s * 55; g = s * 165; b = 0; }
        else { const s = (t - 0.66) / 0.34; r = 255; g = 165 + s * 90; b = s * 200; }
        break;
      case 'ocean':
        if (t < 0.33) { const s = t / 0.33; r = 0; g = s * 100; b = 80 + s * 120; }
        else if (t < 0.66) { const s = (t - 0.33) / 0.33; r = 0; g = 100 + s * 155; b = 200 + s * 55; }
        else { const s = (t - 0.66) / 0.34; r = s * 180; g = 255; b = 255; }
        break;
      case 'electric':
        if (t < 0.25) { const s = t / 0.25; r = 80 + s * 80; g = 0; b = 160 + s * 95; }
        else if (t < 0.5) { const s = (t - 0.25) / 0.25; r = 160 - s * 160; g = s * 100; b = 255; }
        else if (t < 0.75) { const s = (t - 0.5) / 0.25; r = 0; g = 100 + s * 155; b = 255 - s * 55; }
        else { const s = (t - 0.75) / 0.25; r = s * 255; g = 255; b = 200 - s * 100; }
        break;
      case 'grayscale':
        r = g = b = t * 255; break;
      case 'rainbow': {
        const hue = t * 360;
        const c2 = 1 - Math.abs((hue / 60) % 2 - 1);
        if (hue < 60) { r = 255; g = c2 * 255; b = 0; }
        else if (hue < 120) { r = c2 * 255; g = 255; b = 0; }
        else if (hue < 180) { r = 0; g = 255; b = c2 * 255; }
        else if (hue < 240) { r = 0; g = c2 * 255; b = 255; }
        else if (hue < 300) { r = c2 * 255; g = 0; b = 255; }
        else { r = 255; g = 0; b = c2 * 255; }
        break;
      }
      default: r = g = b = t * 255;
    }
    lut[n * 3] = r;
    lut[n * 3 + 1] = g;
    lut[n * 3 + 2] = b;
  }
  } // end else (not customLUT)

  for (let py = 0; py < h; py++) {
    const cy_px = (py + yStart - halfH) * scale + centerY;
    for (let px = 0; px < w; px++) {
      const cx_px = (px - halfW) * scale + centerX;
      let zr, zi, pcr, pci;
      if (fractalType === 'julia') {
        zr = cx_px; zi = cy_px; pcr = cr; pci = ci;
      } else {
        zr = 0; zi = 0; pcr = cx_px; pci = cy_px;
      }

      let i = 0;
      let zr2 = zr * zr, zi2 = zi * zi;
      if (fractalType === 'burningship') {
        while (i < maxIter && zr2 + zi2 <= escR2) {
          const tmp = zr2 - zi2 + pcr;
          zi = Math.abs(2 * zr * zi) + pci;
          zr = Math.abs(tmp);
          zr2 = zr * zr; zi2 = zi * zi;
          i++;
        }
      } else {
        while (i < maxIter && zr2 + zi2 <= escR2) {
          zi = 2 * zr * zi + pci;
          zr = zr2 - zi2 + pcr;
          zr2 = zr * zr; zi2 = zi * zi;
          i++;
        }
      }

      const idx = (py * w + px) * 4;
      if (i >= maxIter) {
        pixels[idx] = 0; pixels[idx+1] = 0; pixels[idx+2] = 0;
      } else {
        let t;
        if (smooth) {
          const log_zn = Math.log(zr2 + zi2) / 2;
          const nu = Math.log(log_zn / log2) / log2;
          t = ((i + 1 - nu) % 50) / 50;
        } else {
          t = (i % 50) / 50;
        }
        const ci2 = (((t + colorOffset) % 1.0 * 255) | 0) * 3;
        pixels[idx] = lut[ci2];
        pixels[idx+1] = lut[ci2+1];
        pixels[idx+2] = lut[ci2+2];
      }
      pixels[idx+3] = 255;
    }
  }

  self.postMessage({ id, buf }, [buf]);
};
`;
const workerBlob = new Blob([workerCode], { type: 'application/javascript' });
const workerUrl = URL.createObjectURL(workerBlob);
const numWorkers = Math.min(navigator.hardwareConcurrency || 4, 8);
const workers = [];
let workerBusy = new Array(numWorkers).fill(false);
let renderGeneration = 0;

for (let i = 0; i < numWorkers; i++) {
  const w = new Worker(workerUrl);
  w.onmessage = handleWorkerResult;
  workers.push(w);
}

// Track pending tile renders
let pendingTiles = 0;
let expectedTiles = 0;
let currentGeneration = 0;
const tileMap = new Map();
const tileResults = new Map();

function handleWorkerResult(e) {
  const { id, buf } = e.data;
  const gen = id >> 16;
  const tileIdx = id & 0xFFFF;

  // Ignore results from old render generations
  if (gen !== currentGeneration) return;

  const tileInfo = tileMap.get(tileIdx);
  if (!tileInfo) return;

  // Buffer the result instead of painting immediately
  tileResults.set(tileIdx, buf);
  pendingTiles--;

  // Once all tiles for this generation are done, paint them all at once
  if (pendingTiles <= 0) {
    for (const [idx, tileBuf] of tileResults) {
      const info = tileMap.get(idx);
      if (info) {
        const px = new Uint8ClampedArray(tileBuf);
        const imgData = new ImageData(px, info.tw, info.th);
        if (info.draft) {
          // Draft mode: draw to offscreen then scale up
          const off = new OffscreenCanvas(info.tw, info.th);
          const offCtx = off.getContext('2d');
          offCtx.putImageData(imgData, 0, 0);
          info.targetCtx.imageSmoothingEnabled = true;
          info.targetCtx.drawImage(off, 0, info.ty * info.invScale, info.targetCanvas.width, info.th * info.invScale);
        } else {
          info.targetCtx.putImageData(imgData, info.tx, info.ty);
        }
      }
    }
    tileResults.clear();
    tileMap.clear();
  }
}

function resizeCanvas() {
  const container = document.getElementById('canvas-container');

  if (state.fractalType === 'split') {
    canvas.style.position = 'absolute';
    canvas.style.top = '0';
    canvas.style.right = '0';
    canvas.style.left = '50%';
    canvas.style.width = '50%';
    canvas.style.height = '100%';
    splitCanvas.style.display = 'block';

    const halfW = Math.floor(container.clientWidth / 2);
    const h = container.clientHeight;

    canvas.width = halfW;
    canvas.height = h;
    splitCanvas.width = halfW;
    splitCanvas.height = h;
    splitCanvas.style.width = halfW + 'px';
    splitCanvas.style.height = h + 'px';

    splitImageData = splitCtx.createImageData(splitCanvas.width, splitCanvas.height);
    splitPixels = splitImageData.data;
  } else {
    canvas.style.position = '';
    canvas.style.left = '';
    canvas.style.right = '';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    splitCanvas.style.display = 'none';

    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;
  }

  imageData = ctx.createImageData(canvas.width, canvas.height);
  pixels = imageData.data;
  queueRender();
}

// ==================== COLOR SCHEMES ====================
const colorSchemes = {
  classic(t) {
    // Blue -> Cyan -> Yellow -> Red
    if (t < 0.25) { const s = t / 0.25; return [0, Math.floor(s * 128), Math.floor(128 + s * 127)]; }
    if (t < 0.5) { const s = (t - 0.25) / 0.25; return [Math.floor(s * 255), Math.floor(128 + s * 127), Math.floor(255 - s * 128)]; }
    if (t < 0.75) { const s = (t - 0.5) / 0.25; return [255, Math.floor(255 - s * 128), Math.floor(127 - s * 127)]; }
    const s = (t - 0.75) / 0.25; return [Math.floor(255 - s * 200), Math.floor(127 - s * 127), 0];
  },
  fire(t) {
    if (t < 0.33) { const s = t / 0.33; return [Math.floor(s * 200), 0, 0]; }
    if (t < 0.66) { const s = (t - 0.33) / 0.33; return [200 + Math.floor(s * 55), Math.floor(s * 165), 0]; }
    const s = (t - 0.66) / 0.34; return [255, 165 + Math.floor(s * 90), Math.floor(s * 200)];
  },
  ocean(t) {
    if (t < 0.33) { const s = t / 0.33; return [0, Math.floor(s * 100), Math.floor(80 + s * 120)]; }
    if (t < 0.66) { const s = (t - 0.33) / 0.33; return [0, Math.floor(100 + s * 155), Math.floor(200 + s * 55)]; }
    const s = (t - 0.66) / 0.34; return [Math.floor(s * 180), 255, 255];
  },
  electric(t) {
    if (t < 0.25) { const s = t / 0.25; return [Math.floor(80 + s * 80), 0, Math.floor(160 + s * 95)]; }
    if (t < 0.5) { const s = (t - 0.25) / 0.25; return [Math.floor(160 - s * 160), Math.floor(s * 100), 255]; }
    if (t < 0.75) { const s = (t - 0.5) / 0.25; return [0, Math.floor(100 + s * 155), Math.floor(255 - s * 55)]; }
    const s = (t - 0.75) / 0.25; return [Math.floor(s * 255), 255, Math.floor(200 - s * 100)];
  },
  grayscale(t) {
    const v = Math.floor(t * 255);
    return [v, v, v];
  },
  rainbow(t) {
    const h = t * 360;
    const s = 1, v = 1;
    const c = v * s;
    const x = c * (1 - Math.abs((h / 60) % 2 - 1));
    const m = v - c;
    let r, g, b;
    if (h < 60) { r = c; g = x; b = 0; }
    else if (h < 120) { r = x; g = c; b = 0; }
    else if (h < 180) { r = 0; g = c; b = x; }
    else if (h < 240) { r = 0; g = x; b = c; }
    else if (h < 300) { r = x; g = 0; b = c; }
    else { r = c; g = 0; b = x; }
    return [Math.floor((r + m) * 255), Math.floor((g + m) * 255), Math.floor((b + m) * 255)];
  }
};

function getColor(iterations, zr, zi, maxIter) {
  if (iterations >= maxIter) return [0, 0, 0];

  let t;
  if (state.smooth) {
    const log_zn = Math.log(zr * zr + zi * zi) / 2;
    const nu = Math.log(log_zn / Math.log(2)) / Math.log(2);
    const smoothed = iterations + 1 - nu;
    t = (smoothed % 50) / 50;
  } else {
    t = (iterations % 50) / 50;
  }

  if (state.colorScheme === 'custom' && state.customLUT) {
    const ci = ((t * 255) | 0) * 3;
    return [state.customLUT[ci], state.customLUT[ci + 1], state.customLUT[ci + 2]];
  }
  return colorSchemes[state.colorScheme](t);
}

// ==================== FRACTAL COMPUTATION ====================
function pixelToComplex(px, py, w, h, cx, cy, zoom) {
  const scale = 3 / (Math.min(w, h) * zoom);
  return {
    x: (px - w / 2) * scale + cx,
    y: (py - h / 2) * scale + cy
  };
}

// ==================== RENDERING (Web Worker tiled) ====================
function dispatchRender(targetCtx, targetCanvas, fractalType, cr, ci, draft) {
  const scale = draft ? DRAFT_SCALE : 1;
  const w = Math.round(targetCanvas.width * scale);
  const h = Math.round(targetCanvas.height * scale);
  const tileH = Math.ceil(h / numWorkers);
  const invScale = 1 / scale;

  for (let i = 0; i < numWorkers; i++) {
    const ty = i * tileH;
    const th = Math.min(tileH, h - ty);
    if (th <= 0) continue;

    const tileIdx = pendingTiles;
    const id = (currentGeneration << 16) | tileIdx;

    tileMap.set(tileIdx, {
      targetCtx, targetCanvas,
      tx: 0, ty, tw: w, th,
      draft, invScale
    });
    pendingTiles++;

    workers[i % numWorkers].postMessage({
      id,
      w, h: th,
      yStart: ty,
      fullH: h,
      fractalType,
      cr, ci,
      centerX: state.centerX,
      centerY: state.centerY,
      zoom: state.zoom,
      maxIter: draft ? Math.min(state.maxIter, 250) : state.maxIter,
      escapeRadius: state.escapeRadius,
      smooth: state.smooth,
      colorScheme: state.colorScheme,
      customLUT: state.colorScheme === 'custom' && state.customLUT ? state.customLUT.buffer.slice(0) : null,
      colorOffset: state.reactiveOffset
    });
  }
}

function render(forceFull) {
  renderQueued = false;
  currentGeneration++;
  pendingTiles = 0;
  tileMap.clear();
  tileResults.clear();

  const draft = !forceFull && (interacting || state.animating);

  if (state.fractalType === 'split') {
    dispatchRender(splitCtx, splitCanvas, 'mandelbrot', 0, 0, draft);
    dispatchRender(ctx, canvas, 'julia', state.c.real, state.c.imag, draft);
  } else {
    dispatchRender(ctx, canvas, state.fractalType, state.c.real, state.c.imag, draft);
  }

  updateOverlays();
}

function queueRender() {
  if (!renderQueued) {
    renderQueued = true;
    requestAnimationFrame(() => render(false));
  }
}

function scheduleFullRender() {
  if (fullResTimeout) clearTimeout(fullResTimeout);
  fullResTimeout = setTimeout(() => {
    interacting = false;
    renderQueued = true;
    requestAnimationFrame(() => render(true));
  }, 200);
}

function interactiveRender() {
  interacting = true;
  queueRender();
  scheduleFullRender();
  checkAchievements();
}

// ==================== OVERLAYS ====================
function updateOverlays() {
  document.getElementById('zoom-overlay').textContent = `Zoom: ${state.zoom.toFixed(2)}x`;
}

// ==================== ORBIT VISUALIZATION ====================
function showOrbit(px, py) {
  if (!state.showOrbit) return;

  const w = canvas.width;
  const h = canvas.height;
  const p = pixelToComplex(px, py, w, h, state.centerX, state.centerY, state.zoom);

  let zr, zi, cr, ci;
  if (state.fractalType === 'julia' || state.fractalType === 'split') {
    zr = p.x; zi = p.y;
    cr = state.c.real; ci = state.c.imag;
  } else {
    zr = 0; zi = 0;
    cr = p.x; ci = p.y;
  }

  const orbit = [{ r: zr, i: zi }];
  const escR2 = state.escapeRadius * state.escapeRadius;
  let i = 0;
  while (i < state.maxIter && zr * zr + zi * zi <= escR2) {
    const tmp = zr * zr - zi * zi + cr;
    zi = 2 * zr * zi + ci;
    zr = tmp;
    orbit.push({ r: zr, i: zi });
    i++;
    if (orbit.length > 200) break;
  }

  const panel = document.getElementById('orbit-panel');
  panel.classList.add('visible');
  panel.innerHTML = `
    <strong>Orbit Analysis</strong><br>
    z\u2080 = ${p.x.toFixed(4)} + ${p.y.toFixed(4)}i<br>
    Iterations: ${i} / ${state.maxIter}<br>
    Final |z|: ${Math.sqrt(zr * zr + zi * zi).toFixed(4)}<br>
    <span style="color:var(--text-dim)">${i >= state.maxIter ? 'In set (bounded)' : 'Escaped'}</span>
  `;

  // Draw orbit on canvas
  render();
  ctx.strokeStyle = 'rgba(255,255,255,0.6)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  const scale = 3 / (Math.min(w, h) * state.zoom);
  for (let j = 0; j < orbit.length; j++) {
    const sx = (orbit[j].r - state.centerX) / scale + w / 2;
    const sy = (orbit[j].i - state.centerY) / scale + h / 2;
    if (j === 0) ctx.moveTo(sx, sy); else ctx.lineTo(sx, sy);
  }
  ctx.stroke();

  // Draw points
  ctx.fillStyle = 'rgba(233, 69, 96, 0.8)';
  for (let j = 0; j < Math.min(orbit.length, 100); j++) {
    const sx = (orbit[j].r - state.centerX) / scale + w / 2;
    const sy = (orbit[j].i - state.centerY) / scale + h / 2;
    ctx.beginPath();
    ctx.arc(sx, sy, 2, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ==================== ITERATION VISUALIZER ====================
const iterVis = {
  active: false,
  orbit: [],
  currentStep: 0,
  playing: false,
  playTimer: null,
  speed: 300,
  z0: { r: 0, i: 0 },
  cr: 0, ci: 0,
  escaped: false,
  escapeStep: -1,
  maxComputed: 0
};

function startIterVis(px, py) {
  const w = canvas.width, h = canvas.height;
  const p = pixelToComplex(px, py, w, h, state.centerX, state.centerY, state.zoom);

  let zr, zi;
  if (state.fractalType === 'julia' || state.fractalType === 'split') {
    zr = p.x; zi = p.y;
    iterVis.cr = state.c.real; iterVis.ci = state.c.imag;
  } else {
    zr = 0; zi = 0;
    iterVis.cr = p.x; iterVis.ci = p.y;
  }

  iterVis.z0 = { r: zr, i: zi };
  iterVis.orbit = [{ r: zr, i: zi, mag: Math.sqrt(zr * zr + zi * zi) }];
  iterVis.currentStep = 0;
  iterVis.escaped = false;
  iterVis.escapeStep = -1;
  iterVis.playing = false;
  iterVis.active = true;
  if (iterVis.playTimer) clearInterval(iterVis.playTimer);

  // Pre-compute full orbit
  const escR2 = state.escapeRadius * state.escapeRadius;
  let cr = iterVis.cr, ci = iterVis.ci;
  for (let n = 0; n < Math.min(state.maxIter, 500); n++) {
    const tmp = state.fractalType === 'burningship'
      ? Math.abs(zr) * Math.abs(zr) - Math.abs(zi) * Math.abs(zi) + cr
      : zr * zr - zi * zi + cr;
    zi = state.fractalType === 'burningship'
      ? Math.abs(2 * zr * zi) + ci
      : 2 * zr * zi + ci;
    zr = state.fractalType === 'burningship' ? Math.abs(tmp) : tmp;
    const mag = Math.sqrt(zr * zr + zi * zi);
    iterVis.orbit.push({ r: zr, i: zi, mag });
    if (mag * mag > escR2 && iterVis.escapeStep < 0) {
      iterVis.escapeStep = n + 1;
      iterVis.escaped = true;
    }
    if (iterVis.escaped && n > iterVis.escapeStep + 10) break;
  }
  iterVis.maxComputed = iterVis.orbit.length - 1;

  // Show formula
  const fmtC = `${iterVis.cr >= 0 ? '' : '-'}${Math.abs(iterVis.cr).toFixed(4)} ${iterVis.ci >= 0 ? '+' : '-'} ${Math.abs(iterVis.ci).toFixed(4)}i`;
  document.getElementById('itervis-formula').innerHTML =
    state.fractalType === 'burningship'
      ? `z<sub>n+1</sub> = (|Re(z<sub>n</sub>)| + |Im(z<sub>n</sub>)|i)\u00b2 + c &nbsp; c = ${fmtC}`
      : `z<sub>n+1</sub> = z<sub>n</sub>\u00b2 + c &nbsp;&nbsp; c = ${fmtC}`;

  // Build table
  const tbody = document.querySelector('#itervis-list tbody');
  tbody.innerHTML = '';
  iterVis.orbit.forEach((pt, idx) => {
    const tr = document.createElement('tr');
    tr.dataset.step = idx;
    const sign = pt.i >= 0 ? '+' : '-';
    tr.innerHTML = `<td>${idx}</td><td>${pt.r.toFixed(4)} ${sign} ${Math.abs(pt.i).toFixed(4)}i</td><td>${pt.mag.toFixed(4)}</td>`;
    if (iterVis.escaped && idx === iterVis.escapeStep) tr.className = 'escaped-row';
    tbody.appendChild(tr);
  });

  document.getElementById('itervis-panel').classList.add('visible');
  updateIterVisStep();
  drawIterVis();
}

function updateIterVisStep() {
  const step = iterVis.currentStep;
  const pt = iterVis.orbit[step];
  const sign = pt.i >= 0 ? '+' : '-';
  const escR = state.escapeRadius;

  let statusHTML = '';
  if (iterVis.escaped && step >= iterVis.escapeStep) {
    statusHTML = `<span class="escaped">Escaped at step ${iterVis.escapeStep} (|z| > ${escR})</span>`;
  } else if (step >= iterVis.maxComputed && !iterVis.escaped) {
    statusHTML = `<span class="bounded">Bounded after ${iterVis.maxComputed} iterations</span>`;
  } else {
    statusHTML = `|z| = <span class="val">${pt.mag.toFixed(6)}</span> &nbsp; escape radius = ${escR}`;
  }

  document.getElementById('itervis-current').innerHTML =
    `z<sub>${step}</sub> = <span class="val">${pt.r.toFixed(6)} ${sign} ${Math.abs(pt.i).toFixed(6)}i</span><br>${statusHTML}`;
  document.getElementById('itervis-stepnum').textContent = `Step ${step} / ${iterVis.maxComputed}`;

  // Highlight active row
  document.querySelectorAll('#itervis-list tbody tr').forEach(tr => {
    tr.classList.toggle('active', parseInt(tr.dataset.step) === step);
  });
  // Scroll into view
  const activeRow = document.querySelector('#itervis-list tbody tr.active');
  if (activeRow) activeRow.scrollIntoView({ block: 'nearest' });
}

function drawIterVis() {
  // Re-render the fractal then draw overlay
  queueRender();
  // Use setTimeout to draw after render completes
  setTimeout(() => {
    const w = canvas.width, h = canvas.height;
    const scale = 3 / (Math.min(w, h) * state.zoom);

    // Draw escape radius circle
    const escPx = state.escapeRadius / scale;
    const cx = (0 - state.centerX) / scale + w / 2;
    const cy = (0 - state.centerY) / scale + h / 2;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.arc(cx, cy, escPx, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw full path up to current step (faded)
    if (iterVis.currentStep > 0) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let j = 0; j <= iterVis.currentStep; j++) {
        const sx = (iterVis.orbit[j].r - state.centerX) / scale + w / 2;
        const sy = (iterVis.orbit[j].i - state.centerY) / scale + h / 2;
        if (j === 0) ctx.moveTo(sx, sy); else ctx.lineTo(sx, sy);
      }
      ctx.stroke();
    }

    // Draw dots for visited steps
    for (let j = 0; j <= iterVis.currentStep; j++) {
      const pt = iterVis.orbit[j];
      const sx = (pt.r - state.centerX) / scale + w / 2;
      const sy = (pt.i - state.centerY) / scale + h / 2;
      const isCurrent = j === iterVis.currentStep;
      const isEscape = iterVis.escaped && j === iterVis.escapeStep;

      ctx.beginPath();
      ctx.arc(sx, sy, isCurrent ? 5 : 2.5, 0, Math.PI * 2);

      if (isCurrent) {
        ctx.fillStyle = isEscape ? 'rgba(255, 0, 102, 0.9)' : 'rgba(0, 255, 255, 0.9)';
        ctx.fill();
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        // Label
        ctx.fillStyle = 'white';
        ctx.font = '10px monospace';
        ctx.fillText(`z${j}`, sx + 8, sy - 4);
      } else {
        const alpha = 0.3 + (j / iterVis.currentStep) * 0.5;
        ctx.fillStyle = isEscape ? `rgba(255, 0, 102, ${alpha})` : `rgba(0, 255, 255, ${alpha})`;
        ctx.fill();
      }
    }

    // Draw arrow from previous to current step
    if (iterVis.currentStep > 0) {
      const prev = iterVis.orbit[iterVis.currentStep - 1];
      const curr = iterVis.orbit[iterVis.currentStep];
      const sx1 = (prev.r - state.centerX) / scale + w / 2;
      const sy1 = (prev.i - state.centerY) / scale + h / 2;
      const sx2 = (curr.r - state.centerX) / scale + w / 2;
      const sy2 = (curr.i - state.centerY) / scale + h / 2;
      ctx.strokeStyle = 'rgba(255, 255, 0, 0.7)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(sx1, sy1);
      ctx.lineTo(sx2, sy2);
      ctx.stroke();
      // Arrowhead
      const angle = Math.atan2(sy2 - sy1, sx2 - sx1);
      ctx.fillStyle = 'rgba(255, 255, 0, 0.7)';
      ctx.beginPath();
      ctx.moveTo(sx2, sy2);
      ctx.lineTo(sx2 - 8 * Math.cos(angle - 0.4), sy2 - 8 * Math.sin(angle - 0.4));
      ctx.lineTo(sx2 - 8 * Math.cos(angle + 0.4), sy2 - 8 * Math.sin(angle + 0.4));
      ctx.closePath();
      ctx.fill();
    }
  }, 100);
}

function iterVisStep() {
  if (iterVis.currentStep < iterVis.maxComputed) {
    iterVis.currentStep++;
    updateIterVisStep();
    drawIterVis();
  } else {
    iterVisPause();
  }
}

function iterVisPlay(fast) {
  if (iterVis.playing) { iterVisPause(); return; }
  iterVis.playing = true;
  iterVis.speed = fast ? 80 : 300;
  document.getElementById('itervis-play').innerHTML = '&#9208;';
  iterVis.playTimer = setInterval(() => {
    if (iterVis.currentStep < iterVis.maxComputed) {
      iterVis.currentStep++;
      updateIterVisStep();
      drawIterVis();
    } else {
      iterVisPause();
    }
  }, iterVis.speed);
}

function iterVisPause() {
  iterVis.playing = false;
  if (iterVis.playTimer) clearInterval(iterVis.playTimer);
  document.getElementById('itervis-play').innerHTML = '&#9654;';
}

function iterVisReset() {
  iterVisPause();
  iterVis.currentStep = 0;
  updateIterVisStep();
  drawIterVis();
}

function closeIterVis() {
  iterVisPause();
  iterVis.active = false;
  document.getElementById('itervis-panel').classList.remove('visible');
  queueRender();
}

document.getElementById('itervis-step').addEventListener('click', iterVisStep);
document.getElementById('itervis-play').addEventListener('click', () => iterVisPlay(false));
document.getElementById('itervis-fast').addEventListener('click', () => iterVisPlay(true));
document.getElementById('itervis-reset').addEventListener('click', iterVisReset);
document.getElementById('itervis-close').addEventListener('click', closeIterVis);

document.getElementById('show-itervis').addEventListener('change', e => {
  if (!e.target.checked) closeIterVis();
});

// ==================== ANIMATION ====================
let animFrame = null;

// Morph waypoints: famous Julia sets to visit
const morphWaypoints = [
  { real: -0.70, imag: 0.27, name: 'Classic' },
  { real: -0.75, imag: 0.11, name: 'Spiral' },
  { real: -0.123, imag: 0.745, name: 'Douady Rabbit' },
  { real: 0.355, imag: 0.355, name: 'Starfish' },
  { real: 0, imag: 1, name: 'Dendrite' },
  { real: -0.4, imag: 0.6, name: 'Swirl' },
  { real: -0.8, imag: 0.156, name: 'Dragon' },
  { real: -0.390541, imag: -0.586788, name: 'Siegel Disk' },
  { real: -0.75, imag: 0, name: 'San Marco' },
  { real: 0.285, imag: 0.01, name: 'Galaxy' },
  { real: -0.1, imag: 0.651, name: 'Coral' },
  { real: -0.54, imag: 0.54, name: 'Lightning' },
];

// Catmull-Rom spline interpolation for smooth path through waypoints
function catmullRom(p0, p1, p2, p3, t) {
  const t2 = t * t;
  const t3 = t2 * t;
  return 0.5 * (
    (2 * p1) +
    (-p0 + p2) * t +
    (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
    (-p0 + 3 * p1 - 3 * p2 + p3) * t3
  );
}

function getMorphPosition(t) {
  const n = morphWaypoints.length;
  const totalT = t * n;
  const seg = Math.floor(totalT) % n;
  const localT = totalT - Math.floor(totalT);

  const p0 = morphWaypoints[(seg - 1 + n) % n];
  const p1 = morphWaypoints[seg];
  const p2 = morphWaypoints[(seg + 1) % n];
  const p3 = morphWaypoints[(seg + 2) % n];

  return {
    real: catmullRom(p0.real, p1.real, p2.real, p3.real, localT),
    imag: catmullRom(p0.imag, p1.imag, p2.imag, p3.imag, localT),
    name: localT < 0.15 ? p1.name : localT > 0.85 ? p2.name : ''
  };
}

function animStep(timestamp) {
  if (!state.animating) return;

  state.animT += state.animSpeed * 0.002;
  if (state.animT > 1) state.animT -= 1;

  const morphInfo = document.getElementById('morph-info');

  if (state.animPath === 'circle') {
    state.c.real = 0.7885 * Math.cos(2 * Math.PI * state.animT);
    state.c.imag = 0.7885 * Math.sin(2 * Math.PI * state.animT);
    morphInfo.style.display = 'none';
  } else if (state.animPath === 'figure8') {
    const t = 2 * Math.PI * state.animT;
    const denom = 1 + Math.sin(t) * Math.sin(t);
    state.c.real = 0.7 * Math.cos(t) / denom;
    state.c.imag = 0.7 * Math.sin(t) * Math.cos(t) / denom;
    morphInfo.style.display = 'none';
  } else if (state.animPath === 'morph') {
    const pos = getMorphPosition(state.animT);
    state.c.real = pos.real;
    state.c.imag = pos.imag;
    morphInfo.style.display = '';
    document.getElementById('morph-waypoint-name').textContent =
      pos.name ? `\u2192 ${pos.name}` : '';
  } else if (state.animPath === 'star') {
    // 5-pointed star path
    const t = 2 * Math.PI * state.animT;
    const r = 0.5 + 0.3 * Math.cos(5 * t);
    state.c.real = r * Math.cos(t);
    state.c.imag = r * Math.sin(t);
    morphInfo.style.display = 'none';
  } else if (state.animPath === 'heart') {
    // Heart curve (cardioid variant)
    const t = 2 * Math.PI * state.animT;
    state.c.real = 0.4 * (16 * Math.pow(Math.sin(t), 3)) / 16;
    state.c.imag = 0.4 * (13 * Math.cos(t) - 5 * Math.cos(2*t) - 2 * Math.cos(3*t) - Math.cos(4*t)) / 16 - 0.1;
    morphInfo.style.display = 'none';
  }

  updateSliders();
  render();
  animFrame = requestAnimationFrame(animStep);
}

// ==================== HOUSE MUSIC ENGINE ====================
const music = {
  ctx: null,
  masterGain: null,
  analyser: null,
  freqData: null,
  playing: false,
  enabled: true,
  volume: 0.6,
  bpm: 128,
  step: 0,
  timer: null,
  nodes: []
};

function initAudio() {
  if (music.ctx) return;
  music.ctx = new (window.AudioContext || window.webkitAudioContext)();

  // Master gain + compressor for clean output
  const compressor = music.ctx.createDynamicsCompressor();
  compressor.threshold.value = -12;
  compressor.ratio.value = 4;
  compressor.connect(music.ctx.destination);

  // Analyser for reactive colors
  music.analyser = music.ctx.createAnalyser();
  music.analyser.fftSize = 256;
  music.freqData = new Uint8Array(music.analyser.frequencyBinCount);
  music.analyser.connect(compressor);

  music.masterGain = music.ctx.createGain();
  music.masterGain.gain.value = music.volume;
  music.masterGain.connect(music.analyser);
}

function startMusic() {
  if (!music.enabled) return;
  initAudio();
  if (music.ctx.state === 'suspended') music.ctx.resume();
  music.playing = true;
  music.step = 0;
  const bpmMap = { house: 128, synthwave: 108, dnb: 174, lofi: 80, techno: 140 };
  music.bpm = bpmMap[music.genre] || 128;
  const stepTime = 60 / music.bpm / 4;
  music.timer = setInterval(() => musicStep(stepTime), stepTime * 1000);
}

function stopMusic() {
  music.playing = false;
  if (music.timer) clearInterval(music.timer);
  music.nodes.forEach(n => { try { n.stop(); } catch(e) {} });
  music.nodes = [];
}

music.genre = 'house';

function musicStep(stepTime) {
  if (!music.playing || !music.ctx) return;
  const now = music.ctx.currentTime;
  const s = music.step % 16;
  const genre = music.genre;

  // --- KICK ---
  const kickPattern = { house: s % 4 === 0, synthwave: s % 4 === 0, dnb: s === 0 || s === 6 || s === 10, lofi: s === 0 || s === 8, techno: s % 4 === 0 };
  if (kickPattern[genre]) {
    const osc = music.ctx.createOscillator();
    const gain = music.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(genre === 'techno' ? 180 : genre === 'dnb' ? 170 : 160, now);
    osc.frequency.exponentialRampToValueAtTime(genre === 'techno' ? 30 : 40, now + 0.12);
    gain.gain.setValueAtTime(genre === 'techno' ? 1.0 : 0.9, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    osc.connect(gain); gain.connect(music.masterGain);
    osc.start(now); osc.stop(now + 0.3);
    music.nodes.push(osc);
    if (s === 0) spawnBeatParticles();
  }

  // --- HI-HAT ---
  const hatPattern = { house: true, synthwave: s % 2 === 0, dnb: true, lofi: s % 4 === 0 || s % 4 === 2, techno: true };
  if (hatPattern[genre]) {
    const bufSize = music.ctx.sampleRate * 0.05;
    const buf = music.ctx.createBuffer(1, bufSize, music.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
    const noise = music.ctx.createBufferSource(); noise.buffer = buf;
    const hiFilter = music.ctx.createBiquadFilter();
    hiFilter.type = 'highpass';
    hiFilter.frequency.value = genre === 'lofi' ? 6000 : genre === 'dnb' ? 9000 : 8000;
    const gain = music.ctx.createGain();
    gain.gain.setValueAtTime(genre === 'lofi' ? 0.08 : genre === 'dnb' ? 0.3 : (s % 2 === 1) ? 0.25 : 0.1, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + (genre === 'dnb' ? 0.03 : 0.05));
    noise.connect(hiFilter); hiFilter.connect(gain); gain.connect(music.masterGain);
    noise.start(now); noise.stop(now + 0.06);
    music.nodes.push(noise);
  }

  // --- SNARE/CLAP ---
  if (s === 4 || s === 12) {
    const bufSize = music.ctx.sampleRate * 0.1;
    const buf = music.ctx.createBuffer(1, bufSize, music.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
    const noise = music.ctx.createBufferSource(); noise.buffer = buf;
    const filter = music.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = genre === 'dnb' ? 2000 : genre === 'lofi' ? 800 : 1200;
    filter.Q.value = genre === 'lofi' ? 0.8 : 2;
    const gain = music.ctx.createGain();
    gain.gain.setValueAtTime(genre === 'lofi' ? 0.2 : genre === 'dnb' ? 0.6 : 0.5, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    noise.connect(filter); filter.connect(gain); gain.connect(music.masterGain);
    noise.start(now); noise.stop(now + 0.15);
    music.nodes.push(noise);
  }

  // --- BASS ---
  const bassOn = { house: s % 4 === 0, synthwave: s % 8 === 0, dnb: s === 0 || s === 10, lofi: s === 0 || s === 8, techno: s % 2 === 0 };
  if (bassOn[genre]) {
    const bassNotes = { house: [55,55,73.42,65.41], synthwave: [55,49,65.41,55], dnb: [55,61.74,49,55], lofi: [65.41,73.42,82.41,73.42], techno: [55,55,55,55] };
    const freq = bassNotes[genre][Math.floor((music.step % 64) / 16)];
    const osc = music.ctx.createOscillator(); const osc2 = music.ctx.createOscillator();
    osc.type = genre === 'lofi' ? 'sine' : 'sawtooth';
    osc2.type = genre === 'lofi' ? 'triangle' : 'square';
    osc.frequency.value = freq; osc2.frequency.value = freq * (genre === 'synthwave' ? 1.005 : 1.002);
    const filter = music.ctx.createBiquadFilter(); filter.type = 'lowpass';
    const fFreq = genre === 'synthwave' ? 600 : genre === 'lofi' ? 300 : genre === 'techno' ? 200 : 400;
    filter.frequency.setValueAtTime(fFreq, now); filter.frequency.exponentialRampToValueAtTime(fFreq * 0.3, now + 0.2);
    filter.Q.value = genre === 'techno' ? 12 : 8;
    const gain = music.ctx.createGain();
    gain.gain.setValueAtTime(genre === 'lofi' ? 0.2 : 0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    osc.connect(filter); osc2.connect(filter); filter.connect(gain); gain.connect(music.masterGain);
    osc.start(now); osc2.start(now); osc.stop(now + 0.28); osc2.stop(now + 0.28);
    music.nodes.push(osc, osc2);
  }

  // --- PAD ---
  if (music.step % 32 === 0) {
    const chordSets = {
      house: [[220,277.18,329.63],[196,246.94,293.66],[174.61,220,261.63],[164.81,207.65,261.63]],
      synthwave: [[220,277.18,329.63],[196,246.94,329.63],[174.61,220,293.66],[164.81,246.94,329.63]],
      dnb: [[220,261.63,329.63],[196,261.63,311.13],[174.61,233.08,293.66],[164.81,220,277.18]],
      lofi: [[261.63,329.63,392],[246.94,311.13,369.99],[220,277.18,349.23],[196,261.63,329.63]],
      techno: [[220,329.63,440],[220,329.63,440],[196,293.66,392],[196,293.66,392]]
    };
    const chord = chordSets[genre][Math.floor((music.step % 128) / 32)];
    const padType = genre === 'lofi' ? 'sine' : genre === 'synthwave' ? 'sawtooth' : 'sine';
    const padVol = genre === 'lofi' ? 0.04 : genre === 'synthwave' ? 0.06 : genre === 'techno' ? 0.05 : 0.08;
    chord.forEach(freq => {
      const osc = music.ctx.createOscillator(); osc.type = padType; osc.frequency.value = freq;
      const osc2 = music.ctx.createOscillator(); osc2.type = 'triangle'; osc2.frequency.value = freq * 2.001;
      const gain = music.ctx.createGain();
      gain.gain.setValueAtTime(0, now); gain.gain.linearRampToValueAtTime(padVol, now + 0.3);
      gain.gain.setValueAtTime(padVol, now + 0.6); gain.gain.linearRampToValueAtTime(0, now + 1.2);
      osc.connect(gain); osc2.connect(gain); gain.connect(music.masterGain);
      osc.start(now); osc2.start(now); osc.stop(now + 1.3); osc2.stop(now + 1.3);
      music.nodes.push(osc, osc2);
    });
  }

  // --- GENRE EXTRAS ---
  if (genre === 'synthwave' && s % 2 === 0) {
    const arpNotes = [523.25,659.25,783.99,659.25,523.25,392,523.25,659.25];
    const osc = music.ctx.createOscillator(); osc.type = 'square';
    osc.frequency.value = arpNotes[Math.floor((music.step / 2) % arpNotes.length)];
    const gain = music.ctx.createGain();
    gain.gain.setValueAtTime(0.08, now); gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    osc.connect(gain); gain.connect(music.masterGain); osc.start(now); osc.stop(now + 0.14);
    music.nodes.push(osc);
  }
  if (genre === 'dnb' && (s === 2 || s === 7 || s === 14)) {
    const osc = music.ctx.createOscillator(); osc.type = 'triangle';
    osc.frequency.setValueAtTime(300, now); osc.frequency.exponentialRampToValueAtTime(100, now + 0.05);
    const gain = music.ctx.createGain();
    gain.gain.setValueAtTime(0.3, now); gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
    osc.connect(gain); gain.connect(music.masterGain); osc.start(now); osc.stop(now + 0.08);
    music.nodes.push(osc);
  }
  if (genre === 'techno' && s % 2 === 0) {
    const acidNotes = [110,110,146.83,110,130.81,110,146.83,130.81];
    const osc = music.ctx.createOscillator(); osc.type = 'sawtooth';
    osc.frequency.value = acidNotes[Math.floor((music.step / 2) % acidNotes.length)];
    const filter = music.ctx.createBiquadFilter(); filter.type = 'lowpass';
    filter.frequency.setValueAtTime(2000, now); filter.frequency.exponentialRampToValueAtTime(200, now + 0.1);
    filter.Q.value = 15;
    const gain = music.ctx.createGain();
    gain.gain.setValueAtTime(0.12, now); gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    osc.connect(filter); filter.connect(gain); gain.connect(music.masterGain); osc.start(now); osc.stop(now + 0.14);
    music.nodes.push(osc);
  }
  if (genre === 'lofi' && s === 0) {
    const bufSize = music.ctx.sampleRate * 0.3;
    const buf = music.ctx.createBuffer(1, bufSize, music.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1) * (Math.random() < 0.02 ? 1 : 0.01);
    const noise = music.ctx.createBufferSource(); noise.buffer = buf;
    const gain = music.ctx.createGain(); gain.gain.value = 0.15;
    noise.connect(gain); gain.connect(music.masterGain); noise.start(now); noise.stop(now + 0.3);
    music.nodes.push(noise);
  }
  // Rave stab (house & techno)
  if ((genre === 'house' || genre === 'techno') && music.step % 128 === 0 && music.step > 0) {
    [523.25,659.25,783.99].forEach(freq => {
      const osc = music.ctx.createOscillator(); osc.type = 'sawtooth'; osc.frequency.value = freq;
      const gain = music.ctx.createGain();
      gain.gain.setValueAtTime(0.2, now); gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
      osc.connect(gain); gain.connect(music.masterGain); osc.start(now); osc.stop(now + 0.18);
      music.nodes.push(osc);
    });
    spawnExplosion(particleCanvas.width / 2, particleCanvas.height / 2);
  }

  if (music.nodes.length > 100) music.nodes = music.nodes.slice(-50);
  music.step++;
}

function startAnim() {
  state.animating = true;
  animFrame = requestAnimationFrame(animStep);
  if (music.enabled) startMusic();
}

function pauseAnim() {
  state.animating = false;
  if (animFrame) cancelAnimationFrame(animFrame);
  stopMusic();
  // Render full quality when animation stops
  renderQueued = true;
  requestAnimationFrame(() => render(true));
}

function stopAnim() {
  pauseAnim();
  state.animT = 0;
}

// ==================== REACTIVE COLORS ====================
let reactiveFrame = null;

function getAudioEnergy() {
  if (!music.analyser || !music.freqData) return { bass: 0, mid: 0, high: 0, total: 0 };
  music.analyser.getByteFrequencyData(music.freqData);
  const bins = music.freqData.length;

  // Split into bass (0-15%), mid (15-40%), high (40-100%)
  let bass = 0, mid = 0, high = 0;
  const bassEnd = Math.floor(bins * 0.15);
  const midEnd = Math.floor(bins * 0.4);

  for (let i = 0; i < bins; i++) {
    if (i < bassEnd) bass += music.freqData[i];
    else if (i < midEnd) mid += music.freqData[i];
    else high += music.freqData[i];
  }

  bass /= bassEnd * 255;
  mid /= (midEnd - bassEnd) * 255;
  high /= (bins - midEnd) * 255;
  const total = (bass + mid + high) / 3;

  return { bass, mid, high, total };
}

function reactiveLoop() {
  if (!state.reactiveColors) { reactiveFrame = null; return; }

  const energy = getAudioEnergy();

  // Shift color offset based on cumulative bass energy
  state.reactiveOffset += energy.bass * 0.012 + energy.mid * 0.004;
  if (state.reactiveOffset > 1) state.reactiveOffset -= 1;

  // If animating, the main anim loop handles renders.
  // If not animating but reactive is on, trigger renders ourselves.
  if (!state.animating) {
    queueRender();
  }

  reactiveFrame = requestAnimationFrame(reactiveLoop);
}

function startReactive() {
  state.reactiveColors = true;
  initAudio();
  if (music.ctx.state === 'suspended') music.ctx.resume();
  if (!reactiveFrame) reactiveFrame = requestAnimationFrame(reactiveLoop);
}

function stopReactive() {
  state.reactiveColors = false;
  state.reactiveOffset = 0;
  if (reactiveFrame) cancelAnimationFrame(reactiveFrame);
  reactiveFrame = null;
  queueRender();
}

// ==================== DJ MODE ====================
function startDJMode() {
  state.djMode = true;
  // Auto-start music if not already playing
  if (!music.playing && music.enabled) {
    initAudio();
    if (music.ctx.state === 'suspended') music.ctx.resume();
    startMusic();
  }
  // Auto-enable reactive colors for full experience
  if (!state.reactiveColors) {
    document.getElementById('reactive-colors-check').checked = true;
    startReactive();
  }
  document.getElementById('canvas-container').style.cursor = 'none';
  document.getElementById('canvas-container').classList.add('dj-active');
  document.getElementById('dj-indicator').classList.add('visible');
  document.getElementById('dj-crosshair').classList.add('visible');
  // Fade out indicator after 3 seconds
  setTimeout(() => document.getElementById('dj-indicator').classList.remove('visible'), 3000);
}

function stopDJMode() {
  state.djMode = false;
  state.djDragging = false;
  document.getElementById('canvas-container').style.cursor = 'crosshair';
  document.getElementById('canvas-container').classList.remove('dj-active');
  document.getElementById('dj-indicator').classList.remove('visible');
  document.getElementById('dj-crosshair').classList.remove('visible');
  // Stop standalone music if not animating
  if (!state.animating && music.playing) stopMusic();
}

// ==================== UI BINDINGS ====================
function updateSliders() {
  document.getElementById('real-slider').value = state.c.real;
  document.getElementById('imag-slider').value = state.c.imag;
  document.getElementById('real-val').textContent = state.c.real.toFixed(4);
  document.getElementById('imag-val').textContent = state.c.imag.toFixed(4);
}

// Fractal type
document.querySelectorAll('input[name="fractalType"]').forEach(r => {
  r.addEventListener('change', () => {
    state.fractalType = r.value;
    const showJulia = r.value === 'julia' || r.value === 'split';
    document.getElementById('julia-params').style.display = showJulia ? '' : 'none';
    document.getElementById('presets-section').style.display = showJulia ? '' : 'none';
    document.getElementById('anim-section').style.display = showJulia ? '' : 'none';
    if (r.value === 'mandelbrot') unlockAchievement('mandelbrot');
    if (r.value === 'burningship') unlockAchievement('burning_ship');
    resizeCanvas();
  });
});

// Sliders
document.getElementById('real-slider').addEventListener('input', e => {
  state.c.real = parseFloat(e.target.value);
  document.getElementById('real-val').textContent = state.c.real.toFixed(4);
  interactiveRender();
});

document.getElementById('imag-slider').addEventListener('input', e => {
  state.c.imag = parseFloat(e.target.value);
  document.getElementById('imag-val').textContent = state.c.imag.toFixed(4);
  interactiveRender();
});

document.getElementById('iter-slider').addEventListener('input', e => {
  state.maxIter = parseInt(e.target.value);
  document.getElementById('iter-val').textContent = state.maxIter;
  interactiveRender();
});

document.getElementById('escape-slider').addEventListener('input', e => {
  state.escapeRadius = parseFloat(e.target.value);
  document.getElementById('escape-val').textContent = state.escapeRadius;
  interactiveRender();
});

document.getElementById('smooth-check').addEventListener('change', e => {
  state.smooth = e.target.checked;
  queueRender();
});

document.getElementById('color-scheme').addEventListener('change', e => {
  state.colorScheme = e.target.value;
  document.getElementById('gradient-editor').style.display = e.target.value === 'custom' ? '' : 'none';
  if (e.target.value === 'custom') {
    state.customLUT = buildCustomLUT(state.customGradientStops);
    renderGradientEditor();
  }
  queueRender();
});

// ==================== GRADIENT EDITOR ====================
function stopsToCSS(stops) {
  const sorted = [...stops].sort((a, b) => a.pos - b.pos);
  return `linear-gradient(90deg, ${sorted.map(s => `${s.color} ${(s.pos * 100).toFixed(0)}%`).join(', ')})`;
}

function renderGradientEditor() {
  // Preview bar
  document.getElementById('gradient-preview').style.background = stopsToCSS(state.customGradientStops);

  // Stop rows
  const container = document.getElementById('gradient-stops');
  container.innerHTML = '';
  const sorted = [...state.customGradientStops].sort((a, b) => a.pos - b.pos);

  sorted.forEach((stop, i) => {
    const origIdx = state.customGradientStops.indexOf(stop);
    const row = document.createElement('div');
    row.className = 'gradient-stop-row';

    const colorInput = document.createElement('input');
    colorInput.type = 'color';
    colorInput.value = stop.color;
    colorInput.addEventListener('input', () => {
      state.customGradientStops[origIdx].color = colorInput.value;
      updateGradient();
    });

    const posSlider = document.createElement('input');
    posSlider.type = 'range';
    posSlider.min = '0';
    posSlider.max = '1';
    posSlider.step = '0.01';
    posSlider.value = stop.pos;
    const posLabel = document.createElement('span');
    posLabel.className = 'stop-pos';
    posLabel.textContent = (stop.pos * 100).toFixed(0) + '%';

    posSlider.addEventListener('input', () => {
      state.customGradientStops[origIdx].pos = parseFloat(posSlider.value);
      posLabel.textContent = (posSlider.value * 100).toFixed(0) + '%';
      updateGradient();
    });

    row.appendChild(colorInput);
    row.appendChild(posSlider);
    row.appendChild(posLabel);

    if (state.customGradientStops.length > 2) {
      const delBtn = document.createElement('button');
      delBtn.className = 'stop-del';
      delBtn.textContent = '\u00d7';
      delBtn.addEventListener('click', () => {
        state.customGradientStops.splice(origIdx, 1);
        updateGradient();
        renderGradientEditor();
      });
      row.appendChild(delBtn);
    }

    container.appendChild(row);
  });

  renderSavedGradients();
}

function updateGradient() {
  state.customLUT = buildCustomLUT(state.customGradientStops);
  document.getElementById('gradient-preview').style.background = stopsToCSS(state.customGradientStops);
  if (state.colorScheme === 'custom') queueRender();
}

document.getElementById('add-stop-btn').addEventListener('click', () => {
  // Add a stop at midpoint with a blended color
  const sorted = [...state.customGradientStops].sort((a, b) => a.pos - b.pos);
  let maxGap = 0, gapIdx = 0;
  for (let i = 0; i < sorted.length - 1; i++) {
    const gap = sorted[i + 1].pos - sorted[i].pos;
    if (gap > maxGap) { maxGap = gap; gapIdx = i; }
  }
  const midPos = (sorted[gapIdx].pos + sorted[gapIdx + 1].pos) / 2;
  const c0 = hexToRGB(sorted[gapIdx].color), c1 = hexToRGB(sorted[gapIdx + 1].color);
  const midColor = '#' + [0,1,2].map(j => Math.round((c0[j] + c1[j]) / 2).toString(16).padStart(2, '0')).join('');
  state.customGradientStops.push({ pos: midPos, color: midColor });
  updateGradient();
  renderGradientEditor();
});

// Save/Load gradients
document.getElementById('save-gradient-btn').addEventListener('click', () => {
  const name = document.getElementById('gradient-name').value.trim() || 'Untitled';
  const saved = JSON.parse(localStorage.getItem('juliaCustomSchemes') || '[]');
  saved.push({ name, stops: JSON.parse(JSON.stringify(state.customGradientStops)) });
  localStorage.setItem('juliaCustomSchemes', JSON.stringify(saved));
  document.getElementById('gradient-name').value = '';
  renderSavedGradients();
  unlockAchievement('color_custom');
});

function renderSavedGradients() {
  const container = document.getElementById('saved-gradients');
  const saved = JSON.parse(localStorage.getItem('juliaCustomSchemes') || '[]');
  container.innerHTML = '';

  saved.forEach((item, i) => {
    const row = document.createElement('div');
    row.className = 'saved-gradient-item';

    const preview = document.createElement('div');
    preview.className = 'saved-preview';
    preview.style.background = stopsToCSS(item.stops);

    const nameSpan = document.createElement('span');
    nameSpan.className = 'saved-name';
    nameSpan.textContent = item.name;

    const loadBtn = document.createElement('button');
    loadBtn.className = 'load-btn';
    loadBtn.textContent = 'Load';
    loadBtn.addEventListener('click', () => {
      state.customGradientStops = JSON.parse(JSON.stringify(item.stops));
      updateGradient();
      renderGradientEditor();
    });

    const delBtn = document.createElement('button');
    delBtn.className = 'del-btn';
    delBtn.textContent = '\u00d7';
    delBtn.addEventListener('click', () => {
      saved.splice(i, 1);
      localStorage.setItem('juliaCustomSchemes', JSON.stringify(saved));
      renderSavedGradients();
    });

    row.appendChild(preview);
    row.appendChild(nameSpan);
    row.appendChild(loadBtn);
    row.appendChild(delBtn);
    container.appendChild(row);
  });
}

// Presets
document.querySelectorAll('.preset-btn[data-real]').forEach((btn, idx) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.c.real = parseFloat(btn.dataset.real);
    state.c.imag = parseFloat(btn.dataset.imag);
    updateSliders();
    queueRender();
    // Particles on preset switch
    spawnExplosion(particleCanvas.width / 2, particleCanvas.height / 2);
    // Achievement tracking
    achState.presetsVisited.add(idx);
    if (achState.presetsVisited.size >= 6) unlockAchievement('all_presets');
  });
});

document.getElementById('random-preset').addEventListener('click', () => {
  document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
  state.c.real = (Math.random() - 0.5) * 2.5;
  state.c.imag = (Math.random() - 0.5) * 2.5;
  updateSliders();
  queueRender();
});

// View controls
document.getElementById('zoom-in-btn').addEventListener('click', () => { state.zoom *= 1.5; interactiveRender(); });
document.getElementById('zoom-out-btn').addEventListener('click', () => { state.zoom /= 1.5; interactiveRender(); });
document.getElementById('reset-view-btn').addEventListener('click', resetView);

function resetView() {
  state.centerX = 0;
  state.centerY = 0;
  state.zoom = 1;
  queueRender();
}

// Show coords
document.getElementById('show-coords').addEventListener('change', e => {
  state.showCoords = e.target.checked;
  document.getElementById('coords-overlay').style.display = e.target.checked ? '' : 'none';
});

document.getElementById('show-orbit').addEventListener('change', e => {
  state.showOrbit = e.target.checked;
  if (!e.target.checked) {
    document.getElementById('orbit-panel').classList.remove('visible');
    queueRender();
  }
});

// Animation
document.getElementById('anim-play').addEventListener('click', startAnim);
document.getElementById('anim-pause').addEventListener('click', pauseAnim);
document.getElementById('anim-stop').addEventListener('click', stopAnim);

document.getElementById('speed-slider').addEventListener('input', e => {
  state.animSpeed = parseFloat(e.target.value);
  document.getElementById('speed-val').textContent = state.animSpeed.toFixed(2);
});

document.getElementById('music-check').addEventListener('change', e => {
  music.enabled = e.target.checked;
  if (!e.target.checked && music.playing) stopMusic();
  if (e.target.checked && state.animating) startMusic();
});

document.getElementById('vol-slider').addEventListener('input', e => {
  music.volume = parseInt(e.target.value) / 100;
  document.getElementById('vol-val').textContent = e.target.value + '%';
  if (music.masterGain) music.masterGain.gain.value = music.volume;
});

document.getElementById('genre-select').addEventListener('change', e => {
  music.genre = e.target.value;
  achState.genresTried.add(e.target.value);
  if (achState.genresTried.size >= 5) unlockAchievement('genre_all');
  // Restart music with new BPM if playing
  if (music.playing) {
    stopMusic();
    startMusic();
  }
});

document.querySelectorAll('input[name="animPath"]').forEach(r => {
  r.addEventListener('change', () => {
    state.animPath = r.value;
    document.getElementById('morph-info').style.display = r.value === 'morph' ? '' : 'none';
    achState.pathsTried.add(r.value);
    if (achState.pathsTried.size >= 5) unlockAchievement('all_paths');
  });
});

document.getElementById('dj-mode-check').addEventListener('change', e => {
  document.getElementById('dj-info').style.display = e.target.checked ? '' : 'none';
  if (e.target.checked) unlockAchievement('dj_mode');
  if (e.target.checked) startDJMode(); else stopDJMode();
});

document.getElementById('reactive-colors-check').addEventListener('change', e => {
  document.getElementById('reactive-info').style.display = e.target.checked ? '' : 'none';
  if (e.target.checked) { startReactive(); unlockAchievement('reactive'); }
  else stopReactive();
});

function cycleAnimPath() {
  const paths = ['circle', 'figure8', 'morph', 'star', 'heart'];
  const idx = paths.indexOf(state.animPath);
  state.animPath = paths[(idx + 1) % paths.length];
  document.querySelectorAll('input[name="animPath"]').forEach(r => {
    r.checked = r.value === state.animPath;
  });
  document.getElementById('morph-info').style.display = state.animPath === 'morph' ? '' : 'none';
}

// Toggle controls
document.getElementById('toggle-controls').addEventListener('click', toggleControls);

function toggleControls() {
  state.controlsVisible = !state.controlsVisible;
  document.getElementById('controls').classList.toggle('collapsed', !state.controlsVisible);
  setTimeout(resizeCanvas, 310);
}

// Quiz button
document.getElementById('quiz-btn').addEventListener('click', startQuiz);

// Info panel
document.getElementById('info-btn').addEventListener('click', () => {
  document.getElementById('info-panel').classList.toggle('visible');
});
document.getElementById('close-info').addEventListener('click', () => {
  document.getElementById('info-panel').classList.remove('visible');
});

// Export
document.getElementById('save-btn').addEventListener('click', () => {
  const link = document.createElement('a');
  link.download = `julia-set-${state.c.real.toFixed(3)}_${state.c.imag.toFixed(3)}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
  unlockAchievement('screenshot');
});

document.getElementById('copy-params-btn').addEventListener('click', () => {
  const params = `c = ${state.c.real} + ${state.c.imag}i | Zoom: ${state.zoom.toFixed(2)}x | Iterations: ${state.maxIter} | Color: ${state.colorScheme}`;
  navigator.clipboard.writeText(params).then(() => {
    const btn = document.getElementById('copy-params-btn');
    btn.textContent = 'Copied!';
    setTimeout(() => btn.textContent = 'Copy Parameters', 1500);
  });
});

// ==================== MOUSE INTERACTION ====================
const container = document.getElementById('canvas-container');
let dragRenderTimeout = null;

container.addEventListener('mousemove', e => {
  // DJ Mode: move crosshair and warp c parameter
  if (state.djMode) {
    const crosshair = document.getElementById('dj-crosshair');
    const rect = container.getBoundingClientRect();
    crosshair.style.left = (e.clientX - rect.left - 15) + 'px';
    crosshair.style.top = (e.clientY - rect.top - 15) + 'px';

    if (state.djDragging) {
      const canvasRect = canvas.getBoundingClientRect();
      const nx = (e.clientX - canvasRect.left) / canvasRect.width;
      const ny = (e.clientY - canvasRect.top) / canvasRect.height;
      state.c.real = (nx - 0.5) * 3;
      state.c.imag = (ny - 0.5) * 3;
      updateSliders();
      interactiveRender();
      return;
    }
  }

  if (state.showCoords && !state.dragging) {
    const rect = canvas.getBoundingClientRect();
    const dpr = canvas.width / rect.width;
    const px = (e.clientX - rect.left) * dpr;
    const py = (e.clientY - rect.top) * dpr;
    const p = pixelToComplex(px, py, canvas.width, canvas.height, state.centerX, state.centerY, state.zoom);
    document.getElementById('coords-overlay').textContent =
      `${p.x >= 0 ? ' ' : ''}${p.x.toFixed(6)} ${p.y >= 0 ? '+' : '-'} ${Math.abs(p.y).toFixed(6)}i`;
  }

  if (state.dragging) {
    const dx = e.clientX - state.dragStartX;
    const dy = e.clientY - state.dragStartY;

    // Update center based on drag delta
    const rect = canvas.getBoundingClientRect();
    const dpr = canvas.width / rect.width;
    const scale = 3 / (Math.min(canvas.width, canvas.height) * state.zoom);
    state.centerX = state.dragCenterX - dx * dpr * scale;
    state.centerY = state.dragCenterY - dy * dpr * scale;

    // Live draft render during drag
    interactiveRender();
  }
});

container.addEventListener('mousedown', e => {
  if (e.button === 0) {
    // DJ Mode: start DJ drag
    if (state.djMode) {
      state.djDragging = true;
      container.style.cursor = 'none';
      return;
    }
    state.dragging = true;
    state.dragStartX = e.clientX;
    state.dragStartY = e.clientY;
    state.dragCenterX = state.centerX;
    state.dragCenterY = state.centerY;
    container.style.cursor = 'grabbing';
    if (dragRenderTimeout) clearTimeout(dragRenderTimeout);
  }
});

window.addEventListener('mouseup', () => {
  if (state.djDragging) {
    state.djDragging = false;
    if (state.djMode) container.style.cursor = 'none';
    scheduleFullRender();
    return;
  }
  if (state.dragging) {
    state.dragging = false;
    container.style.cursor = 'crosshair';
    scheduleFullRender();
  }
});

container.addEventListener('click', e => {
  if (!state.dragging) {
    const rect = canvas.getBoundingClientRect();
    const dpr = canvas.width / rect.width;
    const px = (e.clientX - rect.left) * dpr;
    const py = (e.clientY - rect.top) * dpr;
    if (state.showOrbit) showOrbit(px, py);
    if (document.getElementById('show-itervis').checked) startIterVis(px, py);
  }

  // Split view: click on mandelbrot side sets julia c value
  if (state.fractalType === 'split') {
    const rect = splitCanvas.getBoundingClientRect();
    if (e.clientX >= rect.left && e.clientX <= rect.right) {
      const dpr = splitCanvas.width / rect.width;
      const px = (e.clientX - rect.left) * dpr;
      const py = (e.clientY - rect.top) * dpr;
      const p = pixelToComplex(px, py, splitCanvas.width, splitCanvas.height, state.centerX, state.centerY, state.zoom);
      state.c.real = p.x;
      state.c.imag = p.y;
      updateSliders();
      queueRender();
    }
  }
});

container.addEventListener('dblclick', e => {
  const rect = canvas.getBoundingClientRect();
  const dpr = canvas.width / rect.width;
  const px = (e.clientX - rect.left) * dpr;
  const py = (e.clientY - rect.top) * dpr;
  const p = pixelToComplex(px, py, canvas.width, canvas.height, state.centerX, state.centerY, state.zoom);
  state.centerX = p.x;
  state.centerY = p.y;
  state.zoom *= 2;
  queueRender();
});

container.addEventListener('wheel', e => {
  e.preventDefault();
  const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;

  // Zoom toward mouse position
  const rect = canvas.getBoundingClientRect();
  const dpr = canvas.width / rect.width;
  const px = (e.clientX - rect.left) * dpr;
  const py = (e.clientY - rect.top) * dpr;
  const p = pixelToComplex(px, py, canvas.width, canvas.height, state.centerX, state.centerY, state.zoom);

  state.zoom *= factor;

  // Adjust center so mouse position stays fixed
  const newP = pixelToComplex(px, py, canvas.width, canvas.height, state.centerX, state.centerY, state.zoom);
  state.centerX += p.x - newP.x;
  state.centerY += p.y - newP.y;

  interactiveRender();
}, { passive: false });

// ==================== KEYBOARD SHORTCUTS ====================
document.addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;

  switch (e.key) {
    case ' ': e.preventDefault(); toggleControls(); break;
    case 'r': case 'R': resetView(); break;
    case 's': case 'S': document.getElementById('save-btn').click(); break;
    case 'a': case 'A': state.animating ? pauseAnim() : startAnim(); break;
    case 'm': case 'M': cycleAnimPath(); break;
    case 'd': case 'D': {
      const cb = document.getElementById('dj-mode-check');
      cb.checked = !cb.checked;
      cb.dispatchEvent(new Event('change'));
      break;
    }
    case 'i': case 'I': document.getElementById('info-panel').classList.toggle('visible'); break;
    case '+': case '=': state.zoom *= 1.5; interactiveRender(); break;
    case '-': case '_': state.zoom /= 1.5; interactiveRender(); break;
    case 'ArrowUp': state.centerY -= 0.1 / state.zoom; interactiveRender(); break;
    case 'ArrowDown': state.centerY += 0.1 / state.zoom; interactiveRender(); break;
    case 'ArrowLeft': state.centerX -= 0.1 / state.zoom; interactiveRender(); break;
    case 'ArrowRight': state.centerX += 0.1 / state.zoom; interactiveRender(); break;
    case '1': selectPreset(0); break;
    case '2': selectPreset(1); break;
    case '3': selectPreset(2); break;
    case '4': selectPreset(3); break;
    case '5': selectPreset(4); break;
    case '6': selectPreset(5); break;
  }
});

function selectPreset(idx) {
  const btns = document.querySelectorAll('.preset-btn[data-real]');
  if (btns[idx]) btns[idx].click();
}

// ==================== PARTICLE SYSTEM ====================
const particleCanvas = document.getElementById('particle-canvas');
const pCtx = particleCanvas.getContext('2d');
let particles = [];
let particlesEnabled = true;

function resizeParticleCanvas() {
  const cont = document.getElementById('canvas-container');
  particleCanvas.width = cont.clientWidth;
  particleCanvas.height = cont.clientHeight;
}

const neonColors = ['#ff00ff', '#00ffff', '#39ff14', '#ffff00', '#ff0066', '#4444ff', '#ff8800'];

function spawnParticles(x, y, count, opts = {}) {
  if (!particlesEnabled) return;
  const cx = x || particleCanvas.width / 2;
  const cy = y || particleCanvas.height / 2;
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = (opts.speed || 3) + Math.random() * (opts.speedVar || 4);
    const color = opts.color || neonColors[Math.floor(Math.random() * neonColors.length)];
    particles.push({
      x: cx, y: cy,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 1,
      decay: 0.008 + Math.random() * 0.012,
      size: (opts.size || 2) + Math.random() * (opts.sizeVar || 3),
      color,
      trail: opts.trail || false
    });
  }
}

function spawnBeatParticles() {
  if (!particlesEnabled) return;
  const w = particleCanvas.width, h = particleCanvas.height;
  const side = Math.floor(Math.random() * 4);
  let x, y;
  if (side === 0) { x = Math.random() * w; y = 0; }
  else if (side === 1) { x = w; y = Math.random() * h; }
  else if (side === 2) { x = Math.random() * w; y = h; }
  else { x = 0; y = Math.random() * h; }
  spawnParticles(x, y, 15, { speed: 2, speedVar: 3, size: 1, sizeVar: 2 });
}

function spawnExplosion(x, y) {
  spawnParticles(x, y, 60, { speed: 5, speedVar: 6, size: 2, sizeVar: 4, trail: true });
}

function particleLoop() {
  pCtx.clearRect(0, 0, particleCanvas.width, particleCanvas.height);
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx; p.y += p.vy;
    p.vx *= 0.98; p.vy *= 0.98;
    p.vy += 0.02;
    p.life -= p.decay;
    if (p.life <= 0) { particles.splice(i, 1); continue; }
    pCtx.globalAlpha = p.life;
    pCtx.fillStyle = p.color;
    pCtx.shadowColor = p.color;
    pCtx.shadowBlur = p.size * 3;
    pCtx.beginPath();
    pCtx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
    pCtx.fill();
    if (p.trail && p.life > 0.3) {
      pCtx.globalAlpha = p.life * 0.3;
      pCtx.beginPath();
      pCtx.arc(p.x - p.vx * 2, p.y - p.vy * 2, p.size * p.life * 0.6, 0, Math.PI * 2);
      pCtx.fill();
    }
  }
  pCtx.globalAlpha = 1; pCtx.shadowBlur = 0;
  requestAnimationFrame(particleLoop);
}
particleLoop();

document.getElementById('particles-check').addEventListener('change', e => {
  particlesEnabled = e.target.checked;
  if (!e.target.checked) { particles = []; pCtx.clearRect(0, 0, particleCanvas.width, particleCanvas.height); }
});

// ==================== ACHIEVEMENTS ====================
const achievements = [
  { id: 'first_render', icon: '\u{1F3A8}', name: 'First Impression', desc: 'Render your first fractal' },
  { id: 'all_presets', icon: '\u{2B50}', name: 'Collector', desc: 'Visit all 6 preset Julia sets' },
  { id: 'zoom_100', icon: '\u{1F50D}', name: 'Deep Diver', desc: 'Zoom past 100x' },
  { id: 'zoom_1000', icon: '\u{1F30C}', name: 'Into the Void', desc: 'Zoom past 1000x' },
  { id: 'dj_mode', icon: '\u{1F3B5}', name: 'DJ Fractal', desc: 'Activate DJ mode' },
  { id: 'quiz_done', icon: '\u{1F9E0}', name: 'Self Discovery', desc: 'Complete the personality quiz' },
  { id: 'all_paths', icon: '\u{1F300}', name: 'Pathfinder', desc: 'Try all 5 animation paths' },
  { id: 'screenshot', icon: '\u{1F4F8}', name: 'Photographer', desc: 'Save a fractal image' },
  { id: 'color_custom', icon: '\u{1F308}', name: 'Artist', desc: 'Create a custom gradient' },
  { id: 'genre_all', icon: '\u{1F3B6}', name: 'Music Lover', desc: 'Try all 5 music genres' },
  { id: 'speed_max', icon: '\u{26A1}', name: 'Speed Demon', desc: 'Set animation speed to max' },
  { id: 'iter_2000', icon: '\u{1F4A0}', name: 'Perfectionist', desc: 'Set iterations to 2000' },
  { id: 'mandelbrot', icon: '\u{1F4D0}', name: 'Mandelbro', desc: 'View the Mandelbrot set' },
  { id: 'burning_ship', icon: '\u{1F525}', name: 'Pyromania', desc: 'View the Burning Ship fractal' },
  { id: 'night_owl', icon: '\u{1F989}', name: 'Night Owl', desc: 'Use the explorer after midnight' },
  { id: 'reactive', icon: '\u{1F4A5}', name: 'Feel the Beat', desc: 'Enable reactive colors' },
];

const achState = {
  unlocked: JSON.parse(localStorage.getItem('juliaAchievements') || '{}'),
  presetsVisited: new Set(),
  pathsTried: new Set(),
  genresTried: new Set(),
};

function unlockAchievement(id) {
  if (achState.unlocked[id]) return;
  const ach = achievements.find(a => a.id === id);
  if (!ach) return;
  achState.unlocked[id] = Date.now();
  localStorage.setItem('juliaAchievements', JSON.stringify(achState.unlocked));
  const toast = document.getElementById('achievement-toast');
  toast.querySelector('.ach-icon').textContent = ach.icon;
  toast.querySelector('.ach-name').textContent = ach.name;
  toast.querySelector('.ach-desc').textContent = ach.desc;
  toast.classList.add('visible');
  spawnExplosion(particleCanvas.width / 2, particleCanvas.height / 2);
  setTimeout(() => toast.classList.remove('visible'), 4000);
}

function checkAchievements() {
  if (state.zoom >= 100) unlockAchievement('zoom_100');
  if (state.zoom >= 1000) unlockAchievement('zoom_1000');
  if (state.maxIter >= 2000) unlockAchievement('iter_2000');
  if (state.animSpeed >= 2) unlockAchievement('speed_max');
  const hour = new Date().getHours();
  if (hour >= 0 && hour < 5) unlockAchievement('night_owl');
}

function renderAchievementsPanel() {
  const grid = document.getElementById('ach-grid');
  const unlocked = Object.keys(achState.unlocked).length;
  grid.innerHTML = achievements.map(a => {
    const done = achState.unlocked[a.id];
    return `<div class="ach-card ${done ? 'unlocked' : 'locked'}">
      <div class="ach-card-icon">${a.icon}</div>
      <div class="ach-card-name">${done ? a.name : '???'}</div>
      <div class="ach-card-desc">${done ? a.desc : 'Keep exploring...'}</div>
    </div>`;
  }).join('');
  document.getElementById('ach-progress').textContent = `${unlocked} / ${achievements.length} unlocked`;
}

document.getElementById('ach-btn').addEventListener('click', () => {
  renderAchievementsPanel();
  document.getElementById('achievements-panel').classList.toggle('visible');
});
document.getElementById('close-ach').addEventListener('click', () => {
  document.getElementById('achievements-panel').classList.remove('visible');
});

// ==================== INIT ====================
window.addEventListener('resize', () => { resizeCanvas(); resizeParticleCanvas(); });
resizeCanvas();
resizeParticleCanvas();

// First render achievement
setTimeout(() => unlockAchievement('first_render'), 2000);
