import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  esNacionalizado,
  esPorCompletarEtapa,
  esPorCompletarRegistro,
  esPorPresentacionSeniat,
  esRechazadoSeniat,
  PLANILLA_FASES_PENDIENTES,
  registroAccionLabel,
} from "../dashboard-clasificacion";

const extraido = {
  planillaFase: 1,
  fechaIngreso: null,
  estadoSeniat: "pendiente" as const,
  estadoNacionalizacion: "pendiente" as const,
  completitudDatos: "verde" as const,
};

function colasPlanillaDe(v: { planillaFase: number | null }) {
  return PLANILLA_FASES_PENDIENTES.filter((fase) => esPorCompletarEtapa(v, fase));
}

describe("dashboard clasificación", () => {
  it("un extraído verde va a registro, no a SENIAT", () => {
    assert.equal(esPorCompletarRegistro(extraido), true);
    assert.deepEqual(colasPlanillaDe(extraido), [1]);
    assert.equal(esPorPresentacionSeniat(extraido), false);
    assert.equal(registroAccionLabel(extraido.completitudDatos), "Confirmar registro");
  });

  it("cada fase 1–7 tiene su cola y no se mezcla con las demás", () => {
    for (const fase of PLANILLA_FASES_PENDIENTES) {
      const v = { ...extraido, planillaFase: fase };
      assert.deepEqual(colasPlanillaDe(v), [fase]);
    }
  });

  it("fase 8 (planilla completa) no entra en ninguna cola por completar", () => {
    assert.deepEqual(colasPlanillaDe({ planillaFase: 8 }), []);
    assert.equal(esPorCompletarRegistro({ planillaFase: 8 }), false);
  });

  it("fase null se trata como registro", () => {
    assert.deepEqual(colasPlanillaDe({ planillaFase: null }), [1]);
  });

  it("con fecha de ingreso sigue en su fase de planilla", () => {
    const v = { ...extraido, planillaFase: 2, fechaIngreso: "2026-08-01" };
    assert.deepEqual(colasPlanillaDe(v), [2]);
  });

  it("fase 3 es llegada y ya cuenta para SENIAT", () => {
    const v = { ...extraido, planillaFase: 3 };
    assert.equal(esPorCompletarEtapa(v, 3), true);
    assert.equal(esPorPresentacionSeniat(v), true);
    assert.equal(esPorCompletarEtapa(v, 1), false);
  });

  it("SENIAT con fecha de cita entra aunque siga en registro", () => {
    assert.equal(
      esPorPresentacionSeniat({
        ...extraido,
        fechaPresentacionSeniat: "2026-09-15",
      }),
      true
    );
  });

  it("nacionalizado y rechazo SENIAT se detectan por estado", () => {
    assert.equal(
      esNacionalizado({ planillaFase: 8, estadoNacionalizacion: "nacionalizado" }),
      true
    );
    assert.equal(
      esRechazadoSeniat({ planillaFase: 4, estadoSeniat: "rechazada" }),
      true
    );
    assert.equal(registroAccionLabel("ambar"), "Completar registro");
  });
});
