import { CalendarEvents } from "@/components/calendar-events";
import { requireAthletePage } from "@/lib/auth/server-session";

export default async function CalendarPage() {
  await requireAthletePage();
  return <CalendarEvents />;
}
