import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthenticatedAdminId } from "@/lib/agent/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createInvitationCode, hashInvitationCode } from "@/lib/security/invitation-codes";
import { enforceRateLimit, parseJsonBody, rateLimitHeaders, RequestBodyTooLargeError } from "@/lib/security/request-guards";
import { logOperationalEvent } from "@/lib/security/logger";

async function adminRequest(request: Request) {
  const adminId = await getAuthenticatedAdminId(request);
  const client = createServerSupabaseClient();
  if (!adminId || !client) return null;
  const limit = await enforceRateLimit(request, { scope: "admin-invitations", identity: adminId, limit: 20, windowMs: 60_000 });
  if (!limit.allowed) return { adminId, client, limited: limit };
  return { adminId, client, limited: null };
}

export async function GET(request: Request) {
  const access = await adminRequest(request);
  if (!access) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  if (access.limited) return NextResponse.json({ error: "Demasiadas consultas. Intentá nuevamente en un momento." }, { status: 429, headers: rateLimitHeaders(access.limited) });
  const { data, error } = await access.client.from("invitation_codes").select("id,expires_at,used_at,used_by,created_at,disabled_at").order("created_at", { ascending: false }).limit(50);
  if (error) return NextResponse.json({ error: "No pudimos cargar las invitaciones." }, { status: 500 });
  return NextResponse.json({ invitations: data || [] });
}

const invitationActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("disable"), id: z.string().uuid() }),
  z.object({ action: z.literal("extend"), id: z.string().uuid(), hours: z.number().int().min(24).max(24 * 30).refine((hours) => hours % 24 === 0) }),
]);

export async function PATCH(request: Request) {
  const requestId = request.headers.get("x-request-id") || crypto.randomUUID();
  const access = await adminRequest(request);
  if (!access) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  if (access.limited) return NextResponse.json({ error: "Demasiadas modificaciones. Intentá nuevamente en un momento." }, { status: 429, headers: rateLimitHeaders(access.limited) });

  try {
    const action = await parseJsonBody(request, invitationActionSchema, 2_048);
    if (action.action === "disable") {
      const { data, error } = await access.client
        .from("invitation_codes")
        .update({ disabled_at: new Date().toISOString(), disabled_by: access.adminId })
        .eq("id", action.id)
        .is("used_at", null)
        .is("disabled_at", null)
        .select("id")
        .maybeSingle();
      if (error || !data) throw error || new Error("InvitationCannotBeDisabled");
      await logOperationalEvent("invitation_disabled", { requestId, route: "/api/admin/invitations", outcome: "info", status: 200 });
      return NextResponse.json({ ok: true });
    }

    const { data: current, error: currentError } = await access.client
      .from("invitation_codes")
      .select("id,expires_at,used_at,disabled_at")
      .eq("id", action.id)
      .maybeSingle();
    if (currentError || !current || current.used_at || current.disabled_at) throw currentError || new Error("InvitationCannotBeExtended");

    const baseTime = Math.max(Date.now(), new Date(current.expires_at).getTime());
    const expiresAt = new Date(baseTime + action.hours * 60 * 60_000).toISOString();
    const { data, error } = await access.client
      .from("invitation_codes")
      .update({ expires_at: expiresAt })
      .eq("id", action.id)
      .is("used_at", null)
      .is("disabled_at", null)
      .select("id,expires_at")
      .maybeSingle();
    if (error || !data) throw error || new Error("InvitationExtendFailed");
    await logOperationalEvent("invitation_extended", { requestId, route: "/api/admin/invitations", outcome: "info", status: 200, errorType: `Hours${action.hours}` });
    return NextResponse.json({ ok: true, invitation: data });
  } catch (error) {
    const status = error instanceof RequestBodyTooLargeError ? 413 : 400;
    await logOperationalEvent("invitation_manage_failed", { requestId, route: "/api/admin/invitations", outcome: "error", status, errorType: error instanceof Error ? error.name : "UnknownError" });
    return NextResponse.json({ error: "No pudimos actualizar el código de invitación." }, { status });
  }
}

export async function POST(request: Request) {
  const requestId = request.headers.get("x-request-id") || crypto.randomUUID();
  const access = await adminRequest(request);
  if (!access) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  if (access.limited) return NextResponse.json({ error: "Demasiadas modificaciones. Intentá nuevamente en un momento." }, { status: 429, headers: rateLimitHeaders(access.limited) });
  try {
    const code = createInvitationCode();
    const codeHash = hashInvitationCode(code);
    if (!codeHash) throw new Error("InvitationConfigurationUnavailable");
    const expiresAt = new Date(Date.now() + 72 * 60 * 60_000).toISOString();
    const { data, error } = await access.client.from("invitation_codes").insert({ code_hash: codeHash, created_by: access.adminId, expires_at: expiresAt }).select("id,expires_at").single();
    if (error || !data) throw error || new Error("InvitationCreateFailed");
    await logOperationalEvent("invitation_created", { requestId, route: "/api/admin/invitations", outcome: "info", status: 201, errorType: "Invitation72Hours" });
    return NextResponse.json({ ok: true, invitation: { id: data.id, code, expiresAt: data.expires_at } });
  } catch (error) {
    await logOperationalEvent("invitation_create_failed", { requestId, route: "/api/admin/invitations", outcome: "error", status: 400, errorType: error instanceof Error ? error.name : "UnknownError" });
    return NextResponse.json({ ok: false, error: "No pudimos generar el código de invitación." });
  }
}
