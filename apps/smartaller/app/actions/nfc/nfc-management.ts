"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient, getUser } from "@/lib/supabase/server";
import { getMyTaller } from "@/lib/taller";
import {
  assertVehiculoTaller,
  requireTallerAuth,
} from "@/lib/importacion/taller-auth";
import { generateNfcToken, hashPin } from "@/lib/nfc/crypto";
import type { NfcStickerListItem } from "@/lib/nfc/types";
import {
  createNfcStickerSchema,
  nfcTokenSchema,
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
  last_scanned_at: string | null;
  vehiculos?: { pin_hash: string | null } | { pin_hash: string | null }[] | null;
}): NfcStickerListItem {
  const { pin_hash, vehiculos, ...rest } = row;
  const vehiclePin = Array.isArray(vehiculos)
    ? vehiculos[0]?.pin_hash
    : vehiculos?.pin_hash;
  return {
    ...rest,
    last_scanned_at: rest.last_scanned_at ?? null,
    tienePin: Boolean(pin_hash || vehiclePin),
  };
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
      "id, created_at, updated_at, taller_id, vehiculo_id, token, etiqueta, placa, marca, modelo, color, nombre_titular, pin_hash, activo, notas, last_verified_at, last_scanned_at, vehiculos(pin_hash)"
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
  const admin = createAdminClient();

  if (data.vehiculoId) {
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
  const pin_hash = data.pin ? await hashPin(data.pin) : null;
  const now = new Date().toISOString();

  // PIN vive en el vehículo cuando hay vínculo (flujo verifyNFCAndPin).
  if (data.vehiculoId && pin_hash) {
    const { error: pinError } = await admin
      .from("vehiculos")
      .update({ pin_hash, updated_at: now })
      .eq("id", data.vehiculoId)
      .eq("taller_id", auth.taller.id);
    if (pinError) {
      return { success: false, error: pinError.message };
    }
  }

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
      // Solo en sticker si aún no hay vehículo vinculado.
      pin_hash: data.vehiculoId ? null : pin_hash,
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

  revalidatePath("/smartimport");
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
  const admin = createAdminClient();
  const now = new Date().toISOString();
  const patch: Record<string, unknown> = { updated_at: now };

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

  let vehiculoId = data.vehiculoId;
  if (data.vehiculoId !== undefined) {
    if (data.vehiculoId) {
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
  } else {
    const supabasePeek = createClient();
    const { data: existing } = await supabasePeek
      .from("nfc_stickers")
      .select("vehiculo_id")
      .eq("id", data.id)
      .eq("taller_id", auth.taller.id)
      .maybeSingle();
    vehiculoId = existing?.vehiculo_id ?? null;
  }

  if (data.clearPin) {
    patch.pin_hash = null;
    if (vehiculoId) {
      await admin
        .from("vehiculos")
        .update({ pin_hash: null, updated_at: now })
        .eq("id", vehiculoId)
        .eq("taller_id", auth.taller.id);
    }
  } else if (data.pin) {
    const pin_hash = await hashPin(data.pin);
    if (vehiculoId) {
      await admin
        .from("vehiculos")
        .update({ pin_hash, updated_at: now })
        .eq("id", vehiculoId)
        .eq("taller_id", auth.taller.id);
      patch.pin_hash = null;
    } else {
      patch.pin_hash = pin_hash;
    }
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

  revalidatePath("/smartimport");
  return { success: true };
}

export async function deactivateNfcStickerAction(id: string): Promise<NfcActionResult> {
  return updateNfcStickerAction({ id, activo: false });
}

export async function activateNfcStickerAction(id: string): Promise<NfcActionResult> {
  return updateNfcStickerAction({ id, activo: true });
}

/**
 * Vincula un sticker existente (por token) a un vehículo del taller.
 * No existe columna `linked_at`; se usa `updated_at`.
 * Alternativa por id: `updateNfcStickerAction({ id, vehiculoId })`.
 */
export async function linkNfcStickerToVehiculoAction(
  raw: unknown
): Promise<NfcActionResult> {
  const auth = await requireTallerAuth();
  if (auth.error || !auth.taller) {
    return { success: false, error: auth.error ?? "No autorizado" };
  }

  const parsed = z
    .object({
      token: nfcTokenSchema,
      vehiculoId: z.string().uuid(),
    })
    .safeParse(raw);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.errors[0]?.message ?? "Datos inválidos",
    };
  }

  const { token, vehiculoId } = parsed.data;
  const vehiculo = await assertVehiculoTaller(vehiculoId, auth.taller.id);
  if (!vehiculo) {
    return { success: false, error: "Vehículo no encontrado" };
  }

  const admin = createAdminClient();
  const { data: sticker } = await admin
    .from("nfc_stickers")
    .select("id, vehiculo_id, activo")
    .eq("token", token)
    .eq("taller_id", auth.taller.id)
    .maybeSingle();

  if (!sticker) {
    return { success: false, error: "Sticker no encontrado en tu taller" };
  }
  if (!sticker.activo) {
    return { success: false, error: "El sticker está inactivo" };
  }
  if (sticker.vehiculo_id && sticker.vehiculo_id !== vehiculoId) {
    return {
      success: false,
      error: "El sticker ya está vinculado a otro vehículo",
    };
  }

  const { data: meta } = await admin
    .from("vehiculos")
    .select("placa, marca, modelo, color, nombre_cliente")
    .eq("id", vehiculoId)
    .eq("taller_id", auth.taller.id)
    .maybeSingle();

  const now = new Date().toISOString();
  const { error } = await admin
    .from("nfc_stickers")
    .update({
      vehiculo_id: vehiculoId,
      placa: meta?.placa ?? vehiculo.placa ?? null,
      marca: meta?.marca ?? null,
      modelo: meta?.modelo ?? null,
      color: meta?.color ?? null,
      nombre_titular: meta?.nombre_cliente ?? null,
      updated_at: now,
    })
    .eq("id", sticker.id)
    .eq("taller_id", auth.taller.id);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/importacion");
  revalidatePath(`/importacion/${vehiculoId}`);
  return { success: true };
}
