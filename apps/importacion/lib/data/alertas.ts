import { createClient } from "@/lib/supabase/server";
import { getUserVehiculos } from "@/lib/data/user-vehicles";
import { getEtiquetaVehiculo } from "@/lib/vehicles/format";
import {
  compararAlertasPorPrioridad,
  prioridadDesdeFecha,
  type PrioridadAlerta,
} from "@/lib/vehicles/recordatorio-prioridad";

export type AlertaRecordatorio = {
  id: string;
  vehiculoId: string;
  vehiculoLabel: string;
  placa: string;
  fecha_programada: string;
  kilometraje_objetivo: number | null;
  estado: string;
  prioridad: PrioridadAlerta;
  diasRestantes: number;
};

export async function getAlertasUsuario(
  limite = 10
): Promise<AlertaRecordatorio[]> {
  const vehiculos = await getUserVehiculos();
  if (vehiculos.length === 0) return [];

  const supabase = createClient();
  const vehiculoIds = vehiculos.map((v) => v.id);
  const labelMap = new Map(
    vehiculos.map((v) => [v.id, { label: getEtiquetaVehiculo(v), placa: v.placa }])
  );

  const { data, error } = await supabase
    .from("recordatorios")
    .select("id, fecha_programada, kilometraje_objetivo, estado, vehiculo_id")
    .in("vehiculo_id", vehiculoIds)
    .in("estado", ["pendiente", "enviado"])
    .order("fecha_programada", { ascending: true });

  if (error) {
    console.error("getAlertasUsuario:", error.message);
    return [];
  }

  const alertas: AlertaRecordatorio[] = (data ?? []).map((r) => {
    const meta = labelMap.get(r.vehiculo_id) ?? { label: "Vehículo", placa: "—" };
    const { prioridad, diasRestantes } = prioridadDesdeFecha(r.fecha_programada);
    return {
      id: r.id,
      vehiculoId: r.vehiculo_id,
      vehiculoLabel: meta.label,
      placa: meta.placa,
      fecha_programada: r.fecha_programada,
      kilometraje_objetivo: r.kilometraje_objetivo,
      estado: r.estado,
      prioridad,
      diasRestantes,
    };
  });

  return alertas
    .filter((a) => a.prioridad !== "normal")
    .sort(compararAlertasPorPrioridad)
    .slice(0, limite);
}

export function contarAlertasUrgentes(alertas: AlertaRecordatorio[]): number {
  return alertas.filter((a) => a.prioridad === "critico" || a.prioridad === "atencion")
    .length;
}
