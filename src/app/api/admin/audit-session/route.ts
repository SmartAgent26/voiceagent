import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthenticatedAdminId } from "@/lib/agent/auth";
import { enforceRateLimit, parseJsonBody, rateLimitHeaders } from "@/lib/security/request-guards";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const schema = z.object({ action: z.enum(["admin_login", "admin_logout"]) });

export async function POST(request: Request) {
  try {
    const adminId = await getAuthenticatedAdminId(request);
    const client = createServerSupabaseClient();
    if (!adminId || !client) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
    const limit = await enforceRateLimit(request, { scope: "admin-audit-session", identity: adminId, limit: 10, windowMs: 60_000 });
    if (!limit.allowed) return NextResponse.json({ error: "Demasiadas solicitudes." }, { status: 429, headers: rateLimitHeaders(limit) });
    const { action } = await parseJsonBody(request, schema, 500);
    const { error } = await client.from("audit_log").insert({ actor_id: adminId, action, entity_type: "auth", entity_id: null, metadata: { source: "admin_shell" } });
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "No pudimos registrar el evento de acceso." }, { status: 400 });
  }
}
