"use server";

import { revalidatePath } from "next/cache";
import { createClient, getUser } from "@/lib/supabase/server";
import { getMyTaller } from "@/lib/taller";
import { z } from "zod";
import { parseRevisionInput, type RevisionParsed } from "@/lib/validations/revision";
import type { TipoIndustria } from "@/lib/platform/types";
import {
  getOrEnsurePerfil,
  perfilSuscripcionVigente,
  usuarioTieneVehiculoTaller,
} from "@/lib/data/perfil";
import {
  CATEGORIAS_VEHICULO,
  CategoriaVehiculoSchema,
  DetalleRevisionSchema,
  type CategoriaVehiculo,
  type CategoriaVehiculoId,
  parseDetalleRevision,
} from "@/lib/schemas/categoria-vehiculo";

export type RevisionActionResult =
  | { success: true; mantenimientoId: string }
  | { success: false; error: string };

const mantenimientoB2cSchema = z.object({
  vehiculoId: z.string().uuid(),
  descripcion: z.string().trim().min(3, "Describe el servicio").max(500),
  odometro: z
    .string()
    .optional()
    .transform((v) => {
      if (!v?.trim()) return null;
      const n = Number(v.replace(/\./g, "").replace(",", "."));
      return Number.isFinite(n) && n >= 0 ? Math.round(n) : null;
    }),
  costo: z
    .string()
    .optional()
    .transform((v) => {
      if (!v?.trim()) return null;
      const n = parseFloat(v.replace(/[^\d.,]/g, "").replace(",", "."));
      return Number.isFinite(n) && n >= 0 ? n : null;
    }),
});

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

export async function createMantenimientoB2C(
  formData: FormData
): Promise<RevisionActionResult> {
  const user = await getUser();
  if (!user) {
    return { success: false, error: "Debes iniciar sesión" };
  }

  const raw = Object.fromEntries(formData.entries());
  const parsed = mantenimientoB2cSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message ?? "Datos inválidos" };
  }

  const [perfil, tieneVinculoTaller] = await Promise.all([
    getOrEnsurePerfil(),
    usuarioTieneVehiculoTaller(),
  ]);

  if (!tieneVinculoTaller && (!perfil || !perfilSuscripcionVigente(perfil))) {
    return { success: false, error: "Necesitas SmartTaller Pro para registrar mantenimientos." };
  }

  const data = parsed.data;
  const supabase = createClient();

  const { data: vehiculo, error: vehError } = await supabase
    .from("vehiculos")
    .select("id, placa, unidad_odometro, user_id")
    .eq("id", data.vehiculoId)
    .maybeSingle();

  if (vehError || !vehiculo || vehiculo.user_id !== user.id) {
    return { success: false, error: "Vehículo no encontrado" };
  }

  const { data: mantenimiento, error: mantError } = await supabase
    .from("mantenimientos")
    .insert({
      taller_id: null,
      vehiculo_id: vehiculo.id,
      placa: vehiculo.placa,
      kilometraje: vehiculo.unidad_odometro === "km" ? data.odometro : null,
      descripcion: data.descripcion,
      descripcion_servicio: data.descripcion,
      costo: data.costo,
    })
    .select("id")
    .single();

  if (mantError || !mantenimiento) {
    return { success: false, error: mantError?.message ?? "No se pudo guardar" };
  }

  if (data.odometro != null) {
    const vehiculoUpdate: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (vehiculo.unidad_odometro === "km") {
      vehiculoUpdate.kilometraje_ultimo = data.odometro;
    } else {
      vehiculoUpdate.horas_motor_ultimo = data.odometro;
      vehiculoUpdate.horometro_actual = data.odometro;
    }
    await supabase.from("vehiculos").update(vehiculoUpdate).eq("id", vehiculo.id);
  }

  revalidatePath(`/app/vehiculos/${vehiculo.id}`);
  revalidatePath("/app");
  revalidatePath("/app/timeline");

  return { success: true, mantenimientoId: mantenimiento.id };
}

export async function actualizarCategoriaVehiculo(
  mantenimientoId: string,
  categoria: CategoriaVehiculoId,
  data: CategoriaVehiculo
): Promise<RevisionActionResult> {
  const user = await getUser();
  if (!user) {
    return { success: false, error: "Debes iniciar sesión" };
  }

  const parsedCategoria = z.enum(CATEGORIAS_VEHICULO).safeParse(categoria);
  if (!parsedCategoria.success) {
    return { success: false, error: "Categoría inválida" };
  }

  const parsed = CategoriaVehiculoSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message ?? "Datos inválidos" };
  }

  const supabase = createClient();

  const { data: mantenimiento, error: fetchError } = await supabase
    .from("mantenimientos")
    .select("id, detalle_revision, vehiculo_id, taller_id")
    .eq("id", mantenimientoId)
    .maybeSingle();

  if (fetchError || !mantenimiento) {
    return { success: false, error: "Mantenimiento no encontrado" };
  }

  if (mantenimiento.taller_id != null) {
    const taller = await getMyTaller();
    if (!taller || mantenimiento.taller_id !== taller.id) {
      return { success: false, error: "No autorizado para este mantenimiento" };
    }
  } else {
    if (!mantenimiento.vehiculo_id) {
      return { success: false, error: "Mantenimiento sin vehículo asociado" };
    }

    const { data: vehiculo, error: vehError } = await supabase
      .from("vehiculos")
      .select("user_id")
      .eq("id", mantenimiento.vehiculo_id)
      .maybeSingle();

    if (vehError || !vehiculo || vehiculo.user_id !== user.id) {
      return { success: false, error: "No autorizado para este mantenimiento" };
    }

    const [perfil, tieneVinculoTaller] = await Promise.all([
      getOrEnsurePerfil(),
      usuarioTieneVehiculoTaller(),
    ]);

    if (!tieneVinculoTaller && (!perfil || !perfilSuscripcionVigente(perfil))) {
      return {
        success: false,
        error: "Necesitas SmartTaller Pro para actualizar categorías.",
      };
    }
  }

  const detalleActual = parseDetalleRevision(mantenimiento.detalle_revision);
  const categoriasActuales = detalleActual.categorias ?? {};

  const nuevoDetalle = DetalleRevisionSchema.parse({
    ...detalleActual,
    categorias: {
      ...categoriasActuales,
      [parsedCategoria.data]: parsed.data,
    },
  });

  const { error: updateError } = await supabase
    .from("mantenimientos")
    .update({ detalle_revision: nuevoDetalle })
    .eq("id", mantenimientoId);

  if (updateError) {
    return { success: false, error: updateError.message };
  }

  if (mantenimiento.vehiculo_id) {
    revalidatePath(`/app/vehiculos/${mantenimiento.vehiculo_id}`);
    revalidatePath("/app");
    revalidatePath("/app/timeline");
    revalidatePath(`/dashboard/vehiculos/${mantenimiento.vehiculo_id}`);
  }
  revalidatePath("/dashboard/mantenimientos");

  return { success: true, mantenimientoId };
}

async function resolverMantenimientoIdB2C(
  supabase: ReturnType<typeof createClient>,
  vehiculoId: string,
  userId: string
): Promise<{ success: true; mantenimientoId: string } | { success: false; error: string }> {
  const { data: existente, error: buscarError } = await supabase
    .from("mantenimientos")
    .select("id")
    .eq("vehiculo_id", vehiculoId)
    .is("taller_id", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (buscarError) {
    return { success: false, error: buscarError.message };
  }

  if (existente) {
    return { success: true, mantenimientoId: existente.id };
  }

  const { data: vehiculo, error: vehError } = await supabase
    .from("vehiculos")
    .select("id, placa, kilometraje_ultimo, horas_motor_ultimo, unidad_odometro, user_id")
    .eq("id", vehiculoId)
    .maybeSingle();

  if (vehError || !vehiculo || vehiculo.user_id !== userId) {
    return { success: false, error: "Vehículo no encontrado" };
  }

  const kilometraje =
    vehiculo.unidad_odometro === "km" ? vehiculo.kilometraje_ultimo : null;

  const { data: nuevo, error: insertError } = await supabase
    .from("mantenimientos")
    .insert({
      taller_id: null,
      vehiculo_id: vehiculo.id,
      placa: vehiculo.placa,
      kilometraje,
      descripcion: "Estado del vehículo",
      descripcion_servicio: "Estado del vehículo",
      detalle_revision: {},
    })
    .select("id")
    .single();

  if (insertError || !nuevo) {
    return { success: false, error: insertError?.message ?? "No se pudo crear registro" };
  }

  return { success: true, mantenimientoId: nuevo.id };
}

export async function actualizarCategoriaVehiculoPorVehiculo(
  vehiculoId: string,
  categoria: CategoriaVehiculoId,
  data: CategoriaVehiculo
): Promise<RevisionActionResult> {
  const user = await getUser();
  if (!user) {
    return { success: false, error: "Debes iniciar sesión" };
  }

  const [perfil, tieneVinculoTaller] = await Promise.all([
    getOrEnsurePerfil(),
    usuarioTieneVehiculoTaller(),
  ]);

  if (!tieneVinculoTaller && (!perfil || !perfilSuscripcionVigente(perfil))) {
    return {
      success: false,
      error: "Necesitas SmartTaller Pro para actualizar el estado.",
    };
  }

  const supabase = createClient();

  const { data: vehiculo, error: vehError } = await supabase
    .from("vehiculos")
    .select("id, user_id")
    .eq("id", vehiculoId)
    .maybeSingle();

  if (vehError || !vehiculo || vehiculo.user_id !== user.id) {
    return { success: false, error: "Vehículo no encontrado" };
  }

  const resuelto = await resolverMantenimientoIdB2C(supabase, vehiculoId, user.id);
  if (!resuelto.success) {
    return resuelto;
  }

  return actualizarCategoriaVehiculo(resuelto.mantenimientoId, categoria, data);
}
