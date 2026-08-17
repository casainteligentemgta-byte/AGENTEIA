import { createClient } from "@/lib/supabase/server";
import type { MantenimientoRepuestoLinea, Repuesto } from "@/lib/repuestos/types";

export async function getRepuestosTaller(): Promise<Repuesto[]> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("repuestos")
      .select(
        "id, taller_id, nombre, sku, unidad, precio_venta, stock_actual, stock_minimo, activo, created_at"
      )
      .eq("activo", true)
      .order("nombre");

    if (error) {
      console.error("getRepuestosTaller:", error.message);
      return [];
    }
    return (data ?? []) as Repuesto[];
  } catch (err) {
    console.error("getRepuestosTaller:", err instanceof Error ? err.message : err);
    return [];
  }
}

export async function getRepuestosPorMantenimiento(
  mantenimientoId: string
): Promise<MantenimientoRepuestoLinea[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("mantenimiento_repuestos")
    .select(
      "id, mantenimiento_id, repuesto_id, nombre, cantidad, precio_unitario, subtotal, created_at"
    )
    .eq("mantenimiento_id", mantenimientoId)
    .order("created_at");

  if (error) return [];
  return (data ?? []) as MantenimientoRepuestoLinea[];
}

export async function getRepuestosPorMantenimientoIds(
  mantenimientoIds: string[]
): Promise<Map<string, MantenimientoRepuestoLinea[]>> {
  const map = new Map<string, MantenimientoRepuestoLinea[]>();
  if (mantenimientoIds.length === 0) return map;

  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("mantenimiento_repuestos")
      .select(
        "id, mantenimiento_id, repuesto_id, nombre, cantidad, precio_unitario, subtotal, created_at"
      )
      .in("mantenimiento_id", mantenimientoIds)
      .order("created_at");

    if (error) {
      console.error("getRepuestosPorMantenimientoIds:", error.message);
      return map;
    }

    for (const row of (data ?? []) as MantenimientoRepuestoLinea[]) {
      const list = map.get(row.mantenimiento_id) ?? [];
      list.push(row);
      map.set(row.mantenimiento_id, list);
    }

    return map;
  } catch (err) {
    console.error(
      "getRepuestosPorMantenimientoIds:",
      err instanceof Error ? err.message : err
    );
    return map;
  }
}
