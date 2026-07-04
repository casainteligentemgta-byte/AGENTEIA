import type { SupabaseClient } from "@supabase/supabase-js";

export function normalizarPlaca(placa: string): string {
  return placa.trim().toUpperCase();
}

/**
 * Reasigna mantenimientos/recordatorios de duplicados con la misma placa
 * al vehículo canónico y elimina filas huérfanas del taller.
 */
export async function fusionarVehiculosPorPlaca(
  supabase: SupabaseClient,
  placa: string,
  vehiculoCanonicoId: string
): Promise<void> {
  const placaNorm = normalizarPlaca(placa);

  const { data: duplicados } = await supabase
    .from("vehiculos")
    .select("id")
    .eq("placa", placaNorm)
    .neq("id", vehiculoCanonicoId);

  if (!duplicados?.length) return;

  const idsDuplicados = duplicados.map((v) => v.id);

  await supabase
    .from("mantenimientos")
    .update({ vehiculo_id: vehiculoCanonicoId })
    .in("vehiculo_id", idsDuplicados);

  await supabase
    .from("recordatorios")
    .update({ vehiculo_id: vehiculoCanonicoId })
    .in("vehiculo_id", idsDuplicados);

  await supabase.from("vehiculos").delete().in("id", idsDuplicados);
}
