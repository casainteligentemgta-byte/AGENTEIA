"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUser } from "@/lib/supabase/server";
import { getMyTaller } from "@/lib/taller";
import { formatLlmAuthError, isLlmConfigured } from "@/lib/ai/openai-config";
import { resolveImageMimeType } from "@/lib/mime-image";
import { extractSerialImprontaFromImage } from "@/lib/extract-impronta";
import {
  parseImportacion,
  serializeImportacion,
} from "@/lib/schemas/vehiculo-documentos";
import {
  compactarSerial,
  serialesCoinciden,
} from "@/lib/vehicles/serial";
import { validateVehiculoDocumentoFile } from "@/lib/vehiculos/upload-documento";

export type ImprontaVerifyResult =
  | {
      success: true;
      estado: "coincide" | "no_coincide" | "no_leido";
      expected: string;
      leido: string | null;
      message: string;
    }
  | { success: false; error: string };

export async function verifyPuertoLibreImprontaAction(
  formData: FormData
): Promise<ImprontaVerifyResult> {
  const user = await getUser();
  if (!user) return { success: false, error: "No autenticado" };

  const taller = await getMyTaller();
  if (!taller) return { success: false, error: "No se encontró tu taller" };

  if (!isLlmConfigured()) {
    return {
      success: false,
      error: "Falta GEMINI_API_KEY (gratis) u OPENAI_API_KEY para verificar la impronta.",
    };
  }

  const vehiculoId = String(formData.get("vehiculoId") ?? "").trim();
  const file = formData.get("file");
  if (!vehiculoId) return { success: false, error: "Vehículo inválido" };
  if (!(file instanceof File)) {
    return { success: false, error: "Selecciona una foto de la impronta" };
  }
  if (file.type === "application/pdf" || /\.pdf$/i.test(file.name)) {
    return {
      success: false,
      error: "Para verificar el serial usa una foto (JPG/PNG), no PDF.",
    };
  }

  const validationError = validateVehiculoDocumentoFile(file);
  if (validationError) return { success: false, error: validationError };

  const admin = createAdminClient();
  const { data: row } = await admin
    .from("vehiculos")
    .select("id, taller_id, serial_carroceria, importacion")
    .eq("id", vehiculoId)
    .maybeSingle();

  if (!row || row.taller_id !== taller.id) {
    return { success: false, error: "Vehículo no encontrado" };
  }

  const expected = compactarSerial(String(row.serial_carroceria ?? ""));
  if (!expected) {
    return {
      success: false,
      error:
        "El expediente no tiene serial de carrocería precargado. Complétalo en Registro antes de verificar.",
    };
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const mimeType =
      resolveImageMimeType({
        declaredMime: file.type,
        fileName: file.name,
        buffer,
      }) ?? "image/jpeg";

    const extracted = await extractSerialImprontaFromImage(buffer, mimeType);
    const leido = extracted.serial_carroceria
      ? compactarSerial(extracted.serial_carroceria)
      : null;

    let estado: "coincide" | "no_coincide" | "no_leido";
    let message: string;

    if (!leido) {
      estado = "no_leido";
      message =
        "No se pudo leer el serial en la foto. Toma otra más nítida y de frente a la impronta.";
    } else if (serialesCoinciden(leido, expected)) {
      estado = "coincide";
      message = `Serial verificado: coincide con el del expediente (${expected}).`;
    } else {
      estado = "no_coincide";
      message = `El serial leído (${leido}) no coincide con el precargado (${expected}). Revisa la foto o el expediente.`;
    }

    const existing = parseImportacion(row.importacion);
    const importacion = serializeImportacion({
      ...existing,
      serialImprontaEstado: estado,
      serialImprontaLeido: leido,
      serialImprontaVerificadoAt: new Date().toISOString(),
    });

    await admin
      .from("vehiculos")
      .update({
        importacion,
        updated_at: new Date().toISOString(),
      })
      .eq("id", vehiculoId)
      .eq("taller_id", taller.id);

    revalidatePath(`/importacion/${vehiculoId}`);
    revalidatePath(`/importacion/${vehiculoId}/planilla`);

    return {
      success: true,
      estado,
      expected,
      leido,
      message,
    };
  } catch (err) {
    return { success: false, error: formatLlmAuthError(err) };
  }
}
