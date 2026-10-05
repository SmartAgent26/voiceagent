"use client";

export async function synchronizeServerSession(accessToken: string) {
  try {
    const response = await fetch("/api/auth/session", {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function clearServerSession() {
  await fetch("/api/auth/session", { method: "DELETE", cache: "no-store" });
}
