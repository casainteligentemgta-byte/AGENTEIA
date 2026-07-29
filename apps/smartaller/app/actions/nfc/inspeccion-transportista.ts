"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUser } from "@/lib/supabase/server";
import { getMyTaller } from "@/lib/taller";
import { normalizePlaca } from "@/lib/format";
import {
  inspeccionTransportistaSchema,
  type InspeccionTransportistaStored,
} from "@/lib/schemas/inspeccion-transportista";
import { parseImportacion, serializeImportacion } from "@/lib/schemas/vehiculo-documentos";

export type InspeccionTransportistaResult =
  | { success: true }
  | { success: false; error: string };

export async function saveInspeccionTransportistaAction(
  raw: unknown
): Promise<InspeccionTransportistaResult> {
  const user = await getUser();
  if (!user) return { success: false, error: "Debes iniciar sesión" };

  const taller = await getMyTaller();
  if (!taller) return { success: false, error: "No se encontró tu taller" };

  const parsed = inspeccionTransportistaSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message ?? "Datos inválidos" };
  }

  const admin = createAdminClient();
  const { data: vehiculo } = await admin
    .from("vehiculos")
    .select("id, taller_id, placa, serial_carroceria, kilometraje_ultimo, importacion")
    .eq("id", parsed.data.vehiculoId)
    .maybeSingle();

  if (!vehiculo || vehiculo.taller_id !== taller.id) {
    return { success: false, error: "Vehículo no encontrado" };
  }

  const stored: InspeccionTransportistaStored = {
    ...parsed.data,
    version: 2,
    updated_at: new Date().toISOString(),
  };

  const updatePayload: Record<string, unknown> = {
    inspeccion_transportista: stored,
    updated_at: stored.updated_at,
  };

  const placaNueva = parsed.data.placaTexto?.trim()
    ? normalizePlaca(parsed.data.placaTexto)
    : null;
  if (placaNueva && placaNueva !== normalizePlaca(String(vehiculo.placa ?? ""))) {
    updatePayload.placa = placaNueva;
  }

  const vin = parsed.data.vin?.trim() || null;
  if (vin && vin !== (vehiculo.serial_carroceria ?? "").trim()) {
    updatePayload.serial_carroceria = vin;
  }

  if (
    typeof parsed.data.kilometraje === "number" &&
    Number.isFinite(parsed.data.kilometraje) &&
    parsed.data.kilometraje !== vehiculo.kilometraje_ultimo
  ) {
    updatePayload.kilometraje_ultimo = parsed.data.kilometraje;
  }

  const importadora = parsed.data.importadora?.trim() || null;
  if (importadora) {
    const importacion = parseImportacion(vehiculo.importacion);
    if ((importacion.importadorNombre ?? "").trim() !== importadora) {
      updatePayload.importacion = serializeImportacion({
        ...importacion,
        importadorNombre: importadora,
      });
    }
  }

  const { error } = await admin
    .from("vehiculos")
    .update(updatePayload)
    .eq("id", parsed.data.vehiculoId)
    .eq("taller_id", taller.id);

  if (error) {
    const msg = error.message.toLowerCase();
    if (msg.includes("inspeccion_transportista") || msg.includes("column")) {
      return {
        success: false,
        error:
          "Falta la columna inspeccion_transportista. Ejecuta 20260729_inspeccion_transportista_pl.sql en Supabase.",
      };
    }
    if (msg.includes("duplicate") || msg.includes("unique") || msg.includes("placa")) {
      return {
        success: false,
        error: "Esa placa ya está registrada en otro vehículo de tu taller.",
      };
    }
    return { success: false, error: error.message };
  }

  revalidatePath(`/puerto-libre/${parsed.data.vehiculoId}`);
  revalidatePath(`/puerto-libre/${parsed.data.vehiculoId}/inspeccion`);
  revalidatePath("/puerto-libre");
  return { success: true };
}
