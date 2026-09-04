import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { vehiculoPatchFromMatricula } from "../matricula-asignacion";
import { vehiculoPatchFromSeguro } from "../seguro-asignacion";
import { parseImportacion, parseSeguro } from "@/lib/schemas/vehiculo-documentos";
import {
  hrefNacionalizar,
  hrefPresentacionSeniat,
  nacionalizarAccionLabel,
  PLANILLA_PREVIEW_EN_CONSTRUCCION,
  seniatAccionLabel,
} from "../planilla-en-construccion";

describe("vehiculoPatchFromSeguro", () => {
  it("copia la póliza al expediente y no toca la fase", () => {
    const patch = vehiculoPatchFromSeguro(
      "22222222-2222-2222-2222-222222222222",
      {
        aseguradora: "Mercantil",
        numeroPoliza: "POL-1",
        tipoCobertura: "RCV",
        vigenciaDesde: "2026-01-01",
        vigenciaHasta: "2027-01-01",
        montoAsegurado: 1000,
        telefonoAseguradora: "02125550000",
        corredor: null,
        observaciones: "OK",
      },
      { aseguradora: "Vieja" }
    );
    const seguro = parseSeguro(patch.seguro);
    assert.equal(seguro.aseguradora, "Mercantil");
    assert.equal(seguro.numeroPoliza, "POL-1");
    assert.equal(patch.seguro_ficha_id, "22222222-2222-2222-2222-222222222222");
  });
});

describe("vehiculoPatchFromMatricula", () => {
  it("copia placa y homologación sin cerrar la carpeta", () => {
    const patch = vehiculoPatchFromMatricula(
      "33333333-3333-3333-3333-333333333333",
      {
        placa: "AB123CD",
        oficinaIntt: "INTT Margarita",
        fechaTramite: "2026-09-01",
        requiereHomologacion: true,
        observaciones: null,
      },
      "PL-2026.9.1",
      { planillaFase: 9, planillaEtapasRev: 2, codigoExpediente: "PL-2026.9.1" }
    );
    assert.equal(patch.placa, "AB123CD");
    const imp = parseImportacion(patch.importacion);
    assert.equal(imp.requiereHomologacion, true);
    assert.equal(imp.planillaFase, 9);
  });
});

describe("SENIAT y nacionalizar en construcción", () => {
  it("abre la planilla en preview mientras el flag está activo", () => {
    assert.equal(PLANILLA_PREVIEW_EN_CONSTRUCCION, true);
    assert.equal(
      hrefPresentacionSeniat("abc"),
      "/smartimport/abc/planilla?preview=1"
    );
    assert.equal(seniatAccionLabel(), "Previsualizar");
    assert.equal(
      hrefNacionalizar("abc"),
      "/smartimport/abc/planilla?preview=1"
    );
    assert.equal(nacionalizarAccionLabel(), "Previsualizar");
  });
});
