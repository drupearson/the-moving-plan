import { LocationRecommendation } from "@/lib/anthropic/schema";
import { CompatibilityMatrix } from "./CompatibilityMatrix";
import { FamilyBreakdown } from "./FamilyBreakdown";

export function LocationCard({ location }: { location: LocationRecommendation }) {
  const isTopPick = location.rank === 1;

  return (
    <section
      className={`rounded-2xl border bg-white shadow-sm ${
        isTopPick ? "border-emerald-300 ring-1 ring-emerald-200" : "border-stone-200"
      }`}
    >
      <div className="space-y-5 p-6">
        <div className="flex items-start gap-4">
          <span
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
              isTopPick ? "bg-emerald-600 text-white" : "bg-stone-100 text-stone-600"
            }`}
          >
            #{location.rank}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline gap-x-2">
              <h3 className="text-lg font-semibold text-stone-900">{location.name}</h3>
              {isTopPick && (
                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                  Top pick
                </span>
              )}
            </div>
            <p className="text-sm text-stone-500">
              {location.cityArea} · {location.county}
            </p>
          </div>
        </div>

        <p className="text-sm leading-relaxed text-stone-700">{location.summary}</p>

        {location.keyFactors.length > 0 && (
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-stone-400">
              Key factors
            </p>
            <ul className="mt-1.5 space-y-1">
              {location.keyFactors.map((factor, i) => (
                <li key={i} className="flex gap-1.5 text-sm text-stone-700">
                  <span className="text-emerald-600">•</span>
                  {factor}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="grid gap-5 sm:grid-cols-2">
          {location.housingConsiderations.trim() && (
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-stone-400">
                Housing &amp; acreage
              </p>
              <p className="mt-1 text-sm text-stone-700">{location.housingConsiderations}</p>
            </div>
          )}
          {location.majorCompromises.length > 0 && (
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-stone-400">
                Major compromises
              </p>
              <ul className="mt-1 space-y-1">
                {location.majorCompromises.map((item, i) => (
                  <li key={i} className="flex gap-1.5 text-sm text-stone-700">
                    <span className="text-amber-600">!</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {location.dataCaveat.trim() && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
            {location.dataCaveat}
          </p>
        )}

        {location.familyCompatibility.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-stone-400">
              Family compatibility
            </p>
            <CompatibilityMatrix rows={location.familyCompatibility} />
          </div>
        )}

        {location.familyBreakdowns.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-stone-400">
              Household-by-household impact
            </p>
            <div className="space-y-2">
              {location.familyBreakdowns.map((breakdown) => (
                <FamilyBreakdown key={breakdown.householdId} breakdown={breakdown} />
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
