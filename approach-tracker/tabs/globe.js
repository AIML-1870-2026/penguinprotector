// ===================== TAB 1: GLOBE =====================
import { fetchFeed, parseNeo } from '../shared.js';

let _ro = null;           // ResizeObserver — disconnected on re-init to prevent leak
let _cloudMesh = null;   // Cloud sphere — reference kept so we can dispose on re-init
let _rafId = null;       // requestAnimationFrame for cloud rotation
let _globeInst = null;   // globe.gl instance — kept so preselect listener can update it
let _points = null;      // current points array — kept for re-render on selection change
let _preselectAc = null; // AbortController for the preselect-neo listener

function _addCloudLayer(globe) {
  // Access the underlying Three.js renderer globals exposed by globe.gl
  const THREE = window.THREE;
  if (!THREE) return; // three-globe bundles THREE but may not expose it as window.THREE

  const scene = globe.scene();
  if (!scene) return;

  const GLOBE_RADIUS = 100; // globe.gl internal radius

  const loader = new THREE.TextureLoader();
  loader.load(
    'https://unpkg.com/three-globe/example/img/earth-clouds.png',
    texture => {
      const geo = new THREE.SphereGeometry(GLOBE_RADIUS * 1.004, 64, 64);
      const mat = new THREE.MeshPhongMaterial({
        map:         texture,
        transparent: true,
        opacity:     0.35,
        depthWrite:  false,
      });
      _cloudMesh = new THREE.Mesh(geo, mat);
      scene.add(_cloudMesh);

      // Slow drift independent of globe rotation
      const drift = () => {
        if (_cloudMesh) _cloudMesh.rotation.y += 0.00008;
        _rafId = requestAnimationFrame(drift);
      };
      if (_rafId) cancelAnimationFrame(_rafId);
      _rafId = requestAnimationFrame(drift);
    }
  );
}

function _disposeCloudLayer() {
  if (_rafId) { cancelAnimationFrame(_rafId); _rafId = null; }
  if (_cloudMesh) {
    _cloudMesh.geometry.dispose();
    _cloudMesh.material.map?.dispose();
    _cloudMesh.material.dispose();
    _cloudMesh = null;
  }
}

// Altitude mapping — square-root compression so objects spread visually.
// Miss distances range ~0.1 LD to 70+ LD; we map that onto globe altitude
// 0.05 – 3.0 units. sqrt() compresses the high end so distant objects don't
// push off-screen while close ones are still distinguishable.
const MAX_LD_SCALE  = 70;
const MAX_ALTITUDE  = 3.0;
function ldToAltitude(ld) {
  return Math.sqrt(Math.min(ld, MAX_LD_SCALE) / MAX_LD_SCALE) * MAX_ALTITUDE + 0.05;
}

function buildPoints(neos) {
  // Asteroid lat/lng are distributed pseudo-randomly (actual approach geometry
  // from NeoWs doesn't give a sky position, so we scatter them visually).
  const points = neos.map((neo, i) => ({
    id:       neo.id,
    name:     neo.name,
    ld:       neo.ld,
    km:       neo.km,
    vel:      neo.vel,
    diameter: neo.diameter,
    isPha:    neo.isPha,
    lat:      ((i * 137.508) % 140) - 70,   // golden-angle spacing
    lng:      ((i * 222.492) % 360) - 180,
    alt:      ldToAltitude(neo.ld),
    color:    neo.isPha ? '#f59e0b' : '#00d4aa',
    size:     neo.isPha ? 0.55 : 0.38,
  }));

  // Moon reference at 1 LD
  points.push({
    id: '__moon__',
    name: '🌕 Moon (1 LD reference)',
    lat: 0, lng: 90,
    alt: ldToAltitude(1),
    color: '#9ca3af',
    size: 1.0,
    isMoon: true,
  });

  return points;
}

function renderInfoPanel(p) {
  const el = document.getElementById('globe-info-content');
  el.innerHTML = `
    <h3>${p.name}</h3>
    ${p.isPha ? '<div class="pha-badge">⚠ Potentially Hazardous</div>' : ''}
    <div class="info-row"><span class="label">Miss distance</span><span class="value">${p.ld.toFixed(3)} LD</span></div>
    <div class="info-row"><span class="label">Miss distance km</span><span class="value">${p.km.toLocaleString(undefined, {maximumFractionDigits: 0})} km</span></div>
    <div class="info-row"><span class="label">Diameter (est.)</span><span class="value">~${p.diameter.toFixed(0)} m</span></div>
    <div class="info-row"><span class="label">Velocity</span><span class="value">${p.vel.toFixed(2)} km/s</span></div>
  `;
  document.getElementById('globe-status-bar').textContent =
    `🪨 ${p.name} will pass at ${p.ld.toFixed(2)} lunar distances — about ${p.km.toLocaleString(undefined, {maximumFractionDigits: 0})} km from Earth`;
}

export async function initGlobe(state) {
  const container  = document.getElementById('globe-container');
  const infoEl     = document.getElementById('globe-info-content');

  // Skeleton while loading
  infoEl.innerHTML = '<div class="skeleton" style="height:180px;width:100%"></div>';

  let neos;
  try {
    const raw = await fetchFeed();
    neos = raw.map(parseNeo).filter(Boolean);
  } catch (err) {
    infoEl.innerHTML = `
      <div class="error-card">
        <p>${err.message}</p>
        <button class="retry-btn" onclick="location.reload()">Retry</button>
      </div>`;
    return;
  }

  const points = buildPoints(neos);
  _points = points;

  // Guard: globe.gl must be available as a global loaded by <script> tag
  if (typeof Globe !== 'function') {
    infoEl.innerHTML = '<div class="error-card"><p>globe.gl failed to load from CDN.</p></div>';
    return;
  }

  // Clear any previous WebGL canvas — Globe() appends a new canvas each time,
  // so without this every refresh stacks canvases and leaks GPU memory.
  _disposeCloudLayer();
  if (_preselectAc) { _preselectAc.abort(); _preselectAc = null; }
  container.innerHTML = '';

  // Invisible click-target points on the surface (no visual, just hit detection)
  const pointColor  = () => 'rgba(0,0,0,0)';
  const pointRadius = () => 0.5;

  const asteroidPoints = points.filter(p => !p.isMoon);

  const globe = Globe()(container)
    .globeImageUrl('https://unpkg.com/three-globe/example/img/earth-night.jpg')
    .bumpImageUrl('https://unpkg.com/three-globe/example/img/earth-topology.png')
    .backgroundImageUrl('https://unpkg.com/three-globe/example/img/night-sky.png')
    .atmosphereColor('#3a7bd5')
    .atmosphereAltitude(0.22)
    // Flat surface points (base markers) + click handling
    .pointsData(points)
    .pointAltitude(0)
    .pointColor(pointColor)
    .pointRadius(pointRadius)
    .pointResolution(12)
    .pointLabel(p =>
      `<div style="font-family:monospace;font-size:12px;background:#111827dd;padding:4px 8px;border-radius:4px;color:#f9fafb;border:1px solid #1f2937">${p.name}</div>`
    )
    .onPointClick(p => {
      if (p.isMoon) return;
      state.selectedNeo = p.id;
      renderInfoPanel(p);
      // Re-render tethers and orbs to apply selection highlight
      globe.pointsData(points);
      globe.customLayerData(asteroidPoints);
    })
    // Pulsing sonar rings at each asteroid's base
    .ringsData(asteroidPoints)
    .ringColor(p => t => p.isPha
      ? `rgba(245,158,11,${Math.max(0, 0.8 * (1 - t))})`
      : `rgba(0,212,170,${Math.max(0, 0.6 * (1 - t))})`)
    .ringMaxRadius(p => p.isPha ? 3.5 : 2.2)
    .ringPropagationSpeed(p => p.isPha ? 1.8 : 1.1)
    .ringRepeatPeriod(p => p.isPha ? 700 : 1400)
    // Glowing orbs floating in space at miss-distance altitude
    .customLayerData(asteroidPoints)
    .customThreeObject(p => {
      const T = window.THREE;
      if (!T) return null;
      const color  = p.isPha ? 0xf59e0b : 0x00d4aa;
      const radius = p.isMoon ? 2.4 : (p.isPha ? 2.0 : 1.4);

      const make = (r, opacity, depthWrite = false) => {
        const m = new T.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite });
        return new T.Mesh(new T.SphereGeometry(r, 16, 16), m);
      };

      const core   = make(radius,       0.95, true);   // bright solid centre
      const mid    = make(radius * 1.5, 0.30);          // mid glow
      const outer  = make(radius * 2.4, 0.10);          // wide soft halo

      const group = new T.Group();
      group.add(outer);
      group.add(mid);
      group.add(core);
      group._color = color;
      group._core  = core;
      group._mid   = mid;
      group._outer = outer;
      return group;
    })
    .customThreeObjectUpdate((obj, p) => {
      if (!obj) return;
      const coords = globe.getCoords(p.lat, p.lng, p.alt);
      if (coords) Object.assign(obj.position, coords);
      const isSelected = state.selectedNeo === p.id;
      const T = window.THREE;
      if (T && obj._core) {
        const col = isSelected ? 0xffffff : obj._color;
        obj._core.material.color.set(col);
        obj._mid.material.color.set(col);
        obj._outer.material.color.set(col);
        obj._core.material.opacity  = isSelected ? 1.0  : 0.95;
        obj._mid.material.opacity   = isSelected ? 0.45 : 0.30;
        obj._outer.material.opacity = isSelected ? 0.18 : 0.10;
      }
      const s = isSelected ? 1.7 : 1.0;
      obj.scale.set(s, s, s);
    })
    .width(container.offsetWidth)
    .height(container.offsetHeight);

  _globeInst = globe;

  // Gentle auto-rotation
  globe.controls().autoRotate      = true;
  globe.controls().autoRotateSpeed = 0.25;
  globe.controls().enableDamping   = true;

  // Cloud layer — thin transparent sphere slightly above the surface
  _addCloudLayer(globe);

  // Pre-select the closest NEO and apply highlight
  const sorted = [...neos].sort((a, b) => a.ld - b.ld);
  if (sorted.length) {
    const first = points.find(p => p.id === sorted[0].id);
    if (first) {
      state.selectedNeo = first.id;
      renderInfoPanel(first);
      globe.pointsData(points);
      globe.customLayerData(asteroidPoints);
    }
  }

  // Fallback hint + legend if no NEO could be pre-selected
  if (!state.selectedNeo) {
    infoEl.innerHTML = `
      <p class="hint-text muted">Click any glowing dot on the globe to select an asteroid.</p>
      <div class="legend">
        <div class="legend-item"><span class="dot orange"></span> Potentially Hazardous</div>
        <div class="legend-item"><span class="dot green"></span> Routine Flyby</div>
        <div class="legend-item"><span class="dot gray"></span> Moon (1 LD ref.)</div>
      </div>`;
  }

  // Listen for cross-tab asteroid selection (from This Week or Size & Speed)
  _preselectAc = new AbortController();
  document.addEventListener('preselect-neo', e => {
    const p = _points.find(pt => pt.id === e.detail);
    if (!p || p.isMoon) return;
    state.selectedNeo = p.id;
    renderInfoPanel(p);
    globe.pointsData(_points);
    globe.customLayerData(_points.filter(pt => !pt.isMoon));
  }, { signal: _preselectAc.signal });

  // Responsive resize — disconnect previous observer before creating a new one
  if (_ro) _ro.disconnect();
  _ro = new ResizeObserver(() => {
    globe.width(container.offsetWidth).height(container.offsetHeight);
  });
  _ro.observe(container);
}
