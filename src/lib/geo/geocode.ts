import { createClient } from "@supabase/supabase-js";

export interface GeoPoint {
  lat: number;
  lon: number;
}

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const USER_AGENT = "TheMovingPlan/1.0 (relocation planning demo app)";

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

async function queryNominatim(query: string): Promise<NominatimResult[]> {
  const params = new URLSearchParams({
    format: "jsonv2",
    limit: "5",
    countrycodes: "us",
    q: query,
  });
  const res = await fetch(`${NOMINATIM_URL}?${params.toString()}`, {
    headers: { "User-Agent": USER_AGENT },
  });
  if (!res.ok) return [];
  return (await res.json()) as NominatimResult[];
}

function pickBestResult(results: NominatimResult[]): NominatimResult | null {
  // Nominatim's own ordering already weighs text relevance against the query,
  // which matters more here than the "importance" field (a general-fame score
  // that penalizes specific landmarks like a single office building).
  return results.length > 0 ? results[0] : null;
}

function extractParenthetical(text: string): string | null {
  const match = text.match(/\(([^)]+)\)/);
  return match ? match[1].trim() : null;
}

function stripParenthetical(text: string): string {
  return text.replace(/\([^)]*\)/g, "").trim();
}

// Tries the parenthetical landmark/employer name before the full string - vague
// phrasing like "Downtown Oklahoma City" alone tends to match unrelated small
// businesses in OSM data, while a specific name like "Devon Energy Center" resolves cleanly.
export async function geocodeLocation(rawText: string): Promise<GeoPoint | null> {
  const text = rawText.trim();
  if (!text) return null;

  const withState = /oklahoma/i.test(text) ? text : `${text}, Oklahoma`;
  const cached = await readCache(withState.toLowerCase());
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

  for (const candidate of candidates) {
    try {
      const results = await queryNominatim(candidate);
      const best = pickBestResult(results);
      if (best) {
        const point = { lat: parseFloat(best.lat), lon: parseFloat(best.lon) };
        await writeCache(withState.toLowerCase(), point, best.display_name ?? null);
        return point;
      }
    } catch {
      // try next candidate
    }
  }

  return null;
}
