"use client";

export async function synchronizeServerSession(accessToken: string) {
  await fetch("/api/auth/session", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
}

export async function clearServerSession() {
  await fetch("/api/auth/session", { method: "DELETE", cache: "no-store" });
}
