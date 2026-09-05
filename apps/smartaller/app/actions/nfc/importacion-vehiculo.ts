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
  MEMORIA_FOTOGRAFICA_TIPOS_OBLIGATORIOS,
  PL_DESADUANAMIENTO_DOCUMENTO_TIPOS,
  embarqueDocumentosObligatorios,
  PL_FASE1_REGISTRO_DOCUMENTO_TIPOS,
  PL_LLEGADA_DOCUMENTO_TIPOS,
  constanciaInspeccionLista,
  faltantesMatriculacionCarpeta,
  PL_REGISTRO_DOCUMENTO_TIPOS,
  VIAS_NACIONALIZACION,
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
  type ViaNacionalizacion,
} from "@/lib/schemas/vehiculo-documentos";
import { resolverFechaLimiteNacionalizacion } from "@/lib/importacion/alerta-nacionalizacion";
import {
  clampArancelPct,
  clampImpuestoLujoPct,
  precalcularAranceles,
} from "@/lib/importacion/precalculo-aranceles";
import {
  aplicarTasaOficialAlPago,
  debeActualizarTasaOficial,
  marcarPagoAranceles,
  puedeCompletarPagoImpuesto,
  snapshotPagoAranceles,
} from "@/lib/importacion/pago-aranceles";
import { PLANILLA_FASE_COMPLETA } from "@/lib/importacion/planilla-etapas";
import { lookupTasaBcv, todayYmdCaracas } from "@/lib/importacion/tasa-bcv";
import { computeCompletitudDatos } from "@/lib/importacion/completitud-datos";
import { esRegistroPlanillaCompleto } from "@/lib/importacion/registro-planilla";
import {
  buildRevisionVehiculoPdf,
  revisionVehiculoPdfFileName,
} from "@/lib/importacion/expediente-pdf";
import {
  docsEntregaPlacaListos,
  esEntregaPlacaCompleta,
  validarPlacaVehicular,
} from "@/lib/importacion/entrega-placa-planilla";
import { mergeCedulaRifDesdeCliente } from "@/lib/importacion/docs-importador-expediente";
import { parseImportadorDocumentos } from "@/lib/importadores/upload-documento";
import {
  copyCedulaRifClienteOntoVehiculos,
  loadImportadorDocumentos,
} from "@/lib/importacion/expediente-lote-sync";
import { isLlegadaChecklistCompleto } from "@/lib/importacion/llegada-catalog";
import { uploadVehiculoDocumento, validateVehiculoDocumentoFile, VEHICULO_DOCS_BUCKET } from "@/lib/vehiculos/upload-documento";
import { nfcPinSchema } from "@/lib/validations/nfc";
import { puertoLibreAltaSchema } from "@/lib/schemas/importacion-alta";
import {
  compareExpedientesAsc,
  formatCodigoExpediente,
  parseCodigoExpediente,
  partsFromDate,
  placaPendienteDesdeCodigo,
  placaRealVisible,
  resolveCodigoExpediente,
} from "@/lib/importacion/expediente";
import {
  clasificarTipoImportadorPorRif,
  evaluarCupoPersonaNatural,
} from "@/lib/importacion/cumplimiento-importador";
import {
  docsFaltantesNacionalizacion,
  fechaLimitePermanencia3Anios,
} from "@/lib/importacion/nacionalizacion";
import { addYearsIso } from "@/lib/importacion/plazos";
import {
  docsDesaduanamientoPorRegimen,
  REGIMENES_IMPORTACION,
} from "@/lib/importacion/regimenes";
import { canForzarImprontaSinVerificar, canMutateImportacionData } from "@/lib/importacion/access";
import { resolvePortalAccess } from "@/lib/portal/roles";
import {
  findDuplicateSerialCarroceria,
  normalizarSerialCarroceria,
  SERIAL_CARROCERIA_DUPLICADO,
} from "@/lib/vehicles/serial";
import { deleteVehiculoConDependencias } from "@/lib/vehicles/delete-cascade";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  saveUltimoImportadorTaller,
  ultimoImportadorFromAlta,
} from "@/lib/taller-preferencias";
import { isLlmConfigured } from "@/lib/ai/openai-config";
import {
  isDocumentoLote,
  numeroBlFromScan,
} from "@/lib/importacion/expediente-lote";
import {
  inheritLoteOntoVehiculo,
  syncLoteDocumentoToSiblings,
  syncLoteImportacionToSiblings,
} from "@/lib/importacion/expediente-lote-sync";
import {
  extractBlMultiFromDocument,
  extractCertificadoOrigenMultiFromDocument,
  extractPolizaTransporteFromDocument,
  mergeScanFields,
  pickCertificadoScanForVin,
  polizaToFormFields,
  type PuertoLibreRegistroScanFields,
} from "@/lib/extract-puerto-libre-docs";
import { resolveImageMimeType } from "@/lib/mime-image";
import {
  resolveAduanaVenezuela,
} from "@/lib/importacion/aduanas-venezuela";
import { resolvePais } from "@/lib/importacion/paises";
import {
  formatPuertosDescarga,
  parsePuertosDescarga,
} from "@/lib/importacion/puertos-venezuela";

/** Parche de importación desde campos OCR de BL / póliza (solo claves presentes). */
function embarquePatchFromScanFields(
  fields: PuertoLibreRegistroScanFields,
  existing: ImportacionData,
  options?: { includeNumeroPoliza?: boolean }
): Partial<ImportacionData> {
  const patch: Partial<ImportacionData> = {};
  const numeroBl = numeroBlFromScan(existing.numeroBl, fields.numeroBl);
  if (numeroBl) patch.numeroBl = numeroBl;
  if (fields.fechaLlegadaBuque?.trim()) {
    patch.fechaLlegadaBuque = fields.fechaLlegadaBuque.trim();
  }
  if (fields.puerto?.trim()) {
    patch.puerto =
      formatPuertosDescarga(parsePuertosDescarga(fields.puerto)) ||
      fields.puerto.trim();
  }
  const aduana = resolveAduanaVenezuela(fields.aduana);
  if (aduana) patch.aduana = aduana;
  const pais = resolvePais(fields.paisOrigen);
  if (pais) patch.paisOrigen = pais;
  if (
    fields.modalidadTransito === "ninguno" ||
    fields.modalidadTransito === "transito" ||
    fields.modalidadTransito === "uso24"
  ) {
    patch.modalidadTransito = fields.modalidadTransito;
  }
  const aduanaTransito = resolveAduanaVenezuela(fields.aduanaTransito);
  if (
    aduanaTransito &&
    (patch.modalidadTransito === "transito" ||
      patch.modalidadTransito === "uso24" ||
      existing.modalidadTransito === "transito" ||
      existing.modalidadTransito === "uso24")
  ) {
    patch.aduanaTransito = aduanaTransito;
  }
  if (options?.includeNumeroPoliza && fields.numeroPolizaTransporte?.trim()) {
    patch.numeroPolizaTransporte = fields.numeroPolizaTransporte.trim();
  }
  if (fields.importadorNombre?.trim() && !existing.importadorNombre) {
    patch.importadorNombre = fields.importadorNombre.trim();
  }
  if (fields.importadorDocumento?.trim() && !existing.importadorDocumento) {
    patch.importadorDocumento = fields.importadorDocumento.trim();
  }
  return patch;
}

/** Parche desde OCR de certificado de origen (nº cert., país, etc.). */
function certificadoPatchFromScanFields(
  fields: PuertoLibreRegistroScanFields,
  existing: ImportacionData
): Partial<ImportacionData> {
  const patch: Partial<ImportacionData> = {};
  if (fields.numeroCertificadoOrigen?.trim()) {
    patch.numeroCertificadoOrigen = fields.numeroCertificadoOrigen.trim();
  }
  const pais = resolvePais(fields.paisOrigen);
  if (pais && !existing.paisOrigen?.trim()) patch.paisOrigen = pais;
  if (fields.numeroContenedor?.trim() && !existing.numeroContenedor?.trim()) {
    patch.numeroContenedor = fields.numeroContenedor.trim();
  }
  return patch;
}

async function ocrCertificadoOrigenBuffer(
  buffer: Buffer,
  mimeType: string,
  options?: { targetVin?: string | null }
): Promise<PuertoLibreRegistroScanFields> {
  const extracted = await extractCertificadoOrigenMultiFromDocument(
    buffer,
    mimeType
  );
  return pickCertificadoScanForVin(extracted, options?.targetVin);
}

export type PuertoLibreActionResult =
  | { success: true; loteCopiados?: number }
  | { success: false; error: string };

export type PuertoLibreUploadResult =
  | {
      success: true;
      tipo: DocumentoTipo;
      documentos: VehiculosDocumentos;
      loteCopiados?: number;
    }
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
  partidaArancelaria: z
    .string()
    .trim()
    .min(1, "Partida arancelaria requerida")
    .max(32, "Partida arancelaria demasiado larga"),
  checklistLlegada: z.record(z.string()).default({}),
  checklistLlegadaNotas: z.record(z.string()).default({}),
  otrosDispositivosNotas: z.string().trim().max(500).optional().nullable(),
  /** Solo si el OCR no pudo verificar pero el operador confirma revisión manual. */
  forzarImprontaSinVerificar: z.boolean().optional().default(false),
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
    .select(
      "id, taller_id, placa, marca, modelo, color, serial_motor, serial_carroceria, documentos, importacion, seguro"
    )
    .eq("id", vehiculoId)
    .maybeSingle();
  if (!data || data.taller_id !== tallerId) return null;
  return data;
}

function revalidateFicha(vehiculoId: string) {
  revalidatePath("/smartimport");
  revalidatePath("/smartimport/lote");
  revalidatePath(`/smartimport/${vehiculoId}`);
  revalidatePath(`/smartimport/${vehiculoId}/planilla`);
  revalidatePath(`/smartimport/${vehiculoId}/nacionalizar`);
  revalidatePath(`/smartimport/${vehiculoId}/propietario`);
  revalidatePath(`/smartimport/${vehiculoId}/inspeccion`);
  revalidatePath(`/smartimport/hoja-inspeccion`);
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
  if (!data.importadorId) {
    return {
      success: false,
      error: "Selecciona o crea el cliente importador antes de registrar la importación",
    };
  }

  const admin = createAdminClient();
  const { data: cliente, error: clienteError } = await admin
    .from("importadores")
    .select("id, tipo, nombre, documento, telefono, email, direccion, activo, documentos")
    .eq("id", data.importadorId)
    .eq("taller_id", auth.taller.id)
    .maybeSingle();

  if (clienteError) return { success: false, error: clienteError.message };
  if (!cliente || cliente.activo === false) {
    return { success: false, error: "Cliente importador no encontrado o inactivo" };
  }

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

  const snapNombre = data.importadorNombre?.trim() || String(cliente.nombre);
  const snapDocumento =
    data.importadorDocumento?.trim() || String(cliente.documento);
  const snapTelefono =
    data.importadorTelefono?.trim() ||
    (cliente.telefono as string | null) ||
    null;
  const snapEmail =
    data.importadorEmail?.trim() || (cliente.email as string | null) || null;
  const snapDireccion =
    data.importadorDireccion?.trim() ||
    (cliente.direccion as string | null) ||
    null;

  const cupo = await evaluarCupoPersonaNatural({
    admin,
    tallerId: auth.taller.id,
    importadorDocumento: snapDocumento,
    fechaReferenciaNueva: data.fechaLlegadaBuque || null,
    regimen: data.regimen,
  });
  if (!cupo.ok) {
    return { success: false, error: cupo.error };
  }

  const { year, month } = partsFromDate();
  const numero = await nextNumeroExpedienteMes(admin, auth.taller.id, year, month);
  const codigoExpediente = formatCodigoExpediente(year, month, numero);
  // Al registrar aún no hay placa; se carga después en Editar.
  const placa = placaPendienteDesdeCodigo(codigoExpediente);

  const importacion = serializeImportacion({
    importadorId: data.importadorId,
    regimen: data.regimen,
    anio: data.anio,
    condicionVehiculo: data.condicion,
    esSubasta: data.condicion === "usado" ? data.esSubasta : false,
    vin: data.vin || null,
    partidaArancelaria: data.partidaArancelaria || null,
    partidaArancelariaFuente: data.partidaArancelariaFuente,
    partidaArancelariaFundamento: data.partidaArancelariaFundamento || null,
    tarifaAdValoremPct: data.tarifaAdValoremPct,
    cilindradaCc: data.cilindradaCc,
    tipoCombustible: data.tipoCombustible,
    fechaLlegadaBuque: data.fechaLlegadaBuque,
    importadorNombre: snapNombre,
    importadorDocumento: snapDocumento,
    importadorTelefono: snapTelefono,
    importadorEmail: snapEmail,
    importadorDireccion: snapDireccion,
    aduana: data.aduana || null,
    puerto: data.puerto || null,
    modalidadTransito: data.modalidadTransito || null,
    aduanaTransito: data.aduanaTransito || null,
    numeroBl: data.numeroBl || null,
    numeroContenedor: data.numeroContenedor || null,
    paisOrigen: data.paisOrigen || null,
    valorCif: data.valorCif,
    tasaCambioBcv: data.tasaCambioBcv,
    numeroExpedienteSeniat: data.numeroExpedienteSeniat || null,
    numeroDav: data.numeroDav || null,
    numeroCertificadoOrigen: data.numeroCertificadoOrigen || null,
    numeroListaEmpaque: data.numeroListaEmpaque || null,
    numeroPolizaTransporte: data.numeroPolizaTransporte || null,
    observaciones: data.observaciones || null,
    estadoNacionalizacion:
      data.regimen === "puerto_libre" ? "pendiente" : "no_aplica",
    estadoSeniat: "pendiente",
    planillaFase: 1,
    codigoExpediente,
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
      kilometraje_ultimo: data.kilometraje,
      nombre_cliente: null,
      telefono_cliente: null,
      cedula_propietario: null,
      email_propietario: null,
      documentos: mergeCedulaRifDesdeCliente(
        {},
        parseImportadorDocumentos(cliente.documentos)
      ).next,
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

  revalidatePath("/smartimport");
  revalidatePath(`/smartimport/${created.id}/planilla`);

  const importadorGuardar = ultimoImportadorFromAlta({
    importadorNombre: snapNombre,
    importadorDocumento: snapDocumento,
    importadorTelefono: snapTelefono,
    importadorEmail: snapEmail,
    importadorDireccion: snapDireccion,
  });
  if (importadorGuardar) {
    await saveUltimoImportadorTaller(auth.taller.id, importadorGuardar);
  }

  await inheritLoteOntoVehiculo({
    admin,
    tallerId: auth.taller.id,
    targetVehiculoId: created.id,
  });

  return { success: true, vehiculoId: created.id, codigoExpediente };
}

/** Actualiza datos de fase 1 Registro (vehículo + importador + importación). */
export async function savePuertoLibreFase1RegistroAction(
  raw: unknown
): Promise<PuertoLibreActionResult> {
  const auth = await requireTallerAuth();
  if (auth.error || !auth.taller) {
    return { success: false, error: auth.error ?? "No autorizado" };
  }

  const idParsed = z
    .object({ vehiculoId: z.string().uuid() })
    .safeParse(raw);
  if (!idParsed.success) {
    return { success: false, error: "ID inválido" };
  }

  const parsed = puertoLibreAltaSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.errors[0]?.message ?? "Datos inválidos",
    };
  }

  const data = { ...parsed.data, vehiculoId: idParsed.data.vehiculoId };
  const row = await assertVehiculoTaller(data.vehiculoId, auth.taller.id);
  if (!row) return { success: false, error: "Vehículo no encontrado" };

  const admin = createAdminClient();
  const serialCarroceria = normalizarSerialCarroceria(data.serialCarroceria);
  const serialMotor = normalizarSerialCarroceria(data.serialMotor);

  const existingSerial = await findDuplicateSerialCarroceria(
    admin,
    auth.taller.id,
    serialCarroceria,
    data.vehiculoId
  );
  if (existingSerial) {
    return { success: false, error: SERIAL_CARROCERIA_DUPLICADO };
  }

  const cupo = await evaluarCupoPersonaNatural({
    admin,
    tallerId: auth.taller.id,
    importadorDocumento: data.importadorDocumento || null,
    excludeVehiculoId: data.vehiculoId,
    fechaReferenciaNueva: data.fechaLlegadaBuque || null,
    regimen: data.regimen,
  });
  if (!cupo.ok) {
    return { success: false, error: cupo.error };
  }

  const docs = parseVehiculosDocumentos(row.documentos);
  const faltantesRegistro = PL_FASE1_REGISTRO_DOCUMENTO_TIPOS.filter(
    (t) => !docs[t]?.url
  );
  if (faltantesRegistro.length > 0) {
    return {
      success: false,
      error:
        "Carga la factura de compra y el certificado de origen antes de continuar",
    };
  }

  const existing = parseImportacion(row.importacion);
  const faseActual = existing.planillaFase ?? 1;
  const estadoNac =
    data.regimen === "puerto_libre"
      ? existing.estadoNacionalizacion &&
        existing.estadoNacionalizacion !== "no_aplica"
        ? existing.estadoNacionalizacion
        : "pendiente"
      : existing.estadoNacionalizacion === "nacionalizado" ||
          existing.estadoNacionalizacion === "en_proceso"
        ? existing.estadoNacionalizacion
        : "no_aplica";
  const importacion = serializeImportacion({
    ...existing,
    importadorId: data.importadorId ?? existing.importadorId ?? null,
    regimen: data.regimen,
    anio: data.anio,
    condicionVehiculo: data.condicion,
    esSubasta: data.condicion === "usado" ? data.esSubasta : false,
    vin: data.vin || null,
    partidaArancelaria: data.partidaArancelaria || null,
    partidaArancelariaFuente:
      data.partidaArancelariaFuente ?? existing.partidaArancelariaFuente ?? null,
    partidaArancelariaFundamento:
      data.partidaArancelariaFundamento ||
      (data.partidaArancelariaFuente === "manual"
        ? null
        : existing.partidaArancelariaFundamento || null),
    tarifaAdValoremPct: data.tarifaAdValoremPct,
    cilindradaCc: data.cilindradaCc,
    tipoCombustible: data.tipoCombustible,
    fechaLlegadaBuque: data.fechaLlegadaBuque,
    importadorNombre: data.importadorNombre,
    importadorDocumento: data.importadorDocumento || null,
    importadorTelefono: data.importadorTelefono || null,
    importadorEmail: data.importadorEmail || null,
    importadorDireccion: data.importadorDireccion || null,
    aduana: data.aduana || null,
    puerto: data.puerto || null,
    modalidadTransito: data.modalidadTransito || null,
    aduanaTransito: data.aduanaTransito || null,
    numeroBl: data.numeroBl || null,
    numeroContenedor: data.numeroContenedor || null,
    paisOrigen: data.paisOrigen || null,
    valorCif: data.valorCif,
    tasaCambioBcv: data.tasaCambioBcv,
    numeroExpedienteSeniat: data.numeroExpedienteSeniat || null,
    numeroDav: data.numeroDav || null,
    numeroCertificadoOrigen: data.numeroCertificadoOrigen || null,
    numeroListaEmpaque: data.numeroListaEmpaque || null,
    numeroPolizaTransporte: data.numeroPolizaTransporte || null,
    observaciones: data.observaciones || null,
    estadoNacionalizacion: estadoNac,
    planillaFase: Math.max(faseActual, 2),
  });

  const { error } = await admin
    .from("vehiculos")
    .update({
      marca: data.marca,
      modelo: data.modelo,
      color: data.color,
      serial_motor: serialMotor,
      serial_carroceria: serialCarroceria,
      kilometraje_ultimo: data.kilometraje,
      importacion,
      updated_at: new Date().toISOString(),
    })
    .eq("id", data.vehiculoId)
    .eq("taller_id", auth.taller.id);

  if (error) {
    if (error.code === "23505" && error.message.includes("serial_carroceria")) {
      return { success: false, error: SERIAL_CARROCERIA_DUPLICADO };
    }
    return { success: false, error: error.message };
  }

  revalidateFicha(data.vehiculoId);

  const importadorGuardar = ultimoImportadorFromAlta(data);
  if (importadorGuardar) {
    await saveUltimoImportadorTaller(auth.taller.id, importadorGuardar);
  }

  if (parsed.data.numeroBl?.trim()) {
    await inheritLoteOntoVehiculo({
      admin,
      tallerId: auth.taller.id,
      targetVehiculoId: data.vehiculoId,
    });
  }

  return { success: true };
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
  const patch = Object.fromEntries(
    Object.entries(importacion).filter(([, value]) => value !== undefined)
  ) as ImportacionData;
  const mergedImport = { ...existing, ...patch };
  const completitud = computeCompletitudDatos({
    marca: (row.marca as string | null) ?? null,
    modelo: (row.modelo as string | null) ?? null,
    color: (row.color as string | null) ?? null,
    anio: mergedImport.anio,
    serialMotor: (row.serial_motor as string | null) ?? null,
    vin: mergedImport.vin ?? (row.serial_carroceria as string | null),
    serialCarroceria: (row.serial_carroceria as string | null) ?? null,
    numeroCertificadoOrigen: mergedImport.numeroCertificadoOrigen,
  });
  const merged = serializeImportacion({
    ...mergedImport,
    completitudDatos: completitud.nivel,
    datosPendientes: completitud.pendientes,
  });

  const admin = createAdminClient();
  const { error } = await admin
    .from("vehiculos")
    .update({ importacion: merged, updated_at: new Date().toISOString() })
    .eq("id", vehiculoId)
    .eq("taller_id", auth.taller.id);

  if (error) return { success: false, error: error.message };
  const loteCopiados = await syncLoteImportacionToSiblings({
    admin,
    tallerId: auth.taller.id,
    sourceVehiculoId: vehiculoId,
    lookup: existing,
    lote: mergedImport,
  });
  revalidateFicha(vehiculoId);

  const importadorGuardar = ultimoImportadorFromAlta({
    importadorNombre: importacion.importadorNombre ?? "",
    importadorDocumento: importacion.importadorDocumento,
    importadorTelefono: importacion.importadorTelefono,
    importadorEmail: importacion.importadorEmail,
    importadorDireccion: importacion.importadorDireccion,
  });
  if (importadorGuardar) {
    await saveUltimoImportadorTaller(auth.taller.id, importadorGuardar);
  }

  return { success: true, loteCopiados };
}

const fechaPlazoSchema = z.object({
  vehiculoId: z.string().uuid(),
  fechaLimiteNacionalizacion: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  fechaPresentacionSeniat: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

/** Agenda el reloj de nacionalización (equipaje) o la cita SENIAT. */
export async function savePuertoLibreFechasPlazoAction(
  raw: unknown
): Promise<PuertoLibreActionResult> {
  const auth = await requireTallerAuth();
  if (auth.error || !auth.taller) {
    return { success: false, error: auth.error ?? "No autorizado" };
  }

  const parsed = fechaPlazoSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.errors[0]?.message ?? "Fecha inválida",
    };
  }
  if (
    !parsed.data.fechaLimiteNacionalizacion &&
    !parsed.data.fechaPresentacionSeniat
  ) {
    return { success: false, error: "Indica una fecha" };
  }

  const row = await assertVehiculoTaller(parsed.data.vehiculoId, auth.taller.id);
  if (!row) return { success: false, error: "Vehículo no encontrado" };

  const existing = parseImportacion(row.importacion);
  const estadoSeniat =
    parsed.data.fechaPresentacionSeniat &&
    (existing.estadoSeniat ?? "pendiente") === "pendiente"
      ? "agendada"
      : existing.estadoSeniat;

  const importacion = serializeImportacion({
    ...existing,
    fechaLimiteNacionalizacion:
      parsed.data.fechaLimiteNacionalizacion ??
      existing.fechaLimiteNacionalizacion,
    fechaPresentacionSeniat:
      parsed.data.fechaPresentacionSeniat ?? existing.fechaPresentacionSeniat,
    estadoSeniat,
  });

  const admin = createAdminClient();
  const { error } = await admin
    .from("vehiculos")
    .update({ importacion, updated_at: new Date().toISOString() })
    .eq("id", parsed.data.vehiculoId)
    .eq("taller_id", auth.taller.id);

  if (error) return { success: false, error: error.message };
  revalidateFicha(parsed.data.vehiculoId);
  return { success: true };
}

/** Genera el PDF de la revisión y lo guarda en el expediente. */
export async function guardarRevisionVehiculoPdfAction(
  raw: unknown
): Promise<PuertoLibreUploadResult> {
  const auth = await requireTallerAuth();
  if (auth.error || !auth.taller) {
    return { success: false, error: auth.error ?? "No autorizado" };
  }

  const parsed = z.object({ vehiculoId: z.string().uuid() }).safeParse(raw);
  if (!parsed.success) {
    return { success: false, error: "Vehículo inválido" };
  }

  const fichaResult = await getPuertoLibreFicha(parsed.data.vehiculoId);
  if (!fichaResult.success) {
    return { success: false, error: fichaResult.error };
  }

  const ficha = fichaResult.ficha;
  if (!isLlegadaChecklistCompleto(ficha.importacion.checklistLlegada)) {
    return {
      success: false,
      error: "Completa el cuestionario de revisión antes de generar el PDF",
    };
  }

  try {
    const bytes = await buildRevisionVehiculoPdf(ficha);
    const fileName = revisionVehiculoPdfFileName(
      ficha.codigoExpediente,
      ficha.placa
    );
    const file = new File([new Uint8Array(bytes)], fileName, {
      type: "application/pdf",
    });
    const admin = createAdminClient();
    const documento = await uploadVehiculoDocumento(admin, {
      tallerId: auth.taller.id,
      vehiculoId: parsed.data.vehiculoId,
      tipo: "revision_vehiculo",
      file,
    });
    const next: VehiculosDocumentos = {
      ...ficha.documentos,
      revision_vehiculo: documento,
    };
    const { error } = await admin
      .from("vehiculos")
      .update({ documentos: next, updated_at: new Date().toISOString() })
      .eq("id", parsed.data.vehiculoId)
      .eq("taller_id", auth.taller.id);
    if (error) {
      return { success: false, error: error.message };
    }
    revalidateFicha(parsed.data.vehiculoId);
    return {
      success: true,
      tipo: "revision_vehiculo",
      documentos: next,
    };
  } catch (err) {
    return {
      success: false,
      error:
        err instanceof Error
          ? err.message
          : "No se pudo generar el PDF de revisión",
    };
  }
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

  const marca = parsed.data.marca?.trim() || null;
  const modelo = parsed.data.modelo?.trim() || null;
  const color = parsed.data.color?.trim() || null;
  const completitud = computeCompletitudDatos({
    marca,
    modelo,
    color,
    anio: importacion.anio,
    serialMotor,
    vin: importacion.vin ?? serialCarroceria,
    serialCarroceria,
    numeroCertificadoOrigen: importacion.numeroCertificadoOrigen,
  });
  const importacionPatch = serializeImportacion({
    ...importacion,
    vin: importacion.vin ?? serialCarroceria,
    completitudDatos: completitud.nivel,
    datosPendientes: completitud.pendientes,
  });

  const { error } = await admin
    .from("vehiculos")
    .update({
      placa,
      marca,
      modelo,
      color,
      serial_motor: serialMotor,
      serial_carroceria: serialCarroceria,
      kilometraje_ultimo: parsed.data.kilometrajeUltimo ?? null,
      importacion: importacionPatch,
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

/** Lee el certificado de origen ya cargado y devuelve/ persiste el nº de certificado. */
export async function syncCertificadoOrigenNumeroAction(vehiculoId: string): Promise<
  | { success: true; numeroCertificadoOrigen: string | null }
  | { success: false; error: string }
> {
  const auth = await requireTallerAuth();
  if (auth.error || !auth.taller) {
    return { success: false, error: auth.error ?? "No autorizado" };
  }

  const idParsed = z.string().uuid().safeParse(vehiculoId);
  if (!idParsed.success) {
    return { success: false, error: "ID inválido" };
  }

  const row = await assertVehiculoTaller(idParsed.data, auth.taller.id);
  if (!row) return { success: false, error: "Vehículo no encontrado" };

  const existingImp = parseImportacion(row.importacion);
  if (existingImp.numeroCertificadoOrigen?.trim()) {
    return {
      success: true,
      numeroCertificadoOrigen: existingImp.numeroCertificadoOrigen.trim(),
    };
  }

  const docs = parseVehiculosDocumentos(row.documentos);
  const certRef = docs.certificado_origen;
  if (!certRef?.path) {
    return { success: true, numeroCertificadoOrigen: null };
  }

  if (!isLlmConfigured()) {
    return { success: true, numeroCertificadoOrigen: null };
  }

  try {
    const admin = createAdminClient();
    const { data, error } = await admin.storage
      .from(VEHICULO_DOCS_BUCKET)
      .download(certRef.path);
    if (error || !data) {
      return { success: true, numeroCertificadoOrigen: null };
    }
    const buffer = Buffer.from(await data.arrayBuffer());
    const mimeType =
      data.type === "application/pdf" || /\.pdf$/i.test(certRef.path)
        ? "application/pdf"
        : resolveImageMimeType({
            declaredMime: data.type,
            fileName: certRef.path,
            buffer,
          }) ?? "image/jpeg";
    const fields = await ocrCertificadoOrigenBuffer(buffer, mimeType, {
      targetVin:
        (row.serial_carroceria as string | null) ?? existingImp.vin ?? null,
    });
    const patch = certificadoPatchFromScanFields(fields, existingImp);
    const numero = patch.numeroCertificadoOrigen?.trim() ?? null;
    if (numero) {
      const merged = serializeImportacion({ ...existingImp, ...patch });
      await admin
        .from("vehiculos")
        .update({ importacion: merged, updated_at: new Date().toISOString() })
        .eq("id", idParsed.data)
        .eq("taller_id", auth.taller.id);
      revalidateFicha(idParsed.data);
    }
    return { success: true, numeroCertificadoOrigen: numero };
  } catch {
    return { success: true, numeroCertificadoOrigen: null };
  }
}

export type BlEmbarqueSyncResult =
  | {
      success: true;
      numeroBl: string | null;
      fechaLlegadaBuque: string | null;
      puerto: string | null;
      aduana: string | null;
      paisOrigen: string | null;
      modalidadTransito: "ninguno" | "transito" | "uso24" | null;
      aduanaTransito: string | null;
    }
  | { success: false; error: string };

/**
 * Lee el BL ya cargado, extrae nº BL (+ datos de embarque) y persiste en importación.
 */
export async function syncPuertoLibreBlEmbarqueAction(
  vehiculoId: string
): Promise<BlEmbarqueSyncResult> {
  const auth = await requireTallerAuth();
  if (auth.error || !auth.taller) {
    return { success: false, error: auth.error ?? "No autorizado" };
  }

  const idParsed = z.string().uuid().safeParse(vehiculoId);
  if (!idParsed.success) {
    return { success: false, error: "ID inválido" };
  }

  const row = await assertVehiculoTaller(idParsed.data, auth.taller.id);
  if (!row) return { success: false, error: "Vehículo no encontrado" };

  const existingImp = parseImportacion(row.importacion);
  const docs = parseVehiculosDocumentos(row.documentos);
  const blRef = docs.bl_guia;
  if (!blRef?.path) {
    return {
      success: true,
      numeroBl: existingImp.numeroBl?.trim() || null,
      fechaLlegadaBuque: existingImp.fechaLlegadaBuque?.trim() || null,
      puerto: existingImp.puerto?.trim() || null,
      aduana: existingImp.aduana?.trim() || null,
      paisOrigen: existingImp.paisOrigen?.trim() || null,
      modalidadTransito: existingImp.modalidadTransito ?? null,
      aduanaTransito: existingImp.aduanaTransito?.trim() || null,
    };
  }

  if (!isLlmConfigured()) {
    return {
      success: true,
      numeroBl: existingImp.numeroBl?.trim() || null,
      fechaLlegadaBuque: existingImp.fechaLlegadaBuque?.trim() || null,
      puerto: existingImp.puerto?.trim() || null,
      aduana: existingImp.aduana?.trim() || null,
      paisOrigen: existingImp.paisOrigen?.trim() || null,
      modalidadTransito: existingImp.modalidadTransito ?? null,
      aduanaTransito: existingImp.aduanaTransito?.trim() || null,
    };
  }

  try {
    const admin = createAdminClient();
    const { data, error } = await admin.storage
      .from(VEHICULO_DOCS_BUCKET)
      .download(blRef.path);
    if (error || !data) {
      return {
        success: true,
        numeroBl: existingImp.numeroBl?.trim() || null,
        fechaLlegadaBuque: existingImp.fechaLlegadaBuque?.trim() || null,
        puerto: existingImp.puerto?.trim() || null,
        aduana: existingImp.aduana?.trim() || null,
        paisOrigen: existingImp.paisOrigen?.trim() || null,
        modalidadTransito: existingImp.modalidadTransito ?? null,
        aduanaTransito: existingImp.aduanaTransito?.trim() || null,
      };
    }
    const buffer = Buffer.from(await data.arrayBuffer());
    const mimeType =
      data.type === "application/pdf" || /\.pdf$/i.test(blRef.path)
        ? "application/pdf"
        : resolveImageMimeType({
            declaredMime: data.type,
            fileName: blRef.path,
            buffer,
          }) ?? "image/jpeg";

    const fields = (await extractBlMultiFromDocument(buffer, mimeType)).shared;
    const patch = embarquePatchFromScanFields(fields, existingImp);
    const mergedImp =
      Object.keys(patch).length > 0
        ? { ...existingImp, ...patch }
        : existingImp;

    if (Object.keys(patch).length > 0) {
      await admin
        .from("vehiculos")
        .update({
          importacion: serializeImportacion(mergedImp),
          updated_at: new Date().toISOString(),
        })
        .eq("id", idParsed.data)
        .eq("taller_id", auth.taller.id);
      revalidateFicha(idParsed.data);
    }

    return {
      success: true,
      numeroBl: mergedImp.numeroBl?.trim() || null,
      fechaLlegadaBuque: mergedImp.fechaLlegadaBuque?.trim() || null,
      puerto: mergedImp.puerto?.trim() || null,
      aduana: mergedImp.aduana?.trim() || null,
      paisOrigen: mergedImp.paisOrigen?.trim() || null,
      modalidadTransito: mergedImp.modalidadTransito ?? null,
      aduanaTransito: mergedImp.aduanaTransito?.trim() || null,
    };
  } catch {
    return {
      success: true,
      numeroBl: existingImp.numeroBl?.trim() || null,
      fechaLlegadaBuque: existingImp.fechaLlegadaBuque?.trim() || null,
      puerto: existingImp.puerto?.trim() || null,
      aduana: existingImp.aduana?.trim() || null,
      paisOrigen: existingImp.paisOrigen?.trim() || null,
      modalidadTransito: existingImp.modalidadTransito ?? null,
      aduanaTransito: existingImp.aduanaTransito?.trim() || null,
    };
  }
}

/**
 * Marca fase 2 (docs de embarque) completa y avanza a fase 3 (llegada).
 * Alias histórico: completePuertoLibreFase1aEmbarqueAction.
 */
const fase2EmbarqueSchema = z.object({
  vehiculoId: z.string().uuid(),
  fechaLlegadaBuque: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha de llegada del buque inválida"),
  puerto: z.string().trim().min(1, "Indica el puerto").max(120),
  modalidadTransito: z.enum(["ninguno", "transito", "uso24"]).default("ninguno"),
  aduanaTransito: z.string().trim().max(120).optional().nullable(),
  aduana: z.string().trim().min(1, "Selecciona la aduana").max(120),
  numeroBl: z.string().trim().min(1, "Indica el nº de BL / guía").max(80),
  paisOrigen: z.string().trim().min(1, "Selecciona el país de origen").max(80),
  regimen: z.enum(REGIMENES_IMPORTACION).default("puerto_libre"),
  numeroCertificadoOrigen: z.string().trim().max(80).optional().nullable(),
  observaciones: z.string().trim().max(1000).optional().nullable(),
});

/** Guarda datos de embarque (manual + OCR del BL) y avanza a llegada. */
export async function completePuertoLibreFase2EmbarqueAction(
  raw: unknown
): Promise<PuertoLibreActionResult> {
  const auth = await requireTallerAuth();
  if (auth.error || !auth.taller) {
    return { success: false, error: auth.error ?? "No autorizado" };
  }

  // Compat: llamadas antiguas solo con vehiculoId (string)
  const normalized =
    typeof raw === "string" ? { vehiculoId: raw } : raw;
  const parsed = fase2EmbarqueSchema.safeParse(normalized);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.errors[0]?.message ?? "Datos de embarque inválidos",
    };
  }

  const row = await assertVehiculoTaller(parsed.data.vehiculoId, auth.taller.id);
  if (!row) return { success: false, error: "Vehículo no encontrado" };

  const existing = parseImportacion(row.importacion);
  const admin = createAdminClient();
  const clienteDocs = await loadImportadorDocumentos({
    admin,
    tallerId: auth.taller.id,
    importadorId: existing.importadorId,
  });
  const docs = mergeCedulaRifDesdeCliente(
    parseVehiculosDocumentos(row.documentos),
    clienteDocs
  ).next;
  const esJuridica =
    clasificarTipoImportadorPorRif(existing.importadorDocumento) ===
    "juridica";
  const faltantes = embarqueDocumentosObligatorios(esJuridica).filter(
    (t) => !docs[t]?.url
  );
  if (faltantes.length > 0) {
    return {
      success: false,
      error:
        "Carga BL/Guía, lista de empaque y los documentos del importador (RIF, cédula o pasaporte, domicilio e inscripción tributaria). La póliza es opcional.",
    };
  }

  const modalidad = parsed.data.modalidadTransito;
  if (
    (modalidad === "transito" || modalidad === "uso24") &&
    !parsed.data.aduanaTransito?.trim()
  ) {
    return {
      success: false,
      error: "Indica la aduana de tránsito / USO24",
    };
  }
  const regimen = parsed.data.regimen;
  const prevEstado = existing.estadoNacionalizacion ?? "pendiente";
  const importacion = serializeImportacion({
    ...existing,
    fechaLlegadaBuque: parsed.data.fechaLlegadaBuque,
    puerto: parsed.data.puerto.trim(),
    modalidadTransito: modalidad,
    aduanaTransito:
      modalidad === "transito" || modalidad === "uso24"
        ? parsed.data.aduanaTransito?.trim() || null
        : null,
    aduana: resolveAduanaVenezuela(parsed.data.aduana) || parsed.data.aduana,
    numeroBl: parsed.data.numeroBl.trim(),
    paisOrigen: resolvePais(parsed.data.paisOrigen) || parsed.data.paisOrigen,
    regimen,
    // El nº de certificado se captura en Registro; no se edita en embarque.
    numeroCertificadoOrigen:
      parsed.data.numeroCertificadoOrigen?.trim() ||
      existing.numeroCertificadoOrigen ||
      null,
    observaciones: parsed.data.observaciones?.trim() || null,
    estadoNacionalizacion:
      regimen === "puerto_libre"
        ? prevEstado === "no_aplica"
          ? "pendiente"
          : prevEstado
        : "no_aplica",
    planillaFase: Math.max(existing.planillaFase ?? 2, 3),
  });

  const { error } = await admin
    .from("vehiculos")
    .update({
      importacion,
      documentos: docs,
      updated_at: new Date().toISOString(),
    })
    .eq("id", parsed.data.vehiculoId)
    .eq("taller_id", auth.taller.id);

  if (error) return { success: false, error: error.message };
  const mergedImp = parseImportacion(importacion);
  const loteCopiados = await syncLoteImportacionToSiblings({
    admin,
    tallerId: auth.taller.id,
    sourceVehiculoId: parsed.data.vehiculoId,
    lookup: existing,
    lote: mergedImp,
  });
  revalidateFicha(parsed.data.vehiculoId);
  return { success: true, loteCopiados };
}

/** @deprecated Usar completePuertoLibreFase2EmbarqueAction. */
export const completePuertoLibreFase1aEmbarqueAction =
  completePuertoLibreFase2EmbarqueAction;

/** Guarda fase 3 (llegada) y avanza a fase 4 (aduana / retiro). */
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

  if (parsed.data.forzarImprontaSinVerificar) {
    const access = await resolvePortalAccess();
    if (!access || !canForzarImprontaSinVerificar(access)) {
      return {
        success: false,
        error:
          "No tienes permiso para forzar el avance sin verificación de impronta. Solo operadores (admin/taller) pueden confirmar revisión manual.",
      };
    }
  }

  const existingImportacion = parseImportacion(row.importacion);
  const existingSeguro = parseSeguro(row.seguro);
  const checklist = parsed.data.checklistLlegada;
  const checklistNotas = parsed.data.checklistLlegadaNotas;

  const importacion = serializeImportacion({
    ...existingImportacion,
    fechaIngreso: parsed.data.fechaIngreso,
    partidaArancelaria: parsed.data.partidaArancelaria.trim(),
    fechaLiquidacion:
      existingImportacion.fechaLiquidacion?.trim() || parsed.data.fechaIngreso,
    fechaLimiteNacionalizacion:
      existingImportacion.fechaLimiteNacionalizacion?.trim() ||
      fechaLimitePermanencia3Anios(parsed.data.fechaIngreso),
    fechaPresentacionSeniat:
      existingImportacion.fechaPresentacionSeniat?.trim() ||
      addYearsIso(parsed.data.fechaIngreso, 1),
    checklistLlegada: Object.keys(checklist).length
      ? checklist
      : existingImportacion.checklistLlegada,
    checklistLlegadaNotas: Object.keys(checklistNotas).length
      ? checklistNotas
      : existingImportacion.checklistLlegadaNotas,
    otrosDispositivosNotas:
      parsed.data.otrosDispositivosNotas ??
      existingImportacion.otrosDispositivosNotas,
    planillaFase: 4,
  });

  const seguro = serializeSeguro({
    ...existingSeguro,
    tieneAlarma:
      checklist.alarma === "sin_dano"
        ? true
        : checklist.alarma === "falla"
          ? false
          : existingSeguro.tieneAlarma,
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
      parsed.data.otrosDispositivosNotas?.trim() ||
      existingSeguro.dispositivosSeguridad,
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

const precalculoArancelesSaveSchema = z.object({
  vehiculoId: z.string().uuid(),
  valorCif: z.number().positive("Indica el valor CIF en USD").max(50_000_000),
  arancelPct: z.number().min(20, "Arancel mínimo 20%").max(40, "Arancel máximo 40%"),
  impuestoLujoPct: z
    .number()
    .min(10, "Lujo mínimo 10%")
    .max(15, "Lujo máximo 15%"),
});

/**
 * Guarda CIF y % del precálculo de aranceles (fase desaduanamiento).
 * vehiculos.importacion es JSONB; se escribe con admin tras assertVehiculoTaller.
 */
export async function savePrecalculoArancelesAction(
  raw: unknown
): Promise<PuertoLibreActionResult> {
  const auth = await requireTallerAuth();
  if (auth.error || !auth.taller) {
    return { success: false, error: auth.error ?? "No autorizado" };
  }

  const parsed = precalculoArancelesSaveSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.errors[0]?.message ?? "Datos inválidos",
    };
  }

  const row = await assertVehiculoTaller(parsed.data.vehiculoId, auth.taller.id);
  if (!row) return { success: false, error: "Vehículo no encontrado" };

  const existing = parseImportacion(row.importacion);
  const arancelPct = clampArancelPct(parsed.data.arancelPct);
  const impuestoLujoPct = clampImpuestoLujoPct(parsed.data.impuestoLujoPct);
  const calc = precalcularAranceles({
    valorCif: parsed.data.valorCif,
    arancelPct,
    impuestoLujoPct,
    tasaBs: existing.tasaCambioBcv,
  });
  if (!calc) {
    return { success: false, error: "Indica el valor CIF del vehículo" };
  }

  const importacion = serializeImportacion({
    ...existing,
    valorCif: calc.valorCif,
    arancelPct: calc.arancelPct,
    impuestoLujoPct: calc.impuestoLujoPct,
    tarifaAdValoremPct: calc.arancelPct,
    costosArancelariosUsd: calc.arancelUsd,
    costoTotalLandedUsd: calc.totalUsd,
    pagoArancelesUsd:
      existing.pagoArancelesEstado === "pagado"
        ? existing.pagoArancelesUsd
        : calc.totalUsd,
    pagoArancelesBs:
      existing.pagoArancelesEstado === "pagado"
        ? existing.pagoArancelesBs
        : calc.totalBs,
  });

  const admin = createAdminClient();
  const { error } = await admin
    .from("vehiculos")
    .update({ importacion, updated_at: new Date().toISOString() })
    .eq("id", parsed.data.vehiculoId)
    .eq("taller_id", auth.taller.id);

  if (error) return { success: false, error: error.message };
  revalidateFicha(parsed.data.vehiculoId);
  return { success: true };
}

export type PagoArancelesActionResult =
  | {
      success: true;
      totalUsd: number | null;
      totalBs: number | null;
      tasa: number | null;
      fecha: string | null;
      estado: "pendiente" | "pagado";
      hint?: string;
    }
  | { success: false; error: string };

/**
 * Reconvierte el precálculo a Bs con la tasa oficial del día (Caracas).
 * No pisa un pago ya registrado.
 */
export async function ensureTasaOficialHoyAction(
  raw: unknown
): Promise<PagoArancelesActionResult> {
  const auth = await requireTallerAuth();
  if (auth.error || !auth.taller) {
    return { success: false, error: auth.error ?? "No autorizado" };
  }

  const parsed = z.object({ vehiculoId: z.string().uuid() }).safeParse(raw);
  if (!parsed.success) {
    return { success: false, error: "Vehículo inválido" };
  }

  const row = await assertVehiculoTaller(parsed.data.vehiculoId, auth.taller.id);
  if (!row) return { success: false, error: "Vehículo no encontrado" };

  const existing = parseImportacion(row.importacion);
  const hoy = todayYmdCaracas();
  const lookup = await lookupTasaBcv(hoy);
  if (!lookup) {
    return { success: false, error: "No se pudo leer la tasa oficial SENIAT/BCV" };
  }

  let next = existing;
  if (debeActualizarTasaOficial(existing, hoy)) {
    next = aplicarTasaOficialAlPago(existing, lookup);
    const admin = createAdminClient();
    const { error } = await admin
      .from("vehiculos")
      .update({
        importacion: serializeImportacion(next),
        updated_at: new Date().toISOString(),
      })
      .eq("id", parsed.data.vehiculoId)
      .eq("taller_id", auth.taller.id);
    if (error) return { success: false, error: error.message };
    revalidateFicha(parsed.data.vehiculoId);
  }

  const snap = snapshotPagoAranceles(next);
  return {
    success: true,
    totalUsd: snap.totalUsd,
    totalBs: snap.totalBs,
    tasa: snap.tasaBs ?? lookup.tasa,
    fecha: snap.tasaFecha ?? lookup.fechaVigente,
    estado: snap.estado,
  };
}

const registrarPagoSchema = z.object({
  vehiculoId: z.string().uuid(),
});

/** Marca el pago de aranceles en Bs y congela tasa y monto. */
export async function registrarPagoArancelesAction(
  raw: unknown
): Promise<PagoArancelesActionResult> {
  const auth = await requireTallerAuth();
  if (auth.error || !auth.taller) {
    return { success: false, error: auth.error ?? "No autorizado" };
  }

  const parsed = registrarPagoSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, error: "Vehículo inválido" };
  }

  const row = await assertVehiculoTaller(parsed.data.vehiculoId, auth.taller.id);
  if (!row) return { success: false, error: "Vehículo no encontrado" };

  const existing = parseImportacion(row.importacion);
  const hoy = todayYmdCaracas();
  const lookup = await lookupTasaBcv(hoy);
  const conTasa =
    existing.pagoArancelesEstado === "pagado" || !lookup
      ? existing
      : aplicarTasaOficialAlPago(existing, lookup);
  const snapPre = snapshotPagoAranceles(conTasa);
  if (snapPre.totalUsd == null) {
    return { success: false, error: "Guarda el precálculo (CIF) antes de pagar" };
  }

  const next = marcarPagoAranceles(conTasa, new Date().toISOString());
  const admin = createAdminClient();
  const { error } = await admin
    .from("vehiculos")
    .update({
      importacion: serializeImportacion(next),
      updated_at: new Date().toISOString(),
    })
    .eq("id", parsed.data.vehiculoId)
    .eq("taller_id", auth.taller.id);
  if (error) return { success: false, error: error.message };
  revalidateFicha(parsed.data.vehiculoId);

  const snap = snapshotPagoAranceles(next);
  return {
    success: true,
    totalUsd: snap.totalUsd,
    totalBs: snap.totalBs,
    tasa: snap.tasaBs,
    fecha: snap.tasaFecha,
    estado: snap.estado,
  };
}

const desaduanamientoCompleteSchema = z.object({
  vehiculoId: z.string().uuid(),
  agenteAduanal: z
    .string()
    .trim()
    .min(2, "Indica el Agente de Aduanas autorizado")
    .max(120),
  checklistLlegada: z.record(z.string()).optional(),
  checklistLlegadaNotas: z.record(z.string()).optional(),
  otrosDispositivosNotas: z.string().max(2000).optional().nullable(),
});

/**
 * Marca fase 4 (desaduanamiento SENIAT) completa → fase 5 pago impuesto.
 * Exige carpeta documental + Agente de Aduanas. Precálculo, voucher e
 * inspección van en las fases siguientes.
 */
export async function completePuertoLibreFase3Action(
  raw: unknown
): Promise<PuertoLibreActionResult> {
  const auth = await requireTallerAuth();
  if (auth.error || !auth.taller) {
    return { success: false, error: auth.error ?? "No autorizado" };
  }

  const parsed = desaduanamientoCompleteSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.errors[0]?.message ?? "Datos inválidos",
    };
  }

  const row = await assertVehiculoTaller(parsed.data.vehiculoId, auth.taller.id);
  if (!row) return { success: false, error: "Vehículo no encontrado" };

  const existing = parseImportacion(row.importacion);
  const docs = parseVehiculosDocumentos(row.documentos);
  const esJuridica =
    clasificarTipoImportadorPorRif(existing.importadorDocumento) === "juridica";
  const carpeta = docsDesaduanamientoPorRegimen(
    existing.regimen,
    PL_DESADUANAMIENTO_DOCUMENTO_TIPOS,
    { esJuridica }
  );
  const faltantes = carpeta.filter((t) => !docs[t]?.url);
  if (faltantes.length > 0) {
    return {
      success: false,
      error:
        "Completa el expediente a presentar: factura, certificado, BL, lista, póliza, cédula/RIF y DUA (la prepara el agente). También DAV y recaudos del régimen",
    };
  }

  const importacion = serializeImportacion({
    ...existing,
    agenteAduanal: parsed.data.agenteAduanal,
    planillaFase: 5,
  });

  const admin = createAdminClient();
  const { error } = await admin
    .from("vehiculos")
    .update({ importacion, updated_at: new Date().toISOString() })
    .eq("id", parsed.data.vehiculoId)
    .eq("taller_id", auth.taller.id);

  if (error) return { success: false, error: error.message };
  revalidateFicha(parsed.data.vehiculoId);
  return { success: true };
}

const pagoImpuestoCompleteSchema = z.object({
  vehiculoId: z.string().uuid(),
});

/** Marca fase 5 (pago impuesto) completa → fase 6 inspección. */
export async function completePuertoLibrePagoImpuestoAction(
  raw: unknown
): Promise<PuertoLibreActionResult> {
  const auth = await requireTallerAuth();
  if (auth.error || !auth.taller) {
    return { success: false, error: auth.error ?? "No autorizado" };
  }

  const parsed = pagoImpuestoCompleteSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, error: "Vehículo inválido" };
  }

  const row = await assertVehiculoTaller(parsed.data.vehiculoId, auth.taller.id);
  if (!row) return { success: false, error: "Vehículo no encontrado" };

  const existing = parseImportacion(row.importacion);
  const docs = parseVehiculosDocumentos(row.documentos);
  const tieneVoucher = Boolean(docs.planilla_liquidacion_aduanera?.url);
  if (!puedeCompletarPagoImpuesto(existing, tieneVoucher)) {
    return {
      success: false,
      error:
        "Guarda el precálculo (CIF) y registra el pago o carga el voucher / liquidación de tributos.",
    };
  }
  if (!docs.pase_salida_levante?.url) {
    return {
      success: false,
      error:
        "Carga el pase de salida (después de la liquidación de tributos) para continuar a Inspección.",
    };
  }

  const importacion = serializeImportacion({
    ...existing,
    planillaFase: 6,
  });

  const admin = createAdminClient();
  const { error } = await admin
    .from("vehiculos")
    .update({ importacion, updated_at: new Date().toISOString() })
    .eq("id", parsed.data.vehiculoId)
    .eq("taller_id", auth.taller.id);

  if (error) return { success: false, error: error.message };
  revalidateFicha(parsed.data.vehiculoId);
  return { success: true };
}

const inspeccionCompleteSchema = z.object({
  vehiculoId: z.string().uuid(),
  checklistLlegada: z.record(z.string()).optional(),
  checklistLlegadaNotas: z.record(z.string()).optional(),
  otrosDispositivosNotas: z.string().max(2000).optional().nullable(),
  forzarImprontaSinVerificar: z.boolean().optional().default(false),
});

/**
 * Marca fase 6 (inspección) completa → fase 7 propietario.
 * Exige documentos de llegada, memoria fotográfica, cuestionario y constancia.
 */
export async function completePuertoLibreInspeccionAction(
  raw: unknown
): Promise<PuertoLibreActionResult> {
  const auth = await requireTallerAuth();
  if (auth.error || !auth.taller) {
    return { success: false, error: auth.error ?? "No autorizado" };
  }

  const parsed = inspeccionCompleteSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.errors[0]?.message ?? "Datos inválidos",
    };
  }

  const row = await assertVehiculoTaller(parsed.data.vehiculoId, auth.taller.id);
  if (!row) return { success: false, error: "Vehículo no encontrado" };

  if (parsed.data.forzarImprontaSinVerificar) {
    const access = await resolvePortalAccess();
    if (!access || !canForzarImprontaSinVerificar(access)) {
      return {
        success: false,
        error:
          "No tienes permiso para forzar el avance sin verificación de impronta. Solo operadores (admin/taller) pueden confirmar revisión manual.",
      };
    }
  }

  const existing = parseImportacion(row.importacion);
  const docs = parseVehiculosDocumentos(row.documentos);

  const faltantesLlegada = PL_LLEGADA_DOCUMENTO_TIPOS.filter((t) => !docs[t]?.url);
  if (faltantesLlegada.length > 0) {
    return {
      success: false,
      error:
        "Carga el Acta de recepción (AR) y el reconocimiento / constancia del estado de la carga.",
    };
  }

  if (!constanciaInspeccionLista(docs)) {
    return {
      success: false,
      error: "Carga la constancia de inspección del puerto (PDF).",
    };
  }

  const checklist =
    parsed.data.checklistLlegada ?? existing.checklistLlegada ?? {};
  if (!isLlegadaChecklistCompleto(checklist)) {
    return {
      success: false,
      error:
        "Completa el cuestionario de revisión del vehículo (todos los ítems).",
    };
  }

  const faltantesMemoria = MEMORIA_FOTOGRAFICA_TIPOS_OBLIGATORIOS.filter(
    (t) => !docs[t]?.url
  );
  if (faltantesMemoria.length > 0) {
    return {
      success: false,
      error: "Completa la inspección fotográfica (memoria descriptiva).",
    };
  }

  const estadoImpronta = existing.serialImprontaEstado;
  if (docs.foto_impronta?.url) {
    if (estadoImpronta === "no_coincide") {
      return {
        success: false,
        error:
          "El serial de la impronta no coincide con el del expediente. Corrige el serial en Registro o vuelve a tomar la foto.",
      };
    }
    if (estadoImpronta !== "coincide" && !parsed.data.forzarImprontaSinVerificar) {
      return {
        success: false,
        error:
          "Debes verificar que el serial de la impronta coincida con el del expediente (o omite la foto de impronta).",
      };
    }
  }

  const existingSeguro = parseSeguro(row.seguro);
  const importacion = serializeImportacion({
    ...existing,
    checklistLlegada: checklist,
    checklistLlegadaNotas:
      parsed.data.checklistLlegadaNotas ?? existing.checklistLlegadaNotas,
    otrosDispositivosNotas:
      parsed.data.otrosDispositivosNotas ?? existing.otrosDispositivosNotas,
    planillaFase: 7,
  });

  const seguro = serializeSeguro({
    ...existingSeguro,
    tieneAlarma:
      checklist.alarma === "sin_dano"
        ? true
        : checklist.alarma === "falla"
          ? false
          : existingSeguro.tieneAlarma,
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
      parsed.data.otrosDispositivosNotas?.trim() ||
      existingSeguro.dispositivosSeguridad,
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

/** Guarda propietario (fase 7) y avanza a fase 8 (seguro). */
export async function completePuertoLibreFase4PropietarioAction(
  raw: unknown
): Promise<PuertoLibreActionResult> {
  const auth = await requireTallerAuth();
  if (auth.error || !auth.taller) {
    return { success: false, error: auth.error ?? "No autorizado" };
  }

  const schema = propietarioSchema.extend({
    nombreCliente: z.string().trim().min(1, "Nombre del propietario requerido").max(120),
  });
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message ?? "Datos inválidos" };
  }

  const row = await assertVehiculoTaller(parsed.data.vehiculoId, auth.taller.id);
  if (!row) return { success: false, error: "Vehículo no encontrado" };

  const existingImportacion = parseImportacion(row.importacion);
  const importacion = serializeImportacion({
    ...existingImportacion,
    compradorDireccion: parsed.data.direccion ?? existingImportacion.compradorDireccion,
    planillaFase: 8,
  });

  const admin = createAdminClient();
  const { error } = await admin
    .from("vehiculos")
    .update({
      nombre_cliente: parsed.data.nombreCliente.trim(),
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

/** Guarda seguro (fase 8) y avanza a fase 9 (matriculación). */
export async function completePuertoLibreFase5SeguroAction(
  raw: unknown
): Promise<PuertoLibreActionResult> {
  const auth = await requireTallerAuth();
  if (auth.error || !auth.taller) {
    return { success: false, error: auth.error ?? "No autorizado" };
  }

  const schema = seguroSchema.extend({
    vehiculoId: z.string().uuid(),
    aseguradora: z.string().trim().min(1, "Aseguradora requerida").max(120),
  });
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message ?? "Datos inválidos" };
  }

  const row = await assertVehiculoTaller(parsed.data.vehiculoId, auth.taller.id);
  if (!row) return { success: false, error: "Vehículo no encontrado" };

  const { vehiculoId, ...seguro } = parsed.data;
  const existingSeguro = parseSeguro(row.seguro);
  const mergedSeguro = serializeSeguro({ ...existingSeguro, ...seguro });
  const existingImportacion = parseImportacion(row.importacion);
  const importacion = serializeImportacion({
    ...existingImportacion,
    planillaFase: 9,
  });

  const admin = createAdminClient();
  const { error } = await admin
    .from("vehiculos")
    .update({
      seguro: mergedSeguro,
      importacion,
      updated_at: new Date().toISOString(),
    })
    .eq("id", vehiculoId)
    .eq("taller_id", auth.taller.id);

  if (error) return { success: false, error: error.message };
  revalidateFicha(vehiculoId);
  return { success: true };
}

/**
 * Completa Matriculación (fase 9 → 10) con el archivo INTT
 * (9 recaudos en orden; homologación solo si aplica).
 */
export async function savePuertoLibreCarpetaMatriculacionAction(
  raw: unknown
): Promise<PuertoLibreActionResult> {
  const auth = await requireTallerAuth();
  if (auth.error || !auth.taller) {
    return { success: false, error: auth.error ?? "No autorizado" };
  }

  const parsed = z
    .object({
      vehiculoId: z.string().uuid(),
      requiereHomologacion: z.boolean().optional(),
    })
    .safeParse(raw);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.errors[0]?.message ?? "Datos inválidos",
    };
  }

  const row = await assertVehiculoTaller(parsed.data.vehiculoId, auth.taller.id);
  if (!row) return { success: false, error: "Vehículo no encontrado" };

  const docs = parseVehiculosDocumentos(row.documentos);
  const existing = parseImportacion(row.importacion);
  const requiereHomologacion =
    parsed.data.requiereHomologacion ?? existing.requiereHomologacion === true;
  const faltantes = faltantesMatriculacionCarpeta(docs, requiereHomologacion);
  if (faltantes.length > 0) {
    return {
      success: false,
      error:
        "Completa el archivo INTT: cédula, RIF, factura, certificado de origen, homologación (si aplica), liquidación SENIAT, constancia de inspección, declaración de propiedad y pago de tasas INTT",
    };
  }

  const fechaLimite =
    existing.fechaLimiteNacionalizacion?.trim() ||
    fechaLimitePermanencia3Anios(existing.fechaIngreso);

  const importacion = serializeImportacion({
    ...existing,
    planillaFase: 10,
    matriculacionPaso: 2,
    requiereHomologacion,
    estadoNacionalizacion: existing.estadoNacionalizacion ?? "pendiente",
    fechaLimiteNacionalizacion: fechaLimite,
    nacionalizacionPaso: existing.nacionalizacionPaso ?? 1,
  });

  const admin = createAdminClient();
  const { error } = await admin
    .from("vehiculos")
    .update({ importacion, updated_at: new Date().toISOString() })
    .eq("id", parsed.data.vehiculoId)
    .eq("taller_id", auth.taller.id);

  if (error) return { success: false, error: error.message };
  revalidateFicha(parsed.data.vehiculoId);
  return { success: true };
}

async function persistPlacaUnicaEnTaller(params: {
  vehiculoId: string;
  tallerId: string;
  placaRaw: string;
  codigoExpediente: string | null;
  extra?: Record<string, unknown>;
}): Promise<PuertoLibreActionResult> {
  const validated = validarPlacaVehicular(
    params.placaRaw,
    params.codigoExpediente
  );
  if (!validated.ok) return { success: false, error: validated.error };

  const admin = createAdminClient();
  const { data: placaDup } = await admin
    .from("vehiculos")
    .select("id")
    .eq("taller_id", params.tallerId)
    .eq("placa", validated.placa)
    .neq("id", params.vehiculoId)
    .maybeSingle();
  if (placaDup) {
    return {
      success: false,
      error: "Ya existe otro vehículo con esa placa en tu taller.",
    };
  }

  const { error } = await admin
    .from("vehiculos")
    .update({
      placa: validated.placa,
      updated_at: new Date().toISOString(),
      ...params.extra,
    })
    .eq("id", params.vehiculoId)
    .eq("taller_id", params.tallerId);

  if (error) {
    if (error.code === "23505" && error.message.includes("placa")) {
      return {
        success: false,
        error: "Ya existe otro vehículo con esa placa en tu taller.",
      };
    }
    return { success: false, error: error.message };
  }
  return { success: true };
}

/** Completa fase 10: placa única + docs de circulación → planilla 11. */
export async function savePuertoLibreEntregaPlacaAction(
  raw: unknown
): Promise<PuertoLibreActionResult> {
  const auth = await requireTallerAuth();
  if (auth.error || !auth.taller) {
    return { success: false, error: auth.error ?? "No autorizado" };
  }

  const parsed = z
    .object({
      vehiculoId: z.string().uuid(),
      placa: z.string().trim().min(1).max(20),
    })
    .safeParse(raw);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.errors[0]?.message ?? "Datos inválidos",
    };
  }

  const row = await assertVehiculoTaller(parsed.data.vehiculoId, auth.taller.id);
  if (!row) return { success: false, error: "Vehículo no encontrado" };

  const docs = parseVehiculosDocumentos(row.documentos);
  if (!docsEntregaPlacaListos(docs)) {
    return {
      success: false,
      error:
        "Carga el documento de circulación, la póliza de responsabilidad civil y la tarjeta de circulación",
    };
  }

  const existing = parseImportacion(row.importacion);
  const codigoExpediente =
    resolveCodigoExpediente({
      codigoExpediente: existing.codigoExpediente,
      placa: row.placa,
    }) ?? null;
  const importacion = serializeImportacion({
    ...existing,
    planillaFase: PLANILLA_FASE_COMPLETA,
    matriculacionPaso: 2,
    estadoNacionalizacion: existing.estadoNacionalizacion ?? "pendiente",
    nacionalizacionPaso: existing.nacionalizacionPaso ?? 1,
  });

  const persisted = await persistPlacaUnicaEnTaller({
    vehiculoId: parsed.data.vehiculoId,
    tallerId: auth.taller.id,
    placaRaw: parsed.data.placa,
    codigoExpediente,
    extra: { importacion },
  });
  if (!persisted.success) return persisted;
  revalidateFicha(parsed.data.vehiculoId);
  return { success: true };
}

/**
 * @deprecated Usar savePuertoLibreCarpetaMatriculacionAction.
 * Conservado por compatibilidad: completa matriculación sin exigir título/placa.
 */
export async function completePuertoLibreFase6MatriculacionAction(
  raw: unknown
): Promise<PuertoLibreActionResult> {
  const auth = await requireTallerAuth();
  if (auth.error || !auth.taller) {
    return { success: false, error: auth.error ?? "No autorizado" };
  }

  const parsed = z
    .object({
      vehiculoId: z.string().uuid(),
      placa: z.string().trim().max(20).optional(),
      requiereHomologacion: z.boolean().optional(),
    })
    .safeParse(raw);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message ?? "Datos inválidos" };
  }

  const result = await savePuertoLibreCarpetaMatriculacionAction({
    vehiculoId: parsed.data.vehiculoId,
    requiereHomologacion: parsed.data.requiereHomologacion,
  });
  if (!result.success) return result;

  const placaRaw = parsed.data.placa?.trim();
  if (!placaRaw) {
    revalidateFicha(parsed.data.vehiculoId);
    return { success: true };
  }

  const row = await assertVehiculoTaller(parsed.data.vehiculoId, auth.taller.id);
  if (!row) return { success: false, error: "Vehículo no encontrado" };

  const existing = parseImportacion(row.importacion);
  const codigoExpediente =
    resolveCodigoExpediente({
      codigoExpediente: existing.codigoExpediente,
      placa: row.placa,
    }) ?? null;

  const persisted = await persistPlacaUnicaEnTaller({
    vehiculoId: parsed.data.vehiculoId,
    tallerId: auth.taller.id,
    placaRaw,
    codigoExpediente,
  });
  if (!persisted.success) return persisted;
  revalidateFicha(parsed.data.vehiculoId);
  return { success: true };
}

const elegirViaNacionalizacionSchema = z.object({
  vehiculoId: z.string().uuid(),
  via: z.enum(VIAS_NACIONALIZACION),
});

/** Paso 1: elige vía M2/M3 y marca nacionalización en proceso. */
export async function elegirViaNacionalizacionAction(
  raw: unknown
): Promise<PuertoLibreActionResult> {
  const auth = await requireTallerAuth();
  if (auth.error || !auth.taller) {
    return { success: false, error: auth.error ?? "No autorizado" };
  }

  const parsed = elegirViaNacionalizacionSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message ?? "Datos inválidos" };
  }

  const row = await assertVehiculoTaller(parsed.data.vehiculoId, auth.taller.id);
  if (!row) return { success: false, error: "Vehículo no encontrado" };

  const existing = parseImportacion(row.importacion);
  if ((existing.planillaFase ?? 0) < PLANILLA_FASE_COMPLETA) {
    return {
      success: false,
      error: "Completa la planilla, la matrícula y la placa (circulación) antes de nacionalizar",
    };
  }
  if (existing.estadoNacionalizacion === "nacionalizado") {
    return { success: false, error: "Este expediente ya está nacionalizado" };
  }

  const importacion = serializeImportacion({
    ...existing,
    viaNacionalizacion: parsed.data.via as ViaNacionalizacion,
    estadoNacionalizacion: "en_proceso",
    nacionalizacionPaso: 2,
    fechaLimiteNacionalizacion:
      existing.fechaLimiteNacionalizacion?.trim() ||
      fechaLimitePermanencia3Anios(existing.fechaIngreso),
  });

  const admin = createAdminClient();
  const { error } = await admin
    .from("vehiculos")
    .update({ importacion, updated_at: new Date().toISOString() })
    .eq("id", parsed.data.vehiculoId)
    .eq("taller_id", auth.taller.id);

  if (error) return { success: false, error: error.message };
  revalidateFicha(parsed.data.vehiculoId);
  return { success: true };
}

/** Avanza paso del wizard si los docs del paso actual están. */
export async function avanzarPasoNacionalizacionAction(
  raw: unknown
): Promise<PuertoLibreActionResult> {
  const auth = await requireTallerAuth();
  if (auth.error || !auth.taller) {
    return { success: false, error: auth.error ?? "No autorizado" };
  }

  const schema = z.object({
    vehiculoId: z.string().uuid(),
    pasoDestino: z.coerce.number().int().min(1).max(4),
  });
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message ?? "Datos inválidos" };
  }

  const row = await assertVehiculoTaller(parsed.data.vehiculoId, auth.taller.id);
  if (!row) return { success: false, error: "Vehículo no encontrado" };

  const existing = parseImportacion(row.importacion);
  const via = existing.viaNacionalizacion;
  if (parsed.data.pasoDestino > 1 && !via) {
    return { success: false, error: "Elige primero la vía de nacionalización" };
  }

  if (parsed.data.pasoDestino >= 3 && via) {
    const docs = parseVehiculosDocumentos(row.documentos);
    const faltantes = docsFaltantesNacionalizacion(docs, via);
    if (faltantes.length > 0) {
      return {
        success: false,
        error: "Carga todos los documentos de nacionalización antes de continuar",
      };
    }
  }

  const importacion = serializeImportacion({
    ...existing,
    estadoNacionalizacion: "en_proceso",
    nacionalizacionPaso: parsed.data.pasoDestino,
  });

  const admin = createAdminClient();
  const { error } = await admin
    .from("vehiculos")
    .update({ importacion, updated_at: new Date().toISOString() })
    .eq("id", parsed.data.vehiculoId)
    .eq("taller_id", auth.taller.id);

  if (error) return { success: false, error: error.message };
  revalidateFicha(parsed.data.vehiculoId);
  return { success: true };
}

/** Cierra nacionalización: resolución + título de libre circulación. */
export async function completarNacionalizacionAction(
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

  const existing = parseImportacion(row.importacion);
  const via = existing.viaNacionalizacion;
  if (!via) {
    return { success: false, error: "Elige primero la vía de nacionalización" };
  }

  const docs = parseVehiculosDocumentos(row.documentos);
  const faltantes = docsFaltantesNacionalizacion(docs, via);
  if (faltantes.length > 0) {
    return {
      success: false,
      error: "Completa todos los recaudos de nacionalización antes de finalizar",
    };
  }
  if (!docs.resolucion_liberacion_seniat?.url || !docs.titulo_libre_circulacion?.url) {
    return {
      success: false,
      error: "Se requieren la resolución SENIAT y el título de libre circulación",
    };
  }

  const importacion = serializeImportacion({
    ...existing,
    estadoNacionalizacion: "nacionalizado",
    estadoSeniat: "presentada",
    nacionalizacionPaso: 4,
  });

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

const rechazoSeniatSchema = z.object({
  vehiculoId: z.string().uuid(),
  motivo: z.string().trim().min(1, "El motivo de rechazo es obligatorio").max(1000),
});

/**
 * Marca el expediente como rechazado por SENIAT.
 * No cambia planillaFase: el operador corrige docs y reintenta.
 */
export async function marcarRechazoSeniatAction(
  raw: unknown
): Promise<PuertoLibreActionResult> {
  const auth = await requireTallerAuth();
  if (auth.error || !auth.taller) {
    return { success: false, error: auth.error ?? "No autorizado" };
  }

  const access = await resolvePortalAccess();
  if (!access || !canMutateImportacionData(access)) {
    return {
      success: false,
      error: "No tienes permiso para marcar un rechazo SENIAT.",
    };
  }

  const parsed = rechazoSeniatSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.errors[0]?.message ?? "Datos inválidos",
    };
  }

  const row = await assertVehiculoTaller(parsed.data.vehiculoId, auth.taller.id);
  if (!row) return { success: false, error: "Vehículo no encontrado" };

  const existing = parseImportacion(row.importacion);
  const ahora = new Date().toISOString();
  const motivo = parsed.data.motivo.trim();
  const historial = [
    ...(existing.historialRechazosSeniat ?? []),
    {
      motivo,
      fecha: ahora,
      usuarioId: access.userId,
    },
  ].slice(-50);

  const importacion = serializeImportacion({
    ...existing,
    estadoSeniat: "rechazada",
    motivoRechazoSeniat: motivo,
    fechaRechazoSeniat: ahora,
    historialRechazosSeniat: historial,
  });

  const admin = createAdminClient();
  const { error } = await admin
    .from("vehiculos")
    .update({ importacion, updated_at: ahora })
    .eq("id", parsed.data.vehiculoId)
    .eq("taller_id", auth.taller.id);

  if (error) return { success: false, error: error.message };
  revalidateFicha(parsed.data.vehiculoId);
  return { success: true };
}

/**
 * Tras corregir y re-subir documentos: sale de "rechazada".
 * Vuelve a "presentada" si ya había presentación formal; si no, a "pendiente".
 */
export async function resolverRechazoSeniatAction(
  raw: unknown
): Promise<PuertoLibreActionResult> {
  const auth = await requireTallerAuth();
  if (auth.error || !auth.taller) {
    return { success: false, error: auth.error ?? "No autorizado" };
  }

  const access = await resolvePortalAccess();
  if (!access || !canMutateImportacionData(access)) {
    return {
      success: false,
      error: "No tienes permiso para resolver un rechazo SENIAT.",
    };
  }

  const idParsed = z
    .object({ vehiculoId: z.string().uuid() })
    .safeParse(typeof raw === "string" ? { vehiculoId: raw } : raw);
  if (!idParsed.success) return { success: false, error: "ID inválido" };

  const row = await assertVehiculoTaller(idParsed.data.vehiculoId, auth.taller.id);
  if (!row) return { success: false, error: "Vehículo no encontrado" };

  const existing = parseImportacion(row.importacion);
  if (existing.estadoSeniat !== "rechazada") {
    return { success: false, error: "El expediente no está en estado rechazada." };
  }

  const siguienteEstado = existing.fechaPresentacionSeniat?.trim()
    ? "presentada"
    : "pendiente";

  const importacion = serializeImportacion({
    ...existing,
    estadoSeniat: siguienteEstado,
    motivoRechazoSeniat: null,
    fechaRechazoSeniat: null,
  });

  const admin = createAdminClient();
  const { error } = await admin
    .from("vehiculos")
    .update({ importacion, updated_at: new Date().toISOString() })
    .eq("id", idParsed.data.vehiculoId)
    .eq("taller_id", auth.taller.id);

  if (error) return { success: false, error: error.message };
  revalidateFicha(idParsed.data.vehiculoId);
  return { success: true };
}

const registrarPresentacionSchema = z.object({
  vehiculoId: z.string().uuid(),
  fechaPresentacion: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha de presentación inválida"),
  nroActaInspeccion: z.string().trim().max(80).optional().nullable(),
  observaciones: z.string().trim().max(500).optional().nullable(),
});

/** Registra una presentación anual SENIAT y recorre el plazo +1 año. */
export async function registrarPresentacionAnualAction(
  raw: unknown
): Promise<PuertoLibreActionResult> {
  const auth = await requireTallerAuth();
  if (auth.error || !auth.taller) {
    return { success: false, error: auth.error ?? "No autorizado" };
  }

  const parsed = registrarPresentacionSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.errors[0]?.message ?? "Datos inválidos",
    };
  }

  const row = await assertVehiculoTaller(parsed.data.vehiculoId, auth.taller.id);
  if (!row) return { success: false, error: "Vehículo no encontrado" };

  const existing = parseImportacion(row.importacion);
  if (
    existing.estadoNacionalizacion === "nacionalizado" ||
    existing.estadoNacionalizacion === "no_aplica"
  ) {
    return {
      success: false,
      error: "Este expediente ya no requiere presentación anual",
    };
  }

  const historial = [...(existing.historialPresentaciones ?? [])];
  const duplicada = historial.some(
    (item) => item.fechaPresentacion.slice(0, 10) === parsed.data.fechaPresentacion
  );
  if (duplicada) {
    return {
      success: false,
      error: "Ya existe una presentación registrada en esa fecha",
    };
  }

  historial.push({
    id: crypto.randomUUID(),
    fechaPresentacion: parsed.data.fechaPresentacion,
    nroActaInspeccion: parsed.data.nroActaInspeccion?.trim() || null,
    observaciones: parsed.data.observaciones?.trim() || null,
  });

  const proxima = addYearsIso(parsed.data.fechaPresentacion, 1);
  const importacion = serializeImportacion({
    ...existing,
    historialPresentaciones: historial,
    fechaPresentacionSeniat: proxima,
    estadoSeniat: "presentada",
  });

  const admin = createAdminClient();
  const { error } = await admin
    .from("vehiculos")
    .update({ importacion, updated_at: new Date().toISOString() })
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

  revalidatePath("/smartimport");
  revalidatePath(`/smartimport/${vehiculoId}`);
  revalidatePath(`/smartimport/${vehiculoId}/planilla`);
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

    let importacionActual = parseImportacion(row.importacion);
    const skipOcr = String(formData.get("skipOcr") ?? "") === "1";
    const skipLoteSync = String(formData.get("skipLoteSync") ?? "") === "1";

    // Copiar al lote ANTES del OCR: si el extracto pisa el nº BL o se agota
    // el tiempo, el PDF ya quedó en todos los expedientes del grupo.
    let loteCopiados = 0;
    if (!skipLoteSync && isDocumentoLote(tipoParsed.data)) {
      loteCopiados = await syncLoteDocumentoToSiblings({
        admin,
        tallerId: auth.taller.id,
        sourceVehiculoId: vehiculoId,
        sourceImportacion: importacionActual,
        tipo: tipoParsed.data,
        documento,
      });
    }

    // BL / póliza / certificado: extraer datos y guardar en importación (best-effort).
    // Extraer ya leyó el lote: al Registrar no repetir OCR (minutos por unidad).
    if (
      !skipOcr &&
      (tipoParsed.data === "bl_guia" ||
        tipoParsed.data === "poliza_transporte" ||
        tipoParsed.data === "certificado_origen") &&
      isLlmConfigured()
    ) {
      try {
        const buffer = Buffer.from(await file.arrayBuffer());
        const mimeType =
          file.type === "application/pdf" || /\.pdf$/i.test(file.name)
            ? "application/pdf"
            : resolveImageMimeType({
                declaredMime: file.type,
                fileName: file.name,
                buffer,
              }) ?? "image/jpeg";
        const existingImp = parseImportacion(row.importacion);
        let patch: Partial<ImportacionData> = {};
        if (tipoParsed.data === "certificado_origen") {
          const fields = await ocrCertificadoOrigenBuffer(buffer, mimeType, {
            targetVin:
              (row.serial_carroceria as string | null) ??
              existingImp.vin ??
              null,
          });
          patch = certificadoPatchFromScanFields(fields, existingImp);
        } else {
          const fields =
            tipoParsed.data === "bl_guia"
              ? (await extractBlMultiFromDocument(buffer, mimeType)).shared
              : polizaToFormFields(
                  await extractPolizaTransporteFromDocument(buffer, mimeType)
                );
          patch = embarquePatchFromScanFields(fields, existingImp, {
            includeNumeroPoliza: tipoParsed.data === "poliza_transporte",
          });
        }
        if (Object.keys(patch).length > 0) {
          const merged = serializeImportacion({ ...existingImp, ...patch });
          await admin
            .from("vehiculos")
            .update({ importacion: merged, updated_at: new Date().toISOString() })
            .eq("id", vehiculoId)
            .eq("taller_id", auth.taller.id);
          importacionActual = { ...existingImp, ...patch };
        }
      } catch {
        // El documento ya quedó guardado; la extracción es best-effort.
      }
    }

    if (!skipLoteSync && isDocumentoLote(tipoParsed.data)) {
      await syncLoteImportacionToSiblings({
        admin,
        tallerId: auth.taller.id,
        sourceVehiculoId: vehiculoId,
        lookup: parseImportacion(row.importacion),
        lote: importacionActual,
      });
    }

    revalidateFicha(vehiculoId);
    return {
      success: true,
      tipo: tipoParsed.data,
      documentos: next,
      loteCopiados,
    };
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

/**
 * Adjunta un mismo BL a varios expedientes del mismo taller y aplica sus
 * datos compartidos de embarque. El archivo se sube una sola vez.
 */
export async function uploadPuertoLibreBlLoteAction(
  formData: FormData
): Promise<{ success: true; applied: number } | { success: false; error: string }> {
  const auth = await requireTallerAuth();
  if (auth.error || !auth.taller) {
    return { success: false, error: auth.error ?? "No autorizado" };
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return { success: false, error: "Selecciona el PDF del BL" };
  }
  if (file.type !== "application/pdf" && !/\.pdf$/i.test(file.name)) {
    return { success: false, error: "El BL debe ser un archivo PDF" };
  }
  const validationError = validateVehiculoDocumentoFile(file);
  if (validationError) return { success: false, error: validationError };

  let vehiculoIds: unknown;
  try {
    vehiculoIds = JSON.parse(String(formData.get("vehiculoIds") ?? "[]"));
  } catch {
    return { success: false, error: "La selección de expedientes no es válida" };
  }
  const ids = Array.isArray(vehiculoIds)
    ? [...new Set(vehiculoIds.filter((id): id is string => typeof id === "string"))]
    : [];
  if (ids.length === 0) {
    return { success: false, error: "Selecciona al menos un expediente" };
  }
  if (ids.length > 50 || ids.some((id) => !z.string().uuid().safeParse(id).success)) {
    return { success: false, error: "La selección de expedientes no es válida" };
  }

  const rows = await Promise.all(
    ids.map((vehiculoId) => assertVehiculoTaller(vehiculoId, auth.taller.id))
  );
  if (rows.some((row) => !row)) {
    return { success: false, error: "Uno o más expedientes no están disponibles" };
  }

  try {
    const admin = createAdminClient();
    const documento = await uploadVehiculoDocumento(admin, {
      tallerId: auth.taller.id,
      vehiculoId: ids[0]!,
      tipo: "bl_guia",
      file,
    });

    let patch: Partial<ImportacionData> = {};
    if (isLlmConfigured()) {
      try {
        const buffer = Buffer.from(await file.arrayBuffer());
        const fields = (
          await extractBlMultiFromDocument(buffer, "application/pdf")
        ).shared;
        patch = embarquePatchFromScanFields(fields, {});
      } catch {
        // El PDF sigue adjunto aun cuando OCR no pueda leerlo.
      }
    }

    const updatedAt = new Date().toISOString();
    await Promise.all(
      rows.map(async (row) => {
        if (!row) return;
        const documentos: VehiculosDocumentos = {
          ...parseVehiculosDocumentos(row.documentos),
          bl_guia: documento,
        };
        const existing = parseImportacion(row.importacion);
        const importacion =
          Object.keys(patch).length > 0
            ? serializeImportacion({ ...existing, ...patch })
            : row.importacion;
        const { error } = await admin
          .from("vehiculos")
          .update({ documentos, importacion, updated_at: updatedAt })
          .eq("id", row.id)
          .eq("taller_id", auth.taller.id);
        if (error) throw new Error(error.message);
        revalidateFicha(row.id);
      })
    );

    return { success: true, applied: ids.length };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "No se pudo aplicar el BL",
    };
  }
}

/** Aplica condición y combustible a los expedientes seleccionados del taller. */
export async function updatePuertoLibreDatosLoteAction(input: {
  vehiculoIds: string[];
  condicion: "nuevo" | "usado";
  tipoCombustible:
    | "gasolina"
    | "diesel"
    | "electrico"
    | "hibrido"
    | "gnv"
    | "otro";
}): Promise<{ success: true; applied: number } | { success: false; error: string }> {
  const auth = await requireTallerAuth();
  if (auth.error || !auth.taller) {
    return { success: false, error: auth.error ?? "No autorizado" };
  }

  const parsed = z
    .object({
      vehiculoIds: z.array(z.string().uuid()).min(1).max(50),
      condicion: z.enum(["nuevo", "usado"]),
      tipoCombustible: z.enum([
        "gasolina",
        "diesel",
        "electrico",
        "hibrido",
        "gnv",
        "otro",
      ]),
    })
    .safeParse({
      ...input,
      vehiculoIds: [...new Set(input.vehiculoIds)],
    });
  if (!parsed.success) {
    return { success: false, error: "Selecciona expedientes y datos válidos" };
  }

  const rows = await Promise.all(
    parsed.data.vehiculoIds.map((vehiculoId) =>
      assertVehiculoTaller(vehiculoId, auth.taller.id)
    )
  );
  if (rows.some((row) => !row)) {
    return { success: false, error: "Uno o más expedientes no están disponibles" };
  }

  try {
    const admin = createAdminClient();
    const updatedAt = new Date().toISOString();
    await Promise.all(
      rows.map(async (row) => {
        if (!row) return;
        const existing = parseImportacion(row.importacion);
        const importacion = serializeImportacion({
          ...existing,
          condicionVehiculo: parsed.data.condicion,
          esSubasta: false,
          tipoCombustible: parsed.data.tipoCombustible,
        });
        const { error } = await admin
          .from("vehiculos")
          .update({ importacion, updated_at: updatedAt })
          .eq("id", row.id)
          .eq("taller_id", auth.taller.id);
        if (error) throw new Error(error.message);
        revalidateFicha(row.id);
      })
    );
    return { success: true, applied: parsed.data.vehiculoIds.length };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "No se pudo actualizar el lote",
    };
  }
}

export type PuertoLibreVehiculoListItem = {
  id: string;
  placa: string;
  vin: string | null;
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
  /** Nº de BL / guía (grupo de carga). */
  numeroBl: string | null;
  stickerToken: string | null;
  regimen: string | null;
  estadoNacionalizacion: string | null;
  fechaLimiteNacionalizacion: string | null;
  estadoSeniat: string | null;
  fechaPresentacionSeniat: string | null;
  fechaRechazoSeniat: string | null;
  motivoRechazoSeniat: string | null;
  diasNacionalizacion: number | null;
  diasSeniat: number | null;
  proximoNacionalizar: boolean;
  proximoSeniat: boolean;
  rechazadoSeniat: boolean;
  codigoExpediente: string | null;
  fotoUrl: string | null;
  /** Semáforo de datos del vehículo (carga masiva / OCR). */
  completitudDatos: "rojo" | "ambar" | "verde" | null;
  datosPendientes: string[];
  /** Chip verde de Registro: datos + factura + certificado. */
  registroCompleto: boolean;
  /** Placa única + docs de circulación (tras INTT). */
  entregaPlacaCompleta: boolean;
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
      "id, placa, serial_carroceria, serial_motor, marca, modelo, color, nombre_cliente, telefono_cliente, kilometraje_ultimo, created_at, updated_at, pin_hash, documentos, importacion"
    )
    .eq("taller_id", auth.taller.id)
    .order("created_at", { ascending: false });

  if (error) {
    // Fallback si falta columna importacion / pin_hash aún no migrada
    const { data: fallback, error: fallbackError } = await supabase
      .from("vehiculos")
      .select(
        "id, placa, serial_carroceria, marca, modelo, color, nombre_cliente, telefono_cliente, kilometraje_ultimo, created_at, documentos"
      )
      .eq("taller_id", auth.taller.id)
      .order("created_at", { ascending: false });

    if (fallbackError) {
      return { success: false, error: error.message, vehiculos: [] };
    }

    const stickers = await loadStickersByVehiculo(auth.taller.id);
    return {
      success: true,
      vehiculos: (fallback ?? [])
        .map((row) => mapListItem(row as Record<string, unknown>, stickers))
        .sort(compareExpedientesAsc),
    };
  }

  const stickers = await loadStickersByVehiculo(auth.taller.id);
  const rows = (data ?? []) as Record<string, unknown>[];
  await backfillCodigosExpediente(auth.taller.id, rows);
  return {
    success: true,
    vehiculos: rows.map((row) => mapListItem(row, stickers)).sort(compareExpedientesAsc),
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
  const codigoExpediente = resolveCodigoExpediente({
    codigoExpediente: importacion.codigoExpediente,
    placa,
  });
  return {
    id,
    placa,
    vin: (row.serial_carroceria as string | null) ?? null,
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
    numeroBl: importacion.numeroBl?.trim() || null,
    stickerToken: stickers.get(id) ?? null,
    regimen: importacion.regimen ?? null,
    estadoNacionalizacion: importacion.estadoNacionalizacion ?? null,
    fechaLimiteNacionalizacion:
      resolverFechaLimiteNacionalizacion(importacion) ??
      importacion.fechaLimiteNacionalizacion ??
      null,
    estadoSeniat: importacion.estadoSeniat ?? null,
    fechaPresentacionSeniat: importacion.fechaPresentacionSeniat ?? null,
    fechaRechazoSeniat: importacion.fechaRechazoSeniat ?? null,
    motivoRechazoSeniat: importacion.motivoRechazoSeniat ?? null,
    diasNacionalizacion: diasHasta(
      resolverFechaLimiteNacionalizacion(importacion)
    ),
    diasSeniat: diasHasta(importacion.fechaPresentacionSeniat),
    proximoNacionalizar: esProximoNacionalizar(importacion),
    proximoSeniat: esProximoSeniat(importacion),
    rechazadoSeniat: (importacion.estadoSeniat ?? "pendiente") === "rechazada",
    codigoExpediente,
    fotoUrl: docs.foto_frontal?.url ?? docs.foto_placa?.url ?? null,
    completitudDatos: importacion.completitudDatos ?? null,
    datosPendientes: importacion.datosPendientes ?? [],
    registroCompleto: esRegistroPlanillaCompleto({
      marca: (row.marca as string | null) ?? null,
      modelo: (row.modelo as string | null) ?? null,
      color: (row.color as string | null) ?? null,
      anio: importacion.anio,
      serialMotor: (row.serial_motor as string | null) ?? null,
      vin: importacion.vin ?? (row.serial_carroceria as string | null),
      serialCarroceria: (row.serial_carroceria as string | null) ?? null,
      kilometraje:
        typeof row.kilometraje_ultimo === "number"
          ? row.kilometraje_ultimo
          : null,
      condicionVehiculo: importacion.condicionVehiculo ?? null,
      esSubasta: importacion.esSubasta ?? null,
      importadorNombre: importacion.importadorNombre ?? null,
      tieneFactura: Boolean(docs.factura_comercial?.url),
      tieneCertificado: Boolean(docs.certificado_origen?.url),
    }),
    entregaPlacaCompleta: esEntregaPlacaCompleta(docs, placa, codigoExpediente),
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
    const hydratedFb = await copyCedulaRifClienteOntoVehiculos({
      admin,
      tallerId: auth.taller.id,
      importadorId: impFb.importadorId,
      rows: [{ id: vehiculoId, documentos: fallback.documentos }],
    });
    const docsFbHydrated = hydratedFb.get(vehiculoId) ?? docsFb;

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
        fotoUrl: docsFbHydrated.foto_frontal?.url ?? docsFbHydrated.foto_placa?.url ?? null,
        tienePin: Boolean(fallback.pin_hash),
        tieneInspeccionTransportista: false,
        documentos: docsFbHydrated,
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

  const docsParsed = parseVehiculosDocumentos(data.documentos);
  let importacion = parseImportacion(data.importacion);
  const hydrated = await copyCedulaRifClienteOntoVehiculos({
    admin,
    tallerId: auth.taller.id,
    importadorId: importacion.importadorId,
    rows: [{ id: vehiculoId, documentos: data.documentos }],
  });
  const docs = hydrated.get(vehiculoId) ?? docsParsed;
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
