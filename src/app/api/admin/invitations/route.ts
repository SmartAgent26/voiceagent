import { NextResponse } from "next/server";
import { getAuthenticatedAdminId } from "@/lib/agent/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createInvitationCode, hashInvitationCode } from "@/lib/security/invitation-codes";
import { enforceRateLimit, rateLimitHeaders } from "@/lib/security/request-guards";
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
  const { data, error } = await access.client.from("invitation_codes").select("id,expires_at,used_at,used_by,created_at").order("created_at", { ascending: false }).limit(30);
  if (error) return NextResponse.json({ error: "No pudimos cargar las invitaciones." }, { status: 500 });
  return NextResponse.json({ invitations: data || [] });
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
