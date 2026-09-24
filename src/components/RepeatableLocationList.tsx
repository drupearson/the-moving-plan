import { LocationEntry } from "@/types/household";
import { LocationField } from "./LocationField";

interface RepeatableLocationListProps {
  title: string;
  entries: LocationEntry[];
  addLabel: string;
  labelPlaceholder: string;
  locationPlaceholder?: string;
  onAdd: () => void;
  onChange: (id: string, entry: LocationEntry) => void;
  onRemove: (id: string) => void;
}

export function RepeatableLocationList({
  title,
  entries,
  addLabel,
  labelPlaceholder,
  locationPlaceholder,
  onAdd,
  onChange,
  onRemove,
}: RepeatableLocationListProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-stone-800">{title}</h4>
        <button
          type="button"
          onClick={onAdd}
          className="text-xs font-medium text-emerald-700 hover:text-emerald-800"
        >
          + {addLabel}
        </button>
      </div>
      {entries.length === 0 && <p className="text-xs text-stone-400">None added yet.</p>}
      <div className="space-y-4">
        {entries.map((entry) => (
          <div key={entry.id} className="rounded-lg border border-stone-200 p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <input
                type="text"
                value={entry.label}
                onChange={(e) => onChange(entry.id, { ...entry, label: e.target.value })}
                placeholder={labelPlaceholder}
                className="flex-1 rounded-md border border-stone-200 px-2 py-1 text-sm text-stone-800 placeholder:text-stone-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
              <button
                type="button"
                onClick={() => onRemove(entry.id)}
                className="shrink-0 text-xs text-stone-400 hover:text-red-600"
              >
                Remove
              </button>
            </div>
            <LocationField
              entry={entry}
              label="Location"
              placeholder={locationPlaceholder}
              onChange={(updated) => onChange(entry.id, updated)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
