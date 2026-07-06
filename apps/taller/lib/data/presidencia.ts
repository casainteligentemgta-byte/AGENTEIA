import { createAdminClient } from "@/lib/supabase/admin";
import type { Mantenimiento, PresidenciaStats, RecordatorioConPlaca } from "@/lib/types";

function getTallerChatId(): number {
  const raw = process.env.TALLER_TELEGRAM_CHAT_ID;
  if (!raw) {
    throw new Error("Falta TALLER_TELEGRAM_CHAT_ID en las variables de entorno");
  }
  const id = Number(raw);
  if (!Number.isFinite(id)) {
    throw new Error("TALLER_TELEGRAM_CHAT_ID debe ser un número");
  }
  return id;
}

function startOfToday(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function startOfMonth(): string {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function getTallerNombre(): string {
  return process.env.TALLER_NOMBRE ?? "Taller";
}

export async function fetchPresidenciaStats(): Promise<PresidenciaStats> {
  const supabase = createAdminClient();
  const chatId = getTallerChatId();

  const { data: vehiculos } = await supabase
    .from("vehiculos")
    .select("id")
    .eq("telegram_chat_id", chatId);

  const vehiculoIds = (vehiculos ?? []).map((v) => v.id);

  const recordatoriosQuery =
    vehiculoIds.length > 0
      ? supabase
          .from("recordatorios")
          .select("id", { count: "exact", head: true })
          .in("vehiculo_id", vehiculoIds)
          .eq("estado", "pendiente")
      : Promise.resolve({ count: 0 });

  const [hoyRes, mesRes, vehiculosRes, recordatoriosRes] = await Promise.all([
    supabase
      .from("mantenimientos")
      .select("id", { count: "exact", head: true })
      .eq("telegram_chat_id", chatId)
      .gte("created_at", startOfToday()),
    supabase
      .from("mantenimientos")
      .select("id", { count: "exact", head: true })
      .eq("telegram_chat_id", chatId)
      .gte("created_at", startOfMonth()),
    supabase
      .from("vehiculos")
      .select("id", { count: "exact", head: true })
      .eq("telegram_chat_id", chatId),
    recordatoriosQuery,
  ]);

  return {
    serviciosHoy: hoyRes.count ?? 0,
    serviciosMes: mesRes.count ?? 0,
    vehiculosRegistrados: vehiculosRes.count ?? 0,
    recordatoriosPendientes: recordatoriosRes.count ?? 0,
  };
}

export async function fetchMantenimientosRecientes(limit = 25): Promise<Mantenimiento[]> {
  const supabase = createAdminClient();
  const chatId = getTallerChatId();

  const { data, error } = await supabase
    .from("mantenimientos")
    .select("*")
    .eq("telegram_chat_id", chatId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return (data ?? []) as Mantenimiento[];
}

export async function fetchRecordatoriosProximos(limit = 15): Promise<RecordatorioConPlaca[]> {
  const supabase = createAdminClient();
  const chatId = getTallerChatId();

  const { data: vehiculos, error: vehError } = await supabase
    .from("vehiculos")
    .select("id, placa, nombre_cliente")
    .eq("telegram_chat_id", chatId);

  if (vehError) throw new Error(vehError.message);
  if (!vehiculos?.length) return [];

  const vehiculoMap = new Map(
    vehiculos.map((v) => [v.id, { placa: v.placa, nombre_cliente: v.nombre_cliente }])
  );
  const vehiculoIds = vehiculos.map((v) => v.id);

  const { data, error } = await supabase
    .from("recordatorios")
    .select("*")
    .in("vehiculo_id", vehiculoIds)
    .in("estado", ["pendiente", "enviado"])
    .gte("fecha_programada", todayISO())
    .order("fecha_programada", { ascending: true })
    .limit(limit);

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => {
    const vehiculo = vehiculoMap.get(row.vehiculo_id)!;
    return {
      id: row.id,
      vehiculo_id: row.vehiculo_id,
      mantenimiento_id: row.mantenimiento_id,
      fecha_programada: row.fecha_programada,
      kilometraje_objetivo: row.kilometraje_objetivo,
      estado: row.estado as RecordatorioConPlaca["estado"],
      created_at: row.created_at,
      placa: vehiculo.placa,
      nombre_cliente: vehiculo.nombre_cliente,
    };
  });
}

export async function buscarMantenimientosPorPlaca(placa: string): Promise<Mantenimiento[]> {
  const supabase = createAdminClient();
  const chatId = getTallerChatId();
  const normalized = placa.trim().toUpperCase();

  const { data, error } = await supabase
    .from("mantenimientos")
    .select("*")
    .eq("telegram_chat_id", chatId)
    .ilike("placa", normalized)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) throw new Error(error.message);
  return (data ?? []) as Mantenimiento[];
}
