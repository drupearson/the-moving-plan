import { Household } from "@/types/household";
import { AnalysisResult, CompatibilityLevel, LocationRecommendation } from "@/lib/anthropic/schema";
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
  const unique = [...new Set(queries.map((q) => q.trim().toLowerCase()).filter(Boolean))];
  const results = new Map<string, GeoPoint | null>();
  for (const query of unique) {
    results.set(query, await geocodeLocation(query));
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

// Recommended-area names are often descriptive ("South Oklahoma City (I-240
// corridor)") rather than a real OSM place, so try progressively broader
// fallbacks: the full description, a cleaned-up version, just the core city
// name (stripping directional words), and finally the county (a real
// administrative boundary, so it always resolves) - each broader step trades
// precision for a guaranteed point, which callers should treat as approximate.
async function resolveLocationPoint(loc: LocationRecommendation): Promise<ResolvedLocation | null> {
  const specific = [`${loc.cityArea}, ${loc.county}, Oklahoma`, `${loc.cityArea}, Oklahoma`];
  const normalized = normalizeAreaName(loc.cityArea);
  if (normalized && normalized !== loc.cityArea) specific.push(`${normalized}, Oklahoma`);

  for (const candidate of specific) {
    const point = await geocodeLocation(candidate);
    await sleep(1100);
    if (point) return { point, precise: true };
  }

  const coreCity = normalized.replace(DIRECTIONAL_PREFIX, "").trim();
  const broad = [];
  if (coreCity && coreCity !== normalized) broad.push(`${coreCity}, Oklahoma`);
  broad.push(`${loc.county}, Oklahoma`);

  for (const candidate of broad) {
    const point = await geocodeLocation(candidate);
    await sleep(1100);
    if (point) return { point, precise: false };
  }
  return null;
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
  for (const loc of result.locations) {
    resolvedLocations.push(await resolveLocationPoint(loc));
  }

  const spouseQueries = households.flatMap((h) => [
    h.spouse1Workplace.isUnknown ? "" : h.spouse1Workplace.location,
    h.spouse2Workplace.isUnknown ? "" : h.spouse2Workplace.location,
  ]);
  const geocoded = await geocodeAll(spouseQueries);
  const lookup = (text: string) => geocoded.get(text.trim().toLowerCase()) ?? null;

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

      const computedLevels = [spouse1.level, spouse2.level].filter(
        (l): l is CompatibilityLevel => l !== null,
      );
      const workplaceCommute =
        computedLevels.length > 0 ? combineLevels(computedLevels) : row.workplaceCommute;

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

  return { ...result, locations: enrichedLocations };
}
