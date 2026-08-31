"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUser } from "@/lib/supabase/server";
import { getMyTaller } from "@/lib/taller";
import { formatLlmAuthError, isLlmConfigured } from "@/lib/ai/openai-config";
import {
  assertLlmBudgetAllows,
  bindLlmUsageContext,
} from "@/lib/ai/llm-usage";
import { anioFromVin } from "@/lib/ai/image-orient";
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
  placeholderOValor,
} from "@/lib/importacion/completitud-datos";
import {
  extractBlMultiFromDocument,
  extractCertificadoOrigenMultiFromDocument,
  enrichFacturaRowsStageFromDocument,
  extractFacturaMultiFromDocument,
  extractFacturaVinsStageFromDocument,
  mergeScanFields,
  type PuertoLibreRegistroScanFields,
} from "@/lib/extract-puerto-libre-docs";
import {
  buildEtapaProgress,
  nextCargaMasivaEtapa,
  type CargaMasivaEtapaId,
  type CargaMasivaEtapaResult,
} from "@/lib/importacion/carga-masiva-etapas";
import {
  clasificarTipoImportadorPorRif,
  evaluarCupoPersonaNatural,
} from "@/lib/importacion/cumplimiento-importador";
import {
  ensureImportadorForTaller,
  getImportadorAction,
} from "@/app/actions/nfc/importadores";
import {
  findDuplicateSerialCarroceria,
  normalizarSerialCarroceria,
  SERIAL_CARROCERIA_DUPLICADO,
} from "@/lib/vehicles/serial";
import { repairCheryWmi } from "@/lib/importacion/vin-text";
import {
  validateVehiculoDocumentoFile,
  VEHICULO_DOCS_BUCKET,
} from "@/lib/vehiculos/upload-documento";
import type { PuertoLibreAltaInput } from "@/lib/schemas/importacion-alta";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  applyImportadorDefaults,
  getUltimoImportadorTaller,
  saveUltimoImportadorTaller,
  ultimoImportadorFromAlta,
} from "@/lib/taller-preferencias";
import {
  applyEngineNosByVin,
  assignEngineNosByRowOrder,
  type CertEnginePair,
} from "@/lib/importacion/cert-engine-text";
import type { CertMatch } from "@/lib/importacion/carga-masiva-ui";
import {
  matchSerialKeyAmong,
  normalizeSerialKey,
  pairSerialsOneToOne,
  rifCoincideConSeleccionado,
  vehicleSemaforo,
} from "@/lib/importacion/carga-masiva-ui";
import type { CargaMasivaStorageDocRef } from "@/lib/importacion/carga-masiva-client";
import { normalizeRif } from "@/lib/validations/rif";

/** Campos de unidad: no propagar desde cabecera del cert a todas las filas. */
const UNIT_SCAN_FIELD_KEYS = [
  "serialMotor",
  "vin",
  "serialCarroceria",
  "color",
  "modelo",
  "anio",
  "valorCif",
  "kilometraje",
  "cilindradaCc",
  "tipoCombustible",
  "partidaArancelaria",
] as const satisfies readonly (keyof PuertoLibreRegistroScanFields)[];

function sharedDocHeaderFields(
  fields: PuertoLibreRegistroScanFields
): PuertoLibreRegistroScanFields {
  const out: PuertoLibreRegistroScanFields = { ...fields };
  for (const k of UNIT_SCAN_FIELD_KEYS) {
    delete out[k];
  }
  return out;
}

async function requireTallerAuth() {
  const user = await getUser();
  if (!user) return { error: "Debes iniciar sesión" as const, taller: null, userId: null };
  const taller = await getMyTaller();
  if (!taller) {
    return { error: "No se encontró tu taller" as const, taller: null, userId: user.id };
  }
  return { error: null, taller, userId: user.id };
}

async function gateLlmForTaller(
  auth: { taller: { id: string }; userId: string | null },
  action: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isLlmConfigured()) {
    return {
      ok: false,
      error:
        "Falta GEMINI_API_KEY (gratis) u OPENAI_API_KEY para leer documentos con IA.",
    };
  }
  const budget = await assertLlmBudgetAllows(auth.taller.id);
  if (!budget.ok) return budget;
  bindLlmUsageContext({
    action,
    tallerId: auth.taller.id,
    userId: auth.userId,
  });
  return { ok: true };
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
  fuente: string,
  preserveId?: string
): CargaMasivaRow {
  const serialRaw = fields.serialCarroceria ?? "";
  const vinRaw = fields.vin ?? serialRaw;
  const serial = normalizarSerialCarroceria(serialRaw || vinRaw);
  const vin = normalizarSerialCarroceria(vinRaw || serialRaw) || serial;
  const anio =
    (fields.anio ?? "").trim() ||
    (anioFromVin(vin) != null ? String(anioFromVin(vin)) : "");
  return emptyCargaMasivaRow({
    id: preserveId,
    marca: fields.marca ?? "",
    modelo: fields.modelo ?? "",
    color: fields.color ?? "",
    anio,
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
    puerto: fields.puerto ?? "",
    modalidadTransito: fields.modalidadTransito ?? "",
    aduanaTransito: fields.aduanaTransito ?? "",
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
    // En Chery el OCR a menudo lee WMI como LWV/LVW/LYV. Antes de deduplicar,
    // normalizamos a la convención LVV para que el mismo carro no aparezca
    // repetido en la planilla.
    const compact = normalizarSerialCarroceria(row.serialCarroceria);
    const serial = compact ? repairCheryWmi(compact) : "";
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
  return sniffDocumentMime({
    buffer,
    declaredMime: file.type,
    fileName: file.name,
  });
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
  | {
      success: true;
      rows: CargaMasivaRow[];
      warnings: string[];
      certMatches: CertMatch[];
    }
  | { success: false; error: string };

/**
 * Extrae vehículos desde varios PDFs/fotos (facturas, certificado de origen y/o BL).
 * FormData: files[] + tipos[] (factura_comercial|certificado_origen|bl_guia) alineados por índice,
 * o tipo_<index>.
 *
 * Orden de fusión: factura arma las filas; certificado y BL rellenan lo que falte (p. ej. motor).
 */
export async function extractCargaMasivaDocumentosAction(
  formData: FormData
): Promise<ExtractCargaMasivaDocsResult> {
  const auth = await requireTallerAuth();
  if (auth.error || !auth.taller) {
    return { success: false, error: auth.error ?? "No autorizado" };
  }

  const gate = await gateLlmForTaller(auth, "carga_masiva");
  if (!gate.ok) return { success: false, error: gate.error };

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
  let sharedFromCert: PuertoLibreRegistroScanFields = {};
  const vehicleRows: CargaMasivaRow[] = [];
  const certVehicles: { fields: PuertoLibreRegistroScanFields; fileName: string }[] =
    [];
  const certMatches: CertMatch[] = [];

  try {
    for (let i = 0; i < files.length; i++) {
      const file = files[i]!;
      const tipoRaw =
        tipos[i] ||
        String(formData.get(`tipo_${i}`) ?? "") ||
        guessTipoFromName(file.name);

      if (
        tipoRaw !== "factura_comercial" &&
        tipoRaw !== "bl_guia" &&
        tipoRaw !== "certificado_origen"
      ) {
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
          warnings.push(
            `${file.name}: no se detectaron VIN — revisa nitidez o usa Excel`
          );
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
          if (v.valorCif) merged.valorCif = v.valorCif;
          else delete merged.valorCif;
          vehicleRows.push(scanFieldsToRow(merged, `Factura · ${file.name}`));
        }
        const sinMotor = extracted.vehiculos.filter(
          (v) =>
            !v.serialMotor?.trim() ||
            v.serialMotor.trim().toUpperCase() === "POR-COMPLETAR"
        ).length;
        if (sinMotor > 0) {
          warnings.push(
            `${file.name}: ${sinMotor} unidad(es) sin motor — súbelos certificados de origen para completar`
          );
        }
        if (!extracted.shared.importadorDocumento && !extracted.shared.importadorNombre) {
          warnings.push(
            `${file.name}: no se leyó importador/RIF — selecciona el cliente y certifica que coincida`
          );
        }
      } else if (tipoRaw === "certificado_origen") {
        const extracted = await extractCertificadoOrigenMultiFromDocument(
          buffer,
          mimeType,
          { rapido: true }
        );
        sharedFromCert = mergeScanFields(sharedFromCert, extracted.shared);
        if (extracted.vehiculos.length > 0) {
          warnings.push(
            `${file.name}: certificado — ${extracted.vehiculos.length} unidad(es); se usará para rellenar datos faltantes`
          );
          for (const v of extracted.vehiculos) {
            const fields = mergeScanFields(extracted.shared, v);
            certVehicles.push({ fields, fileName: file.name });
            const rawSerial = normalizarSerialCarroceria(
              fields.serialCarroceria ?? fields.vin ?? ""
            );
            const serial = rawSerial ? repairCheryWmi(rawSerial) : "";
            if (serial) certMatches.push({ serial, fileName: file.name });
          }
        } else if (Object.keys(extracted.shared).length > 0) {
          warnings.push(
            `${file.name}: certificado leído (origen/nº); se aplicará a las filas`
          );
        } else {
          warnings.push(`${file.name}: no se pudieron leer datos del certificado`);
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
          warnings.push(
            `${file.name}: BL leído (importador/embarque); se aplicará a los vehículos de las facturas`
          );
        } else {
          warnings.push(`${file.name}: no se pudieron leer datos del BL`);
        }
      }
    }

    // Certificado: rellenar filas existentes por VIN 1:1; si no hay filas, crearlas.
    if (certVehicles.length > 0) {
      if (vehicleRows.length === 0) {
        for (const { fields } of certVehicles) {
          vehicleRows.push(
            scanFieldsToRow(
              mergeScanFields(sharedDocHeaderFields(sharedFromCert), fields),
              "Certificado origen"
            )
          );
        }
      } else {
        let matched = 0;
        const bySerial = new Map<string, PuertoLibreRegistroScanFields>();
        for (const { fields } of certVehicles) {
          const serial = normalizeSerialKey(
            fields.serialCarroceria ?? fields.vin ?? ""
          );
          if (serial) bySerial.set(serial, fields);
        }
        const rowSerials = vehicleRows.map((r) =>
          normalizeSerialKey(r.serialCarroceria || r.vin || "")
        );
        const rowToCert = pairSerialsOneToOne(rowSerials, [...bySerial.keys()]);
        const headerCert = sharedDocHeaderFields(sharedFromCert);
        for (let i = 0; i < vehicleRows.length; i++) {
          const row = vehicleRows[i]!;
          const serial = normalizeSerialKey(
            row.serialCarroceria || row.vin || ""
          );
          const certKey = serial ? rowToCert.get(serial) : undefined;
          const fromCert = certKey ? bySerial.get(certKey) : undefined;
          const patch = fromCert
            ? mergeScanFields(headerCert, fromCert)
            : headerCert;
          const base = rowToScanFields(row);
          const merged = mergeScanFields(base, patch);
          if (fromCert) matched += 1;
          vehicleRows[i] = scanFieldsToRow(
            merged,
            row.fuente ? `${row.fuente} + cert.` : "Certificado origen",
            row.id
          );
        }
        warnings.push(
          matched > 0
            ? `Certificado: se completaron datos en ${matched} fila(s) emparejada(s) por VIN`
            : "Certificado: no hubo match por VIN; se aplicaron solo datos compartidos (origen/nº)"
        );
      }
    } else if (Object.keys(sharedFromCert).length > 0 && vehicleRows.length > 0) {
      const headerCert = sharedDocHeaderFields(sharedFromCert);
      for (let i = 0; i < vehicleRows.length; i++) {
        const row = vehicleRows[i]!;
        const merged = mergeScanFields(rowToScanFields(row), headerCert);
        vehicleRows[i] = scanFieldsToRow(merged, row.fuente ?? "Documento", row.id);
      }
    }

    // Si hay BL compartido y filas de factura, enriquecer filas sin esos campos.
    if (Object.keys(sharedFromBl).length > 0 && vehicleRows.length > 0) {
      const headerBl = sharedDocHeaderFields(sharedFromBl);
      for (let i = 0; i < vehicleRows.length; i++) {
        const row = vehicleRows[i]!;
        const merged = mergeScanFields(rowToScanFields(row), headerBl);
        vehicleRows[i] = scanFieldsToRow(merged, row.fuente ?? "Documento", row.id);
      }
    }

    if (vehicleRows.length === 0) {
      return {
        success: false,
        error:
          warnings[0] ??
          "No se extrajeron vehículos. Sube factura y/o certificado de origen, o usa la plantilla Excel.",
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
      certMatches,
    };
  } catch (err) {
    return { success: false, error: formatLlmAuthError(err) };
  }
}

function parseRowsJson(raw: unknown): CargaMasivaRow[] | null {
  try {
    const parsed = JSON.parse(String(raw ?? "")) as unknown;
    if (!Array.isArray(parsed)) return null;
    return parsed as CargaMasivaRow[];
  } catch {
    return null;
  }
}

function mergeRowByVin(
  base: CargaMasivaRow,
  patch: PuertoLibreRegistroScanFields,
  fuente: string
): CargaMasivaRow {
  const merged = mergeScanFields(rowToScanFields(base), patch);
  return scanFieldsToRow(
    merged,
    base.fuente ? `${base.fuente} + ${fuente}` : fuente,
    base.id
  );
}

type LoadedDoc = { file: File; buffer: Buffer; mimeType: string };

/** 1–2 fotos = páginas del mismo COO; más archivos = un certificado por unidad. */
function certExtractJobs(docs: LoadedDoc[]): {
  buffer: Buffer;
  mimeType: string;
  fileName: string;
  extraPageBuffers?: Buffer[];
}[] {
  const allImages =
    docs.length >= 1 &&
    docs.length <= 2 &&
    docs.every((d) => !d.mimeType.toLowerCase().includes("pdf"));
  if (allImages && docs.length === 2) {
    return [
      {
        buffer: docs[0]!.buffer,
        mimeType: docs[0]!.mimeType,
        fileName: docs.map((d) => d.file.name).join(" + "),
        extraPageBuffers: [docs[1]!.buffer],
      },
    ];
  }
  return docs.map((d) => ({
    buffer: d.buffer,
    mimeType: d.mimeType,
    fileName: d.file.name,
  }));
}

async function loadCargaMasivaDocsFromForm(
  formData: FormData,
  tallerId: string,
  warnings: string[]
): Promise<
  | {
      ok: true;
      facturas: LoadedDoc[];
      certs: LoadedDoc[];
      bls: LoadedDoc[];
    }
  | { ok: false; error: string }
> {
  const facturas: LoadedDoc[] = [];
  const certs: LoadedDoc[] = [];
  const bls: LoadedDoc[] = [];

  function pushByTipo(tipoRaw: string, doc: LoadedDoc) {
    if (tipoRaw === "factura_comercial") facturas.push(doc);
    else if (tipoRaw === "certificado_origen") certs.push(doc);
    else if (tipoRaw === "bl_guia") bls.push(doc);
    else warnings.push(`${doc.file.name}: tipo desconocido, se omitió`);
  }

  const storageRaw = String(formData.get("storageDocs") ?? "").trim();
  if (storageRaw) {
    let refs: CargaMasivaStorageDocRef[] = [];
    try {
      const parsed = JSON.parse(storageRaw) as unknown;
      if (!Array.isArray(parsed)) {
        return { ok: false, error: "storageDocs inválido" };
      }
      refs = parsed as CargaMasivaStorageDocRef[];
    } catch {
      return { ok: false, error: "storageDocs JSON inválido" };
    }
    if (refs.length === 0) {
      return { ok: false, error: "Selecciona al menos un PDF o foto" };
    }
    if (refs.length > 20) {
      return { ok: false, error: "Máximo 20 documentos por carga" };
    }

    const admin = createAdminClient();
    const prefix = `${tallerId}/`;
    for (const ref of refs) {
      const path = String(ref.path ?? "");
      if (!path.startsWith(prefix) || path.includes("..")) {
        warnings.push(`${ref.fileName || path}: ruta no autorizada`);
        continue;
      }
      const { data, error } = await admin.storage
        .from(VEHICULO_DOCS_BUCKET)
        .download(path);
      if (error || !data) {
        warnings.push(
          `${ref.fileName || path}: no se pudo leer de Storage (${error?.message ?? "sin datos"})`
        );
        continue;
      }
      const buffer = Buffer.from(await data.arrayBuffer());
      const fileName = ref.fileName || path.split("/").pop() || "documento.pdf";
      let mimeType: string;
      try {
        mimeType = sniffDocumentMime({
          buffer,
          declaredMime: data.type,
          fileName,
        });
      } catch (err) {
        return {
          ok: false,
          error:
            err instanceof Error
              ? err.message
              : "No se pudo leer el documento desde Storage",
        };
      }
      const file = new File([buffer], fileName, { type: mimeType });
      pushByTipo(String(ref.tipo || guessTipoFromName(fileName)), {
        file,
        buffer,
        mimeType,
      });
    }
    return { ok: true, facturas, certs, bls };
  }

  const files = formData
    .getAll("files")
    .filter((f): f is File => f instanceof File);
  if (files.length === 0) {
    return { ok: false, error: "Selecciona al menos un PDF o foto" };
  }
  if (files.length > 20) {
    return { ok: false, error: "Máximo 20 documentos por carga" };
  }
  const tipos = formData.getAll("tipos").map((t) => String(t));
  for (let i = 0; i < files.length; i++) {
    const file = files[i]!;
    const tipoRaw =
      tipos[i] ||
      String(formData.get(`tipo_${i}`) ?? "") ||
      guessTipoFromName(file.name);
    const validationError = validateVehiculoDocumentoFile(file);
    if (validationError) {
      warnings.push(`${file.name}: ${validationError}`);
      continue;
    }
    const buffer = Buffer.from(await file.arrayBuffer());
    let mimeType: string;
    try {
      mimeType = resolveDocMime(file, buffer);
    } catch (err) {
      return {
        ok: false,
        error:
          err instanceof Error ? err.message : "No se pudo leer el documento",
      };
    }
    pushByTipo(tipoRaw, { file, buffer, mimeType });
  }
  return { ok: true, facturas, certs, bls };
}

export type CargaMasivaEtapaAuthOverride = {
  taller: { id: string };
  userId: string;
};

/**
 * Extracción por etapas (Fase B):
 * 1. vins — cosecha VIN + cabecera (consignatario, destino, CIF)
 * 2. certs — certificados + BL (ENGINE No)
 * 3. datos — modelo/color/CIF/cabecera (Gemini si hace falta)
 *
 * FormData: etapa, rowsJson (2–3), y una de:
 * - files[] + tipos[] (legacy, límite ~4.5 MB en Vercel)
 * - storageDocs JSON [{path,tipo,fileName}] (recomendado: upload directo a Storage)
 */
export async function extractCargaMasivaEtapaAction(
  formData: FormData,
  authOverride?: CargaMasivaEtapaAuthOverride
): Promise<
  | ({ success: true } & CargaMasivaEtapaResult)
  | { success: false; error: string }
> {
  const auth = authOverride
    ? { error: null, taller: authOverride.taller, userId: authOverride.userId }
    : await requireTallerAuth();
  if (auth.error || !auth.taller) {
    return { success: false, error: auth.error ?? "No autorizado" };
  }

  const etapaRaw = String(formData.get("etapa") ?? "vins");
  const gate = await gateLlmForTaller(
    auth,
    `carga_masiva_${etapaRaw || "vins"}`
  );
  if (!gate.ok) return { success: false, error: gate.error };

  if (etapaRaw !== "vins" && etapaRaw !== "datos" && etapaRaw !== "certs") {
    return { success: false, error: "Etapa inválida" };
  }
  const etapa = etapaRaw as CargaMasivaEtapaId;

  const facturas: { file: File; buffer: Buffer; mimeType: string }[] = [];
  const certs: { file: File; buffer: Buffer; mimeType: string }[] = [];
  const bls: { file: File; buffer: Buffer; mimeType: string }[] = [];
  const warnings: string[] = [];

  const loaded = await loadCargaMasivaDocsFromForm(
    formData,
    auth.taller.id,
    warnings
  );
  if (!loaded.ok) return { success: false, error: loaded.error };
  facturas.push(...loaded.facturas);
  certs.push(...loaded.certs);
  bls.push(...loaded.bls);

  if (facturas.length + certs.length + bls.length === 0) {
    const storageHint = warnings.find((w) =>
      /Storage|no se pudo leer|ruta no autorizada/i.test(w)
    );
    return {
      success: false,
      error:
        storageHint ??
        "No se pudo leer ningún documento. Reintenta subir el PDF (Wi‑Fi) o usa Excel.",
    };
  }

  const hasCertOrBl = certs.length > 0 || bls.length > 0;
  const defaults = await getUltimoImportadorTaller(auth.taller.id);

  try {
    if (etapa === "vins") {
      if (facturas.length === 0) {
        return {
          success: false,
          error: "Agrega al menos una factura para cosechar VIN",
        };
      }
      const vehicleRows: CargaMasivaRow[] = [];
      for (const f of facturas) {
        let extracted: Awaited<
          ReturnType<typeof extractFacturaVinsStageFromDocument>
        > = { shared: {}, vehiculos: [] };
        const harvestStarted = Date.now();
        try {
          extracted = await extractFacturaVinsStageFromDocument(
            f.buffer,
            f.mimeType
          );
        } catch (err) {
          const detail = formatLlmAuthError(err);
          warnings.push(`${f.file.name}: error en cosecha VIN — ${detail}`);
          // Diagnóstico OCR / Tesseract / API: fallar con el mensaje real
          if (
            /Sin VIN|OPENAI|OpenRouter|créditos|credits|402|API|visión|vision|clave|tesseract|raster/i.test(
              detail
            )
          ) {
            // Si la cosecha ya consumió casi el límite, no encadenar pipeline completo
            // (eso provoca el abort del cliente a ~110s con 0 filas).
            if (Date.now() - harvestStarted > 45_000) {
              return {
                success: false,
                error: `${f.file.name}: ${detail}`,
              };
            }
          }
        }
        if (extracted.vehiculos.length === 0 && Date.now() - harvestStarted < 45_000) {
          try {
            extracted = await extractFacturaMultiFromDocument(
              f.buffer,
              f.mimeType
            );
            if (extracted.vehiculos.length > 0) {
              warnings.push(
                `${f.file.name}: recuperado con pipeline completo (${extracted.vehiculos.length} VIN)`
              );
            }
          } catch (err) {
            warnings.push(
              `${f.file.name}: error OCR — ${formatLlmAuthError(err)}`
            );
          }
        } else if (extracted.vehiculos.length === 0) {
          warnings.push(
            `${f.file.name}: sin VIN y sin tiempo para pipeline completo (evitar timeout)`
          );
        }
        if (extracted.vehiculos.length === 0) {
          warnings.push(
            `${f.file.name}: no se detectaron VIN — prueba foto más nítida de la tabla o Excel`
          );
          continue;
        }
        warnings.push(
          `${f.file.name}: etapa VIN — ${extracted.vehiculos.length} chasis`
        );
        for (const v of extracted.vehiculos) {
          const merged = mergeScanFields(extracted.shared, v);
          vehicleRows.push(
            scanFieldsToRow(merged, `VIN · ${f.file.name}`)
          );
        }
      }
      const deduped = dedupeCargaMasivaRowsBySerial(vehicleRows);
      if (deduped.length === 0) {
        return {
          success: false,
          error:
            warnings[0] ??
            "No se detectaron VIN. Prueba una foto nítida de la tabla de la factura o usa la plantilla Excel.",
        };
      }
      const rows = validateCargaMasivaRows(
        deduped.map((r) => applyImportadorDefaults(r, defaults))
      );
      return {
        success: true,
        etapa,
        nextEtapa: nextCargaMasivaEtapa(etapa, hasCertOrBl),
        rows,
        warnings,
        certMatches: [],
        progress: buildEtapaProgress(etapa, rows, 100),
      };
    }

    if (etapa === "datos") {
      const existing = parseRowsJson(formData.get("rowsJson"));
      if (!existing || existing.length === 0) {
        return {
          success: false,
          error: "No hay filas VIN de la etapa anterior",
        };
      }
      if (facturas.length === 0) {
        return {
          success: false,
          error: "Falta la factura para enriquecer datos",
        };
      }
      const knownVins = existing
        .map((r) => normalizarSerialCarroceria(r.serialCarroceria || r.vin))
        .filter((v): v is string => Boolean(v));

      let rows = existing.map((r) => ({ ...r }));
      for (const f of facturas) {
        const enriched = await enrichFacturaRowsStageFromDocument(
          f.buffer,
          f.mimeType,
          knownVins
        );
        warnings.push(
          `${f.file.name}: etapa datos — ${enriched.vehiculos.length} filas enriquecidas`
        );
        const byVin = new Map<string, PuertoLibreRegistroScanFields>();
        for (const v of enriched.vehiculos) {
          const serial = normalizarSerialCarroceria(
            v.serialCarroceria ?? v.vin ?? ""
          );
          if (serial) byVin.set(serial, mergeScanFields(enriched.shared, v));
        }
        // Aplicar cabecera shared a todas (sin campos de unidad: motor/color/VIN)
        const headerOnly = sharedDocHeaderFields(enriched.shared);
        for (let i = 0; i < rows.length; i++) {
          const row = rows[i]!;
          const serial = normalizarSerialCarroceria(
            row.serialCarroceria || row.vin || ""
          );
          const unit = serial ? byVin.get(serial) : undefined;
          const patch = unit
            ? mergeScanFields(headerOnly, unit)
            : headerOnly;
          if (Object.keys(patch).length === 0) continue;
          rows[i] = mergeRowByVin(row, patch, "datos");
        }
        // VIN nuevos detectados en datos
        for (const [serial, fields] of byVin) {
          if (rows.some((r) => normalizarSerialCarroceria(r.serialCarroceria) === serial)) {
            continue;
          }
          rows.push(scanFieldsToRow(fields, `Datos · ${f.file.name}`));
        }
      }
      rows = dedupeCargaMasivaRowsBySerial(rows);
      const validated = validateCargaMasivaRows(
        rows.map((r) => applyImportadorDefaults(r, defaults))
      );
      return {
        success: true,
        etapa,
        nextEtapa: nextCargaMasivaEtapa(etapa, hasCertOrBl),
        rows: validated,
        warnings,
        certMatches: [],
        progress: buildEtapaProgress(etapa, validated, 100),
      };
    }

    // etapa === "certs" — sin filas previas se crean desde el certificado.
    const existing = parseRowsJson(formData.get("rowsJson")) ?? [];
    if (!hasCertOrBl) {
      const validated = validateCargaMasivaRows(existing);
      return {
        success: true,
        etapa,
        nextEtapa: nextCargaMasivaEtapa(etapa, false),
        rows: validated,
        warnings: ["Sin certificados ni BL en esta carga"],
        certMatches: [],
        progress: buildEtapaProgress(etapa, validated, 100),
      };
    }

    let rows = existing.map((r) => ({ ...r }));
    let sharedFromBl: PuertoLibreRegistroScanFields = {};
    let sharedFromCert: PuertoLibreRegistroScanFields = {};
    const certMatches: CertMatch[] = [];
    const certBySerial = new Map<string, PuertoLibreRegistroScanFields>();
    const motorsInOrder: string[] = [];
    const enginePairs: CertEnginePair[] = [];

    for (const job of certExtractJobs(certs)) {
      const extracted = await extractCertificadoOrigenMultiFromDocument(
        job.buffer,
        job.mimeType,
        { rapido: true, extraPageBuffers: job.extraPageBuffers }
      );
      sharedFromCert = mergeScanFields(sharedFromCert, extracted.shared);
      if (extracted.enginePairs?.length) {
        enginePairs.push(...extracted.enginePairs);
      }
      if (extracted.engineNos?.length) {
        motorsInOrder.push(...extracted.engineNos);
      }
      if (extracted.vehiculos.length > 0) {
        warnings.push(
          `${job.fileName}: cert — ${extracted.vehiculos.length} unidad(es)`
        );
        for (const v of extracted.vehiculos) {
          const fields = mergeScanFields(extracted.shared, v);
          const motor = (fields.serialMotor ?? "").trim();
          if (motor && motor.toUpperCase() !== "POR-COMPLETAR") {
            motorsInOrder.push(motor);
            const vin = normalizeSerialKey(
              fields.serialCarroceria ?? fields.vin ?? ""
            );
            if (vin) enginePairs.push({ vin, serialMotor: motor });
          }
          const serial = normalizeSerialKey(
            fields.serialCarroceria ?? fields.vin ?? ""
          );
          if (serial) {
            certBySerial.set(serial, fields);
            certMatches.push({ serial, fileName: job.fileName });
          }
        }
      } else if (
        extracted.enginePairs?.length ||
        extracted.engineNos?.length
      ) {
        warnings.push(
          `${job.fileName}: cert — ${extracted.engineNos?.length ?? extracted.enginePairs?.length ?? 0} ENGINE No`
        );
      } else if (Object.keys(extracted.shared).length > 0) {
        warnings.push(`${job.fileName}: certificado (datos compartidos)`);
      } else {
        warnings.push(`${job.fileName}: certificado sin datos legibles`);
      }
    }

    if (bls.length > 0) {
      warnings.push(
        `${bls.length} BL adjunto(s): no se lee con IA aquí (eso demoraba Extraer). Escribe el nº de BL o úsalo en datos.`
      );
    }

    let matched = 0;
    const rowSerials = rows.map((r) =>
      normalizeSerialKey(r.serialCarroceria || r.vin)
    );
    const certSerials = [...certBySerial.keys()];
    const rowToCert = pairSerialsOneToOne(rowSerials, certSerials);
    const headerCert = sharedDocHeaderFields(sharedFromCert);
    const headerBl = sharedDocHeaderFields(sharedFromBl);

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]!;
      const serial = normalizeSerialKey(row.serialCarroceria || row.vin);
      const certKey = serial ? rowToCert.get(serial) : undefined;
      const fromCert = certKey ? certBySerial.get(certKey) : undefined;
      // Sin match 1:1 solo cabecera (país, nº cert, importador) — nunca motor/VIN
      const patch = fromCert
        ? mergeScanFields(headerCert, fromCert)
        : mergeScanFields(headerCert, headerBl);
      if (Object.keys(patch).length === 0) continue;
      if (fromCert) matched += 1;
      rows[i] = mergeRowByVin(
        row,
        mergeScanFields(patch, headerBl),
        fromCert ? "cert" : "embarque"
      );
    }
    let appended = 0;
    const existingKeys = rows.map((r) =>
      normalizeSerialKey(r.serialCarroceria || r.vin)
    );
    const hadInvoiceRows = existing.length > 0;
    if (!hadInvoiceRows) {
      for (const [serial, fields] of certBySerial) {
        if (matchSerialKeyAmong(serial, existingKeys)) continue;
        rows.push(
          scanFieldsToRow(
            mergeScanFields(sharedDocHeaderFields(sharedFromCert), fields),
            "cert"
          )
        );
        existingKeys.push(serial);
        appended += 1;
      }
    }
    const motorsBeforeVin = rows.filter(
      (r) =>
        (r.serialMotor ?? "").trim() &&
        r.serialMotor.trim().toUpperCase() !== "POR-COMPLETAR"
    ).length;
    rows = applyEngineNosByVin(rows, enginePairs);
    const filledByVin =
      rows.filter(
        (r) =>
          (r.serialMotor ?? "").trim() &&
          r.serialMotor.trim().toUpperCase() !== "POR-COMPLETAR"
      ).length - motorsBeforeVin;
    if (filledByVin > 0) {
      warnings.push(
        `ENGINE No emparejados por VIN: ${filledByVin} fila(s)`
      );
    }
    const beforeFill = rows.filter(
      (r) => (r.serialMotor ?? "").trim() && r.serialMotor.trim().toUpperCase() !== "POR-COMPLETAR"
    ).length;
    rows = assignEngineNosByRowOrder(rows, motorsInOrder);
    const filledByOrder =
      rows.filter(
        (r) =>
          (r.serialMotor ?? "").trim() &&
          r.serialMotor.trim().toUpperCase() !== "POR-COMPLETAR"
      ).length - beforeFill;
    if (filledByOrder > 0) {
      warnings.push(
        `ENGINE No de página 2 asignados por orden: ${filledByOrder} fila(s)`
      );
    }
    if (certs.length > 0) {
      warnings.push(
        `Certificados emparejados por VIN: ${matched}/${rows.length}`
      );
    }
    if (appended > 0) {
      warnings.push(
        `Se añadieron ${appended} vehículo(s) desde certificado(s) sin fila previa`
      );
    }

    rows = dedupeCargaMasivaRowsBySerial(rows);
    const validated = validateCargaMasivaRows(
      rows.map((r) => applyImportadorDefaults(r, defaults))
    );
    if (validated.length === 0) {
      return {
        success: false,
        error:
          "No se leyeron VIN en la factura ni en el certificado. Pulsa Extraer vehículos de nuevo o sube un certificado por unidad.",
      };
    }
    return {
      success: true,
      etapa,
      nextEtapa: nextCargaMasivaEtapa(etapa, hasCertOrBl),
      rows: validated,
      warnings,
      certMatches,
      progress: buildEtapaProgress(etapa, validated, 100),
    };
  } catch (err) {
    return { success: false, error: formatLlmAuthError(err) };
  }
}

/**
 * Solo certificados de origen: completa filas ya extraídas emparejando por VIN.
 * FormData: rowsJson + storageDocs JSON (recomendado) o files[] (legacy).
 */
export async function completarCargaMasivaConCertificadosAction(
  formData: FormData
): Promise<ExtractCargaMasivaDocsResult> {
  const auth = await requireTallerAuth();
  if (auth.error || !auth.taller) {
    return { success: false, error: auth.error ?? "No autorizado" };
  }

  const gate = await gateLlmForTaller(auth, "carga_masiva_certs");
  if (!gate.ok) return { success: false, error: gate.error };

  let existingRows: CargaMasivaRow[] = [];
  try {
    const raw = String(formData.get("rowsJson") ?? "");
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return { success: false, error: "Filas inválidas" };
    }
    existingRows = parsed as CargaMasivaRow[];
  } catch {
    return { success: false, error: "Filas inválidas" };
  }

  const warnings: string[] = [];
  const loaded = await loadCargaMasivaDocsFromForm(
    formData,
    auth.taller.id,
    warnings
  );
  if (!loaded.ok) {
    return {
      success: false,
      error:
        loaded.error === "Selecciona al menos un PDF o foto"
          ? "Selecciona al menos un certificado de origen"
          : loaded.error,
    };
  }
  const certFiles =
    loaded.certs.length > 0
      ? loaded.certs
      : [...loaded.facturas, ...loaded.bls, ...loaded.certs];
  if (certFiles.length === 0) {
    return {
      success: false,
      error: "Selecciona al menos un certificado de origen",
    };
  }

  let sharedFromCert: PuertoLibreRegistroScanFields = {};
  const certVehicles: { fields: PuertoLibreRegistroScanFields; fileName: string }[] =
    [];
  const certMatches: CertMatch[] = [];

  try {
    for (const job of certExtractJobs(certFiles)) {
      const extracted = await extractCertificadoOrigenMultiFromDocument(
        job.buffer,
        job.mimeType,
        { rapido: true, extraPageBuffers: job.extraPageBuffers }
      );
      sharedFromCert = mergeScanFields(sharedFromCert, extracted.shared);
      if (extracted.enginePairs?.length) {
        for (const p of extracted.enginePairs) {
          certVehicles.push({
            fields: {
              serialCarroceria: p.vin,
              vin: p.vin,
              serialMotor: p.serialMotor,
            },
            fileName: job.fileName,
          });
        }
      }
      if (extracted.vehiculos.length > 0) {
        warnings.push(
          `${job.fileName}: certificado — ${extracted.vehiculos.length} unidad(es)`
        );
        for (const v of extracted.vehiculos) {
          const fields = mergeScanFields(extracted.shared, v);
          certVehicles.push({ fields, fileName: job.fileName });
          const serial = normalizeSerialKey(
            fields.serialCarroceria ?? fields.vin ?? ""
          );
          if (serial) certMatches.push({ serial, fileName: job.fileName });
        }
      } else if (Object.keys(extracted.shared).length > 0) {
        warnings.push(`${job.fileName}: certificado leído (datos compartidos)`);
      } else {
        warnings.push(`${job.fileName}: no se pudieron leer datos del certificado`);
      }
    }

    if (certVehicles.length === 0 && Object.keys(sharedFromCert).length === 0) {
      return {
        success: false,
        error: warnings[0] ?? "No se leyeron datos de los certificados",
      };
    }

    let vehicleRows = existingRows.map((r) => ({ ...r }));
    let matched = 0;
    const bySerial = new Map<string, PuertoLibreRegistroScanFields>();
    for (const { fields } of certVehicles) {
      const serial = normalizeSerialKey(
        fields.serialCarroceria ?? fields.vin ?? ""
      );
      if (serial) bySerial.set(serial, fields);
    }

    const rowSerials = vehicleRows.map((r) =>
      normalizeSerialKey(r.serialCarroceria || r.vin || "")
    );
    const rowToCert = pairSerialsOneToOne(rowSerials, [...bySerial.keys()]);
    const headerCert = sharedDocHeaderFields(sharedFromCert);

    for (let i = 0; i < vehicleRows.length; i++) {
      const row = vehicleRows[i]!;
      const serial = normalizeSerialKey(row.serialCarroceria || row.vin || "");
      const certKey = serial ? rowToCert.get(serial) : undefined;
      const fromCert = certKey ? bySerial.get(certKey) : undefined;
      const patch = fromCert
        ? mergeScanFields(headerCert, fromCert)
        : headerCert;
      if (Object.keys(patch).length === 0) continue;
      const merged = mergeScanFields(rowToScanFields(row), patch);
      if (fromCert) matched += 1;
      vehicleRows[i] = scanFieldsToRow(
        merged,
        row.fuente ? `${row.fuente} + cert.` : "Certificado origen",
        row.id
      );
    }

    const existingKeys = vehicleRows.map((r) =>
      normalizeSerialKey(r.serialCarroceria || r.vin || "")
    );
    let appended = 0;
    if (existingRows.length === 0) {
      for (const { fields, fileName } of certVehicles) {
        const serial = normalizeSerialKey(
          fields.serialCarroceria ?? fields.vin ?? ""
        );
        if (!serial || matchSerialKeyAmong(serial, existingKeys)) continue;
        vehicleRows.push(
          scanFieldsToRow(
            mergeScanFields(sharedDocHeaderFields(sharedFromCert), fields),
            `Certificado origen · ${fileName}`
          )
        );
        existingKeys.push(serial);
        appended += 1;
      }
    }

    const motorsFromCert = certVehicles
      .map((c) => (c.fields.serialMotor ?? "").trim())
      .filter((m) => m && m.toUpperCase() !== "POR-COMPLETAR");
    const pairsFromCert: CertEnginePair[] = certVehicles.flatMap((c) => {
      const vin = normalizeSerialKey(
        c.fields.serialCarroceria ?? c.fields.vin ?? ""
      );
      const motor = (c.fields.serialMotor ?? "").trim();
      if (!vin || !motor || motor.toUpperCase() === "POR-COMPLETAR") return [];
      return [{ vin, serialMotor: motor }];
    });
    vehicleRows = applyEngineNosByVin(vehicleRows, pairsFromCert);
    const filledRows = assignEngineNosByRowOrder(vehicleRows, motorsFromCert);
    for (let i = 0; i < vehicleRows.length; i++) {
      vehicleRows[i] = filledRows[i]!;
    }

    if (matched > 0) {
      warnings.push(
        `Se completaron ${matched} fila(s) con certificado emparejado por VIN`
      );
    }
    if (appended > 0) {
      warnings.push(
        `Se añadieron ${appended} vehículo(s) desde certificado(s) sin fila previa`
      );
    }
    if (matched === 0 && appended === 0) {
      warnings.push(
        "No hubo match por VIN; se aplicaron solo datos compartidos del certificado (origen/nº)"
      );
    }

    return {
      success: true,
      rows: validateCargaMasivaRows(vehicleRows),
      warnings,
      certMatches,
    };
  } catch (err) {
    return { success: false, error: formatLlmAuthError(err) };
  }
}

function rowToScanFields(row: CargaMasivaRow): PuertoLibreRegistroScanFields {
  return {
    marca: row.marca || undefined,
    modelo: row.modelo || undefined,
    color: row.color || undefined,
    anio: row.anio || undefined,
    serialMotor: row.serialMotor || undefined,
    vin: row.vin || undefined,
    serialCarroceria: row.serialCarroceria || undefined,
    kilometraje: row.kilometraje || undefined,
    condicion:
      row.condicion === "usado" || row.condicion === "nuevo"
        ? row.condicion
        : undefined,
    fechaLlegadaBuque: row.fechaLlegadaBuque || undefined,
    importadorNombre: row.importadorNombre || undefined,
    importadorDocumento: row.importadorDocumento || undefined,
    importadorTelefono: row.importadorTelefono || undefined,
    importadorEmail: row.importadorEmail || undefined,
    importadorDireccion: row.importadorDireccion || undefined,
    puerto: row.puerto || undefined,
    modalidadTransito:
      row.modalidadTransito === "ninguno" ||
      row.modalidadTransito === "transito" ||
      row.modalidadTransito === "uso24"
        ? row.modalidadTransito
        : undefined,
    aduanaTransito: row.aduanaTransito || undefined,
    aduana: row.aduana || undefined,
    numeroBl: row.numeroBl || undefined,
    paisOrigen: row.paisOrigen || undefined,
    valorCif: row.valorCif || undefined,
    numeroCertificadoOrigen: row.numeroCertificadoOrigen || undefined,
    observaciones: row.observaciones || undefined,
  };
}

function guessTipoFromName(name: string): string {
  const n = name.toLowerCase();
  if (/\bbl\b|bill|guia|guía|embarque|lading/.test(n)) return "bl_guia";
  if (/certificado|origin|coo|origen/.test(n)) return "certificado_origen";
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
export async function createPuertoLibreCargaMasivaAction(input: {
  importadorId: string;
  rows: CargaMasivaRow[];
  /** RIF leído en factura/BL (si hay) para certificar vs. cliente elegido. */
  detectedImportadorDocumento?: string;
}): Promise<CargaMasivaCreateResult> {
  const auth = await requireTallerAuth();
  if (auth.error || !auth.taller) {
    return { success: false, error: auth.error ?? "No autorizado" };
  }

  const importadorId = String(input.importadorId ?? "").trim();
  if (!importadorId) {
    return {
      success: false,
      error: "Selecciona el cliente importador antes de registrar",
    };
  }

  const importadorRes = await getImportadorAction(importadorId);
  if (!importadorRes.success) {
    return { success: false, error: importadorRes.error };
  }
  const importador = importadorRes.importador;

  const rows = Array.isArray(input.rows) ? input.rows : [];
  if (rows.length === 0) {
    return { success: false, error: "No hay filas para registrar" };
  }
  if (rows.length > CARGA_MASIVA_MAX_ROWS) {
    return {
      success: false,
      error: `Máximo ${CARGA_MASIVA_MAX_ROWS} vehículos por carga`,
    };
  }

  const detectedDoc =
    String(input.detectedImportadorDocumento ?? "").trim() ||
    rows.map((r) => r.importadorDocumento?.trim() ?? "").find(Boolean) ||
    "";

  if (
    detectedDoc &&
    !rifCoincideConSeleccionado(detectedDoc, importador.documento)
  ) {
    return {
      success: false,
      error: `El RIF de los documentos (${normalizeRif(detectedDoc)}) no coincide con el cliente seleccionado (${importador.documento}). Elige el importador correcto.`,
    };
  }

  const withImportador = rows.map((r) => ({
    ...r,
    importadorNombre: importador.nombre,
    importadorDocumento: importador.documento,
    importadorTelefono: importador.telefono ?? r.importadorTelefono,
    importadorEmail: importador.email ?? r.importadorEmail,
    importadorDireccion: importador.direccion ?? r.importadorDireccion,
  }));

  const validated = validateCargaMasivaRows(withImportador);

  // Registrable = VIN válido (rojo/ámbar/verde). Sin VIN → omitidos.
  const aptos = validated.filter((r) => vehicleSemaforo(r).registrable);
  const omitidos = validated.filter((r) => !vehicleSemaforo(r).registrable);
  if (aptos.length === 0) {
    const ejemplos = omitidos
      .slice(0, 3)
      .map((r) => {
        const s = vehicleSemaforo(r);
        const id = (r.vin || r.serialCarroceria || "?").slice(0, 17);
        return `${id}: ${s.detail}`;
      })
      .join("; ");
    return {
      success: false,
      error: `Ningún vehículo tiene VIN válido para crear expediente. ${ejemplos}`,
    };
  }

  const invalid = aptos.filter((r) => r.error && !vehicleSemaforo(r).registrable);
  if (invalid.length > 0) {
    return {
      success: false,
      error: `Hay ${invalid.length} fila(s) con error de VIN. Corrige o elimínalas.`,
    };
  }

  const esPersonaNatural =
    importador.tipo === "natural" ||
    clasificarTipoImportadorPorRif(importador.documento) === "natural";

  if (esPersonaNatural && aptos.length > 1) {
    return {
      success: false,
      error:
        `Persona natural (RIF V/E): máximo 1 vehículo cada 3 años. ` +
        `Tienes ${aptos.length} filas listas. Para registrar un lote completo, ` +
        `selecciona un importador jurídico (J/G/C/P).`,
    };
  }

  const admin = createAdminClient();
  const tallerId = auth.taller.id;

  if (esPersonaNatural) {
    const cupoPrevio = await evaluarCupoPersonaNatural({
      admin,
      tallerId,
      importadorDocumento: importador.documento,
      fechaReferenciaNueva: aptos[0]?.fechaLlegadaBuque || null,
      regimen: "puerto_libre",
    });
    if (!cupoPrevio.ok) {
      return { success: false, error: cupoPrevio.error };
    }
  }

  const { year, month } = partsFromDate();
  let nextNumero = await nextNumeroExpedienteMes(admin, tallerId, year, month);

  const created: {
    vehiculoId: string;
    codigoExpediente: string;
    serial: string;
  }[] = [];
  const failed: { index: number; serial: string; error: string }[] = [];

  for (let i = 0; i < aptos.length; i++) {
    const row = aptos[i]!;
    const sem = vehicleSemaforo(row);
    // Se crea el expediente aunque falten datos; placeholders + semáforo en importacion
    const rowForAlta = {
      ...row,
      marca: placeholderOValor(row.marca),
      modelo: placeholderOValor(row.modelo),
      color: row.color.trim() || "POR-COMPLETAR",
      serialMotor: row.serialMotor.trim() || "POR-COMPLETAR",
      anio: row.anio.trim() || String(new Date().getFullYear()),
    };
    const parsed = cargaMasivaRowToAltaInput(rowForAlta);
    if (!parsed.ok) {
      failed.push({ index: i, serial: row.serialCarroceria, error: parsed.error });
      continue;
    }

    const result = await insertOneVehiculo({
      admin,
      tallerId,
      data: { ...parsed.data, importadorId: importador.id },
      year,
      month,
      numero: nextNumero,
      importadorIdLocked: importador.id,
      completitudDatos: sem.nivel,
      datosPendientes: [...sem.criticos, ...sem.avisos],
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

  revalidatePath("/smartimport");

  if (created.length > 0) {
    const fromRow = ultimoImportadorFromAlta({
      importadorNombre: importador.nombre,
      importadorDocumento: importador.documento,
      importadorTelefono: importador.telefono,
      importadorEmail: importador.email,
      importadorDireccion: importador.direccion,
    });
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
  /** Si viene, se usa ese importador (ya verificado) sin ensure por RIF. */
  importadorIdLocked?: string;
  completitudDatos?: "rojo" | "ambar" | "verde";
  datosPendientes?: string[];
}): Promise<
  | { ok: true; vehiculoId: string; codigoExpediente: string }
  | { ok: false; error: string }
> {
  const {
    admin,
    tallerId,
    data,
    year,
    month,
    numero,
    importadorIdLocked,
    completitudDatos,
    datosPendientes,
  } = params;
  const serialCarroceria = normalizarSerialCarroceria(data.serialCarroceria);
  const serialMotor = normalizarSerialCarroceria(data.serialMotor);

  if (!data.importadorNombre?.trim() || !data.importadorDocumento?.trim()) {
    return {
      ok: false,
      error: "Carga masiva requiere nombre y RIF del cliente importador",
    };
  }

  let importadorId = importadorIdLocked?.trim() || data.importadorId?.trim() || "";
  if (!importadorId) {
    const ensured = await ensureImportadorForTaller({
      tallerId,
      nombre: data.importadorNombre,
      documento: data.importadorDocumento,
      telefono: data.importadorTelefono,
      email: data.importadorEmail,
      direccion: data.importadorDireccion,
    });
    if (!ensured.ok) return { ok: false, error: ensured.error };
    importadorId = ensured.importadorId;
  }

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
    regimen: data.regimen,
  });
  if (!cupo.ok) {
    return { ok: false, error: cupo.error };
  }

  const codigoExpediente = formatCodigoExpediente(year, month, numero);
  const placa = placaPendienteDesdeCodigo(codigoExpediente);

  const importacion = serializeImportacion({
    importadorId,
    regimen: data.regimen,
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
    puerto: data.puerto || null,
    modalidadTransito: data.modalidadTransito || null,
    aduanaTransito: data.aduanaTransito || null,
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
    estadoNacionalizacion:
      data.regimen === "puerto_libre" ? "pendiente" : "no_aplica",
    estadoSeniat: "pendiente",
    planillaFase: 1,
    codigoExpediente,
    completitudDatos: completitudDatos ?? null,
    datosPendientes:
      datosPendientes && datosPendientes.length > 0 ? datosPendientes : null,
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
