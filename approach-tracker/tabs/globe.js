// ===================== TAB 1: GLOBE =====================
import { fetchFeed, parseNeo } from '../shared.js';

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
    neos = raw.map(parseNeo);
  } catch (err) {
    infoEl.innerHTML = `
      <div class="error-card">
        <p>${err.message}</p>
        <button class="retry-btn" onclick="location.reload()">Retry</button>
      </div>`;
    return;
  }

  const points = buildPoints(neos);

  // Guard: globe.gl must be available as a global loaded by <script> tag
  if (typeof Globe !== 'function') {
    infoEl.innerHTML = '<div class="error-card"><p>globe.gl failed to load from CDN.</p></div>';
    return;
  }

  const globe = Globe()(container)
    .globeImageUrl('https://unpkg.com/three-globe/example/img/earth-night.jpg')
    .backgroundImageUrl('https://unpkg.com/three-globe/example/img/night-sky.png')
    .pointsData(points)
    .pointAltitude('alt')
    .pointColor('color')
    .pointRadius('size')
    .pointResolution(8)
    .pointLabel(p =>
      `<div style="font-family:monospace;font-size:12px;background:#111827dd;padding:4px 8px;border-radius:4px;color:#f9fafb;border:1px solid #1f2937">${p.name}</div>`
    )
    .onPointClick(p => {
      if (p.isMoon) return;
      state.selectedNeo = p.id;
      renderInfoPanel(p);
    })
    .width(container.offsetWidth)
    .height(container.offsetHeight);

  // Gentle auto-rotation
  globe.controls().autoRotate      = true;
  globe.controls().autoRotateSpeed = 0.25;

  // Pre-select the closest NEO
  const sorted = [...neos].sort((a, b) => a.ld - b.ld);
  if (sorted.length) {
    const first = points.find(p => p.id === sorted[0].id);
    if (first) renderInfoPanel(first);
  }

  // Restore info panel hint + legend if nothing was shown
  if (!state.selectedNeo) {
    infoEl.innerHTML = `
      <p class="hint-text muted">Click any glowing dot on the globe to select an asteroid.</p>
      <div class="legend">
        <div class="legend-item"><span class="dot orange"></span> Potentially Hazardous</div>
        <div class="legend-item"><span class="dot green"></span> Routine Flyby</div>
        <div class="legend-item"><span class="dot gray"></span> Moon (1 LD ref.)</div>
      </div>`;
  }

  // Responsive resize
  const ro = new ResizeObserver(() => {
    globe.width(container.offsetWidth).height(container.offsetHeight);
  });
  ro.observe(container);
}
