// === Tab Navigation ===
function switchTab(tabId) {
  // Update pills
  document.querySelectorAll('.tab-pill').forEach(pill => {
    pill.classList.toggle('active', pill.dataset.tab === tabId);
  });

  // Update panels
  document.querySelectorAll('.tab-panel').forEach(panel => {
    panel.classList.toggle('active', panel.id === tabId);
  });

  // Resize canvases after switching (they need layout to measure)
  setTimeout(() => {
    const resizeMap = {
      'tab-viz': () => { VIZ.resize(); VIZ.draw(state); },
      'tab-heatmap': () => { HEATMAP.resize(); HEATMAP.draw(state); },
      'tab-boundary': () => { BOUNDARY.resize(); BOUNDARY.draw(state); },
      'tab-chain': () => { CHAIN.resize(); CHAIN.draw(state); },
      'tab-activation': () => { ACTIVATION.resize(); ACTIVATION.draw(state); },
      'tab-sensitivity': () => { SENSITIVITY.resize(); SENSITIVITY.draw(state); },
      'tab-battle': () => { BATTLE.resize(); BATTLE.draw(state); updateBattleWeights(); },
    };
    if (resizeMap[tabId]) resizeMap[tabId]();
  }, 50);
}

// === Main Application ===

const INITIAL_WEIGHTS = {
  tiredness: 0.85,
  urgency: -0.90,
  workLength: -0.40,
  timeSinceSlept: 0.75,
  stress: 0.50,
};

const INITIAL_BIAS = 0.25;

const FLAVOR_TEXT = [
  { min: 90, max: 100, text: "You're already asleep, aren't you" },
  { min: 75, max: 89, text: "Your pillow is calling..." },
  { min: 60, max: 74, text: "A quick 20 min won't hurt" },
  { min: 50, max: 59, text: "It's honestly 50/50" },
  { min: 40, max: 49, text: "You know you should work..." },
  { min: 25, max: 39, text: "Deadline brain activated" },
  { min: 0, max: 24, text: "No nap. Only grind." },
];

const SCENARIOS = [
  {
    title: "2am Before the Exam",
    desc: "You've been studying all day. The exam is in 6 hours.",
    inputs: { tiredness: 0.9, urgency: 1.0, workLength: 0.8, timeSinceSlept: 0.9, stress: 0.95 },
  },
  {
    title: "Sunday Afternoon",
    desc: "Nothing due, couch is comfy, rain outside.",
    inputs: { tiredness: 0.5, urgency: 0.15, workLength: 0.3, timeSinceSlept: 0.4, stress: 0.2 },
  },
  {
    title: "Post-Lunch Slump",
    desc: "Big lunch, warm office, eyelids heavy.",
    inputs: { tiredness: 0.8, urgency: 0.2, workLength: 0.4, timeSinceSlept: 0.35, stress: 0.3 },
  },
  {
    title: "Coffee Just Hit",
    desc: "Fresh espresso kicking in. You feel unstoppable.",
    inputs: { tiredness: 0.2, urgency: 0.4, workLength: 0.5, timeSinceSlept: 0.3, stress: 0.45 },
  },
  {
    title: "Finals Week",
    desc: "Three exams in two days. You slept 3 hours last night.",
    inputs: { tiredness: 0.95, urgency: 0.95, workLength: 1.0, timeSinceSlept: 0.85, stress: 1.0 },
  },
  {
    title: "3am Side Project",
    desc: "No deadline, but you're in the zone and the code is flowing.",
    inputs: { tiredness: 0.7, urgency: 0.05, workLength: 0.6, timeSinceSlept: 0.8, stress: 0.15 },
  },
  {
    title: "Monday Morning",
    desc: "Alarm went off 10 minutes ago. The week stretches ahead.",
    inputs: { tiredness: 0.6, urgency: 0.55, workLength: 0.7, timeSinceSlept: 0.1, stress: 0.5 },
  },
  {
    title: "Gym Just Hit",
    desc: "Post-workout glow. Body tired, mind clear.",
    inputs: { tiredness: 0.65, urgency: 0.3, workLength: 0.35, timeSinceSlept: 0.25, stress: 0.1 },
  },
  {
    title: "Group Project Due",
    desc: "Your part is done but your teammate ghosted. Presentation in 2 hours.",
    inputs: { tiredness: 0.4, urgency: 0.85, workLength: 0.5, timeSinceSlept: 0.5, stress: 0.8 },
  },
  {
    title: "Netflix & Procrastinate",
    desc: "Assignment due tomorrow but you just started a new show.",
    inputs: { tiredness: 0.35, urgency: 0.6, workLength: 0.65, timeSinceSlept: 0.3, stress: 0.4 },
  },
];

const MILESTONES = [
  { threshold: 50, text: "Your neuron is waking up...", shown: false },
  { threshold: 75, text: "Getting the hang of it!", shown: false },
  { threshold: 90, text: "Almost perfectly calibrated...", shown: false },
  { threshold: 100, text: "Perfectly trained!", shown: false },
];

// State
const state = {
  inputs: {
    tiredness: 0.5,
    urgency: 0.5,
    workLength: 0.5,
    timeSinceSlept: 0.5,
    stress: 0.5,
  },
  weights: { ...INITIAL_WEIGHTS },
  bias: INITIAL_BIAS,
  z: 0,
  probability: 0.5,
  decision: 'Nap',
  trainingPoints: [],
  activeLabel: 1,
  stepCount: 0,
  accuracy: null,
  isTraining: false,
  muted: false,
  activationFn: 'sigmoid',
  // Two-Neuron Chain
  chainWeight: 0.80,
  n2Inputs: { budget: 0.5, partner: 0.5 },
  n2Weights: { budget: -0.60, partner: -0.70 },
  n2Bias: 0.10,
  n2Z: 0,
  n2Probability: 0.5,
  n2Decision: 'Nap',
};

// Expose state globally for viz
window._neuronState = state;

// === Sound Effects (Web Audio API) ===
let audioCtx = null;

function getAudioCtx() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioCtx;
}

function playTone(freq, duration, type = 'sine', volume = 0.15) {
  if (state.muted) return;
  const ctx = getAudioCtx();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.value = volume;
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + duration);
}

function playCorrect() {
  playTone(523, 0.15, 'sine', 0.1);
  setTimeout(() => playTone(659, 0.15, 'sine', 0.1), 80);
}

function playIncorrect() {
  playTone(220, 0.2, 'triangle', 0.1);
}

function playWin() {
  playTone(523, 0.12, 'sine', 0.1);
  setTimeout(() => playTone(659, 0.12, 'sine', 0.1), 100);
  setTimeout(() => playTone(784, 0.12, 'sine', 0.1), 200);
  setTimeout(() => playTone(1047, 0.25, 'sine', 0.12), 300);
}

function playClick() {
  playTone(800, 0.05, 'square', 0.05);
}

// === Confetti ===
function fireConfetti() {
  const canvas = document.getElementById('confetti-canvas');
  const ctx = canvas.getContext('2d');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  const pieces = [];
  const colors = ['#a5b4fc', '#c4b5fd', '#fbbf24', '#86efac', '#7c3aed', '#e2e8f0'];

  for (let i = 0; i < 150; i++) {
    pieces.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height - canvas.height,
      w: Math.random() * 8 + 4,
      h: Math.random() * 6 + 2,
      color: colors[Math.floor(Math.random() * colors.length)],
      vx: (Math.random() - 0.5) * 4,
      vy: Math.random() * 3 + 2,
      rot: Math.random() * Math.PI * 2,
      rotSpeed: (Math.random() - 0.5) * 0.2,
      alpha: 1,
    });
  }

  let frame = 0;
  function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    frame++;

    for (const p of pieces) {
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.rotSpeed;
      p.vy += 0.05;
      if (frame > 60) p.alpha -= 0.01;

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.globalAlpha = Math.max(0, p.alpha);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    }

    if (frame < 180) {
      requestAnimationFrame(animate);
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }
  animate();
}

// === Slider Fill ===
function updateSliderFills() {
  const inputKeys = ['tiredness', 'urgency', 'workLength', 'timeSinceSlept', 'stress'];
  for (const key of inputKeys) {
    const slider = document.getElementById(`slider-${key}`);
    const pct = ((slider.value - slider.min) / (slider.max - slider.min)) * 100;
    slider.style.setProperty('--fill', pct + '%');
  }
}

// === Contribution Labels ===
function updateContributionLabels() {
  const inputKeys = ['tiredness', 'urgency', 'workLength', 'timeSinceSlept', 'stress'];
  for (const key of inputKeys) {
    const contrib = state.inputs[key] * state.weights[key];
    const el = document.getElementById(`contrib-${key}`);
    if (el) {
      el.textContent = (contrib >= 0 ? '+' : '') + contrib.toFixed(3);
    }
  }
}

// === Gradient Arrows ===
function updateGradientArrows() {
  const p = state.probability;
  const sigmoidDeriv = p * (1 - p); // d(sigma)/dz
  const inputKeys = ['tiredness', 'urgency', 'workLength', 'timeSinceSlept', 'stress'];

  for (const key of inputKeys) {
    const el = document.getElementById(`grad-${key}`);
    if (!el) continue;

    const grad = sigmoidDeriv * state.weights[key]; // d(output)/d(input_i)
    const absGrad = Math.abs(grad);

    // Arrow direction
    const isUp = grad > 0;
    el.className = 'gradient-arrow ' + (isUp ? 'up' : 'down');

    // Size based on magnitude
    if (absGrad > 0.15) {
      el.classList.add('strong');
      el.textContent = isUp ? '\u25B2\u25B2' : '\u25BC\u25BC';
    } else if (absGrad > 0.05) {
      el.textContent = isUp ? '\u25B2' : '\u25BC';
    } else {
      el.classList.add('weak');
      el.textContent = isUp ? '\u25B5' : '\u25BF';
    }

    el.title = `Gradient: ${grad >= 0 ? '+' : ''}${grad.toFixed(4)}`;
  }
}

// === Connection Lines ===
const connectionCanvas = document.getElementById('connection-canvas');
const connectionCtx = connectionCanvas ? connectionCanvas.getContext('2d') : null;
let connectionAnimFrame = null;
let connectionPhase = 0;

function drawConnections() {
  if (!connectionCtx) return;
  const canvas = connectionCanvas;
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  const neuronEl = document.getElementById('neuron-circle');
  const neuronRect = neuronEl.getBoundingClientRect();
  const neuronCX = neuronRect.left + neuronRect.width / 2;
  const neuronCY = neuronRect.top + neuronRect.height / 2;

  const inputKeys = ['tiredness', 'timeSinceSlept', 'stress', 'urgency', 'workLength'];
  connectionPhase += 0.02;

  connectionCtx.clearRect(0, 0, canvas.width, canvas.height);

  for (const key of inputKeys) {
    const slider = document.getElementById(`slider-${key}`);
    if (!slider) continue;
    const sliderRect = slider.getBoundingClientRect();
    const sx = sliderRect.left + sliderRect.width / 2;
    const sy = sliderRect.top + sliderRect.height / 2;

    const w = state.weights[key];
    const contribution = Math.abs(state.inputs[key] * w);
    const isPositive = w >= 0;

    // Line color
    const color = isPositive ? 'rgba(99, 102, 241,' : 'rgba(217, 119, 6,';
    const alpha = 0.1 + contribution * 0.5;

    connectionCtx.beginPath();
    connectionCtx.moveTo(sx, sy);

    // Curved line
    const cpx = (sx + neuronCX) / 2;
    const cpy = (sy + neuronCY) / 2 - 20;
    connectionCtx.quadraticCurveTo(cpx, cpy, neuronCX, neuronCY);

    connectionCtx.strokeStyle = color + alpha.toFixed(2) + ')';
    connectionCtx.lineWidth = 1 + contribution * 3;
    connectionCtx.stroke();

    // Animated dot traveling along the line
    const t = ((connectionPhase + inputKeys.indexOf(key) * 0.15) % 1);
    const dotX = (1 - t) * (1 - t) * sx + 2 * (1 - t) * t * cpx + t * t * neuronCX;
    const dotY = (1 - t) * (1 - t) * sy + 2 * (1 - t) * t * cpy + t * t * neuronCY;

    connectionCtx.beginPath();
    connectionCtx.arc(dotX, dotY, 2.5 + contribution * 2, 0, Math.PI * 2);
    connectionCtx.fillStyle = color + Math.min(alpha + 0.3, 0.8).toFixed(2) + ')';
    connectionCtx.fill();
  }

  connectionAnimFrame = requestAnimationFrame(drawConnections);
}

// === Update Logic ===
function updateNeuron() {
  const result = forwardPass(state.inputs, state.weights, state.bias, state.activationFn);
  state.z = result.z;
  state.probability = result.probability;
  state.decision = result.decision;

  updateOutputCard();
  updateMathPanel(result);
  updateActivationPanel();
  updateHeldInputs();
  updateSliderFills();
  updateContributionLabels();
  updateGradientArrows();
  HEATMAP.draw(state);
  updateHeatmapHeld();
  BOUNDARY.draw(state);
  updateChainPanel();
  ACTIVATION.draw(state);
  SENSITIVITY.draw(state);
  BATTLE.draw(state);
}

function updateHeatmapHeld() {
  const el = document.getElementById('heatmap-held');
  if (el) el.textContent = HEATMAP.getHeldInputsText(state);
}

function updateOutputCard() {
  const prob = state.probability;
  const pct = state.activationFn === 'relu' ? Math.round(Math.min(prob, 1) * 100) : Math.round(prob * 100);
  const isNap = state.decision === 'Nap';

  // Update neuron circle + ring
  const circle = document.getElementById('neuron-circle');
  const ring = document.getElementById('neuron-ring');
  const pctEl = document.getElementById('neuron-pct');
  pctEl.textContent = pct + '%';

  if (isNap) {
    circle.classList.remove('grind');
    ring.classList.remove('grind');
    pctEl.classList.remove('grind');
  } else {
    circle.classList.add('grind');
    ring.classList.add('grind');
    pctEl.classList.add('grind');
  }

  const decision = document.getElementById('neuron-decision');
  decision.textContent = isNap ? 'Nap' : 'Grind';
  decision.style.color = isNap ? '#6366f1' : '#d97706';

  // Flavor text
  const flavor = FLAVOR_TEXT.find(f => pct >= f.min && pct <= f.max);
  document.getElementById('neuron-flavor').textContent = flavor ? flavor.text : '';
}

function updateMathPanel(result) {
  const termsEl = document.getElementById('math-terms');
  termsEl.innerHTML = '';

  for (const term of result.terms) {
    const div = document.createElement('div');
    div.className = 'math-term ' + (term.wi >= 0 ? 'positive' : 'negative');
    div.innerHTML = `<span>${term.key}:</span><span>${term.xi.toFixed(2)} x ${term.wi >= 0 ? '+' : ''}${term.wi.toFixed(2)} = ${term.product >= 0 ? '+' : ''}${term.product.toFixed(3)}</span>`;
    termsEl.appendChild(div);
  }

  const biasDiv = document.createElement('div');
  biasDiv.className = 'math-term math-term-bias';
  biasDiv.innerHTML = `<span>bias:</span><span>${state.bias >= 0 ? '+' : ''}${state.bias.toFixed(2)}</span>`;
  termsEl.appendChild(biasDiv);

  document.getElementById('math-z').textContent = state.z.toFixed(3);
  document.getElementById('math-sigma').textContent = state.probability.toFixed(3);

  // Update formula display based on activation function
  const formulaLines = document.querySelectorAll('.formula-line');
  if (formulaLines.length >= 2) {
    if (state.activationFn === 'step') {
      formulaLines[1].innerHTML = 'output = f(z) = z &ge; 0 ? 1 : 0';
    } else if (state.activationFn === 'relu') {
      formulaLines[1].innerHTML = 'output = f(z) = max(0, z)';
    } else {
      formulaLines[1].innerHTML = 'output = &sigma;(z) = 1/(1 + e<sup>-z</sup>)';
    }
  }
}

function updateHeldInputs() {
  const held = document.getElementById('held-inputs');
  held.textContent = `Held: tired=${state.inputs.tiredness.toFixed(2)} urge=${state.inputs.urgency.toFixed(2)} work=${state.inputs.workLength.toFixed(2)}`;
}

// === Activation Panel ===
function updateActivationPanel() {
  const fnInfo = ACTIVATION.FUNCTIONS[state.activationFn];
  if (!fnInfo) return;

  const formulaEl = document.getElementById('activation-formula');
  if (formulaEl) formulaEl.innerHTML = fnInfo.formula;

  const eraEl = document.getElementById('activation-era');
  if (eraEl) eraEl.textContent = fnInfo.era;

  const zEl = document.getElementById('activation-z');
  if (zEl) zEl.textContent = state.z.toFixed(3);

  const outEl = document.getElementById('activation-output');
  if (outEl) outEl.textContent = state.probability.toFixed(3);
}

// === Two-Neuron Chain ===
function updateChainPanel() {
  const a1 = state.probability;

  // Compute Neuron 2
  const z2 = state.chainWeight * a1
    + state.n2Weights.budget * state.n2Inputs.budget
    + state.n2Weights.partner * state.n2Inputs.partner
    + state.n2Bias;
  const a2 = applyActivation(z2, state.activationFn);
  const isNap2 = a2 >= 0.5;

  state.n2Z = z2;
  state.n2Probability = a2;
  state.n2Decision = isNap2 ? 'Nap' : 'Grind';

  // Update N1 summary inputs
  const n1InputsEl = document.getElementById('chain-n1-inputs');
  if (n1InputsEl) {
    const inputKeys = ['tiredness', 'urgency', 'workLength', 'timeSinceSlept', 'stress'];
    const labels = { tiredness: 'Tired', urgency: 'Urgency', workLength: 'Work', timeSinceSlept: 'Sleep', stress: 'Stress' };
    n1InputsEl.innerHTML = '';
    for (const key of inputKeys) {
      const w = state.weights[key];
      const contrib = (state.inputs[key] * w);
      const div = document.createElement('div');
      div.className = 'chain-n1-input-line ' + (w >= 0 ? 'positive' : 'negative');
      div.innerHTML = `<span class="chain-input-name">${labels[key]}</span><span class="chain-input-val">${(contrib >= 0 ? '+' : '')}${contrib.toFixed(2)}</span>`;
      n1InputsEl.appendChild(div);
    }
  }

  // Update N1 circle
  const n1Circle = document.getElementById('chain-n1-circle');
  const n1Pct = document.getElementById('chain-n1-pct');
  const n1A = document.getElementById('chain-n1-a');
  if (n1Circle) {
    const isNap1 = state.decision === 'Nap';
    n1Circle.className = 'chain-mini-neuron ' + (isNap1 ? 'nap' : 'grind');
    n1Pct.textContent = Math.round(a1 * 100) + '%';
    n1A.textContent = a1.toFixed(3);
  }

  // Update N2 circle
  const n2Circle = document.getElementById('chain-n2-circle');
  const n2Pct = document.getElementById('chain-n2-pct');
  if (n2Circle) {
    n2Circle.className = 'chain-mini-neuron ' + (isNap2 ? 'nap' : 'grind');
    n2Pct.textContent = Math.round(a2 * 100) + '%';
  }

  // Update N2 decision
  const decisionEl = document.getElementById('chain-n2-decision');
  if (decisionEl) {
    decisionEl.textContent = isNap2 ? 'Nap' : 'Grind';
    decisionEl.style.color = isNap2 ? '#6366f1' : '#d97706';
  }

  // Update N2 flavor
  const flavorEl = document.getElementById('chain-n2-flavor');
  if (flavorEl) {
    const pct2 = Math.round(a2 * 100);
    const flavor = FLAVOR_TEXT.find(f => pct2 >= f.min && pct2 <= f.max);
    flavorEl.textContent = flavor ? flavor.text : 'Final output';
  }

  // Update chain math
  const z1El = document.getElementById('chain-math-z1');
  const a1El = document.getElementById('chain-math-a1');
  const z2El = document.getElementById('chain-math-z2');
  const a2El = document.getElementById('chain-math-a2');
  if (z1El) z1El.textContent = state.z.toFixed(3);
  if (a1El) a1El.textContent = a1.toFixed(3);
  if (z2El) z2El.textContent = z2.toFixed(3);
  if (a2El) a2El.textContent = a2.toFixed(3);
}

function updateBattleWeights() {
  const el = document.getElementById('battle-weights');
  if (!el) return;

  const keys = ['tiredness', 'urgency', 'workLength', 'timeSinceSlept', 'stress'];
  const labels = { tiredness: 'Tired', urgency: 'Deadline', workLength: 'Work', timeSinceSlept: 'Sleep', stress: 'Stress' };

  el.innerHTML = '';
  for (let slot = 0; slot < 2; slot++) {
    const p = BATTLE.PERSONALITIES[BATTLE.activePersonalities[slot]];
    const col = document.createElement('div');
    col.className = 'battle-weight-col';
    col.innerHTML = `<div class="battle-weight-col-title" style="color:${p.color}">${p.emoji} ${p.name}</div>`;
    for (const key of keys) {
      const w = p.weights[key];
      const row = document.createElement('div');
      row.className = 'battle-weight-row';
      row.innerHTML = `<span>${labels[key]}</span><span style="color:${w >= 0 ? '#6366f1' : '#d97706'}">${w >= 0 ? '+' : ''}${w.toFixed(2)}</span>`;
      col.appendChild(row);
    }
    const biasRow = document.createElement('div');
    biasRow.className = 'battle-weight-row';
    biasRow.style.marginTop = '4px';
    biasRow.style.borderTop = '1px solid var(--card-border)';
    biasRow.style.paddingTop = '4px';
    biasRow.innerHTML = `<span>bias</span><span style="color:#7c3aed">${p.bias >= 0 ? '+' : ''}${p.bias.toFixed(2)}</span>`;
    col.appendChild(biasRow);
    el.appendChild(col);
  }
}

function updateWeightBadges() {
  const keys = ['tiredness', 'urgency', 'workLength', 'timeSinceSlept', 'stress'];
  for (const key of keys) {
    const group = document.querySelector(`[data-input="${key}"]`);
    if (!group) continue;
    const badge = group.querySelector('.weight-badge');
    const w = state.weights[key];
    badge.textContent = `w: ${w >= 0 ? '+' : ''}${w.toFixed(2)}`;
    badge.className = 'weight-badge ' + (w >= 0 ? 'positive' : 'negative');
  }
}

function updateTrainingStats() {
  document.getElementById('stat-steps').textContent = state.stepCount;
  document.getElementById('stat-accuracy').textContent = state.accuracy !== null ? state.accuracy + '%' : '--';
  document.getElementById('stat-points').textContent = state.trainingPoints.length;
}

function flashWeightBadges() {
  document.querySelectorAll('.weight-badge').forEach(badge => {
    badge.classList.remove('flash');
    void badge.offsetWidth;
    badge.classList.add('flash');
  });
}

function flashOutputCard(correct) {
  const circle = document.getElementById('neuron-circle');
  const cls = correct ? 'flash-correct' : 'flash-incorrect';
  circle.classList.remove('flash-correct', 'flash-incorrect');
  void circle.offsetWidth;
  circle.classList.add(cls);
  setTimeout(() => circle.classList.remove(cls), 500);
}

function checkMilestones() {
  if (state.accuracy === null) return;
  for (const m of MILESTONES) {
    if (state.accuracy >= m.threshold && !m.shown) {
      m.shown = true;
      const banner = document.getElementById('milestone-banner');
      banner.textContent = m.text;
      banner.classList.remove('hidden');
      setTimeout(() => banner.classList.add('hidden'), 3000);

      if (m.threshold === 100) {
        playWin();
        fireConfetti();
      }
    }
  }
}

// === Training ===
function doStep() {
  if (state.trainingPoints.length === 0) return;

  // Find a misclassified point, or pick random
  let targetPoint = null;
  for (const pt of state.trainingPoints) {
    const fullInput = {
      tiredness: state.inputs.tiredness,
      urgency: state.inputs.urgency,
      workLength: state.inputs.workLength,
      timeSinceSlept: pt.x,
      stress: pt.y,
    };
    const result = forwardPass(fullInput, state.weights, state.bias);
    const predicted = result.probability >= 0.5 ? 1 : 0;
    if (predicted !== pt.label) {
      targetPoint = pt;
      break;
    }
  }

  if (!targetPoint) {
    // All correct
    targetPoint = state.trainingPoints[Math.floor(Math.random() * state.trainingPoints.length)];
  }

  const updateResult = perceptronUpdate(state.weights, state.bias, targetPoint, state.inputs);
  state.weights = updateResult.weights;
  state.bias = updateResult.bias;
  state.stepCount++;

  // Flash the triggered point
  targetPoint.flash = 1.0;

  // Visual feedback
  flashOutputCard(updateResult.correct);
  if (updateResult.correct) {
    playCorrect();
  } else {
    playIncorrect();
  }

  flashWeightBadges();
  updateWeightBadges();

  // Update bias slider
  const biasSlider = document.getElementById('slider-bias');
  biasSlider.value = Math.round(state.bias * 100);
  document.getElementById('value-bias').textContent = (state.bias >= 0 ? '+' : '') + state.bias.toFixed(2);

  state.accuracy = computeAccuracy(state.trainingPoints, state.weights, state.bias, state.inputs);
  updateTrainingStats();
  checkMilestones();
  updateNeuron();
}

function doTrain() {
  if (state.isTraining || state.trainingPoints.length === 0) return;
  state.isTraining = true;

  let steps = 0;
  const maxSteps = 100;

  const interval = setInterval(() => {
    doStep();
    steps++;

    if (state.accuracy === 100 || steps >= maxSteps) {
      clearInterval(interval);
      state.isTraining = false;
    }
  }, 125);
}

function doReset() {
  state.weights = { ...INITIAL_WEIGHTS };
  state.bias = INITIAL_BIAS;
  state.trainingPoints = [];
  state.stepCount = 0;
  state.accuracy = null;
  state.isTraining = false;

  // Reset milestones
  for (const m of MILESTONES) m.shown = false;
  document.getElementById('milestone-banner').classList.add('hidden');

  // Reset bias slider
  document.getElementById('slider-bias').value = 25;
  document.getElementById('value-bias').textContent = '+0.25';

  updateWeightBadges();
  updateTrainingStats();
  updateNeuron();
}

// === Init ===
function init() {
  // Init canvases
  VIZ.init();
  HEATMAP.init();
  BOUNDARY.init();
  CHAIN.init();
  ACTIVATION.init();
  SENSITIVITY.init();
  BATTLE.init();

  // Heatmap axis selector
  document.getElementById('heatmap-axis-select').addEventListener('change', (e) => {
    const [xKey, yKey] = e.target.value.split(',');
    HEATMAP.setAxes(xKey, yKey);
    document.getElementById('heatmap-x-label').textContent = INPUT_LABELS[xKey];
    updateHeatmapHeld();
    HEATMAP.draw(state);
  });

  // Slider event listeners
  const inputKeys = ['tiredness', 'urgency', 'workLength', 'timeSinceSlept', 'stress'];
  for (const key of inputKeys) {
    const slider = document.getElementById(`slider-${key}`);
    slider.addEventListener('input', () => {
      state.inputs[key] = slider.value / 100;
      document.getElementById(`value-${key}`).textContent = state.inputs[key].toFixed(2);

      // Recompute accuracy with new held inputs
      if (state.trainingPoints.length > 0) {
        state.accuracy = computeAccuracy(state.trainingPoints, state.weights, state.bias, state.inputs);
        updateTrainingStats();
      }

      updateNeuron();
    });
  }

  // Bias slider
  document.getElementById('slider-bias').addEventListener('input', (e) => {
    state.bias = e.target.value / 100;
    document.getElementById('value-bias').textContent = (state.bias >= 0 ? '+' : '') + state.bias.toFixed(2);

    if (state.trainingPoints.length > 0) {
      state.accuracy = computeAccuracy(state.trainingPoints, state.weights, state.bias, state.inputs);
      updateTrainingStats();
    }

    updateNeuron();
  });

  // Chain sliders
  const chainSliderBudget = document.getElementById('slider-budget');
  if (chainSliderBudget) {
    chainSliderBudget.addEventListener('input', () => {
      state.n2Inputs.budget = chainSliderBudget.value / 100;
      document.getElementById('value-budget').textContent = state.n2Inputs.budget.toFixed(2);
      const pct = chainSliderBudget.value;
      chainSliderBudget.style.setProperty('--fill', pct + '%');
      updateChainPanel();
    });
  }

  const chainSliderPartner = document.getElementById('slider-partner');
  if (chainSliderPartner) {
    chainSliderPartner.addEventListener('input', () => {
      state.n2Inputs.partner = chainSliderPartner.value / 100;
      document.getElementById('value-partner').textContent = state.n2Inputs.partner.toFixed(2);
      const pct = chainSliderPartner.value;
      chainSliderPartner.style.setProperty('--fill', pct + '%');
      updateChainPanel();
    });
  }

  const chainWeightSlider = document.getElementById('slider-chainWeight');
  if (chainWeightSlider) {
    chainWeightSlider.addEventListener('input', () => {
      state.chainWeight = chainWeightSlider.value / 100;
      document.getElementById('value-chainWeight').textContent = (state.chainWeight >= 0 ? '+' : '') + state.chainWeight.toFixed(2);
      updateChainPanel();
    });
  }

  const n2BiasSlider = document.getElementById('slider-n2Bias');
  if (n2BiasSlider) {
    n2BiasSlider.addEventListener('input', () => {
      state.n2Bias = n2BiasSlider.value / 100;
      document.getElementById('value-n2Bias').textContent = (state.n2Bias >= 0 ? '+' : '') + state.n2Bias.toFixed(2);
      updateChainPanel();
    });
  }

  // Dark mode toggle
  document.getElementById('dark-mode-btn').addEventListener('click', () => {
    document.body.classList.toggle('dark');
    const isDark = document.body.classList.contains('dark');
    document.getElementById('dark-mode-btn').innerHTML = isDark ? '&#x2600;' : '&#x1f319;';
    // Redraw canvases that use hardcoded colors
    updateNeuron();
  });

  // Mute button
  document.getElementById('mute-btn').addEventListener('click', () => {
    state.muted = !state.muted;
    document.getElementById('mute-btn').innerHTML = state.muted ? '&#x1f507;' : '&#x1f50a;';
  });

  // Activation function selector
  document.querySelectorAll('.activation-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.activation-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.activationFn = btn.dataset.fn;
      updateNeuron();
    });
  });

  // Activation compare mode
  const compareCheckbox = document.getElementById('activation-compare');
  if (compareCheckbox) {
    compareCheckbox.addEventListener('change', () => {
      ACTIVATION.setCompareMode(compareCheckbox.checked);
      ACTIVATION.draw(state);
    });
  }

  // Sensitivity bar toggle
  const sensitivityBarCheck = document.getElementById('sensitivity-bar-check');
  if (sensitivityBarCheck) {
    sensitivityBarCheck.addEventListener('change', () => {
      SENSITIVITY.setShowBars(sensitivityBarCheck.checked);
      SENSITIVITY.resize();
      SENSITIVITY.draw(state);
    });
  }

  // Tab navigation
  document.querySelectorAll('.tab-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      switchTab(pill.dataset.tab);
    });
  });

  // Battle personality selectors
  const battleSelectLeft = document.getElementById('battle-select-left');
  const battleSelectRight = document.getElementById('battle-select-right');
  if (battleSelectLeft && battleSelectRight) {
    BATTLE.PERSONALITIES.forEach((p, i) => {
      const optL = document.createElement('option');
      optL.value = i;
      optL.textContent = p.emoji + ' ' + p.name;
      battleSelectLeft.appendChild(optL);

      const optR = document.createElement('option');
      optR.value = i;
      optR.textContent = p.emoji + ' ' + p.name;
      battleSelectRight.appendChild(optR);
    });
    battleSelectRight.value = 1;

    battleSelectLeft.addEventListener('change', () => {
      BATTLE.setPersonality(0, parseInt(battleSelectLeft.value));
      BATTLE.draw(state);
      updateBattleWeights();
    });
    battleSelectRight.addEventListener('change', () => {
      BATTLE.setPersonality(1, parseInt(battleSelectRight.value));
      BATTLE.draw(state);
      updateBattleWeights();
    });
  }

  // Mission modal
  document.getElementById('mission-btn').addEventListener('click', () => {
    document.getElementById('mission-modal').classList.remove('hidden');
  });

  // Label toggle
  document.getElementById('label-nap').addEventListener('click', () => {
    state.activeLabel = 1;
    document.getElementById('label-nap').classList.add('active');
    document.getElementById('label-grind').classList.remove('active');
  });

  document.getElementById('label-grind').addEventListener('click', () => {
    state.activeLabel = 0;
    document.getElementById('label-grind').classList.add('active');
    document.getElementById('label-nap').classList.remove('active');
  });

  // Training buttons
  document.getElementById('btn-step').addEventListener('click', doStep);
  document.getElementById('btn-train').addEventListener('click', doTrain);
  document.getElementById('btn-reset').addEventListener('click', doReset);

  // Boundary canvas click - place training point
  document.getElementById('boundary-canvas').addEventListener('click', (e) => {
    const coords = BOUNDARY.getPlotCoords(e);
    if (coords) {
      playClick();
      state.trainingPoints.push({
        x: coords.x,
        y: coords.y,
        label: state.activeLabel,
        flash: null,
      });
      state.accuracy = computeAccuracy(state.trainingPoints, state.weights, state.bias, state.inputs);
      updateTrainingStats();
      BOUNDARY.draw(state);
    }
  });

  // Scenarios modal
  const scenariosModal = document.getElementById('scenarios-modal');
  const scenariosGrid = document.getElementById('scenarios-grid');

  // Build scenario cards
  for (const scenario of SCENARIOS) {
    const result = forwardPass(scenario.inputs, state.weights, state.bias);
    const isNap = result.decision === 'Nap';
    const pct = Math.round(result.probability * 100);

    const card = document.createElement('div');
    card.className = 'scenario-card';
    card.innerHTML = `
      <div class="scenario-card-title">${scenario.title}</div>
      <div class="scenario-card-desc">${scenario.desc}</div>
      <span class="scenario-card-verdict ${isNap ? 'nap' : 'grind'}">${isNap ? 'Nap' : 'Grind'} ${pct}%</span>
    `;

    card.addEventListener('click', () => {
      for (const key of inputKeys) {
        state.inputs[key] = scenario.inputs[key];
        document.getElementById(`slider-${key}`).value = Math.round(scenario.inputs[key] * 100);
        document.getElementById(`value-${key}`).textContent = scenario.inputs[key].toFixed(2);
      }

      if (state.trainingPoints.length > 0) {
        state.accuracy = computeAccuracy(state.trainingPoints, state.weights, state.bias, state.inputs);
        updateTrainingStats();
      }

      updateNeuron();
      scenariosModal.classList.add('hidden');
    });

    scenariosGrid.appendChild(card);
  }

  document.getElementById('scenarios-btn').addEventListener('click', () => {
    scenariosModal.classList.remove('hidden');
  });

  document.getElementById('scenarios-close').addEventListener('click', () => {
    scenariosModal.classList.add('hidden');
  });

  scenariosModal.addEventListener('click', (e) => {
    if (e.target === scenariosModal) {
      scenariosModal.classList.add('hidden');
    }
  });

  // Handle window resize
  window.addEventListener('resize', () => {
    VIZ.resize();
    HEATMAP.resize();
    BOUNDARY.resize();
    CHAIN.resize();
    ACTIVATION.resize();
    SENSITIVITY.resize();
    BATTLE.resize();
    updateNeuron();
  });

  // Initial render
  updateWeightBadges();
  updateTrainingStats();
  updateSliderFills();
  updateContributionLabels();
  updateGradientArrows();
  updateNeuron();

  // Initialize first tab canvas
  setTimeout(() => {
    VIZ.resize();
    VIZ.draw(state);
  }, 100);

  // Start connection line animation
  drawConnections();
}

document.addEventListener('DOMContentLoaded', init);
