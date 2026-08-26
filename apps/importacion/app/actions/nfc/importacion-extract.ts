"use server";

import { getUser } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getMyTaller } from "@/lib/taller";
import { isLlmConfigured, formatLlmAuthError } from "@/lib/ai/openai-config";
import {
  assertLlmBudgetAllows,
  bindLlmUsageContext,
} from "@/lib/ai/llm-usage";
import { resolveImageMimeType } from "@/lib/mime-image";
import {
  blToFormFields,
  countFilledFields,
  extractBlFromDocument,
  extractCertificadoOrigenMultiFromDocument,
  extractFacturaMultiFromDocument,
  extractFacturaRapidoFromDocument,
  extractPolizaTransporteFromDocument,
  mergeScanFields,
  polizaToFormFields,
  type PuertoLibreRegistroScanFields,
} from "@/lib/extract-puerto-libre-docs";
import type { CargaMasivaStorageDocRef } from "@/lib/importacion/carga-masiva-client";
import {
  emptyCargaMasivaRow,
  type CargaMasivaRow,
} from "@/lib/importacion/carga-masiva-template";
import {
  validateVehiculoDocumentoFile,
  VEHICULO_DOCS_BUCKET,
} from "@/lib/vehiculos/upload-documento";

export type ExtractPuertoLibreDocResult =
  | {
      success: true;
      tipo:
        | "factura_comercial"
        | "bl_guia"
        | "certificado_origen"
        | "poliza_transporte";
      fields: PuertoLibreRegistroScanFields;
      filledCount: number;
      /** Factura con varias unidades (hoja anexa / carátula multi). */
      multi?: false;
      warning?: string;
    }
  | {
      success: true;
      tipo: "factura_comercial";
      fields: PuertoLibreRegistroScanFields;
      filledCount: number;
      multi: true;
      rows: CargaMasivaRow[];
      vehicleCount: number;
      warning?: string;
    }
  | {
      success: true;
      tipo: "certificado_origen";
      fields: PuertoLibreRegistroScanFields;
      filledCount: number;
      multi?: false;
      warning?: string;
    }
  | {
      success: true;
      tipo: "certificado_origen";
      fields: PuertoLibreRegistroScanFields;
      filledCount: number;
      multi: true;
      rows: CargaMasivaRow[];
      vehicleCount: number;
      warning?: string;
    }
  | { success: false; error: string };

const MAX_BYTES = 10 * 1024 * 1024;

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

function scanFieldsToRow(
  fields: PuertoLibreRegistroScanFields,
  fuente: string
): CargaMasivaRow {
  const serial = fields.serialCarroceria ?? fields.vin ?? "";
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

/** PDF con varios VIN: si el extractor rápido deja una sola fila, usa la pasada completa. */
async function extractFacturaAutofill(buffer: Buffer, mimeType: string) {
  const isPdf = mimeType.toLowerCase().includes("pdf");
  const rapido = await extractFacturaRapidoFromDocument(buffer, mimeType);
  if (rapido.vehiculos.length > 1 || !isPdf) return rapido;
  const full = await extractFacturaMultiFromDocument(buffer, mimeType);
  return full.vehiculos.length > rapido.vehiculos.length ? full : rapido;
}

type LoadedOcrDoc = { file: File; buffer: Buffer; mimeType: string };

/**
 * Carga el documento desde Storage (recomendado) o desde FormData file (legacy).
 * Storage evita enviar PDFs grandes por fetch/Server Action (Safari: Load failed).
 */
async function loadOcrDocFromForm(
  formData: FormData,
  tallerId: string
): Promise<{ ok: true; doc: LoadedOcrDoc } | { ok: false; error: string }> {
  const storageRaw = String(formData.get("storageDocs") ?? "").trim();
  if (storageRaw) {
    let refs: CargaMasivaStorageDocRef[] = [];
    try {
      const parsed = JSON.parse(storageRaw) as unknown;
      if (!Array.isArray(parsed) || parsed.length === 0) {
        return { ok: false, error: "storageDocs inválido" };
      }
      refs = parsed as CargaMasivaStorageDocRef[];
    } catch {
      return { ok: false, error: "storageDocs JSON inválido" };
    }
    const ref = refs[0]!;
    const path = String(ref.path ?? "");
    const prefix = `${tallerId}/`;
    if (!path.startsWith(prefix) || path.includes("..")) {
      return { ok: false, error: "Ruta de documento no autorizada" };
    }
    const admin = createAdminClient();
    const { data, error } = await admin.storage
      .from(VEHICULO_DOCS_BUCKET)
      .download(path);
    if (error || !data) {
      return {
        ok: false,
        error: `No se pudo leer el documento de Storage (${error?.message ?? "sin datos"})`,
      };
    }
    const buffer = Buffer.from(await data.arrayBuffer());
    if (buffer.byteLength > MAX_BYTES) {
      return { ok: false, error: "El archivo supera 10 MB" };
    }
    const fileName = ref.fileName || path.split("/").pop() || "documento.pdf";
    const file = new File([buffer], fileName, {
      type: data.type || "application/pdf",
    });
    const validationError = validateVehiculoDocumentoFile(file);
    if (validationError) {
      return { ok: false, error: validationError };
    }
    return {
      ok: true,
      doc: { file, buffer, mimeType: resolveDocMime(file, buffer) },
    };
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return {
      ok: false,
      error: "Selecciona una foto o un PDF del documento",
    };
  }
  if (file.size > MAX_BYTES) {
    return { ok: false, error: "El archivo supera 10 MB" };
  }
  const validationError = validateVehiculoDocumentoFile(file);
  if (validationError) {
    return { ok: false, error: validationError };
  }
  const buffer = Buffer.from(await file.arrayBuffer());
  return {
    ok: true,
    doc: { file, buffer, mimeType: resolveDocMime(file, buffer) },
  };
}

export async function extractPuertoLibreDocumentoAction(
  formData: FormData
): Promise<ExtractPuertoLibreDocResult> {
  const user = await getUser();
  if (!user) return { success: false, error: "No autenticado" };

  const taller = await getMyTaller();
  if (!taller) return { success: false, error: "No se encontró tu taller" };

  if (!isLlmConfigured()) {
    return {
      success: false,
      error: "Falta GEMINI_API_KEY (gratis) u OPENAI_API_KEY para leer documentos con IA.",
    };
  }

  const budget = await assertLlmBudgetAllows(taller.id);
  if (!budget.ok) return { success: false, error: budget.error };

  const tipoRaw = String(formData.get("tipo") ?? "").trim();
  bindLlmUsageContext({
    action: `ocr_${tipoRaw || "doc"}`,
    tallerId: taller.id,
    userId: user.id,
  });

  if (
    tipoRaw !== "factura_comercial" &&
    tipoRaw !== "bl_guia" &&
    tipoRaw !== "certificado_origen" &&
    tipoRaw !== "poliza_transporte"
  ) {
    return { success: false, error: "Tipo de documento inválido" };
  }

  const loaded = await loadOcrDocFromForm(formData, taller.id);
  if (!loaded.ok) return { success: false, error: loaded.error };

  try {
    const { file, buffer, mimeType } = loaded.doc;

    if (tipoRaw === "factura_comercial") {
      const extracted = await extractFacturaAutofill(buffer, mimeType);
      if (extracted.vehiculos.length > 1) {
        const rows = extracted.vehiculos.map((v, i) => {
          const merged = mergeScanFields(extracted.shared, v);
          if (v.valorCif) merged.valorCif = v.valorCif;
          else delete merged.valorCif;
          return scanFieldsToRow(
            merged,
            `Hoja anexa · unidad ${i + 1} · ${file.name}`
          );
        });
        const first = mergeScanFields(
          extracted.shared,
          extracted.vehiculos[0] ?? {}
        );
        return {
          success: true,
          tipo: "factura_comercial",
          multi: true,
          rows,
          vehicleCount: rows.length,
          fields: first,
          filledCount: rows.length,
        };
      }

      const only = extracted.vehiculos[0];
      const fields = only
        ? mergeScanFields(extracted.shared, only)
        : extracted.shared;
      const filledCount = countFilledFields(fields);
      if (filledCount === 0) {
        return {
          success: false,
          error:
            "No se pudieron leer VIN ni datos de la factura. Reintenta con una foto más nítida o abre carga masiva.",
        };
      }
      return {
        success: true,
        tipo: "factura_comercial",
        fields,
        filledCount,
        multi: false,
      };
    }

    if (tipoRaw === "certificado_origen") {
      const extracted = await extractCertificadoOrigenMultiFromDocument(
        buffer,
        mimeType
      );
      if (extracted.vehiculos.length > 1) {
        const rows = extracted.vehiculos.map((v, i) => {
          const merged = mergeScanFields(extracted.shared, v);
          return scanFieldsToRow(
            merged,
            `Certificado origen · unidad ${i + 1} · ${file.name}`
          );
        });
        const first = mergeScanFields(
          extracted.shared,
          extracted.vehiculos[0] ?? {}
        );
        return {
          success: true,
          tipo: "certificado_origen",
          multi: true,
          rows,
          vehicleCount: rows.length,
          fields: first,
          filledCount: rows.length,
        };
      }

      const first = extracted.vehiculos[0] ?? {};
      const fields = mergeScanFields(extracted.shared, first);
      const filledCount = countFilledFields(fields);
      if (filledCount === 0) {
        return {
          success: false,
          error:
            "No se pudieron leer datos del certificado. El archivo se guarda igual: reintenta o ábrelo en carga masiva.",
        };
      }
      return {
        success: true,
        tipo: "certificado_origen",
        fields,
        filledCount,
        multi: false,
      };
    }

    if (tipoRaw === "poliza_transporte") {
      const extracted = await extractPolizaTransporteFromDocument(
        buffer,
        mimeType
      );
      const fields = polizaToFormFields(extracted);
      const filledCount = countFilledFields(fields);
      if (filledCount === 0) {
        return {
          success: false,
          error:
            "No se pudieron leer datos de la póliza de transporte. Prueba con una foto más nítida o completa los campos a mano.",
        };
      }
      return { success: true, tipo: "poliza_transporte", fields, filledCount };
    }

    const extracted = await extractBlFromDocument(buffer, mimeType);
    const fields = blToFormFields(extracted);
    const filledCount = countFilledFields(fields);
    if (filledCount === 0) {
      return {
        success: false,
        error:
          "No se pudieron leer datos del BL. Prueba con una foto más nítida o completa los campos a mano.",
      };
    }
    return { success: true, tipo: "bl_guia", fields, filledCount };
  } catch (err) {
    return { success: false, error: formatLlmAuthError(err) };
  }
}
