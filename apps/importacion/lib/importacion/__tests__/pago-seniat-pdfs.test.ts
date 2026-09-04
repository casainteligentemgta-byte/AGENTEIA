import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DOCUMENTO_LABELS,
  PL_PAGO_SENIAT_DOCUMENTO_TIPOS,
  pagoSeniatPdfsListos,
} from "../../schemas/vehiculo-documentos";

describe("PDFs que emite SENIAT tras el pago", () => {
  it("pide liquidación de tributos y constancia de nacionalización", () => {
    assert.deepEqual([...PL_PAGO_SENIAT_DOCUMENTO_TIPOS], [
      "planilla_liquidacion_aduanera",
      "constancia_nacionalizacion",
    ]);
    assert.match(
      DOCUMENTO_LABELS.planilla_liquidacion_aduanera,
      /Liquidación de tributos/
    );
    assert.match(
      DOCUMENTO_LABELS.constancia_nacionalizacion,
      /Constancia de nacionalización/
    );
  });

  it("está completo solo con los dos PDF", () => {
    assert.equal(pagoSeniatPdfsListos({}), false);
    assert.equal(
      pagoSeniatPdfsListos({
        planilla_liquidacion_aduanera: {
          url: "https://example.com/liq.pdf",
          path: "liq.pdf",
        },
      }),
      false
    );
    assert.equal(
      pagoSeniatPdfsListos({
        planilla_liquidacion_aduanera: {
          url: "https://example.com/liq.pdf",
          path: "liq.pdf",
        },
        constancia_nacionalizacion: {
          url: "https://example.com/const.pdf",
          path: "const.pdf",
        },
      }),
      true
    );
  });
});
