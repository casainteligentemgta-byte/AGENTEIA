import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isValidRif } from "../../validations/rif";
import {
  DEMO_PLANTILLA_ARCHIVOS_ESPERADOS,
  demoMotorFromTallerId,
  demoPlantillaPath,
  demoRifFromTallerId,
  demoSerialFromTallerId,
  isSafeDemoPlantillaFilename,
  mapPlantillaFilenameToTipo,
} from "../demo-plantillas";

const TALLER_ID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";

describe("demoSerialFromTallerId", () => {
  it("es estable, 17 caracteres y empieza por DEMO", () => {
    const serial = demoSerialFromTallerId(TALLER_ID);
    assert.equal(serial.length, 17);
    assert.match(serial, /^DEMO[A-F0-9]{13}$/);
    assert.equal(serial, demoSerialFromTallerId(TALLER_ID));
  });
});

describe("demoRifFromTallerId", () => {
  it("genera un RIF jurídico válido", () => {
    const rif = demoRifFromTallerId(TALLER_ID);
    assert.equal(isValidRif(rif), true);
    assert.match(rif, /^J-\d{8}-0$/);
    assert.equal(rif, demoRifFromTallerId(TALLER_ID));
  });
});

describe("demoMotorFromTallerId", () => {
  it("es estable y empieza por MOT", () => {
    const motor = demoMotorFromTallerId(TALLER_ID);
    assert.match(motor, /^MOT[A-F0-9]{10}$/);
    assert.equal(motor, demoMotorFromTallerId(TALLER_ID));
  });
});

describe("mapPlantillaFilenameToTipo", () => {
  it("acepta el nombre canónico de cada plantilla esperada", () => {
    assert.equal(
      mapPlantillaFilenameToTipo("factura_comercial.pdf"),
      "factura_comercial"
    );
    assert.equal(
      mapPlantillaFilenameToTipo("certificado_origen.pdf"),
      "certificado_origen"
    );
    assert.equal(mapPlantillaFilenameToTipo("bl_guia.pdf"), "bl_guia");
    assert.equal(mapPlantillaFilenameToTipo("lista_empaque.pdf"), "lista_empaque");
  });

  it("acepta alias habituales", () => {
    assert.equal(mapPlantillaFilenameToTipo("factura.pdf"), "factura_comercial");
    assert.equal(mapPlantillaFilenameToTipo("BL.pdf"), "bl_guia");
    assert.equal(mapPlantillaFilenameToTipo("packing-list.pdf"), "lista_empaque");
    assert.equal(mapPlantillaFilenameToTipo("rif.pdf"), "rif_importador");
  });

  it("rechaza un nombre que no es un tipo conocido", () => {
    assert.equal(mapPlantillaFilenameToTipo("notas_internas.pdf"), null);
  });
});

describe("isSafeDemoPlantillaFilename", () => {
  it("bloquea path traversal", () => {
    assert.equal(isSafeDemoPlantillaFilename("factura_comercial.pdf"), true);
    assert.equal(isSafeDemoPlantillaFilename("../secret.pdf"), false);
    assert.equal(isSafeDemoPlantillaFilename("a/b.pdf"), false);
    assert.equal(DEMO_PLANTILLA_ARCHIVOS_ESPERADOS.length, 4);
    assert.equal(
      demoPlantillaPath("factura_comercial.pdf"),
      "demo-plantillas/factura_comercial.pdf"
    );
  });
});
