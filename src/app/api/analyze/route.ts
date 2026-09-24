import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { NextResponse } from "next/server";
import { Household } from "@/types/household";
import { analysisResultSchema } from "@/lib/anthropic/schema";
import { ANALYSIS_SYSTEM_PROMPT, buildHouseholdsSummary } from "@/lib/anthropic/prompt";
import { saveAnalysis } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
// Structured, multi-household analysis can run for a couple of minutes.
// Requires a Vercel plan that allows extended function duration.
export const maxDuration = 300;

export async function POST(request: Request) {
  let households: Household[];
  try {
    const body = await request.json();
    households = body.households;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (!Array.isArray(households) || households.length === 0) {
    return NextResponse.json(
      { error: "Add at least one household before running the analysis." },
      { status: 400 },
    );
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      {
        error:
          "The server is missing ANTHROPIC_API_KEY. Add it to .env.local and restart the dev server.",
      },
      { status: 500 },
    );
  }

  const client = new Anthropic();
  const householdsSummary = buildHouseholdsSummary(households);

  try {
    const stream = client.messages.stream({
      model: "claude-opus-5",
      max_tokens: 32000,
      output_config: {
        format: zodOutputFormat(analysisResultSchema),
        effort: "medium",
      },
      system: ANALYSIS_SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `Households planning to relocate together in the Oklahoma City metro area:\n\n${householdsSummary}`,
        },
      ],
    });

    const message = await stream.finalMessage();

    if (message.stop_reason === "refusal") {
      return NextResponse.json(
        { error: "Claude declined to analyze this request." },
        { status: 502 },
      );
    }
    if (message.stop_reason === "max_tokens") {
      return NextResponse.json(
        {
          error:
            "The analysis output was too long and got cut off. Try again with fewer households.",
        },
        { status: 502 },
      );
    }

    const textBlock = message.content.find(
      (block): block is Anthropic.TextBlock => block.type === "text",
    );
    if (!textBlock) {
      return NextResponse.json(
        { error: "The analysis did not return a text result. Try again." },
        { status: 502 },
      );
    }

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(textBlock.text);
    } catch {
      return NextResponse.json(
        { error: "The analysis did not return valid JSON. Try again." },
        { status: 502 },
      );
    }

    const parsed = analysisResultSchema.safeParse(parsedJson);
    if (!parsed.success) {
      console.error("Analysis result failed schema validation:", parsed.error);
      return NextResponse.json(
        { error: "The analysis result didn't match the expected structure. Try again." },
        { status: 502 },
      );
    }

    const result = parsed.data;

    await saveAnalysis({
      householdSnapshot: households,
      result,
      model: message.model,
    });

    return NextResponse.json({ result });
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) {
      return NextResponse.json(
        { error: "The Anthropic API key was rejected. Check ANTHROPIC_API_KEY." },
        { status: 500 },
      );
    }
    if (error instanceof Anthropic.RateLimitError) {
      return NextResponse.json(
        { error: "Rate limited by the Anthropic API. Try again in a moment." },
        { status: 429 },
      );
    }
    if (error instanceof Anthropic.APIError) {
      return NextResponse.json(
        { error: `Anthropic API error: ${error.message}` },
        { status: 502 },
      );
    }
    console.error("Analyze route failed:", error);
    return NextResponse.json(
      { error: "Unexpected error while running the analysis." },
      { status: 500 },
    );
  }
}
