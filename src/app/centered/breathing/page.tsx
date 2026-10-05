import { BreathingPractice } from "@/components/breathing-practice";
import { requireAthletePage } from "@/lib/auth/server-session";
export default async function BreathingPage(){await requireAthletePage();return <BreathingPractice/>}
