import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildAlertaNacionalizacion } from "../alerta-nacionalizacion";
import { buildAlertaPresentacionSeniat } from "../alerta-presentacion-seniat";
import type { ImportacionData } from "../../schemas/vehiculo-documentos";

function ymdOffset(days: number): string {
  const now = new Date();
  const d = new Date(
    Date.UTC(now.getFullYear(), now.getMonth(), now.getDate() + days)
  );
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

describe("reloj nacionalización", () => {
  it("cuenta días en Puerto Libre", () => {
    const alerta = buildAlertaNacionalizacion({
      regimen: "puerto_libre",
      fechaLimiteNacionalizacion: ymdOffset(10),
      estadoNacionalizacion: "pendiente",
    } as ImportacionData);
    assert.ok(alerta);
    assert.equal(alerta.regimen, "puerto_libre");
    assert.equal(alerta.dias, 10);
    assert.equal(alerta.urgencia, "urgente");
    assert.match(alerta.titulo, /10 días/);
  });

  it("muestra el reloj de equipaje", () => {
    const alerta = buildAlertaNacionalizacion({
      regimen: "equipaje",
      fechaLimiteNacionalizacion: ymdOffset(40),
      estadoNacionalizacion: "pendiente",
    } as ImportacionData);
    assert.ok(alerta);
    assert.equal(alerta.regimen, "equipaje");
    assert.equal(alerta.dias, 40);
    assert.match(alerta.titulo, /equipaje/);
  });

  it("no muestra reloj si ya nacionalizó o es ordinario", () => {
    assert.equal(
      buildAlertaNacionalizacion({
        regimen: "equipaje",
        fechaLimiteNacionalizacion: ymdOffset(10),
        estadoNacionalizacion: "nacionalizado",
      } as ImportacionData),
      null
    );
    assert.equal(
      buildAlertaNacionalizacion({
        regimen: "ordinario",
        fechaLimiteNacionalizacion: ymdOffset(10),
        estadoNacionalizacion: "pendiente",
      } as ImportacionData),
      null
    );
  });
});

describe("reloj presentación SENIAT", () => {
  it("avisa cuando toca la cita", () => {
    const alerta = buildAlertaPresentacionSeniat({
      fechaPresentacionSeniat: ymdOffset(0),
      estadoSeniat: "agendada",
    } as ImportacionData);
    assert.ok(alerta);
    assert.equal(alerta.dias, 0);
    assert.equal(alerta.urgencia, "hoy");
    assert.match(alerta.titulo, /Hoy toca presentación/);
  });

  it("cuenta los días que faltan", () => {
    const alerta = buildAlertaPresentacionSeniat({
      fechaPresentacionSeniat: ymdOffset(5),
      estadoSeniat: "pendiente",
    } as ImportacionData);
    assert.ok(alerta);
    assert.equal(alerta.dias, 5);
    assert.equal(alerta.urgencia, "urgente");
  });

  it("se oculta si ya se presentó o no hay fecha", () => {
    assert.equal(
      buildAlertaPresentacionSeniat({
        fechaPresentacionSeniat: ymdOffset(3),
        estadoSeniat: "presentada",
      } as ImportacionData),
      null
    );
    assert.equal(
      buildAlertaPresentacionSeniat({
        fechaPresentacionSeniat: null,
        estadoSeniat: "pendiente",
      } as ImportacionData),
      null
    );
  });
});
