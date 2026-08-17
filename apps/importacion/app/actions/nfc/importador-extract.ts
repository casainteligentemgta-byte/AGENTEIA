"use server";

import { getUser } from "@/lib/supabase/server";
import { getMyTaller } from "@/lib/taller";
import { isLlmConfigured, formatLlmAuthError } from "@/lib/ai/openai-config";
import {
  assertLlmBudgetAllows,
  bindLlmUsageContext,
} from "@/lib/ai/llm-usage";
import { resolveImageMimeType } from "@/lib/mime-image";
import {
  cedulaToImportadorFields,
  countFilledScanFields,
  extractCedulaVeFromDocument,
  extractRifFromDocument,
  rifToImportadorFields,
  type ImportadorScanFields,
} from "@/lib/extract-identidad-ve";
import type { ImportadorTipo } from "@/lib/schemas/importador";
import { validateVehiculoDocumentoFile } from "@/lib/vehiculos/upload-documento";

export type ExtractImportadorDocResult =
  | {
      success: true;
      tipoDoc: "rif" | "cedula";
      fields: ImportadorScanFields;
      filledCount: number;
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

export async function extractImportadorDocumentoAction(
  formData: FormData
): Promise<ExtractImportadorDocResult> {
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

  const tipoDoc = String(formData.get("tipoDoc") ?? "").trim();
  bindLlmUsageContext({
    action: `ocr_importador_${tipoDoc || "doc"}`,
    tallerId: taller.id,
    userId: user.id,
  });

  if (tipoDoc !== "rif" && tipoDoc !== "cedula") {
    return { success: false, error: "Tipo de documento inválido" };
  }

  const tipoClienteRaw = String(formData.get("tipoCliente") ?? "natural").trim();
  const tipoCliente: ImportadorTipo =
    tipoClienteRaw === "juridica" ? "juridica" : "natural";

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return { success: false, error: "Selecciona una foto o un PDF del documento" };
  }

  if (file.size > MAX_BYTES) {
    return { success: false, error: "El archivo supera 10 MB" };
  }

  const validationError = validateVehiculoDocumentoFile(file);
  if (validationError) {
    return { success: false, error: validationError };
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const mimeType = resolveDocMime(file, buffer);

    if (tipoDoc === "rif") {
      const extracted = await extractRifFromDocument(buffer, mimeType);
      const fields = rifToImportadorFields(extracted);
      const filledCount = countFilledScanFields(fields);
      if (filledCount === 0) {
        return {
          success: false,
          error:
            "No se pudieron leer datos del RIF. Prueba con una foto más nítida o completa los campos a mano.",
        };
      }
      return { success: true, tipoDoc: "rif", fields, filledCount };
    }

    const extracted = await extractCedulaVeFromDocument(buffer, mimeType);
    const fields = cedulaToImportadorFields(extracted, tipoCliente);
    const filledCount = countFilledScanFields(fields);
    if (filledCount === 0) {
      return {
        success: false,
        error:
          "No se pudieron leer datos de la cédula. Prueba con una foto más nítida o completa los campos a mano.",
      };
    }
    return { success: true, tipoDoc: "cedula", fields, filledCount };
  } catch (err) {
    return { success: false, error: formatLlmAuthError(err) };
  }
}
