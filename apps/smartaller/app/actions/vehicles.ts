"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getConfigTipoVehiculo } from "@/lib/vehicles/templates";
import {
  createVehicleSchema,
  type CreateVehicleInput,
} from "@/lib/validations/vehicle";

export type ActionResult<T = undefined> =
  | { success: true; data?: T }
  | { success: false; error: string; fieldErrors?: Record<string, string[]> };

function mapZodErrors(error: { flatten: () => { fieldErrors: Record<string, string[]> } }) {
  return error.flatten().fieldErrors;
}

export async function createVehicle(
  raw: CreateVehicleInput
): Promise<ActionResult<{ id: string }>> {
  const parsed = createVehicleSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      success: false,
      error: "Revisa los datos del formulario",
      fieldErrors: mapZodErrors(parsed.error),
    };
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Debes iniciar sesión" };
  }

  const data = parsed.data;
  const config = getConfigTipoVehiculo(data.tipo_vehiculo);

  const payload = {
    user_id: user.id,
    tipo_vehiculo: data.tipo_vehiculo,
    nick: data.nick || null,
    marca: data.marca || null,
    modelo: data.modelo || null,
    color: data.color || null,
    placa: data.placa,
    unidad_odometro: config.unidadOdometro,
    kilometraje_ultimo: config.unidadOdometro === "km" ? data.odometro : null,
    horas_motor_ultimo: config.unidadOdometro === "horas" ? data.odometro : null,
    telegram_chat_id: null,
  };

  const { data: created, error } = await supabase
    .from("vehiculos")
    .insert(payload)
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      return { success: false, error: "Ya tienes un vehículo con esa placa o identificador" };
    }
    return { success: false, error: error.message };
  }

  revalidatePath("/app");
  revalidatePath("/dashboard/vehiculos");

  return { success: true, data: { id: created.id } };
}

export async function deleteVehicle(id: string): Promise<ActionResult> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Debes iniciar sesión" };
  }

  const { error } = await supabase
    .from("vehiculos")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/app");
  revalidatePath("/dashboard/vehiculos");

  return { success: true };
}
