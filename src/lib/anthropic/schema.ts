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
  requirementsMet: z.array(z.string()).max(5),
  requirementsCompromised: z.array(z.string()).max(5),
  summary: z.string().max(240),
});

export const locationRecommendationSchema = z.object({
  rank: z.number().int().min(1).max(3),
  name: z.string(),
  cityArea: z.string(),
  county: z.string(),
  summary: z.string().max(280),
  keyFactors: z.array(z.string()).max(4),
  housingConsiderations: z.string().max(280),
  majorCompromises: z.array(z.string()).max(3),
  dataCaveat: z.string().max(200),
  familyCompatibility: z.array(householdCompatibilitySchema),
  familyBreakdowns: z.array(householdBreakdownSchema),
  // Filled in server-side after geocoding; the model never sets these.
  coordinates: z.object({ lat: z.number(), lon: z.number() }).nullable().optional(),
  // True when the coordinates/commute numbers came from a city- or
  // county-level fallback rather than the specific named area.
  locationApproximate: z.boolean().nullable().optional(),
});

export const analysisResultSchema = z.object({
  locations: z.array(locationRecommendationSchema).length(3),
  overallNotes: z.string().max(360),
});

export type CompatibilityLevel = z.infer<typeof compatibilityLevelSchema>;
export type HouseholdCompatibility = z.infer<typeof householdCompatibilitySchema>;
export type HouseholdBreakdown = z.infer<typeof householdBreakdownSchema>;
export type LocationRecommendation = z.infer<typeof locationRecommendationSchema>;
export type AnalysisResult = z.infer<typeof analysisResultSchema>;
