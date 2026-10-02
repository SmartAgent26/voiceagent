import { NextResponse } from "next/server";
import { z } from "zod";
import { createCoachReply } from "@/lib/agent/coach";

const requestSchema = z.object({
  history: z.array(
    z.object({
      role: z.enum(["user", "assistant"]),
      content: z.string().trim().min(1).max(4_000),
    }),
  ).min(1).max(20),
});

export async function POST(request: Request) {
  try {
    const payload = requestSchema.parse(await request.json());
    return NextResponse.json(await createCoachReply(payload.history));
  } catch (error) {
    if (!(error instanceof z.ZodError)) console.error("Coach request failed", error);
    const message = error instanceof z.ZodError
      ? "El mensaje no tiene un formato válido."
      : "No fue posible conectar con el agente. Intentá nuevamente.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
