# Turing Patterns Explorer - Technical Specification

## Project Overview
A web-based reaction-diffusion simulation tool focused on artistic/generative design with real-time parameter control, preset patterns, custom equation support, and multiple visualization modes including 3D.

## Target Use Case
- **Primary**: Artistic and generative design exploration
- **User Profile**: Artists, designers, creative coders who want to generate unique patterns
- **Key Value**: Beautiful, controllable pattern generation with export capabilities

---

## Core Features

### 1. Simulation Engine
- **Default Model**: Gray-Scott reaction-diffusion system
- **Alternative Models**: Support for custom equation input
- **Grid Resolution**: 256x256 default (configurable: 128x128, 512x512, 1024x1024)
- **Computation**: WebGL-based for performance (fallback to Canvas 2D if needed)
- **Frame Rate**: Target 60fps for smooth real-time visualization

#### Gray-Scott Equations
```
∂u/∂t = Du∇²u - uv² + f(1-u)
∂v/∂t = Dv∇²v + uv² - (f+k)v
```

Where:
- `u` = concentration of chemical U
- `v` = concentration of chemical V
- `Du`, `Dv` = diffusion rates
- `f` = feed rate
- `k` = kill rate
- `∇²` = Laplacian operator

### 2. Real-Time Parameter Controls

#### Primary Parameters (Gray-Scott)
- **Feed Rate (f)**: 0.000 - 0.100, default 0.055, step 0.001
- **Kill Rate (k)**: 0.000 - 0.100, default 0.062, step 0.001
- **Diffusion Rate U (Du)**: 0.01 - 0.5, default 0.16, step 0.01
- **Diffusion Rate V (Dv)**: 0.01 - 0.5, default 0.08, step 0.01
- **Time Step (dt)**: 0.5 - 2.0, default 1.0, step 0.1

#### Simulation Controls
- **Play/Pause**: Toggle simulation
- **Speed**: 0.25x, 0.5x, 1x, 2x, 4x
- **Reset**: Clear to default initial conditions
- **Randomize**: Generate random initial seed pattern
- **Steps per Frame**: 1-10 (for faster evolution)

### 3. Preset Patterns

Provide at least 8-10 named presets with pre-configured f/k values that produce distinct patterns:

| Preset Name | f | k | Description |
|-------------|---|---|-------------|
| Mitosis | 0.0367 | 0.0649 | Cell-like division patterns |
| Coral | 0.0545 | 0.062 | Branching coral structures |
| Spots | 0.014 | 0.054 | Simple spotted patterns |
| Stripes | 0.022 | 0.051 | Striped/zebra patterns |
| Waves | 0.014 | 0.045 | Wave-like propagation |
| Worms | 0.078 | 0.061 | Worm-like structures |
| Fingerprint | 0.055 | 0.062 | Fingerprint-like swirls |
| Spirals | 0.018 | 0.051 | Spiral formations |
| Maze | 0.029 | 0.057 | Maze-like patterns |
| Bubbles | 0.098 | 0.057 | Bubble formations |

Each preset should:
- Load parameters instantly
- Optionally include a custom initial condition
- Have a thumbnail preview (can be generated on first load)

### 4. Initial Conditions

#### Seed Pattern Types
- **Random Noise**: Uniform random distribution
- **Central Blob**: Single circle in center (adjustable radius)
- **Multiple Seeds**: 3-20 random circles
- **Grid Pattern**: Regular grid of small circles
- **Custom Draw**: Click/drag to paint initial V concentration
- **Upload Image**: Use image brightness as initial V values

#### Drawing Tools (for Custom Draw mode)
- Brush size: 5-50 pixels
- Brush intensity: 0-100%
- Eraser mode
- Clear canvas

### 5. Custom Equations (Advanced)

Allow users to input custom equations as JavaScript expressions:

```javascript
// Example interface
dudt = "Du * laplacian_u - u*v*v + f*(1-u)"
dvdt = "Dv * laplacian_v + u*v*v - (f+k)*v"
```

**Available variables in expressions:**
- `u`, `v` - current concentrations
- `laplacian_u`, `laplacian_v` - computed Laplacians
- `Du`, `Dv`, `f`, `k` - parameters
- `dt` - time step
- `x`, `y` - normalized coordinates (0-1)
- `t` - total time elapsed

**Safety**: Parse and validate before execution, show error messages for invalid syntax

### 6. Visualization Modes

#### 2D Visualization
- **Canvas Rendering**: Main default view
- **Color Mapping**: Map U and V concentrations to colors
- **Smooth Interpolation**: Bilinear filtering for smooth appearance

#### Color Schemes
Provide at least 6 color palettes:

1. **Grayscale**: Black to white based on V concentration
2. **Plasma**: Purple → Pink → Orange → Yellow
3. **Ocean**: Deep blue → Cyan → White
4. **Fire**: Black → Red → Orange → Yellow → White
5. **Rainbow**: Full spectrum based on V value
6. **Custom Gradient**: User-defined 2-5 color stops

**Color Control Options:**
- Concentration range mapping (min/max values to visualize)
- Invert colors toggle
- Opacity/brightness adjustment

#### 3D Visualization
- **Height Map**: V concentration determines height
- **Lighting**: Directional light with ambient
- **Camera Controls**: 
  - Orbit (mouse drag)
  - Zoom (mouse wheel)
  - Reset view button
- **Rendering**: Three.js for 3D view
- **Performance**: Lower resolution option for 3D (128x128)
- **Extrusion Scale**: Control height multiplier (0.1x - 5x)

**3D View Toggle**: Button to switch between 2D and 3D modes

### 7. Export Features

#### Image Export
- **Format**: PNG (transparent background option)
- **Resolution**: Current, 2x, 4x supersampling
- **Capture**: Current frame snapshot

#### Animation Export (Future Enhancement)
- Record sequence as GIF
- Frame rate control
- Duration limit (10-30 seconds)

---

## User Interface Design

### Layout Structure

```
┌─────────────────────────────────────────────────────┐
│  Header: Title + Mode Selector (2D/3D)              │
├──────────────┬──────────────────────────────────────┤
│              │                                       │
│   Control    │                                       │
│   Panel      │         Canvas Area                  │
│   (300px)    │         (Responsive)                 │
│              │                                       │
│   - Presets  │                                       │
│   - Params   │                                       │
│   - Colors   │                                       │
│   - Initial  │                                       │
│   - Export   │                                       │
│              │                                       │
├──────────────┴──────────────────────────────────────┤
│  Footer: FPS Counter + Stats                        │
└─────────────────────────────────────────────────────┘
```

### Control Panel Sections (Collapsible Accordions)

#### 1. Simulation Controls
- Play/Pause button (large, prominent)
- Speed slider
- Reset button
- Randomize button
- Steps per frame input

#### 2. Presets
- Grid of preset thumbnails (2 columns)
- Preset name labels
- Click to load

#### 3. Parameters
- Sliders for f, k, Du, Dv, dt
- Numeric input boxes alongside sliders
- "Lock" icons to prevent accidental changes
- Visual feedback when parameters change

#### 4. Initial Conditions
- Dropdown to select seed type
- Seed-specific controls (e.g., radius for blob)
- "Apply" button for initial condition changes
- Canvas needs reset warning if simulation running

#### 5. Visualization
- Color scheme dropdown/selector
- 2D/3D mode toggle
- 3D-specific controls (when in 3D mode):
  - Height scale slider
  - Lighting intensity
  - Reset camera button
- Color range controls (min/max)
- Invert toggle

#### 6. Advanced (Collapsible)
- Grid resolution selector
- Custom equations text areas
- "Apply Custom Equations" button
- Warning about performance impact

#### 7. Export
- "Save Image (PNG)" button
- Resolution multiplier selector
- Transparent background checkbox

### Responsive Design
- **Desktop (>1024px)**: Side panel + canvas
- **Tablet (768-1024px)**: Narrower side panel, collapsible
- **Mobile (<768px)**: Bottom drawer with tabs, full-width canvas

---

## Technical Stack

### Core Technologies
- **HTML5 Canvas** or **WebGL** for 2D rendering
- **Three.js** for 3D visualization
- **Vanilla JavaScript** or **React** (recommend React for state management)
- **No backend required** (pure client-side)

### Recommended Libraries
- **Three.js**: 3D rendering
- **dat.GUI** (optional): Quick parameter controls (or custom UI)
- **FileSaver.js**: Image export functionality
- **Color.js** or custom: Color palette generation

### File Structure
```
/src
  /components
    Canvas2D.jsx         - 2D renderer
    Canvas3D.jsx         - 3D renderer
    ControlPanel.jsx     - Main controls
    PresetSelector.jsx   - Preset grid
    ParameterSliders.jsx - Parameter controls
    ColorPicker.jsx      - Color scheme selector
  /utils
    simulation.js        - Core Gray-Scott logic
    webgl-utils.js       - WebGL helper functions
    color-palettes.js    - Predefined color schemes
    presets.js           - Preset configurations
  /shaders (if using WebGL)
    simulation.vert      - Vertex shader
    simulation.frag      - Fragment shader for computation
    render.frag          - Fragment shader for display
  App.jsx                - Main app component
  index.html
  styles.css
```

---

## Implementation Priorities

### Phase 1: Core Simulation (MVP)
1. Gray-Scott simulation engine (WebGL or Canvas 2D)
2. Basic 2D visualization with grayscale
3. Real-time parameter controls (f, k, Du, Dv)
4. Play/Pause/Reset controls
5. Single initial condition (central blob)

### Phase 2: Presets & Patterns
1. Add 10 preset patterns
2. Multiple initial condition types
3. Randomize functionality
4. Preset thumbnail generator

### Phase 3: Visual Enhancement
1. Multiple color schemes
2. Color range controls
3. Smooth rendering improvements
4. Export PNG functionality

### Phase 4: 3D Visualization
1. Three.js integration
2. Height map generation from V values
3. Camera controls
4. Lighting and material setup
5. 3D/2D mode toggle

### Phase 5: Advanced Features
1. Custom equation input
2. Drawing tool for initial conditions
3. Image upload for initial conditions
4. Resolution selector
5. Animation export (GIF)

---

## Performance Considerations

### Optimization Strategies
- **WebGL Compute**: Use fragment shaders for simulation steps (ping-pong framebuffers)
- **Adaptive Resolution**: Lower resolution for 3D mode or slow devices
- **Throttling**: Skip rendering frames if computation falls behind
- **Web Workers**: Offload simulation to worker thread (if using CPU-based approach)

### Performance Targets
- **60 FPS** at 256x256 on modern desktop
- **30 FPS** at 512x512 on modern desktop
- Graceful degradation on mobile devices

### Memory Management
- Release textures/buffers when switching modes
- Limit history/undo buffer if implemented

---

## User Experience Details

### First Load Experience
1. Show "Fingerprint" preset loaded and paused
2. Prominent "Play" button
3. Tooltip: "Click Play to start the simulation"
4. Auto-play after 2 seconds if no interaction

### Error Handling
- Invalid custom equations: Show specific error message
- WebGL not supported: Fallback message + suggest browser upgrade
- Performance warning if FPS drops below 15

### Accessibility
- Keyboard shortcuts:
  - Space: Play/Pause
  - R: Reset
  - S: Randomize
  - 1-9: Load presets 1-9
- ARIA labels on all controls
- Focus indicators
- High contrast mode option

### Educational Elements (Optional)
- Tooltips explaining what f and k parameters do
- "About" modal with explanation of reaction-diffusion
- Links to further reading

---

## Testing Checklist

### Functional Testing
- [ ] Simulation runs smoothly at 60fps (256x256)
- [ ] All presets load correctly and produce expected patterns
- [ ] Parameter changes affect simulation in real-time
- [ ] Play/Pause/Reset work correctly
- [ ] Randomize produces different patterns each time
- [ ] 3D mode renders correctly with proper lighting
- [ ] Camera controls work smoothly in 3D
- [ ] Color schemes apply correctly
- [ ] Export produces valid PNG files

### Browser Compatibility
- [ ] Chrome/Edge (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest, including iOS)
- [ ] Mobile browsers (iOS Safari, Chrome Android)

### Performance Testing
- [ ] No memory leaks during extended use
- [ ] Smooth performance on 4+ year old devices
- [ ] Graceful degradation on low-end hardware

---

## Future Enhancement Ideas

1. **Audio Reactivity**: Sync patterns to microphone input or music
2. **Multi-layer Simulation**: Multiple chemical pairs interacting
3. **Custom Brushes**: Different brush shapes for initial conditions
4. **Pattern Library**: Save/load favorite patterns (localStorage)
5. **Tiling Mode**: Seamless patterns that tile infinitely
6. **VR/AR Support**: View patterns in immersive environments
7. **Collaborative Mode**: Share live simulations via URL
8. **Video Export**: MP4/WebM animation export
9. **Symmetry Modes**: Radial, bilateral symmetry constraints
10. **Perturbation Tools**: Click to add disturbances during simulation

---

## Success Metrics

### For Artistic Use
- Ability to create visually distinct patterns
- Easy experimentation workflow
- High-quality export suitable for print/digital art
- Discoverable "happy accidents" through randomization

### Technical Excellence
- Smooth 60fps performance
- Intuitive parameter relationships
- Stable simulation (no numerical instabilities)
- Works across devices and browsers

---

## Delivery Notes for Claude Code

This spec is designed for implementation with Claude Code. Key points:

1. **Start with Phase 1** (MVP) to get a working simulation quickly
2. **Use WebGL** for computation if possible (much faster than CPU)
3. **React is recommended** for clean component structure and state management
4. **Prioritize performance** - reaction-diffusion can be computationally expensive
5. **Test presets** to ensure they produce visually interesting results
6. **Make color schemes vibrant** - this is for artistic output
7. **3D mode** should be impressive - good lighting and smooth camera
8. **Keep controls simple** - don't overwhelm with options initially

### Suggested Implementation Order
1. Gray-Scott simulation in WebGL
2. Basic 2D renderer with one color scheme
3. Parameter sliders (f, k)
4. Play/Pause/Reset
5. Add more color schemes
6. Implement all presets
7. Add 3D visualization
8. Polish UI and add export
9. Advanced features (custom equations, etc.)

Good luck! This should be a beautiful and fun tool to build and use.
