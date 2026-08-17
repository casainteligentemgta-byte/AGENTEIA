import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Elimina un vehículo y sus dependencias que bloquean el DELETE
 * (p. ej. mantenimientos con FK sin ON DELETE CASCADE/SET NULL en prod).
 * RLS: usar cliente admin/server tras verificar pertenencia al taller.
 */
export async function deleteVehiculoConDependencias(
  supabase: SupabaseClient,
  params: { vehiculoId: string; tallerId: string }
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { vehiculoId, tallerId } = params;

  // Evita ciclo vehiculos ↔ ordenes_recepcion si existe ultima_orden_recepcion_id.
  const { error: unlinkError } = await supabase
    .from("vehiculos")
    .update({ ultima_orden_recepcion_id: null, updated_at: new Date().toISOString() })
    .eq("id", vehiculoId)
    .eq("taller_id", tallerId);
  if (unlinkError) {
    // Columna ausente en esquemas viejos: no bloquea el borrado.
    console.warn("[deleteVehiculo] unlink ultima_orden:", unlinkError.message);
  }

  await supabase
    .from("nfc_stickers")
    .delete()
    .eq("taller_id", tallerId)
    .eq("vehiculo_id", vehiculoId);

  // Producción puede tener mantenimientos_vehiculo_id_fkey sin ON DELETE SET NULL.
  const { error: mantError } = await supabase
    .from("mantenimientos")
    .delete()
    .eq("vehiculo_id", vehiculoId);

  if (mantError) {
    return {
      ok: false,
      error: `No se pudieron eliminar los mantenimientos asociados: ${mantError.message}`,
    };
  }

  const { error } = await supabase
    .from("vehiculos")
    .delete()
    .eq("id", vehiculoId)
    .eq("taller_id", tallerId);

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true };
}
