import { Check, AlertTriangle, ChevronDown } from "lucide-react";
import { HouseholdBreakdown, HouseholdCompatibility } from "@/lib/anthropic/schema";

function DriveLine({
  label,
  minutes,
  miles,
  text,
}: {
  label: string;
  minutes: number | null | undefined;
  miles: number | null | undefined;
  text: string;
}) {
  if (!text.trim()) return null;
  return (
    <div>
      <div className="flex items-center gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-stone-400">{label}</p>
        {minutes != null && (
          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
            {minutes} min · {miles} mi
          </span>
        )}
      </div>
      <p className="mt-0.5 text-sm text-stone-700">{text}</p>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  if (!value.trim()) return null;
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-stone-400">{label}</p>
      <p className="mt-0.5 text-sm text-stone-700">{value}</p>
    </div>
  );
}

interface FamilyBreakdownProps {
  breakdown: HouseholdBreakdown;
  compatibility?: HouseholdCompatibility;
}

export function FamilyBreakdown({ breakdown, compatibility }: FamilyBreakdownProps) {
  return (
    <details className="group rounded-lg border border-stone-200 open:bg-stone-50/50">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-medium text-stone-800">
        <span>{breakdown.householdName}</span>
        <ChevronDown className="h-4 w-4 shrink-0 text-stone-400 transition-transform group-open:rotate-180" />
      </summary>
      <div className="space-y-4 border-t border-stone-200 px-4 py-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <DriveLine
            label="Spouse 1 commute"
            minutes={compatibility?.spouse1DriveMinutes}
            miles={compatibility?.spouse1DriveMiles}
            text={breakdown.spouse1Commute}
          />
          <DriveLine
            label="Spouse 2 commute"
            minutes={compatibility?.spouse2DriveMinutes}
            miles={compatibility?.spouse2DriveMiles}
            text={breakdown.spouse2Commute}
          />
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
                <li key={i} className="flex items-start gap-1.5 text-sm text-stone-700">
                  <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
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
                <li key={i} className="flex items-start gap-1.5 text-sm text-stone-700">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
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
