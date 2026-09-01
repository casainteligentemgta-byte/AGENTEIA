import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseLlmJsonObject, parseJsonOrSalvageVins } from "../parse-llm-json";

describe("parseLlmJsonObject", () => {
  it("parsea JSON puro", () => {
    const obj = parseLlmJsonObject('{"rif":"J-12345678-9","nombre":null}');
    assert.equal(obj?.rif, "J-12345678-9");
  });

  it("extrae JSON envuelto en prosa y markdown", () => {
    const raw = `Claro, aquí tienes:\n\`\`\`json\n{\n  "rif": "J-50035334-3",\n  "tipo_persona": "juridica"\n}\n\`\`\`\nListo.`;
    const obj = parseLlmJsonObject(raw);
    assert.equal(obj?.rif, "J-50035334-3");
    assert.equal(obj?.tipo_persona, "juridica");
  });

  it("tolera coma final", () => {
    const obj = parseLlmJsonObject('{"rif":"V-12345678-9","nombre":"Luis",}');
    assert.equal(obj?.rif, "V-12345678-9");
  });

  it("repara JSON truncado del RIF (Gemini se corta)", () => {
    const raw =
      '{"rif":"J-12345678-9","tipo_persona":"juridica","razon_social":"CASA INTELIGENTE MGTA';
    const obj = parseLlmJsonObject(raw);
    assert.equal(obj?.rif, "J-12345678-9");
    assert.equal(obj?.tipo_persona, "juridica");
  });
});

describe("parseJsonOrSalvageVins", () => {
  it("sigue salvando VIN si no hay JSON", () => {
    const parsed = parseJsonOrSalvageVins(
      "VIN LVVDB21B9VE033523 en la fila 1"
    );
    const vehiculos = parsed.vehiculos as Array<{ serial_carroceria: string }>;
    assert.equal(vehiculos[0]?.serial_carroceria, "LVVDB21B9VE033523");
  });
});
