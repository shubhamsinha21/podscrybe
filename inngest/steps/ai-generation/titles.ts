/**
 * Title Suggestions Generation
 * 
 * Generates 4 types of title variations for different contexts:
 * 1. YouTube Short Titles: Hook-focused, curiosity-driven (40-60 chars)
 * 2. YouTube Long Titles: SEO-optimized with keywords (70-100 chars)
 * 3. Podcast Episode Titles: Creative and memorable for RSS feeds
 * 4. SEO Keywords: Discovery optimization across platforms
 * 
 * Use Cases:
 * - Content creators need multiple title options to A/B test
 * - Different platforms favor different title styles
 * - SEO keywords improve discoverability across search engines
 * 
 * Design Decision: Multiple title formats
 * - Saves manual brainstorming time
 * - Each format optimized for specific distribution channel
 * - Keywords help with content strategy beyond just titles
 */
import type { step as InngestStep } from "inngest";
import Groq from "groq-sdk";
import { groq } from "@/lib/groq-client";
import { type Titles, titlesSchema } from "@/schemas/ai-outputs";
import type { TranscriptWithExtras } from "@/types/assemblyai";

// System prompt defines model's expertise in SEO and viral content
const TITLES_SYSTEM_PROMPT =
  "You are an expert in SEO, content marketing, and viral content creation. You understand what makes titles clickable while maintaining credibility and search rankings. ALWAYS return STRICT JSON only that matches the shape: { youtubeShort: string[], youtubeLong: string[], podcastTitles: string[], seoKeywords: string[] } — no explanation, no extra text.";

/**
 * Builds prompt with transcript preview and title-specific guidelines
 * 
 * Context Provided:
 * - First 2000 chars of transcript (enough for topic understanding)
 * - Chapter headlines (topic structure)
 * - Specific requirements for each title type
 * 
 * Prompt Engineering:
 * - Character limits explicitly stated
 * - Examples of formatting conventions
 * - Balance between clickability and credibility
 */
function buildTitlesPrompt(transcript: TranscriptWithExtras): string {
  return `Return STRICT JSON ONLY (no explanation, no backticks).
The JSON must match this shape:
{
  "youtubeShort": ["string","string","string"], // exactly 3, 40-60 chars each
  "youtubeLong": ["string","string","string"],  // exactly 3, 70-100 chars each
  "podcastTitles": ["string","string","string"], // exactly 3
  "seoKeywords": ["string", "..."] // 5-10 items
}

Create optimized titles for this podcast episode.

TRANSCRIPT PREVIEW:
${transcript.text.substring(0, 2000)}...

${
  transcript.chapters.length > 0
    ? `MAIN TOPICS COVERED:\n${transcript.chapters
        .map((ch, idx) => `${idx + 1}. ${ch.headline}`)
        .join("\n")}`
    : ""
}

Generate 4 types of titles:

1. YOUTUBE SHORT TITLES (exactly 3):
   - 40-60 characters each
   - Hook-focused, curiosity-driven
   - Clickable but not clickbait
   - Use power words and numbers when relevant

2. YOUTUBE LONG TITLES (exactly 3):
   - 70-100 characters each
   - Include SEO keywords naturally
   - Descriptive and informative
   - Format: "Main Topic: Subtitle | Context or Value Prop"

3. PODCAST EPISODE TITLES (exactly 3):
   - Creative, memorable titles
   - Balance intrigue with clarity
   - Good for RSS feeds and directories
   - Can use "Episode #" format or standalone

4. SEO KEYWORDS (5-10):
   - High-traffic search terms
   - Relevant to podcast content
   - Mix of broad and niche terms
   - Focus on what people actually search for

Make titles compelling, accurate, and optimized for discovery.`;
}

/**
 * Generates title suggestions using GROQ-backed LLM with Zod validation
 * 
 * Error Handling:
 * - Returns placeholder titles on failure
 * - Logs errors for debugging
 * - Graceful degradation (workflow continues)
 * 
 * Validation:
 * - Zod schema enforces exact array lengths (3 short, 3 long, 3 podcast)
 * - SEO keywords validated for 5-10 range
 */
export async function generateTitles(
  step: typeof InngestStep,
  transcript: TranscriptWithExtras,
): Promise<Titles> {
  console.log("Generating title suggestions with GROQ");

  try {
    // Bind Groq method to preserve `this` context for step.ai.wrap
    const createCompletion = groq.chat.completions.create.bind(
      groq.chat.completions,
    );

    // Call GROQ wrapped for Inngest observability
    const response = (await step.ai.wrap(
      "generate-titles-with-groq",
      createCompletion,
      {
        model: "llama-3.1-70b-versatile",
        messages: [
          { role: "system", content: TITLES_SYSTEM_PROMPT },
          { role: "user", content: buildTitlesPrompt(transcript) },
        ],
        temperature: 0.2,
        max_tokens: 400,
      },
    )) as Groq.Chat.Completions.ChatCompletion;

    const titlesContent = response.choices?.[0]?.message?.content ?? "";

    // Parse and validate against schema
    let titles: Titles;
    try {
      const parsed = JSON.parse(titlesContent);
      titles = titlesSchema.parse(parsed);
    } catch (parseOrValidationError) {
      console.warn("Parsing/validation failed for GROQ output:", parseOrValidationError);

      // Attempt a one-shot repair: ask GROQ to return strict JSON
      try {
        const repairResponse = (await step.ai.wrap(
          "repair-titles-json",
          createCompletion,
          {
            model: "llama-3.1-70b-versatile",
            messages: [
              { role: "system", content: TITLES_SYSTEM_PROMPT },
              {
                role: "user",
                content:
                  "Previous response wasn't valid JSON. Reply with STRICT JSON only matching keys: youtubeShort (3 items), youtubeLong (3 items), podcastTitles (3 items), seoKeywords (5-10 items). No explanation.",
              },
            ],
            temperature: 0.0,
            max_tokens: 300,
          },
        )) as Groq.Chat.Completions.ChatCompletion;

        const repairedContent = repairResponse.choices?.[0]?.message?.content ?? "";
        const repairedParsed = JSON.parse(repairedContent);
        titles = titlesSchema.parse(repairedParsed);
      } catch (repairError) {
        console.error("Repair attempt failed:", repairError);
        // Fallback titles if parsing fails
        titles = {
          youtubeShort: ["Podcast Episode", "New Podcast Episode", "Episode Highlights"],
          youtubeLong: ["Podcast Episode - Full Discussion", "Deep Dive: Episode Topic | Insights", "Episode Title: Expert Conversation"],
          podcastTitles: ["New Episode", "Episode Title", "Latest Episode"],
          seoKeywords: ["podcast", "episode", "discussion", "interview", "insights"],
        };
      }
    }

    return titles;
  } catch (error) {
    console.error("GROQ titles error:", error);

    // Graceful degradation: Return error indicators
    return {
      youtubeShort: ["⚠️ Title generation failed"],
      youtubeLong: ["⚠️ Title generation failed - check logs"],
      podcastTitles: ["⚠️ Title generation failed"],
      seoKeywords: ["error"],
    };
  }
}
