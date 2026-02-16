// === Neuron Math ===

function sigmoid(z) {
  return 1 / (1 + Math.exp(-z));
}

function stepFunction(z) {
  return z >= 0 ? 1 : 0;
}

function relu(z) {
  return Math.max(0, z);
}

// === Theme Color Helper ===
function getThemeColors() {
  const s = getComputedStyle(document.body);
  return {
    bg: s.getPropertyValue('--bg').trim(),
    card: s.getPropertyValue('--card').trim(),
    cardBorder: s.getPropertyValue('--card-border').trim(),
    textPrimary: s.getPropertyValue('--text-primary').trim(),
    textMuted: s.getPropertyValue('--text-muted').trim(),
    textLight: s.getPropertyValue('--text-light').trim(),
  };
}

function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function applyActivation(z, fnName) {
  if (fnName === 'step') return stepFunction(z);
  if (fnName === 'relu') return relu(z);
  return sigmoid(z);
}

function forwardPass(inputs, weights, bias, activationFn) {
  const keys = ['tiredness', 'urgency', 'workLength', 'timeSinceSlept', 'stress'];
  let z = bias;
  const terms = [];

  for (const key of keys) {
    const xi = inputs[key];
    const wi = weights[key];
    const product = xi * wi;
    z += product;
    terms.push({ key, xi, wi, product });
  }

  const fnName = activationFn || 'sigmoid';
  const probability = applyActivation(z, fnName);
  const decision = fnName === 'relu'
    ? (probability >= 0.5 ? 'Nap' : 'Grind')
    : (probability >= 0.5 ? 'Nap' : 'Grind');

  return { z, probability, decision, terms };
}

function perceptronUpdate(weights, bias, point, inputs, learningRate = 0.1) {
  // point: { x: timeSinceSlept, y: stress, label: 0|1 }
  // We build a full input vector using current slider values for the 3 held inputs
  const fullInput = {
    tiredness: inputs.tiredness,
    urgency: inputs.urgency,
    workLength: inputs.workLength,
    timeSinceSlept: point.x,
    stress: point.y,
  };

  const keys = ['tiredness', 'urgency', 'workLength', 'timeSinceSlept', 'stress'];
  let z = bias;
  for (const key of keys) {
    z += fullInput[key] * weights[key];
  }

  const prediction = sigmoid(z);
  const error = point.label - prediction;

  const newWeights = { ...weights };
  for (const key of keys) {
    newWeights[key] += learningRate * error * fullInput[key];
  }
  const newBias = bias + learningRate * error;

  const correct = (prediction >= 0.5 && point.label === 1) || (prediction < 0.5 && point.label === 0);

  return { weights: newWeights, bias: newBias, correct, prediction, error };
}

function computeAccuracy(trainingPoints, weights, bias, inputs) {
  if (trainingPoints.length === 0) return null;

  let correctCount = 0;
  for (const point of trainingPoints) {
    const fullInput = {
      tiredness: inputs.tiredness,
      urgency: inputs.urgency,
      workLength: inputs.workLength,
      timeSinceSlept: point.x,
      stress: point.y,
    };

    const keys = ['tiredness', 'urgency', 'workLength', 'timeSinceSlept', 'stress'];
    let z = bias;
    for (const key of keys) {
      z += fullInput[key] * weights[key];
    }

    const prediction = sigmoid(z);
    const predicted = prediction >= 0.5 ? 1 : 0;
    if (predicted === point.label) correctCount++;
  }

  return Math.round((correctCount / trainingPoints.length) * 100);
}
