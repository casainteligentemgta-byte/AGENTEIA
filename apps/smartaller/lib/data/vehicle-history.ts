import { createClient } from "@/lib/supabase/server";
import { normalizarPlaca } from "@/lib/vehicles/link";

export type MantenimientoHistorial = {
  id: string;
  created_at: string;
  placa: string | null;
  kilometraje: number | null;
  descripcion: string | null;
  descripcion_servicio: string | null;
  costo: number | null;
  taller_id: string | null;
  taller_nombre: string | null;
};

export type RecordatorioUsuario = {
  id: string;
  fecha_programada: string;
  kilometraje_objetivo: number | null;
  estado: string;
};

export type ResumenTallerVehiculo = {
  vinculado: boolean;
  totalVisitas: number;
  ultimaVisita: string | null;
  ultimaVisitaKm: number | null;
  ultimoCentro: string | null;
  proximoRecordatorio: RecordatorioUsuario | null;
  mantenimientos: MantenimientoHistorial[];
};

function formatFechaCorta(iso: string): string {
  return new Intl.DateTimeFormat("es-CO", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  }).format(new Date(iso));
}

export async function getResumenTallerVehiculo(
  vehiculoId: string,
  placa: string
): Promise<ResumenTallerVehiculo> {
  const supabase = createClient();
  const placaNorm = normalizarPlaca(placa);

  const { data: mantenimientos, error } = await supabase
    .from("mantenimientos")
    .select(
      "id, created_at, placa, kilometraje, descripcion, descripcion_servicio, costo, taller_id"
    )
    .eq("placa", placaNorm)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    console.error("getResumenTallerVehiculo:", error.message);
    return {
      vinculado: false,
      totalVisitas: 0,
      ultimaVisita: null,
      ultimaVisitaKm: null,
      ultimoCentro: null,
      proximoRecordatorio: null,
      mantenimientos: [],
    };
  }

  const tallerIds = [
    ...new Set((mantenimientos ?? []).map((m) => m.taller_id).filter(Boolean)),
  ] as string[];

  const talleresMap = new Map<string, string>();
  if (tallerIds.length > 0) {
    const { data: talleres } = await supabase
      .from("talleres")
      .select("id, nombre")
      .in("id", tallerIds);

    for (const t of talleres ?? []) {
      talleresMap.set(t.id, t.nombre);
    }
  }

  const historial: MantenimientoHistorial[] = (mantenimientos ?? []).map((m) => ({
    id: m.id,
    created_at: m.created_at,
    placa: m.placa,
    kilometraje: m.kilometraje,
    descripcion: m.descripcion,
    descripcion_servicio: m.descripcion_servicio,
    costo: m.costo,
    taller_id: m.taller_id,
    taller_nombre: m.taller_id ? talleresMap.get(m.taller_id) ?? null : null,
  }));

  const ultimo = historial[0] ?? null;

  const { data: recordatorios } = await supabase
    .from("recordatorios")
    .select("id, fecha_programada, kilometraje_objetivo, estado")
    .in("estado", ["pendiente", "enviado"])
    .order("fecha_programada", { ascending: true })
    .limit(1);

  const proximo = recordatorios?.[0] ?? null;

  return {
    vinculado: historial.length > 0,
    totalVisitas: historial.length,
    ultimaVisita: ultimo ? formatFechaCorta(ultimo.created_at) : null,
    ultimaVisitaKm: ultimo?.kilometraje ?? null,
    ultimoCentro: ultimo?.taller_nombre ?? null,
    proximoRecordatorio: proximo
      ? {
          id: proximo.id,
          fecha_programada: proximo.fecha_programada,
          kilometraje_objetivo: proximo.kilometraje_objetivo,
          estado: proximo.estado,
        }
      : null,
    mantenimientos: historial,
  };
}

export async function countRecordatoriosPendientesPorPlaca(
  _vehiculoId: string,
  placa: string
): Promise<number> {
  const supabase = createClient();
  const placaNorm = normalizarPlaca(placa);

  const { data, error } = await supabase.rpc("count_recordatorios_pendientes_placa", {
    p_placa: placaNorm,
  });

  if (error) {
    console.error("countRecordatoriosPendientesPorPlaca:", error.message);
    return 0;
  }

  return typeof data === "number" ? data : 0;
}
