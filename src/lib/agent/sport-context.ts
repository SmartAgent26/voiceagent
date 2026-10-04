const specificFocus: Array<{ matches: RegExp; focus: string }> = [
  { matches: /rugby/i, focus: "Rugby: pertenencia al equipo, comunicación, roles, contacto, valentía y cuidado, recuperación después del error, disciplina y lectura de situaciones cambiantes." },
  { matches: /f[uú]tbol|hockey|b[aá]squet|v[oó]ley/i, focus: "Deporte de equipo: comunicación, rol, confianza colectiva, toma de decisiones bajo presión, relación con el error, coordinación y pertenencia." },
  { matches: /tenis/i, focus: "Tenis: diálogo interno entre puntos, foco atencional, tolerancia a la variación, autonomía, gestión del error y presencia competitiva." },
  { matches: /running|atletismo|ciclismo|nataci[oó]n/i, focus: "Deporte individual de resistencia o técnica: relación con el esfuerzo, constancia, ritmo propio, diálogo interno, incertidumbre, recuperación y sentido del proceso." },
  { matches: /boxeo|judo|karate|taekwondo|lucha/i, focus: "Deporte de combate: presencia, regulación de activación, respeto, valentía, foco, lectura del oponente y relación con el contacto." },
];

export function sportContextFor(sport: string) {
  const matched = specificFocus.find((item) => item.matches.test(sport));
  return matched?.focus || `Disciplina ${sport}: explorá los desafíos psicológicos, relacionales y corporales propios de la práctica, la competencia y el proceso de aprendizaje sin dar indicaciones técnicas.`;
}
