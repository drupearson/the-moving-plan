import { Importance, LocationEntry } from "@/types/household";

interface LocationFieldProps {
  entry: LocationEntry;
  label: string;
  placeholder?: string;
  showImportance?: boolean;
  onChange: (entry: LocationEntry) => void;
}

export function LocationField({
  entry,
  label,
  placeholder = "City, address, or area",
  showImportance = true,
  onChange,
}: LocationFieldProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <label className="text-sm font-medium text-stone-700">{label}</label>
        <label className="flex shrink-0 items-center gap-1.5 text-xs text-stone-500">
          <input
            type="checkbox"
            checked={entry.isUnknown}
            onChange={(e) =>
              onChange({
                ...entry,
                isUnknown: e.target.checked,
                location: e.target.checked ? "" : entry.location,
              })
            }
            className="h-3.5 w-3.5 rounded border-stone-300 text-emerald-600 focus:ring-emerald-500"
          />
          Unknown / N/A
        </label>
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          value={entry.location}
          disabled={entry.isUnknown}
          onChange={(e) => onChange({ ...entry, location: e.target.value })}
          placeholder={entry.isUnknown ? "Marked unknown" : placeholder}
          className="flex-1 rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 placeholder:text-stone-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:bg-stone-100 disabled:text-stone-400"
        />
        {showImportance && (
          <select
            value={entry.importance}
            disabled={entry.isUnknown}
            onChange={(e) => onChange({ ...entry, importance: e.target.value as Importance })}
            className="rounded-lg border border-stone-300 bg-white px-2 py-2 text-xs text-stone-700 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:bg-stone-100 disabled:text-stone-400"
          >
            <option value="essential">Essential</option>
            <option value="preference">Preference</option>
          </select>
        )}
      </div>
    </div>
  );
}
