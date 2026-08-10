"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUser } from "@/lib/supabase/server";
import { getMyTaller } from "@/lib/taller";
import { formatLlmAuthError, isLlmConfigured } from "@/lib/ai/openai-config";
import { resolveImageMimeType } from "@/lib/mime-image";
import {
  CARGA_MASIVA_MAX_ROWS,
  cargaMasivaRowToAltaInput,
  emptyCargaMasivaRow,
  validateCargaMasivaRows,
  type CargaMasivaRow,
} from "@/lib/importacion/carga-masiva-template";
import { parseSpreadsheetBuffer } from "@/lib/importacion/parse-spreadsheet";
import {
  formatCodigoExpediente,
  partsFromDate,
  placaPendienteDesdeCodigo,
  resolveCodigoExpediente,
} from "@/lib/importacion/expediente";
import { parseImportacion, serializeImportacion } from "@/lib/schemas/vehiculo-documentos";
import {
  extractBlMultiFromDocument,
  extractFacturaMultiFromDocument,
  mergeScanFields,
  type PuertoLibreRegistroScanFields,
} from "@/lib/extract-puerto-libre-docs";
import { evaluarCupoPersonaNatural } from "@/lib/importacion/cumplimiento-importador";
import {
  findDuplicateSerialCarroceria,
  normalizarSerialCarroceria,
  SERIAL_CARROCERIA_DUPLICADO,
} from "@/lib/vehicles/serial";
import { validateVehiculoDocumentoFile } from "@/lib/vehiculos/upload-documento";
import type { PuertoLibreAltaInput } from "@/lib/schemas/importacion-alta";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  applyImportadorDefaults,
  getUltimoImportadorTaller,
  saveUltimoImportadorTaller,
  ultimoImportadorFromAlta,
} from "@/lib/taller-preferencias";

async function requireTallerAuth() {
  const user = await getUser();
  if (!user) return { error: "Debes iniciar sesión" as const, taller: null };
  const taller = await getMyTaller();
  if (!taller) return { error: "No se encontró tu taller" as const, taller: null };
  return { error: null, taller };
}

function maxNumeroExpedienteEnFilas(
  rows: { placa?: string | null; importacion?: unknown }[],
  year: number,
  month: number
): number {
  let max = 0;
  for (const row of rows) {
    const imp = parseImportacion(row.importacion);
    const codigo = resolveCodigoExpediente({
      codigoExpediente: imp.codigoExpediente,
      placa: row.placa,
    });
    if (!codigo) continue;
    const m = /^PL-(\d{4})\.(\d{1,2})\.(\d+)$/i.exec(codigo);
    if (!m) continue;
    if (Number(m[1]) !== year || Number(m[2]) !== month) continue;
    max = Math.max(max, Number(m[3]));
  }
  return max;
}

async function nextNumeroExpedienteMes(
  admin: SupabaseClient,
  tallerId: string,
  year: number,
  month: number
): Promise<number> {
  const { data } = await admin
    .from("vehiculos")
    .select("placa, importacion")
    .eq("taller_id", tallerId);
  return maxNumeroExpedienteEnFilas(data ?? [], year, month) + 1;
}

function scanFieldsToRow(
  fields: PuertoLibreRegistroScanFields,
  fuente: string
): CargaMasivaRow {
  const serial = fields.serialCarroceria ?? "";
  const vin = fields.vin ?? serial;
  return emptyCargaMasivaRow({
    marca: fields.marca ?? "",
    modelo: fields.modelo ?? "",
    color: fields.color ?? "",
    anio: fields.anio ?? "",
    serialMotor: fields.serialMotor ?? "",
    vin,
    serialCarroceria: serial || vin,
    kilometraje: fields.kilometraje ?? "0",
    condicion: fields.condicion ?? "nuevo",
    esSubasta:
      fields.esSubasta === "true" ? "si" : fields.esSubasta === "false" ? "no" : "",
    partidaArancelaria: fields.partidaArancelaria ?? "",
    cilindradaCc: fields.cilindradaCc ?? "",
    tipoCombustible: fields.tipoCombustible ?? "",
    fechaLlegadaBuque: fields.fechaLlegadaBuque ?? "",
    importadorNombre: fields.importadorNombre ?? "",
    importadorDocumento: fields.importadorDocumento ?? "",
    importadorTelefono: fields.importadorTelefono ?? "",
    importadorEmail: fields.importadorEmail ?? "",
    importadorDireccion: fields.importadorDireccion ?? "",
    aduana: fields.aduana ?? "",
    numeroBl: fields.numeroBl ?? "",
    paisOrigen: fields.paisOrigen ?? "",
    valorCif: fields.valorCif ?? "",
    tasaCambioBcv: fields.tasaCambioBcv ?? "",
    numeroExpedienteSeniat: fields.numeroExpedienteSeniat ?? "",
    numeroDav: fields.numeroDav ?? "",
    numeroCertificadoOrigen: fields.numeroCertificadoOrigen ?? "",
    numeroListaEmpaque: fields.numeroListaEmpaque ?? "",
    numeroPolizaTransporte: fields.numeroPolizaTransporte ?? "",
    observaciones: fields.observaciones ?? "",
    fuente,
  });
}

function filledRowScore(row: CargaMasivaRow): number {
  return Object.entries(row).filter(([k, v]) => {
    if (k === "id" || k === "error" || k === "fuente") return false;
    return typeof v === "string" && v.trim() !== "";
  }).length;
}

/** Une filas con el mismo VIN (carátula + hoja anexa). */
function dedupeCargaMasivaRowsBySerial(rows: CargaMasivaRow[]): CargaMasivaRow[] {
  const bySerial = new Map<string, CargaMasivaRow>();
  const without: CargaMasivaRow[] = [];

  for (const row of rows) {
    const serial = normalizarSerialCarroceria(row.serialCarroceria);
    if (!serial) {
      without.push(row);
      continue;
    }
    const prev = bySerial.get(serial);
    if (!prev) {
      bySerial.set(serial, {
        ...row,
        serialCarroceria: serial,
        vin: row.vin.trim() || serial,
      });
      continue;
    }
    const preferRow = filledRowScore(row) >= filledRowScore(prev);
    const primary = preferRow ? row : prev;
    const secondary = preferRow ? prev : row;
    const merged: CargaMasivaRow = {
      ...primary,
      serialCarroceria: serial,
      vin: primary.vin.trim() || secondary.vin.trim() || serial,
    };
    for (const key of Object.keys(merged) as (keyof CargaMasivaRow)[]) {
      if (key === "id" || key === "error" || key === "fuente") continue;
      const cur = merged[key];
      const alt = secondary[key];
      if (
        typeof cur === "string" &&
        !cur.trim() &&
        typeof alt === "string" &&
        alt.trim()
      ) {
        (merged as Record<string, unknown>)[key] = alt;
      }
    }
    const obsA = primary.observaciones?.trim() ?? "";
    const obsB = secondary.observaciones?.trim() ?? "";
    if (obsA && obsB && !obsA.includes(obsB) && !obsB.includes(obsA)) {
      merged.observaciones = `${obsA} · ${obsB}`;
    } else {
      merged.observaciones = obsA || obsB;
    }
    bySerial.set(serial, merged);
  }

  return [...bySerial.values(), ...without];
}

function resolveDocMime(file: File, buffer: Buffer): string {
  if (file.type === "application/pdf" || /\.pdf$/i.test(file.name)) {
    return "application/pdf";
  }
  return (
    resolveImageMimeType({
      declaredMime: file.type,
      fileName: file.name,
      buffer,
    }) ?? "image/jpeg"
  );
}

export type ParseCargaMasivaResult =
  | { success: true; rows: CargaMasivaRow[] }
  | { success: false; error: string };

/** Lee CSV/XLSX y devuelve filas para previsualizar. */
export async function parseCargaMasivaSpreadsheetAction(
  formData: FormData
): Promise<ParseCargaMasivaResult> {
  const auth = await requireTallerAuth();
  if (auth.error || !auth.taller) {
    return { success: false, error: auth.error ?? "No autorizado" };
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return { success: false, error: "Selecciona un archivo CSV o Excel" };
  }

  if (file.size > 8 * 1024 * 1024) {
    return { success: false, error: "El archivo supera 8 MB" };
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const parsed = parseSpreadsheetBuffer(buffer, file.name);
  if (parsed.error) return { success: false, error: parsed.error };

  const defaults = await getUltimoImportadorTaller(auth.taller.id);
  const withDefaults = parsed.rows.map((row) =>
    applyImportadorDefaults(row, defaults)
  );

  return { success: true, rows: validateCargaMasivaRows(withDefaults) };
}

export type ExtractCargaMasivaDocsResult =
  | { success: true; rows: CargaMasivaRow[]; warnings: string[] }
  | { success: false; error: string };

/**
 * Extrae vehículos desde varios PDFs/fotos (facturas y/o BL).
 * FormData: files[] + tipos[] (factura_comercial|bl_guia) alineados por índice,
 * o tipo_<index>.
 */
export async function extractCargaMasivaDocumentosAction(
  formData: FormData
): Promise<ExtractCargaMasivaDocsResult> {
  const auth = await requireTallerAuth();
  if (auth.error || !auth.taller) {
    return { success: false, error: auth.error ?? "No autorizado" };
  }

  if (!isLlmConfigured()) {
    return {
      success: false,
      error: "Falta configurar OPENAI_API_KEY para leer documentos con IA.",
    };
  }

  const files = formData.getAll("files").filter((f): f is File => f instanceof File);
  if (files.length === 0) {
    return { success: false, error: "Selecciona al menos un PDF o foto" };
  }
  if (files.length > 20) {
    return { success: false, error: "Máximo 20 documentos por carga" };
  }

  const tipos = formData.getAll("tipos").map((t) => String(t));
  const warnings: string[] = [];
  let sharedFromBl: PuertoLibreRegistroScanFields = {};
  const vehicleRows: CargaMasivaRow[] = [];

  try {
    for (let i = 0; i < files.length; i++) {
      const file = files[i]!;
      const tipoRaw =
        tipos[i] ||
        String(formData.get(`tipo_${i}`) ?? "") ||
        guessTipoFromName(file.name);

      if (tipoRaw !== "factura_comercial" && tipoRaw !== "bl_guia") {
        warnings.push(`${file.name}: tipo desconocido, se omitió`);
        continue;
      }

      const validationError = validateVehiculoDocumentoFile(file);
      if (validationError) {
        warnings.push(`${file.name}: ${validationError}`);
        continue;
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      const mimeType = resolveDocMime(file, buffer);

      if (tipoRaw === "factura_comercial") {
        const extracted = await extractFacturaMultiFromDocument(buffer, mimeType);
        if (extracted.vehiculos.length === 0) {
          warnings.push(`${file.name}: no se detectaron vehículos`);
          continue;
        }
        const sinSerial = extracted.vehiculos.filter(
          (v) => !v.serialCarroceria?.trim()
        ).length;
        if (sinSerial > 0) {
          warnings.push(
            `${file.name}: ${extracted.vehiculos.length} unidad(es); ${sinSerial} sin VIN/chasis — revisa la tabla`
          );
        } else {
          warnings.push(
            `${file.name}: ${extracted.vehiculos.length} vehículo(s) detectado(s)`
          );
        }
        for (const v of extracted.vehiculos) {
          const merged = mergeScanFields(extracted.shared, v);
          vehicleRows.push(scanFieldsToRow(merged, `Factura · ${file.name}`));
        }
      } else {
        const extracted = await extractBlMultiFromDocument(buffer, mimeType);
        sharedFromBl = mergeScanFields(sharedFromBl, extracted.shared);
        if (extracted.vehiculos.length > 0) {
          for (const v of extracted.vehiculos) {
            const merged = mergeScanFields(
              mergeScanFields(extracted.shared, sharedFromBl),
              v
            );
            vehicleRows.push(scanFieldsToRow(merged, `BL · ${file.name}`));
          }
        } else if (Object.keys(extracted.shared).length > 0) {
          // BL solo con datos de embarque: se aplicará a las facturas.
          warnings.push(
            `${file.name}: BL leído (importador/embarque); se aplicará a los vehículos de las facturas`
          );
        } else {
          warnings.push(`${file.name}: no se pudieron leer datos del BL`);
        }
      }
    }

    // Si hay BL compartido y filas de factura, enriquecer filas sin esos campos.
    if (Object.keys(sharedFromBl).length > 0 && vehicleRows.length > 0) {
      for (let i = 0; i < vehicleRows.length; i++) {
        const row = vehicleRows[i]!;
        const asFields: PuertoLibreRegistroScanFields = {
          importadorNombre: row.importadorNombre || undefined,
          importadorDocumento: row.importadorDocumento || undefined,
          importadorTelefono: row.importadorTelefono || undefined,
          importadorEmail: row.importadorEmail || undefined,
          fechaLlegadaBuque: row.fechaLlegadaBuque || undefined,
          aduana: row.aduana || undefined,
          numeroBl: row.numeroBl || undefined,
          paisOrigen: row.paisOrigen || undefined,
          valorCif: row.valorCif || undefined,
          observaciones: row.observaciones || undefined,
        };
        const merged = mergeScanFields(asFields, sharedFromBl);
        vehicleRows[i] = scanFieldsToRow(merged, row.fuente ?? "Documento");
      }
    }

    if (vehicleRows.length === 0) {
      return {
        success: false,
        error:
          warnings[0] ??
          "No se extrajeron vehículos. Prueba fotos más nítidas (Plan A) o la plantilla Excel (Plan B).",
      };
    }

    const before = vehicleRows.length;
    const uniqueRows = dedupeCargaMasivaRowsBySerial(vehicleRows);
    if (uniqueRows.length < before) {
      warnings.push(
        `Se unificaron ${before - uniqueRows.length} fila(s) duplicada(s) por el mismo VIN`
      );
    }

    if (uniqueRows.length > CARGA_MASIVA_MAX_ROWS) {
      return {
        success: false,
        error: `Se detectaron más de ${CARGA_MASIVA_MAX_ROWS} vehículos`,
      };
    }

    const defaults = await getUltimoImportadorTaller(auth.taller.id);
    const withDefaults = uniqueRows.map((row) =>
      applyImportadorDefaults(row, defaults)
    );

    return {
      success: true,
      rows: validateCargaMasivaRows(withDefaults),
      warnings,
    };
  } catch (err) {
    return { success: false, error: formatLlmAuthError(err) };
  }
}

function guessTipoFromName(name: string): string {
  const n = name.toLowerCase();
  if (/\bbl\b|bill|guia|guía|embarque|lading/.test(n)) return "bl_guia";
  if (
    /factura|invoice|commercial|proforma|anexa|attached|hoja/.test(n)
  ) {
    return "factura_comercial";
  }
  return "factura_comercial";
}

export type CargaMasivaCreateResult =
  | {
      success: true;
      created: { vehiculoId: string; codigoExpediente: string; serial: string }[];
      failed: { index: number; serial: string; error: string }[];
    }
  | { success: false; error: string };

/** Crea expedientes en lote a partir de filas ya revisadas. */
export async function createPuertoLibreCargaMasivaAction(
  rows: CargaMasivaRow[]
): Promise<CargaMasivaCreateResult> {
  const auth = await requireTallerAuth();
  if (auth.error || !auth.taller) {
    return { success: false, error: auth.error ?? "No autorizado" };
  }

  if (!Array.isArray(rows) || rows.length === 0) {
    return { success: false, error: "No hay filas para registrar" };
  }
  if (rows.length > CARGA_MASIVA_MAX_ROWS) {
    return {
      success: false,
      error: `Máximo ${CARGA_MASIVA_MAX_ROWS} vehículos por carga`,
    };
  }

  const validated = validateCargaMasivaRows(rows);
  const invalid = validated.filter((r) => r.error);
  if (invalid.length > 0) {
    return {
      success: false,
      error: `Hay ${invalid.length} fila(s) con error. Corrige la tabla antes de registrar.`,
    };
  }

  const admin = createAdminClient();
  const tallerId = auth.taller.id;
  const { year, month } = partsFromDate();
  let nextNumero = await nextNumeroExpedienteMes(admin, tallerId, year, month);

  const created: {
    vehiculoId: string;
    codigoExpediente: string;
    serial: string;
  }[] = [];
  const failed: { index: number; serial: string; error: string }[] = [];

  for (let i = 0; i < validated.length; i++) {
    const row = validated[i]!;
    const parsed = cargaMasivaRowToAltaInput(row);
    if (!parsed.ok) {
      failed.push({ index: i, serial: row.serialCarroceria, error: parsed.error });
      continue;
    }

    const result = await insertOneVehiculo({
      admin,
      tallerId,
      data: parsed.data,
      year,
      month,
      numero: nextNumero,
    });

    if (!result.ok) {
      failed.push({
        index: i,
        serial: row.serialCarroceria,
        error: result.error,
      });
      continue;
    }

    created.push({
      vehiculoId: result.vehiculoId,
      codigoExpediente: result.codigoExpediente,
      serial: parsed.data.serialCarroceria,
    });
    nextNumero += 1;
  }

  revalidatePath("/importacion");

  if (created.length > 0) {
    const lastCreated = created[created.length - 1]!;
    const lastRow = validated.find(
      (r) =>
        normalizarSerialCarroceria(r.serialCarroceria) ===
        normalizarSerialCarroceria(lastCreated.serial)
    );
    const fromRow = lastRow
      ? ultimoImportadorFromAlta({
          importadorNombre: lastRow.importadorNombre,
          importadorDocumento: lastRow.importadorDocumento,
          importadorTelefono: lastRow.importadorTelefono,
          importadorEmail: lastRow.importadorEmail,
          importadorDireccion: lastRow.importadorDireccion,
        })
      : null;
    if (fromRow) {
      await saveUltimoImportadorTaller(tallerId, fromRow);
    }
  }

  return { success: true, created, failed };
}

async function insertOneVehiculo(params: {
  admin: SupabaseClient;
  tallerId: string;
  data: PuertoLibreAltaInput;
  year: number;
  month: number;
  numero: number;
}): Promise<
  | { ok: true; vehiculoId: string; codigoExpediente: string }
  | { ok: false; error: string }
> {
  const { admin, tallerId, data, year, month, numero } = params;
  const serialCarroceria = normalizarSerialCarroceria(data.serialCarroceria);
  const serialMotor = normalizarSerialCarroceria(data.serialMotor);

  const existingSerial = await findDuplicateSerialCarroceria(
    admin,
    tallerId,
    serialCarroceria
  );
  if (existingSerial) {
    return { ok: false, error: SERIAL_CARROCERIA_DUPLICADO };
  }

  const cupo = await evaluarCupoPersonaNatural({
    admin,
    tallerId,
    importadorDocumento: data.importadorDocumento || null,
    fechaReferenciaNueva: data.fechaLlegadaBuque || null,
  });
  if (!cupo.ok) {
    return { ok: false, error: cupo.error };
  }

  const codigoExpediente = formatCodigoExpediente(year, month, numero);
  const placa = placaPendienteDesdeCodigo(codigoExpediente);

  const importacion = serializeImportacion({
    regimen: "Puerto Libre",
    anio: data.anio,
    condicionVehiculo: data.condicion,
    esSubasta: data.condicion === "usado" ? data.esSubasta : false,
    vin: data.vin || null,
    partidaArancelaria: data.partidaArancelaria || null,
    cilindradaCc: data.cilindradaCc,
    tipoCombustible: data.tipoCombustible,
    fechaLlegadaBuque: data.fechaLlegadaBuque,
    importadorNombre: data.importadorNombre,
    importadorDocumento: data.importadorDocumento || null,
    importadorTelefono: data.importadorTelefono || null,
    importadorEmail: data.importadorEmail || null,
    importadorDireccion: data.importadorDireccion || null,
    aduana: data.aduana || null,
    numeroBl: data.numeroBl || null,
    paisOrigen: data.paisOrigen || null,
    valorCif: data.valorCif,
    tasaCambioBcv: data.tasaCambioBcv,
    numeroExpedienteSeniat: data.numeroExpedienteSeniat || null,
    numeroDav: data.numeroDav || null,
    numeroCertificadoOrigen: data.numeroCertificadoOrigen || null,
    numeroListaEmpaque: data.numeroListaEmpaque || null,
    numeroPolizaTransporte: data.numeroPolizaTransporte || null,
    observaciones: data.observaciones || null,
    estadoNacionalizacion: "pendiente",
    estadoSeniat: "pendiente",
    planillaFase: 1,
    codigoExpediente,
  });

  const { data: created, error } = await admin
    .from("vehiculos")
    .insert({
      taller_id: tallerId,
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
      return { ok: false, error: SERIAL_CARROCERIA_DUPLICADO };
    }
    return { ok: false, error: error?.message ?? "No se pudo registrar" };
  }

  return { ok: true, vehiculoId: created.id as string, codigoExpediente };
}
