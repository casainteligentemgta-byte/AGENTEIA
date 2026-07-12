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
  descripcion_servicio?: string | null;
  costo: number | null;
  nombre_cliente: string | null;
};

export type Vehiculo = {
  id: string;
  placa: string;
  nombre_cliente: string | null;
  telefono_cliente: string | null;
  kilometraje_ultimo: number | null;
  horas_motor_ultimo: number | null;
  tipo_vehiculo: string;
  nick: string | null;
  marca: string | null;
  modelo: string | null;
  unidad_odometro: string;
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
  vehiculosEnMantenimiento: number;
  tareasPorEjecutar: number;
  ingresosMes: number;
};

export type DashboardStatsResult = {
  stats: DashboardStats;
  error: string | null;
};

export type IngresoMensual = {
  mesKey: string;
  mes: string;
  total: number;
};

export type TopRankingItem = {
  label: string;
  sublabel?: string;
  total: number;
  count: number;
};

function startOfMonth(): string {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString();
}

function startOfToday(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function countVehiculosEnMantenimientoActivo(
  rows: { vehiculo_id: string | null; placa: string | null }[]
): number {
  const keys = new Set<string>();
  for (const row of rows) {
    const key = row.vehiculo_id ?? row.placa?.trim();
    if (key) keys.add(key);
  }
  return keys.size;
}

export async function getDashboardStats(): Promise<DashboardStatsResult> {
  const empty: DashboardStats = {
    totalVehiculos: 0,
    vehiculosEnMantenimiento: 0,
    tareasPorEjecutar: 0,
    ingresosMes: 0,
  };

  try {
    const supabase = getSupabase();
    const monthStart = startOfMonth();
    const todayStart = startOfToday();

    const [vehiculos, mantenimientosActivos, recordatorios, ingresos] = await Promise.all([
      supabase.from("vehiculos").select("id", { count: "exact", head: true }),
      supabase
        .from("mantenimientos")
        .select("vehiculo_id, placa")
        .gte("created_at", todayStart),
      supabase.from("recordatorios").select("id", { count: "exact", head: true }).eq("estado", "pendiente"),
      supabase.from("mantenimientos").select("costo").gte("created_at", monthStart),
    ]);

    const firstError =
      vehiculos.error?.message ??
      mantenimientosActivos.error?.message ??
      recordatorios.error?.message ??
      ingresos.error?.message ??
      null;

    if (firstError) {
      console.error("getDashboardStats:", firstError);
      return { stats: empty, error: firstError };
    }

    const ingresosMes = (ingresos.data ?? []).reduce((sum, m) => sum + (Number(m.costo) || 0), 0);

    return {
      stats: {
        totalVehiculos: vehiculos.count ?? 0,
        vehiculosEnMantenimiento: countVehiculosEnMantenimientoActivo(mantenimientosActivos.data ?? []),
        tareasPorEjecutar: recordatorios.count ?? 0,
        ingresosMes,
      },
      error: null,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error cargando estadísticas";
    console.error("getDashboardStats:", message);
    return { stats: empty, error: message };
  }
}

export async function getMantenimientos(limit = 20): Promise<Mantenimiento[]> {
  try {
    const supabase = getSupabase();
    const { data } = await supabase
      .from("mantenimientos")
      .select("id, created_at, placa, kilometraje, descripcion, costo, nombre_cliente")
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
      .select(
        "id, placa, nombre_cliente, telefono_cliente, kilometraje_ultimo, horas_motor_ultimo, tipo_vehiculo, nick, marca, modelo, unidad_odometro, created_at"
      )
      .order("created_at", { ascending: false });
    return (data ?? []) as Vehiculo[];
  } catch {
    return [];
  }
}

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function buildMonthBuckets(months: number): Map<string, number> {
  const buckets = new Map<string, number>();
  const start = new Date();
  start.setDate(1);
  start.setHours(0, 0, 0, 0);
  start.setMonth(start.getMonth() - (months - 1));

  for (let i = 0; i < months; i++) {
    const d = new Date(start);
    d.setMonth(start.getMonth() + i);
    buckets.set(monthKey(d), 0);
  }
  return buckets;
}

function formatMonthLabel(mesKey: string): string {
  const [year, month] = mesKey.split("-").map(Number);
  return new Intl.DateTimeFormat("es-CO", { month: "short", year: "numeric" }).format(
    new Date(year, month - 1)
  );
}

export async function getIngresosPorMes(months = 6): Promise<IngresoMensual[]> {
  try {
    const supabase = getSupabase();
    const start = new Date();
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
    start.setMonth(start.getMonth() - (months - 1));

    const { data } = await supabase
      .from("mantenimientos")
      .select("created_at, costo")
      .gte("created_at", start.toISOString());

    const buckets = buildMonthBuckets(months);
    for (const row of data ?? []) {
      const key = monthKey(new Date(row.created_at));
      if (buckets.has(key)) {
        buckets.set(key, (buckets.get(key) ?? 0) + (Number(row.costo) || 0));
      }
    }

    return Array.from(buckets.entries()).map(([mesKey, total]) => ({
      mesKey,
      mes: formatMonthLabel(mesKey),
      total,
    }));
  } catch {
    return Array.from(buildMonthBuckets(months).keys()).map((mesKey) => ({
      mesKey,
      mes: formatMonthLabel(mesKey),
      total: 0,
    }));
  }
}

function aggregateTopItems(
  rows: { label: string; sublabel?: string; costo: number | null }[],
  limit: number
): TopRankingItem[] {
  const map = new Map<string, TopRankingItem>();

  for (const row of rows) {
    const label = row.label.trim() || "Sin nombre";
    const prev = map.get(label) ?? { label, sublabel: row.sublabel, total: 0, count: 0 };
    map.set(label, {
      label,
      sublabel: row.sublabel ?? prev.sublabel,
      total: prev.total + (Number(row.costo) || 0),
      count: prev.count + 1,
    });
  }

  return Array.from(map.values())
    .sort((a, b) => b.total - a.total)
    .slice(0, limit);
}

export async function getTopClientes(limit = 5): Promise<TopRankingItem[]> {
  try {
    const supabase = getSupabase();
    const { data } = await supabase
      .from("mantenimientos")
      .select("nombre_cliente, costo")
      .not("nombre_cliente", "is", null);

    return aggregateTopItems(
      (data ?? []).map((row) => ({
        label: row.nombre_cliente ?? "Sin nombre",
        costo: row.costo,
      })),
      limit
    );
  } catch {
    return [];
  }
}

export async function getTopVehiculos(limit = 5): Promise<TopRankingItem[]> {
  try {
    const supabase = getSupabase();
    const { data } = await supabase
      .from("mantenimientos")
      .select("placa, nombre_cliente, costo")
      .not("placa", "is", null);

    return aggregateTopItems(
      (data ?? []).map((row) => ({
        label: row.placa ?? "Sin placa",
        sublabel: row.nombre_cliente ?? undefined,
        costo: row.costo,
      })),
      limit
    );
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
