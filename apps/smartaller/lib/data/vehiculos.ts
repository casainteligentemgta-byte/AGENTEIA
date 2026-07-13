import { createClient } from "@/lib/supabase/server";
import { isMissingSchemaError } from "@/lib/db/schema-errors";
import type { Mantenimiento, Recordatorio, Vehiculo } from "@/lib/types";

export type VehiculoDetalle = Vehiculo & {
  mantenimientos: Mantenimiento[];
  recordatorios: Recordatorio[];
};

const VEHICULO_SELECT_VARIANTS: string[] = [
  "id, placa, nombre_cliente, telefono_cliente, tipo_vehiculo, unidad_odometro, kilometraje_ultimo, horas_motor_ultimo, serial_motor, serial_carroceria, cedula_propietario, email_propietario, fecha_nacimiento_propietario, documentos, recepcion_inicial, ultima_orden_recepcion_id, marca, modelo, color, user_id, created_at, updated_at",
  "id, placa, nombre_cliente, telefono_cliente, tipo_vehiculo, unidad_odometro, kilometraje_ultimo, horas_motor_ultimo, serial_motor, serial_carroceria, cedula_propietario, email_propietario, fecha_nacimiento_propietario, marca, modelo, color, user_id, created_at, updated_at",
  "id, placa, nombre_cliente, telefono_cliente, tipo_vehiculo, unidad_odometro, kilometraje_ultimo, horas_motor_ultimo, marca, modelo, color, created_at, updated_at",
];

const MANTENIMIENTO_SELECT_VARIANTS: string[] = [
  "id, created_at, placa, kilometraje, descripcion, costo, nombre_cliente, telefono_cliente, vehiculo_id, detalle_revision",
  "id, created_at, placa, kilometraje, descripcion_servicio, costo, nombre_cliente, telefono_cliente, vehiculo_id",
  "id, created_at, placa, costo, vehiculo_id, descripcion",
];

async function fetchVehiculoRow(
  supabase: ReturnType<typeof createClient>,
  id: string
): Promise<Record<string, unknown> | null> {
  let lastError: string | undefined;

  for (const columns of VEHICULO_SELECT_VARIANTS) {
    const { data, error } = await supabase
      .from("vehiculos")
      .select(columns)
      .eq("id", id)
      .maybeSingle();

    if (!error && data) {
      return data as unknown as Record<string, unknown>;
    }

    lastError = error?.message;
    if (error && !isMissingSchemaError(error.message)) {
      console.error("getVehiculoDetalle vehiculo:", error.message);
      return null;
    }
  }

  if (lastError) {
    console.error("getVehiculoDetalle vehiculo:", lastError);
  }
  return null;
}

async function fetchMantenimientos(
  supabase: ReturnType<typeof createClient>,
  vehiculoId: string
): Promise<Mantenimiento[]> {
  for (const columns of MANTENIMIENTO_SELECT_VARIANTS) {
    const { data, error } = await supabase
      .from("mantenimientos")
      .select(columns)
      .eq("vehiculo_id", vehiculoId)
      .order("created_at", { ascending: false });

    if (!error) {
      return (data ?? []).map((row) => {
        const item = row as unknown as Record<string, unknown>;
        return {
          ...item,
          descripcion:
            (item.descripcion as string | null | undefined) ??
            (item.descripcion_servicio as string | null | undefined) ??
            null,
        } as Mantenimiento;
      });
    }

    if (!isMissingSchemaError(error.message)) {
      console.error("getVehiculoDetalle mantenimientos:", error.message);
      return [];
    }
  }

  return [];
}

function normalizeVehiculoRow(row: Record<string, unknown>): Vehiculo {
  return {
    id: String(row.id),
    placa: String(row.placa ?? ""),
    nombre_cliente: (row.nombre_cliente as string | null) ?? null,
    telefono_cliente: (row.telefono_cliente as string | null) ?? null,
    tipo_vehiculo: (row.tipo_vehiculo as string | null) ?? null,
    unidad_odometro: (row.unidad_odometro as string | null) ?? null,
    kilometraje_ultimo: (row.kilometraje_ultimo as number | null) ?? null,
    horas_motor_ultimo: (row.horas_motor_ultimo as number | null) ?? null,
    serial_motor: (row.serial_motor as string | null) ?? null,
    serial_carroceria: (row.serial_carroceria as string | null) ?? null,
    cedula_propietario: (row.cedula_propietario as string | null) ?? null,
    email_propietario: (row.email_propietario as string | null) ?? null,
    fecha_nacimiento_propietario: (row.fecha_nacimiento_propietario as string | null) ?? null,
    documentos: (row.documentos as Record<string, unknown> | null) ?? null,
    recepcion_inicial: (row.recepcion_inicial as Record<string, unknown> | null) ?? null,
    ultima_orden_recepcion_id: (row.ultima_orden_recepcion_id as string | null) ?? null,
    marca: (row.marca as string | null) ?? null,
    modelo: (row.modelo as string | null) ?? null,
    color: (row.color as string | null) ?? null,
    user_id: (row.user_id as string | null) ?? null,
    created_at: String(row.created_at ?? ""),
    updated_at: String(row.updated_at ?? row.created_at ?? ""),
  };
}

export async function getVehiculoDetalle(id: string): Promise<VehiculoDetalle | null> {
  try {
    const supabase = createClient();
    const row = await fetchVehiculoRow(supabase, id);
    if (!row) return null;

    const vehiculo = normalizeVehiculoRow(row);

    const [mantenimientos, recRes] = await Promise.all([
      fetchMantenimientos(supabase, id),
      supabase
        .from("recordatorios")
        .select(
          "id, vehiculo_id, mantenimiento_id, fecha_programada, kilometraje_objetivo, estado, created_at"
        )
        .eq("vehiculo_id", id)
        .order("fecha_programada", { ascending: true }),
    ]);

    if (recRes.error) {
      console.error("getVehiculoDetalle recordatorios:", recRes.error.message);
    }

    return {
      ...vehiculo,
      mantenimientos,
      recordatorios: (recRes.data ?? []) as Recordatorio[],
    };
  } catch (err) {
    console.error(
      "getVehiculoDetalle:",
      err instanceof Error ? err.message : err
    );
    return null;
  }
}
