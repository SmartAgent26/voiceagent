import { NextResponse } from "next/server";
import { SERVER_SESSION_COOKIE } from "@/lib/auth/server-session";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { logOperationalEvent } from "@/lib/security/logger";

const cookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: 60 * 60,
};

export async function POST(request: Request) {
  const requestId = crypto.randomUUID();
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const client = createServerSupabaseClient();
  if (!token || !client) {
    await logOperationalEvent("auth_session_sync_failed", { requestId, route: "/api/auth/session", outcome: "warning", status: 401, errorType: "MissingSessionOrServerConfig" });
    return NextResponse.json({ ok: false });
  }
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) {
    await logOperationalEvent("auth_session_sync_rejected", { requestId, route: "/api/auth/session", outcome: "warning", status: 401, errorType: "InvalidSession" });
    return NextResponse.json({ ok: false });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(SERVER_SESSION_COOKIE, token, cookieOptions);
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SERVER_SESSION_COOKIE, "", { ...cookieOptions, maxAge: 0 });
  return response;
}
