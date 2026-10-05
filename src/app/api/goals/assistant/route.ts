import { NextResponse } from "next/server";
import { z } from "zod";
import { createGoalSuggestion } from "@/lib/agent/coach";
import { buildAthleteContext } from "@/lib/agent/athlete-context";
import { getAuthenticatedAthleteId } from "@/lib/agent/auth";
import { hasProcessingConsent } from "@/lib/privacy/processing-consents";
import { logOperationalEvent } from "@/lib/security/logger";
import { enforceRateLimit, parseJsonBody, rateLimitHeaders, RequestBodyTooLargeError } from "@/lib/security/request-guards";
import { recordAiUsageEvent } from "@/lib/agent/usage";

const requestSchema = z.object({
  messages: z.array(z.string().trim().min(2).max(1_200)).min(1).max(4),
});

export async function POST(request: Request) {
  const requestId = request.headers.get("x-request-id") || crypto.randomUUID();
  try {
    const ipLimit = await enforceRateLimit(request, { scope: "goal-assistant-ip", limit: 12, windowMs: 60_000 });
    if (!ipLimit.allowed) return NextResponse.json({ ok: false, error: "Hiciste muchas solicitudes. Esperá un momento antes de continuar." }, { status: 429, headers: rateLimitHeaders(ipLimit) });
    const { messages } = await parseJsonBody(request, requestSchema, 8_000);
    const athleteId = await getAuthenticatedAthleteId(request);
    if (!athleteId) return NextResponse.json({ ok: false, error: "Tu sesión no es válida o el acceso está suspendido." }, { status: 401 });
    if (!await hasProcessingConsent(athleteId, "ai_coaching")) return NextResponse.json({ ok: false, error: "Necesitás autorizar el acompañamiento con IA para usar esta ayuda." }, { status: 403 });
    const userLimit = await enforceRateLimit(request, { scope: "goal-assistant-user", identity: athleteId, limit: 8, windowMs: 60 * 60_000 });
    if (!userLimit.allowed) return NextResponse.json({ ok: false, error: "Usaste la ayuda varias veces. Esperá un momento antes de continuar." }, { status: 429, headers: rateLimitHeaders(userLimit) });
    const athleteContext = await buildAthleteContext(athleteId);
    const result = await createGoalSuggestion(messages.map((content) => ({ role: "user" as const, content })), athleteContext.context);
    if (!await recordAiUsageEvent({ athleteId, requestId, provider: result.provider, model: result.model, operation: "goal_assistance", usage: result.usage })) {
      await logOperationalEvent("ai_usage_record_failed", { requestId, route: "/api/goals/assistant", outcome: "warning", status: 500, errorType: "goal_assistance" });
    }
    return NextResponse.json({ ok: true, suggestion: result.suggestion }, { headers: { "X-Request-Id": requestId } });
  } catch (error) {
    await logOperationalEvent("goal_assistant_failed", { requestId, route: "/api/goals/assistant", outcome: error instanceof z.ZodError || error instanceof RequestBodyTooLargeError ? "warning" : "error", status: error instanceof RequestBodyTooLargeError ? 413 : 400, errorType: error instanceof Error ? error.name : "UnknownError" });
    return NextResponse.json({ ok: false, error: "No pudimos preparar una propuesta en este momento. Intentá nuevamente más tarde." });
  }
}
