import { z } from "zod";

export const compatibilityLevelSchema = z.enum([
  "meets",
  "partial",
  "does_not_meet",
  "unknown",
]);

export const householdCompatibilitySchema = z.object({
  householdId: z.string(),
  householdName: z.string(),
  workplaceCommute: compatibilityLevelSchema,
  schoolActivityProximity: compatibilityLevelSchema,
  budgetCompatibility: compatibilityLevelSchema,
  propertyAcreageCompatibility: compatibilityLevelSchema,
  overall: compatibilityLevelSchema,
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
});

export const analysisResultSchema = z.object({
  locations: z.array(locationRecommendationSchema).length(5),
  overallNotes: z.string(),
});

export type CompatibilityLevel = z.infer<typeof compatibilityLevelSchema>;
export type HouseholdCompatibility = z.infer<typeof householdCompatibilitySchema>;
export type HouseholdBreakdown = z.infer<typeof householdBreakdownSchema>;
export type LocationRecommendation = z.infer<typeof locationRecommendationSchema>;
export type AnalysisResult = z.infer<typeof analysisResultSchema>;
