import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PLANILLA_FASES_PENDIENTES } from "../dashboard-clasificacion";
import { PLANILLA_ETAPA_LABELS } from "../dashboard-completar-etapa";
import {
  colasDashboardDe,
  dashboardFuenteDeDemoFase,
  DEMO_FASES,
  demoFaseMotorFromTallerId,
  demoFaseNumeroBlFromTallerId,
  demoFaseSerialFromTallerId,
  demoFaseSpec,
  demoFaseSpecs,
} from "../demo-fases";

const TALLER_ID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";

describe("demo fases — un expediente por cola", () => {
  it("define las 8 fases de planilla", () => {
    assert.deepEqual([...DEMO_FASES], [1, 2, 3, 4, 5, 6, 7, 8]);
    assert.equal(demoFaseSpecs(TALLER_ID).length, 8);
  });

  it("genera VIN de 17 caracteres, distintos y estables", () => {
    const serials = DEMO_FASES.map((fase) =>
      demoFaseSerialFromTallerId(TALLER_ID, fase)
    );
    assert.equal(new Set(serials).size, 8);
    for (const serial of serials) {
      assert.equal(serial.length, 17);
      assert.match(serial, /^FASE[A-F0-9]{12}[1-8]$/);
    }
    assert.equal(
      demoFaseSerialFromTallerId(TALLER_ID, 3),
      demoFaseSerialFromTallerId(TALLER_ID, 3)
    );
    assert.notEqual(
      demoFaseMotorFromTallerId(TALLER_ID, 1),
      demoFaseMotorFromTallerId(TALLER_ID, 2)
    );
  });

  it("solo el de embarque lleva BL, para no duplicarse en esa cola", () => {
    assert.match(demoFaseNumeroBlFromTallerId(TALLER_ID, 2) ?? "", /^FASE2/);
    for (const fase of DEMO_FASES.filter((n) => n !== 2)) {
      assert.equal(demoFaseNumeroBlFromTallerId(TALLER_ID, fase), null);
    }
  });

  it("cada fixture cae solo en su cola del dashboard", () => {
    const vistas = new Map<number, string[]>();
    for (const fase of PLANILLA_FASES_PENDIENTES) {
      vistas.set(fase, []);
    }

    for (const spec of demoFaseSpecs(TALLER_ID)) {
      const colas = colasDashboardDe(dashboardFuenteDeDemoFase(spec));
      assert.deepEqual(
        colas,
        [spec.fase],
        `fase ${spec.fase} (${spec.etiqueta}) debía ir solo a su cola`
      );
      assert.equal(spec.etiqueta, PLANILLA_ETAPA_LABELS[spec.fase]);
      for (const cola of colas) {
        vistas.get(cola)?.push(spec.etiqueta);
      }
    }

    for (const fase of PLANILLA_FASES_PENDIENTES) {
      assert.deepEqual(
        vistas.get(fase),
        [PLANILLA_ETAPA_LABELS[fase]],
        `la cola ${fase} debe tener exactamente un expediente`
      );
    }
  });

  it("el de registro queda incompleto para no saltar a embarque", () => {
    const registro = demoFaseSpec(TALLER_ID, 1);
    assert.equal(registro.completitudDatos, "ambar");
    assert.equal(registro.registroCompleto, false);
    assert.deepEqual(registro.datosPendientes, ["factura", "certificado"]);
    assert.equal(registro.numeroBl, null);
  });
});
