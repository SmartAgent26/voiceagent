import { createServerSupabaseClient } from "@/lib/supabase/server";

async function authenticatedProfile(request: Request) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const client = createServerSupabaseClient();
  if (!token || !client) return null;
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) return null;
  const { data: profile } = await client.from("profiles").select("id,role,account_status").eq("id", data.user.id).maybeSingle();
  return profile || null;
}

export async function getAuthenticatedAthleteId(request: Request) {
  const profile = await authenticatedProfile(request);
  if (!profile || profile.account_status === "suspended") return null;
  return profile.id;
}

export async function getAuthenticatedAdminId(request: Request) {
  const profile = await authenticatedProfile(request);
  return profile?.role === "superadmin" && profile.account_status !== "suspended" ? profile.id : null;
}
