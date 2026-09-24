export type Importance = "essential" | "preference";

export interface LocationEntry {
  id: string;
  label: string;
  location: string;
  isUnknown: boolean;
  importance: Importance;
}

export interface ChildProfile {
  id: string;
  name: string;
  school: LocationEntry;
  workplace: LocationEntry;
}

export interface HousingPreferences {
  budget: string;
  budgetUnknown: boolean;
  acreage: string;
  acreageUnknown: boolean;
  preferredCommute: string;
  preferredCommuteUnknown: boolean;
  maxCommute: string;
  maxCommuteUnknown: boolean;
  notes: string;
}

export interface Household {
  id: string;
  name: string;
  spouse1Workplace: LocationEntry;
  spouse2Workplace: LocationEntry;
  children: ChildProfile[];
  extendedFamily: LocationEntry[];
  activities: LocationEntry[];
  housing: HousingPreferences;
}
