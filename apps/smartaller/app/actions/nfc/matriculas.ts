"use server";

import { revalidatePath } from "next/cache";
import {
  isMissingRelation,
  labelExpedienteEnlace,
  type ExpedienteEnlace,
} from "@/lib/importacion/expediente-enlace";
import { vehiculoPatchFromMatricula } from "@/lib/importacion/matricula-asignacion";
import {
  MATRICULA_FICHA_SELECT,
  asignarMatriculaSchema,
  matriculaFichaUpsertSchema,
  type MatriculaFichaRow,
} from "@/lib/schemas/matricula-ficha";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUser } from "@/lib/supabase/server";
import { ensureTallerForUser } from "@/lib/taller";

export type MatriculaFichaListItem = {
  id: string;
  placa: string | null;
  oficinaIntt: string | null;
  fechaTramite: string | null;
  requiereHomologacion: boolean;
  observaciones: string | null;
  createdAt: string;
  expedientesCount: number;
};

type ActionOk<T> = { success: true } & T;
type ActionErr = { success: false; error: string };

function mapRow(row: MatriculaFichaRow, count = 0): MatriculaFichaListItem {
  return {
    id: row.id,
    placa: row.placa,
    oficinaIntt: row.oficina_intt,
    fechaTramite: row.fecha_tramite,
    requiereHomologacion: row.requiere_homologacion,
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

function revalidateMatricula(fichaId?: string, vehiculoId?: string) {
  revalidatePath("/smartimport");
  revalidatePath("/smartimport/matriculas");
  if (fichaId) revalidatePath(`/smartimport/matriculas/${fichaId}`);
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
    .select("matricula_ficha_id")
    .eq("taller_id", tallerId)
    .in("matricula_ficha_id", ids);
  if (error || !data) return counts;
  for (const row of data) {
    const id = row.matricula_ficha_id as string | null;
    if (!id) continue;
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return counts;
}

export async function listMatriculasAction(): Promise<
  ActionOk<{ fichas: MatriculaFichaListItem[] }> | ActionErr
> {
  const auth = await requireTallerAuth();
  if (auth.error || !auth.taller) {
    return { success: false, error: auth.error ?? "No autorizado" };
  }
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("matriculas_ficha")
    .select(MATRICULA_FICHA_SELECT)
    .eq("taller_id", auth.taller.id)
    .eq("activo", true)
    .order("created_at", { ascending: false })
    .limit(300);
  if (error) {
    if (isMissingRelation(error, ["matriculas_ficha"])) {
      return { success: true, fichas: [] };
    }
    return { success: false, error: error.message };
  }
  const rows = (data ?? []) as MatriculaFichaRow[];
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

export async function getMatriculaFichaAction(
  id: string
): Promise<ActionOk<{ ficha: MatriculaFichaListItem }> | ActionErr> {
  const auth = await requireTallerAuth();
  if (auth.error || !auth.taller) {
    return { success: false, error: auth.error ?? "No autorizado" };
  }
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("matriculas_ficha")
    .select(MATRICULA_FICHA_SELECT)
    .eq("id", id)
    .eq("taller_id", auth.taller.id)
    .maybeSingle();
  if (error) {
    if (isMissingRelation(error, ["matriculas_ficha"])) {
      return {
        success: false,
        error: "Aplica la migración de fichas de matrícula.",
      };
    }
    return { success: false, error: error.message };
  }
  if (!data) return { success: false, error: "Ficha no encontrada" };
  const row = data as MatriculaFichaRow;
  const counts = await countByFicha(admin, auth.taller.id, [row.id]);
  return { success: true, ficha: mapRow(row, counts.get(row.id) ?? 0) };
}

export async function upsertMatriculaFichaAction(
  raw: unknown
): Promise<ActionOk<{ ficha: MatriculaFichaListItem }> | ActionErr> {
  const auth = await requireTallerAuth();
  if (auth.error || !auth.taller) {
    return { success: false, error: auth.error ?? "No autorizado" };
  }
  const parsed = matriculaFichaUpsertSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.errors[0]?.message ?? "Datos inválidos",
    };
  }
  const admin = createAdminClient();
  const payload = {
    taller_id: auth.taller.id,
    placa: parsed.data.placa,
    oficina_intt: parsed.data.oficinaIntt,
    fecha_tramite: parsed.data.fechaTramite,
    requiere_homologacion: parsed.data.requiereHomologacion,
    observaciones: parsed.data.observaciones,
    activo: true,
    updated_at: new Date().toISOString(),
  };
  const query = parsed.data.id
    ? admin
        .from("matriculas_ficha")
        .update(payload)
        .eq("id", parsed.data.id)
        .eq("taller_id", auth.taller.id)
        .select(MATRICULA_FICHA_SELECT)
        .maybeSingle()
    : admin
        .from("matriculas_ficha")
        .insert(payload)
        .select(MATRICULA_FICHA_SELECT)
        .maybeSingle();
  const { data, error } = await query;
  if (error) {
    if (isMissingRelation(error, ["matriculas_ficha"])) {
      return {
        success: false,
        error: "Aplica la migración de fichas de matrícula.",
      };
    }
    return { success: false, error: error.message };
  }
  if (!data) return { success: false, error: "No se pudo guardar la ficha." };
  const row = data as MatriculaFichaRow;
  revalidateMatricula(row.id);
  return { success: true, ficha: mapRow(row) };
}

export async function listExpedientesMatriculaAction(params?: {
  fichaId?: string;
}): Promise<ActionOk<{ expedientes: ExpedienteEnlace[] }> | ActionErr> {
  const auth = await requireTallerAuth();
  if (auth.error || !auth.taller) {
    return { success: false, error: auth.error ?? "No autorizado" };
  }
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("vehiculos")
    .select(
      "id, placa, marca, modelo, matricula_ficha_id, importacion, created_at"
    )
    .eq("taller_id", auth.taller.id)
    .not("importacion", "is", null)
    .order("created_at", { ascending: false })
    .limit(400);
  if (error) {
    if (isMissingRelation(error, ["matricula_ficha_id"])) {
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
    fichaId: (row.matricula_ficha_id as string | null) ?? null,
    detalle: (row.placa as string | null) ?? null,
  }));
  expedientes.sort((a, b) => {
    const aMine = mine && a.fichaId === mine ? 0 : 1;
    const bMine = mine && b.fichaId === mine ? 0 : 1;
    if (aMine !== bMine) return aMine - bMine;
    return (a.fichaId ? 1 : 0) - (b.fichaId ? 1 : 0);
  });
  return { success: true, expedientes };
}

export async function asignarExpedienteMatriculaAction(
  raw: unknown
): Promise<ActionOk<{ vehiculoId: string }> | ActionErr> {
  const auth = await requireTallerAuth();
  if (auth.error || !auth.taller) {
    return { success: false, error: auth.error ?? "No autorizado" };
  }
  const parsed = asignarMatriculaSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.errors[0]?.message ?? "Datos inválidos",
    };
  }
  const admin = createAdminClient();
  const { data: ficha, error: fichaErr } = await admin
    .from("matriculas_ficha")
    .select(MATRICULA_FICHA_SELECT)
    .eq("id", parsed.data.fichaId)
    .eq("taller_id", auth.taller.id)
    .maybeSingle();
  if (fichaErr) {
    if (isMissingRelation(fichaErr, ["matriculas_ficha"])) {
      return {
        success: false,
        error: "Aplica la migración de fichas de matrícula.",
      };
    }
    return { success: false, error: fichaErr.message };
  }
  if (!ficha) return { success: false, error: "Ficha no encontrada" };

  const { data: vehiculo, error: vehErr } = await admin
    .from("vehiculos")
    .select("id, taller_id, placa, importacion")
    .eq("id", parsed.data.vehiculoId)
    .maybeSingle();
  if (vehErr) return { success: false, error: vehErr.message };
  if (!vehiculo || vehiculo.taller_id !== auth.taller.id) {
    return { success: false, error: "Expediente no encontrado" };
  }

  const row = ficha as MatriculaFichaRow;
  const patch = vehiculoPatchFromMatricula(
    row.id,
    {
      placa: row.placa,
      oficinaIntt: row.oficina_intt,
      fechaTramite: row.fecha_tramite,
      requiereHomologacion: row.requiere_homologacion,
      observaciones: row.observaciones,
    },
    (vehiculo.placa as string | null) ?? null,
    vehiculo.importacion
  );

  const { error } = await admin
    .from("vehiculos")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", parsed.data.vehiculoId)
    .eq("taller_id", auth.taller.id);
  if (error) {
    if (isMissingRelation(error, ["matricula_ficha_id", "matriculas_ficha"])) {
      return {
        success: false,
        error: "Aplica la migración de fichas de matrícula.",
      };
    }
    return { success: false, error: error.message };
  }
  revalidateMatricula(row.id, parsed.data.vehiculoId);
  return { success: true, vehiculoId: parsed.data.vehiculoId };
}
