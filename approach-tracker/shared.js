// ===================== CONSTANTS =====================
export const NASA_API_KEY = 'DEMO_KEY'; // swap for a real key at https://api.nasa.gov/

export const TODAY = new Date().toISOString().split('T')[0];

export const WEEK_END = (() => {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return d.toISOString().split('T')[0];
})();

// ===================== SHARED STATE =====================
// Mutable state object shared across all tab modules
export const state = {
  feedCache: null,      // cached /feed response (this week)
  feedFetchedAt: null,  // timestamp of last feed fetch
  scheduleCache: null,  // cached 30-day feed grouped by date
  selectedNeo: null,    // currently selected NEO id (for cross-tab nav)
};

// ===================== SPINNER =====================
export function showSpinner() {
  const el = document.getElementById('spinner-wrap');
  if (el && !el.querySelector('.spinner')) {
    el.innerHTML = '<div class="spinner"></div>';
  }
}

export function hideSpinner() {
  const el = document.getElementById('spinner-wrap');
  if (el) el.innerHTML = '';
}

// ===================== LAST UPDATED =====================
export function updateLastUpdated() {
  if (!state.feedFetchedAt) return;
  const mins = Math.floor((Date.now() - state.feedFetchedAt) / 60000);
  const text = mins === 0 ? 'Updated just now' : `Updated ${mins}m ago`;
  const lu = document.getElementById('last-updated');
  if (lu) lu.textContent = text;
  const fu = document.getElementById('footer-updated');
  if (fu) fu.textContent = `Last updated: ${new Date(state.feedFetchedAt).toLocaleTimeString()}`;
}

// ===================== FEED FETCH (this-week cache) =====================
export async function fetchFeed() {
  if (state.feedCache) return state.feedCache;
  showSpinner();
  try {
    const url = `https://api.nasa.gov/neo/rest/v1/feed?start_date=${TODAY}&end_date=${WEEK_END}&api_key=${NASA_API_KEY}`;
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`NASA API error ${resp.status}`);
    const data = await resp.json();
    const all = [];
    Object.values(data.near_earth_objects).forEach(list => all.push(...list));
    state.feedCache = all;
    state.feedFetchedAt = Date.now();
    updateLastUpdated();
    return all;
  } finally {
    hideSpinner();
  }
}

// ===================== PARSE NEO =====================
// Normalises a raw NeoWs NEO object into a flat record
export function parseNeo(neo) {
  const ca = neo.close_approach_data[0];
  const dMin = parseFloat(neo.estimated_diameter.meters.estimated_diameter_min);
  const dMax = parseFloat(neo.estimated_diameter.meters.estimated_diameter_max);
  return {
    id:       neo.id,
    name:     neo.name,
    date:     ca.close_approach_date,
    ld:       parseFloat(ca.miss_distance.lunar),
    km:       parseFloat(ca.miss_distance.kilometers),
    vel:      parseFloat(ca.relative_velocity.kilometers_per_second),
    diameter: (dMin + dMax) / 2,
    isPha:    neo.is_potentially_hazardous_asteroid,
  };
}
