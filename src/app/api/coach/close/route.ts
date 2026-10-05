import { NextResponse } from "next/server";
import { z } from "zod";
import { createCompactSummaryWithUsage, separateSummaryFocus } from "@/lib/agent/coach";
import { getAuthenticatedAthleteId } from "@/lib/agent/auth";
import { hasProcessingConsent } from "@/lib/privacy/processing-consents";
import { enforceRateLimit, parseJsonBody, rateLimitHeaders, RequestBodyTooLargeError } from "@/lib/security/request-guards";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { recordAiUsageEvent } from "@/lib/agent/usage";
import { logOperationalEvent } from "@/lib/security/logger";

const schema = z.object({ sessionId: z.string().uuid() });
export async function POST(request: Request) {
  const requestId = request.headers.get("x-request-id") || crypto.randomUUID();
  try {
    const ipLimit = await enforceRateLimit(request, { scope: "coach-close-ip", limit: 12, windowMs: 60_000 });
    if (!ipLimit.allowed) return NextResponse.json({ error: "Demasiadas solicitudes. Intentá nuevamente en un momento." }, { status: 429, headers: rateLimitHeaders(ipLimit) });
    const { sessionId } = await parseJsonBody(request, schema, 2_000);
    const athleteId = await getAuthenticatedAthleteId(request);
    const client = createServerSupabaseClient();
    if (!athleteId || !client) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
    const userLimit = await enforceRateLimit(request, { scope: "coach-close-user", identity: athleteId, limit: 6, windowMs: 60_000 });
    if (!userLimit.allowed) return NextResponse.json({ error: "Demasiadas solicitudes. Intentá nuevamente en un momento." }, { status: 429, headers: rateLimitHeaders(userLimit) });
    const { data: session, error: sessionError } = await client.from("coaching_sessions").select("id,started_at").eq("id", sessionId).eq("athlete_id", athleteId).eq("status", "active").maybeSingle();
    if (sessionError) throw sessionError;
    if (!session) return NextResponse.json({ error: "La sesión ya no está disponible." }, { status: 404 });
    const { data: messages, error: messagesError } = await client.from("session_messages").select("sender,content,created_at").eq("session_id", sessionId).order("created_at");
    if (messagesError) throw messagesError;
    const turns = messages || [];
    const hasAthleteMessage = turns.some((message) => message.sender === "athlete");
    const hasCoachReply = turns.some((message) => message.sender === "assistant");

    const now = new Date();
    const summaryResult = hasAthleteMessage && hasCoachReply && await hasProcessingConsent(athleteId, "ai_coaching")
      ? await createCompactSummaryWithUsage(turns.map((message) => `${message.sender === "assistant" ? "Coach" : "Deportista"}: ${message.content}`).join("\n"), "session")
      : null;
    const generatedSummary = summaryResult?.summary || "";
    if (summaryResult && !await recordAiUsageEvent({ athleteId, requestId, provider: summaryResult.provider, model: summaryResult.model, operation: "session_summary", usage: summaryResult.usage })) {
      await logOperationalEvent("ai_usage_record_failed", { requestId, route: "/api/coach/close", outcome: "warning", status: 500, errorType: "session_summary" });
    }
    const { summary, focus } = separateSummaryFocus(generatedSummary);
    const { data: outcome, error: closeError } = await client.rpc("close_coaching_session", {
      p_athlete_id: athleteId,
      p_session_id: sessionId,
      p_summary: summary,
      p_focus: focus,
      p_duration_seconds: Math.max(0, Math.round((now.getTime() - new Date(session.started_at).getTime()) / 1000)),
      p_source_count: turns.length,
    });
    if (closeError) throw closeError;
    if (outcome === "unavailable") return NextResponse.json({ error: "La sesión ya no está disponible." }, { status: 404 });
    return NextResponse.json({ ok: true, discarded: outcome === "discarded" });
  } catch (error) { return NextResponse.json({ error: error instanceof RequestBodyTooLargeError ? error.message : "No fue posible cerrar la sesión." }, { status: error instanceof RequestBodyTooLargeError ? 413 : 400 }); }
}
