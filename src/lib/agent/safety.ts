export type SafetyDecision = { blocked: boolean; response?: string; category?: "crisis" | "medical" | "technical" };

const crisisPattern = /\b(suicid|matarme|quitarme la vida|autolesi[oó]n|hacerme da[nñ]o|no quiero vivir|abuso|me est[aá]n golpeando)\b/i;
const medicalPattern = /\b(dosis|medicaci[oó]n|medicamento|diagnostic|tratamiento|fractura|conmoci[oó]n|lesi[oó]n grave)\b/i;
const directivePattern = /\b(tom[aá]|dej[aá] de tomar|entren[aá] \d|hac[eé] \d+ repeticiones|diagn[oó]stico|recet[aá])\b/i;

export function assessCoachInput(content: string): SafetyDecision {
  if (crisisPattern.test(content)) return { blocked: true, category: "crisis", response: "Lamento que estés atravesando algo así. Ahora lo más importante es que no estés solo: contactá a alguien de confianza y a un profesional. Si hay riesgo inmediato en Argentina, llamá al 107 o al 911; para crisis suicida podés llamar al 135 en CABA/GBA o al (011) 5275-1135." };
  if (medicalPattern.test(content)) return { blocked: true, category: "medical", response: "Gracias por traerlo. No puedo evaluar una lesión ni indicar tratamiento; por cuidado, consultá a un profesional de salud o al equipo médico que te acompaña. ¿Hay alguien de confianza a quien puedas avisarle hoy?" };
  return { blocked: false };
}

export function assessCoachOutput(content: string): SafetyDecision {
  if (crisisPattern.test(content)) return { blocked: true, category: "crisis", response: "Quiero priorizar tu cuidado. Buscá apoyo de una persona de confianza y de un profesional; si hay riesgo inmediato en Argentina, llamá al 107 o al 911." };
  if (directivePattern.test(content)) return { blocked: true, category: "technical", response: "No voy a indicarte una solución técnica o médica. Para volver a tu experiencia, ¿qué alternativa propia sentís que querés explorar primero?" };
  return { blocked: false };
}
