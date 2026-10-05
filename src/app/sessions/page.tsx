import { SessionSummaries } from "@/components/session-summaries";
import { requireAthletePage } from "@/lib/auth/server-session";

export default async function SessionsPage() { await requireAthletePage(); return <SessionSummaries />; }
