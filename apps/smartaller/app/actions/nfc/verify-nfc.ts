"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { verifyPin } from "@/lib/nfc/crypto";
import type { NfcStickerPublic } from "@/lib/nfc/types";
import { nfcTokenSchema, verifyNfcSchema } from "@/lib/validations/nfc";

export type VerifyNfcResult =
  | { success: true; sticker: NfcStickerPublic }
  | { success: false; error: string };

function toPublic(
  row: {
    token: string;
    etiqueta: string | null;
    placa: string | null;
    marca: string | null;
    modelo: string | null;
    color: string | null;
    nombre_titular: string | null;
    activo: boolean;
    pin_hash: string | null;
    last_verified_at: string | null;
  },
  tallerNombre: string | null,
  verificado: boolean
): NfcStickerPublic {
  return {
    token: row.token,
    etiqueta: row.etiqueta,
    placa: row.placa,
    marca: row.marca,
    modelo: row.modelo,
    color: row.color,
    nombre_titular: row.nombre_titular,
    activo: row.activo,
    requierePin: Boolean(row.pin_hash),
    tallerNombre,
    verificado,
  };
}

/** Carga datos públicos del sticker por token (sin revelar PIN). RLS: service role. */
export async function getNfcStickerPublic(token: string): Promise<VerifyNfcResult> {
  const parsed = nfcTokenSchema.safeParse(token);
  if (!parsed.success) {
    return { success: false, error: "Token inválido" };
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("nfc_stickers")
    .select(
      "token, etiqueta, placa, marca, modelo, color, nombre_titular, activo, pin_hash, last_verified_at, taller_id, talleres(nombre)"
    )
    .eq("token", parsed.data)
    .maybeSingle();

  if (error) {
    return { success: false, error: error.message };
  }
  if (!data) {
    return { success: false, error: "Sticker no encontrado" };
  }
  if (!data.activo) {
    return { success: false, error: "Este sticker está desactivado" };
  }

  const tallerJoin = data.talleres as { nombre: string } | { nombre: string }[] | null;
  const tallerNombre = Array.isArray(tallerJoin)
    ? tallerJoin[0]?.nombre ?? null
    : tallerJoin?.nombre ?? null;

  return {
    success: true,
    sticker: toPublic(data, tallerNombre, false),
  };
}

/** Verifica el PIN del sticker público y marca last_verified_at. */
export async function verifyNfcPin(raw: unknown): Promise<VerifyNfcResult> {
  const parsed = verifyNfcSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message ?? "Datos inválidos" };
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("nfc_stickers")
    .select(
      "id, token, etiqueta, placa, marca, modelo, color, nombre_titular, activo, pin_hash, last_verified_at, talleres(nombre)"
    )
    .eq("token", parsed.data.token)
    .maybeSingle();

  if (error) {
    return { success: false, error: error.message };
  }
  if (!data) {
    return { success: false, error: "Sticker no encontrado" };
  }
  if (!data.activo) {
    return { success: false, error: "Este sticker está desactivado" };
  }
  if (!data.pin_hash) {
    return { success: false, error: "Este sticker no tiene PIN configurado" };
  }
  if (!verifyPin(parsed.data.pin, data.pin_hash)) {
    return { success: false, error: "PIN incorrecto" };
  }

  const now = new Date().toISOString();
  await supabase
    .from("nfc_stickers")
    .update({ last_verified_at: now, updated_at: now })
    .eq("id", data.id);

  const tallerJoin = data.talleres as { nombre: string } | { nombre: string }[] | null;
  const tallerNombre = Array.isArray(tallerJoin)
    ? tallerJoin[0]?.nombre ?? null
    : tallerJoin?.nombre ?? null;

  return {
    success: true,
    sticker: toPublic({ ...data, last_verified_at: now }, tallerNombre, true),
  };
}
