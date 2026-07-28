"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient, getUser } from "@/lib/supabase/server";
import { getMyTaller } from "@/lib/taller";
import { generateNfcToken, hashPin } from "@/lib/nfc/crypto";
import type { NfcStickerListItem } from "@/lib/nfc/types";
import {
  createNfcStickerSchema,
  updateNfcStickerSchema,
} from "@/lib/validations/nfc";

export type NfcActionResult =
  | { success: true }
  | { success: false; error: string };

export type CreateNfcResult =
  | { success: true; id: string; token: string }
  | { success: false; error: string };

export type ListNfcResult =
  | { success: true; stickers: NfcStickerListItem[] }
  | { success: false; error: string; stickers: [] };

function mapListItem(row: {
  id: string;
  created_at: string;
  updated_at: string;
  taller_id: string;
  vehiculo_id: string | null;
  token: string;
  etiqueta: string | null;
  placa: string | null;
  marca: string | null;
  modelo: string | null;
  color: string | null;
  nombre_titular: string | null;
  pin_hash: string | null;
  activo: boolean;
  notas: string | null;
  last_verified_at: string | null;
}): NfcStickerListItem {
  const { pin_hash, ...rest } = row;
  return { ...rest, tienePin: Boolean(pin_hash) };
}

async function requireTaller() {
  const user = await getUser();
  if (!user) return { error: "Debes iniciar sesión" as const, taller: null };
  const taller = await getMyTaller();
  if (!taller) return { error: "No se encontró tu taller" as const, taller: null };
  return { error: null, taller };
}

/** Lista stickers del taller. Asume RLS activo en nfc_stickers. */
export async function listNfcStickers(): Promise<ListNfcResult> {
  const auth = await requireTaller();
  if (auth.error || !auth.taller) {
    return { success: false, error: auth.error ?? "No autorizado", stickers: [] };
  }

  const supabase = createClient();
  const { data, error } = await supabase
    .from("nfc_stickers")
    .select(
      "id, created_at, updated_at, taller_id, vehiculo_id, token, etiqueta, placa, marca, modelo, color, nombre_titular, pin_hash, activo, notas, last_verified_at"
    )
    .eq("taller_id", auth.taller.id)
    .order("created_at", { ascending: false });

  if (error) {
    return { success: false, error: error.message, stickers: [] };
  }

  return {
    success: true,
    stickers: (data ?? []).map(mapListItem),
  };
}

export async function createNfcStickerAction(raw: unknown): Promise<CreateNfcResult> {
  const auth = await requireTaller();
  if (auth.error || !auth.taller) {
    return { success: false, error: auth.error ?? "No autorizado" };
  }

  const parsed = createNfcStickerSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message ?? "Datos inválidos" };
  }

  const data = parsed.data;

  if (data.vehiculoId) {
    const admin = createAdminClient();
    const { data: vehiculo } = await admin
      .from("vehiculos")
      .select("id, taller_id")
      .eq("id", data.vehiculoId)
      .maybeSingle();
    if (!vehiculo || vehiculo.taller_id !== auth.taller.id) {
      return { success: false, error: "Vehículo no encontrado en tu taller" };
    }
  }

  const token = generateNfcToken();
  const pin_hash = data.pin ? hashPin(data.pin) : null;
  const now = new Date().toISOString();

  const supabase = createClient();
  const { data: row, error } = await supabase
    .from("nfc_stickers")
    .insert({
      taller_id: auth.taller.id,
      vehiculo_id: data.vehiculoId ?? null,
      token,
      etiqueta: data.etiqueta?.trim() || null,
      placa: data.placa?.trim().toUpperCase() || null,
      marca: data.marca?.trim() || null,
      modelo: data.modelo?.trim() || null,
      color: data.color?.trim() || null,
      nombre_titular: data.nombreTitular?.trim() || null,
      pin_hash,
      notas: data.notas?.trim() || null,
      activo: true,
      created_at: now,
      updated_at: now,
    })
    .select("id, token")
    .single();

  if (error || !row) {
    return { success: false, error: error?.message ?? "No se pudo crear el sticker" };
  }

  revalidatePath("/puerto-libre");
  return { success: true, id: row.id, token: row.token };
}

export async function updateNfcStickerAction(raw: unknown): Promise<NfcActionResult> {
  const auth = await requireTaller();
  if (auth.error || !auth.taller) {
    return { success: false, error: auth.error ?? "No autorizado" };
  }

  const parsed = updateNfcStickerSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message ?? "Datos inválidos" };
  }

  const data = parsed.data;
  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (data.etiqueta !== undefined) patch.etiqueta = data.etiqueta?.trim() || null;
  if (data.placa !== undefined) patch.placa = data.placa?.trim().toUpperCase() || null;
  if (data.marca !== undefined) patch.marca = data.marca?.trim() || null;
  if (data.modelo !== undefined) patch.modelo = data.modelo?.trim() || null;
  if (data.color !== undefined) patch.color = data.color?.trim() || null;
  if (data.nombreTitular !== undefined) {
    patch.nombre_titular = data.nombreTitular?.trim() || null;
  }
  if (data.notas !== undefined) patch.notas = data.notas?.trim() || null;
  if (data.activo !== undefined) patch.activo = data.activo;
  if (data.vehiculoId !== undefined) {
    if (data.vehiculoId) {
      const admin = createAdminClient();
      const { data: vehiculo } = await admin
        .from("vehiculos")
        .select("id, taller_id")
        .eq("id", data.vehiculoId)
        .maybeSingle();
      if (!vehiculo || vehiculo.taller_id !== auth.taller.id) {
        return { success: false, error: "Vehículo no encontrado en tu taller" };
      }
    }
    patch.vehiculo_id = data.vehiculoId;
  }
  if (data.clearPin) {
    patch.pin_hash = null;
  } else if (data.pin) {
    patch.pin_hash = hashPin(data.pin);
  }

  const supabase = createClient();
  const { error } = await supabase
    .from("nfc_stickers")
    .update(patch)
    .eq("id", data.id)
    .eq("taller_id", auth.taller.id);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/puerto-libre");
  return { success: true };
}

export async function deactivateNfcStickerAction(id: string): Promise<NfcActionResult> {
  return updateNfcStickerAction({ id, activo: false });
}

export async function activateNfcStickerAction(id: string): Promise<NfcActionResult> {
  return updateNfcStickerAction({ id, activo: true });
}
