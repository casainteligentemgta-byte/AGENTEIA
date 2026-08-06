"use server";

import { getUser } from "@/lib/supabase/server";
import { getMyTaller } from "@/lib/taller";
import { isLlmConfigured, formatLlmAuthError } from "@/lib/ai/openai-config";
import { resolveImageMimeType } from "@/lib/mime-image";
import {
  blToFormFields,
  countFilledFields,
  extractBlFromDocument,
  extractFacturaComercialFromDocument,
  facturaToFormFields,
  type PuertoLibreRegistroScanFields,
} from "@/lib/extract-puerto-libre-docs";
import { validateVehiculoDocumentoFile } from "@/lib/vehiculos/upload-documento";

export type ExtractPuertoLibreDocResult =
  | {
      success: true;
      tipo: "factura_comercial" | "bl_guia";
      fields: PuertoLibreRegistroScanFields;
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
      error: "Falta configurar OPENAI_API_KEY para leer documentos con IA.",
    };
  }

  const tipoRaw = String(formData.get("tipo") ?? "").trim();
  if (tipoRaw !== "factura_comercial" && tipoRaw !== "bl_guia") {
    return { success: false, error: "Tipo de documento inválido" };
  }

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

    if (tipoRaw === "factura_comercial") {
      const extracted = await extractFacturaComercialFromDocument(buffer, mimeType);
      const fields = facturaToFormFields(extracted);
      const filledCount = countFilledFields(fields);
      if (filledCount === 0) {
        return {
          success: false,
          error:
            "No se pudieron leer datos de la factura. Prueba con una foto más nítida o completa los campos a mano.",
        };
      }
      return { success: true, tipo: "factura_comercial", fields, filledCount };
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
