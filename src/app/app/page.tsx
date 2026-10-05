import { AppGate } from "@/components/app-gate";
import { requireAthletePage } from "@/lib/auth/server-session";

export default async function AthletePage() {
  await requireAthletePage();
  return <AppGate />;
}
