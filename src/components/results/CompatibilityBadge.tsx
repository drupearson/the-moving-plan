import { CompatibilityLevel } from "@/lib/anthropic/schema";

const STYLES: Record<CompatibilityLevel, string> = {
  meets: "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200",
  partial: "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200",
  does_not_meet: "bg-red-50 text-red-700 ring-1 ring-inset ring-red-200",
  unknown: "bg-stone-100 text-stone-500 ring-1 ring-inset ring-stone-200",
};

const LABELS: Record<CompatibilityLevel, string> = {
  meets: "Meets",
  partial: "Partial",
  does_not_meet: "Does not meet",
  unknown: "Unknown",
};

export function CompatibilityBadge({
  level,
  detail,
}: {
  level: CompatibilityLevel;
  detail?: string;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span
        className={`inline-flex w-fit items-center rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap ${STYLES[level]}`}
      >
        {LABELS[level]}
      </span>
      {detail && <span className="text-xs text-stone-400">{detail}</span>}
    </div>
  );
}
