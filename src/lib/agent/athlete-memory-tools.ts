import { createServerSupabaseClient } from "@/lib/supabase/server";

type SessionMemory = { context_summary: string | null; ended_at: string | null };
type JournalMemory = { title: string | null; mood: string | null; content: string; occurred_at: string; goal_id: string | null };
type CalendarMemory = { title: string; starts_at: string; all_day: boolean; custom_label: string | null; expected_state: string | null; notes: string | null };

const unsafeSummary = /(^|\n)\s*(the user wants|analysis of the session|drafting summary|constraints:|internal process|system prompt)/i;
const compact = (value: string, limit: number) => value.replace(/\s+/g, " ").trim().slice(0, limit);
const dateLabel = (value: string | null) => value ? new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "short" }).format(new Date(value)) : "sin fecha";

/**
 * Fuentes internas de contexto del atleta. Se consultan del lado del servidor
 * antes de cada respuesta y nunca se exponen al navegador ni a otro usuario.
 */
export const athleteMemoryTools = {
  async recentSessionSummaries(athleteId: string) {
    const client = createServerSupabaseClient();
    if (!client) return [];
    const { data } = await client.from("coaching_sessions").select("context_summary,ended_at").eq("athlete_id", athleteId).eq("status", "closed").not("context_summary", "is", null).order("ended_at", { ascending: false }).limit(3);
    return ((data || []) as SessionMemory[]).flatMap((item) => item.context_summary && !unsafeSummary.test(item.context_summary) ? [`${dateLabel(item.ended_at)}: ${compact(item.context_summary, 520)}`] : []);
  },
  async recentJournalEntries(athleteId: string) {
    const client = createServerSupabaseClient();
    if (!client) return [];
    const { data } = await client.from("journal_entries").select("title,mood,content,occurred_at,goal_id").eq("athlete_id", athleteId).order("occurred_at", { ascending: false }).limit(5);
    return ((data || []) as JournalMemory[]).map((item) => {
      const metadata = [item.title, item.mood ? `estado: ${item.mood}` : ""].filter(Boolean).join(" · ");
      return `${dateLabel(item.occurred_at)}${metadata ? ` · ${metadata}` : ""}: ${compact(item.content, 620)}`;
    });
  },
  async upcomingEvents(athleteId: string) {
    const client = createServerSupabaseClient();
    if (!client) return [];
    const now = new Date(); const until = new Date(now); until.setDate(until.getDate() + 21);
    const { data } = await client.from("calendar_events").select("title,starts_at,all_day,custom_label,expected_state,notes").eq("athlete_id", athleteId).gte("starts_at", now.toISOString()).lte("starts_at", until.toISOString()).order("starts_at").limit(5);
    return ((data || []) as CalendarMemory[]).map((item) => `${dateLabel(item.starts_at)}${item.all_day ? " · todo el día" : ""}: ${item.title}${item.custom_label ? ` · ${item.custom_label}` : ""}${item.expected_state ? ` · predisposición: ${item.expected_state}` : ""}${item.notes ? ` · ${compact(item.notes, 240)}` : ""}`);
  },
};

export async function reviewAthleteMemory(athleteId: string) {
  const [sessionSummaries, journalEntries, upcomingEvents] = await Promise.all([
    athleteMemoryTools.recentSessionSummaries(athleteId),
    athleteMemoryTools.recentJournalEntries(athleteId),
    athleteMemoryTools.upcomingEvents(athleteId),
  ]);
  return { sessionSummaries, journalEntries, upcomingEvents };
}
