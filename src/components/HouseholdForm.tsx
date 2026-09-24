"use client";

import { useState } from "react";
import { ChildProfile, Household, LocationEntry } from "@/types/household";
import { createChild, createLocationEntry, MAX_CHILDREN } from "@/lib/household-factory";
import { LocationField } from "./LocationField";
import { RepeatableLocationList } from "./RepeatableLocationList";

interface HouseholdFormProps {
  household: Household;
  index: number;
  onChange: (household: Household) => void;
  onRemove: () => void;
}

type ListKey = "extendedFamily" | "activities";

export function HouseholdForm({ household, index, onChange, onRemove }: HouseholdFormProps) {
  const [expanded, setExpanded] = useState(true);

  const update = (patch: Partial<Household>) => onChange({ ...household, ...patch });

  const updateChild = (id: string, patch: Partial<ChildProfile>) => {
    update({ children: household.children.map((c) => (c.id === id ? { ...c, ...patch } : c)) });
  };

  const addChild = () => {
    if (household.children.length >= MAX_CHILDREN) return;
    update({ children: [...household.children, createChild()] });
  };

  const removeChild = (id: string) => {
    update({ children: household.children.filter((c) => c.id !== id) });
  };

  const addListEntry = (key: ListKey) => {
    update({ [key]: [...household[key], createLocationEntry()] } as Partial<Household>);
  };

  const changeListEntry = (key: ListKey, id: string, entry: LocationEntry) => {
    update({ [key]: household[key].map((e) => (e.id === id ? entry : e)) } as Partial<Household>);
  };

  const removeListEntry = (key: ListKey, id: string) => {
    update({ [key]: household[key].filter((e) => e.id !== id) } as Partial<Household>);
  };

  return (
    <section className="rounded-2xl border border-stone-200 bg-white shadow-sm">
      <header className="flex items-center gap-3 border-b border-stone-100 px-5 py-4">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-xs font-semibold text-emerald-700">
          {index}
        </span>
        <input
          type="text"
          value={household.name}
          onChange={(e) => update({ name: e.target.value })}
          className="flex-1 truncate border-none bg-transparent text-base font-semibold text-stone-900 focus:outline-none"
        />
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="shrink-0 text-xs font-medium text-stone-500 hover:text-stone-800"
        >
          {expanded ? "Collapse" : "Expand"}
        </button>
        <button
          type="button"
          onClick={onRemove}
          className="shrink-0 text-xs font-medium text-stone-400 hover:text-red-600"
        >
          Remove
        </button>
      </header>

      {expanded && (
        <div className="space-y-8 px-5 py-6">
          <div className="grid gap-5 sm:grid-cols-2">
            <LocationField
              entry={household.spouse1Workplace}
              label="Spouse 1 workplace"
              placeholder="Employer name or address"
              onChange={(entry) => update({ spouse1Workplace: entry })}
            />
            <LocationField
              entry={household.spouse2Workplace}
              label="Spouse 2 workplace"
              placeholder="Employer name or address"
              onChange={(entry) => update({ spouse2Workplace: entry })}
            />
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-stone-800">Children (optional)</h4>
              {household.children.length < MAX_CHILDREN && (
                <button
                  type="button"
                  onClick={addChild}
                  className="text-xs font-medium text-emerald-700 hover:text-emerald-800"
                >
                  + Add child
                </button>
              )}
            </div>
            {household.children.length === 0 && (
              <p className="text-xs text-stone-400">No children added.</p>
            )}
            <div className="space-y-4">
              {household.children.map((child, i) => (
                <div key={child.id} className="rounded-lg border border-stone-200 p-3">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <input
                      type="text"
                      value={child.name}
                      onChange={(e) => updateChild(child.id, { name: e.target.value })}
                      placeholder={`Child ${i + 1} name (optional)`}
                      className="flex-1 rounded-md border border-stone-200 px-2 py-1 text-sm text-stone-800 placeholder:text-stone-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                    <button
                      type="button"
                      onClick={() => removeChild(child.id)}
                      className="shrink-0 text-xs text-stone-400 hover:text-red-600"
                    >
                      Remove
                    </button>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <LocationField
                      entry={child.school}
                      label="School"
                      placeholder="School name or address"
                      onChange={(entry) => updateChild(child.id, { school: entry })}
                    />
                    <LocationField
                      entry={child.workplace}
                      label="Workplace"
                      placeholder="Employer name or address (if applicable)"
                      onChange={(entry) => updateChild(child.id, { workplace: entry })}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <RepeatableLocationList
            title="Extended family"
            entries={household.extendedFamily}
            addLabel="Add extended family"
            labelPlaceholder="e.g. Grandparents, siblings"
            locationPlaceholder="City or address"
            onAdd={() => addListEntry("extendedFamily")}
            onChange={(id, entry) => changeListEntry("extendedFamily", id, entry)}
            onRemove={(id) => removeListEntry("extendedFamily", id)}
          />

          <RepeatableLocationList
            title="Recurring activities"
            entries={household.activities}
            addLabel="Add activity"
            labelPlaceholder="e.g. Church, soccer, dance"
            locationPlaceholder="City or address"
            onAdd={() => addListEntry("activities")}
            onChange={(id, entry) => changeListEntry("activities", id, entry)}
            onRemove={(id) => removeListEntry("activities", id)}
          />

          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-stone-800">Housing preferences</h4>
            <div className="grid gap-4 sm:grid-cols-2">
              <TextPreference
                label="Estimated housing budget"
                value={household.housing.budget}
                unknown={household.housing.budgetUnknown}
                placeholder="e.g. $350,000–$450,000"
                onChange={(budget) => update({ housing: { ...household.housing, budget } })}
                onUnknownChange={(budgetUnknown) =>
                  update({
                    housing: {
                      ...household.housing,
                      budgetUnknown,
                      budget: budgetUnknown ? "" : household.housing.budget,
                    },
                  })
                }
              />
              <TextPreference
                label="Desired property size / acreage"
                value={household.housing.acreage}
                unknown={household.housing.acreageUnknown}
                placeholder="e.g. 5+ acres"
                onChange={(acreage) => update({ housing: { ...household.housing, acreage } })}
                onUnknownChange={(acreageUnknown) =>
                  update({
                    housing: {
                      ...household.housing,
                      acreageUnknown,
                      acreage: acreageUnknown ? "" : household.housing.acreage,
                    },
                  })
                }
              />
              <TextPreference
                label="Preferred commute time"
                value={household.housing.preferredCommute}
                unknown={household.housing.preferredCommuteUnknown}
                placeholder="e.g. 20 minutes"
                onChange={(preferredCommute) =>
                  update({ housing: { ...household.housing, preferredCommute } })
                }
                onUnknownChange={(preferredCommuteUnknown) =>
                  update({
                    housing: {
                      ...household.housing,
                      preferredCommuteUnknown,
                      preferredCommute: preferredCommuteUnknown ? "" : household.housing.preferredCommute,
                    },
                  })
                }
              />
              <TextPreference
                label="Maximum acceptable commute"
                value={household.housing.maxCommute}
                unknown={household.housing.maxCommuteUnknown}
                placeholder="e.g. 45 minutes"
                onChange={(maxCommute) => update({ housing: { ...household.housing, maxCommute } })}
                onUnknownChange={(maxCommuteUnknown) =>
                  update({
                    housing: {
                      ...household.housing,
                      maxCommuteUnknown,
                      maxCommute: maxCommuteUnknown ? "" : household.housing.maxCommute,
                    },
                  })
                }
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-stone-700">
                Additional preferences or requirements
              </label>
              <textarea
                value={household.housing.notes}
                onChange={(e) => update({ housing: { ...household.housing, notes: e.target.value } })}
                rows={2}
                placeholder="Anything else that matters for this household"
                className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 placeholder:text-stone-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

interface TextPreferenceProps {
  label: string;
  value: string;
  unknown: boolean;
  placeholder: string;
  onChange: (value: string) => void;
  onUnknownChange: (unknown: boolean) => void;
}

function TextPreference({
  label,
  value,
  unknown,
  placeholder,
  onChange,
  onUnknownChange,
}: TextPreferenceProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-stone-700">{label}</label>
        <label className="flex items-center gap-1.5 text-xs text-stone-500">
          <input
            type="checkbox"
            checked={unknown}
            onChange={(e) => onUnknownChange(e.target.checked)}
            className="h-3.5 w-3.5 rounded border-stone-300 text-emerald-600 focus:ring-emerald-500"
          />
          Unknown / N/A
        </label>
      </div>
      <input
        type="text"
        value={value}
        disabled={unknown}
        onChange={(e) => onChange(e.target.value)}
        placeholder={unknown ? "Marked unknown" : placeholder}
        className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 placeholder:text-stone-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:bg-stone-100 disabled:text-stone-400"
      />
    </div>
  );
}
