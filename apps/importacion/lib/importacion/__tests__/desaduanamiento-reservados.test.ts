import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PL_DESADUANAMIENTO_RESERVADOS } from "../desaduanamiento-reservados";
import { DOCUMENTO_TIPOS_CARGA_BL_DESADUANA } from "../expediente-lote";

describe("PL_DESADUANAMIENTO_RESERVADOS", () => {
  it("guarda los seis recaudos fuera de la carga de desaduanamiento", () => {
    assert.deepEqual([...PL_DESADUANAMIENTO_RESERVADOS], [
      "sencamer",
      "registro_puerto_libre",
      "agente_aduanal_doc",
      "constancia_edi_reconocimiento",
      "planilla_liquidacion_aduanera",
      "constancia_residencia_permanencia",
    ]);
    for (const tipo of PL_DESADUANAMIENTO_RESERVADOS) {
      assert.equal(
        (DOCUMENTO_TIPOS_CARGA_BL_DESADUANA as readonly string[]).includes(
          tipo
        ),
        false,
        tipo
      );
    }
  });
});
