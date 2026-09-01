import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  esNacionalizado,
  esPendientePlanillaRestante,
  esPorCargarDocsCarga,
  esPorCompletarRegistro,
  esPorPresentacionSeniat,
  esPorRecibirEnPuerto,
  esRechazadoSeniat,
  registroAccionLabel,
} from "../dashboard-clasificacion";

const extraido = {
  planillaFase: 1,
  fechaIngreso: null,
  estadoSeniat: "pendiente" as const,
  estadoNacionalizacion: "pendiente" as const,
  completitudDatos: "verde" as const,
};

describe("dashboard clasificación", () => {
  it("un extraído verde va a registro, no a SENIAT ni a pendiente", () => {
    assert.equal(esPorCompletarRegistro(extraido), true);
    assert.equal(esPorPresentacionSeniat(extraido), false);
    assert.equal(esPendientePlanillaRestante(extraido), false);
    assert.equal(esPorCargarDocsCarga(extraido), false);
    assert.equal(registroAccionLabel(extraido.completitudDatos), "Confirmar registro");
  });

  it("fase 2 solo aparece en docs de carga", () => {
    const v = { ...extraido, planillaFase: 2 };
    assert.equal(esPorCargarDocsCarga(v), true);
    assert.equal(esPorCompletarRegistro(v), false);
    assert.equal(esPendientePlanillaRestante(v), false);
    assert.equal(esPorPresentacionSeniat(v), false);
  });

  it("fase 3 es puerto y ya cuenta para SENIAT", () => {
    const v = { ...extraido, planillaFase: 3 };
    assert.equal(esPorRecibirEnPuerto(v), true);
    assert.equal(esPorPresentacionSeniat(v), true);
    assert.equal(esPendientePlanillaRestante(v), false);
  });

  it("fases 4–7 van a pendiente a completar", () => {
    assert.equal(esPendientePlanillaRestante({ planillaFase: 4 }), true);
    assert.equal(esPendientePlanillaRestante({ planillaFase: 7 }), true);
    assert.equal(esPendientePlanillaRestante({ planillaFase: 8 }), false);
    assert.equal(esPorRecibirEnPuerto({ planillaFase: 4 }), false);
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
