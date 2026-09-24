import { createClient } from "@supabase/supabase-js";

export interface GeoPoint {
  lat: number;
  lon: number;
}

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const USER_AGENT = "TheMovingPlan/1.0 (relocation planning demo app)";

// Downtown OKC. Used both to bias Nominatim's search and to reject false
// matches - a same-named place elsewhere in Oklahoma (e.g. "Choctaw" is also
// a county ~150mi southeast of the OKC suburb of the same name).
const OKC_CENTER: GeoPoint = { lat: 35.4676, lon: -97.5164 };
const MAX_METRO_MILES = 75;
// lon1,lat1(top),lon2,lat2(bottom) - soft bias box, not a hard filter.
const OKC_VIEWBOX = "-98.3,35.9,-96.7,34.7";

function haversineMiles(a: GeoPoint, b: GeoPoint): number {
  const R = 3958.8;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(h));
}

function isWithinMetro(point: GeoPoint): boolean {
  return haversineMiles(point, OKC_CENTER) <= MAX_METRO_MILES;
}

function getCacheClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

async function readCache(query: string): Promise<GeoPoint | null> {
  const supabase = getCacheClient();
  if (!supabase) return null;
  const { data } = await supabase
    .from("geocode_cache")
    .select("lat, lon")
    .eq("query", query)
    .maybeSingle();
  return data ? { lat: data.lat, lon: data.lon } : null;
}

async function writeCache(query: string, point: GeoPoint, displayName: string | null) {
  const supabase = getCacheClient();
  if (!supabase) return;
  await supabase
    .from("geocode_cache")
    .upsert({ query, lat: point.lat, lon: point.lon, display_name: displayName });
}

interface NominatimResult {
  lat: string;
  lon: string;
  importance?: number;
  display_name?: string;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// The public Nominatim instance rate-limits by IP; a 429 (or other transient
// failure) looks identical to "no results" unless handled separately, which
// would silently fall through to a worse candidate or a null result. Retry
// with increasing backoff before giving up on this candidate.
const RETRY_BACKOFF_MS = [1500, 3000, 5000];

async function queryNominatim(query: string): Promise<NominatimResult[]> {
  const params = new URLSearchParams({
    format: "jsonv2",
    limit: "5",
    countrycodes: "us",
    viewbox: OKC_VIEWBOX,
    q: query,
  });
  const url = `${NOMINATIM_URL}?${params.toString()}`;

  for (let attempt = 0; attempt <= RETRY_BACKOFF_MS.length; attempt++) {
    let res: Response;
    try {
      res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
    } catch (err) {
      console.error(`Nominatim fetch threw for "${query}":`, err);
      if (attempt === RETRY_BACKOFF_MS.length) return [];
      await sleep(RETRY_BACKOFF_MS[attempt]);
      continue;
    }
    if (res.ok) return (await res.json()) as NominatimResult[];
    if (res.status !== 429 && res.status < 500) {
      console.error(`Nominatim returned ${res.status} for "${query}" (not retrying)`);
      return [];
    }
    if (attempt === RETRY_BACKOFF_MS.length) {
      console.error(`Nominatim still failing (${res.status}) for "${query}" after retries`);
      return [];
    }
    await sleep(RETRY_BACKOFF_MS[attempt]);
  }
  return [];
}

// Nominatim's own ordering already weighs text relevance against the query,
// which matters more here than the "importance" field (a general-fame score
// that penalizes specific landmarks like a single office building) - but a
// same-named place far outside the metro is a wrong match regardless of rank,
// so skip past it to the next in-metro candidate. If NONE of this query's
// results are in-metro, still return the top-ranked one rather than nothing -
// a spouse can genuinely work outside the metro (or a workplace can sit right
// at the radius edge), and a real distant pin/commute beats a missing one.
// The viewbox bias above already does most of the work steering ambiguous,
// same-named queries (e.g. "Choctaw") toward the OKC-metro match first.
function pickBestResult(results: NominatimResult[]): NominatimResult | null {
  if (results.length === 0) return null;
  for (const result of results) {
    const point = { lat: parseFloat(result.lat), lon: parseFloat(result.lon) };
    if (isWithinMetro(point)) return result;
  }
  return results[0];
}

function extractParenthetical(text: string): string | null {
  const match = text.match(/\(([^)]+)\)/);
  return match ? match[1].trim() : null;
}

function stripParenthetical(text: string): string {
  return text.replace(/\([^)]*\)/g, "").trim();
}

const ABBREVIATIONS: [RegExp, string][] = [
  [/\bOU\b/gi, "University of Oklahoma"],
  [/\bOSU\b/gi, "Oklahoma State University"],
  [/\bUCO\b/gi, "University of Central Oklahoma"],
  [/\bAFB\b/gi, "Air Force Base"],
];

// Nominatim's plain-text search returns zero results (not just a bad match)
// when the query includes conversational filler - "near", "around", "the",
// trailing "area"/"side of the metro" - rather than ignoring those words, so
// strip them before searching. Also expand common local abbreviations it
// doesn't recognize (e.g. "OU" as a bare word never matches "University of
// Oklahoma").
function cleanDescriptiveText(text: string): string {
  let cleaned = text
    .replace(/^\s*(near|around|close to|next to|by)\s+/i, "")
    .replace(/^\s*the\s+/i, "")
    .replace(/\s+(area|vicinity|side of the metro|side)\s*$/i, "")
    .trim();
  for (const [pattern, replacement] of ABBREVIATIONS) {
    cleaned = cleaned.replace(pattern, replacement);
  }
  return cleaned.trim();
}

// Tries the parenthetical landmark/employer name before the full string - vague
// phrasing like "Downtown Oklahoma City" alone tends to match unrelated small
// businesses in OSM data, while a specific name like "Devon Energy Center" resolves cleanly.
export async function geocodeLocation(rawText: string): Promise<GeoPoint | null> {
  const text = rawText.trim();
  if (!text) return null;

  const withState = /oklahoma/i.test(text) ? text : `${text}, Oklahoma`;
  // Bump this prefix whenever the matching/filtering logic below changes, so
  // previously cached results from an older (possibly buggy) version aren't
  // silently reused instead of being re-resolved.
  const cacheKey = `v2:${withState.toLowerCase()}`;
  const cached = await readCache(cacheKey);
  if (cached) return cached;

  const candidates: string[] = [];
  const paren = extractParenthetical(text);
  if (paren) {
    candidates.push(/oklahoma/i.test(paren) ? paren : `${paren}, Oklahoma`);
  }
  candidates.push(withState);
  const stripped = stripParenthetical(text);
  if (stripped && stripped !== text) {
    candidates.push(/oklahoma/i.test(stripped) ? stripped : `${stripped}, Oklahoma`);
  }
  const cleaned = cleanDescriptiveText(stripped || text);
  if (cleaned && cleaned !== stripped && cleaned !== text) {
    candidates.push(/oklahoma/i.test(cleaned) ? cleaned : `${cleaned}, Oklahoma`);
  }

  for (const candidate of candidates) {
    try {
      const results = await queryNominatim(candidate);
      const best = pickBestResult(results);
      if (best) {
        const point = { lat: parseFloat(best.lat), lon: parseFloat(best.lon) };
        await writeCache(cacheKey, point, best.display_name ?? null);
        return point;
      }
    } catch {
      // try next candidate
    }
  }

  return null;
}
