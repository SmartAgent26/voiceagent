import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getProviderApiKey } from "@/lib/agent/credentials";
import { ontologicalCoachPrompt } from "@/lib/agent/ontological-prompt";

export const coachInstructions = `Sos Aksis, coach ontológico especializado en deportistas adultos. Tu trabajo es GUIAR, no explicar ni dar un discurso. Tu voz es la de un coach argentino joven, cercano, actual y profesional; no afirmes ser humano ni inventes experiencia personal.

ROL Y OBJETIVO ONTOLÓGICO:
No sos entrenador técnico ni consultor. Acompañás a deportistas de formación, competencia y alto rendimiento a observar cómo interpretan su experiencia, identificar el obstáculo o creencia que los limita y abrir nuevas posibilidades de acción. Trabajás la coherencia entre lenguaje, emoción y corporalidad.

METODOLOGÍA:
- Priorizá indagar antes de proponer: una pregunta abierta, concreta y conectada con su situación.
- Diferenciá hechos comprobables de juicios e interpretaciones. Ante generalizaciones, supresiones o distorsiones, pedí precisión y explorá excepciones sin nombrar la técnica.
- Ante "nunca", "siempre", "todos", "no puedo" o juicios sobre terceros, preguntá qué ocurrió específicamente, qué evidencia tiene y qué está interpretando.
- Explorá, cuando sea pertinente, emoción predominante y corporalidad percibida: tensión, postura, respiración o energía. No des indicaciones físicas ni médicas.
- Conservá presentes sus objetivos deportivos. No los impongas: explorá qué relación encuentra la persona entre la situación presente y aquello que busca construir.

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

const conversationStyleInstructions = `

ESTILO CONVERSACIONAL Y FORMATO (aplica siempre, aun cuando el prompt editable no lo mencione):
- Construí un diálogo seguro y humano antes de profundizar: reconocé brevemente la vivencia concreta que trae la persona, con calidez y sin frases vacías ni elogios automáticos.
- Cuando no haya un quiebre puntual y la persona solo quiera conversar, acompañá el ritmo con curiosidad amable. No encadenes preguntas ni fuerces el análisis; ofrecé una sola invitación clara para continuar.
- Mantené respuestas breves: una validación genuina y una única pregunta abierta, precisa y cuidada. Variá las aperturas para no repetir “entiendo” o fórmulas mecánicas.
- Usá la conversación previa para avanzar: no repitas una pregunta, ni una versión apenas reformulada, si la persona ya la respondió. Retomá un detalle específico de lo que dijo y profundizá sobre un único hilo antes de cambiar de tema.
- Alterná la profundidad con sentido: primero escuchá y reflejá, luego precisá hechos o juicios, emoción o cuerpo cuando aporte, y más adelante ayudá a reconocer una nueva mirada. No conviertas cada turno en la misma pregunta genérica.
- No abras un turno normal con una pregunta suelta. Primero enlazá la pregunta con la última respuesta del atleta mediante una observación breve y concreta: nombrá un hecho, una palabra, una emoción, una tensión o el objetivo que él mismo trajo, y explicá implícitamente por qué vale la pena mirar eso ahora.
- La pregunta no es un fin en sí mismo: elegila para que el deportista pueda avanzar hacia el resultado que declaró, sus objetivos y los desafíos psicológicos o relacionales de su deporte. Conocé el contexto del deporte, pero no des técnica, táctica, diagnósticos ni garantías de resultado.
- Usá la memoria interna de perfil, bitácora y resúmenes solo cuando agregue continuidad real. Nunca digas que estás leyendo una herramienta, una base de datos o un resumen interno.
- Si el deportista expresa que necesita irse, cortar, pausar o retomar otro día, no hagas otra pregunta ni intentes prolongar la sesión. Despedite de forma breve y cálida: validá que puede retomar cuando quiera y cerrá con un buen deseo.
- Escribí con Markdown legible: párrafos cortos y separados. Si necesitás presentar dos o más objetivos, hechos, opciones o elementos, introducilos con una frase breve y usá una lista con viñetas. No uses listas para una respuesta conversacional simple.
- Conservá siempre la metodología ontológica: la calidez no implica resolver, aconsejar ni confirmar juicios como hechos.`;

export type CoachTurn = {
  role: "user" | "assistant";
  content: string;
};

type GeminiResponse = {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string; thought?: boolean }> };
  }>;
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
  };
};

function visibleGeminiText(result: GeminiResponse) {
  return result.candidates?.[0]?.content?.parts
    ?.filter((part) => !part.thought)
    .map((part) => part.text ?? "")
    .join("")
    .trim() || "";
}

function isSafeCompactSummary(content: string) {
  return Boolean(content) && !/(^|\n)\s*(the user wants|analysis of the session|drafting summary|constraints:|internal process|system prompt)/i.test(content);
}

export function separateSummaryFocus(content: string) {
  const match = content.match(/\[\[FOCO_RELEVANTE:\s*([^\]]*)\]\]/i);
  const focus = match?.[1]?.trim() || null;
  return { summary: content.replace(/\s*\[\[FOCO_RELEVANTE:\s*[^\]]*\]\]\s*/i, " ").replace(/\s+/g, " ").trim(), focus };
}

type AgentConfiguration = { provider: "gemini" | "openai" | "openrouter"; model: string; system_prompt: string };
type AgentReferenceQuestion = { category: "contextual" | "transformational"; question: string; purpose: string; position: number };

async function getConfiguration(): Promise<AgentConfiguration> {
  const fallback = { provider: "gemini" as const, model: process.env.GEMINI_MODEL || "", system_prompt: ontologicalCoachPrompt };
  const client = createServerSupabaseClient();
  if (!client) return fallback;
  const { data } = await client.from("agent_configurations").select("provider,model,system_prompt").eq("is_active", true).maybeSingle();
  if (!data || !["gemini", "openai", "openrouter"].includes(data.provider)) return fallback;
  return data as AgentConfiguration;
}

async function getReferenceQuestionGuide() {
  const client = createServerSupabaseClient();
  if (!client) return "";
  const { data, error } = await client.from("agent_reference_questions").select("category,question,purpose,position").eq("is_active", true).order("position");
  if (error || !data?.length) return "";
  const questions = data as AgentReferenceQuestion[];
  const items = questions.map((item) => `- [${item.category === "contextual" ? "Encuadre" : "Transformacional"}] ${item.question}${item.purpose ? ` (Intención: ${item.purpose})` : ""}`).join("\n");
  return `\n\nBIBLIOTECA CONFIGURABLE DE PREGUNTAS DE REFERENCIA:\n${items}\n\nNo las uses como guion ni las recites en secuencia. Elegí o adaptá una solamente cuando sea pertinente a lo que ya expresó el deportista. Si una pregunta, su intención o su dominio ya fue explorado, avanzá desde esa respuesta en vez de repetirla.`;
}

type OpenAICompatibleResponse = { choices?: Array<{ message?: { content?: string } }>; usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } };
async function createOpenAICompatibleReply(configuration: AgentConfiguration, history: CoachTurn[]) {
  const isOpenRouter = configuration.provider === "openrouter";
  const apiKey = await getProviderApiKey(configuration.provider);
  if (!apiKey) throw new Error(`No hay una clave privada configurada para ${configuration.provider}.`);
  const response = await fetch(isOpenRouter ? "https://openrouter.ai/api/v1/chat/completions" : "https://api.openai.com/v1/chat/completions", {
    method: "POST", signal: AbortSignal.timeout(30_000), headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model: configuration.model, messages: [{ role: "system", content: configuration.system_prompt }, ...history], max_tokens: 320 }),
  });
  if (!response.ok) throw new Error(`${configuration.provider} respondió con estado ${response.status}.`);
  const result = await response.json() as OpenAICompatibleResponse;
  return { content: result.choices?.[0]?.message?.content?.trim() || "", usage: { inputTokens: result.usage?.prompt_tokens ?? 0, outputTokens: result.usage?.completion_tokens ?? 0, totalTokens: result.usage?.total_tokens ?? 0 } };
}

export function interpolatePromptVariables(template: string, variables: Record<string, string> = {}) {
  return template.replace(/@([a-z_]+)/gi, (match, name: string) => variables[name.toLowerCase()] || match);
}

export async function createCoachReply(history: CoachTurn[], athleteContext = "", variables: Record<string, string> = {}) {
  const configuration = await getConfiguration();
  const { provider, model } = configuration;
  const referenceQuestionGuide = await getReferenceQuestionGuide();
  const resolvedPrompt = `${interpolatePromptVariables(configuration.system_prompt, variables)}${conversationStyleInstructions}${referenceQuestionGuide}`;
  const contextualConfiguration = athleteContext ? { ...configuration, system_prompt: `${resolvedPrompt}\n\nCONTEXTO PRIVADO DEL DEPORTISTA (usalo con discreción; no lo recites):\n${athleteContext}` } : { ...configuration, system_prompt: resolvedPrompt };
  if (provider !== "gemini") {
    const result = await createOpenAICompatibleReply(contextualConfiguration, history);
    const isSensitiveReferral = /(107|911|0800-999-0091|\b135\b|salud mental|autolesi[oó]n|suicidio|emergencia)/i.test(result.content);
    const hasCompleteQuestion = /\?\s*$/.test(result.content);
    return { content: !result.content || (!isSensitiveReferral && !hasCompleteQuestion) ? "¿Qué aspecto de esta situación te gustaría mirar con más detalle?" : result.content, model, provider, usage: result.usage };
  }
  const apiKey = await getProviderApiKey("gemini");
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
        system_instruction: { parts: [{ text: contextualConfiguration.system_prompt }] },
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
  const content = visibleGeminiText(result);
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

export async function createCompactSummary(source: string, kind: "session" | "weekly_journal") {
  const configuration = await getConfiguration();
  const instruction = kind === "session"
    ? "Sos un proceso interno de Aksis. Resumí esta sesión de coaching en español rioplatense en máximo 90 palabras. Conservá únicamente: tema o quiebre principal, hechos versus juicios relevantes, emoción/corporalidad mencionadas, hallazgo o nueva mirada del deportista y compromiso propio si existió. No des consejos, no inventes información, no uses viñetas ni encabezados. Al final agregá exactamente [[FOCO_RELEVANTE: tema breve]] solo si quedó un tema vivo que el coach debe sostener en próximas conversaciones hasta que el deportista diga que ya no quiere hablar de él; si no corresponde, usá [[FOCO_RELEVANTE:]]."
    : "Sos un proceso interno de Aksis. Resumí estos registros semanales de Bitácora en español rioplatense en máximo 110 palabras. Conservá patrones relevantes de estado emocional/corporal, situaciones deportivas, objetivos vinculados, recursos o tensiones recurrentes. No des consejos, no inventes información, no uses viñetas ni encabezados.";
  const material = source.slice(0, 12000);
  if (configuration.provider !== "gemini") {
    const result = await createOpenAICompatibleReply({ ...configuration, system_prompt: instruction }, [{ role: "user", content: material }]);
    const summary = result.content.slice(0, 2400);
    return isSafeCompactSummary(summary) ? summary : "";
  }
  const apiKey = await getProviderApiKey("gemini");
  if (!apiKey) throw new Error("GEMINI_API_KEY no está configurada.");
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(configuration.model)}:generateContent`, {
    method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey }, signal: AbortSignal.timeout(30_000),
    body: JSON.stringify({ system_instruction: { parts: [{ text: instruction }] }, contents: [{ role: "user", parts: [{ text: material }] }], generationConfig: { maxOutputTokens: 180, thinkingConfig: { thinkingLevel: "MINIMAL" } } }),
  });
  if (!response.ok) throw new Error(`Gemini respondió con estado ${response.status}.`);
  const result = await response.json() as GeminiResponse;
  const summary = visibleGeminiText(result).slice(0, 2400);
  return isSafeCompactSummary(summary) ? summary : "";
}
