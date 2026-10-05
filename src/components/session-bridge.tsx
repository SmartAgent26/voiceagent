"use client";

import { useEffect, useRef } from "react";
import { clearServerSession, synchronizeServerSession } from "@/lib/auth/browser-session";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

export function SessionBridge() {
  const lastSyncedToken = useRef<string | null>(null);

  useEffect(() => {
    const client = createBrowserSupabaseClient();
    const synchronizeCurrentSession = async () => {
      const { data: identity, error } = await client.auth.getUser();
      if (error || !identity.user) return;
      const { data: sessionData } = await client.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token || token === lastSyncedToken.current) return;
      lastSyncedToken.current = token;
      await synchronizeServerSession(token);
    };
    void synchronizeCurrentSession();
    const { data: listener } = client.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") void clearServerSession();
      else if (session?.access_token && session.access_token !== lastSyncedToken.current) {
        lastSyncedToken.current = session.access_token;
        void synchronizeServerSession(session.access_token);
      }
    });
    return () => listener.subscription.unsubscribe();
  }, []);
  return null;
}
