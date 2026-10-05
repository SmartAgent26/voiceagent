import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { enforceRateLimit, parseJsonBody, RequestBodyTooLargeError } from "@/lib/security/request-guards";
import { logOperationalEvent } from "@/lib/security/logger";

const loginSchema = z.object({ email: z.string().trim().email().max(320), password: z.string().min(1).max(1024) });

function unavailable() {
  return NextResponse.json({ ok: false, error: "No pudimos iniciar sesión. Intentá nuevamente más tarde." });
}

export async function POST(request: Request) {
  const requestId = crypto.randomUUID();
  try {
    const limit = await enforceRateLimit(request, { scope: "auth-login", limit: 8, windowMs: 15 * 60_000 });
    if (!limit.allowed) {
      await logOperationalEvent("auth_login_rate_limited", { requestId, route: "/api/auth/login", outcome: "warning", status: 429, errorType: "RateLimit" });
      return NextResponse.json({ ok: false, error: "Intentaste ingresar varias veces. Esperá unos minutos antes de volver a intentar." });
    }
    const { email, password } = await parseJsonBody(request, loginSchema, 4_000);
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    if (!url || !key) throw new Error("MissingAuthConfiguration");
    const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error || !data.session) {
      await logOperationalEvent("auth_login_rejected", { requestId, route: "/api/auth/login", outcome: "warning", status: 401, errorType: "InvalidCredentials" });
      return NextResponse.json({ ok: false, error: "El correo o la contraseña no son correctos." });
    }
    return NextResponse.json({ ok: true, accessToken: data.session.access_token, refreshToken: data.session.refresh_token });
  } catch (error) {
    await logOperationalEvent("auth_login_failed", { requestId, route: "/api/auth/login", outcome: "error", status: error instanceof RequestBodyTooLargeError ? 413 : 500, errorType: error instanceof Error ? error.name : "UnknownError" });
    return unavailable();
  }
}
