// ===================== TAB 1: GLOBE =====================
import { fetchFeed, parseNeo } from '../shared.js';

let _ro = null;           // ResizeObserver — disconnected on re-init to prevent leak
let _points = null;       // current points array
let _preselectAc = null;  // AbortController for preselect-neo listener
let _orbEls = new Map();  // id -> { el, p } — direct style updates without re-render

// Altitude mapping — sqrt compression so miss distances spread visually.
// Range: 0.3 (surface-grazing) to 5.3 (very distant), in globe radii above surface.
const MAX_LD_SCALE = 70;
const MAX_ALTITUDE = 5.0;
function ldToAltitude(ld) {
  return Math.sqrt(Math.min(ld, MAX_LD_SCALE) / MAX_LD_SCALE) * MAX_ALTITUDE + 0.3;
}

// Apply CSS orb style directly to a DOM element.
// Uses a radial gradient + box-shadow to fake a lit sphere appearance.
function _applyOrbStyle(el, p, selected) {
  const size  = p.isMoon ? 14 : (p.isPha ? 18 : 13);
  const color = p.isMoon ? '#9ca3af' : (p.isPha ? '#f59e0b' : '#00d4aa');
  const c     = selected ? '#ffffff' : color;
  const glow  = selected ? size * 2.6 : size * 1.4;
  el.style.cssText = `
    width:${size}px;
    height:${size}px;
    border-radius:50%;
    background:radial-gradient(circle at 35% 35%, #ffffffaa, ${c} 65%);
    box-shadow:0 0 ${glow}px ${c}, 0 0 ${glow * 2}px ${c}55;
    transform:scale(${selected ? 1.7 : 1.0});
    transition:transform 0.25s ease, box-shadow 0.25s ease;
    cursor:${p.isMoon ? 'default' : 'pointer'};
    pointer-events:auto;
  `;
}

function buildPoints(neos) {
  const points = neos.map((neo, i) => ({
    id:       neo.id,
    name:     neo.name,
    ld:       neo.ld,
    km:       neo.km,
    vel:      neo.vel,
    diameter: neo.diameter,
    isPha:    neo.isPha,
    lat:      ((i * 137.508) % 140) - 70,   // golden-angle scatter
    lng:      ((i * 222.492) % 360) - 180,
    alt:      ldToAltitude(neo.ld),
  }));

  // Moon reference at 1 LD
  points.push({
    id: '__moon__', name: '🌕 Moon (1 LD reference)',
    lat: 0, lng: 90, alt: ldToAltitude(1),
    isMoon: true,
  });

  return points;
}

function renderInfoPanel(p) {
  document.getElementById('globe-info-content').innerHTML = `
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

// Deselect old orb, select new one — updates DOM directly, no globe re-render needed.
function _selectOrb(state, p) {
  const prev = state.selectedNeo;
  if (prev && _orbEls.has(prev)) {
    const { el, p: pp } = _orbEls.get(prev);
    _applyOrbStyle(el, pp, false);
  }
  state.selectedNeo = p.id;
  if (_orbEls.has(p.id)) {
    const { el } = _orbEls.get(p.id);
    _applyOrbStyle(el, p, true);
  }
}

export async function initGlobe(state) {
  const container = document.getElementById('globe-container');
  const infoEl    = document.getElementById('globe-info-content');

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

  if (typeof Globe !== 'function') {
    infoEl.innerHTML = '<div class="error-card"><p>globe.gl failed to load from CDN.</p></div>';
    return;
  }

  if (_preselectAc) { _preselectAc.abort(); _preselectAc = null; }
  container.innerHTML = '';
  _orbEls = new Map();

  const globe = Globe()(container)
    .globeImageUrl('https://unpkg.com/three-globe/example/img/earth-night.jpg')
    .bumpImageUrl('https://unpkg.com/three-globe/example/img/earth-topology.png')
    .backgroundImageUrl('https://unpkg.com/three-globe/example/img/night-sky.png')
    .atmosphereColor('#3a7bd5')
    .atmosphereAltitude(0.22)
    // HTML orb layer — each asteroid is a CSS-styled div positioned in 3D space.
    // globe.gl handles projection, occlusion (hides orbs behind the globe), and depth.
    // No Three.js dependency required.
    .htmlElementsData(points)
    .htmlLat(p => p.lat)
    .htmlLng(p => p.lng)
    .htmlAltitude(p => p.alt)
    .htmlElement(p => {
      const el = document.createElement('div');
      _orbEls.set(p.id, { el, p });
      _applyOrbStyle(el, p, state.selectedNeo === p.id);
      if (!p.isMoon) {
        el.title = p.name;
        el.addEventListener('click', () => {
          _selectOrb(state, p);
          renderInfoPanel(p);
        });
      }
      return el;
    })
    .width(container.offsetWidth)
    .height(container.offsetHeight);

  globe.controls().autoRotate      = true;
  globe.controls().autoRotateSpeed = 0.25;
  globe.controls().enableDamping   = true;

  // Pre-select the closest NEO
  const sorted = [...neos].sort((a, b) => a.ld - b.ld);
  if (sorted.length) {
    const first = points.find(p => p.id === sorted[0].id);
    if (first) {
      _selectOrb(state, first);
      renderInfoPanel(first);
    }
  }

  if (!state.selectedNeo) {
    infoEl.innerHTML = `
      <p class="hint-text muted">Click any glowing orb to select an asteroid.</p>
      <div class="legend">
        <div class="legend-item"><span class="dot orange"></span> Potentially Hazardous</div>
        <div class="legend-item"><span class="dot green"></span> Routine Flyby</div>
        <div class="legend-item"><span class="dot gray"></span> Moon (1 LD ref.)</div>
      </div>`;
  }

  // Cross-tab selection (from This Week / Size & Speed tabs)
  _preselectAc = new AbortController();
  document.addEventListener('preselect-neo', e => {
    const p = _points.find(pt => pt.id === e.detail);
    if (!p || p.isMoon) return;
    _selectOrb(state, p);
    renderInfoPanel(p);
  }, { signal: _preselectAc.signal });

  if (_ro) _ro.disconnect();
  _ro = new ResizeObserver(() => {
    globe.width(container.offsetWidth).height(container.offsetHeight);
  });
  _ro.observe(container);
}
