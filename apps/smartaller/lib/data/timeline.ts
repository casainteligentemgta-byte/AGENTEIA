import { createClient } from "@/lib/supabase/server";
import { getUserVehiculos } from "@/lib/data/user-vehicles";
import { getEtiquetaVehiculo } from "@/lib/vehicles/format";
import type { CategoriaVehiculoId } from "@/lib/schemas/categoria-vehiculo";
import {
  eventoCoincideCategoria,
  inferirCategoriasEvento,
} from "@/lib/vehicles/inferir-categorias-evento";

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
  categorias: CategoriaVehiculoId[];
};

export async function getTimelineUsuario(
  categoriaFiltro: CategoriaVehiculoId | null = null
): Promise<TimelineEvento[]> {
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
      "id, created_at, descripcion, costo, kilometraje, vehiculo_id, taller_id, detalle_revision"
    )
    .in("vehiculo_id", vehiculoIds)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    console.error("getTimelineUsuario:", error.message);
    return [];
  }

  const eventos: TimelineEvento[] = (data ?? []).map((m) => {
    const meta = labelMap.get(m.vehiculo_id) ?? { label: "Vehículo", placa: "—" };
    const categorias = inferirCategoriasEvento(
      m.descripcion,
      null,
      m.detalle_revision
    );

    return {
      id: m.id,
      fecha: m.created_at,
      descripcion: m.descripcion || "Servicio",
      costo: m.costo,
      kilometraje: m.kilometraje,
      vehiculoId: m.vehiculo_id,
      vehiculoLabel: meta.label,
      placa: meta.placa,
      origen: m.taller_id ? "taller" : "propio",
      categorias,
    };
  });

  return eventos.filter((e) => eventoCoincideCategoria(e.categorias, categoriaFiltro));
}
