import { Centered } from "@/components/centered";
import { requireAthletePage } from "@/lib/auth/server-session";
export default async function CenteredPage(){await requireAthletePage();return <Centered/>}
