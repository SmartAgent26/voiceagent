import "server-only";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type LogFields = {
  requestId: string;
  route: string;
  outcome: "error" | "warning" | "info";
  status?: number;
  errorType?: string;
};

/** Emits allow-listed operational metadata only; never pass content, images, keys or raw errors. */
/** Persists allow-listed operational metadata; logging failure never interrupts the user flow. */
export async function logOperationalEvent(event: string, fields: LogFields) {
  const payload = { timestamp: new Date().toISOString(), event, ...fields };
  if (fields.outcome === "error") console.error(JSON.stringify(payload));
  else console.info(JSON.stringify(payload));
  try {
    const client = createServerSupabaseClient();
    if (!client) return;
    await client.from("operational_events").insert({ event, request_id: fields.requestId, route: fields.route, outcome: fields.outcome, status: fields.status || null, error_type: fields.errorType || null });
  } catch {
    // The console event above remains the non-sensitive fallback for an unavailable datastore.
  }
}
