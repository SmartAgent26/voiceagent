import assert from "node:assert/strict";
import test from "node:test";
import { assessCoachInput, assessCoachOutput } from "./safety.ts";

test("bloquea expresiones de crisis antes de llamar al proveedor", () => {
  const decision = assessCoachInput("No quiero vivir y no sé qué hacer");
  assert.equal(decision.blocked, true);
  assert.equal(decision.category, "crisis");
  assert.match(decision.response || "", /911/);
});

test("deriva consultas médicas sin responder con tratamiento", () => {
  const decision = assessCoachInput("Tengo una fractura, ¿cuál es el tratamiento?");
  assert.equal(decision.blocked, true);
  assert.equal(decision.category, "medical");
  assert.match(decision.response || "", /profesional de salud/i);
});

test("bloquea prescripciones técnicas o médicas del modelo", () => {
  const decision = assessCoachOutput("Tomá este medicamento y hacé 20 repeticiones.");
  assert.equal(decision.blocked, true);
  assert.equal(decision.category, "technical");
});

test("permite una reflexión ontológica no riesgosa", () => {
  assert.deepEqual(assessCoachInput("Me cuesta disfrutar cuando juego bajo presión."), { blocked: false });
  assert.deepEqual(assessCoachOutput("¿Qué notás en tu cuerpo cuando aparece esa exigencia?"), { blocked: false });
});
