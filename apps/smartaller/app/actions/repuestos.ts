"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient, getUser } from "@/lib/supabase/server";
import { getMyTaller } from "@/lib/taller";
import type { RepuestoLineaInput } from "@/lib/repuestos/types";
import {
  createRepuestoSchema,
  repuestosLineasSchema,
  updateRepuestoSchema,
  type RepuestoLineaParsed,
} from "@/lib/validations/repuestos";

export type RepuestoActionResult =
  | { success: true }
  | { success: false; error: string };

export type CreateRepuestoResult =
  | { success: true; repuestoId: string }
  | { success: false; error: string };

export async function createRepuestoAction(raw: unknown): Promise<CreateRepuestoResult> {
  const user = await getUser();
  if (!user) return { success: false, error: "Debes iniciar sesión" };

  const taller = await getMyTaller();
  if (!taller) return { success: false, error: "No se encontró tu taller" };

  const parsed = createRepuestoSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message ?? "Datos inválidos" };
  }

  const data = parsed.data;
  const supabase = createClient();

  const { data: repuesto, error } = await supabase
    .from("repuestos")
    .insert({
      taller_id: taller.id,
      nombre: data.nombre.trim(),
      sku: data.sku?.trim() || null,
      unidad: data.unidad?.trim() || "und",
      precio_venta: data.precioVenta,
      stock_actual: data.stockActual ?? 0,
      stock_minimo: data.stockMinimo ?? 0,
    })
    .select("id")
    .single();

  if (error || !repuesto) {
    return { success: false, error: error?.message ?? "No se pudo crear el repuesto" };
  }

  revalidatePath("/dashboard/repuestos");
  return { success: true, repuestoId: repuesto.id };
}

export async function updateRepuestoAction(raw: unknown): Promise<RepuestoActionResult> {
  const user = await getUser();
  if (!user) return { success: false, error: "Debes iniciar sesión" };

  const taller = await getMyTaller();
  if (!taller) return { success: false, error: "No se encontró tu taller" };

  const parsed = updateRepuestoSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message ?? "Datos inválidos" };
  }

  const data = parsed.data;
  const supabase = createClient();

  const { error } = await supabase
    .from("repuestos")
    .update({
      nombre: data.nombre.trim(),
      sku: data.sku?.trim() || null,
      unidad: data.unidad?.trim() || "und",
      precio_venta: data.precioVenta,
      stock_actual: data.stockActual ?? 0,
      stock_minimo: data.stockMinimo ?? 0,
      updated_at: new Date().toISOString(),
    })
    .eq("id", data.id)
    .eq("taller_id", taller.id);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/dashboard/repuestos");
  return { success: true };
}

export async function deactivateRepuestoAction(repuestoId: string): Promise<RepuestoActionResult> {
  const user = await getUser();
  if (!user) return { success: false, error: "Debes iniciar sesión" };

  const taller = await getMyTaller();
  if (!taller) return { success: false, error: "No se encontró tu taller" };

  const supabase = createClient();
  const { error } = await supabase
    .from("repuestos")
    .update({ activo: false, updated_at: new Date().toISOString() })
    .eq("id", repuestoId)
    .eq("taller_id", taller.id);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/dashboard/repuestos");
  return { success: true };
}

async function verifyMantenimientoTaller(
  mantenimientoId: string,
  tallerId: string
): Promise<{ vehiculoId: string | null } | null> {
  const supabase = createClient();
  const { data } = await supabase
    .from("mantenimientos")
    .select("id, vehiculo_id, taller_id")
    .eq("id", mantenimientoId)
    .maybeSingle();

  if (!data || data.taller_id !== tallerId) return null;
  return { vehiculoId: data.vehiculo_id };
}

export async function addRepuestosToMantenimiento(
  mantenimientoId: string,
  lineas: RepuestoLineaParsed[]
): Promise<RepuestoActionResult> {
  const user = await getUser();
  if (!user) return { success: false, error: "Debes iniciar sesión" };

  const taller = await getMyTaller();
  if (!taller) return { success: false, error: "No se encontró tu taller" };

  const parsed = repuestosLineasSchema.safeParse(lineas);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message ?? "Líneas inválidas" };
  }

  if (parsed.data.length === 0) {
    return { success: true };
  }

  const mant = await verifyMantenimientoTaller(mantenimientoId, taller.id);
  if (!mant) return { success: false, error: "Orden de servicio no encontrada" };

  const admin = createAdminClient();
  const rows = parsed.data.map((linea) => {
    const subtotal = Math.round(linea.cantidad * linea.precioUnitario * 100) / 100;
    return {
      mantenimiento_id: mantenimientoId,
      repuesto_id: linea.repuestoId ?? null,
      nombre: linea.nombre.trim(),
      cantidad: linea.cantidad,
      precio_unitario: linea.precioUnitario,
      subtotal,
    };
  });

  const { error: insertError } = await admin.from("mantenimiento_repuestos").insert(rows);
  if (insertError) {
    return { success: false, error: insertError.message };
  }

  for (const linea of parsed.data) {
    if (!linea.repuestoId) continue;
    const { data: repuesto } = await admin
      .from("repuestos")
      .select("stock_actual")
      .eq("id", linea.repuestoId)
      .eq("taller_id", taller.id)
      .maybeSingle();

    if (!repuesto) continue;

    const nuevoStock = Math.max(0, Number(repuesto.stock_actual) - linea.cantidad);
    await admin
      .from("repuestos")
      .update({ stock_actual: nuevoStock, updated_at: new Date().toISOString() })
      .eq("id", linea.repuestoId);
  }

  const totalRepuestos = rows.reduce((sum, r) => sum + Number(r.subtotal), 0);
  const { data: mantenimiento } = await admin
    .from("mantenimientos")
    .select("costo")
    .eq("id", mantenimientoId)
    .maybeSingle();

  if (mantenimiento && (mantenimiento.costo == null || Number(mantenimiento.costo) === 0)) {
    await admin
      .from("mantenimientos")
      .update({ costo: totalRepuestos })
      .eq("id", mantenimientoId);
  }

  revalidatePath("/dashboard/mantenimientos");
  revalidatePath("/dashboard/repuestos");
  if (mant.vehiculoId) {
    revalidatePath(`/dashboard/vehiculos/${mant.vehiculoId}`);
    revalidatePath(`/app/vehiculos/${mant.vehiculoId}`);
    revalidatePath("/app/timeline");
  }

  return { success: true };
}

export async function addRepuestosFromFormData(
  mantenimientoId: string,
  formData: FormData
): Promise<RepuestoActionResult> {
  const raw = String(formData.get("repuestosLineas") ?? "[]");
  let lineas: RepuestoLineaInput[] = [];
  try {
    lineas = JSON.parse(raw);
  } catch {
    return { success: false, error: "Formato de repuestos inválido" };
  }
  return addRepuestosToMantenimiento(mantenimientoId, lineas);
}
