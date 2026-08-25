"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireTallerAuth } from "@/lib/importacion/taller-auth";
import { isLlmConfigured } from "@/lib/ai/openai-config";
import {
  assertLlmBudgetAllows,
  bindLlmUsageContext,
} from "@/lib/ai/llm-usage";
import { resolveImageMimeType } from "@/lib/mime-image";
import type { CargaMasivaStorageDocRef } from "@/lib/importacion/carga-masiva-client";
import {
  extractVehiculosFromPdfs,
  type PdfDocInput,
  type PdfVehiculoExtractResult,
} from "@/lib/importacion/pdf-vehiculo-extract-module";
import {
  validateVehiculoDocumentoFile,
  VEHICULO_DOCS_BUCKET,
} from "@/lib/vehiculos/upload-documento";

const MAX_BYTES = 10 * 1024 * 1024;
const MAX_CERTS = 20;

export type ExtractVehiculosPdfActionResult =
  | ({ success: true } & PdfVehiculoExtractResult)
  | { success: false; error: string };

function resolveDocMime(fileName: string, declared: string, buffer: Buffer): string {
  if (declared === "application/pdf" || /\.pdf$/i.test(fileName)) {
    return "application/pdf";
  }
  return (
    resolveImageMimeType({
      declaredMime: declared,
      fileName,
      buffer,
    }) ?? "image/jpeg"
  );
}

async function loadBufferFromStorage(
  tallerId: string,
  ref: CargaMasivaStorageDocRef
): Promise<{ ok: true; doc: PdfDocInput } | { ok: false; error: string }> {
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
  if (validationError) return { ok: false, error: validationError };
  return {
    ok: true,
    doc: {
      buffer,
      mimeType: resolveDocMime(fileName, file.type, buffer),
      fileName,
    },
  };
}

async function loadFileFromForm(
  file: File
): Promise<{ ok: true; doc: PdfDocInput } | { ok: false; error: string }> {
  if (file.size > MAX_BYTES) {
    return { ok: false, error: "El archivo supera 10 MB" };
  }
  const validationError = validateVehiculoDocumentoFile(file);
  if (validationError) return { ok: false, error: validationError };
  const buffer = Buffer.from(await file.arrayBuffer());
  return {
    ok: true,
    doc: {
      buffer,
      mimeType: resolveDocMime(file.name, file.type, buffer),
      fileName: file.name,
    },
  };
}

function parseStorageRefs(raw: string): CargaMasivaStorageDocRef[] | null {
  if (!raw.trim()) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return null;
    return parsed as CargaMasivaStorageDocRef[];
  } catch {
    return null;
  }
}

/**
 * Extracción unificada factura + certificados → DTO con semáforo.
 *
 * FormData (elige una vía por documento):
 * - factura: file "factura" | storage "facturaStorage" JSON {path,fileName}
 * - certificados: files "certificados" | storage "certificadosStorage" JSON array
 *
 * Auth: sesión + taller. Presupuesto LLM obligatorio si hay clave configurada.
 * Asume RLS en Storage vía path `${tallerId}/…` (service role solo descarga rutas del taller).
 */
export async function extractVehiculosPdfAction(
  formData: FormData
): Promise<ExtractVehiculosPdfActionResult> {
  const auth = await requireTallerAuth();
  if (auth.error || !auth.taller) {
    return { success: false, error: auth.error ?? "No autorizado" };
  }

  if (isLlmConfigured()) {
    const budget = await assertLlmBudgetAllows(auth.taller.id);
    if (!budget.ok) return { success: false, error: budget.error };
  }

  bindLlmUsageContext({
    action: "ocr_pdf_vehiculo_extract",
    tallerId: auth.taller.id,
    userId: auth.user.id,
  });

  let factura: PdfDocInput | null = null;
  const facturaStorageRaw = String(formData.get("facturaStorage") ?? "").trim();
  if (facturaStorageRaw) {
    let ref: CargaMasivaStorageDocRef | null = null;
    try {
      ref = JSON.parse(facturaStorageRaw) as CargaMasivaStorageDocRef;
    } catch {
      return { success: false, error: "facturaStorage JSON inválido" };
    }
    const loaded = await loadBufferFromStorage(auth.taller.id, ref);
    if (!loaded.ok) return { success: false, error: loaded.error };
    factura = loaded.doc;
  } else {
    const file = formData.get("factura");
    if (file instanceof File && file.size > 0) {
      const loaded = await loadFileFromForm(file);
      if (!loaded.ok) return { success: false, error: loaded.error };
      factura = loaded.doc;
    }
  }

  const certificados: PdfDocInput[] = [];
  const certsStorageRaw = String(formData.get("certificadosStorage") ?? "").trim();
  if (certsStorageRaw) {
    const refs = parseStorageRefs(certsStorageRaw);
    if (!refs) {
      return { success: false, error: "certificadosStorage JSON inválido" };
    }
    if (refs.length > MAX_CERTS) {
      return {
        success: false,
        error: `Máximo ${MAX_CERTS} certificados por extracción`,
      };
    }
    for (const ref of refs) {
      const loaded = await loadBufferFromStorage(auth.taller.id, ref);
      if (!loaded.ok) return { success: false, error: loaded.error };
      certificados.push(loaded.doc);
    }
  } else {
    const files = formData.getAll("certificados").filter((f): f is File => f instanceof File);
    if (files.length > MAX_CERTS) {
      return {
        success: false,
        error: `Máximo ${MAX_CERTS} certificados por extracción`,
      };
    }
    for (const file of files) {
      if (file.size === 0) continue;
      const loaded = await loadFileFromForm(file);
      if (!loaded.ok) return { success: false, error: loaded.error };
      certificados.push(loaded.doc);
    }
  }

  if (!factura && certificados.length === 0) {
    return {
      success: false,
      error: "Selecciona una factura y/o al menos un certificado PDF",
    };
  }

  try {
    const extracted = await extractVehiculosFromPdfs({
      factura,
      certificados,
    });
    const result = await reinforceWithAgentPackage(extracted);
    if (result.status === "error") {
      return {
        success: false,
        error: result.errores[0] ?? "No se pudo extraer datos del PDF",
      };
    }
    return { success: true, ...result };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Error al extraer PDFs";
    return { success: false, error: message };
  }
}
