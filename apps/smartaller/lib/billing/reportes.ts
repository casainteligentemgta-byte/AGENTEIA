import { createAdminClient } from "@/lib/supabase/admin";
import { isBillingSchemaMissing } from "@/lib/billing/schema";
import type { EstadoReportePago, MonedaPago, TipoPlanPago } from "@/lib/billing/plans";

export type ReportePago = {
  id: string;
  created_at: string;
  updated_at: string;
  user_id: string;
  tipo_plan: TipoPlanPago;
  taller_id: string | null;
  monto: number;
  moneda: MonedaPago;
  referencia: string;
  fecha_pago: string;
  comprobante_path: string | null;
  estado: EstadoReportePago;
  revisado_por: string | null;
  revisado_at: string | null;
  notas: string | null;
  periodo_inicio: string | null;
  periodo_fin: string | null;
};

const REPORTE_SELECT =
  "id, created_at, updated_at, user_id, tipo_plan, taller_id, monto, moneda, referencia, fecha_pago, comprobante_path, estado, revisado_por, revisado_at, notas, periodo_inicio, periodo_fin";

function mapReporte(row: Record<string, unknown>): ReportePago {
  return {
    id: String(row.id),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
    user_id: String(row.user_id),
    tipo_plan: row.tipo_plan as TipoPlanPago,
    taller_id: (row.taller_id as string | null) ?? null,
    monto: Number(row.monto),
    moneda: row.moneda as MonedaPago,
    referencia: String(row.referencia),
    fecha_pago: String(row.fecha_pago),
    comprobante_path: (row.comprobante_path as string | null) ?? null,
    estado: row.estado as EstadoReportePago,
    revisado_por: (row.revisado_por as string | null) ?? null,
    revisado_at: (row.revisado_at as string | null) ?? null,
    notas: (row.notas as string | null) ?? null,
    periodo_inicio: (row.periodo_inicio as string | null) ?? null,
    periodo_fin: (row.periodo_fin as string | null) ?? null,
  };
}

export async function getReportePendiente(
  userId: string,
  tipoPlan?: TipoPlanPago
): Promise<ReportePago | null> {
  try {
    const admin = createAdminClient();
    let query = admin
      .from("reportes_pago")
      .select(REPORTE_SELECT)
      .eq("user_id", userId)
      .eq("estado", "pendiente")
      .order("created_at", { ascending: false })
      .limit(1);
    if (tipoPlan) query = query.eq("tipo_plan", tipoPlan);
    const { data, error } = await query.maybeSingle();
    if (error) {
      if (!isBillingSchemaMissing(error)) {
        console.error("getReportePendiente:", error.message);
      }
      return null;
    }
    return data ? mapReporte(data as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export async function getUltimoReporteRechazado(
  userId: string,
  tipoPlan: TipoPlanPago
): Promise<ReportePago | null> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("reportes_pago")
      .select(REPORTE_SELECT)
      .eq("user_id", userId)
      .eq("tipo_plan", tipoPlan)
      .eq("estado", "rechazado")
      .order("revisado_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error || !data) return null;
    return mapReporte(data as Record<string, unknown>);
  } catch {
    return null;
  }
}

export async function listReportesPago(params?: {
  estado?: EstadoReportePago;
  limit?: number;
}): Promise<{ reportes: ReportePago[]; schemaReady: boolean; error?: string }> {
  try {
    const admin = createAdminClient();
    let query = admin
      .from("reportes_pago")
      .select(REPORTE_SELECT)
      .order("created_at", { ascending: false })
      .limit(params?.limit ?? 100);
    if (params?.estado) query = query.eq("estado", params.estado);
    const { data, error } = await query;
    if (error) {
      if (isBillingSchemaMissing(error)) {
        return { reportes: [], schemaReady: false };
      }
      return { reportes: [], schemaReady: true, error: error.message };
    }
    return {
      reportes: (data ?? []).map((row) => mapReporte(row as Record<string, unknown>)),
      schemaReady: true,
    };
  } catch (err) {
    return {
      reportes: [],
      schemaReady: false,
      error: err instanceof Error ? err.message : "No se pudieron leer los reportes",
    };
  }
}
