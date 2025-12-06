/**
 * AI Summary Generation Step
 *
 * Generates multi-format podcast summaries using an LLM (Groq).
 *
 * Summary Formats:
 * - Full: 200-300 word comprehensive overview for show notes
 * - Bullets: 5-7 scannable key points for quick reference
 * - Insights: 3-5 actionable takeaways for the audience
 * - TL;DR: One-sentence hook for social media
 *
 * Integration:
 * - Uses Zod for runtime validation (schema.parse) instead of provider helpers
 * - Wrapped in step.ai.wrap() for Inngest observability and automatic retries
 * - Leverages AssemblyAI chapters for better context understanding
 *
 * Design Decision: Why multiple summary formats?
 * - Different use cases: blog, email, social, show notes
 * - Saves manual editing time for content creators
 * - Each format optimized for its specific purpose
 */
import type { step as InngestStep } from "inngest";
import Groq from "groq-sdk";
import { groq } from "@/lib/groq-client";
import { type Summary, summarySchema } from "@/schemas/ai-outputs";
import type { TranscriptWithExtras } from "@/types/assemblyai";

// System prompt defines model's role and expertise
// NOTE: We add one short instruction to always return valid JSON matching the schema.
const SUMMARY_SYSTEM_PROMPT =
  "You are an expert podcast content analyst and marketing strategist. Your summaries are engaging, insightful, and highlight the most valuable takeaways for listeners. ALWAYS return STRICT JSON only that matches the shape: { full: string, bullets: string[], insights: string[], tldr: string } — no explanation, no extra text.";

/**
 * Builds the user prompt with transcript context and detailed instructions
 *
 * Prompt Engineering Techniques:
 * - Provides first 3000 chars of transcript (balance context vs. token cost)
 * - Includes AssemblyAI chapters for topic structure
 * - Specific formatting requirements for each summary type
 * - Examples and constraints to guide GPT output
 */
function buildSummaryPrompt(transcript: TranscriptWithExtras): string {
  return `Analyze this podcast transcript in detail and create a comprehensive summary package.

TRANSCRIPT (first 3000 chars):
${transcript.text.substring(0, 3000)}...

${
  transcript.chapters.length > 0
    ? `\nAUTO-DETECTED CHAPTERS:\n${transcript.chapters
        .map((ch, idx) => `${idx + 1}. ${ch.headline} - ${ch.summary}`)
        .join("\n")}`
    : ""
}

Create a summary with:

1. FULL OVERVIEW (200-300 words):
   - What is this podcast about?
   - Who is speaking and what's their perspective?
   - What are the main themes and arguments?
   - Why should someone listen to this?

2. KEY BULLET POINTS (5-7 items):
   - Main topics discussed in order
   - Important facts or statistics mentioned
   - Key arguments or positions taken
   - Notable quotes or moments

3. ACTIONABLE INSIGHTS (3-5 items):
   - What can listeners learn or apply?
   - Key takeaways that provide value
   - Perspectives that challenge conventional thinking
   - Practical advice or recommendations

4. TL;DR (one compelling sentence):
   - Capture the essence and hook interest
   - Make someone want to listen

Be specific, engaging, and valuable. Focus on what makes this podcast unique and worth listening to.`;
}

/*
Generates summary using GROQ-backed LLM with Zod validation

Error Handling:
 * - Returns fallback summary on API failure (graceful degradation)
 * - Logs errors for debugging
 * - Doesn't throw (allows other parallel jobs to continue)

Inngest Integration:
 * - step.ai.wrap() tracks token usage and performance
 * - Provides automatic retry on transient failures
 * - Shows AI call details in Inngest dashboard
 */
export async function generateSummary(
  step: typeof InngestStep,
  transcript: TranscriptWithExtras
): Promise<Summary> {
  console.log("Generating podcast summary with GROQ");

  try {
    // Bind Groq method to preserve `this` context (required for step.ai.wrap)
    const createCompletion = groq.chat.completions.create.bind(
      groq.chat.completions
    );

    // Call Groq (wrapped for Inngest observability)
    const response = (await step.ai.wrap(
      "generate-summary-with-groq",
      createCompletion,
      {
        model: "llama-3.1-70b-versatile",
        messages: [
          { role: "system", content: SUMMARY_SYSTEM_PROMPT },
          { role: "user", content: buildSummaryPrompt(transcript) },
        ],
        temperature: 0.2,
        max_tokens: 800,
      }
    )) as Groq.Chat.Completions.ChatCompletion;

    const content = response.choices?.[0]?.message?.content ?? "";

    // Parse and validate response against schema
    let summary: Summary;
    try {
      const parsed = JSON.parse(content);
      summary = summarySchema.parse(parsed);
    } catch (parseOrValidationError) {
      console.warn("Parsing/validation failed for GROQ output:", parseOrValidationError);

      // Attempt a single repair request (ask model to return strict JSON)
      try {
        const repairResponse = (await step.ai.wrap(
          "repair-summary-json",
          createCompletion,
          {
            model: "llama-3.1-70b-versatile",
            messages: [
              { role: "system", content: SUMMARY_SYSTEM_PROMPT },
              {
                role: "user",
                content:
                  "Previous response wasn't valid JSON. Reply with STRICT JSON only that matches this shape: { full: string, bullets: string[], insights: string[], tldr: string }. No explanation.",
              },
            ],
            temperature: 0.0,
            max_tokens: 600,
          }
        )) as Groq.Chat.Completions.ChatCompletion;

        const repairedContent = repairResponse.choices?.[0]?.message?.content ?? "";
        const repairedParsed = JSON.parse(repairedContent);
        summary = summarySchema.parse(repairedParsed);
      } catch (repairError) {
        console.error("Repair attempt failed:", repairError);
        // Fallback: use raw transcript if parsing fails
        summary = {
          full: transcript.text.substring(0, 500),
          bullets: ["Full transcript available"],
          insights: ["See transcript"],
          tldr: transcript.text.substring(0, 200),
        };
      }
    }

    return summary;
  } catch (error) {
    console.error("GROQ summary generation error:", error);

    // Graceful degradation: return error message but allow workflow to continue
    return {
      full: "⚠️ Error generating summary with GROQ. Please check logs or try again.",
      bullets: ["Summary generation failed - see full transcript"],
      insights: ["Error occurred during AI generation"],
      tldr: "Summary generation failed",
    };
  }
}
