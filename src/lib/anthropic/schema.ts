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

export const analysisResultSchema = z.object({
  // The model is asked for 5 candidates (tolerate a few more/fewer so a minor
  // miscount doesn't fail the whole request); the server then drops any that
  // violate a household's stated maximum commute and returns up to 3 that pass.
  locations: z.array(locationRecommendationSchema).min(3).max(7),
  overallNotes: z.string(),
  // Filled in server-side when candidates were dropped for exceeding a
  // household's stated maximum commute; the model never sets this.
  excludedForCommute: z.number().int().nullable().optional(),
});

export type CompatibilityLevel = z.infer<typeof compatibilityLevelSchema>;
export type HouseholdCompatibility = z.infer<typeof householdCompatibilitySchema>;
export type HouseholdBreakdown = z.infer<typeof householdBreakdownSchema>;
export type LocationRecommendation = z.infer<typeof locationRecommendationSchema>;
export type AnalysisResult = z.infer<typeof analysisResultSchema>;
