# Decision Neuron - Nap or Grind?

## Overview
Interactive single-neuron classifier that decides "Should I nap or grind?"
Based on 5 inputs (tiredness, urgency, work length, hours since sleep, stress),
a sigmoid activation, and a trainable perceptron with decision boundary visualization.

## File Structure
- `index.html` - Main page layout (3-column: inputs | viz + boundary | math)
- `style.css` - Dark theme styling with lavender/amber color scheme
- `neuron.js` - Sigmoid, forward pass, perceptron update logic
- `viz.js` - Neural network diagram (canvas) + animations
- `boundary.js` - Decision boundary plot (canvas) + training point placement
- `main.js` - State management, UI wiring, sound effects, training loop

## Key Colors
- Nap/positive: `#a5b4fc` (lavender)
- Grind/negative: `#fbbf24` (amber)
- Background: `#0f0e17`
- Panels: `#16152a`
