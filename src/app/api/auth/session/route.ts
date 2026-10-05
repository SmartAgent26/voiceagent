import { NextResponse } from "next/server";
import { SERVER_SESSION_COOKIE } from "@/lib/auth/server-session";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const cookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: 60 * 60,
};

export async function POST(request: Request) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const client = createServerSupabaseClient();
  if (!token || !client) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) return NextResponse.json({ error: "No autorizado." }, { status: 401 });

  const response = NextResponse.json({ ok: true });
  response.cookies.set(SERVER_SESSION_COOKIE, token, cookieOptions);
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SERVER_SESSION_COOKIE, "", { ...cookieOptions, maxAge: 0 });
  return response;
}
