import { HouseholdCompatibility } from "@/lib/anthropic/schema";
import { CompatibilityBadge } from "./CompatibilityBadge";

type CompatibilityColumnKey =
  | "workplaceCommute"
  | "schoolActivityProximity"
  | "budgetCompatibility"
  | "propertyAcreageCompatibility"
  | "overall";

const COLUMNS: { key: CompatibilityColumnKey; label: string }[] = [
  { key: "workplaceCommute", label: "Workplace commute" },
  { key: "schoolActivityProximity", label: "School / activity" },
  { key: "budgetCompatibility", label: "Budget" },
  { key: "propertyAcreageCompatibility", label: "Property / acreage" },
  { key: "overall", label: "Overall" },
];

export function CompatibilityMatrix({ rows }: { rows: HouseholdCompatibility[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-stone-200">
      <table className="w-full min-w-[640px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-stone-200 bg-stone-50">
            <th className="px-3 py-2 text-left font-medium text-stone-600">Household</th>
            {COLUMNS.map((col) => (
              <th key={col.key} className="px-3 py-2 text-left font-medium text-stone-600">
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.householdId} className="border-b border-stone-100 last:border-0">
              <td className="px-3 py-2.5 font-medium text-stone-800">{row.householdName}</td>
              {COLUMNS.map((col) => (
                <td key={col.key} className="px-3 py-2.5">
                  <CompatibilityBadge level={row[col.key]} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
