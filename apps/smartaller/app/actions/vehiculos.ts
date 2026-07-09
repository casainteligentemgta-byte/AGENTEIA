"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUser } from "@/lib/supabase/server";
import { ensureTallerForUser } from "@/lib/taller";
import { getConfigTipoVehiculo } from "@/lib/vehicles/templates";
import { fusionarVehiculosPorPlaca, normalizarPlaca } from "@/lib/vehicles/link";
import {
  createVehiculoTallerSchema,
  updateVehiculoContactoSchema,
} from "@/lib/validations/vehiculo";
import { ensureBikeForVehiculo } from "@/lib/smartbike/link-vehiculo";
import { crearOrdenRecepcionSchema, tieneDatosOrdenRecepcion } from "@/lib/schemas/orden-recepcion";
import { persistOrdenRecepcion } from "@/lib/ordenes-recepcion/persist";
import type { OrdenRecepcionAltaInput } from "@/lib/schemas/orden-recepcion";

async function registrarOrdenRecepcion(
  supabase: ReturnType<typeof createAdminClient>,
  params: {
    tallerId: string;
    userId: string | null;
    vehiculoId: string;
    placa: string;
    nombreCliente: string;
    telefonoCliente: string;
    modelo?: string;
    color?: string;
    chasis?: string;
    odometro: number | null;
    orden: OrdenRecepcionAltaInput;
  }
): Promise<void> {
  const km = params.orden.kilometraje ?? params.odometro;
  const payload = crearOrdenRecepcionSchema.parse({
    ...params.orden,
    vehiculoId: params.vehiculoId,
    clienteNombre: params.nombreCliente,
    clienteTelefono: params.telefonoCliente,
    placa: params.placa,
    modelo: params.modelo ?? "",
    color: params.color ?? "",
    chasis: params.chasis ?? "",
    kilometraje: km,
  });

  await persistOrdenRecepcion(supabase, {
    tallerId: params.tallerId,
    userId: params.userId,
    orden: payload,
  });
}

async function afterVehiculoRegistrado(
  supabase: ReturnType<typeof createAdminClient>,
  vehiculoId: string,
  userId: string | null,
  data: {
    placa: string;
    marca?: string;
    modelo?: string;
    color?: string;
    serialCarroceria?: string;
    nombreCliente: string;
    telefonoCliente: string;
    odometro: number | null;
    ordenRecepcion?: OrdenRecepcionAltaInput;
  },
  tallerId: string
): Promise<void> {
  if (data.ordenRecepcion && tieneDatosOrdenRecepcion(data.ordenRecepcion)) {
    try {
      await registrarOrdenRecepcion(supabase, {
        tallerId,
        userId,
        vehiculoId,
        placa: data.placa,
        nombreCliente: data.nombreCliente,
        telefonoCliente: data.telefonoCliente,
        modelo: data.modelo,
        color: data.color,
        chasis: data.serialCarroceria,
        odometro: data.odometro,
        orden: data.ordenRecepcion,
      });
    } catch (err) {
      console.error("[ordenes_recepcion] No se pudo guardar la orden:", err);
    }
  }
}

export type CreateVehiculoTallerResult =
  | { ok: true; vehiculoId: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

export async function createVehiculoTallerAction(
  raw: unknown
): Promise<CreateVehiculoTallerResult> {
  const user = await getUser();
  if (!user) return { ok: false, error: "No autenticado" };

  const parsed = createVehiculoTallerSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors as Record<string, string[]>;
    return {
      ok: false,
      error: parsed.error.errors[0]?.message ?? "Datos inválidos",
      fieldErrors,
    };
  }

  const { taller } = await ensureTallerForUser(user.id);
  if (!taller) return { ok: false, error: "No se encontró tu taller" };

  const data = parsed.data;
  const config = getConfigTipoVehiculo(data.tipo_vehiculo);
  const placaNorm = normalizarPlaca(data.placa);
  const supabase = createAdminClient();

  const { data: existingTaller } = await supabase
    .from("vehiculos")
    .select("id")
    .eq("placa", placaNorm)
    .eq("taller_id", taller.id)
    .maybeSingle();

  if (existingTaller) {
    return {
      ok: false,
      error: "Ya tienes un vehículo registrado con esta placa.",
      fieldErrors: { placa: ["Placa duplicada en tu flota"] },
    };
  }

  const kmRecepcion = data.odometro;
  const payload = {
    taller_id: taller.id,
    tipo_vehiculo: data.tipo_vehiculo,
    placa: placaNorm,
    marca: data.marca?.trim() || null,
    modelo: data.modelo?.trim() || null,
    color: data.color?.trim() || null,
    nombre_cliente: data.nombreCliente.trim(),
    telefono_cliente: data.telefonoCliente.trim(),
    serial_motor: data.serialMotor?.trim() || null,
    serial_carroceria: data.serialCarroceria?.trim() || null,
    cedula_propietario: data.cedulaPropietario?.trim() || null,
    email_propietario: data.emailPropietario?.trim() || null,
    fecha_nacimiento_propietario: data.fechaNacimientoPropietario?.trim() || null,
    documentos: data.documentos ?? {},
    unidad_odometro: config.unidadOdometro,
    kilometraje_ultimo: config.unidadOdometro === "km" ? kmRecepcion : null,
    horas_motor_ultimo: config.unidadOdometro === "horas" ? kmRecepcion : null,
    telegram_chat_id: null,
    updated_at: new Date().toISOString(),
  };

  const { data: existingUsuario } = await supabase
    .from("vehiculos")
    .select("id")
    .eq("placa", placaNorm)
    .not("user_id", "is", null)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingUsuario) {
    const { data: vinculado, error } = await supabase
      .from("vehiculos")
      .update(payload)
      .eq("id", existingUsuario.id)
      .select("id")
      .single();

    if (error || !vinculado) {
      return { ok: false, error: error?.message ?? "No se pudo vincular el vehículo" };
    }

    await fusionarVehiculosPorPlaca(supabase, placaNorm, vinculado.id);

    await afterVehiculoRegistrado(
      supabase,
      vinculado.id,
      user.id,
      {
        placa: placaNorm,
        marca: data.marca,
        modelo: data.modelo,
        color: data.color,
        serialCarroceria: data.serialCarroceria,
        nombreCliente: data.nombreCliente,
        telefonoCliente: data.telefonoCliente,
        odometro: data.odometro,
        ordenRecepcion: data.ordenRecepcion,
      },
      taller.id
    );

    if (data.tipo_vehiculo === "bicicleta") {
      const { data: vehiculoRow } = await supabase
        .from("vehiculos")
        .select("user_id")
        .eq("id", vinculado.id)
        .maybeSingle();

      if (vehiculoRow?.user_id) {
        await ensureBikeForVehiculo(supabase, {
          id: vinculado.id,
          user_id: vehiculoRow.user_id,
          placa: placaNorm,
          marca: data.marca,
          modelo: data.modelo,
          color: data.color,
        });
      }
    }

    revalidatePath("/dashboard/vehiculos");
    return { ok: true, vehiculoId: vinculado.id };
  }

  const { data: created, error } = await supabase
    .from("vehiculos")
    .insert(payload)
    .select("id, user_id")
    .single();

  if (error || !created) {
    return { ok: false, error: error?.message ?? "No se pudo registrar el vehículo" };
  }

  if (data.tipo_vehiculo === "bicicleta" && created.user_id) {
    await ensureBikeForVehiculo(supabase, {
      id: created.id,
      user_id: created.user_id,
      placa: placaNorm,
      marca: data.marca,
      modelo: data.modelo,
      color: data.color,
    });
  }

  await afterVehiculoRegistrado(
    supabase,
    created.id,
    user.id,
    {
      placa: placaNorm,
      marca: data.marca,
      modelo: data.modelo,
      color: data.color,
      serialCarroceria: data.serialCarroceria,
      nombreCliente: data.nombreCliente,
      telefonoCliente: data.telefonoCliente,
      odometro: data.odometro,
      ordenRecepcion: data.ordenRecepcion,
    },
    taller.id
  );

  revalidatePath("/dashboard/vehiculos");
  return { ok: true, vehiculoId: created.id };
}

export async function updateVehiculoContactoAction(input: {
  vehiculoId: string;
  nombreCliente: string;
  telefonoCliente: string;
}): Promise<{ ok: boolean; error?: string }> {
  const user = await getUser();
  if (!user) return { ok: false, error: "No autenticado" };

  const parsed = updateVehiculoContactoSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0]?.message ?? "Datos inválidos" };
  }

  const { taller } = await ensureTallerForUser(user.id);
  if (!taller) return { ok: false, error: "No se encontró tu taller" };

  const supabase = createAdminClient();
  const { data: vehiculo } = await supabase
    .from("vehiculos")
    .select("id, taller_id")
    .eq("id", parsed.data.vehiculoId)
    .maybeSingle();

  if (!vehiculo || vehiculo.taller_id !== taller.id) {
    return { ok: false, error: "Vehículo no encontrado" };
  }

  const { error } = await supabase
    .from("vehiculos")
    .update({
      nombre_cliente: parsed.data.nombreCliente,
      telefono_cliente: parsed.data.telefonoCliente,
      updated_at: new Date().toISOString(),
    })
    .eq("id", parsed.data.vehiculoId);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard/vehiculos");
  revalidatePath(`/dashboard/vehiculos/${parsed.data.vehiculoId}`);
  return { ok: true };
}
