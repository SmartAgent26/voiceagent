import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthenticatedAdminId } from "@/lib/agent/auth";
import { enforceRateLimit, parseJsonBody, rateLimitHeaders, RequestBodyTooLargeError } from "@/lib/security/request-guards";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const uuid = z.string().uuid();
const planFields = z.object({ name: z.string().trim().min(2).max(80), monthlyBlocks: z.number().int().min(0).max(10_000), priceArs: z.number().nonnegative().nullable() });
const operationSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("plan.create"), data: planFields }), z.object({ action: z.literal("plan.update"), id: uuid, data: planFields.extend({ active: z.boolean() }) }), z.object({ action: z.literal("plan.cancel"), id: uuid }), z.object({ action: z.literal("plan.delete"), id: uuid }), z.object({ action: z.literal("athlete.status"), id: uuid, accountStatus: z.enum(["active", "suspended"]) }), z.object({ action: z.literal("subscription.assign"), athleteId: uuid, planId: uuid }),
  z.object({ action: z.literal("question.create"), data: z.object({ category: z.enum(["contextual", "transformational"]), question: z.string().trim().min(8).max(900), purpose: z.string().trim().max(1400) }) }), z.object({ action: z.literal("question.update"), id: uuid, data: z.object({ category: z.enum(["contextual", "transformational"]), question: z.string().trim().min(8).max(900), purpose: z.string().trim().max(1400) }) }), z.object({ action: z.literal("question.active"), id: uuid, isActive: z.boolean() }), z.object({ action: z.literal("question.delete"), id: uuid }),
  z.object({ action: z.literal("agent.configure"), id: uuid.optional(), data: z.object({ provider: z.enum(["gemini", "openai", "openrouter"]), model: z.string().trim().min(1).max(160), systemPrompt: z.string().trim().min(40).max(30_000), inputPrice: z.number().nonnegative(), outputPrice: z.number().nonnegative() }) }),
]);

export async function POST(request: Request) {
  try {
    const adminId = await getAuthenticatedAdminId(request); const client = createServerSupabaseClient();
    if (!adminId || !client) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
    const limit = await enforceRateLimit(request, { scope: "admin-operations", identity: adminId, limit: 30, windowMs: 60_000 });
    if (!limit.allowed) return NextResponse.json({ error: "Demasiadas modificaciones. Intentá nuevamente en un momento." }, { status: 429, headers: rateLimitHeaders(limit) });
    const operation = await parseJsonBody(request, operationSchema, 40_000);
    const { data: entityId, error } = await client.rpc("perform_admin_operation", { p_admin_id: adminId, p_action: operation.action, p_payload: operation });
    if (error) throw error;
    return NextResponse.json({ ok: true, entityId });
  } catch (error) {
    const status = error instanceof RequestBodyTooLargeError ? 413 : error instanceof z.ZodError ? 400 : 400;
    return NextResponse.json({ error: error instanceof RequestBodyTooLargeError ? error.message : "No fue posible completar la modificación administrativa." }, { status });
  }
}
