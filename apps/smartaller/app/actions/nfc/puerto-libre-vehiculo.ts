"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient, getUser } from "@/lib/supabase/server";
import { getMyTaller } from "@/lib/taller";
import { hashPin } from "@/lib/nfc/crypto";
import {
  DOCUMENTO_TIPOS,
  MEMORIA_FOTOGRAFICA_TIPOS,
  PL_ADUANA_DOCUMENTO_TIPOS,
  PL_EMBARQUE_DOCUMENTO_TIPOS,
  PL_REGISTRO_DOCUMENTO_TIPOS,
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
import {
  formatCodigoExpediente,
  parseCodigoExpediente,
  partsFromDate,
  placaPendienteDesdeCodigo,
  placaRealVisible,
  resolveCodigoExpediente,
} from "@/lib/puerto-libre/expediente";
import {
  findDuplicateSerialCarroceria,
  normalizarSerialCarroceria,
  SERIAL_CARROCERIA_DUPLICADO,
} from "@/lib/vehicles/serial";
import { deleteVehiculoConDependencias } from "@/lib/vehicles/delete-cascade";
import type { SupabaseClient } from "@supabase/supabase-js";

export type PuertoLibreActionResult =
  | { success: true }
  | { success: false; error: string };

export type PuertoLibreUploadResult =
  | { success: true; tipo: DocumentoTipo; documentos: VehiculosDocumentos }
  | { success: false; error: string };

const vehiculoDatosSchema = z.object({
  vehiculoId: z.string().uuid(),
  /** Placa real; vacía = sin placa aún (no usar el expediente). */
  placa: z.string().trim().max(20).optional().or(z.literal("")),
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
  direccion: z.string().trim().max(240).optional().nullable(),
});

const fase2LlegadaSchema = z.object({
  vehiculoId: z.string().uuid(),
  fechaIngreso: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha de ingreso inválida"),
  checklistLlegada: z.record(z.string()).default({}),
  checklistLlegadaNotas: z.record(z.string()).default({}),
  otrosDispositivosNotas: z.string().trim().max(500).optional().nullable(),
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
    .select("id, taller_id, placa, documentos, importacion, seguro")
    .eq("id", vehiculoId)
    .maybeSingle();
  if (!data || data.taller_id !== tallerId) return null;
  return data;
}

function revalidateFicha(vehiculoId: string) {
  revalidatePath("/puerto-libre");
  revalidatePath(`/puerto-libre/${vehiculoId}`);
  revalidatePath(`/puerto-libre/${vehiculoId}/planilla`);
  revalidatePath(`/puerto-libre/${vehiculoId}/propietario`);
  revalidatePath(`/puerto-libre/${vehiculoId}/inspeccion`);
  revalidatePath(`/puerto-libre/hoja-inspeccion`);
}

export type CreatePuertoLibreResult =
  | { success: true; vehiculoId: string; codigoExpediente: string }
  | { success: false; error: string };

function maxNumeroExpedienteEnFilas(
  rows: Array<{ placa?: unknown; importacion?: unknown }>,
  year: number,
  month: number
): number {
  let max = 0;
  for (const row of rows) {
    const placa = typeof row.placa === "string" ? row.placa : "";
    const imp = parseImportacion(row.importacion);
    const codigo = resolveCodigoExpediente({
      codigoExpediente: imp.codigoExpediente,
      placa,
    });
    const parts = parseCodigoExpediente(codigo);
    if (parts && parts.year === year && parts.month === month) {
      max = Math.max(max, parts.numero);
    }
    if (
      typeof imp.numeroExpediente === "number" &&
      Number.isFinite(imp.numeroExpediente) &&
      parts &&
      parts.year === year &&
      parts.month === month
    ) {
      max = Math.max(max, imp.numeroExpediente);
    }
  }
  return max;
}

async function nextNumeroExpedienteMes(
  admin: SupabaseClient,
  tallerId: string,
  year: number,
  month: number
): Promise<number> {
  // Escanea todo el taller: la placa puede no ser PL-Y.M.N aunque el código sí esté en importacion.
  const { data } = await admin
    .from("vehiculos")
    .select("placa, importacion")
    .eq("taller_id", tallerId);

  return maxNumeroExpedienteEnFilas(data ?? [], year, month) + 1;
}

/**
 * Asigna PL-Año.Mes.N a vehículos del taller que aún no tienen código válido
 * (muta `rows` en memoria y persiste en importacion).
 */
async function backfillCodigosExpediente(
  tallerId: string,
  rows: Record<string, unknown>[]
): Promise<void> {
  const needing = rows.filter((row) => {
    const placa = (row.placa as string) ?? "";
    const imp = parseImportacion(row.importacion);
    return !resolveCodigoExpediente({
      codigoExpediente: imp.codigoExpediente,
      placa,
    });
  });
  if (needing.length === 0) return;

  needing.sort((a, b) =>
    String(a.created_at ?? "").localeCompare(String(b.created_at ?? ""))
  );

  const admin = createAdminClient();
  // Base el correlativo en TODOS los vehículos del taller, no solo en `rows`.
  const { data: allRows } = await admin
    .from("vehiculos")
    .select("placa, importacion")
    .eq("taller_id", tallerId);

  const maxByMonth = new Map<string, number>();
  for (const row of allRows ?? []) {
    const placa = (row.placa as string) ?? "";
    const imp = parseImportacion(row.importacion);
    const codigo = resolveCodigoExpediente({
      codigoExpediente: imp.codigoExpediente,
      placa,
    });
    const parts = parseCodigoExpediente(codigo);
    if (!parts) continue;
    const key = `${parts.year}-${parts.month}`;
    maxByMonth.set(key, Math.max(maxByMonth.get(key) ?? 0, parts.numero));
  }

  for (const row of needing) {
    const created = new Date(String(row.created_at ?? ""));
    const { year, month } = Number.isNaN(created.getTime())
      ? partsFromDate()
      : partsFromDate(created);
    const key = `${year}-${month}`;
    const next = (maxByMonth.get(key) ?? 0) + 1;
    maxByMonth.set(key, next);
    const codigo = formatCodigoExpediente(year, month, next);
    const existing = parseImportacion(row.importacion);
    const merged = serializeImportacion({
      ...existing,
      codigoExpediente: codigo,
      numeroExpediente: next,
    });
    const { error } = await admin
      .from("vehiculos")
      .update({ importacion: merged, updated_at: new Date().toISOString() })
      .eq("id", row.id as string)
      .eq("taller_id", tallerId);
    if (!error) {
      row.importacion = merged;
    }
  }
}

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
  const admin = createAdminClient();
  const serialCarroceria = normalizarSerialCarroceria(data.serialCarroceria);
  const serialMotor = normalizarSerialCarroceria(data.serialMotor);

  const existingSerial = await findDuplicateSerialCarroceria(
    admin,
    auth.taller.id,
    serialCarroceria
  );
  if (existingSerial) {
    return { success: false, error: SERIAL_CARROCERIA_DUPLICADO };
  }

  const { year, month } = partsFromDate();
  const numero = await nextNumeroExpedienteMes(admin, auth.taller.id, year, month);
  const codigoExpediente = formatCodigoExpediente(year, month, numero);
  // Al registrar aún no hay placa; se carga después en Editar.
  const placa = placaPendienteDesdeCodigo(codigoExpediente);

  const importacion = serializeImportacion({
    regimen: "Puerto Libre",
    anio: data.anio,
    fechaLlegadaBuque: data.fechaLlegadaBuque,
    importadorNombre: data.importadorNombre,
    importadorDocumento: data.importadorDocumento || null,
    importadorTelefono: data.importadorTelefono || null,
    importadorEmail: data.importadorEmail || null,
    aduana: data.aduana || null,
    numeroBl: data.numeroBl || null,
    paisOrigen: data.paisOrigen || null,
    valorCif: data.valorCif,
    observaciones: data.observaciones || null,
    estadoNacionalizacion: "pendiente",
    estadoSeniat: "pendiente",
    planillaFase: 1,
    codigoExpediente,
    numeroExpediente: numero,
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
      serial_motor: serialMotor,
      serial_carroceria: serialCarroceria,
      nombre_cliente: null,
      telefono_cliente: null,
      cedula_propietario: null,
      email_propietario: null,
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
    if (error?.code === "23505" && error.message.includes("serial_carroceria")) {
      return { success: false, error: SERIAL_CARROCERIA_DUPLICADO };
    }
    return { success: false, error: error?.message ?? "No se pudo registrar el vehículo" };
  }

  revalidatePath("/puerto-libre");
  revalidatePath(`/puerto-libre/${created.id}/planilla`);
  return { success: true, vehiculoId: created.id, codigoExpediente };
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
  const serialCarroceria = parsed.data.serialCarroceria?.trim()
    ? normalizarSerialCarroceria(parsed.data.serialCarroceria)
    : null;
  const serialMotor = parsed.data.serialMotor?.trim()
    ? normalizarSerialCarroceria(parsed.data.serialMotor)
    : null;

  if (serialCarroceria) {
    const existingSerial = await findDuplicateSerialCarroceria(
      admin,
      auth.taller.id,
      serialCarroceria,
      parsed.data.vehiculoId
    );
    if (existingSerial) {
      return { success: false, error: SERIAL_CARROCERIA_DUPLICADO };
    }
  }

  const importacion = parseImportacion(row.importacion);
  const codigoExpediente =
    resolveCodigoExpediente({
      codigoExpediente: importacion.codigoExpediente,
      placa: row.placa,
    }) ?? placaPendienteDesdeCodigo(`PL-${Date.now()}`);
  const placaIngresada = (parsed.data.placa ?? "").trim().toUpperCase().replace(/\s+/g, "");
  if (placaIngresada && parseCodigoExpediente(placaIngresada)) {
    return {
      success: false,
      error: "La placa no puede ser el número de expediente (PL-Año.Mes.N).",
    };
  }
  const placa = placaIngresada || placaPendienteDesdeCodigo(codigoExpediente);

  if (placaRealVisible(placa, codigoExpediente)) {
    const { data: placaDup } = await admin
      .from("vehiculos")
      .select("id")
      .eq("taller_id", auth.taller.id)
      .eq("placa", placa)
      .neq("id", parsed.data.vehiculoId)
      .maybeSingle();
    if (placaDup) {
      return { success: false, error: "Ya existe otro vehículo con esa placa en tu taller." };
    }
  }

  const { error } = await admin
    .from("vehiculos")
    .update({
      placa,
      marca: parsed.data.marca?.trim() || null,
      modelo: parsed.data.modelo?.trim() || null,
      color: parsed.data.color?.trim() || null,
      serial_motor: serialMotor,
      serial_carroceria: serialCarroceria,
      kilometraje_ultimo: parsed.data.kilometrajeUltimo ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", parsed.data.vehiculoId)
    .eq("taller_id", auth.taller.id);

  if (error) {
    if (error.code === "23505" && error.message.includes("serial_carroceria")) {
      return { success: false, error: SERIAL_CARROCERIA_DUPLICADO };
    }
    if (error.code === "23505" && error.message.includes("placa")) {
      return { success: false, error: "Ya existe otro vehículo con esa placa en tu taller." };
    }
    return { success: false, error: error.message };
  }
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

  const existingImportacion = parseImportacion(row.importacion);
  const importacion = serializeImportacion({
    ...existingImportacion,
    compradorDireccion: parsed.data.direccion ?? existingImportacion.compradorDireccion,
  });

  const admin = createAdminClient();
  const { error } = await admin
    .from("vehiculos")
    .update({
      nombre_cliente: parsed.data.nombreCliente?.trim() || null,
      telefono_cliente: parsed.data.telefonoCliente?.trim() || null,
      cedula_propietario: parsed.data.cedulaPropietario?.trim() || null,
      email_propietario: parsed.data.emailPropietario?.trim() || null,
      fecha_nacimiento_propietario: parsed.data.fechaNacimientoPropietario?.trim() || null,
      importacion,
      updated_at: new Date().toISOString(),
    })
    .eq("id", parsed.data.vehiculoId)
    .eq("taller_id", auth.taller.id);

  if (error) return { success: false, error: error.message };
  revalidateFicha(parsed.data.vehiculoId);
  return { success: true };
}

/** Marca fase 1A (docs de embarque) completa y avanza a fase 2 (llegada). */
export async function completePuertoLibreFase1aEmbarqueAction(
  vehiculoId: string
): Promise<PuertoLibreActionResult> {
  const auth = await requireTallerAuth();
  if (auth.error || !auth.taller) {
    return { success: false, error: auth.error ?? "No autorizado" };
  }

  const idParsed = z.string().uuid().safeParse(vehiculoId);
  if (!idParsed.success) return { success: false, error: "ID inválido" };

  const row = await assertVehiculoTaller(idParsed.data, auth.taller.id);
  if (!row) return { success: false, error: "Vehículo no encontrado" };

  const docs = parseVehiculosDocumentos(row.documentos);
  const faltantes = PL_EMBARQUE_DOCUMENTO_TIPOS.filter((t) => !docs[t]?.url);
  if (faltantes.length > 0) {
    return {
      success: false,
      error: "Carga factura, certificado de origen y BL antes de continuar",
    };
  }

  const existing = parseImportacion(row.importacion);
  const importacion = serializeImportacion({ ...existing, planillaFase: 2 });

  const admin = createAdminClient();
  const { error } = await admin
    .from("vehiculos")
    .update({ importacion, updated_at: new Date().toISOString() })
    .eq("id", idParsed.data)
    .eq("taller_id", auth.taller.id);

  if (error) return { success: false, error: error.message };
  revalidateFicha(idParsed.data);
  return { success: true };
}

/** Guarda fase 2 (llegada) y avanza a fase 3 (aduana / retiro). */
export async function savePuertoLibreFase2LlegadaAction(
  raw: unknown
): Promise<PuertoLibreActionResult> {
  const auth = await requireTallerAuth();
  if (auth.error || !auth.taller) {
    return { success: false, error: auth.error ?? "No autorizado" };
  }

  const parsed = fase2LlegadaSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message ?? "Datos inválidos" };
  }

  const row = await assertVehiculoTaller(parsed.data.vehiculoId, auth.taller.id);
  if (!row) return { success: false, error: "Vehículo no encontrado" };

  const checklist = parsed.data.checklistLlegada;
  const checklistNotas = parsed.data.checklistLlegadaNotas;
  const existingImportacion = parseImportacion(row.importacion);
  const existingSeguro = parseSeguro(row.seguro);

  const importacion = serializeImportacion({
    ...existingImportacion,
    fechaIngreso: parsed.data.fechaIngreso,
    checklistLlegada: checklist,
    checklistLlegadaNotas: checklistNotas,
    otrosDispositivosNotas: parsed.data.otrosDispositivosNotas || null,
    planillaFase: 3,
  });

  const seguro = serializeSeguro({
    ...existingSeguro,
    tieneAlarma: checklist.alarma === "sin_dano" ? true : checklist.alarma === "falla" ? false : existingSeguro.tieneAlarma,
    tieneGps:
      checklist.gps_rastreador === "sin_dano"
        ? true
        : checklist.gps_rastreador === "falla"
          ? false
          : existingSeguro.tieneGps,
    tieneInmovilizador:
      checklist.inmovilizador === "sin_dano"
        ? true
        : checklist.inmovilizador === "falla"
          ? false
          : existingSeguro.tieneInmovilizador,
    dispositivosSeguridad:
      parsed.data.otrosDispositivosNotas?.trim() || existingSeguro.dispositivosSeguridad,
  });

  const admin = createAdminClient();
  const { error } = await admin
    .from("vehiculos")
    .update({
      importacion,
      seguro,
      updated_at: new Date().toISOString(),
    })
    .eq("id", parsed.data.vehiculoId)
    .eq("taller_id", auth.taller.id);

  if (error) return { success: false, error: error.message };
  revalidateFicha(parsed.data.vehiculoId);
  return { success: true };
}

/** Marca fase 3 (liquidación aduana / retiro) como completa. */
export async function completePuertoLibreFase3Action(
  vehiculoId: string
): Promise<PuertoLibreActionResult> {
  const auth = await requireTallerAuth();
  if (auth.error || !auth.taller) {
    return { success: false, error: auth.error ?? "No autorizado" };
  }

  const idParsed = z.string().uuid().safeParse(vehiculoId);
  if (!idParsed.success) return { success: false, error: "ID inválido" };

  const row = await assertVehiculoTaller(idParsed.data, auth.taller.id);
  if (!row) return { success: false, error: "Vehículo no encontrado" };

  const docs = parseVehiculosDocumentos(row.documentos);
  const faltantes = PL_ADUANA_DOCUMENTO_TIPOS.filter((t) => !docs[t]?.url);
  if (faltantes.length > 0) {
    return {
      success: false,
      error:
        "Carga la planilla de liquidación aduanera (CVA / DUA) para autorizar el retiro",
    };
  }

  const existing = parseImportacion(row.importacion);
  const importacion = serializeImportacion({ ...existing, planillaFase: 4 });

  const admin = createAdminClient();
  const { error } = await admin
    .from("vehiculos")
    .update({ importacion, updated_at: new Date().toISOString() })
    .eq("id", idParsed.data)
    .eq("taller_id", auth.taller.id);

  if (error) return { success: false, error: error.message };
  revalidateFicha(idParsed.data);
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

/**
 * Elimina un expediente Puerto Libre (vehículo) del taller.
 * Asume RLS/ownership vía taller_id; usa admin client tras verificar pertenencia.
 */
export async function deletePuertoLibreVehiculoAction(
  raw: unknown
): Promise<PuertoLibreActionResult> {
  const auth = await requireTallerAuth();
  if (auth.error || !auth.taller) {
    return { success: false, error: auth.error ?? "No autorizado" };
  }

  const parsed = z.object({ vehiculoId: z.string().uuid() }).safeParse(raw);
  if (!parsed.success) {
    return { success: false, error: "Expediente inválido" };
  }

  const row = await assertVehiculoTaller(parsed.data.vehiculoId, auth.taller.id);
  if (!row) return { success: false, error: "Expediente no encontrado" };

  const admin = createAdminClient();
  const vehiculoId = parsed.data.vehiculoId;

  const deleted = await deleteVehiculoConDependencias(admin, {
    vehiculoId,
    tallerId: auth.taller.id,
  });
  if (!deleted.ok) {
    return {
      success: false,
      error:
        deleted.error.includes("foreign key") || deleted.error.includes("violates")
          ? "No se pudo eliminar: hay registros vinculados. Intenta de nuevo."
          : deleted.error,
    };
  }

  revalidatePath("/puerto-libre");
  revalidatePath(`/puerto-libre/${vehiculoId}`);
  revalidatePath(`/puerto-libre/${vehiculoId}/planilla`);
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

  if (tipoParsed.data === "manual_vehiculo" && file.type !== "application/pdf") {
    return { success: false, error: "El manual del vehículo debe ser un archivo PDF" };
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
  updated_at: string | null;
  tienePin: boolean;
  docsCount: number;
  /** Documentos de registro PL faltantes (embarque + aduana + fotos). */
  docsFaltantes: number;
  planillaFase: number | null;
  /** Fecha de llegada del buque (YYYY-MM-DD). */
  fechaLlegadaBuque: string | null;
  /** Fecha de ingreso físico al PL (YYYY-MM-DD). */
  fechaIngreso: string | null;
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
  codigoExpediente: string | null;
  fotoUrl: string | null;
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
      "id, placa, marca, modelo, color, nombre_cliente, telefono_cliente, kilometraje_ultimo, created_at, updated_at, pin_hash, documentos, importacion"
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
  const rows = (data ?? []) as Record<string, unknown>[];
  await backfillCodigosExpediente(auth.taller.id, rows);
  return {
    success: true,
    vehiculos: rows.map((row) => mapListItem(row, stickers)),
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

function countDocsFaltantes(docs: VehiculosDocumentos): number {
  let faltantes = 0;
  for (const tipo of PL_REGISTRO_DOCUMENTO_TIPOS) {
    if (!docs[tipo]?.url) faltantes += 1;
  }
  for (const tipo of MEMORIA_FOTOGRAFICA_TIPOS) {
    if (!docs[tipo]?.url) faltantes += 1;
  }
  return faltantes;
}

function mapListItem(
  row: Record<string, unknown>,
  stickers: Map<string, string>
): PuertoLibreVehiculoListItem {
  const docs = parseVehiculosDocumentos(row.documentos);
  const docsCount = DOCUMENTO_TIPOS.filter((t) => Boolean(docs[t])).length;
  const importacion = parseImportacion(row.importacion);
  const id = row.id as string;
  const placa = (row.placa as string) ?? "";
  const planillaFase =
    typeof importacion.planillaFase === "number" &&
    Number.isFinite(importacion.planillaFase)
      ? importacion.planillaFase
      : null;
  return {
    id,
    placa,
    marca: (row.marca as string | null) ?? null,
    modelo: (row.modelo as string | null) ?? null,
    color: (row.color as string | null) ?? null,
    nombre_cliente: (row.nombre_cliente as string | null) ?? null,
    telefono_cliente: (row.telefono_cliente as string | null) ?? null,
    kilometraje_ultimo: (row.kilometraje_ultimo as number | null) ?? null,
    created_at: (row.created_at as string) ?? "",
    updated_at: (row.updated_at as string | null) ?? null,
    tienePin: Boolean(row.pin_hash),
    docsCount,
    docsFaltantes: countDocsFaltantes(docs),
    planillaFase,
    fechaLlegadaBuque: importacion.fechaLlegadaBuque?.trim() || null,
    fechaIngreso: importacion.fechaIngreso?.trim() || null,
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
    codigoExpediente: resolveCodigoExpediente({
      codigoExpediente: importacion.codigoExpediente,
      placa,
    }),
    fotoUrl: docs.foto_frontal?.url ?? docs.foto_placa?.url ?? null,
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
  created_at: string;
  codigoExpediente: string | null;
  fotoUrl: string | null;
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
      "id, placa, marca, modelo, color, serial_motor, serial_carroceria, kilometraje_ultimo, nombre_cliente, telefono_cliente, cedula_propietario, email_propietario, fecha_nacimiento_propietario, pin_hash, documentos, importacion, seguro, inspeccion_transportista, taller_id, created_at"
    )
    .eq("id", vehiculoId)
    .maybeSingle();

  if (error) {
    // Fallback si faltan columnas nuevas (seguro / inspeccion_transportista)
    const { data: fallback, error: fallbackError } = await admin
      .from("vehiculos")
      .select(
        "id, placa, marca, modelo, color, serial_motor, serial_carroceria, kilometraje_ultimo, nombre_cliente, telefono_cliente, cedula_propietario, email_propietario, fecha_nacimiento_propietario, pin_hash, documentos, importacion, taller_id, created_at"
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

    const docsFb = parseVehiculosDocumentos(fallback.documentos);
    const impFb = parseImportacion(fallback.importacion);

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
        created_at: fallback.created_at ?? "",
        codigoExpediente: resolveCodigoExpediente({
          codigoExpediente: impFb.codigoExpediente,
          placa: fallback.placa,
        }),
        fotoUrl: docsFb.foto_frontal?.url ?? docsFb.foto_placa?.url ?? null,
        tienePin: Boolean(fallback.pin_hash),
        tieneInspeccionTransportista: false,
        documentos: docsFb,
        importacion: impFb,
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

  const docs = parseVehiculosDocumentos(data.documentos);
  let importacion = parseImportacion(data.importacion);
  let codigoExpediente = resolveCodigoExpediente({
    codigoExpediente: importacion.codigoExpediente,
    placa: data.placa,
  });

  if (!codigoExpediente) {
    const row: Record<string, unknown> = {
      id: data.id,
      placa: data.placa,
      created_at: data.created_at,
      importacion: data.importacion,
    };
    await backfillCodigosExpediente(auth.taller.id, [row]);
    importacion = parseImportacion(row.importacion);
    codigoExpediente = resolveCodigoExpediente({
      codigoExpediente: importacion.codigoExpediente,
      placa: data.placa,
    });
  }

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
      created_at: data.created_at ?? "",
      codigoExpediente,
      fotoUrl: docs.foto_frontal?.url ?? docs.foto_placa?.url ?? null,
      tienePin: Boolean(data.pin_hash),
      tieneInspeccionTransportista: tieneActaTransportista(data.inspeccion_transportista),
      documentos: docs,
      importacion,
      seguro: parseSeguro(data.seguro),
      sticker: sticker
        ? { id: sticker.id, token: sticker.token, activo: sticker.activo }
        : null,
    },
  };
}
