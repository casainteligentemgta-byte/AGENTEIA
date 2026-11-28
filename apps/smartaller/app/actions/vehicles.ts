"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getConfigTipoVehiculo } from "@/lib/vehicles/templates";
import { fusionarVehiculosPorPlaca, normalizarPlaca } from "@/lib/vehicles/link";
import { getAccesoB2c } from "@/lib/billing/acceso";
import {
  createVehicleSchema,
  type CreateVehicleInput,
} from "@/lib/validations/vehicle";
import { ensureBikeForVehiculo } from "@/lib/smartbike/link-vehiculo";
import { headers } from "next/headers";
import { clientIpFromHeaders } from "@/lib/security/rate-limit";
import {
  CLAIM_ERROR_GENERIC,
  CLAIM_ERROR_MISSING_CODE,
  CLAIM_ERROR_RATE_LIMIT,
  CLAIM_ERROR_REQUIRED,
  checkClaimRateLimit,
  claimCodesEqual,
} from "@/lib/vehicles/claim-code";
import { clearVehiculoClaimCode } from "@/lib/vehicles/claim-code-db";
import { isMissingSchemaError } from "@/lib/db/schema-errors";
import { applyVehicleBrandFields, getBrand } from "@/lib/brand";

export type ActionResult<T = undefined> =
  | { success: true; data?: T }
  | { success: false; error: string; fieldErrors?: Record<string, string[]> };

function mapZodErrors(error: { flatten: () => { fieldErrors: Record<string, string[]> } }) {
  return error.flatten().fieldErrors;
}

async function provisionSmartBikeIfNeeded(
  supabase: ReturnType<typeof createClient>,
  vehiculoId: string,
  userId: string,
  data: {
    tipo_vehiculo: string;
    placa: string;
    nick?: string | null;
    marca?: string | null;
    modelo?: string | null;
    color?: string | null;
  }
) {
  if (data.tipo_vehiculo !== "bicicleta") return;

  await ensureBikeForVehiculo(supabase, {
    id: vehiculoId,
    user_id: userId,
    placa: data.placa,
    nick: data.nick,
    marca: data.marca,
    modelo: data.modelo,
    color: data.color,
  });
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
  const branded = applyVehicleBrandFields(data);
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
    const ip = clientIpFromHeaders(headers());
    const limited = checkClaimRateLimit(ip, user.id, placaNorm);
    if (!limited.ok) {
      return { success: false, error: CLAIM_ERROR_RATE_LIMIT };
    }

    const codigoReclamo = data.codigo_reclamo;
    if (!codigoReclamo) {
      return {
        success: false,
        error: CLAIM_ERROR_REQUIRED,
        fieldErrors: { codigo_reclamo: ["Código requerido"] },
      };
    }

    const { data: row, error: codeError } = await admin
      .from("vehiculos")
      .select("id, codigo_reclamo")
      .eq("id", vehiculoTaller.id)
      .maybeSingle();

    if (codeError && isMissingSchemaError(codeError.message)) {
      return {
        success: false,
        error: CLAIM_ERROR_MISSING_CODE,
        fieldErrors: { codigo_reclamo: ["Código no disponible"] },
      };
    }

    if (!row?.codigo_reclamo) {
      return {
        success: false,
        error: CLAIM_ERROR_MISSING_CODE,
        fieldErrors: { codigo_reclamo: ["Código no disponible"] },
      };
    }

    if (!claimCodesEqual(row.codigo_reclamo, codigoReclamo)) {
      return {
        success: false,
        error: CLAIM_ERROR_GENERIC,
        fieldErrors: { codigo_reclamo: ["Código inválido"] },
      };
    }
  }

  const payload = {
    user_id: user.id,
    tipo_vehiculo: data.tipo_vehiculo,
    nick: data.nick || null,
    marca: branded.marca,
    modelo: branded.modelo,
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

    await clearVehiculoClaimCode(admin, vinculado.id);
    await fusionarVehiculosPorPlaca(admin, placaNorm, vinculado.id);
    await provisionSmartBikeIfNeeded(supabase, vinculado.id, user.id, data);

    revalidatePath("/app");
    revalidatePath("/dashboard/vehiculos");
    revalidatePath(`/app/vehiculos/${vinculado.id}`);

    return { success: true, data: { id: vinculado.id } };
  }

  const acceso = await getAccesoB2c();

  if (!acceso.permitido) {
    return {
      success: false,
      error: getBrand().copy.needProVehicles,
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

  await provisionSmartBikeIfNeeded(supabase, created.id, user.id, data);

  revalidatePath("/app");
  revalidatePath("/dashboard/vehiculos");
  revalidatePath(`/app/vehiculos/${created.id}`);

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
