import { HouseholdBreakdown } from "@/lib/anthropic/schema";

function DetailRow({ label, value }: { label: string; value: string }) {
  if (!value.trim()) return null;
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-stone-400">{label}</p>
      <p className="mt-0.5 text-sm text-stone-700">{value}</p>
    </div>
  );
}

export function FamilyBreakdown({ breakdown }: { breakdown: HouseholdBreakdown }) {
  return (
    <details className="group rounded-lg border border-stone-200 open:bg-stone-50/50">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-medium text-stone-800">
        <span>{breakdown.householdName}</span>
        <svg
          viewBox="0 0 20 20"
          fill="none"
          className="h-4 w-4 shrink-0 text-stone-400 transition-transform group-open:rotate-180"
        >
          <path
            d="M5 7.5l5 5 5-5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </summary>
      <div className="space-y-4 border-t border-stone-200 px-4 py-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <DetailRow label="Spouse 1 commute" value={breakdown.spouse1Commute} />
          <DetailRow label="Spouse 2 commute" value={breakdown.spouse2Commute} />
          <DetailRow label="Children" value={breakdown.childrenNotes} />
          <DetailRow label="Extended family proximity" value={breakdown.extendedFamilyProximity} />
          <DetailRow label="Activity proximity" value={breakdown.activityProximity} />
          <DetailRow label="Budget fit" value={breakdown.budgetFit} />
          <DetailRow label="Acreage / property fit" value={breakdown.acreageFit} />
        </div>

        {breakdown.requirementsMet.length > 0 && (
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-stone-400">
              Requirements met
            </p>
            <ul className="mt-1 space-y-1">
              {breakdown.requirementsMet.map((item, i) => (
                <li key={i} className="flex gap-1.5 text-sm text-stone-700">
                  <span className="text-emerald-600">✓</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        )}

        {breakdown.requirementsCompromised.length > 0 && (
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-stone-400">
              May require compromise
            </p>
            <ul className="mt-1 space-y-1">
              {breakdown.requirementsCompromised.map((item, i) => (
                <li key={i} className="flex gap-1.5 text-sm text-stone-700">
                  <span className="text-amber-600">!</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        )}

        {breakdown.summary.trim() && (
          <p className="rounded-lg bg-stone-100 px-3 py-2 text-sm text-stone-700 italic">
            {breakdown.summary}
          </p>
        )}
      </div>
    </details>
  );
}
