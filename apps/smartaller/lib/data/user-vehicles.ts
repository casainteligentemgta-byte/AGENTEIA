import { createClient } from "@/lib/supabase/server";
import type { VehiculoUsuario } from "@/lib/vehicles/types";

export async function getUserVehiculos(): Promise<VehiculoUsuario[]> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return [];

  const { data, error } = await supabase
    .from("vehiculos")
    .select(
      "id, tipo_vehiculo, nick, marca, modelo, color, placa, kilometraje_ultimo, horas_motor_ultimo, unidad_odometro, created_at"
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("getUserVehiculos:", error.message);
    return [];
  }

  return (data ?? []) as VehiculoUsuario[];
}

export async function getUserVehiculoById(id: string): Promise<VehiculoUsuario | null> {
  const supac = createClient();
  const {
    data: { user },
  } = await supac.auth.getUser();

  if (!user) return null;

  const { data, error } = await supac
    .from("vehiculos")
    .select(
      "id, tipo_vehiculo, nick, marca, modelo, color, placa, kilometraje_ultimo, horas_motor_ultimo, unidad_odometro, created_at"
    )
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error || !data) return null;
  return data as VehiculoUsuario;
}

export async function countRecordatoriosPendientes(vehiculoId: string): Promise<number> {
  const supabase = createClient();
  const { count } = await supabase
    .from("recordatorios")
    .select("id", { count: "exact", head: true })
    .eq("vehiculo_id", vehiculoId)
    .eq("estado", "pendiente");

  return count ?? 0;
}
