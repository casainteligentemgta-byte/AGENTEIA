import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  hrefNacionalizar,
  hrefPresentacionSeniat,
  nacionalizarAccionLabel,
  seniatAccionLabel,
} from "../planilla-en-construccion";

describe("destinos de los relojes", () => {
  it("nacionalizar abre la fase de documentos", () => {
    assert.equal(hrefNacionalizar("abc"), "/smartimport/abc/nacionalizar");
    assert.equal(nacionalizarAccionLabel(), "Nacionalizar");
  });

  it("SENIAT abre la sección de presentación y actas", () => {
    assert.equal(hrefPresentacionSeniat("abc"), "/smartimport/abc/seniat");
    assert.equal(seniatAccionLabel(), "Gestionar");
  });
});
