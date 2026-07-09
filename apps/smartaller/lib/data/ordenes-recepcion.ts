import { createClient } from "@/lib/supabase/server";
import type {
  OrdenRecepcionChecklistRespuesta,
  OrdenRecepcionDanoVisual,
  NivelCombustible,
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

export async function getOrdenRecepcionDetalle(
  ordenId: string
): Promise<OrdenRecepcionDetalle | null> {
  try {
    const supabase = createClient();

    const { data: orden, error } = await supabase
      .from("ordenes_recepcion")
      .select(
        "id, created_at, cliente_nombre, cliente_telefono, placa, modelo, color, chasis, kilometraje, fecha_ingreso, hora_ingreso, llego_grua, vehiculo_sucio, estado_ingreso_notas, motivo_visita, nivel_combustible, autorizacion_propietario, firma_cliente, firma_asesor, firmado_cliente_at, firmado_asesor_at, mantenimiento_id, esquema_danos_meta"
      )
      .eq("id", ordenId)
      .maybeSingle();

    if (error || !orden) return null;

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

    const {
      esquema_danos_meta: _meta,
      ...ordenFields
    } = orden;

    const meta = _meta as { estadoVisual?: unknown } | null;
    const estadoVisual = parseEstadoVisualRecepcion(meta?.estadoVisual);

    return {
      ...ordenFields,
      estadoVisual,
      checklist: (checkRes.data ?? []).map((r) => ({
        itemId: r.item_id,
        marca: dbValorToMarca(r.valor),
        valor: r.valor as OrdenRecepcionChecklistRespuesta["valor"],
        notas: r.notas ?? "",
      })),
      danos: (danosRes.data ?? []).map((d) => ({
        vista: d.vista as OrdenRecepcionDanoVisual["vista"],
        zonaId: d.zona_id,
        tipo: d.tipo as OrdenRecepcionDanoVisual["tipo"],
        posicionX: Number(d.posicion_x),
        posicionY: Number(d.posicion_y),
        notas: d.notas ?? "",
      })),
    };
  } catch {
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
    const { data } = await supabase
      .from("ordenes_recepcion")
      .select("id")
      .eq("vehiculo_id", vehiculoId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!data?.id) return null;
    return getOrdenRecepcionDetalle(data.id);
  } catch {
    return null;
  }
}
