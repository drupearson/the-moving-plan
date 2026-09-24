import { Household } from "@/types/household";
import { createHousehold, MAX_HOUSEHOLDS } from "@/lib/household-factory";
import { HouseholdForm } from "./HouseholdForm";

interface HouseholdsSectionProps {
  households: Household[];
  onChange: (households: Household[]) => void;
}

export function HouseholdsSection({ households, onChange }: HouseholdsSectionProps) {
  const addHousehold = () => {
    if (households.length >= MAX_HOUSEHOLDS) return;
    onChange([...households, createHousehold(households.length + 1)]);
  };

  const updateHousehold = (id: string, updated: Household) => {
    onChange(households.map((h) => (h.id === id ? updated : h)));
  };

  const removeHousehold = (id: string) => {
    onChange(households.filter((h) => h.id !== id));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-stone-900">Family Profiles</h2>
          <p className="text-sm text-stone-500">
            Add each household planning to relocate together. Leave anything unknown marked as
            such — it won&apos;t block the analysis.
          </p>
        </div>
        <button
          type="button"
          onClick={addHousehold}
          disabled={households.length >= MAX_HOUSEHOLDS}
          className="shrink-0 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-stone-300"
        >
          + Add household
        </button>
      </div>

      {households.length === 0 && (
        <div className="rounded-2xl border border-dashed border-stone-300 bg-stone-50 px-6 py-12 text-center text-sm text-stone-500">
          No households yet. Add your first household to get started.
        </div>
      )}

      <div className="space-y-6">
        {households.map((household, i) => (
          <HouseholdForm
            key={household.id}
            household={household}
            index={i + 1}
            onChange={(updated) => updateHousehold(household.id, updated)}
            onRemove={() => removeHousehold(household.id)}
          />
        ))}
      </div>

      {households.length >= MAX_HOUSEHOLDS && (
        <p className="text-xs text-stone-400">
          Maximum of {MAX_HOUSEHOLDS} households for this initial version.
        </p>
      )}
    </div>
  );
}
