import { Journal } from "@/components/journal";
import { requireAthletePage } from "@/lib/auth/server-session";
export default async function JournalPage() { await requireAthletePage(); return <Journal />; }
