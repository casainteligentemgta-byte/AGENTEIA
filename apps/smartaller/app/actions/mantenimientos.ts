"use server";

import { revalidatePath } from "next/cache";
import { createClient, getUser } from "@/lib/supabase/server";
import { getMyTaller } from "@/lib/taller";
import { parseRevisionInput, type RevisionParsed } from "@/lib/validations/revision";
import type { TipoIndustria } from "@/lib/platform/types";

export type RevisionActionResult =
  | { success: true; mantenimientoId: string }
  | { success: false; error: string };

function buildDetalleRevision(data: RevisionParsed): Record<string, unknown> {
  switch (data.tipoIndustria) {
    case "concesionario":
      return {
        voltaje_bateria: data.voltajeBateria,
        kilometraje: data.kilometraje,
      };
    case "bicicletas":
      return {
        desgaste_cadena: data.desgasteCadena,
        presion_suspension_psi: data.presionSuspensionPsi,
      };
    case "constructora":
      return {
        horometro_actual: data.horometroActual,
        estado_mangueras_hidraulicas: data.estadoManguerasHidraulicas,
      };
  }
}

export async function createRevisionMantenimiento(
  tipoIndustria: TipoIndustria,
  formData: FormData
): Promise<RevisionActionResult> {
  const user = await getUser();
  if (!user) {
    return { success: false, error: "Debes iniciar sesión" };
  }

  const taller = await getMyTaller();
  if (!taller) {
    return { success: false, error: "No se encontró tu taller" };
  }

  const raw = Object.fromEntries(formData.entries());
  const parsed = parseRevisionInput(tipoIndustria, raw);
  if (!parsed.success) {
    return { success: false, error: parsed.error };
  }

  const data = parsed.data;
  const supabase = createClient();

  const { data: vehiculo, error: vehError } = await supabase
    .from("vehiculos")
    .select("id, placa, taller_id")
    .eq("id", data.vehiculoId)
    .maybeSingle();

  if (vehError || !vehiculo || vehiculo.taller_id !== taller.id) {
    return { success: false, error: "Vehículo no encontrado en tu taller" };
  }

  const detalle = buildDetalleRevision(data);
  const kilometraje =
    data.tipoIndustria === "concesionario" ? data.kilometraje : null;

  const { data: mantenimiento, error: mantError } = await supabase
    .from("mantenimientos")
    .insert({
      taller_id: taller.id,
      vehiculo_id: vehiculo.id,
      placa: vehiculo.placa,
      kilometraje,
      descripcion: data.descripcion,
      descripcion_servicio: data.descripcion,
      detalle_revision: detalle,
    })
    .select("id")
    .single();

  if (mantError || !mantenimiento) {
    return { success: false, error: mantError?.message ?? "No se pudo guardar la revisión" };
  }

  const vehiculoUpdate: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (data.tipoIndustria === "concesionario") {
    vehiculoUpdate.kilometraje_ultimo = data.kilometraje;
  }
  if (data.tipoIndustria === "constructora") {
    vehiculoUpdate.horometro_actual = data.horometroActual;
    vehiculoUpdate.horas_motor_ultimo = data.horometroActual;
    vehiculoUpdate.unidad_odometro = "horas";
  }

  await supabase.from("vehiculos").update(vehiculoUpdate).eq("id", vehiculo.id);

  revalidatePath("/dashboard/mantenimientos");
  revalidatePath("/dashboard/vehiculos");
  revalidatePath(`/dashboard/vehiculos/${vehiculo.id}`);

  return { success: true, mantenimientoId: mantenimiento.id };
}
