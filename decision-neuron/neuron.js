// === Neuron Math ===

function sigmoid(z) {
  return 1 / (1 + Math.exp(-z));
}

function forwardPass(inputs, weights, bias) {
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

  const probability = sigmoid(z);
  const decision = probability >= 0.5 ? 'Nap' : 'Grind';

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
