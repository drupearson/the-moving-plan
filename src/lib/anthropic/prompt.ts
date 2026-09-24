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

Your task: identify exactly 5 real geographic areas (cities, towns, suburbs, or counties) within or near the Oklahoma City metro that collectively make the most sense for this group of households to live near one another.

Rules:
- Do not simply compute the midpoint between everyone's workplaces. Reason about practical tradeoffs: which areas offer reasonable commutes for the workplaces/schools marked essential, proximity to extended family and activities marked essential, and housing that fits stated budgets and acreage goals.
- Explicitly consider where multiple households could cluster near each other, and say plainly when that isn't fully achievable for a given location.
- You do not have access to a live mapping/travel-time API or real-time property listings in this request. Do not invent exact drive times, mileages, or specific property listings or prices. Reason qualitatively from general knowledge of Oklahoma City-area geography (relative direction and rough proximity between named suburbs and highways), and state in "dataCaveat" that travel times and listings are not verified and should be confirmed with a live mapping tool or real estate source before deciding.
- For every household/location pairing, set each compatibility field to "meets", "partial", "does_not_meet", or "unknown" based only on the information given and qualitative geographic reasoning. Use "unknown" whenever the relevant household field was itself unknown - never mark it "does_not_meet" just because data is missing.
- Only fill in a breakdown field when it applies to that household; use an empty string for fields that don't apply (e.g. no children).
- Rank the 5 locations from strongest overall group fit (rank 1) to weakest (rank 5), but make every one of them a genuinely defensible recommendation for this specific group of households.`;
