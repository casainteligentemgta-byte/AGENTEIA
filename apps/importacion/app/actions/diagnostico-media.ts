"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient, getUser } from "@/lib/supabase/server";
import { uploadDiagnosticoFiles } from "@/lib/diagnostico/upload";
import {
  MAX_DIAGNOSTICO_FILES_PER_UPLOAD,
  mergeMediaIntoDetalle,
} from "@/lib/schemas/diagnostico-media";
import { parseDetalleRevision } from "@/lib/schemas/categoria-vehiculo";
import { getMyTaller } from "@/lib/taller";

export type DiagnosticoMediaActionResult =
  | { success: true; added: number }
  | { success: false; error: string };

function filesFromFormData(formData: FormData): File[] {
  return formData
    .getAll("media")
    .filter((entry): entry is File => entry instanceof File && entry.size > 0);
}

export async function uploadDiagnosticoMediaAction(
  mantenimientoId: string,
  formData: FormData
): Promise<DiagnosticoMediaActionResult> {
  const user = await getUser();
  if (!user) return { success: false, error: "Debes iniciar sesión" };

  const taller = await getMyTaller();
  if (!taller) return { success: false, error: "No se encontró tu taller" };

  const files = filesFromFormData(formData);
  if (files.length === 0) {
    return { success: false, error: "Selecciona al menos una foto o video" };
  }
  if (files.length > MAX_DIAGNOSTICO_FILES_PER_UPLOAD) {
    return {
      success: false,
      error: `Máximo ${MAX_DIAGNOSTICO_FILES_PER_UPLOAD} archivos por envío`,
    };
  }

  const supabase = createClient();
  const { data: mantenimiento, error: fetchError } = await supabase
    .from("mantenimientos")
    .select("id, vehiculo_id, taller_id, detalle_revision")
    .eq("id", mantenimientoId)
    .maybeSingle();

  if (fetchError || !mantenimiento || mantenimiento.taller_id !== taller.id) {
    return { success: false, error: "Mantenimiento no encontrado en tu taller" };
  }

  const admin = createAdminClient();
  const { items, errors } = await uploadDiagnosticoFiles(admin, {
    tallerId: taller.id,
    mantenimientoId,
    files,
  });

  if (items.length === 0) {
    return { success: false, error: errors[0] ?? "No se pudo subir ningún archivo" };
  }

  const detalleActual = parseDetalleRevision(mantenimiento.detalle_revision) as Record<
    string,
    unknown
  >;
  const nuevoDetalle = mergeMediaIntoDetalle(detalleActual, items);

  const { error: updateError } = await admin
    .from("mantenimientos")
    .update({ detalle_revision: nuevoDetalle })
    .eq("id", mantenimientoId);

  if (updateError) {
    return { success: false, error: updateError.message };
  }

  revalidatePath("/dashboard/mantenimientos");
  if (mantenimiento.vehiculo_id) {
    revalidatePath(`/dashboard/vehiculos/${mantenimiento.vehiculo_id}`);
    revalidatePath(`/app/vehiculos/${mantenimiento.vehiculo_id}`);
    revalidatePath("/app/timeline");
  }

  return {
    success: true,
    added: items.length,
  };
}

export async function uploadDiagnosticoMediaFromForm(
  formData: FormData
): Promise<DiagnosticoMediaActionResult> {
  const mantenimientoId = String(formData.get("mantenimientoId") ?? "");
  if (!mantenimientoId) {
    return { success: false, error: "ID de mantenimiento requerido" };
  }
  return uploadDiagnosticoMediaAction(mantenimientoId, formData);
}
