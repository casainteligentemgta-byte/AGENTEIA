"use server";

import { revalidatePath } from "next/cache";
import {
  isMissingRelation,
  labelExpedienteEnlace,
  type ExpedienteEnlace,
} from "@/lib/importacion/expediente-enlace";
import { vehiculoPatchFromSeguro } from "@/lib/importacion/seguro-asignacion";
import {
  SEGURO_FICHA_SELECT,
  asignarFichaSchema,
  seguroFichaUpsertSchema,
  type SeguroFichaRow,
} from "@/lib/schemas/seguro-ficha";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUser } from "@/lib/supabase/server";
import { ensureTallerForUser } from "@/lib/taller";

export type SeguroFichaListItem = {
  id: string;
  aseguradora: string;
  numeroPoliza: string | null;
  tipoCobertura: string | null;
  vigenciaDesde: string | null;
  vigenciaHasta: string | null;
  montoAsegurado: number | null;
  telefonoAseguradora: string | null;
  corredor: string | null;
  observaciones: string | null;
  createdAt: string;
  expedientesCount: number;
};

type ActionOk<T> = { success: true } & T;
type ActionErr = { success: false; error: string };

function mapRow(row: SeguroFichaRow, count = 0): SeguroFichaListItem {
  return {
    id: row.id,
    aseguradora: row.aseguradora,
    numeroPoliza: row.numero_poliza,
    tipoCobertura: row.tipo_cobertura,
    vigenciaDesde: row.vigencia_desde,
    vigenciaHasta: row.vigencia_hasta,
    montoAsegurado:
      row.monto_asegurado == null ? null : Number(row.monto_asegurado),
    telefonoAseguradora: row.telefono_aseguradora,
    corredor: row.corredor,
    observaciones: row.observaciones,
    createdAt: row.created_at,
    expedientesCount: count,
  };
}

async function requireTallerAuth() {
  const user = await getUser();
  if (!user) return { error: "Debes iniciar sesión" as const, taller: null };
  const { taller } = await ensureTallerForUser(user.id);
  if (!taller) return { error: "No se encontró tu taller" as const, taller: null };
  return { error: null, taller };
}

function revalidateSeguro(fichaId?: string, vehiculoId?: string) {
  revalidatePath("/smartimport");
  revalidatePath("/smartimport/seguros");
  if (fichaId) revalidatePath(`/smartimport/seguros/${fichaId}`);
  if (vehiculoId) {
    revalidatePath(`/smartimport/${vehiculoId}`);
    revalidatePath(`/smartimport/${vehiculoId}/planilla`);
  }
}

async function countByFicha(
  admin: ReturnType<typeof createAdminClient>,
  tallerId: string,
  ids: string[]
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (ids.length === 0) return counts;
  const { data, error } = await admin
    .from("vehiculos")
    .select("seguro_ficha_id")
    .eq("taller_id", tallerId)
    .in("seguro_ficha_id", ids);
  if (error || !data) return counts;
  for (const row of data) {
    const id = row.seguro_ficha_id as string | null;
    if (!id) continue;
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return counts;
}

export async function listSegurosAction(): Promise<
  ActionOk<{ fichas: SeguroFichaListItem[] }> | ActionErr
> {
  const auth = await requireTallerAuth();
  if (auth.error || !auth.taller) {
    return { success: false, error: auth.error ?? "No autorizado" };
  }
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("seguros_ficha")
    .select(SEGURO_FICHA_SELECT)
    .eq("taller_id", auth.taller.id)
    .eq("activo", true)
    .order("aseguradora", { ascending: true })
    .limit(300);
  if (error) {
    if (isMissingRelation(error, ["seguros_ficha"])) {
      return { success: true, fichas: [] };
    }
    return { success: false, error: error.message };
  }
  const rows = (data ?? []) as SeguroFichaRow[];
  const counts = await countByFicha(
    admin,
    auth.taller.id,
    rows.map((r) => r.id)
  );
  return {
    success: true,
    fichas: rows.map((row) => mapRow(row, counts.get(row.id) ?? 0)),
  };
}

export async function getSeguroFichaAction(
  id: string
): Promise<ActionOk<{ ficha: SeguroFichaListItem }> | ActionErr> {
  const auth = await requireTallerAuth();
  if (auth.error || !auth.taller) {
    return { success: false, error: auth.error ?? "No autorizado" };
  }
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("seguros_ficha")
    .select(SEGURO_FICHA_SELECT)
    .eq("id", id)
    .eq("taller_id", auth.taller.id)
    .maybeSingle();
  if (error) {
    if (isMissingRelation(error, ["seguros_ficha"])) {
      return { success: false, error: "Aplica la migración de fichas de seguro." };
    }
    return { success: false, error: error.message };
  }
  if (!data) return { success: false, error: "Ficha no encontrada" };
  const row = data as SeguroFichaRow;
  const counts = await countByFicha(admin, auth.taller.id, [row.id]);
  return { success: true, ficha: mapRow(row, counts.get(row.id) ?? 0) };
}

export async function upsertSeguroFichaAction(
  raw: unknown
): Promise<ActionOk<{ ficha: SeguroFichaListItem }> | ActionErr> {
  const auth = await requireTallerAuth();
  if (auth.error || !auth.taller) {
    return { success: false, error: auth.error ?? "No autorizado" };
  }
  const parsed = seguroFichaUpsertSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.errors[0]?.message ?? "Datos inválidos",
    };
  }
  const admin = createAdminClient();
  const payload = {
    taller_id: auth.taller.id,
    aseguradora: parsed.data.aseguradora,
    numero_poliza: parsed.data.numeroPoliza,
    tipo_cobertura: parsed.data.tipoCobertura,
    vigencia_desde: parsed.data.vigenciaDesde,
    vigencia_hasta: parsed.data.vigenciaHasta,
    monto_asegurado: parsed.data.montoAsegurado,
    telefono_aseguradora: parsed.data.telefonoAseguradora,
    corredor: parsed.data.corredor,
    observaciones: parsed.data.observaciones,
    activo: true,
    updated_at: new Date().toISOString(),
  };
  const query = parsed.data.id
    ? admin
        .from("seguros_ficha")
        .update(payload)
        .eq("id", parsed.data.id)
        .eq("taller_id", auth.taller.id)
        .select(SEGURO_FICHA_SELECT)
        .maybeSingle()
    : admin.from("seguros_ficha").insert(payload).select(SEGURO_FICHA_SELECT).maybeSingle();
  const { data, error } = await query;
  if (error) {
    if (isMissingRelation(error, ["seguros_ficha"])) {
      return { success: false, error: "Aplica la migración de fichas de seguro." };
    }
    return { success: false, error: error.message };
  }
  if (!data) return { success: false, error: "No se pudo guardar la ficha." };
  const row = data as SeguroFichaRow;
  revalidateSeguro(row.id);
  return { success: true, ficha: mapRow(row) };
}

export async function listExpedientesSeguroAction(params?: {
  fichaId?: string;
}): Promise<ActionOk<{ expedientes: ExpedienteEnlace[] }> | ActionErr> {
  const auth = await requireTallerAuth();
  if (auth.error || !auth.taller) {
    return { success: false, error: auth.error ?? "No autorizado" };
  }
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("vehiculos")
    .select("id, placa, marca, modelo, seguro_ficha_id, importacion, created_at")
    .eq("taller_id", auth.taller.id)
    .not("importacion", "is", null)
    .order("created_at", { ascending: false })
    .limit(400);
  if (error) {
    if (isMissingRelation(error, ["seguro_ficha_id"])) {
      return { success: true, expedientes: [] };
    }
    return { success: false, error: error.message };
  }
  const mine = params?.fichaId;
  const expedientes: ExpedienteEnlace[] = (data ?? []).map((row) => ({
    id: row.id as string,
    codigoExpediente: labelExpedienteEnlace(
      row.importacion,
      row.placa as string | null
    ),
    marca: (row.marca as string | null) ?? null,
    modelo: (row.modelo as string | null) ?? null,
    fichaId: (row.seguro_ficha_id as string | null) ?? null,
    detalle: null,
  }));
  expedientes.sort((a, b) => {
    const aMine = mine && a.fichaId === mine ? 0 : 1;
    const bMine = mine && b.fichaId === mine ? 0 : 1;
    if (aMine !== bMine) return aMine - bMine;
    return (a.fichaId ? 1 : 0) - (b.fichaId ? 1 : 0);
  });
  return { success: true, expedientes };
}

export async function asignarExpedienteSeguroAction(
  raw: unknown
): Promise<ActionOk<{ vehiculoId: string }> | ActionErr> {
  const auth = await requireTallerAuth();
  if (auth.error || !auth.taller) {
    return { success: false, error: auth.error ?? "No autorizado" };
  }
  const parsed = asignarFichaSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.errors[0]?.message ?? "Datos inválidos",
    };
  }
  const admin = createAdminClient();
  const { data: ficha, error: fichaErr } = await admin
    .from("seguros_ficha")
    .select(SEGURO_FICHA_SELECT)
    .eq("id", parsed.data.fichaId)
    .eq("taller_id", auth.taller.id)
    .maybeSingle();
  if (fichaErr) {
    if (isMissingRelation(fichaErr, ["seguros_ficha"])) {
      return { success: false, error: "Aplica la migración de fichas de seguro." };
    }
    return { success: false, error: fichaErr.message };
  }
  if (!ficha) return { success: false, error: "Ficha no encontrada" };

  const { data: vehiculo, error: vehErr } = await admin
    .from("vehiculos")
    .select("id, taller_id, seguro")
    .eq("id", parsed.data.vehiculoId)
    .maybeSingle();
  if (vehErr) return { success: false, error: vehErr.message };
  if (!vehiculo || vehiculo.taller_id !== auth.taller.id) {
    return { success: false, error: "Expediente no encontrado" };
  }

  const row = ficha as SeguroFichaRow;
  const patch = vehiculoPatchFromSeguro(
    row.id,
    {
      aseguradora: row.aseguradora,
      numeroPoliza: row.numero_poliza,
      tipoCobertura: row.tipo_cobertura,
      vigenciaDesde: row.vigencia_desde,
      vigenciaHasta: row.vigencia_hasta,
      montoAsegurado:
        row.monto_asegurado == null ? null : Number(row.monto_asegurado),
      telefonoAseguradora: row.telefono_aseguradora,
      corredor: row.corredor,
      observaciones: row.observaciones,
    },
    vehiculo.seguro
  );

  const { error } = await admin
    .from("vehiculos")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", parsed.data.vehiculoId)
    .eq("taller_id", auth.taller.id);
  if (error) {
    if (isMissingRelation(error, ["seguro_ficha_id", "seguros_ficha"])) {
      return { success: false, error: "Aplica la migración de fichas de seguro." };
    }
    return { success: false, error: error.message };
  }
  revalidateSeguro(row.id, parsed.data.vehiculoId);
  return { success: true, vehiculoId: parsed.data.vehiculoId };
}
