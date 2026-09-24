"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { Household } from "@/types/household";
import { AnalysisResult } from "@/lib/anthropic/schema";
import { HouseholdsSection } from "./HouseholdsSection";
import { LocationCard } from "./results/LocationCard";

const LocationsMap = dynamic(() => import("./results/LocationsMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-80 items-center justify-center rounded-2xl border border-stone-200 bg-stone-50 text-sm text-stone-400">
      Loading map…
    </div>
  ),
});

type Tab = "profiles" | "analysis" | "results";

const TABS: { id: Tab; label: string }[] = [
  { id: "profiles", label: "Family Profiles" },
  { id: "analysis", label: "AI Location Analysis" },
  { id: "results", label: "Recommended Locations" },
];

export function DashboardApp() {
  const [activeTab, setActiveTab] = useState<Tab>("profiles");
  const [households, setHouseholds] = useState<Household[]>([]);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  const runAnalysis = async () => {
    setIsAnalyzing(true);
    setAnalysisError(null);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ households }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Analysis failed.");
      }
      setAnalysisResult(data.result);
      setActiveTab("results");
    } catch (err) {
      setAnalysisError(err instanceof Error ? err.message : "Analysis failed.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-4 py-10 sm:px-6">
      <header className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
          Oklahoma City Metro
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-stone-900">
          The Moving Plan
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-stone-500">
          Bring your households&apos; commutes, schools, family, and budgets together, and let AI
          find the geographic areas that work for everyone.
        </p>
      </header>

      <nav className="mb-8 flex gap-1 border-b border-stone-200">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`relative px-4 py-2.5 text-sm font-medium transition-colors ${
              activeTab === tab.id ? "text-emerald-700" : "text-stone-500 hover:text-stone-800"
            }`}
          >
            {tab.label}
            {activeTab === tab.id && (
              <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-emerald-600" />
            )}
          </button>
        ))}
      </nav>

      <main className="flex-1">
        {activeTab === "profiles" && (
          <HouseholdsSection households={households} onChange={setHouseholds} />
        )}
        {activeTab === "analysis" && (
          <AnalysisPanel
            households={households}
            isAnalyzing={isAnalyzing}
            error={analysisError}
            hasResult={analysisResult !== null}
            onAnalyze={runAnalysis}
            onViewResults={() => setActiveTab("results")}
          />
        )}
        {activeTab === "results" && <ResultsPanel result={analysisResult} />}
      </main>
    </div>
  );
}

interface AnalysisPanelProps {
  households: Household[];
  isAnalyzing: boolean;
  error: string | null;
  hasResult: boolean;
  onAnalyze: () => void;
  onViewResults: () => void;
}

function AnalysisPanel({
  households,
  isAnalyzing,
  error,
  hasResult,
  onAnalyze,
  onViewResults,
}: AnalysisPanelProps) {
  const canAnalyze = households.length > 0 && !isAnalyzing;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-stone-900">AI Location Analysis</h2>
        <p className="mt-1 max-w-2xl text-sm text-stone-500">
          Claude will review all {households.length} household
          {households.length === 1 ? "" : "s"}, check real driving times against each
          household&apos;s maximum commute, and recommend up to 3 areas of the Oklahoma City metro
          that best balance everyone&apos;s commutes, schools, family, activities, and budgets.
        </p>
      </div>

      <div className="rounded-2xl border border-stone-200 bg-white p-8 text-center shadow-sm">
        <button
          type="button"
          onClick={onAnalyze}
          disabled={!canAnalyze}
          className="rounded-lg bg-emerald-600 px-6 py-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-stone-300"
        >
          {isAnalyzing ? "Analyzing…" : "Analyze Best Locations"}
        </button>

        {households.length === 0 && (
          <p className="mt-3 text-xs text-stone-400">
            Add at least one household on the Family Profiles tab first.
          </p>
        )}

        {isAnalyzing && (
          <p className="mt-3 text-xs text-stone-500">
            Calling Claude to analyze commutes, schools, family, and budgets across all
            households — this can take a bit.
          </p>
        )}

        {error && (
          <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
            {error}
          </p>
        )}

        {hasResult && !isAnalyzing && (
          <button
            type="button"
            onClick={onViewResults}
            className="mt-4 block w-full text-xs font-medium text-emerald-700 hover:text-emerald-800"
          >
            View the latest results →
          </button>
        )}
      </div>
    </div>
  );
}

function ResultsPanel({ result }: { result: AnalysisResult | null }) {
  if (!result) {
    return (
      <div className="rounded-2xl border border-dashed border-stone-300 bg-stone-50 px-6 py-16 text-center">
        <h2 className="text-lg font-semibold text-stone-900">Recommended Locations</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-stone-500">
          Results will appear here as interactive cards once an analysis has been run.
        </p>
      </div>
    );
  }

  const sortedLocations = [...result.locations].sort((a, b) => a.rank - b.rank);
  const excludedForCommute = result.excludedForCommute ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <h2 className="text-lg font-semibold text-stone-900">Recommended Locations</h2>
      </div>

      <p className="rounded-xl border border-emerald-100 bg-emerald-50/60 px-4 py-3 text-sm leading-snug text-emerald-900">
        {result.overallNotes}
      </p>

      {excludedForCommute > 0 && (
        <p className="rounded-xl border border-amber-100 bg-amber-50/60 px-4 py-3 text-sm leading-snug text-amber-900">
          {excludedForCommute} candidate area{excludedForCommute === 1 ? "" : "s"} exceeded a
          household&apos;s stated maximum commute and{" "}
          {excludedForCommute === 1 ? "was" : "were"} left out of the results below.
        </p>
      )}

      {sortedLocations.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-stone-300 bg-stone-50 px-6 py-12 text-center">
          <p className="text-sm text-stone-600">
            No candidate area satisfied every household&apos;s maximum commute at the same time.
          </p>
          <p className="mx-auto mt-1 max-w-md text-xs text-stone-400">
            Try raising a household&apos;s maximum acceptable commute on the Family Profiles tab,
            or relax which workplaces are marked essential, then re-run the analysis.
          </p>
        </div>
      ) : (
        <>
          <LocationsMap locations={sortedLocations} />
          <div className="space-y-6">
            {sortedLocations.map((location) => (
              <LocationCard key={location.rank} location={location} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
