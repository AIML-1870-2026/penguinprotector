# Stellar Web - Project Specification

## Project Overview

A futuristic particle network visualization system that creates an interconnected "Stellar Web" of nodes and edges in 3D space. Features real-time controls for network parameters, mouse interaction, and visual effects inspired by cyberpunk and sci-fi aesthetics. The system displays particles (nodes) that connect to nearby neighbors with edges, creating an organic, evolving network structure.

**Repository:** https://github.com/reesestowe/stellar-web

## Features & Requirements

### Core Features

1. **Particle Network System**
   - Nodes (particles) positioned in 3D space (x, y, z coordinates)
   - Dynamic edges connecting nearby nodes within connectivity radius
   - Nodes move with independent velocities creating organic motion
   - 3D perspective projection to 2D canvas

2. **Visual Effects**
   - Edge thickness variation based on distance
   - Transparency/opacity gradients for depth perception
   - Color gradients based on edge length or node velocity
   - Size and opacity scaling by z-position (depth)
   - Pulsing effects on nodes and/or edges
   - Futuristic/sci-fi color scheme (neon blues, cyans, magentas, purples)

3. **Interactive Controls** (Sliders)
   - **Node Count:** Number of particles in the system (50-300)
   - **Node Speed:** Velocity multiplier for particle movement (0.1-5x)
   - **Node Size:** Base size of particles (1-10px)
   - **Connectivity Radius:** Maximum distance for edge connections (50-300px)
   - **Edge Thickness:** Base thickness of connection lines (0.5-5px)
   - **Edge Opacity:** Base transparency of edges (0.1-1.0)
   - **Pulse Speed:** Rate of pulsing animation (0-5x)
   - **Depth Effect:** Intensity of 3D perspective effects (0-3x)

4. **Mouse Interaction**
   - Nodes attracted to or repelled by cursor position
   - Toggle between attraction/repulsion modes
   - Adjustable interaction radius
   - Smooth easing for natural movement

5. **Network Statistics Panel** (Bonus Feature)
   - Total number of active edges
   - Average connections per node
   - Network density percentage
   - Current FPS counter
   - Real-time updates

6. **Interactive Click Effects**
   - Particle explosions on click/touch
   - 40 explosion particles per click with physics
   - Life decay and glow effects

7. **Beat-Reactive Mode**
   - Web Audio API microphone integration
   - FFT analysis for bass frequency detection
   - Nodes pulse faster with beats
   - Edges glow brighter/thicker on strong beats
   - Background flash effects

8. **Procedural House Music Generator**
   - Built-in Web Audio API synthesizer
   - 4-on-the-floor kick drum pattern
   - Hi-hat patterns (closed and open)
   - Snare/clap on beats 2 and 4
   - Bass line with E minor pentatonic notes
   - Synth chord stabs (Em, D, C progression)
   - BPM control (100-160 BPM)
   - Volume control
   - Auto-enables beat-reactive mode when playing
   - No external audio files needed (no copyright issues)

### User Experience

- Controls positioned outside animation area (side panel or bottom bar)
- Collapsible control panel to maximize viewing area
- Responsive canvas that fills viewport
- Smooth animations at 60 FPS
- Touch support for mobile devices
- Professional, futuristic UI design

## Technical Specifications

### Architecture

**Single-page Application**
- Pure vanilla JavaScript (no external frameworks)
- HTML5 Canvas 2D rendering context
- Class-based OOP design
- RequestAnimationFrame animation loop
- Modular code organization

### Key Classes

1. **Node Class**
   - Properties: x, y, z (3D position), vx, vy, vz (velocities), size, color, pulsePhase
   - Methods: update(), draw(), getScreenPosition()
   - 3D to 2D projection with perspective
   - Wraps around edges or bounces off boundaries

2. **Edge Class (Optional)**
   - Could be computed on-the-fly or stored
   - Properties: nodeA, nodeB, distance, opacity, thickness
   - Methods: draw()

3. **Network Class**
   - Manages collection of nodes
   - Computes edges based on connectivity radius
   - Calculates network statistics
   - Handles batch rendering

### Rendering Pipeline

1. **Clear Canvas:** Full clear or trailing effect
2. **Update Phase:**
   - Update all node positions
   - Apply mouse interaction forces
   - Calculate visible edges within connectivity radius
   - Update statistics
3. **Draw Phase:**
   - Draw edges first (behind nodes)
     - Sort by z-depth for proper layering
     - Apply distance-based opacity and thickness
     - Color gradient based on length or velocity
   - Draw nodes on top
     - Scale size by z-position
     - Apply pulsing effect
     - Add glow/bloom for close nodes

### 3D Projection Mathematics

**Perspective Projection:**
```javascript
// Convert 3D coordinates to 2D screen position
const perspective = canvas.width / 2;
const scale = perspective / (perspective + z);
screenX = (x * scale) + canvas.width / 2;
screenY = (y * scale) + canvas.height / 2;
screenSize = baseSize * scale;
```

**Depth-based Effects:**
```javascript
// Z-range: -500 to 500
// Closer objects (negative z) = larger, more opaque
// Farther objects (positive z) = smaller, more transparent
const depthFactor = 1 - (z + 500) / 1000;
const opacity = Math.max(0.1, depthFactor * baseOpacity);
const size = baseSize * (0.5 + depthFactor * 0.5);
```

### Color System

**Futuristic/Sci-Fi Palette**
- Primary: Cyan `#00ffff`
- Secondary: Magenta `#ff00ff`
- Accent 1: Electric Blue `#0080ff`
- Accent 2: Neon Purple `#8000ff`
- Background: Deep Space `#0a0015` or `#000511`
- Edges: Gradient from cyan to magenta based on length

**UI Colors**
- Panel Background: `rgba(10, 20, 40, 0.95)` with blur
- Border: Cyan glow `#00ffff`
- Slider Track: Dark with neon accents
- Text: White with cyan highlights
- Statistics: Monospace font with green/cyan values

### Performance Considerations

- Efficient edge calculation (only compute when needed)
- Spatial partitioning for large node counts (optional)
- Limit edge rendering to visible connections only
- Use requestAnimationFrame for smooth 60 FPS
- Optimize canvas drawing (batch operations)
- Minimal DOM manipulation

## File Structure

```
stellar-web/
├── index.html          # Complete application (HTML + CSS + JS)
├── spec.md            # This specification document
└── README.md          # Project documentation
```

### Code Organization (within index.html)

1. **HTML Structure**
   - Canvas element (full viewport)
   - Control panel (collapsible sidebar or bottom bar)
   - Statistics panel (optional, top-right corner)

2. **CSS Styles**
   - Futuristic UI styling
   - Neon glow effects
   - Smooth transitions and animations
   - Responsive layout
   - Collapsible panel mechanics

3. **JavaScript**
   - Configuration object
   - Node class definition
   - Network/connection logic
   - Animation loop
   - Control event handlers
   - Statistics calculations
   - Mouse interaction system

## Color Palette & Typography

### Color Palette

**Background:**
- Deep Space: `#0a0015`
- Alternative: `#000511`

**Nodes:**
- Primary: `#00ffff` (Cyan)
- Glow: `rgba(0, 255, 255, 0.5)`
- Pulse color: `#ff00ff` (Magenta)

**Edges:**
- Near: `rgba(0, 255, 255, 0.8)` (Cyan)
- Far: `rgba(128, 0, 255, 0.3)` (Purple)
- Gradient based on distance

**UI Elements:**
- Panel: `rgba(10, 20, 40, 0.95)`
- Border: `#00ffff` with glow
- Accent: `#ff00ff`
- Text: `#ffffff`
- Values: `#00ffaa` (Bright cyan-green)

### Typography

- **Font Family:** 'Courier New', monospace (for sci-fi feel) or Arial for clean UI
- **Heading:** 18px, bold, cyan color with text shadow
- **Labels:** 13px, white
- **Values:** 14px, cyan-green with glow
- **Statistics:** 12px, monospace, green terminal style

## Development Requirements

### Main Task Checklist

- [x] Create spec.md document
- [x] Implement particle system with nodes in 3D space
- [x] Add edge connections based on connectivity radius
- [x] Implement 3D to 2D perspective projection
- [x] Create sliders for all core parameters:
  - [x] Node Count
  - [x] Node Speed
  - [x] Node Size
  - [x] Connectivity Radius
  - [x] Edge Thickness
  - [x] Edge Opacity
  - [x] Pulse Speed
  - [x] Depth Effect
- [x] Position controls outside animation area
- [x] Add color gradients based on edge length/velocity
- [x] Implement mouse interaction (attraction/repulsion)
- [x] Add pulsing effects to nodes or edges
- [x] Create depth effects with size/opacity by z-position
- [x] Optimize performance (connection limiting, squared distance checks)
- [x] Add particle explosions on click
- [x] Add beat-reactive mode with microphone input
- [x] Add procedural house music generator with Web Audio API

### Ideas to Explore

1. **Network Density Variation**
   - Experiment with connectivity radius values
   - Observe how network structure changes
   - Find optimal balance between sparsity and density

2. **Dynamic Color Gradients**
   - Edge color based on distance (short = cyan, long = purple)
   - Node color based on velocity (slow = blue, fast = magenta)
   - Hue shift over time for organic feel

3. **Enhanced Mouse Interaction**
   - Toggle attraction/repulsion modes
   - Variable interaction strength
   - Multiple interaction points (multi-touch)
   - Nodes form clusters around cursor

4. **Visual Effects**
   - Node pulsing synchronized or random
   - Edge pulsing based on data flow concept
   - Glow/bloom effects for closer nodes
   - Motion blur trails for fast-moving nodes

### Stretch Challenges

**Control Panel Optimization:**
- Collapsible side panel (slide in/out)
- Or fixed bottom bar below canvas
- Transparent overlay that fades when not in use
- Keyboard shortcuts to toggle visibility

**Network Statistics Panel:**
- Display in top-right or top-left corner
- Real-time metrics:
  - Total edges: Count of active connections
  - Avg connections per node: Total edges / node count
  - Network density: Actual edges / possible edges
  - FPS counter: Animation performance
- Styled like terminal/HUD display
- Optional: Graph of metrics over time

**Bonus Features:**
- Preset configurations (sparse, dense, chaotic, organized)
- Export network state as JSON
- Screenshot/recording capability
- Beat-reactive mode (Web Audio API)
- Particle trails/comet effects
- Voronoi diagram overlay
- Force-directed layout mode

## Mathematical Concepts

### Connectivity Algorithm

```javascript
// For each node, find all neighbors within radius
function findConnections(node, allNodes, radius) {
    const connections = [];
    for (let other of allNodes) {
        if (node === other) continue;

        const dx = node.x - other.x;
        const dy = node.y - other.y;
        const dz = node.z - other.z;
        const distance = Math.sqrt(dx*dx + dy*dy + dz*dz);

        if (distance < radius) {
            connections.push({
                node: other,
                distance: distance
            });
        }
    }
    return connections;
}
```

### Edge Opacity Calculation

```javascript
// Fade edges based on distance (0 = full opacity, radius = transparent)
const opacityFactor = 1 - (distance / connectivityRadius);
const finalOpacity = baseOpacity * opacityFactor;
```

### Mouse Interaction Force

```javascript
// Apply inverse-square-like force
const dx = node.x - mouseX;
const dy = node.y - mouseY;
const distance = Math.sqrt(dx*dx + dy*dy);
const force = (interactionRadius - distance) / interactionRadius;

if (distance < interactionRadius) {
    // Attraction: negative force
    // Repulsion: positive force
    const forceX = (dx / distance) * force * strength;
    const forceY = (dy / distance) * force * strength;
    node.vx += forceX * (attractionMode ? -1 : 1);
    node.vy += forceY * (attractionMode ? -1 : 1);
}
```

### Network Statistics Formulas

```javascript
// Network density (0 to 1)
const maxPossibleEdges = (nodeCount * (nodeCount - 1)) / 2;
const density = totalEdges / maxPossibleEdges;

// Average degree (connections per node)
const avgDegree = (totalEdges * 2) / nodeCount;
```

## Implementation Strategy

### Phase 1: Basic Particle System
1. Create Node class with 3D positions
2. Initialize array of nodes with random positions/velocities
3. Implement basic movement and boundary handling
4. Add 3D to 2D projection
5. Render nodes as circles

### Phase 2: Edge Connections
1. Implement connectivity radius logic
2. Calculate edges between nearby nodes
3. Draw lines between connected nodes
4. Add distance-based opacity

### Phase 3: Controls
1. Create control panel UI
2. Add sliders for all parameters
3. Wire up event handlers
4. Update configuration in real-time

### Phase 4: Visual Polish
1. Add depth effects (size/opacity by z)
2. Implement pulsing animations
3. Add color gradients
4. Create glow effects

### Phase 5: Interactivity
1. Add mouse tracking
2. Implement attraction/repulsion forces
3. Add toggle for interaction mode

### Phase 6: Statistics (Bonus)
1. Calculate network metrics
2. Create statistics panel UI
3. Update values each frame

### Phase 7: UI Optimization
1. Reposition controls outside canvas
2. Add collapsible functionality
3. Polish and finalize styling

## Browser Compatibility

**Tested & Working:**
- Chrome/Edge (Chromium)
- Firefox
- Safari (WebKit)

**Requirements:**
- HTML5 Canvas support
- CSS3 transforms, animations, and backdrop-filter
- ES6 JavaScript (classes, arrow functions, const/let)
- requestAnimationFrame API

**Performance Notes:**
- 200+ nodes may reduce framerate on older devices
- Use fewer nodes or lower connectivity radius for better performance
- Mobile devices may need reduced particle counts

## Credits

**Created by:** Reese Stowe
**Course:** AIML-1870
**Date:** January 2026
**Assignment:** Stellar Web Particle System

---

*"In the vast expanse of cyberspace, nodes connect to form a web of infinite possibilities."*
