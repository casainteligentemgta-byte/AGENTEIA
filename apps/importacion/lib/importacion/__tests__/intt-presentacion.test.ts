import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  PL_INTT_PRESENTACION_LABELS,
  PL_INTT_PRESENTACION_TIPOS,
  countMatriculacionCarpeta,
  docsInttPresentacionTipos,
  docsMatriculacionPdfTipos,
  faltantesMatriculacionCarpeta,
  inttPresentacionRef,
} from "../../schemas/vehiculo-documentos";

const ref = (path: string) => ({
  url: `https://example.com/${path}`,
  path,
});

describe("Archivo para presentar ante el INTT", () => {
  it("trae los 9 recaudos en el orden del trámite", () => {
    assert.deepEqual([...PL_INTT_PRESENTACION_TIPOS], [
      "cedula_importador",
      "rif_importador",
      "factura_comercial",
      "certificado_origen",
      "homologacion",
      "planilla_liquidacion_aduanera",
      "constancia_inspeccion",
      "declaracion_jurada_propietario",
      "pago_tasas",
    ]);
    assert.match(PL_INTT_PRESENTACION_LABELS.cedula_importador, /Cédula/);
    assert.match(PL_INTT_PRESENTACION_LABELS.rif_importador, /RIF vigente/);
    assert.match(
      PL_INTT_PRESENTACION_LABELS.planilla_liquidacion_aduanera,
      /Liquidación de tributos/
    );
    assert.match(
      PL_INTT_PRESENTACION_LABELS.constancia_inspeccion,
      /inspección del puerto/
    );
    assert.match(
      PL_INTT_PRESENTACION_LABELS.declaracion_jurada_propietario,
      /Declaración de propiedad/
    );
    assert.match(PL_INTT_PRESENTACION_LABELS.pago_tasas, /tasas INTT/);
  });

  it("omite homologación si no es requerida", () => {
    const conHomologacion = docsInttPresentacionTipos(true);
    const sinHomologacion = docsInttPresentacionTipos(false);
    assert.equal(conHomologacion.length, 9);
    assert.equal(sinHomologacion.length, 8);
    assert.ok(conHomologacion.includes("homologacion"));
    assert.equal(sinHomologacion.includes("homologacion"), false);
    assert.deepEqual(docsMatriculacionPdfTipos(false), sinHomologacion);
  });

  it("precarga la cédula del importador o la cédula ya cargada", () => {
    assert.equal(
      inttPresentacionRef(
        { cedula: ref("cedula.pdf") },
        "cedula_importador"
      )?.path,
      "cedula.pdf"
    );
    assert.equal(
      inttPresentacionRef(
        {
          cedula: ref("cedula.pdf"),
          cedula_importador: ref("imp.pdf"),
        },
        "cedula_importador"
      )?.path,
      "imp.pdf"
    );
  });

  it("cuenta faltantes del archivo y acepta docs precargados", () => {
    const docs = {
      cedula_importador: ref("ci.pdf"),
      rif_importador: ref("rif.pdf"),
      factura_comercial: ref("fac.pdf"),
      certificado_origen: ref("ori.pdf"),
      planilla_liquidacion_aduanera: ref("liq.pdf"),
      constancia_inspeccion: ref("insp.pdf"),
      declaracion_jurada_propietario: ref("prop.pdf"),
      pago_tasas: ref("tasas.pdf"),
    };
    assert.deepEqual(faltantesMatriculacionCarpeta(docs, false), []);
    assert.deepEqual(countMatriculacionCarpeta(docs, false), {
      listos: 8,
      total: 8,
    });
    assert.deepEqual(faltantesMatriculacionCarpeta(docs, true), [
      "homologacion",
    ]);
    assert.deepEqual(countMatriculacionCarpeta(docs, true), {
      listos: 8,
      total: 9,
    });
  });
});
