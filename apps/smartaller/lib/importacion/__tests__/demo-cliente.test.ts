import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  EMPTY_DEMO_CUESTIONARIO,
  buildMapaDeseos,
  parseDemoCuestionario,
} from "../demo-cliente";

describe("parseDemoCuestionario", () => {
  it("rellena vacíos si el payload es inválido", () => {
    const parsed = parseDemoCuestionario({ rol: 1, volumen: "nope" });
    assert.equal(parsed.rol, "");
    assert.equal(parsed.volumen, "");
    assert.equal(parsed.clienteNombre, "");
  });

  it("acepta un formulario completo", () => {
    const parsed = parseDemoCuestionario({
      clienteNombre: "  Casa Import  ",
      rol: "importador",
      volumen: "10-50",
      regimen: "puerto_libre",
      piloto: "si",
      pilotoFecha: "lunes",
    });
    assert.equal(parsed.clienteNombre, "Casa Import");
    assert.equal(parsed.regimen, "puerto_libre");
  });
});

describe("buildMapaDeseos", () => {
  it("arma la página de cierre con vacíos como raya", () => {
    const mapa = buildMapaDeseos(EMPTY_DEMO_CUESTIONARIO);
    assert.match(mapa, /Ustedes son —, — unidades\/mes, régimen —\./);
    assert.match(mapa, /Siguiente paso: —\./);
  });

  it("resume rol, volumen, régimen y piloto", () => {
    const mapa = buildMapaDeseos({
      ...EMPTY_DEMO_CUESTIONARIO,
      clienteNombre: "Nautica",
      fechaIso: "2026-09-02",
      rol: "concesionario",
      volumen: "lt10",
      regimen: "puerto_libre",
      sirveHoy: "la cola por BL",
      pidePiloto: "carga masiva de su factura",
      quedaFuera: "WhatsApp",
      piloto: "si",
      pilotoFecha: "el jueves",
      nfc: "despues",
    });
    assert.match(mapa, /Demo SmartImport — Nautica \(2026-09-02\)/);
    assert.match(mapa, /concesionario, <10 unidades\/mes, régimen Puerto Libre/);
    assert.match(mapa, /Lo que ya les sirve: la cola por BL\./);
    assert.match(mapa, /Lo que piden para el piloto: carga masiva de su factura\./);
    assert.match(mapa, /Lo que queda fuera \(v2\): WhatsApp\./);
    assert.match(mapa, /Siguiente paso: 1 lote real, fecha el jueves\./);
    assert.match(mapa, /NFC \/ enlace público: después/);
  });

  it("usa el texto libre si el rol es otro", () => {
    const mapa = buildMapaDeseos({
      ...EMPTY_DEMO_CUESTIONARIO,
      rol: "otro",
      rolOtro: "naviera",
    });
    assert.match(mapa, /Ustedes son naviera,/);
  });
});
