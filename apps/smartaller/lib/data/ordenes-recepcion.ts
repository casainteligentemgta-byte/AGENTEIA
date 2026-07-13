import { createClient } from "@/lib/supabase/server";
import { isMissingSchemaError } from "@/lib/db/schema-errors";
import { normalizeHoraIngreso } from "@/lib/format";
import type {
  OrdenRecepcionChecklistRespuesta,
  OrdenRecepcionDanoVisual,
} from "@/lib/schemas/orden-recepcion";
import { dbValorToMarca } from "@/lib/schemas/orden-recepcion";
import {
  parseEstadoVisualRecepcion,
  type EstadoVisualRecepcion,
} from "@/lib/schemas/estado-visual-recepcion";

export type OrdenRecepcionDetalle = {
  id: string;
  created_at: string;
  cliente_nombre: string;
  cliente_telefono: string;
  placa: string;
  modelo: string | null;
  color: string | null;
  chasis: string | null;
  kilometraje: number | null;
  fecha_ingreso: string;
  hora_ingreso: string | null;
  llego_grua: boolean;
  vehiculo_sucio: boolean;
  estado_ingreso_notas: string | null;
  motivo_visita: string | null;
  nivel_combustible: string | null;
  autorizacion_propietario: boolean;
  firma_cliente: string | null;
  firma_asesor: string | null;
  firmado_cliente_at: string | null;
  firmado_asesor_at: string | null;
  mantenimiento_id: string | null;
  checklist: OrdenRecepcionChecklistRespuesta[];
  danos: OrdenRecepcionDanoVisual[];
  estadoVisual: EstadoVisualRecepcion | null;
};

const ORDEN_SELECT_VARIANTS = [
  "id, created_at, cliente_nombre, cliente_telefono, placa, modelo, color, chasis, kilometraje, fecha_ingreso, hora_ingreso, llego_grua, vehiculo_sucio, estado_ingreso_notas, motivo_visita, nivel_combustible, autorizacion_propietario, firma_cliente, firma_asesor, firmado_cliente_at, firmado_asesor_at, mantenimiento_id, esquema_danos_meta",
  "id, created_at, cliente_nombre, cliente_telefono, placa, modelo, color, chasis, kilometraje, fecha_ingreso, hora_ingreso, llego_grua, vehiculo_sucio, estado_ingreso_notas, motivo_visita, firma_cliente, firma_asesor, firmado_cliente_at, firmado_asesor_at, mantenimiento_id",
  "id, created_at, cliente_nombre, cliente_telefono, placa, modelo, color, chasis, kilometraje, fecha_ingreso, hora_ingreso, motivo_visita, mantenimiento_id",
] as const;

function mapOrdenRow(
  orden: Record<string, unknown>,
  checklist: OrdenRecepcionChecklistRespuesta[],
  danos: OrdenRecepcionDanoVisual[]
): OrdenRecepcionDetalle {
  const meta = orden.esquema_danos_meta as { estadoVisual?: unknown } | null | undefined;
  const estadoVisual = parseEstadoVisualRecepcion(meta?.estadoVisual);

  return {
    id: String(orden.id),
    created_at: String(orden.created_at ?? ""),
    cliente_nombre: String(orden.cliente_nombre ?? ""),
    cliente_telefono: String(orden.cliente_telefono ?? ""),
    placa: String(orden.placa ?? ""),
    modelo: (orden.modelo as string | null) ?? null,
    color: (orden.color as string | null) ?? null,
    chasis: (orden.chasis as string | null) ?? null,
    kilometraje: (orden.kilometraje as number | null) ?? null,
    fecha_ingreso: String(orden.fecha_ingreso ?? ""),
    hora_ingreso: normalizeHoraIngreso(orden.hora_ingreso),
    llego_grua: Boolean(orden.llego_grua),
    vehiculo_sucio: Boolean(orden.vehiculo_sucio),
    estado_ingreso_notas: (orden.estado_ingreso_notas as string | null) ?? null,
    motivo_visita: (orden.motivo_visita as string | null) ?? null,
    nivel_combustible: (orden.nivel_combustible as string | null) ?? null,
    autorizacion_propietario: Boolean(orden.autorizacion_propietario),
    firma_cliente: (orden.firma_cliente as string | null) ?? null,
    firma_asesor: (orden.firma_asesor as string | null) ?? null,
    firmado_cliente_at: (orden.firmado_cliente_at as string | null) ?? null,
    firmado_asesor_at: (orden.firmado_asesor_at as string | null) ?? null,
    mantenimiento_id: (orden.mantenimiento_id as string | null) ?? null,
    checklist,
    danos,
    estadoVisual,
  };
}

async function fetchOrdenRow(
  supabase: ReturnType<typeof createClient>,
  ordenId: string
): Promise<Record<string, unknown> | null> {
  for (const columns of ORDEN_SELECT_VARIANTS) {
    const { data, error } = await supabase
      .from("ordenes_recepcion")
      .select(columns)
      .eq("id", ordenId)
      .maybeSingle();

    if (!error && data) {
      return data as Record<string, unknown>;
    }

    if (error && !isMissingSchemaError(error.message)) {
      if (error.message.includes("ordenes_recepcion")) {
        return null;
      }
      console.error("getOrdenRecepcionDetalle:", error.message);
      return null;
    }
  }

  return null;
}

export async function getOrdenRecepcionDetalle(
  ordenId: string
): Promise<OrdenRecepcionDetalle | null> {
  try {
    const supabase = createClient();
    const orden = await fetchOrdenRow(supabase, ordenId);
    if (!orden) return null;

    const [checkRes, danosRes] = await Promise.all([
      supabase
        .from("orden_recepcion_checklist")
        .select("item_id, valor, notas")
        .eq("orden_recepcion_id", ordenId),
      supabase
        .from("orden_recepcion_danos")
        .select("vista, zona_id, tipo, posicion_x, posicion_y, notas")
        .eq("orden_recepcion_id", ordenId),
    ]);

    const checklist = (checkRes.data ?? []).map((r) => ({
      itemId: r.item_id,
      marca: dbValorToMarca(r.valor),
      valor: r.valor as OrdenRecepcionChecklistRespuesta["valor"],
      notas: r.notas ?? "",
    }));

    const danos = (danosRes.data ?? []).map((d) => ({
      vista: d.vista as OrdenRecepcionDanoVisual["vista"],
      zonaId: d.zona_id,
      tipo: d.tipo as OrdenRecepcionDanoVisual["tipo"],
      posicionX: Number(d.posicion_x),
      posicionY: Number(d.posicion_y),
      notas: d.notas ?? "",
    }));

    return mapOrdenRow(orden, checklist, danos);
  } catch (err) {
    console.error(
      "getOrdenRecepcionDetalle:",
      err instanceof Error ? err.message : err
    );
    return null;
  }
}

export async function getUltimaOrdenRecepcionVehiculo(
  vehiculoId: string,
  ultimaOrdenId?: string | null
): Promise<OrdenRecepcionDetalle | null> {
  if (ultimaOrdenId) {
    const orden = await getOrdenRecepcionDetalle(ultimaOrdenId);
    if (orden) return orden;
  }

  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("ordenes_recepcion")
      .select("id")
      .eq("vehiculo_id", vehiculoId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      if (!isMissingSchemaError(error.message)) {
        console.error("getUltimaOrdenRecepcionVehiculo:", error.message);
      }
      return null;
    }

    if (!data?.id) return null;
    return getOrdenRecepcionDetalle(data.id);
  } catch (err) {
    console.error(
      "getUltimaOrdenRecepcionVehiculo:",
      err instanceof Error ? err.message : err
    );
    return null;
  }
}
