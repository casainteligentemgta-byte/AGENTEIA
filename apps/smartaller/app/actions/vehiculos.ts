"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUser } from "@/lib/supabase/server";
import { ensureTallerForUser } from "@/lib/taller";
import { getConfigTipoVehiculo } from "@/lib/vehicles/templates";
import { fusionarVehiculosPorPlaca, normalizarPlaca } from "@/lib/vehicles/link";
import {
  findDuplicateSerialCarroceria,
  normalizarSerialCarroceria,
  SERIAL_CARROCERIA_DUPLICADO,
} from "@/lib/vehicles/serial";
import { deleteVehiculoConDependencias } from "@/lib/vehicles/delete-cascade";
import {
  createVehiculoTallerSchema,
  updateVehiculoContactoSchema,
  updateVehiculoTallerSchema,
  deleteVehiculoTallerSchema,
} from "@/lib/validations/vehiculo";
import { ensureBikeForVehiculo } from "@/lib/smartbike/link-vehiculo";
import { propietarioContactoColumns } from "@/lib/vehicles/propietario";
import { ensureVehiculoClaimCode, assignNewClaimCode } from "@/lib/vehicles/claim-code-db";
import { isMissingSchemaError } from "@/lib/db/schema-errors";
import { crearOrdenRecepcionSchema, tieneDatosOrdenRecepcion } from "@/lib/schemas/orden-recepcion";
import { persistOrdenRecepcion } from "@/lib/ordenes-recepcion/persist";
import { datosClienteOrdenRecepcion } from "@/lib/ordenes-recepcion/cliente-orden";
import type { OrdenRecepcionAltaInput } from "@/lib/schemas/orden-recepcion";
import { applyVehicleBrandFields } from "@/lib/brand";

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
  const { clienteNombre, clienteTelefono } = datosClienteOrdenRecepcion(
    params.nombreCliente,
    params.telefonoCliente
  );
  const payloadResult = crearOrdenRecepcionSchema.safeParse({
    ...params.orden,
    vehiculoId: params.vehiculoId,
    clienteNombre,
    clienteTelefono,
    placa: params.placa,
    modelo: params.modelo ?? "",
    color: params.color ?? "",
    chasis: params.chasis ?? "",
    kilometraje: km,
  });

  if (!payloadResult.success) {
    throw new Error(payloadResult.error.errors[0]?.message ?? "Datos de inspección inválidos");
  }

  await persistOrdenRecepcion(supabase, {
    tallerId: params.tallerId,
    userId: params.userId,
    orden: payloadResult.data,
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
  const branded = applyVehicleBrandFields(data);
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

  const serialCarroceria = data.serialCarroceria?.trim()
    ? normalizarSerialCarroceria(data.serialCarroceria)
    : null;
  const serialMotor = data.serialMotor?.trim()
    ? normalizarSerialCarroceria(data.serialMotor)
    : null;

  if (serialCarroceria) {
    const existingSerial = await findDuplicateSerialCarroceria(
      supabase,
      taller.id,
      serialCarroceria
    );
    if (existingSerial) {
      return {
        ok: false,
        error: SERIAL_CARROCERIA_DUPLICADO,
        fieldErrors: { serialCarroceria: [SERIAL_CARROCERIA_DUPLICADO] },
      };
    }
  }

  const kmRecepcion = data.odometro;
  const payload = {
    taller_id: taller.id,
    tipo_vehiculo: data.tipo_vehiculo,
    placa: placaNorm,
    marca: branded.marca,
    modelo: branded.modelo,
    color: data.color?.trim() || null,
    anio: data.anio,
    ...propietarioContactoColumns(data.nombreCliente, data.telefonoCliente),
    serial_motor: serialMotor,
    serial_carroceria: serialCarroceria,
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
    let vinculado: { id: string } | null = null;
    let linkError: { message: string } | null = null;
    {
      const updated = await supabase
        .from("vehiculos")
        .update(payload)
        .eq("id", existingUsuario.id)
        .select("id")
        .single();
      vinculado = updated.data;
      linkError = updated.error;
      if (linkError && isMissingSchemaError(linkError.message)) {
        const { anio: _anio, dueno_nombre: _dn, dueno_telefono: _dt, ...legacy } = payload;
        const retry = await supabase
          .from("vehiculos")
          .update(legacy)
          .eq("id", existingUsuario.id)
          .select("id")
          .single();
        vinculado = retry.data;
        linkError = retry.error;
      }
    }

    if (linkError || !vinculado) {
      return { ok: false, error: linkError?.message ?? "No se pudo vincular el vehículo" };
    }

    await fusionarVehiculosPorPlaca(supabase, placaNorm, vinculado.id);
    await ensureVehiculoClaimCode(supabase, vinculado.id);

    await afterVehiculoRegistrado(
      supabase,
      vinculado.id,
      user.id,
      {
        placa: placaNorm,
        marca: branded.marca ?? undefined,
        modelo: branded.modelo ?? undefined,
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
          marca: branded.marca,
          modelo: branded.modelo,
          color: data.color,
        });
      }
    }

    revalidatePath("/dashboard/vehiculos");
    return { ok: true, vehiculoId: vinculado.id };
  }

  let created: { id: string; user_id: string | null } | null = null;
  let error: { message: string; code?: string } | null = null;
  {
    const inserted = await supabase
      .from("vehiculos")
      .insert(payload)
      .select("id, user_id")
      .single();
    created = inserted.data as { id: string; user_id: string | null } | null;
    error = inserted.error;
    if (error && isMissingSchemaError(error.message)) {
      const { anio: _anio, dueno_nombre: _dn, dueno_telefono: _dt, ...legacy } = payload;
      const retry = await supabase
        .from("vehiculos")
        .insert(legacy)
        .select("id, user_id")
        .single();
      created = retry.data as { id: string; user_id: string | null } | null;
      error = retry.error;
    }
  }

  if (error || !created) {
    if (error?.code === "23505" && error.message.includes("serial_carroceria")) {
      return {
        ok: false,
        error: SERIAL_CARROCERIA_DUPLICADO,
        fieldErrors: { serialCarroceria: [SERIAL_CARROCERIA_DUPLICADO] },
      };
    }
    return { ok: false, error: error?.message ?? "No se pudo registrar el vehículo" };
  }

  if (data.tipo_vehiculo === "bicicleta") {
    const bikeUserId = created.user_id ?? user.id;
    await ensureBikeForVehiculo(supabase, {
      id: created.id,
      user_id: bikeUserId,
      placa: placaNorm,
      marca: branded.marca,
      modelo: branded.modelo,
      color: data.color,
    });
  }

  await ensureVehiculoClaimCode(supabase, created.id);

  await afterVehiculoRegistrado(
    supabase,
    created.id,
    user.id,
    {
      placa: placaNorm,
      marca: branded.marca ?? undefined,
      modelo: branded.modelo ?? undefined,
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
      ...propietarioContactoColumns(parsed.data.nombreCliente, parsed.data.telefonoCliente),
      updated_at: new Date().toISOString(),
    })
    .eq("id", parsed.data.vehiculoId);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard/vehiculos");
  revalidatePath(`/dashboard/vehiculos/${parsed.data.vehiculoId}`);
  return { ok: true };
}

export type UpdateVehiculoTallerResult =
  | { ok: true }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

export async function updateVehiculoTallerAction(
  raw: unknown
): Promise<UpdateVehiculoTallerResult> {
  const user = await getUser();
  if (!user) return { ok: false, error: "No autenticado" };

  const parsed = updateVehiculoTallerSchema.safeParse(raw);
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
  const branded = applyVehicleBrandFields(data);
  const config = getConfigTipoVehiculo(data.tipo_vehiculo);
  const placaNorm = normalizarPlaca(data.placa);
  const supabase = createAdminClient();

  const { data: vehiculo } = await supabase
    .from("vehiculos")
    .select("id, taller_id, user_id")
    .eq("id", data.vehiculoId)
    .maybeSingle();

  if (!vehiculo || vehiculo.taller_id !== taller.id) {
    return { ok: false, error: "Vehículo no encontrado" };
  }

  const { data: placaDuplicada } = await supabase
    .from("vehiculos")
    .select("id")
    .eq("placa", placaNorm)
    .eq("taller_id", taller.id)
    .neq("id", data.vehiculoId)
    .maybeSingle();

  if (placaDuplicada) {
    return {
      ok: false,
      error: "Ya tienes otro vehículo con esta placa.",
      fieldErrors: { placa: ["Placa duplicada en tu flota"] },
    };
  }

  const serialCarroceria = data.serialCarroceria?.trim()
    ? normalizarSerialCarroceria(data.serialCarroceria)
    : null;
  const serialMotor = data.serialMotor?.trim()
    ? normalizarSerialCarroceria(data.serialMotor)
    : null;

  if (serialCarroceria) {
    const existingSerial = await findDuplicateSerialCarroceria(
      supabase,
      taller.id,
      serialCarroceria,
      data.vehiculoId
    );
    if (existingSerial) {
      return {
        ok: false,
        error: SERIAL_CARROCERIA_DUPLICADO,
        fieldErrors: { serialCarroceria: [SERIAL_CARROCERIA_DUPLICADO] },
      };
    }
  }

  const km = data.odometro;
  const payload = {
    tipo_vehiculo: data.tipo_vehiculo,
    placa: placaNorm,
    marca: branded.marca,
    modelo: branded.modelo,
    color: data.color?.trim() || null,
    anio: data.anio,
    ...propietarioContactoColumns(data.nombreCliente, data.telefonoCliente),
    serial_motor: serialMotor,
    serial_carroceria: serialCarroceria,
    cedula_propietario: data.cedulaPropietario?.trim() || null,
    email_propietario: data.emailPropietario?.trim() || null,
    fecha_nacimiento_propietario: data.fechaNacimientoPropietario?.trim() || null,
    documentos: data.documentos ?? {},
    unidad_odometro: config.unidadOdometro,
    kilometraje_ultimo: config.unidadOdometro === "km" ? km : null,
    horas_motor_ultimo: config.unidadOdometro === "horas" ? km : null,
    updated_at: new Date().toISOString(),
  };

  let { error } = await supabase
    .from("vehiculos")
    .update(payload)
    .eq("id", data.vehiculoId);

  if (error && isMissingSchemaError(error.message)) {
    const { anio: _anio, dueno_nombre: _dn, dueno_telefono: _dt, ...legacy } = payload;
    const retry = await supabase.from("vehiculos").update(legacy).eq("id", data.vehiculoId);
    error = retry.error;
  }

  if (error) {
    if (error.code === "23505" && error.message.includes("serial_carroceria")) {
      return {
        ok: false,
        error: SERIAL_CARROCERIA_DUPLICADO,
        fieldErrors: { serialCarroceria: [SERIAL_CARROCERIA_DUPLICADO] },
      };
    }
    return { ok: false, error: error.message };
  }

  if (data.tipo_vehiculo === "bicicleta" && vehiculo.user_id) {
    await ensureBikeForVehiculo(supabase, {
      id: data.vehiculoId,
      user_id: vehiculo.user_id,
      placa: placaNorm,
      marca: branded.marca,
      modelo: branded.modelo,
      color: data.color,
    });
  }

  revalidatePath("/dashboard/vehiculos");
  revalidatePath(`/dashboard/vehiculos/${data.vehiculoId}`);
  return { ok: true };
}

export async function deleteVehiculoTallerAction(
  vehiculoId: string
): Promise<{ ok: boolean; error?: string }> {
  const user = await getUser();
  if (!user) return { ok: false, error: "No autenticado" };

  const parsed = deleteVehiculoTallerSchema.safeParse({ vehiculoId });
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

  const deleted = await deleteVehiculoConDependencias(supabase, {
    vehiculoId: parsed.data.vehiculoId,
    tallerId: taller.id,
  });
  if (!deleted.ok) {
    return {
      ok: false,
      error:
        deleted.error.includes("foreign key") || deleted.error.includes("violates")
          ? "No se pudo eliminar: hay registros vinculados. Intenta de nuevo."
          : deleted.error,
    };
  }

  revalidatePath("/dashboard/vehiculos");
  return { ok: true };
}

export async function regenerateCodigoReclamoAction(
  vehiculoId: string
): Promise<{ ok: true; codigo: string } | { ok: false; error: string }> {
  const user = await getUser();
  if (!user) return { ok: false, error: "No autenticado" };

  const parsed = deleteVehiculoTallerSchema.safeParse({ vehiculoId });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0]?.message ?? "Datos inválidos" };
  }

  const { taller } = await ensureTallerForUser(user.id);
  if (!taller) return { ok: false, error: "No se encontró tu taller" };

  const supabase = createAdminClient();
  const { data: vehiculo, error } = await supabase
    .from("vehiculos")
    .select("id, taller_id, user_id")
    .eq("id", parsed.data.vehiculoId)
    .maybeSingle();

  if (error && isMissingSchemaError(error.message)) {
    return {
      ok: false,
      error: "Aplica la migración de código de reclamo para generar códigos por vehículo.",
    };
  }

  if (!vehiculo || vehiculo.taller_id !== taller.id) {
    return { ok: false, error: "Vehículo no encontrado" };
  }

  if (vehiculo.user_id) {
    return {
      ok: false,
      error: "Este vehículo ya está reclamado por el dueño. El código anterior quedó anulado.",
    };
  }

  const codigo = await assignNewClaimCode(supabase, vehiculo.id);
  if (!codigo) {
    return { ok: false, error: "No se pudo generar un código nuevo. Inténtalo de nuevo." };
  }

  revalidatePath(`/dashboard/vehiculos/${vehiculo.id}`);
  return { ok: true, codigo };
}
