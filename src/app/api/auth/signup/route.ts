import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { hashInvitationCode } from "@/lib/security/invitation-codes";
import { enforceRateLimit, parseJsonBody, RequestBodyTooLargeError } from "@/lib/security/request-guards";
import { logOperationalEvent } from "@/lib/security/logger";

export const runtime = "nodejs";

const signupSchema = z.object({
  email: z.string().trim().email().max(320),
  password: z.string().min(8).max(1024),
  displayName: z.string().trim().min(2).max(120),
  trainingDimension: z.enum(["juvenil", "alto_rendimiento", "master", "coach"]),
  invitationCode: z.string().trim().min(8).max(32),
});

function unavailable() {
  return NextResponse.json({ ok: false, error: "No pudimos crear la cuenta en este momento. Intentá nuevamente más tarde." });
}

export async function POST(request: Request) {
  const requestId = crypto.randomUUID();
  let invitationId: string | null = null;
  let reservationId: string | null = null;
  try {
    const limit = await enforceRateLimit(request, { scope: "auth-signup", limit: 5, windowMs: 60 * 60_000 });
    if (!limit.allowed) {
      await logOperationalEvent("auth_signup_rate_limited", { requestId, route: "/api/auth/signup", outcome: "warning", status: 429, errorType: "RateLimit" });
      return NextResponse.json({ ok: false, error: "Intentaste crear varias cuentas. Esperá un momento antes de volver a intentar." });
    }
    const payload = await parseJsonBody(request, signupSchema, 8_000);
    const codeHash = hashInvitationCode(payload.invitationCode);
    const client = createServerSupabaseClient();
    if (!codeHash || !client) throw new Error("SignupConfigurationUnavailable");
    reservationId = crypto.randomUUID();
    const { data: reservedId, error: reserveError } = await client.rpc("reserve_invitation_code", { p_code_hash: codeHash, p_reservation_id: reservationId });
    if (reserveError) throw reserveError;
    invitationId = typeof reservedId === "string" ? reservedId : null;
    if (!invitationId) {
      await logOperationalEvent("auth_signup_invitation_rejected", { requestId, route: "/api/auth/signup", outcome: "warning", status: 400, errorType: "InvalidInvitation" });
      return NextResponse.json({ ok: false, error: "El código de invitación no es válido, ya fue utilizado o venció." });
    }
    const { data: created, error: createError } = await client.auth.admin.createUser({
      email: payload.email,
      password: payload.password,
      email_confirm: true,
      user_metadata: { display_name: payload.displayName, training_dimension: payload.trainingDimension },
    });
    if (createError || !created.user) {
      await client.rpc("release_invitation_code", { p_invitation_id: invitationId, p_reservation_id: reservationId });
      invitationId = null;
      return NextResponse.json({ ok: false, error: "No pudimos crear la cuenta con esos datos. Revisalos e intentá nuevamente." });
    }
    const { data: consumed, error: consumeError } = await client.rpc("consume_invitation_code", { p_invitation_id: invitationId, p_reservation_id: reservationId, p_user_id: created.user.id });
    if (consumeError || !consumed) {
      await client.auth.admin.deleteUser(created.user.id);
      invitationId = null;
      throw new Error("InvitationConsumptionFailed");
    }
    invitationId = null;
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    if (!url || !key) throw new Error("MissingAuthConfiguration");
    const authClient = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: sessionData, error: sessionError } = await authClient.auth.signInWithPassword({ email: payload.email, password: payload.password });
    if (sessionError || !sessionData.session) throw new Error("NewUserSessionFailed");
    await logOperationalEvent("auth_signup_completed", { requestId, route: "/api/auth/signup", outcome: "info", status: 201, errorType: "InvitationOnly" });
    return NextResponse.json({ ok: true, accessToken: sessionData.session.access_token, refreshToken: sessionData.session.refresh_token });
  } catch (error) {
    if (invitationId && reservationId) {
      const client = createServerSupabaseClient();
      await client?.rpc("release_invitation_code", { p_invitation_id: invitationId, p_reservation_id: reservationId });
    }
    await logOperationalEvent("auth_signup_failed", { requestId, route: "/api/auth/signup", outcome: "error", status: error instanceof RequestBodyTooLargeError ? 413 : 400, errorType: error instanceof Error ? error.name : "UnknownError" });
    return unavailable();
  }
}
