// ===================== TAB 3: SIZE & SPEED =====================
import { fetchFeed, parseNeo, state } from '../shared.js';

// Reference objects for size comparison (metres)
const SIZE_REFS = [
  { label: 'House (~10 m)',             m: 10    },
  { label: 'Football field (~91 m)',    m: 91    },
  { label: 'City block (~200 m)',       m: 200   },
  { label: 'Eiffel Tower (~330 m)',     m: 330   },
  { label: 'Empire State (~443 m)',     m: 443   },
  { label: 'Mount Everest (~8,849 m)', m: 8849  },
];

// Reference speeds (km/h)
const VEL_REFS = [
  { label: 'Speed of sound', kmh: 1_235   },
  { label: 'Bullet',         kmh: 3_600   },
  { label: 'ISS orbit',      kmh: 27_600  },
];

// Log-scale normaliser — prevents tiny objects from disappearing
function logPct(val, maxVal) {
  if (val <= 0) return 0;
  return (Math.log10(1 + val) / Math.log10(1 + maxVal)) * 100;
}

function renderSizeViz(neo) {
  const d = neo.diameter;
  const allM = [...SIZE_REFS.map(r => r.m), d];
  const maxM = Math.max(...allM);

  const asteroidPct = logPct(d, maxM).toFixed(1);
  const refRows = SIZE_REFS.map(ref => {
    const pct = logPct(ref.m, maxM).toFixed(1);
    return `
      <div class="size-bar-row">
        <span class="size-bar-label">${ref.label}</span>
        <div class="size-bar-track"><div class="size-bar-fill reference-bar" style="width:${pct}%"></div></div>
        <span class="size-bar-val">${ref.m.toLocaleString()} m</span>
      </div>`;
  }).join('');

  document.getElementById('size-viz').innerHTML = `
    <div class="size-bar-row" style="margin-bottom:6px">
      <span class="size-bar-label" style="color:var(--accent)">🪨 This asteroid (~${d.toFixed(0)} m)</span>
      <div class="size-bar-track"><div class="size-bar-fill asteroid-bar" style="width:${asteroidPct}%"></div></div>
      <span class="size-bar-val" style="color:var(--accent)">${d.toFixed(0)} m</span>
    </div>
    ${refRows}
  `;
}

function renderVelocityViz(neo) {
  const velKmh = neo.vel * 3600;
  const allVels = [...VEL_REFS.map(r => r.kmh), velKmh];
  const maxVel = Math.max(...allVels);

  const asteroidPct = logPct(velKmh, maxVel).toFixed(1);
  const refRows = VEL_REFS.map(ref => {
    const pct = logPct(ref.kmh, maxVel).toFixed(1);
    return `
      <div class="vel-row">
        <span class="vel-label">${ref.label}</span>
        <div class="vel-track"><div class="vel-fill reference-vel" style="width:${pct}%"></div></div>
        <span class="vel-val">${ref.kmh.toLocaleString()} km/h</span>
      </div>`;
  }).join('');

  document.getElementById('velocity-viz').innerHTML = `
    <div class="vel-row" style="margin-bottom:6px">
      <span class="vel-label" style="color:var(--accent)">🪨 Asteroid</span>
      <div class="vel-track"><div class="vel-fill asteroid-vel" style="width:${asteroidPct}%"></div></div>
      <span class="vel-val" style="color:var(--accent)">${velKmh.toLocaleString(undefined, {maximumFractionDigits: 0})} km/h</span>
    </div>
    ${refRows}
  `;
}

function renderDistanceViz(neo) {
  const EARTH_CIRCUM = 40_075;   // km
  const NY_LONDON    = 5_570;    // km
  const km = neo.km;

  document.getElementById('distance-viz').innerHTML = `
    <div class="dist-row">
      <span class="dist-label">Lunar distances</span>
      <span class="dist-val">${neo.ld.toFixed(4)} LD</span>
    </div>
    <div class="dist-row">
      <span class="dist-label">Kilometres</span>
      <span class="dist-val">${km.toLocaleString(undefined, {maximumFractionDigits: 0})} km</span>
    </div>
    <div class="dist-row">
      <span class="dist-label">Trips around Earth</span>
      <span class="dist-val">${Math.round(km / EARTH_CIRCUM).toLocaleString()}×</span>
    </div>
    <div class="dist-row">
      <span class="dist-label">NYC → London flights</span>
      <span class="dist-val">${Math.round(km / NY_LONDON).toLocaleString()}×</span>
    </div>
  `;
}

function renderAll(neo) {
  renderSizeViz(neo);
  renderVelocityViz(neo);
  renderDistanceViz(neo);
}

export async function initSizeSpeed(state) {
  // Skeleton panels
  ['size-viz', 'velocity-viz', 'distance-viz'].forEach(id => {
    document.getElementById(id).innerHTML =
      '<div class="skeleton" style="height:160px"></div>';
  });

  let neos;
  try {
    neos = (await fetchFeed()).map(parseNeo).filter(Boolean);
  } catch (err) {
    document.getElementById('size-speed-panels').innerHTML =
      `<div class="error-card"><p>${err.message}</p><button class="retry-btn" onclick="location.reload()">Retry</button></div>`;
    return;
  }

  // Populate dropdown (sorted closest first)
  const sorted = [...neos].sort((a, b) => a.ld - b.ld);
  const sel = document.getElementById('asteroid-select');
  sel.innerHTML = sorted.map(n =>
    `<option value="${n.id}">${n.name}</option>`
  ).join('');

  function getSelected() {
    return neos.find(n => n.id === sel.value) || sorted[0];
  }

  // Check for preselect from This Week table row click
  if (state.selectedNeo) {
    sel.value = state.selectedNeo;
    state.selectedNeo = null;
  }

  renderAll(getSelected());

  sel.addEventListener('change', () => renderAll(getSelected()));

  // Listen for cross-tab navigation event
  document.addEventListener('preselect-neo', e => {
    sel.value = e.detail;
    renderAll(getSelected());
  });
}
