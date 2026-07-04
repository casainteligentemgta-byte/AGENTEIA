import { createClient } from "@/lib/supabase/server";

function getSupabase() {
  return createClient();
}

export type Mantenimiento = {
  id: string;
  created_at: string;
  placa: string | null;
  kilometraje: number | null;
  descripcion: string | null;
  descripcion_servicio: string | null;
  costo: number | null;
  nombre_cliente: string | null;
};

export type Vehiculo = {
  id: string;
  placa: string;
  nombre_cliente: string | null;
  telefono_cliente: string | null;
  kilometraje_ultimo: number | null;
  created_at: string;
};

export type Recordatorio = {
  id: string;
  fecha_programada: string;
  kilometraje_objetivo: number | null;
  estado: string;
  vehiculo_id: string;
  vehiculos: { placa: string; nombre_cliente: string | null } | null;
};

export type DashboardStats = {
  totalVehiculos: number;
  totalMantenimientos: number;
  recordatoriosPendientes: number;
  ingresosMes: number;
};

function startOfMonth(): string {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString();
}

export async function getDashboardStats(): Promise<DashboardStats> {
  try {
    const supabase = getSupabase();
    const monthStart = startOfMonth();

    const [vehiculos, mantenimientos, recordatorios, ingresos] = await Promise.all([
      supabase.from("vehiculos").select("id", { count: "exact", head: true }),
      supabase.from("mantenimientos").select("id", { count: "exact", head: true }),
      supabase.from("recordatorios").select("id", { count: "exact", head: true }).eq("estado", "pendiente"),
      supabase.from("mantenimientos").select("costo").gte("created_at", monthStart),
    ]);

    const ingresosMes = (ingresos.data ?? []).reduce((sum, m) => sum + (Number(m.costo) || 0), 0);

    return {
      totalVehiculos: vehiculos.count ?? 0,
      totalMantenimientos: mantenimientos.count ?? 0,
      recordatoriosPendientes: recordatorios.count ?? 0,
      ingresosMes,
    };
  } catch {
    return { totalVehiculos: 0, totalMantenimientos: 0, recordatoriosPendientes: 0, ingresosMes: 0 };
  }
}

export async function getMantenimientos(limit = 20): Promise<Mantenimiento[]> {
  try {
    const supabase = getSupabase();
    const { data } = await supabase
      .from("mantenimientos")
      .select("id, created_at, placa, kilometraje, descripcion, descripcion_servicio, costo, nombre_cliente")
      .order("created_at", { ascending: false })
      .limit(limit);
    return (data ?? []) as Mantenimiento[];
  } catch {
    return [];
  }
}

export async function getVehiculos(): Promise<Vehiculo[]> {
  try {
    const supabase = getSupabase();
    const { data } = await supabase
      .from("vehiculos")
      .select("id, placa, nombre_cliente, telefono_cliente, kilometraje_ultimo, created_at")
      .order("created_at", { ascending: false });
    return (data ?? []) as Vehiculo[];
  } catch {
    return [];
  }
}

export async function getRecordatorios(): Promise<Recordatorio[]> {
  try {
    const supabase = getSupabase();
    const { data } = await supabase
      .from("recordatorios")
      .select("id, fecha_programada, kilometraje_objetivo, estado, vehiculo_id, vehiculos(placa, nombre_cliente)")
      .order("fecha_programada", { ascending: true });

    return (data ?? []).map((row) => {
      const vehiculo = Array.isArray(row.vehiculos) ? row.vehiculos[0] : row.vehiculos;
      return {
        id: row.id,
        fecha_programada: row.fecha_programada,
        kilometraje_objetivo: row.kilometraje_objetivo,
        estado: row.estado,
        vehiculo_id: row.vehiculo_id,
        vehiculos: vehiculo ?? null,
      };
    });
  } catch {
    return [];
  }
}
