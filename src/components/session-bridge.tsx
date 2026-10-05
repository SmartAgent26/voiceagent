"use client";

import { useEffect } from "react";
import { clearServerSession, synchronizeServerSession } from "@/lib/auth/browser-session";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

export function SessionBridge() {
  useEffect(() => {
    const client = createBrowserSupabaseClient();
    void client.auth.getSession().then(({ data }) => {
      if (data.session?.access_token) void synchronizeServerSession(data.session.access_token);
    });
    const { data: listener } = client.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") void clearServerSession();
      else if (session?.access_token) void synchronizeServerSession(session.access_token);
    });
    return () => listener.subscription.unsubscribe();
  }, []);
  return null;
}
