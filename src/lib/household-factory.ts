import { ChildProfile, Household, LocationEntry } from "@/types/household";

export const MAX_HOUSEHOLDS = 5;
export const MAX_CHILDREN = 3;

function newId(): string {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);
}

export function createLocationEntry(label = ""): LocationEntry {
  return {
    id: newId(),
    label,
    location: "",
    isUnknown: false,
    importance: "essential",
  };
}

export function createChild(): ChildProfile {
  return {
    id: newId(),
    name: "",
    school: createLocationEntry("School"),
    workplace: createLocationEntry("Workplace"),
  };
}

export function createHousehold(index: number): Household {
  return {
    id: newId(),
    name: `Household ${index}`,
    spouse1Workplace: createLocationEntry("Spouse 1 workplace"),
    spouse2Workplace: createLocationEntry("Spouse 2 workplace"),
    children: [],
    extendedFamily: [],
    activities: [],
    housing: {
      budget: "",
      budgetUnknown: false,
      acreage: "",
      acreageUnknown: false,
      preferredCommute: "",
      preferredCommuteUnknown: false,
      maxCommute: "",
      maxCommuteUnknown: false,
      notes: "",
    },
  };
}
