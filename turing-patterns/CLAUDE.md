# Turing Patterns Explorer

## Project Overview
A web-based reaction-diffusion simulation using the Gray-Scott model for artistic and generative design exploration.

## File Structure
```
turing-patterns/
├── index.html    # HTML structure and layout
├── styles.css    # All styling and responsive design
├── script.js     # WebGL simulation, Three.js 3D, UI logic
├── CLAUDE.md     # Project documentation
└── spec.md       # Original specification
```

## Technical Details
- **Simulation**: WebGL-based Gray-Scott reaction-diffusion with ping-pong framebuffers
- **Rendering**: WebGL 2D canvas with real-time color mapping
- **3D Mode**: Three.js height map visualization with orbit controls
- **Performance Target**: 60fps at 256x256 resolution

## Features Implemented
- Gray-Scott simulation engine (WebGL shaders)
- Real-time parameter controls (f, k, Du, Dv)
- 10 preset patterns (Mitosis, Coral, Spots, Stripes, etc.)
- 6 color schemes (Grayscale, Plasma, Ocean, Fire, Rainbow, Neon)
- Multiple seed patterns (Center, Multiple, Grid, Noise)
- Interactive brush tools with adjustable size and intensity
  - Chemical V brush (adds reaction catalyst)
  - Chemical U brush (adds substrate)
  - Both chemicals brush (creates reaction zones)
  - Eraser (resets to initial state)
- 3D height map visualization with camera controls
- PNG export with resolution multiplier
- Keyboard shortcuts (Space, R, S, B, [, ], 1-9)

## Gray-Scott Equations
```
du/dt = Du * laplacian(u) - u*v^2 + f*(1-u)
dv/dt = Dv * laplacian(v) + u*v^2 - (f+k)*v
```

## Live URL
https://aiml-1870-2026.github.io/penguinprotector/turing-patterns/

## Reference
See [spec.md](spec.md) for full technical specification.
