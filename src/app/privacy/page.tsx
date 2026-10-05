import { PrivacyRights } from "@/components/privacy-rights";
import { requireAthletePage } from "@/lib/auth/server-session";

export default async function PrivacyPage() {
  await requireAthletePage();
  return <PrivacyRights />;
}
