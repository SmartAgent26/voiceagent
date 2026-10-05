import "server-only";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type AiUsageOperation = "coach_reply" | "goal_assistance" | "session_summary" | "weekly_journal_summary";
export type AiTokenUsage = { inputTokens: number; outputTokens: number; totalTokens: number };

/** Persiste exclusivamente metadatos de consumo; nunca texto, prompts ni respuestas. */
export async function recordAiUsageEvent(input: {
  athleteId: string;
  requestId: string;
  provider: string;
  model: string;
  operation: AiUsageOperation;
  usage: AiTokenUsage;
}) {
  const client = createServerSupabaseClient();
  if (!client) return false;
  const { error } = await client.from("ai_usage_events").insert({
    athlete_id: input.athleteId,
    provider: input.provider,
    model: input.model,
    status: "completed",
    operation: input.operation,
    input_tokens: Math.max(0, input.usage.inputTokens || 0),
    output_tokens: Math.max(0, input.usage.outputTokens || 0),
    total_tokens: Math.max(0, input.usage.totalTokens || 0),
    request_id: input.requestId,
  });
  return !error || error.code === "23505";
}
