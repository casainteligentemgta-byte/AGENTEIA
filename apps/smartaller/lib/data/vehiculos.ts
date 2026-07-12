import { createClient } from "@/lib/supabase/server";
import type { Mantenimiento, Recordatorio, Vehiculo } from "@/lib/types";

export type VehiculoDetalle = Vehiculo & {
  mantenimientos: Mantenimiento[];
  recordatorios: Recordatorio[];
};

export async function getVehiculoDetalle(id: string): Promise<VehiculoDetalle | null> {
  try {
    const supabase = createClient();

    const { data: vehiculo, error } = await supabase
      .from("vehiculos")
      .select(
        "id, placa, nombre_cliente, telefono_cliente, tipo_vehiculo, unidad_odometro, kilometraje_ultimo, horas_motor_ultimo, serial_motor, serial_carroceria, cedula_propietario, email_propietario, fecha_nacimiento_propietario, documentos, recepcion_inicial, ultima_orden_recepcion_id, marca, modelo, color, created_at, updated_at"
      )
      .eq("id", id)
      .maybeSingle();

    if (error || !vehiculo) return null;

    const [mantRes, recRes] = await Promise.all([
      supabase
        .from("mantenimientos")
        .select(
          "id, created_at, placa, kilometraje, descripcion, costo, nombre_cliente, telefono_cliente, vehiculo_id, detalle_revision"
        )
        .eq("vehiculo_id", id)
        .order("created_at", { ascending: false }),
      supabase
        .from("recordatorios")
        .select("id, vehiculo_id, mantenimiento_id, fecha_programada, kilometraje_objetivo, estado, created_at")
        .eq("vehiculo_id", id)
        .order("fecha_programada", { ascending: true }),
    ]);

    return {
      ...(vehiculo as Vehiculo),
      mantenimientos: (mantRes.data ?? []) as Mantenimiento[],
      recordatorios: (recRes.data ?? []) as Recordatorio[],
    };
  } catch {
    return null;
  }
}
