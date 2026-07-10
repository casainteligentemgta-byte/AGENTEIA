"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { getUser } from "@/lib/supabase/server";
import { ensureTallerForUser } from "@/lib/taller";
import { ESTADO_VISUAL_VISTAS } from "@/lib/schemas/estado-visual-recepcion";
import {
  uploadEstadoVisualFoto,
  validateEstadoVisualFile,
  type EstadoVisualFotoRef,
} from "@/lib/ordenes-recepcion/upload-estado-visual";

export type UploadEstadoVisualFotoResult =
  | { ok: true; foto: EstadoVisualFotoRef & { vista: string } }
  | { ok: false; error: string };

export async function uploadEstadoVisualFotoAction(
  formData: FormData
): Promise<UploadEstadoVisualFotoResult> {
  const user = await getUser();
  if (!user) return { ok: false, error: "No autenticado" };

  const { taller } = await ensureTallerForUser(user.id);
  if (!taller) return { ok: false, error: "No se encontró tu taller" };

  const vista = formData.get("vista");
  const file = formData.get("file");
  const vehiculoIdRaw = formData.get("vehiculoId");
  const vehiculoId =
    typeof vehiculoIdRaw === "string" && vehiculoIdRaw.length > 0 ? vehiculoIdRaw : undefined;

  if (
    typeof vista !== "string" ||
    !ESTADO_VISUAL_VISTAS.includes(vista as (typeof ESTADO_VISUAL_VISTAS)[number])
  ) {
    return { ok: false, error: "Vista inválida" };
  }
  if (!(file instanceof File)) {
    return { ok: false, error: "Selecciona una foto" };
  }

  const validationError = validateEstadoVisualFile(file);
  if (validationError) {
    return { ok: false, error: validationError };
  }

  try {
    const supabase = createAdminClient();
    const foto = await uploadEstadoVisualFoto(supabase, {
      tallerId: taller.id,
      vista: vista as (typeof ESTADO_VISUAL_VISTAS)[number],
      file,
      vehiculoId,
    });
    return { ok: true, foto: { ...foto, vista } };
  } catch (err) {
    const message = err instanceof Error ? err.message : "No se pudo subir la foto";
    return { ok: false, error: message };
  }
}
