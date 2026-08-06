import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Normalización y unicidad de serial de carrocería / chasis.
 */

/** Compacta: mayúsculas, sin espacios. */
export function normalizarSerialCarroceria(serial: string): string {
  return serial.trim().toUpperCase().replace(/\s+/g, "");
}

/** Solo alfanumérico (útil para OCR con guiones/puntos). */
export function compactarSerial(serial: string): string {
  return serial.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/**
 * Compara seriales tolerando espacios, guiones y lecturas parciales largas.
 */
export function serialesCoinciden(a: string, b: string): boolean {
  const x = compactarSerial(a);
  const y = compactarSerial(b);
  if (!x || !y) return false;
  if (x === y) return true;
  // VIN parcial: si ambos tienen ≥8 chars y uno contiene al otro.
  if (x.length >= 8 && y.length >= 8 && (x.includes(y) || y.includes(x))) {
    return true;
  }
  return false;
}

export const SERIAL_CARROCERIA_DUPLICADO =
  "Ya existe un vehículo con ese serial de carrocería.";

/**
 * Busca otro vehículo del taller con el mismo serial de carrocería
 * (comparación normalizada: mayúsculas, sin espacios).
 * Usar cliente server/admin; siempre filtrar por taller_id (RLS + tenant).
 */
export async function findDuplicateSerialCarroceria(
  supabase: SupabaseClient,
  tallerId: string,
  serial: string,
  excludeVehiculoId?: string
): Promise<{ id: string } | null> {
  const norm = normalizarSerialCarroceria(serial);
  if (!norm) return null;

  const base = supabase
    .from("vehiculos")
    .select("id, serial_carroceria")
    .eq("taller_id", tallerId)
    .not("serial_carroceria", "is", null);

  const { data, error } = excludeVehiculoId
    ? await base.neq("id", excludeVehiculoId)
    : await base;

  if (error || !data?.length) return null;

  const hit = data.find(
    (row) => normalizarSerialCarroceria(String(row.serial_carroceria ?? "")) === norm
  );
  return hit ? { id: hit.id } : null;
}
