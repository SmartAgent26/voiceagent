import { AthleteChat } from "@/components/athlete-chat";
import { requireAthletePage } from "@/lib/auth/server-session";

export default async function ChatPage() {
  await requireAthletePage();
  return <AthleteChat />;
}
