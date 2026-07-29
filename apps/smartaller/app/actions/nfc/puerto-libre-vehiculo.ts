"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient, getUser } from "@/lib/supabase/server";
import { getMyTaller } from "@/lib/taller";
import { hashPin } from "@/lib/nfc/crypto";
import {
  DOCUMENTO_TIPOS,
  documentoTipoSchema,
  importacionSchema,
  seguroSchema,
  diasHasta,
  esProximoNacionalizar,
  esProximoSeniat,
  parseImportacion,
  parseSeguro,
  parseVehiculosDocumentos,
  serializeImportacion,
  serializeSeguro,
  type DocumentoTipo,
  type ImportacionData,
  type SeguroData,
  type VehiculosDocumentos,
} from "@/lib/schemas/vehiculo-documentos";
import { uploadVehiculoDocumento, validateVehiculoDocumentoFile } from "@/lib/vehiculos/upload-documento";
import { nfcPinSchema } from "@/lib/validations/nfc";
import { puertoLibreAltaSchema } from "@/lib/schemas/puerto-libre-alta";

export type PuertoLibreActionResult =
  | { success: true }
  | { success: false; error: string };

export type PuertoLibreUploadResult =
  | { success: true; tipo: DocumentoTipo; documentos: VehiculosDocumentos }
  | { success: false; error: string };

const vehiculoDatosSchema = z.object({
  vehiculoId: z.string().uuid(),
  placa: z.string().trim().min(3).max(20),
  marca: z.string().trim().max(60).optional().nullable(),
  modelo: z.string().trim().max(60).optional().nullable(),
  color: z.string().trim().max(40).optional().nullable(),
  serialMotor: z.string().trim().max(80).optional().nullable(),
  serialCarroceria: z.string().trim().max(80).optional().nullable(),
  kilometrajeUltimo: z.coerce.number().int().min(0).optional().nullable(),
});

const propietarioSchema = z.object({
  vehiculoId: z.string().uuid(),
  nombreCliente: z.string().trim().max(120).optional().nullable(),
  telefonoCliente: z.string().trim().max(40).optional().nullable(),
  cedulaPropietario: z.string().trim().max(40).optional().nullable(),
  emailPropietario: z.string().trim().email().optional().nullable().or(z.literal("")),
  fechaNacimientoPropietario: z.string().trim().max(32).optional().nullable(),
});

const pinSchema = z.object({
  vehiculoId: z.string().uuid(),
  pin: nfcPinSchema,
});

async function requireTallerAuth() {
  const user = await getUser();
  if (!user) return { error: "Debes iniciar sesión" as const, taller: null };
  const taller = await getMyTaller();
  if (!taller) return { error: "No se encontró tu taller" as const, taller: null };
  return { error: null, taller };
}

async function assertVehiculoTaller(vehiculoId: string, tallerId: string) {
  const admin = createAdminClient();
  const { data } = await admin
    .from("vehiculos")
    .select("id, taller_id, documentos, importacion, seguro")
    .eq("id", vehiculoId)
    .maybeSingle();
  if (!data || data.taller_id !== tallerId) return null;
  return data;
}

function revalidateFicha(vehiculoId: string) {
  revalidatePath("/puerto-libre");
  revalidatePath(`/puerto-libre/${vehiculoId}`);
  revalidatePath(`/puerto-libre/${vehiculoId}/planilla`);
  revalidatePath(`/puerto-libre/${vehiculoId}/inspeccion`);
  revalidatePath(`/puerto-libre/hoja-inspeccion`);
}

export type CreatePuertoLibreResult =
  | { success: true; vehiculoId: string }
  | { success: false; error: string };

export async function createPuertoLibreVehiculoAction(
  raw: unknown
): Promise<CreatePuertoLibreResult> {
  const auth = await requireTallerAuth();
  if (auth.error || !auth.taller) {
    return { success: false, error: auth.error ?? "No autorizado" };
  }

  const parsed = puertoLibreAltaSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message ?? "Datos inválidos" };
  }

  const data = parsed.data;
  const placa = data.placa;

  const admin = createAdminClient();

  const { data: existing } = await admin
    .from("vehiculos")
    .select("id")
    .eq("placa", placa)
    .eq("taller_id", auth.taller.id)
    .maybeSingle();

  if (existing) {
    return {
      success: false,
      error: "Ya existe un vehículo con esa placa/identificador en tu taller.",
    };
  }

  const importacion = serializeImportacion({
    regimen: "Puerto Libre",
    fechaIngreso: data.fechaIngresoPl,
    anio: data.anio,
    importadorNombre: data.importadorNombre,
    importadorDocumento: data.importadorDocumento || null,
    importadorTelefono: data.importadorTelefono || null,
    importadorEmail: data.importadorEmail || null,
    estadoNacionalizacion: "pendiente",
    estadoSeniat: "pendiente",
  });

  const { data: created, error } = await admin
    .from("vehiculos")
    .insert({
      taller_id: auth.taller.id,
      tipo_vehiculo: "auto",
      placa,
      marca: data.marca,
      modelo: data.modelo,
      color: data.color,
      serial_motor: data.serialMotor,
      serial_carroceria: data.serialCarroceria,
      nombre_cliente: data.compradorNombre,
      telefono_cliente: data.compradorTelefono,
      cedula_propietario: data.compradorCedula || null,
      email_propietario: data.compradorEmail || null,
      documentos: {},
      importacion,
      seguro: {},
      unidad_odometro: "km",
      telegram_chat_id: null,
      updated_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error || !created) {
    return { success: false, error: error?.message ?? "No se pudo registrar el vehículo" };
  }

  revalidatePath("/puerto-libre");
  revalidatePath(`/puerto-libre/${created.id}/planilla`);
  return { success: true, vehiculoId: created.id };
}

export async function updatePuertoLibreImportacionAction(
  raw: unknown
): Promise<PuertoLibreActionResult> {
  const auth = await requireTallerAuth();
  if (auth.error || !auth.taller) {
    return { success: false, error: auth.error ?? "No autorizado" };
  }

  const schema = importacionSchema.extend({ vehiculoId: z.string().uuid() });
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message ?? "Datos inválidos" };
  }

  const row = await assertVehiculoTaller(parsed.data.vehiculoId, auth.taller.id);
  if (!row) return { success: false, error: "Vehículo no encontrado" };

  const { vehiculoId, ...importacion } = parsed.data;
  const existing = parseImportacion(row.importacion);
  const merged = serializeImportacion({ ...existing, ...importacion });

  const admin = createAdminClient();
  const { error } = await admin
    .from("vehiculos")
    .update({ importacion: merged, updated_at: new Date().toISOString() })
    .eq("id", vehiculoId)
    .eq("taller_id", auth.taller.id);

  if (error) return { success: false, error: error.message };
  revalidateFicha(vehiculoId);
  return { success: true };
}

export async function updatePuertoLibreSeguroAction(
  raw: unknown
): Promise<PuertoLibreActionResult> {
  const auth = await requireTallerAuth();
  if (auth.error || !auth.taller) {
    return { success: false, error: auth.error ?? "No autorizado" };
  }

  const schema = seguroSchema.extend({ vehiculoId: z.string().uuid() });
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message ?? "Datos inválidos" };
  }

  const row = await assertVehiculoTaller(parsed.data.vehiculoId, auth.taller.id);
  if (!row) return { success: false, error: "Vehículo no encontrado" };

  const { vehiculoId, ...seguro } = parsed.data;
  const existing = parseSeguro(row.seguro);
  const merged = serializeSeguro({ ...existing, ...seguro });

  const admin = createAdminClient();
  const { error } = await admin
    .from("vehiculos")
    .update({ seguro: merged, updated_at: new Date().toISOString() })
    .eq("id", vehiculoId)
    .eq("taller_id", auth.taller.id);

  if (error) return { success: false, error: error.message };
  revalidateFicha(vehiculoId);
  return { success: true };
}

export async function updatePuertoLibreVehiculoAction(
  raw: unknown
): Promise<PuertoLibreActionResult> {
  const auth = await requireTallerAuth();
  if (auth.error || !auth.taller) {
    return { success: false, error: auth.error ?? "No autorizado" };
  }

  const parsed = vehiculoDatosSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message ?? "Datos inválidos" };
  }

  const row = await assertVehiculoTaller(parsed.data.vehiculoId, auth.taller.id);
  if (!row) return { success: false, error: "Vehículo no encontrado" };

  const admin = createAdminClient();
  const { error } = await admin
    .from("vehiculos")
    .update({
      placa: parsed.data.placa.trim().toUpperCase(),
      marca: parsed.data.marca?.trim() || null,
      modelo: parsed.data.modelo?.trim() || null,
      color: parsed.data.color?.trim() || null,
      serial_motor: parsed.data.serialMotor?.trim() || null,
      serial_carroceria: parsed.data.serialCarroceria?.trim() || null,
      kilometraje_ultimo: parsed.data.kilometrajeUltimo ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", parsed.data.vehiculoId)
    .eq("taller_id", auth.taller.id);

  if (error) return { success: false, error: error.message };
  revalidateFicha(parsed.data.vehiculoId);
  return { success: true };
}

export async function updatePuertoLibrePropietarioAction(
  raw: unknown
): Promise<PuertoLibreActionResult> {
  const auth = await requireTallerAuth();
  if (auth.error || !auth.taller) {
    return { success: false, error: auth.error ?? "No autorizado" };
  }

  const parsed = propietarioSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message ?? "Datos inválidos" };
  }

  const row = await assertVehiculoTaller(parsed.data.vehiculoId, auth.taller.id);
  if (!row) return { success: false, error: "Vehículo no encontrado" };

  const admin = createAdminClient();
  const { error } = await admin
    .from("vehiculos")
    .update({
      nombre_cliente: parsed.data.nombreCliente?.trim() || null,
      telefono_cliente: parsed.data.telefonoCliente?.trim() || null,
      cedula_propietario: parsed.data.cedulaPropietario?.trim() || null,
      email_propietario: parsed.data.emailPropietario?.trim() || null,
      fecha_nacimiento_propietario: parsed.data.fechaNacimientoPropietario?.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", parsed.data.vehiculoId)
    .eq("taller_id", auth.taller.id);

  if (error) return { success: false, error: error.message };
  revalidateFicha(parsed.data.vehiculoId);
  return { success: true };
}

export async function setPuertoLibrePinAction(raw: unknown): Promise<PuertoLibreActionResult> {
  const auth = await requireTallerAuth();
  if (auth.error || !auth.taller) {
    return { success: false, error: auth.error ?? "No autorizado" };
  }

  const parsed = pinSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message ?? "PIN inválido" };
  }

  const row = await assertVehiculoTaller(parsed.data.vehiculoId, auth.taller.id);
  if (!row) return { success: false, error: "Vehículo no encontrado" };

  const pin_hash = await hashPin(parsed.data.pin);
  const admin = createAdminClient();
  const { error } = await admin
    .from("vehiculos")
    .update({ pin_hash, updated_at: new Date().toISOString() })
    .eq("id", parsed.data.vehiculoId)
    .eq("taller_id", auth.taller.id);

  if (error) return { success: false, error: error.message };
  revalidateFicha(parsed.data.vehiculoId);
  return { success: true };
}

/** Sube documento de importación / expediente y lo guarda en vehiculos.documentos. */
export async function uploadPuertoLibreDocumentoAction(
  formData: FormData
): Promise<PuertoLibreUploadResult> {
  const auth = await requireTallerAuth();
  if (auth.error || !auth.taller) {
    return { success: false, error: auth.error ?? "No autorizado" };
  }

  const vehiculoId = String(formData.get("vehiculoId") ?? "");
  const tipoRaw = String(formData.get("tipo") ?? "");
  const file = formData.get("file");

  const tipoParsed = documentoTipoSchema.safeParse(tipoRaw);
  if (!tipoParsed.success) {
    return { success: false, error: "Tipo de documento inválido" };
  }
  if (!z.string().uuid().safeParse(vehiculoId).success) {
    return { success: false, error: "Vehículo inválido" };
  }
  if (!(file instanceof File)) {
    return { success: false, error: "Selecciona un archivo" };
  }

  const validationError = validateVehiculoDocumentoFile(file);
  if (validationError) return { success: false, error: validationError };

  const row = await assertVehiculoTaller(vehiculoId, auth.taller.id);
  if (!row) return { success: false, error: "Vehículo no encontrado" };

  try {
    const admin = createAdminClient();
    const documento = await uploadVehiculoDocumento(admin, {
      tallerId: auth.taller.id,
      vehiculoId,
      tipo: tipoParsed.data,
      file,
    });

    const current = parseVehiculosDocumentos(row.documentos);
    const next: VehiculosDocumentos = {
      ...current,
      [tipoParsed.data]: documento,
    };

    const { error } = await admin
      .from("vehiculos")
      .update({ documentos: next, updated_at: new Date().toISOString() })
      .eq("id", vehiculoId)
      .eq("taller_id", auth.taller.id);

    if (error) {
      return {
        success: false,
        error: `Archivo subido pero no se guardó en documentos: ${error.message}`,
      };
    }

    revalidateFicha(vehiculoId);
    return { success: true, tipo: tipoParsed.data, documentos: next };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "No se pudo subir el documento";
    const lower = msg.toLowerCase();
    if (lower.includes("bucket") || lower.includes("not found") || lower.includes("vehiculos-documentos")) {
      return {
        success: false,
        error:
          "Falta el bucket Storage 'vehiculos-documentos' en Supabase. Ejecuta la migración 20250711100000_vehiculos_documentos.sql.",
      };
    }
    return { success: false, error: msg };
  }
}

export type PuertoLibreVehiculoListItem = {
  id: string;
  placa: string;
  marca: string | null;
  modelo: string | null;
  color: string | null;
  nombre_cliente: string | null;
  telefono_cliente: string | null;
  kilometraje_ultimo: number | null;
  created_at: string;
  tienePin: boolean;
  docsCount: number;
  stickerToken: string | null;
  regimen: string | null;
  estadoNacionalizacion: string | null;
  fechaLimiteNacionalizacion: string | null;
  estadoSeniat: string | null;
  fechaPresentacionSeniat: string | null;
  diasNacionalizacion: number | null;
  diasSeniat: number | null;
  proximoNacionalizar: boolean;
  proximoSeniat: boolean;
};

export async function listPuertoLibreVehiculos(): Promise<
  | { success: true; vehiculos: PuertoLibreVehiculoListItem[] }
  | { success: false; error: string; vehiculos: [] }
> {
  const auth = await requireTallerAuth();
  if (auth.error || !auth.taller) {
    return { success: false, error: auth.error ?? "No autorizado", vehiculos: [] };
  }

  const supabase = createClient();
  const { data, error } = await supabase
    .from("vehiculos")
    .select(
      "id, placa, marca, modelo, color, nombre_cliente, telefono_cliente, kilometraje_ultimo, created_at, pin_hash, documentos, importacion"
    )
    .eq("taller_id", auth.taller.id)
    .order("created_at", { ascending: false });

  if (error) {
    // Fallback si falta columna importacion / pin_hash aún no migrada
    const { data: fallback, error: fallbackError } = await supabase
      .from("vehiculos")
      .select(
        "id, placa, marca, modelo, color, nombre_cliente, telefono_cliente, kilometraje_ultimo, created_at, documentos"
      )
      .eq("taller_id", auth.taller.id)
      .order("created_at", { ascending: false });

    if (fallbackError) {
      return { success: false, error: error.message, vehiculos: [] };
    }

    const stickers = await loadStickersByVehiculo(auth.taller.id);
    return {
      success: true,
      vehiculos: (fallback ?? []).map((row) =>
        mapListItem(row as Record<string, unknown>, stickers)
      ),
    };
  }

  const stickers = await loadStickersByVehiculo(auth.taller.id);
  return {
    success: true,
    vehiculos: (data ?? []).map((row) =>
      mapListItem(row as Record<string, unknown>, stickers)
    ),
  };
}

async function loadStickersByVehiculo(tallerId: string): Promise<Map<string, string>> {
  const supabase = createClient();
  const { data } = await supabase
    .from("nfc_stickers")
    .select("vehiculo_id, token, activo")
    .eq("taller_id", tallerId)
    .eq("activo", true)
    .not("vehiculo_id", "is", null);

  const map = new Map<string, string>();
  for (const row of data ?? []) {
    if (row.vehiculo_id && !map.has(row.vehiculo_id)) {
      map.set(row.vehiculo_id as string, row.token as string);
    }
  }
  return map;
}

function mapListItem(
  row: Record<string, unknown>,
  stickers: Map<string, string>
): PuertoLibreVehiculoListItem {
  const docs = parseVehiculosDocumentos(row.documentos);
  const docsCount = DOCUMENTO_TIPOS.filter((t) => Boolean(docs[t])).length;
  const importacion = parseImportacion(row.importacion);
  const id = row.id as string;
  return {
    id,
    placa: (row.placa as string) ?? "",
    marca: (row.marca as string | null) ?? null,
    modelo: (row.modelo as string | null) ?? null,
    color: (row.color as string | null) ?? null,
    nombre_cliente: (row.nombre_cliente as string | null) ?? null,
    telefono_cliente: (row.telefono_cliente as string | null) ?? null,
    kilometraje_ultimo: (row.kilometraje_ultimo as number | null) ?? null,
    created_at: (row.created_at as string) ?? "",
    tienePin: Boolean(row.pin_hash),
    docsCount,
    stickerToken: stickers.get(id) ?? null,
    regimen: importacion.regimen ?? null,
    estadoNacionalizacion: importacion.estadoNacionalizacion ?? null,
    fechaLimiteNacionalizacion: importacion.fechaLimiteNacionalizacion ?? null,
    estadoSeniat: importacion.estadoSeniat ?? null,
    fechaPresentacionSeniat: importacion.fechaPresentacionSeniat ?? null,
    diasNacionalizacion: diasHasta(importacion.fechaLimiteNacionalizacion),
    diasSeniat: diasHasta(importacion.fechaPresentacionSeniat),
    proximoNacionalizar: esProximoNacionalizar(importacion),
    proximoSeniat: esProximoSeniat(importacion),
  };
}

export type PuertoLibreFicha = {
  id: string;
  placa: string;
  marca: string | null;
  modelo: string | null;
  color: string | null;
  serial_motor: string | null;
  serial_carroceria: string | null;
  kilometraje_ultimo: number | null;
  nombre_cliente: string | null;
  telefono_cliente: string | null;
  cedula_propietario: string | null;
  email_propietario: string | null;
  fecha_nacimiento_propietario: string | null;
  tienePin: boolean;
  tieneInspeccionTransportista: boolean;
  documentos: VehiculosDocumentos;
  importacion: ImportacionData;
  seguro: SeguroData;
  sticker: { id: string; token: string; activo: boolean } | null;
};

function tieneActaTransportista(raw: unknown): boolean {
  if (!raw || typeof raw !== "object") return false;
  const row = raw as Record<string, unknown>;
  if (typeof row.updated_at === "string" && row.updated_at.length > 0) return true;
  const checklist = row.checklist;
  return Boolean(checklist && typeof checklist === "object" && Object.keys(checklist).length > 0);
}

export async function getPuertoLibreFicha(
  vehiculoId: string
): Promise<{ success: true; ficha: PuertoLibreFicha } | { success: false; error: string }> {
  const auth = await requireTallerAuth();
  if (auth.error || !auth.taller) {
    return { success: false, error: auth.error ?? "No autorizado" };
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("vehiculos")
    .select(
      "id, placa, marca, modelo, color, serial_motor, serial_carroceria, kilometraje_ultimo, nombre_cliente, telefono_cliente, cedula_propietario, email_propietario, fecha_nacimiento_propietario, pin_hash, documentos, importacion, seguro, inspeccion_transportista, taller_id"
    )
    .eq("id", vehiculoId)
    .maybeSingle();

  if (error) {
    // Fallback si faltan columnas nuevas (seguro / inspeccion_transportista)
    const { data: fallback, error: fallbackError } = await admin
      .from("vehiculos")
      .select(
        "id, placa, marca, modelo, color, serial_motor, serial_carroceria, kilometraje_ultimo, nombre_cliente, telefono_cliente, cedula_propietario, email_propietario, fecha_nacimiento_propietario, pin_hash, documentos, importacion, taller_id"
      )
      .eq("id", vehiculoId)
      .maybeSingle();

    if (fallbackError || !fallback || fallback.taller_id !== auth.taller.id) {
      return { success: false, error: error.message };
    }

    const { data: stickerFb } = await admin
      .from("nfc_stickers")
      .select("id, token, activo")
      .eq("taller_id", auth.taller.id)
      .eq("vehiculo_id", vehiculoId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    return {
      success: true,
      ficha: {
        id: fallback.id,
        placa: fallback.placa,
        marca: fallback.marca,
        modelo: fallback.modelo,
        color: fallback.color,
        serial_motor: fallback.serial_motor,
        serial_carroceria: fallback.serial_carroceria,
        kilometraje_ultimo: fallback.kilometraje_ultimo,
        nombre_cliente: fallback.nombre_cliente,
        telefono_cliente: fallback.telefono_cliente,
        cedula_propietario: fallback.cedula_propietario,
        email_propietario: fallback.email_propietario,
        fecha_nacimiento_propietario: fallback.fecha_nacimiento_propietario,
        tienePin: Boolean(fallback.pin_hash),
        tieneInspeccionTransportista: false,
        documentos: parseVehiculosDocumentos(fallback.documentos),
        importacion: parseImportacion(fallback.importacion),
        seguro: {},
        sticker: stickerFb
          ? { id: stickerFb.id, token: stickerFb.token, activo: stickerFb.activo }
          : null,
      },
    };
  }

  if (!data || data.taller_id !== auth.taller.id) {
    return { success: false, error: "Vehículo no encontrado" };
  }

  const { data: sticker } = await admin
    .from("nfc_stickers")
    .select("id, token, activo")
    .eq("taller_id", auth.taller.id)
    .eq("vehiculo_id", vehiculoId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return {
    success: true,
    ficha: {
      id: data.id,
      placa: data.placa,
      marca: data.marca,
      modelo: data.modelo,
      color: data.color,
      serial_motor: data.serial_motor,
      serial_carroceria: data.serial_carroceria,
      kilometraje_ultimo: data.kilometraje_ultimo,
      nombre_cliente: data.nombre_cliente,
      telefono_cliente: data.telefono_cliente,
      cedula_propietario: data.cedula_propietario,
      email_propietario: data.email_propietario,
      fecha_nacimiento_propietario: data.fecha_nacimiento_propietario,
      tienePin: Boolean(data.pin_hash),
      tieneInspeccionTransportista: tieneActaTransportista(data.inspeccion_transportista),
      documentos: parseVehiculosDocumentos(data.documentos),
      importacion: parseImportacion(data.importacion),
      seguro: parseSeguro(data.seguro),
      sticker: sticker
        ? { id: sticker.id, token: sticker.token, activo: sticker.activo }
        : null,
    },
  };
}
