import { NextResponse } from "next/server";
import { z } from "zod";
import { createCoachReply } from "@/lib/agent/coach";
import { assessCoachInput } from "@/lib/agent/safety";
import { logOperationalEvent } from "@/lib/security/logger";
import { buildAthleteContext } from "@/lib/agent/athlete-context";
import { getAuthenticatedAthleteId } from "@/lib/agent/auth";
import { hasProcessingConsent } from "@/lib/privacy/processing-consents";
import { enforceRateLimit, parseJsonBody, rateLimitHeaders, RequestBodyTooLargeError } from "@/lib/security/request-guards";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type BlockCharge = {
  session_found: boolean;
  allowed: boolean;
  blocks_remaining: number;
  additional_blocks: number;
  required_blocks: number;
};

const requestSchema = z.object({
  message: z.string().trim().min(1).max(4_000),
  sessionId: z.string().uuid(),
  requestId: z.string().uuid(),
});
function wantsToClose(message: string) {
  return /(me\s+(tengo que|debo)\s+(ir|salir)|me\s+voy|tengo que\s+(cortar|salir)|quiero\s+(cerrar|terminar|dejar)\s+(la\s+)?(conversaci[oó]n|sesi[oó]n)|podemos\s+retomar|seguimos?\s+(otro\s+d[ií]a|m[aá]s\s+tarde|ma[nñ]ana)|hasta\s+(luego|pronto|ma[nñ]ana))/i.test(message);
}

function firstName(value: string | undefined) {
  const name = value?.trim();
  return name && name !== "el deportista" ? name.split(/\s+/)[0] : "";
}

function wantsToReleaseFocus(message: string) {
  return /(no\s+quiero\s+(hablar|seguir|volver)\s+(m[aá]s\s+)?(de\s+)?(esto|eso|ese\s+tema)|dejemos\s+(esto|eso|ese\s+tema)|cambiemos\s+de\s+tema|ya\s+no\s+quiero\s+trabajar\s+eso)/i.test(message);
}

function explicitlyRequestsGoalList(message: string) {
  return /(cu[aá]les\s+(son|tengo)|record[aá]me|decime|mostrame|repasemos)[^?.!]{0,70}\bobjetiv(?:o|os)\b|\bobjetiv(?:o|os)\b[^?.!]{0,70}(cu[aá]les\s+(son|tengo)|record[aá]me|decime|mostrame|repasemos)/i.test(message);
}

export async function POST(request: Request) {
  const requestId = request.headers.get("x-request-id") || crypto.randomUUID();
  try {
    const ipLimit = await enforceRateLimit(request, { scope: "coach-ip", limit: 30, windowMs: 60_000 });
    if (!ipLimit.allowed) return NextResponse.json({ error: "Hiciste muchas solicitudes. Esperá un momento antes de continuar." }, { status: 429, headers: rateLimitHeaders(ipLimit) });
    const payload = await parseJsonBody(request, requestSchema, 24_000);
    const athleteId = await getAuthenticatedAthleteId(request);
    if (!athleteId) return NextResponse.json({ error: "Tu sesión no es válida o el acceso está suspendido." }, { status: 401 });
    if (!await hasProcessingConsent(athleteId, "ai_coaching")) return NextResponse.json({ error: "Necesitás autorizar el acompañamiento con IA para iniciar esta conversación." }, { status: 403 });
    const userLimit = await enforceRateLimit(request, { scope: "coach-user", identity: athleteId, limit: 12, windowMs: 60_000 });
    if (!userLimit.allowed) return NextResponse.json({ error: "Hiciste muchas solicitudes. Esperá un momento antes de continuar." }, { status: 429, headers: rateLimitHeaders(userLimit) });
    const client = createServerSupabaseClient();
    if (!client) throw new Error("No hay configuración de servidor para Supabase.");
    const { data, error: chargeError } = await client.rpc("charge_session_blocks", { p_athlete_id: athleteId, p_session_id: payload.sessionId }).maybeSingle();
    const charge = data as BlockCharge | null;
    if (chargeError) throw chargeError;
    if (!charge?.session_found) return NextResponse.json({ error: "La sesión de coaching no está disponible." }, { status: 404 });
    if (!charge.allowed) return NextResponse.json({ error: "No te quedan bloques disponibles para continuar esta sesión.", blocksRequired: charge.additional_blocks, blocksAvailable: charge.blocks_remaining }, { status: 402 });
    const blocksRemaining = charge.blocks_remaining;

    const { data: persistedMessages, error: historyError } = await client
      .from("session_messages")
      .select("sender, content")
      .eq("session_id", payload.sessionId)
      .order("created_at", { ascending: false })
      .limit(20);
    if (historyError) throw historyError;
    const recentHistory = (persistedMessages || [])
      .reverse()
      .map((message) => ({ role: message.sender === "assistant" ? "assistant" as const : "user" as const, content: message.content }))
      .concat({ role: "user" as const, content: payload.message });
    const lastUserMessage = { role: "user" as const, content: payload.message };
    const safety = assessCoachInput(lastUserMessage.content);
    const athleteContext = await buildAthleteContext(athleteId);
    const unavailableSources = Object.entries(athleteContext.availability)
      .filter(([, available]) => !available)
      .map(([source]) => source);
    if (unavailableSources.length) {
      await logOperationalEvent("coach_context_source_unavailable", {
        requestId,
        route: "/api/coach",
        outcome: "warning",
        status: 503,
        errorType: unavailableSources.join(",").slice(0, 180),
      });
    }
    const asksForGoalList = Boolean(lastUserMessage && explicitlyRequestsGoalList(lastUserMessage.content));
    const knownGoals = athleteContext.variables.objetivos && athleteContext.variables.objetivos !== "no informados";
    const athleteName = firstName(athleteContext.variables.nombre);
    const reply = safety.blocked
      ? { content: safety.response || "Por cuidado, pausamos este diálogo y buscamos apoyo adecuado.", model: "safety-guard", provider: "aksis", usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 } }
      : lastUserMessage && wantsToClose(lastUserMessage.content)
      ? { content: `Claro${athleteName ? `, ${athleteName}` : ""}. Gracias por compartir este momento. Podemos retomar cuando quieras, desde donde lo dejamos. Que tengas un buen día.`, model: "cierre-de-sesión", provider: "aksis", usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 } }
      : asksForGoalList && !athleteContext.availability.goals
      ? { content: "Ahora no pude recuperar tus objetivos. Probá nuevamente en un momento y los revisamos juntos.", model: "contexto-no-disponible", provider: "aksis", usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 } }
      : asksForGoalList && knownGoals
      ? { content: `Claro${athleteName ? `, ${athleteName}` : ""}. Estos son los objetivos que hoy tenemos presentes:\n\n${athleteContext.variables.objetivos.split(" · ").map((goal) => `- ${goal}`).join("\n")}\n\n¿Cuál te gustaría mirar primero?`, model: "perfil-actualizado", provider: "aksis", usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 } }
      : asksForGoalList
      ? { content: `Quiero acompañarte con eso${athleteName ? `, ${athleteName}` : ""}. Por ahora no encuentro objetivos activos registrados en tu espacio. ¿Qué te gustaría transformar en tu experiencia deportiva para que armemos uno juntos?`, model: "perfil-sin-objetivos", provider: "aksis", usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 } }
      : await createCoachReply(recentHistory, athleteContext.context, athleteContext.variables);
    const { data: persisted, error: persistError } = await client
      .rpc("persist_coach_exchange", {
        p_athlete_id: athleteId,
        p_session_id: payload.sessionId,
        p_request_id: payload.requestId,
        p_athlete_content: lastUserMessage.content,
        p_assistant_content: reply.content,
        p_model: reply.model,
        p_provider: reply.provider,
        p_input_tokens: reply.usage.inputTokens,
        p_output_tokens: reply.usage.outputTokens,
        p_total_tokens: reply.usage.totalTokens,
        p_release_focus: wantsToReleaseFocus(lastUserMessage.content),
      })
      .maybeSingle();
    if (persistError) throw persistError;
    if (!(persisted as { session_found?: boolean } | null)?.session_found) {
      return NextResponse.json({ error: "La sesión de coaching no está disponible." }, { status: 404 });
    }
    return NextResponse.json({ ok: true, ...reply, blocksRemaining }, { headers: { "X-Request-Id": requestId } });
  } catch (error) {
    await logOperationalEvent("coach_request_failed", { requestId, route: "/api/coach", outcome: error instanceof z.ZodError || error instanceof RequestBodyTooLargeError ? "warning" : "error", status: error instanceof RequestBodyTooLargeError ? 413 : 400, errorType: error instanceof Error ? error.name : "UnknownError" });
    const message = error instanceof z.ZodError || error instanceof RequestBodyTooLargeError
      ? "No pudimos procesar ese mensaje. Intentá nuevamente."
      : "No pudimos continuar la conversación en este momento. Intentá nuevamente más tarde.";
    return NextResponse.json({ ok: false, error: message });
  }
}
