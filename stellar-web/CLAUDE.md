# stellar-web

## Overview
A futuristic particle network visualization that creates an interconnected "Stellar Web" of nodes and edges in 3D space. Features real-time controls, mouse interaction, click explosions, beat-reactive mode, and a procedural house music generator.

## Structure
- `index.html` - Complete single-page application (HTML + CSS + JS)
- `spec.md` - Full project specification document

## Live URL
https://aiml-1870-2026.github.io/penguinprotector/stellar-web/

## Key Features
- 3D particle network with dynamic edge connections
- Real-time sliders: Node Count, Speed, Size, Connectivity Radius, Edge Thickness/Opacity, Pulse Speed, Depth Effect
- Mouse interaction (attraction/repulsion toggle)
- Click-to-explode particle effects
- Beat-reactive mode via Web Audio API microphone input
- Procedural house music generator (kick, hi-hat, snare, bass, synth chords)
- Network statistics panel (edges, avg connections, density, FPS)

## Tech Stack
- Pure vanilla JavaScript (no frameworks)
- HTML5 Canvas 2D rendering
- Web Audio API for beat detection and music synthesis
- Class-based OOP (Node, Network)
- requestAnimationFrame animation loop

## Notes
- Single HTML file, all code inline
- Refer to `spec.md` for full technical details, math, and algorithms
