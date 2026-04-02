// OpenFDA API — no key required for public access (240 req/min).
// To increase rate limits, request a key at: https://open.fda.gov/apis/authentication/
// Then replace the empty string below with your key and append &api_key=YOUR_API_KEY to each request.
export const YOUR_API_KEY = '';

const BASE = 'https://api.fda.gov';

function keyParam() {
  return YOUR_API_KEY ? `&api_key=${encodeURIComponent(YOUR_API_KEY)}` : '';
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
export async function fetchLabel(drug) {
  const url = `${BASE}/drug/label.json?search=openfda.brand_name:"${encodeURIComponent(drug)}"&limit=1${keyParam()}`;
  const data = await fetchJSON(url);
  if (!data) return null;
  return data.results?.[0] ?? null;
}

// ── Adverse Events (FAERS count) ────────────────────────────────────
export async function fetchAdverseEvents(drug) {
  const url = `${BASE}/drug/event.json?search=patient.drug.medicinalproduct:"${encodeURIComponent(drug)}"&count=patient.reaction.reactionmeddrapt.exact&limit=10${keyParam()}`;
  const data = await fetchJSON(url);
  if (!data) return null;
  return data.results ?? null;
}

// ── Drug Recalls ────────────────────────────────────────────────────
export async function fetchRecalls(drug) {
  const url = `${BASE}/drug/enforcement.json?search=product_description:"${encodeURIComponent(drug)}"&limit=10${keyParam()}`;
  const data = await fetchJSON(url);
  if (!data) return null;
  return data.results ?? null;
}

// ── Co-administration FAERS check ───────────────────────────────────
export async function fetchCoAdmin(drugA, drugB) {
  const url = `${BASE}/drug/event.json?search=patient.drug.medicinalproduct:"${encodeURIComponent(drugA)}"+AND+patient.drug.medicinalproduct:"${encodeURIComponent(drugB)}"&limit=1${keyParam()}`;
  const data = await fetchJSON(url);
  if (!data) return 0;
  return data.meta?.results?.total ?? 0;
}

// ── Autocomplete (brand + generic names) ────────────────────────────
export async function fetchAutocomplete(query) {
  const url = `${BASE}/drug/label.json?search=openfda.brand_name:"${encodeURIComponent(query)}"&limit=5${keyParam()}`;
  const data = await fetchJSON(url);
  if (!data) return [];

  const names = new Set();
  for (const r of data.results ?? []) {
    for (const n of r.openfda?.brand_name ?? []) names.add(n);
    for (const n of r.openfda?.generic_name ?? []) names.add(n);
  }
  return [...names].slice(0, 8);
}
