import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  esEnColaEmbarque,
  esNacionalizado,
  esEntregaPlacaListaEnDashboard,
  placaAccionLabel,
  esPorCompletarEtapa,
  esPorCompletarRegistro,
  esPorPresentacionSeniat,
  esRechazadoSeniat,
  faseColaPlanilla,
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

function colasPlanillaDe(v: {
  planillaFase: number | null;
  completitudDatos?: "rojo" | "ambar" | "verde" | null;
  registroCompleto?: boolean;
}) {
  return PLANILLA_FASES_PENDIENTES.filter((fase) => esPorCompletarEtapa(v, fase));
}

describe("dashboard clasificación", () => {
  it("registro verde (datos cargados) pasa a embarque, no se queda en registro", () => {
    assert.equal(faseColaPlanilla(extraido), 2);
    assert.equal(esPorCompletarRegistro(extraido), false);
    assert.deepEqual(colasPlanillaDe(extraido), [2]);
    assert.equal(esPorPresentacionSeniat(extraido), false);
    assert.equal(registroAccionLabel(extraido.completitudDatos), "Confirmar registro");
  });

  it("si aún faltan datos de registro sigue en esa cola", () => {
    const v = { ...extraido, completitudDatos: "ambar" as const };
    assert.deepEqual(colasPlanillaDe(v), [1]);
    assert.equal(esPorCompletarRegistro(v), true);
  });

  it("Extraer registrar (fase 2) va a embarque aunque el semáforo siga ámbar", () => {
    const v = { planillaFase: 2, completitudDatos: "ambar" as const };
    assert.equal(faseColaPlanilla(v), 2);
    assert.equal(esPorCompletarRegistro(v), false);
    assert.deepEqual(colasPlanillaDe(v), [2]);
  });

  it("chip Registro verde también manda a embarque aunque el semáforo no esté guardado", () => {
    const v = {
      planillaFase: 1,
      completitudDatos: null,
      registroCompleto: true,
    };
    assert.deepEqual(colasPlanillaDe(v), [2]);
  });

  it("cada fase 2–10 tiene su cola y no se mezcla con las demás", () => {
    for (const fase of PLANILLA_FASES_PENDIENTES.filter((n) => n >= 2)) {
      const v = { ...extraido, planillaFase: fase };
      assert.deepEqual(colasPlanillaDe(v), [fase]);
    }
  });

  it("fase 10 es cola de placa; la 11 ya no entra en colas por completar", () => {
    assert.deepEqual(colasPlanillaDe({ planillaFase: 10 }), [10]);
    assert.deepEqual(colasPlanillaDe({ planillaFase: 11 }), []);
    assert.equal(esPorCompletarRegistro({ planillaFase: 11 }), false);
  });

  it("fase null sin datos listos se trata como registro", () => {
    assert.deepEqual(
      colasPlanillaDe({ planillaFase: null, completitudDatos: "rojo" }),
      [1]
    );
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

  it("un BL cerrado se queda en embarque y se duplica en llegada", () => {
    const v = { ...extraido, planillaFase: 3, numeroBl: "321" };
    assert.equal(esEnColaEmbarque(v), true);
    assert.equal(esPorCompletarEtapa(v, 2), false);
    assert.equal(esPorCompletarEtapa(v, 3), true);
  });

  it("llegada sin BL no se queda en embarque", () => {
    const v = { ...extraido, planillaFase: 3, numeroBl: null };
    assert.equal(esEnColaEmbarque(v), false);
    assert.equal(esPorCompletarEtapa(v, 3), true);
  });

  it("fase 2 sigue solo en embarque", () => {
    const v = { ...extraido, planillaFase: 2, numeroBl: "321" };
    assert.equal(esEnColaEmbarque(v), true);
    assert.equal(esPorCompletarEtapa(v, 3), false);
  });

  it("al cerrar llegada el BL sale de embarque", () => {
    const v = { ...extraido, planillaFase: 4, numeroBl: "321" };
    assert.equal(esEnColaEmbarque(v), false);
    assert.equal(esPorCompletarEtapa(v, 4), true);
  });

  it("SENIAT con fecha de cita entra aunque siga en registro", () => {
    assert.equal(
      esPorPresentacionSeniat({
        ...extraido,
        completitudDatos: "ambar",
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

  it("placa: Completar si falta dato, Placa completada si está llena", () => {
    assert.equal(placaAccionLabel(false), "Completar placa");
    assert.equal(placaAccionLabel(true), "Placa completada");
    assert.equal(
      esEntregaPlacaListaEnDashboard({
        planillaFase: 10,
        entregaPlacaCompleta: false,
      }),
      false
    );
    assert.equal(
      esEntregaPlacaListaEnDashboard({
        planillaFase: 10,
        entregaPlacaCompleta: true,
      }),
      true
    );
    assert.equal(
      esEntregaPlacaListaEnDashboard({
        planillaFase: 11,
        entregaPlacaCompleta: false,
      }),
      true
    );
  });
});
