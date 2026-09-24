import { Household } from "@/types/household";
import {
  AnalysisResult,
  CompatibilityLevel,
  HouseholdCompatibility,
  HouseholdWorkplaces,
  LocationRecommendation,
} from "@/lib/anthropic/schema";
import { geocodeLocation, GeoPoint } from "./geocode";
import { getDrivingInfo, DriveInfo } from "./route";

const SEVERITY: Record<CompatibilityLevel, number> = {
  meets: 0,
  partial: 1,
  does_not_meet: 2,
  unknown: -1,
};

function combineLevels(levels: CompatibilityLevel[]): CompatibilityLevel {
  const known = levels.filter((l) => l !== "unknown");
  if (known.length === 0) return "unknown";
  return known.reduce((worst, l) => (SEVERITY[l] > SEVERITY[worst] ? l : worst));
}

function parseMinutes(text: string): number | null {
  const match = text.match(/\d+/);
  return match ? parseInt(match[0], 10) : null;
}

function deriveLevel(
  minutes: number,
  preferred: number | null,
  max: number | null,
): CompatibilityLevel {
  if (preferred !== null) {
    if (minutes <= preferred) return "meets";
    if (max !== null) return minutes <= max ? "partial" : "does_not_meet";
    return minutes <= preferred * 2 ? "partial" : "does_not_meet";
  }
  if (max !== null) {
    // No preferred time given, just a ceiling - comfortably under it still
    // counts as "meets" rather than never earning better than "partial".
    if (minutes <= max * 0.6) return "meets";
    return minutes <= max ? "partial" : "does_not_meet";
  }
  if (minutes <= 20) return "meets";
  if (minutes <= 40) return "partial";
  return "does_not_meet";
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// The model occasionally emits the same household twice within one location's
// arrays; keep only the first occurrence so the UI doesn't render duplicates.
function dedupeByHouseholdId<T extends { householdId: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.householdId)) return false;
    seen.add(item.householdId);
    return true;
  });
}

/**
 * Geocodes every unique location string sequentially (Nominatim's public
 * server expects roughly one request per second) and returns a lookup by the
 * lowercased, trimmed query string. Cache hits (via geocodeLocation's own
 * Supabase cache) don't need the delay, but we can't tell in advance which
 * calls will hit it, so we pace every call the same way.
 */
async function geocodeAll(queries: string[]): Promise<Map<string, GeoPoint | null>> {
  // Lowercased text is only for map-key dedup (matching how callers look
  // results up); the ORIGINAL casing must reach the geocoder itself, or
  // abbreviation expansion ("OU" -> "University of Oklahoma") silently
  // breaks since it's a case-sensitive match against a now-lowercased string.
  const byKey = new Map<string, string>();
  for (const q of queries) {
    const trimmed = q.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (!byKey.has(key)) byKey.set(key, trimmed);
  }
  const results = new Map<string, GeoPoint | null>();
  for (const [key, original] of byKey) {
    results.set(key, await geocodeLocation(original));
    await sleep(1100);
  }
  return results;
}

const DIRECTIONAL_PREFIX = /^(far )?(north|south|east|west|northeast|northwest|southeast|southwest)(ern)?\s+/i;

function normalizeAreaName(text: string): string {
  return text
    .replace(/\([^)]*\)/g, "")
    .replace(/\bOKC\b/gi, "Oklahoma City")
    .trim();
}

export interface ResolvedLocation {
  point: GeoPoint;
  /** False once we've fallen back past a specific-area match to a whole city or county centroid. */
  precise: boolean;
}

function segmentsOf(text: string): string[] {
  return text
    .split(/\/|,/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

// The model sometimes reuses the same broad `cityArea` (e.g. "Oklahoma City")
// for two different recommendations, distinguishing them only in the more
// descriptive `name` field (e.g. "Central OKC (Crown Heights / Mesta Park)"
// vs. "Warr Acres / Bethany / NW OKC") - geocoding cityArea alone would then
// collapse both onto the same point. So try the specific neighborhood names
// inside `name` (its parenthetical first, then its own segments) before
// falling back to cityArea, and only fall back to the county centroid - a
// real administrative boundary that always resolves - as an absolute last
// resort. Each broader step trades precision for a guaranteed point, which
// callers should treat as approximate.
const MIN_SEPARATION_DEG = 0.02; // ~1.4 miles - keeps the 3 recommendations visibly distinct

function isTooClose(point: GeoPoint, avoid: GeoPoint[]): boolean {
  return avoid.some(
    (p) => Math.abs(p.lat - point.lat) < MIN_SEPARATION_DEG && Math.abs(p.lon - point.lon) < MIN_SEPARATION_DEG,
  );
}

async function resolveLocationPoint(
  loc: LocationRecommendation,
  avoid: GeoPoint[],
): Promise<ResolvedLocation | null> {
  const specific: string[] = [];

  const nameParen = loc.name.match(/\(([^)]+)\)/)?.[1];
  if (nameParen) {
    for (const segment of segmentsOf(nameParen)) {
      specific.push(`${segment.replace(/\barea\b/gi, "").trim()}, Oklahoma`);
    }
  }
  const nameWithoutParen = loc.name.replace(/\([^)]*\)/g, "").trim();
  for (const segment of segmentsOf(nameWithoutParen)) {
    if (segment.length > 2) specific.push(`${segment}, Oklahoma`);
  }

  specific.push(`${loc.cityArea}, ${loc.county}, Oklahoma`, `${loc.cityArea}, Oklahoma`);
  const normalized = normalizeAreaName(loc.cityArea);
  if (normalized && normalized !== loc.cityArea) specific.push(`${normalized}, Oklahoma`);
  for (const segment of segmentsOf(normalized)) {
    if (segment !== normalized) specific.push(`${segment}, Oklahoma`);
  }

  // Track the first point that resolves at all, even if it collides with an
  // already-placed location - better to show a marker (the map nudges
  // overlapping pins apart visually) than to show none.
  let fallback: ResolvedLocation | null = null;

  for (const candidate of specific) {
    const point = await geocodeLocation(candidate);
    await sleep(1100);
    if (!point) continue;
    if (!fallback) fallback = { point, precise: true };
    if (!isTooClose(point, avoid)) return { point, precise: true };
  }

  const coreCity = normalized.replace(DIRECTIONAL_PREFIX, "").trim();
  const broad = [];
  if (coreCity && coreCity !== normalized) broad.push(`${coreCity}, Oklahoma`);
  broad.push(`${loc.county}, Oklahoma`);

  for (const candidate of broad) {
    const point = await geocodeLocation(candidate);
    await sleep(1100);
    if (!point) continue;
    if (!fallback) fallback = { point, precise: false };
    if (!isTooClose(point, avoid)) return { point, precise: false };
  }
  return fallback;
}

interface SpouseCommute {
  drive: DriveInfo | null;
  level: CompatibilityLevel | null;
}

export async function enrichWithRealCommutes(
  households: Household[],
  result: AnalysisResult,
): Promise<AnalysisResult> {
  const resolvedLocations: (ResolvedLocation | null)[] = [];
  const acceptedPoints: GeoPoint[] = [];
  for (const loc of result.locations) {
    const resolved = await resolveLocationPoint(loc, acceptedPoints);
    resolvedLocations.push(resolved);
    if (resolved) acceptedPoints.push(resolved.point);
  }

  const spouseQueries = households.flatMap((h) => [
    h.spouse1Workplace.isUnknown ? "" : h.spouse1Workplace.location,
    h.spouse2Workplace.isUnknown ? "" : h.spouse2Workplace.location,
  ]);
  const geocoded = await geocodeAll(spouseQueries);
  const lookup = (text: string) => geocoded.get(text.trim().toLowerCase()) ?? null;

  // Every spouse workplace pin, grouped by household for coloring - unrelated
  // to the AI's location recommendations, just reuses the geocoding already
  // done above for commute times.
  const householdWorkplaces: HouseholdWorkplaces[] = households.map((household) => {
    const spouse1Point = household.spouse1Workplace.isUnknown
      ? null
      : lookup(household.spouse1Workplace.location);
    const spouse2Point = household.spouse2Workplace.isUnknown
      ? null
      : lookup(household.spouse2Workplace.location);
    return { householdId: household.id, householdName: household.name, spouse1Point, spouse2Point };
  });

  // ONE combined midpoint across every spouse workplace from every household
  // - not one per household.
  const allSpousePoints: GeoPoint[] = householdWorkplaces.flatMap((hh) =>
    [hh.spouse1Point, hh.spouse2Point].filter((p): p is GeoPoint => p !== null),
  );
  const combinedWorkplaceMidpoint: GeoPoint | null =
    allSpousePoints.length > 0
      ? {
          lat: allSpousePoints.reduce((sum, p) => sum + p.lat, 0) / allSpousePoints.length,
          lon: allSpousePoints.reduce((sum, p) => sum + p.lon, 0) / allSpousePoints.length,
        }
      : null;

  const householdsById = new Map(households.map((h) => [h.id, h]));

  const enrichedLocations: LocationRecommendation[] = [];
  for (let i = 0; i < result.locations.length; i++) {
    const location = result.locations[i];
    const locationPoint = resolvedLocations[i]?.point ?? null;
    const locationApproximate = resolvedLocations[i] ? !resolvedLocations[i]!.precise : null;
    const dedupedCompatibility = dedupeByHouseholdId(location.familyCompatibility);
    const dedupedBreakdowns = dedupeByHouseholdId(location.familyBreakdowns);

    const enrichedCompatibility = [];
    for (const row of dedupedCompatibility) {
      const household = householdsById.get(row.householdId);
      if (!household || !locationPoint) {
        enrichedCompatibility.push(row);
        continue;
      }

      const preferred = parseMinutes(household.housing.preferredCommute);
      const max = parseMinutes(household.housing.maxCommute);

      const driveFor = async (spouse: Household["spouse1Workplace"]): Promise<SpouseCommute> => {
        if (spouse.isUnknown) return { drive: null, level: "unknown" };
        const point = lookup(spouse.location);
        if (!point) return { drive: null, level: null };
        const drive = await getDrivingInfo(point, locationPoint);
        if (!drive) return { drive: null, level: null };
        return { drive, level: deriveLevel(drive.minutes, preferred, max) };
      };

      const spouse1 = await driveFor(household.spouse1Workplace);
      const spouse2 = await driveFor(household.spouse2Workplace);

      // Only override the model's own guess once we have at least one spouse
      // with real, computed drive data - a spouse that's genuinely blank
      // ("Unknown / N/A") contributes "unknown" too, but must not be allowed
      // to drag the whole household to "unknown" on its own when the OTHER
      // spouse's location WAS provided and simply failed to geocode. In that
      // case there's no real data at all, so keep the model's guess as-is
      // rather than claiming "unknown" for a field that had a value.
      const realLevels = [spouse1, spouse2]
        .filter((s) => s.drive !== null)
        .map((s) => s.level)
        .filter((l): l is CompatibilityLevel => l !== null);
      const blankLevels: CompatibilityLevel[] = [spouse1, spouse2]
        .filter((s) => s.drive === null && s.level === "unknown")
        .map(() => "unknown");
      const workplaceCommute =
        realLevels.length > 0 ? combineLevels([...realLevels, ...blankLevels]) : row.workplaceCommute;

      enrichedCompatibility.push({
        ...row,
        workplaceCommute,
        spouse1DriveMinutes: spouse1.drive?.minutes ?? null,
        spouse1DriveMiles: spouse1.drive?.miles ?? null,
        spouse2DriveMinutes: spouse2.drive?.minutes ?? null,
        spouse2DriveMiles: spouse2.drive?.miles ?? null,
      });
    }

    enrichedLocations.push({
      ...location,
      coordinates: locationPoint,
      locationApproximate,
      familyCompatibility: enrichedCompatibility,
      familyBreakdowns: dedupedBreakdowns,
    });
  }

  return { ...result, locations: enrichedLocations, householdWorkplaces, combinedWorkplaceMidpoint };
}

function exceedsHouseholdMax(row: HouseholdCompatibility, household: Household): boolean {
  const max = parseMinutes(household.housing.maxCommute);
  if (max === null) return false; // no stated cap - nothing to violate
  return (
    (row.spouse1DriveMinutes != null && row.spouse1DriveMinutes > max) ||
    (row.spouse2DriveMinutes != null && row.spouse2DriveMinutes > max)
  );
}

// Drops any location where a real (not AI-guessed) drive time exceeds a
// household's stated maximum commute for that household, then picks up to 3
// of the survivors - preferring locations in different cities before
// resorting to a second one in the same city, so "top 3" doesn't collapse
// into 3 neighborhoods of a single town.
export function selectTopLocations(households: Household[], result: AnalysisResult): AnalysisResult {
  const householdsById = new Map(households.map((h) => [h.id, h]));

  const violatesSomeonesMax = (loc: LocationRecommendation) =>
    loc.familyCompatibility.some((row) => {
      const household = householdsById.get(row.householdId);
      return household ? exceedsHouseholdMax(row, household) : false;
    });

  const sorted = [...result.locations].sort((a, b) => a.rank - b.rank);
  const compliant = sorted.filter((loc) => !violatesSomeonesMax(loc));
  const excludedForCommute = sorted.length - compliant.length;

  const cityKey = (loc: LocationRecommendation) => loc.cityArea.trim().toLowerCase();
  const picked: LocationRecommendation[] = [];
  const usedCities = new Set<string>();

  for (const loc of compliant) {
    if (picked.length >= 3) break;
    if (!usedCities.has(cityKey(loc))) {
      picked.push(loc);
      usedCities.add(cityKey(loc));
    }
  }
  if (picked.length < 3) {
    for (const loc of compliant) {
      if (picked.length >= 3) break;
      if (!picked.includes(loc)) picked.push(loc);
    }
  }

  return {
    ...result,
    locations: picked.map((loc, i) => ({ ...loc, rank: i + 1 })),
    excludedForCommute,
  };
}
