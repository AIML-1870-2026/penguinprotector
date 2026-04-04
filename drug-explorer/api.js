// OpenFDA API — no key required for public access (240 req/min).
// To increase rate limits, request a key at: https://open.fda.gov/apis/authentication/
// Then replace the empty string below with your key and append &api_key=YOUR_API_KEY to each request.
export const YOUR_API_KEY = '';

const BASE = 'https://api.fda.gov';

function keyParam() {
  return YOUR_API_KEY ? `&api_key=${encodeURIComponent(YOUR_API_KEY)}` : '';
}

// ── Session cache (Map cleared on page reload) ──────────────────────
const cache = new Map();

function cached(key, fn) {
  if (cache.has(key)) return Promise.resolve(cache.get(key));
  return fn().then(v => {
    cache.set(key, v); // cache null (404) and real results; errors are NOT cached
    return v;
  });
}

async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) {
    if (res.status === 404) return null;          // "not found" is a valid empty state
    const err = new Error(`HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

// ── Label (drug_interactions field) ────────────────────────────────
export function fetchLabel(drug) {
  const key = `label:${drug.toLowerCase()}`;
  return cached(key, async () => {
    // Try brand name first, fall back to generic name
    let url = `${BASE}/drug/label.json?search=openfda.brand_name:"${encodeURIComponent(drug)}"&limit=1${keyParam()}`;
    let data = await fetchJSON(url);
    if (!data || !data.results?.length) {
      url = `${BASE}/drug/label.json?search=openfda.generic_name:"${encodeURIComponent(drug)}"&limit=1${keyParam()}`;
      data = await fetchJSON(url);
    }
    if (!data) return null;
    return data.results?.[0] ?? null;
  });
}

// ── Adverse Events (FAERS count) ────────────────────────────────────
export function fetchAdverseEvents(drug) {
  const key = `adverse:${drug.toLowerCase()}`;
  return cached(key, async () => {
    const url = `${BASE}/drug/event.json?search=patient.drug.medicinalproduct:"${encodeURIComponent(drug)}"&count=patient.reaction.reactionmeddrapt.exact&limit=10${keyParam()}`;
    const data = await fetchJSON(url);
    if (!data) return null;
    return data.results ?? null;
  });
}

// ── Drug Recalls ────────────────────────────────────────────────────
export function fetchRecalls(drug) {
  const key = `recalls:${drug.toLowerCase()}`;
  return cached(key, async () => {
    const url = `${BASE}/drug/enforcement.json?search=product_description:"${encodeURIComponent(drug)}"&limit=10${keyParam()}`;
    const data = await fetchJSON(url);
    if (!data) return null;
    return data.results ?? null;
  });
}

// ── Co-administration FAERS check ───────────────────────────────────
export function fetchCoAdmin(drugA, drugB) {
  const key = `coadmin:${[drugA, drugB].map(d => d.toLowerCase()).sort().join('+')}`;
  return cached(key, async () => {
    const url = `${BASE}/drug/event.json?search=patient.drug.medicinalproduct:"${encodeURIComponent(drugA)}"+AND+patient.drug.medicinalproduct:"${encodeURIComponent(drugB)}"&limit=1${keyParam()}`;
    const data = await fetchJSON(url);
    if (!data) return 0;
    return data.meta?.results?.total ?? 0;
  });
}

// ── Autocomplete (brand + generic names) ────────────────────────────
export async function fetchAutocomplete(query) {
  const key = `ac:${query.toLowerCase()}`;
  return cached(key, async () => {
    const [brandData, genericData] = await Promise.all([
      fetchJSON(`${BASE}/drug/label.json?search=openfda.brand_name:"${encodeURIComponent(query)}"&limit=5${keyParam()}`).catch(() => null),
      fetchJSON(`${BASE}/drug/label.json?search=openfda.generic_name:"${encodeURIComponent(query)}"&limit=5${keyParam()}`).catch(() => null),
    ]);

    const names = new Set();
    for (const data of [brandData, genericData]) {
      for (const r of data?.results ?? []) {
        for (const n of r.openfda?.brand_name ?? []) names.add(n);
        for (const n of r.openfda?.generic_name ?? []) names.add(n);
      }
    }
    return [...names].slice(0, 8);
  });
}
