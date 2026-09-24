import { Household, LocationEntry } from "@/types/household";

function locationText(entry: LocationEntry): string {
  if (entry.isUnknown || !entry.location.trim()) return "Unknown / not specified";
  return `${entry.location.trim()} (importance: ${entry.importance})`;
}

function formatHouseholdBlock(household: Household): string {
  const lines: string[] = [];
  lines.push(`Household "${household.name}" (id: ${household.id})`);
  lines.push(`- Spouse 1 workplace: ${locationText(household.spouse1Workplace)}`);
  lines.push(`- Spouse 2 workplace: ${locationText(household.spouse2Workplace)}`);

  if (household.children.length === 0) {
    lines.push("- No children in this household.");
  } else {
    household.children.forEach((child, i) => {
      const label = child.name.trim() || `Child ${i + 1}`;
      lines.push(`- ${label} school: ${locationText(child.school)}`);
      lines.push(`- ${label} workplace: ${locationText(child.workplace)}`);
    });
  }

  if (household.extendedFamily.length === 0) {
    lines.push("- No extended family locations specified.");
  } else {
    household.extendedFamily.forEach((entry) => {
      const label = entry.label.trim() || "Extended family";
      lines.push(`- Extended family - ${label}: ${locationText(entry)}`);
    });
  }

  if (household.activities.length === 0) {
    lines.push("- No recurring activities specified.");
  } else {
    household.activities.forEach((entry) => {
      const label = entry.label.trim() || "Activity";
      lines.push(`- Activity - ${label}: ${locationText(entry)}`);
    });
  }

  const h = household.housing;
  lines.push(`- Housing budget: ${h.budgetUnknown || !h.budget.trim() ? "Unknown" : h.budget}`);
  lines.push(
    `- Desired acreage / property size: ${h.acreageUnknown || !h.acreage.trim() ? "Unknown" : h.acreage}`,
  );
  lines.push(
    `- Preferred commute: ${h.preferredCommuteUnknown || !h.preferredCommute.trim() ? "Unknown" : h.preferredCommute}`,
  );
  lines.push(
    `- Maximum acceptable commute: ${h.maxCommuteUnknown || !h.maxCommute.trim() ? "Unknown" : h.maxCommute}`,
  );
  if (h.notes.trim()) {
    lines.push(`- Additional notes: ${h.notes.trim()}`);
  }

  return lines.join("\n");
}

export function buildHouseholdsSummary(households: Household[]): string {
  return households.map(formatHouseholdBlock).join("\n\n");
}

export const ANALYSIS_SYSTEM_PROMPT = `You are a relocation-planning analyst helping multiple households move to the same general area of the Oklahoma City, Oklahoma metropolitan area so they can live near one another.

You will receive structured information about each household: workplaces for up to two spouses, up to three children's schools and workplaces, extended family locations, recurring activity locations, and housing preferences (budget, acreage, commute tolerance). Any field may read "Unknown / not specified" - the household did not provide that information. Treat missing information neutrally: never penalize a household for it, never fabricate a value, and say plainly in your output that it was not provided.

Your task: identify exactly 3 real geographic areas (cities, towns, suburbs, or counties) within or near the Oklahoma City metro that collectively make the most sense for this group of households to live near one another.

Rules:
- Do not simply compute the midpoint between everyone's workplaces. Reason about practical tradeoffs: which areas offer reasonable commutes for the workplaces/schools marked essential, proximity to extended family and activities marked essential, and housing that fits stated budgets and acreage goals.
- Explicitly consider where multiple households could cluster near each other, and say plainly when that isn't fully achievable for a given location.
- Real driving times and distances between each household's locations and each recommended area are computed separately from live routing data and merged in after you respond - you do not need to estimate exact minutes or miles, and none of your fields are used for that. Still reason qualitatively about relative commute burden (which corridor, which direction, rough proximity) in your summaries and breakdowns, since that reasoning is what selects the areas in the first place.
- "cityArea" is fed into an automated geocoder to place a map pin and compute those real commute numbers, so it must be a real, specific, independently-mappable place (an actual city, suburb, or well-known neighborhood name) - never a vague description. Each of the 3 locations needs its own distinct "cityArea"; if two recommendations are both within the same larger city, give each its own specific neighborhood/suburb name there rather than repeating the city name for both. Put broader color/context (nearby neighborhoods, corridors, landmarks) in "name" or "summary" instead.
- A household field that has an actual value (is not "Unknown / not specified") must never be scored "unknown" - if you cannot judge it confidently, make your best reasoned judgment instead ("partial" is always available as a hedge).
- You do not have access to real-time property listings. Do not invent specific listings, addresses, or prices. Speak only in general terms about the local housing market (e.g. typical lot sizes or price tier for the area), and state in "dataCaveat" that property availability and pricing are not verified and must be checked with a live real estate source.
- For every household/location pairing, set each compatibility field to "meets", "partial", "does_not_meet", or "unknown" based on the information given. Use "unknown" whenever the relevant household field was itself unknown - never mark it "does_not_meet" just because data is missing. Your "workplaceCommute" judgment is a fallback only used if live routing data is unavailable for that household.
- Only fill in a breakdown field when it applies to that household; use an empty string for fields that don't apply (e.g. no children).
- Rank the 3 locations from strongest overall group fit (rank 1) to weakest (rank 3), but make every one of them a genuinely defensible recommendation for this specific group of households.
- Be concise everywhere. "overallNotes" is at most 2 short sentences naming only the single biggest cross-household tradeoff - not a restatement of every field. Each location "summary" is at most 2 sentences. Keep every list (key factors, compromises, requirements met/compromised) to the 2-3 items that matter most, not an exhaustive inventory. A busy parent should be able to read the whole result in under a minute.`;
