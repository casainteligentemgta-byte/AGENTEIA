"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getConfigTipoVehiculo } from "@/lib/vehicles/templates";
import { fusionarVehiculosPorPlaca, normalizarPlaca } from "@/lib/vehicles/link";
import {
  getOrEnsurePerfil,
  perfilSuscripcionVigente,
  usuarioTieneVehiculoTaller,
} from "@/lib/data/perfil";
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
  const placaNorm = normalizarPlaca(data.placa);

  // Puente: vincular con vehículo existente del taller (misma placa, service role)
  const admin = createAdminClient();

  const { data: placaOtroUsuario } = await admin
    .from("vehiculos")
    .select("id")
    .eq("placa", placaNorm)
    .not("user_id", "is", null)
    .neq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (placaOtroUsuario) {
    return {
      success: false,
      error: "Esta placa ya está registrada por otro usuario.",
      fieldErrors: { placa: ["Placa no disponible"] },
    };
  }

  const { data: vehiculoTaller } = await admin
    .from("vehiculos")
    .select("id, taller_id")
    .eq("placa", placaNorm)
    .not("taller_id", "is", null)
    .is("user_id", null)
    .maybeSingle();

  if (vehiculoTaller) {
    const codigoVinculo = data.codigo_vinculo;
    if (!codigoVinculo) {
      return {
        success: false,
        error:
          "Esta placa está registrada en un taller. Ingresa el código de vinculación que te dio tu asesor.",
        fieldErrors: { codigo_vinculo: ["Código requerido para vincular con taller"] },
      };
    }

    const { data: taller } = await admin
      .from("talleres")
      .select("codigo_vinculo")
      .eq("id", vehiculoTaller.taller_id)
      .maybeSingle();

    if (!taller || taller.codigo_vinculo !== codigoVinculo) {
      return {
        success: false,
        error: "Código de vinculación incorrecto. Pídelo en recepción de tu taller.",
        fieldErrors: { codigo_vinculo: ["Código inválido"] },
      };
    }
  }

  const payload = {
    user_id: user.id,
    tipo_vehiculo: data.tipo_vehiculo,
    nick: data.nick || null,
    marca: data.marca || null,
    modelo: data.modelo || null,
    color: data.color || null,
    placa: placaNorm,
    unidad_odometro: config.unidadOdometro,
    kilometraje_ultimo: config.unidadOdometro === "km" ? data.odometro : null,
    horas_motor_ultimo: config.unidadOdometro === "horas" ? data.odometro : null,
  };

  if (vehiculoTaller) {
    const { data: vinculado, error } = await admin
      .from("vehiculos")
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq("id", vehiculoTaller.id)
      .select("id")
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    await fusionarVehiculosPorPlaca(admin, placaNorm, vinculado.id);

    revalidatePath("/app");
    revalidatePath("/dashboard/vehiculos");

    return { success: true, data: { id: vinculado.id } };
  }

  const [perfil, tieneVinculoTaller] = await Promise.all([
    getOrEnsurePerfil(),
    usuarioTieneVehiculoTaller(),
  ]);

  if (!tieneVinculoTaller && (!perfil || !perfilSuscripcionVigente(perfil))) {
    return {
      success: false,
      error: "Necesitas SmartTaller Pro ($2.99/mes) para registrar vehículos de forma independiente.",
    };
  }

  const { data: created, error } = await supabase
    .from("vehiculos")
    .insert({
      ...payload,
      telegram_chat_id: null,
    })
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
