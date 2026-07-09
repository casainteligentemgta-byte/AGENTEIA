"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { getUser } from "@/lib/supabase/server";
import { ensureTallerForUser } from "@/lib/taller";
import {
  extractCedulaFromImage,
  extractTituloPropiedadFromImage,
  type CedulaExtraida,
  type TituloPropiedadExtraido,
} from "@/lib/extract-documento";
import type { VehiculoDocumentoRef } from "@/lib/schemas/vehiculo-documentos";
import { uploadVehiculoDocumento, validateVehiculoDocumentoFile } from "@/lib/vehiculos/upload-documento";

export type ScanDocumentoVehiculoResult =
  | {
      ok: true;
      tipo: "cedula";
      extraction: CedulaExtraida;
      documento: VehiculoDocumentoRef;
    }
  | {
      ok: true;
      tipo: "titulo";
      extraction: TituloPropiedadExtraido;
      documento: VehiculoDocumentoRef;
    }
  | { ok: false; error: string };

export async function scanDocumentoVehiculoAction(
  formData: FormData
): Promise<ScanDocumentoVehiculoResult> {
  const user = await getUser();
  if (!user) return { ok: false, error: "No autenticado" };

  const { taller } = await ensureTallerForUser(user.id);
  if (!taller) return { ok: false, error: "No se encontró tu taller" };

  const tipo = formData.get("tipo");
  const file = formData.get("file");

  if (tipo !== "cedula" && tipo !== "titulo") {
    return { ok: false, error: "Tipo de documento inválido" };
  }
  if (!(file instanceof File)) {
    return { ok: false, error: "Selecciona una imagen del documento" };
  }

  const validationError = validateVehiculoDocumentoFile(file);
  if (validationError) {
    return { ok: false, error: validationError };
  }

  if (file.type === "application/pdf") {
    return {
      ok: false,
      error: "Por ahora escanea una foto del documento (JPG o PNG). PDF próximamente.",
    };
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const supabase = createAdminClient();

    const documento = await uploadVehiculoDocumento(supabase, {
      tallerId: taller.id,
      vehiculoId: "temp",
      tipo,
      file,
    });

    if (tipo === "cedula") {
      const extraction = await extractCedulaFromImage(buffer, file.type);
      return { ok: true, tipo: "cedula", extraction, documento };
    }

    const extraction = await extractTituloPropiedadFromImage(buffer, file.type);
    return { ok: true, tipo: "titulo", extraction, documento };
  } catch (err) {
    const message = err instanceof Error ? err.message : "No se pudo leer el documento";
    return { ok: false, error: message };
  }
}
