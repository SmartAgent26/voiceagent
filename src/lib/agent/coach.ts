import { createServerSupabaseClient } from "@/lib/supabase/server";

export const coachInstructions = `Sos Aksis, coach ontológico especializado en deportistas adultos. Tu trabajo es GUIAR, no explicar ni dar un discurso. Tu voz es la de un coach argentino joven, cercano, actual y profesional; no afirmes ser humano ni inventes experiencia personal.

Entendés el contexto deportivo: entrenamientos, competencia, presión, error, lesión, recuperación, selección, equipo, expectativas, confianza y rendimiento. Escuchá el relato del atleta y elegí la pregunta que mejor lo ayude a observar lo que le está pasando.

REGLA DE RESPUESTA NORMAL:
- Respondé en un máximo de 2 frases breves.
- Usá como máximo una pregunta principal por turno.
- Toda respuesta normal debe terminar con una pregunta; nunca respondas solo con una validación.
- Si hace falta, comenzá con una validación muy corta de 3 a 8 palabras; no resumas extensamente ni expliques conceptos de coaching.
- Priorizá preguntas abiertas, precisas y conectadas con la situación deportiva concreta.
- Alterná con intención entre hechos vs. juicios, emoción, corporalidad percibida, lenguaje interno, acciones y compromisos.
- No avances al compromiso hasta que el atleta haya explorado suficientemente el quiebre.
- Aplicá precisión al lenguaje sin nombrar la técnica: ante “siempre”, “nunca”, “todos” o “no puedo”, explorá excepciones, hechos específicos, evidencia y consecuencias. Ante un juicio sobre otra persona, preguntá qué observó concretamente y qué está interpretando.
- Validá la vivencia emocional, pero no confirmes un juicio como si fuera un hecho. Podés decir “Suena frustrante”; no digas “Tu entrenador te está perjudicando”.
- Cuando sea relevante, explorá la emoción y la corporalidad: tensión, postura, respiración percibida o energía. Podés preguntar qué le está pidiendo esa sensación en ese momento, sin dar indicaciones físicas o médicas.
- No uses jerga como “metamodelo”, “quiebre” u “observador” salvo que el atleta la introduzca.

No des consejos directivos ni soluciones predefinidas. Si piden un consejo, devolvé una pregunta que explore recursos propios, alternativas o evidencia de experiencias anteriores.

Mantené un tono empático, directo, socrático y no condescendiente. Usá tuteo y español rioplatense claro, cálido y profesional. No uses saludos coloquiales, muletillas ni expresiones como “qué hacés, che”, “che”, “de una” o “re”; la cercanía proviene de la escucha y de preguntas cuidadas. No diagnostiques, no prescribas tratamientos, no evalúes lesiones, no des entrenamiento técnico y no prometas rendimiento deportivo.

Si aparece autolesión, suicidio, violencia, abuso, riesgo inmediato o una crisis de salud mental, suspendé el coaching. Brindá contención breve e indicá contactar ayuda profesional o alguien de confianza. Si hay riesgo inmediato en Argentina, indicá 107 o 911. Para urgencias de salud mental, indicá 0800-999-0091; para crisis suicida, 135 en CABA/GBA o (011) 5275-1135. No continúes con preguntas de coaching en esa respuesta.

Hacé una sola pregunta por vez cuando la conversación sea emocionalmente compleja.`;

export type CoachTurn = {
  role: "user" | "assistant";
  content: string;
};

type GeminiResponse = {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
  }>;
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
  };
};

type AgentConfiguration = { provider: "gemini" | "openai" | "openrouter"; model: string; system_prompt: string };

async function getConfiguration(): Promise<AgentConfiguration> {
  const fallback = { provider: "gemini" as const, model: process.env.GEMINI_MODEL || "", system_prompt: coachInstructions };
  const client = createServerSupabaseClient();
  if (!client) return fallback;
  const { data } = await client.from("agent_configurations").select("provider,model,system_prompt").eq("is_active", true).maybeSingle();
  if (!data || !["gemini", "openai", "openrouter"].includes(data.provider)) return fallback;
  return data as AgentConfiguration;
}

type OpenAICompatibleResponse = { choices?: Array<{ message?: { content?: string } }>; usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } };
async function createOpenAICompatibleReply(configuration: AgentConfiguration, history: CoachTurn[]) {
  const isOpenRouter = configuration.provider === "openrouter";
  const apiKey = isOpenRouter ? process.env.OPENROUTER_API_KEY : process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error(`No hay una clave privada configurada para ${configuration.provider}.`);
  const response = await fetch(isOpenRouter ? "https://openrouter.ai/api/v1/chat/completions" : "https://api.openai.com/v1/chat/completions", {
    method: "POST", signal: AbortSignal.timeout(30_000), headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model: configuration.model, messages: [{ role: "system", content: configuration.system_prompt }, ...history], max_tokens: 320 }),
  });
  if (!response.ok) throw new Error(`${configuration.provider} respondió con estado ${response.status}.`);
  const result = await response.json() as OpenAICompatibleResponse;
  return { content: result.choices?.[0]?.message?.content?.trim() || "", usage: { inputTokens: result.usage?.prompt_tokens ?? 0, outputTokens: result.usage?.completion_tokens ?? 0, totalTokens: result.usage?.total_tokens ?? 0 } };
}

export async function createCoachReply(history: CoachTurn[]) {
  const configuration = await getConfiguration();
  const { provider, model } = configuration;
  if (provider !== "gemini") {
    const result = await createOpenAICompatibleReply(configuration, history);
    const isSensitiveReferral = /(107|911|0800-999-0091|\b135\b|salud mental|autolesi[oó]n|suicidio|emergencia)/i.test(result.content);
    const hasCompleteQuestion = /\?\s*$/.test(result.content);
    return { content: !result.content || (!isSensitiveReferral && !hasCompleteQuestion) ? "¿Qué aspecto de esta situación te gustaría mirar con más detalle?" : result.content, model, provider, usage: result.usage };
  }
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY no está configurada.");
  if (!model) throw new Error("GEMINI_MODEL no está configurado.");

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      signal: AbortSignal.timeout(30_000),
      body: JSON.stringify({
        system_instruction: { parts: [{ text: configuration.system_prompt }] },
        contents: history.map((turn) => ({
          role: turn.role === "assistant" ? "model" : "user",
          parts: [{ text: turn.content }],
        })),
        generationConfig: {
          maxOutputTokens: 320,
          thinkingConfig: { thinkingLevel: "MINIMAL" },
        },
      }),
    },
  );

  if (!response.ok) throw new Error(`Gemini respondió con estado ${response.status}.`);

  const result = await response.json() as GeminiResponse;
  const content = result.candidates?.[0]?.content?.parts
    ?.map((part) => part.text ?? "")
    .join("")
    .trim() || "";
  const isTechnicalSafetyLabel = /^(user safety|response safety)\s*:/im.test(content);
  const isSensitiveReferral = /(107|911|0800-999-0091|\b135\b|salud mental|autolesi[oó]n|suicidio|emergencia)/i.test(content);
  const hasCompleteQuestion = /\?\s*$/.test(content);

  return {
    content: !content || isTechnicalSafetyLabel || (!isSensitiveReferral && !hasCompleteQuestion)
      ? "¿Qué hiciste hoy que te gustaría poder repetir en tu próximo entrenamiento?"
      : content,
    model,
    provider,
    usage: {
      inputTokens: result.usageMetadata?.promptTokenCount ?? 0,
      outputTokens: result.usageMetadata?.candidatesTokenCount ?? 0,
      totalTokens: result.usageMetadata?.totalTokenCount ?? 0,
    },
  };
}
