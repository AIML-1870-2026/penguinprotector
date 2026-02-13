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

const PRESETS = {
  exam: { tiredness: 0.9, urgency: 1.0, workLength: 0.8, timeSinceSlept: 0.9, stress: 0.95 },
  sunday: { tiredness: 0.5, urgency: 0.15, workLength: 0.3, timeSinceSlept: 0.4, stress: 0.2 },
  postlunch: { tiredness: 0.8, urgency: 0.2, workLength: 0.4, timeSinceSlept: 0.35, stress: 0.3 },
  coffee: { tiredness: 0.2, urgency: 0.4, workLength: 0.5, timeSinceSlept: 0.3, stress: 0.45 },
};

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

// === Update Logic ===
function updateNeuron() {
  const result = forwardPass(state.inputs, state.weights, state.bias);
  state.z = result.z;
  state.probability = result.probability;
  state.decision = result.decision;

  updateOutputCard();
  updateMathPanel(result);
  updateHeldInputs();
  BOUNDARY.draw(state);
}

function updateOutputCard() {
  const prob = state.probability;
  const pct = Math.round(prob * 100);
  const isNap = state.decision === 'Nap';

  document.getElementById('output-probability').textContent = pct + '%';
  document.getElementById('output-probability').style.color = isNap ? '#a5b4fc' : '#fbbf24';
  document.getElementById('output-decision').textContent = isNap ? 'Nap' : 'Grind';
  document.getElementById('output-decision').style.color = isNap ? '#a5b4fc' : '#fbbf24';

  const card = document.getElementById('output-card');
  card.className = 'output-card ' + (isNap ? 'nap' : 'grind');

  // Flavor text
  const flavor = FLAVOR_TEXT.find(f => pct >= f.min && pct <= f.max);
  document.getElementById('output-flavor').textContent = flavor ? flavor.text : '';
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
}

function updateHeldInputs() {
  const held = document.getElementById('held-inputs');
  held.textContent = `Held: tired=${state.inputs.tiredness.toFixed(2)} urge=${state.inputs.urgency.toFixed(2)} work=${state.inputs.workLength.toFixed(2)}`;
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
  const card = document.getElementById('output-card');
  const cls = correct ? 'flash-correct' : 'flash-incorrect';
  card.classList.remove('flash-correct', 'flash-incorrect');
  void card.offsetWidth;
  card.classList.add(cls);
  setTimeout(() => card.classList.remove(cls), 500);
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
  BOUNDARY.init();

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

  // Mute button
  document.getElementById('mute-btn').addEventListener('click', () => {
    state.muted = !state.muted;
    document.getElementById('mute-btn').innerHTML = state.muted ? '&#x1f507;' : '&#x1f50a;';
  });

  // Mission modal
  document.getElementById('mission-btn').addEventListener('click', () => {
    document.getElementById('mission-modal').classList.remove('hidden');
  });

  document.getElementById('help-btn').addEventListener('click', () => {
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

  // Presets
  document.querySelectorAll('.preset-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const preset = PRESETS[btn.dataset.preset];
      if (!preset) return;

      for (const key of inputKeys) {
        state.inputs[key] = preset[key];
        document.getElementById(`slider-${key}`).value = Math.round(preset[key] * 100);
        document.getElementById(`value-${key}`).textContent = preset[key].toFixed(2);
      }

      if (state.trainingPoints.length > 0) {
        state.accuracy = computeAccuracy(state.trainingPoints, state.weights, state.bias, state.inputs);
        updateTrainingStats();
      }

      updateNeuron();
    });
  });

  // Handle window resize
  window.addEventListener('resize', () => {
    VIZ.resize();
    BOUNDARY.resize();
    updateNeuron();
  });

  // Initial render
  updateWeightBadges();
  updateTrainingStats();
  updateNeuron();
}

document.addEventListener('DOMContentLoaded', init);
