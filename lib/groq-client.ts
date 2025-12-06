/**
 * Groq Client Configuration
 * 
 * Centralized Groq client used by all AI generation steps.
 * 
 * Usage Pattern:
 * - Import this client in all AI generation functions
 * - Wrap calls with step.ai.wrap() for Inngest observability
 * - Use Structured Outputs (zodResponseFormat) for type-safe responses
 * 
 * Environment:
 * - Requires GROQ_API_KEY environment variable
 * - Configure in Vercel/Inngest dashboard
 * 
 * Models Used:
 * - llama-3.1-70b / gemma2 / mixtral: Fast, cheap, and high-quality via Groq LPU
 */
import Groq from "groq-sdk";

export const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});
