import "server-only";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function assertProviderAvailable(provider: string) {
  const client = createServerSupabaseClient();
  if (!client) return;
  const { data, error } = await client.rpc("is_ai_provider_available", { p_provider: provider }).maybeSingle();
  if (error) return;
  if (data === false) throw new Error("AI_PROVIDER_CIRCUIT_OPEN");
}

export async function recordProviderOutcome(provider: string, success: boolean) {
  const client = createServerSupabaseClient();
  if (!client) return;
  await client.rpc("record_ai_provider_outcome", { p_provider: provider, p_success: success });
}
