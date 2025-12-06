/**
 * Platform-Optimized Social Media Posts Generation (GROQ)
 *
 * Generates 6 unique social media posts, each tailored to a specific platform's:
 * - Character limits and formatting conventions
 * - Audience demographics and tone expectations
 * - Engagement patterns and best practices
 * - Algorithm preferences
 *
 * Platforms Covered:
 * - Twitter/X: 280 chars, punchy and quotable
 * - LinkedIn: Professional, thought-leadership
 * - Instagram: Visual storytelling, emoji-rich
 * - TikTok: Gen Z voice, trend-aware
 * - YouTube: Detailed descriptions with keywords
 * - Facebook: Community-focused, shareable
 *
 * Prompt Engineering:
 * - Provides chapter summaries (context without full transcript)
 * - Strict character limits enforced in prompt
 * - Platform-specific guidelines and examples
 * - Safety validation for Twitter's 280-char limit
 */
import type { step as InngestStep } from "inngest";
import Groq from "groq-sdk";
import { groq } from "@/lib/groq-client";
import { type SocialPosts, socialPostsSchema } from "@//schemas/ai-outputs";
import type { TranscriptWithExtras } from "@/types/assemblyai";

// System prompt establishes the model's expertise in platform-specific marketing
const SOCIAL_SYSTEM_PROMPT =
  "You are a viral social media marketing expert who understands each platform's unique audience, tone, and best practices. You create platform-optimized content that drives engagement and grows audiences. ALWAYS return valid JSON only, with the exact keys: twitter, linkedin, instagram, tiktok, youtube, facebook.";

/**
 * Builds prompt with episode context and platform-specific guidelines
 *
 * Prompt Structure:
 * - Episode summary from first chapter (context)
 * - Key topics from all chapters (content outline)
 * - Detailed platform requirements (formatting, tone, best practices)
 *
 * Design Decision: Why 6 separate posts vs. one generic post?
 * - Each platform has unique audience expectations
 * - Cross-posting generic content performs poorly
 * - Platform algorithms favor native content styles
 * - Better engagement = better ROI for content creators
 */
function buildSocialPrompt(transcript: TranscriptWithExtras): string {
  return `Return STRICT JSON ONLY (no explanation, no backticks).
The JSON must match this shape:

{
  "twitter": "string (<=280 chars)",
  "linkedin": "string",
  "instagram": "string",
  "tiktok": "string",
  "youtube": "string",
  "facebook": "string"
}

PODCAST SUMMARY:
${transcript.chapters?.[0]?.summary || transcript.text?.substring(0, 500) || "No summary available."}

KEY TOPICS DISCUSSED:
${
  transcript.chapters
    ?.slice(0, 5)
    .map((ch, idx) => `${idx + 1}. ${ch.headline}`)
    .join("\n") || "See transcript"
}

Now generate 6 unique posts optimized for each platform with the following constraints:

1. TWITTER/X (MAXIMUM 280 characters - STRICT LIMIT):
   - Start with a hook that stops scrolling
   - Include the main value proposition or insight
   - Make it thread-worthy
   - Conversational, punchy tone
   - Can include emojis but use sparingly
   - CRITICAL: Must be 280 characters or less, including spaces and emojis

2. LINKEDIN (1-2 paragraphs):
   - Professional, thought-leadership tone
   - Lead with an insight, question, or stat
   - Provide business/career value
   - End with an engagement question or CTA
   - Avoid excessive emojis

3. INSTAGRAM (caption):
   - Engaging storytelling approach
   - Use emojis strategically (2-4 max)
   - Build community connection
   - Include call-to-action
   - Personal and relatable

4. TIKTOK (short caption):
   - Gen Z friendly, energetic tone
   - Use trending language/slang
   - Very concise and punchy
   - Create FOMO or curiosity
   - Emojis welcome

5. YOUTUBE (detailed description):
   - SEO-friendly, keyword-rich
   - Explain what viewers will learn
   - Professional but engaging
   - Include episode highlights
   - Can be longer (2-3 paragraphs)

6. FACEBOOK (2-3 paragraphs):
   - Conversational, relatable tone
   - Shareable content approach
   - Community-focused
   - End with question or discussion prompt
   - Mix of personal and informative

Return only JSON, matching the schema exactly.`;
}

/**
 * Generates platform-optimized social posts using GROQ
 *
 * Error Handling:
 * - Returns placeholder posts on failure (graceful degradation)
 * - Safety check: Truncates Twitter post if it exceeds 280 chars
 * - Logs errors for debugging
 *
 * Validation:
 * - Zod schema enforces structure
 * - Twitter max length enforced in post-validation
 */
export async function generateSocialPosts(
  step: typeof InngestStep,
  transcript: TranscriptWithExtras
): Promise<SocialPosts> {
  console.log("Generating social posts with GROQ");

  try {
    // Bind Groq method to preserve `this` context for step.ai.wrap
    const createCompletion = groq.chat.completions.create.bind(
      groq.chat.completions
    );

    // Call GROQ wrapped with Inngest observability
    const response = (await step.ai.wrap(
      "generate-social-posts-with-groq",
      createCompletion,
      {
        model: "llama-3.1-70b-versatile",
        messages: [
          { role: "system", content: SOCIAL_SYSTEM_PROMPT },
          { role: "user", content: buildSocialPrompt(transcript) },
        ],
        temperature: 0.2,
        max_tokens: 800,
      }
    )) as Groq.Chat.Completions.ChatCompletion;

    const content = response.choices?.[0]?.message?.content ?? "";

    // Try parse and validate with Zod
    let socialPosts: SocialPosts;
    try {
      const parsed = JSON.parse(content);
      socialPosts = socialPostsSchema.parse(parsed);
    } catch (parseOrValidationError) {
      console.warn("Parsing/validation failed for GROQ output:", parseOrValidationError);
      // Attempt a one-shot repair: ask GROQ to return JSON only (repair prompt)
      try {
        const repairResponse = (await step.ai.wrap(
          "repair-social-posts-json",
          createCompletion,
          {
            model: "llama-3.1-70b-versatile",
            messages: [
              { role: "system", content: SOCIAL_SYSTEM_PROMPT },
              {
                role: "user",
                content:
                  "The previous response was not valid JSON. Reply with STRICT JSON only, matching keys: twitter, linkedin, instagram, tiktok, youtube, facebook. No explanation.",
              },
            ],
            temperature: 0.0,
            max_tokens: 600,
          }
        )) as Groq.Chat.Completions.ChatCompletion;

        const repairedContent = repairResponse.choices?.[0]?.message?.content ?? "";
        const repairedParsed = JSON.parse(repairedContent);
        socialPosts = socialPostsSchema.parse(repairedParsed);
      } catch (repairError) {
        console.error("Repair attempt failed:", repairError);
        // Fallback defaults
        socialPosts = {
          twitter: "New podcast episode!",
          linkedin: "Check out our latest podcast.",
          instagram: "New episode out now! 🎙️",
          tiktok: "New podcast!",
          youtube: "Watch our latest episode.",
          facebook: "New podcast available!",
        };
      }
    }

    // Safety check: Enforce Twitter's 280-character limit
    if (socialPosts.twitter.length > 280) {
      console.warn(
        `Twitter post exceeded 280 chars (${socialPosts.twitter.length}), truncating...`
      );
      socialPosts.twitter = `${socialPosts.twitter.substring(0, 277)}...`;
    }

    return socialPosts;
  } catch (error) {
    console.error("GROQ social posts error:", error);

    // Graceful degradation: Return error messages but allow workflow to continue
    return {
      twitter: "⚠️ Error generating social post. Check logs for details.",
      linkedin: "⚠️ Error generating social post. Check logs for details.",
      instagram: "⚠️ Error generating social post. Check logs for details.",
      tiktok: "⚠️ Error generating social post. Check logs for details.",
      youtube: "⚠️ Error generating social post. Check logs for details.",
      facebook: "⚠️ Error generating social post. Check logs for details.",
    };
  }
}
