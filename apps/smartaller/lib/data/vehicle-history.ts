import { createClient } from "@/lib/supabase/server";
import { normalizarPlaca } from "@/lib/vehicles/link";
import { getRepuestosPorMantenimientoIds } from "@/lib/data/repuestos";
import type { MantenimientoRepuestoLinea } from "@/lib/repuestos/types";

export type MantenimientoHistorial = {
  id: string;
  created_at: string;
  placa: string | null;
  kilometraje: number | null;
  descripcion: string | null;
  costo: number | null;
  taller_id: string | null;
  taller_nombre: string | null;
  detalle_revision: Record<string, unknown> | null;
  repuestos: MantenimientoRepuestoLinea[];
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
  recordatoriosPendientes: RecordatorioUsuario[];
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
  _placa: string
): Promise<ResumenTallerVehiculo> {
  const supabase = createClient();

  const { data: mantenimientos, error } = await supabase
    .from("mantenimientos")
    .select(
      "id, created_at, placa, kilometraje, descripcion, costo, taller_id, detalle_revision"
    )
    .eq("vehiculo_id", vehiculoId)
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
      recordatoriosPendientes: [],
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

  const historialBase: Omit<MantenimientoHistorial, "repuestos">[] = (mantenimientos ?? []).map(
    (m) => ({
      id: m.id,
      created_at: m.created_at,
      placa: m.placa,
      kilometraje: m.kilometraje,
      descripcion: m.descripcion,
      costo: m.costo,
      taller_id: m.taller_id,
      taller_nombre: m.taller_id ? talleresMap.get(m.taller_id) ?? null : null,
      detalle_revision:
        m.detalle_revision && typeof m.detalle_revision === "object"
          ? (m.detalle_revision as Record<string, unknown>)
          : null,
    })
  );

  const repuestosMap = await getRepuestosPorMantenimientoIds(
    historialBase.map((m) => m.id)
  );

  const historial: MantenimientoHistorial[] = historialBase.map((m) => ({
    ...m,
    repuestos: repuestosMap.get(m.id) ?? [],
  }));

  const ultimo = historial[0] ?? null;

  const { data: recordatorios } = await supabase
    .from("recordatorios")
    .select("id, fecha_programada, kilometraje_objetivo, estado")
    .eq("vehiculo_id", vehiculoId)
    .in("estado", ["pendiente", "enviado"])
    .order("fecha_programada", { ascending: true });

  const recordatoriosPendientes: RecordatorioUsuario[] = (recordatorios ?? []).map((r) => ({
    id: r.id,
    fecha_programada: r.fecha_programada,
    kilometraje_objetivo: r.kilometraje_objetivo,
    estado: r.estado,
  }));

  const proximo = recordatoriosPendientes[0] ?? null;

  return {
    vinculado: historial.length > 0,
    totalVisitas: historial.length,
    ultimaVisita: ultimo ? formatFechaCorta(ultimo.created_at) : null,
    ultimaVisitaKm: ultimo?.kilometraje ?? null,
    ultimoCentro: ultimo?.taller_nombre ?? null,
    proximoRecordatorio: proximo,
    recordatoriosPendientes,
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
