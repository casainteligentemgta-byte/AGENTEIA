import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DOCUMENTO_LABELS,
  PL_CONSTANCIA_INSPECCION_TIPO,
  constanciaInspeccionLista,
} from "../../schemas/vehiculo-documentos";
import { isDocumentoLote } from "../expediente-lote";

describe("Constancia de inspección del puerto", () => {
  it("es un PDF propio, no de SENIAT ni de lote", () => {
    assert.deepEqual([...PL_CONSTANCIA_INSPECCION_TIPO], [
      "constancia_inspeccion",
    ]);
    assert.match(
      DOCUMENTO_LABELS.constancia_inspeccion,
      /Constancia de inspección/
    );
    assert.equal(isDocumentoLote("constancia_inspeccion"), false);
  });

  it("está lista solo con el PDF cargado", () => {
    assert.equal(constanciaInspeccionLista({}), false);
    assert.equal(
      constanciaInspeccionLista({
        constancia_inspeccion: {
          url: "https://example.com/insp.pdf",
          path: "insp.pdf",
        },
      }),
      true
    );
  });
});
