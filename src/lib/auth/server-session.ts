import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const SERVER_SESSION_COOKIE = "aksis_server_session";

type ServerProfile = {
  id: string;
  role: string;
  account_status: string;
};

export async function getServerSessionProfile(): Promise<ServerProfile | null> {
  const accessToken = (await cookies()).get(SERVER_SESSION_COOKIE)?.value;
  const client = createServerSupabaseClient();
  if (!accessToken || !client) return null;

  const { data: authData, error: authError } = await client.auth.getUser(accessToken);
  if (authError || !authData.user) return null;
  const { data: profile, error: profileError } = await client
    .from("profiles")
    .select("id,role,account_status")
    .eq("id", authData.user.id)
    .maybeSingle();
  if (profileError || !profile) return null;
  return profile as ServerProfile;
}

export async function requireAthletePage() {
  const profile = await getServerSessionProfile();
  if (!profile || profile.account_status !== "active") redirect("/access");
  if (profile.role === "superadmin") redirect("/admin");
  return profile;
}

export async function requireSuperadminPage() {
  const profile = await getServerSessionProfile();
  if (!profile || profile.account_status !== "active" || profile.role !== "superadmin") redirect("/access");
  return profile;
}
