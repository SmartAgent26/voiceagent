import "server-only";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type ProcessingPurpose = "ai_coaching" | "weekly_journal_summary" | "voice_transcription" | "photo_ai_processing";

export async function hasProcessingConsent(athleteId: string, purpose: ProcessingPurpose) {
  const client = createServerSupabaseClient();
  if (!client) return false;
  const { data } = await client.from("processing_consents").select(purpose).eq("user_id", athleteId).maybeSingle();
  return Boolean((data as Partial<Record<ProcessingPurpose, boolean>> | null)?.[purpose]);
}
