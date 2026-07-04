import { createClient } from "@/lib/supabase/server";
import { getUserVehiculos } from "@/lib/data/user-vehicles";
import { getEtiquetaVehiculo } from "@/lib/vehicles/format";

export type TimelineEvento = {
  id: string;
  fecha: string;
  descripcion: string;
  costo: number | null;
  kilometraje: number | null;
  vehiculoId: string;
  vehiculoLabel: string;
  placa: string;
  origen: "taller" | "propio";
};

export async function getTimelineUsuario(): Promise<TimelineEvento[]> {
  const vehiculos = await getUserVehiculos();
  if (vehiculos.length === 0) return [];

  const supabase = createClient();
  const vehiculoIds = vehiculos.map((v) => v.id);
  const labelMap = new Map(
    vehiculos.map((v) => [v.id, { label: getEtiquetaVehiculo(v), placa: v.placa }])
  );

  const { data, error } = await supabase
    .from("mantenimientos")
    .select(
      "id, created_at, descripcion, descripcion_servicio, costo, kilometraje, vehiculo_id, taller_id"
    )
    .in("vehiculo_id", vehiculoIds)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    console.error("getTimelineUsuario:", error.message);
    return [];
  }

  return (data ?? []).map((m) => {
    const meta = labelMap.get(m.vehiculo_id) ?? { label: "Vehículo", placa: "—" };
    return {
      id: m.id,
      fecha: m.created_at,
      descripcion: m.descripcion_servicio || m.descripcion || "Servicio",
      costo: m.costo,
      kilometraje: m.kilometraje,
      vehiculoId: m.vehiculo_id,
      vehiculoLabel: meta.label,
      placa: meta.placa,
      origen: m.taller_id ? "taller" : "propio",
    };
  });
}
