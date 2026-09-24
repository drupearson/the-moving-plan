import { z } from "zod";

export const compatibilityLevelSchema = z.enum([
  "meets",
  "partial",
  "does_not_meet",
  "unknown",
]);

const driveMinutesSchema = z.number().nullable().optional();
const driveMilesSchema = z.number().nullable().optional();

export const householdCompatibilitySchema = z.object({
  householdId: z.string(),
  householdName: z.string(),
  workplaceCommute: compatibilityLevelSchema,
  schoolActivityProximity: compatibilityLevelSchema,
  budgetCompatibility: compatibilityLevelSchema,
  propertyAcreageCompatibility: compatibilityLevelSchema,
  overall: compatibilityLevelSchema,
  // Filled in server-side from real routing data after the model responds;
  // the model never sets these (kept optional so its raw output still validates).
  spouse1DriveMinutes: driveMinutesSchema,
  spouse1DriveMiles: driveMilesSchema,
  spouse2DriveMinutes: driveMinutesSchema,
  spouse2DriveMiles: driveMilesSchema,
});

export const householdBreakdownSchema = z.object({
  householdId: z.string(),
  householdName: z.string(),
  spouse1Commute: z.string(),
  spouse2Commute: z.string(),
  childrenNotes: z.string(),
  extendedFamilyProximity: z.string(),
  activityProximity: z.string(),
  budgetFit: z.string(),
  acreageFit: z.string(),
  requirementsMet: z.array(z.string()),
  requirementsCompromised: z.array(z.string()),
  summary: z.string(),
});

export const locationRecommendationSchema = z.object({
  rank: z.number().int().min(1).max(5),
  name: z.string(),
  cityArea: z.string(),
  county: z.string(),
  summary: z.string(),
  keyFactors: z.array(z.string()),
  housingConsiderations: z.string(),
  majorCompromises: z.array(z.string()),
  dataCaveat: z.string(),
  familyCompatibility: z.array(householdCompatibilitySchema),
  familyBreakdowns: z.array(householdBreakdownSchema),
  // Filled in server-side after geocoding; the model never sets these.
  coordinates: z.object({ lat: z.number(), lon: z.number() }).nullable().optional(),
  // True when the coordinates/commute numbers came from a city- or
  // county-level fallback rather than the specific named area.
  locationApproximate: z.boolean().nullable().optional(),
});

// This is the schema actually sent to Claude for structured-output
// constrained decoding (via zodOutputFormat). Keep it as lean as possible -
// Claude compiles it into a grammar, and a schema that's too large/complex
// (e.g. an array length range instead of an exact count, or extra
// server-only fields the model never touches) can be flatly rejected with
// "compiled grammar is too large". Anything the server fills in after the
// model responds - coordinates, drive times, midpoints - should live on the
// plain TypeScript type below instead, not in this zod schema, unless the
// model must be able to omit it (hence .nullable().optional() on those few).
export const analysisResultSchema = z.object({
  locations: z.array(locationRecommendationSchema).length(5),
  overallNotes: z.string(),
});

interface GeoPoint {
  lat: number;
  lon: number;
}

// Every spouse workplace pin for one household - a plain geocoding result,
// unrelated to the AI's location recommendations. Filled in server-side from
// the same geocoding already done for commute times; the model never sets
// this, so it's not part of analysisResultSchema above.
export interface HouseholdWorkplaces {
  householdId: string;
  householdName: string;
  spouse1Point: GeoPoint | null;
  spouse2Point: GeoPoint | null;
}

export type CompatibilityLevel = z.infer<typeof compatibilityLevelSchema>;
export type HouseholdCompatibility = z.infer<typeof householdCompatibilitySchema>;
export type HouseholdBreakdown = z.infer<typeof householdBreakdownSchema>;
export type LocationRecommendation = z.infer<typeof locationRecommendationSchema>;

// The model only produces analysisResultSchema's shape; everything below is
// added server-side afterward (see selectTopLocations / enrichWithRealCommutes)
// and was never part of the schema Claude had to satisfy.
export type AnalysisResult = z.infer<typeof analysisResultSchema> & {
  excludedForCommute?: number | null;
  // Every spouse workplace, grouped by household for pin coloring.
  householdWorkplaces?: HouseholdWorkplaces[] | null;
  // ONE combined midpoint across every spouse workplace from every
  // household - not one per household.
  combinedWorkplaceMidpoint?: GeoPoint | null;
};
