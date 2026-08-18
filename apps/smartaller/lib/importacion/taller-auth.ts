import { createAdminClient } from "@/lib/supabase/admin";
import { getUser } from "@/lib/supabase/server";
import { getMyTaller, type Taller } from "@/lib/taller";
import type { User } from "@supabase/supabase-js";

export type TallerAuthOk = {
  error: null;
  taller: Taller;
  user: User;
};

export type TallerAuthFail = {
  error: string;
  taller: null;
  user: User | null;
};

export type TallerAuthResult = TallerAuthOk | TallerAuthFail;

/**
 * Gate de Server Actions del módulo Importación / Puerto Libre.
 * Usar siempre antes de `createAdminClient()` en mutaciones.
 */
export async function requireTallerAuth(): Promise<TallerAuthResult> {
  const user = await getUser();
  if (!user) {
    return { error: "Debes iniciar sesión", taller: null, user: null };
  }
  const taller = await getMyTaller();
  if (!taller) {
    return { error: "No se encontró tu taller", taller: null, user };
  }
  return { error: null, taller, user };
}

export type VehiculoTallerRow = {
  id: string;
  taller_id: string;
  placa: string | null;
  documentos: unknown;
  importacion: unknown;
  seguro: unknown;
};

/**
 * Ownership: el vehículo debe pertenecer al taller del contexto.
 * Las actions usan service role (saltan RLS); este check es obligatorio.
 * Devuelve la fila o `null` si no existe / no es del taller.
 */
export async function assertVehiculoTaller(
  vehiculoId: string,
  tallerId: string
): Promise<VehiculoTallerRow | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("vehiculos")
    .select("id, taller_id, placa, documentos, importacion, seguro")
    .eq("id", vehiculoId)
    .maybeSingle();
  if (!data || data.taller_id !== tallerId) return null;
  return data as VehiculoTallerRow;
}
