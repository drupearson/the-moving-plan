import { createClient } from "@supabase/supabase-js";
import { Household } from "@/types/household";
import { AnalysisResult } from "@/lib/anthropic/schema";

function getServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

interface SaveAnalysisInput {
  householdSnapshot: Household[];
  result: AnalysisResult;
  model: string;
}

export async function saveAnalysis({ householdSnapshot, result, model }: SaveAnalysisInput) {
  const supabase = getServerClient();
  if (!supabase) return;

  const { error } = await supabase.from("analyses").insert({
    household_snapshot: householdSnapshot,
    result,
    model,
  });

  if (error) {
    console.error("Failed to save analysis to Supabase:", error.message);
  }
}
