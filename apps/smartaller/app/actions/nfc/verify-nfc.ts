"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { verifyPin } from "@/lib/nfc/crypto";
import type {
  NfcDocumentPublic,
  NfcStickerPublic,
  NfcVerifiedVehicle,
} from "@/lib/nfc/types";
import { parseVehiculosDocumentos } from "@/lib/schemas/vehiculo-documentos";
import { nfcTokenSchema, verifyNfcSchema } from "@/lib/validations/nfc";

export type VerifyNfcResult =
  | { success: true; sticker: NfcStickerPublic }
  | { success: false; error: string };

export type VerifyNFCAndPinResult =
  | { success: true; data: NfcVerifiedVehicle }
  | { success: false; message: string };

type TagRow = {
  id: string;
  token: string;
  etiqueta: string | null;
  placa: string | null;
  marca: string | null;
  modelo: string | null;
  color: string | null;
  nombre_titular: string | null;
  activo: boolean;
  pin_hash: string | null;
  vehiculo_id: string | null;
  last_verified_at: string | null;
  last_scanned_at: string | null;
  talleres: { nombre: string } | { nombre: string }[] | null;
};

type VehicleRow = {
  id: string;
  marca: string | null;
  modelo: string | null;
  placa: string;
  color: string | null;
  nombre_cliente: string | null;
  serial_carroceria: string | null;
  kilometraje_ultimo: number | null;
  created_at: string;
  pin_hash: string | null;
  documentos: unknown;
};

function tallerNombreFrom(join: TagRow["talleres"]): string | null {
  if (!join) return null;
  return Array.isArray(join) ? join[0]?.nombre ?? null : join.nombre ?? null;
}

function mapDocuments(raw: unknown): NfcDocumentPublic[] {
  const docs = parseVehiculosDocumentos(raw);
  const out: NfcDocumentPublic[] = [];
  if (docs.cedula) {
    out.push({
      id: "cedula",
      docType: "cedula",
      fileName: "Cédula",
      filePath: docs.cedula.path,
      url: docs.cedula.url,
    });
  }
  if (docs.titulo) {
    out.push({
      id: "titulo",
      docType: "titulo",
      fileName: "Título de propiedad",
      filePath: docs.titulo.path,
      url: docs.titulo.url,
    });
  }
  return out;
}

function toVerifiedVehicle(vehicle: VehicleRow): NfcVerifiedVehicle {
  return {
    brand: vehicle.marca,
    model: vehicle.modelo,
    year: null,
    plate: vehicle.placa,
    vin: vehicle.serial_carroceria,
    entryDate: vehicle.created_at,
    mileage: vehicle.kilometraje_ultimo ?? 0,
    color: vehicle.color,
    nombreTitular: vehicle.nombre_cliente,
    documents: mapDocuments(vehicle.documentos),
  };
}

function toPublicPreview(
  tag: TagRow,
  opts: { requierePin: boolean; verificado: boolean; vehicle: NfcVerifiedVehicle | null }
): NfcStickerPublic {
  return {
    token: tag.token,
    etiqueta: tag.etiqueta,
    placa: opts.vehicle?.plate ?? tag.placa,
    marca: opts.vehicle?.brand ?? tag.marca,
    modelo: opts.vehicle?.model ?? tag.modelo,
    color: opts.vehicle?.color ?? tag.color,
    nombre_titular: opts.vehicle?.nombreTitular ?? tag.nombre_titular,
    activo: tag.activo,
    requierePin: opts.requierePin,
    tallerNombre: tallerNombreFrom(tag.talleres),
    verificado: opts.verificado,
    vehicle: opts.verificado ? opts.vehicle : null,
  };
}

async function loadTag(token: string): Promise<TagRow | null> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("nfc_stickers")
    .select(
      "id, token, etiqueta, placa, marca, modelo, color, nombre_titular, activo, pin_hash, vehiculo_id, last_verified_at, last_scanned_at, talleres(nombre)"
    )
    .eq("token", token)
    .maybeSingle();
  return (data as TagRow | null) ?? null;
}

async function loadVehicle(vehiculoId: string): Promise<VehicleRow | null> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("vehiculos")
    .select(
      "id, marca, modelo, placa, color, nombre_cliente, serial_carroceria, kilometraje_ultimo, created_at, pin_hash, documentos"
    )
    .eq("id", vehiculoId)
    .maybeSingle();
  return (data as VehicleRow | null) ?? null;
}

function resolvePinHash(tag: TagRow, vehicle: VehicleRow | null): string | null {
  return vehicle?.pin_hash || tag.pin_hash || null;
}

/** Carga preview público del sticker (sin revelar datos sensibles si hay PIN). */
export async function getNfcStickerPublic(token: string): Promise<VerifyNfcResult> {
  const parsed = nfcTokenSchema.safeParse(token);
  if (!parsed.success) {
    return { success: false, error: "Token inválido" };
  }

  const tag = await loadTag(parsed.data);
  if (!tag) return { success: false, error: "Sticker no encontrado" };
  if (!tag.activo) return { success: false, error: "Este sticker está desactivado" };

  const vehicle = tag.vehiculo_id ? await loadVehicle(tag.vehiculo_id) : null;
  const pinHash = resolvePinHash(tag, vehicle);
  const requierePin = Boolean(pinHash);

  return {
    success: true,
    sticker: toPublicPreview(tag, {
      requierePin,
      verificado: !requierePin,
      vehicle: vehicle && !requierePin ? toVerifiedVehicle(vehicle) : null,
    }),
  };
}

/**
 * Verifica tag NFC + PIN del vehículo (flujo Puerto Libre).
 * Adapta el contrato verifyNFCAndPin al esquema SmartTaller
 * (nfc_stickers + vehiculos + documentos jsonb). Usa service role (RLS activo).
 */
export async function verifyNFCAndPin(
  publicToken: string,
  userPin: string
): Promise<VerifyNFCAndPinResult> {
  const parsed = verifyNfcSchema.safeParse({ token: publicToken, pin: userPin });
  if (!parsed.success) {
    return {
      success: false,
      message: parsed.error.errors[0]?.message ?? "Datos inválidos",
    };
  }

  const supabase = createAdminClient();

  // 1. Validar tag NFC
  const tag = await loadTag(parsed.data.token);
  if (!tag || !tag.activo) {
    return { success: false, message: "Sticker NFC no válido o inactivo." };
  }

  // 2. Datos del vehículo (Smart Taller)
  if (!tag.vehiculo_id) {
    // Fallback: sticker sin vínculo — valida pin_hash del sticker y datos denormalizados
    if (!tag.pin_hash) {
      return { success: false, message: "Sticker sin vehículo ni PIN configurado." };
    }
    const ok = await verifyPin(parsed.data.pin, tag.pin_hash);
    if (!ok) return { success: false, message: "PIN incorrecto." };

    const now = new Date().toISOString();
    await supabase
      .from("nfc_stickers")
      .update({ last_scanned_at: now, last_verified_at: now, updated_at: now })
      .eq("token", tag.token);

    return {
      success: true,
      data: {
        brand: tag.marca,
        model: tag.modelo,
        year: null,
        plate: tag.placa,
        vin: null,
        entryDate: null,
        mileage: 0,
        color: tag.color,
        nombreTitular: tag.nombre_titular,
        documents: [],
      },
    };
  }

  const vehicle = await loadVehicle(tag.vehiculo_id);
  if (!vehicle) {
    return { success: false, message: "Vehículo no encontrado." };
  }

  // 3. Validar PIN (preferencia: vehiculos.pin_hash)
  const pinHash = resolvePinHash(tag, vehicle);
  if (!pinHash) {
    return { success: false, message: "Este vehículo no tiene PIN configurado." };
  }

  const isPinValid = await verifyPin(parsed.data.pin, pinHash);
  if (!isPinValid) {
    return { success: false, message: "PIN incorrecto." };
  }

  // 4. Documentos Puerto Libre (vehiculos.documentos jsonb)
  const data = toVerifiedVehicle(vehicle);

  // 5. Registrar escaneo
  const now = new Date().toISOString();
  await supabase
    .from("nfc_stickers")
    .update({ last_scanned_at: now, last_verified_at: now, updated_at: now })
    .eq("token", parsed.data.token);

  return { success: true, data };
}

/** Wrapper Zod para formularios: token + pin → sticker público verificado. */
export async function verifyNfcPin(raw: unknown): Promise<VerifyNfcResult> {
  const parsed = verifyNfcSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message ?? "Datos inválidos" };
  }

  const result = await verifyNFCAndPin(parsed.data.token, parsed.data.pin);
  if (!result.success) {
    return { success: false, error: result.message };
  }

  const tag = await loadTag(parsed.data.token);
  if (!tag) return { success: false, error: "Sticker no encontrado" };

  return {
    success: true,
    sticker: toPublicPreview(tag, {
      requierePin: true,
      verificado: true,
      vehicle: result.data,
    }),
  };
}
