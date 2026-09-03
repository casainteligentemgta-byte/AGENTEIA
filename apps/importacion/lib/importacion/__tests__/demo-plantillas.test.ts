import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isValidRif } from "../../validations/rif";
import {
  DEMO_PLANTILLA_ARCHIVOS_ESPERADOS,
  DEMO_UNIDADES,
  demoMotorFromTallerId,
  demoNumeroBlFromTallerId,
  demoPlantillaPath,
  demoRifFromTallerId,
  demoSerialFromTallerId,
  demoSerialLegacyFromTallerId,
  demoPasoDeTipo,
  isSafeDemoPlantillaFilename,
  mapPlantillaFilenameToTipo,
} from "../demo-plantillas";

const TALLER_ID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";

describe("demoSerialFromTallerId", () => {
  it("genera 3 VIN de 17 caracteres, distintos y estables", () => {
    const a = demoSerialFromTallerId(TALLER_ID, 1);
    const b = demoSerialFromTallerId(TALLER_ID, 2);
    const c = demoSerialFromTallerId(TALLER_ID, 3);
    assert.equal(a.length, 17);
    assert.equal(b.length, 17);
    assert.equal(c.length, 17);
    assert.match(a, /^DEMO[A-F0-9]{12}1$/);
    assert.notEqual(a, b);
    assert.notEqual(b, c);
    assert.equal(a, demoSerialFromTallerId(TALLER_ID, 1));
    assert.equal(DEMO_UNIDADES, 3);
  });

  it("el serial legado de 1 unidad no choca con las 3 nuevas", () => {
    const legacy = demoSerialLegacyFromTallerId(TALLER_ID);
    assert.equal(legacy.length, 17);
    assert.notEqual(legacy, demoSerialFromTallerId(TALLER_ID, 1));
  });
});

describe("demoNumeroBlFromTallerId", () => {
  it("es estable y agrupa la carga", () => {
    const bl = demoNumeroBlFromTallerId(TALLER_ID);
    assert.match(bl, /^DEMOBL[A-F0-9]{6}$/);
    assert.equal(bl, demoNumeroBlFromTallerId(TALLER_ID));
  });
});

describe("demoRifFromTallerId", () => {
  it("genera un RIF jurídico válido", () => {
    const rif = demoRifFromTallerId(TALLER_ID);
    assert.equal(isValidRif(rif), true);
    assert.match(rif, /^J-\d{8}-0$/);
  });
});

describe("demoMotorFromTallerId", () => {
  it("distingue las 3 unidades", () => {
    const a = demoMotorFromTallerId(TALLER_ID, 1);
    const b = demoMotorFromTallerId(TALLER_ID, 2);
    assert.match(a, /^MOT[A-F0-9]{9}1$/);
    assert.notEqual(a, b);
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

describe("demoPasoDeTipo", () => {
  it("factura y certificado son de la carga; BL y lista unifican", () => {
    assert.equal(demoPasoDeTipo("factura_comercial"), "carga");
    assert.equal(demoPasoDeTipo("certificado_origen"), "carga");
    assert.equal(demoPasoDeTipo("bl_guia"), "bl");
    assert.equal(demoPasoDeTipo("lista_empaque"), "bl");
    assert.equal(demoPasoDeTipo("foto_frontal"), "otro");
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
