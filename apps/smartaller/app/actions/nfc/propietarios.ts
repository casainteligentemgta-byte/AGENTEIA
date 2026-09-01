"use server";

import { revalidatePath } from "next/cache";
import {
  PROPIETARIO_SELECT,
  asignarExpedienteSchema,
  propietarioUpsertSchema,
  type PropietarioRow,
} from "@/lib/schemas/propietario";
import { vehiculoPatchFromPropietario } from "@/lib/importacion/propietario-asignacion";
import {
  parseImportacion,
  type ImportacionData,
} from "@/lib/schemas/vehiculo-documentos";
import { resolveCodigoExpediente } from "@/lib/importacion/expediente";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUser } from "@/lib/supabase/server";
import { ensureTallerForUser } from "@/lib/taller";

export type PropietarioListItem = {
  id: string;
  nombre: string;
  cedula: string | null;
  telefono: string | null;
  email: string | null;
  fechaNacimiento: string | null;
  direccion: string | null;
  activo: boolean;
  createdAt: string;
  expedientesCount: number;
};

export type ExpedienteAsignable = {
  id: string;
  codigoExpediente: string;
  marca: string | null;
  modelo: string | null;
  propietarioId: string | null;
  nombreCliente: string | null;
};

type ActionOk<T> = { success: true } & T;
type ActionErr = { success: false; error: string };

function isMissingRelation(error: { message?: string; code?: string } | null): boolean {
  const msg = (error?.message ?? "").toLowerCase();
  return (
    error?.code === "42P01" ||
    error?.code === "42703" ||
    msg.includes("propietarios") ||
    msg.includes("propietario_id")
  );
}

function mapRow(row: PropietarioRow, expedientesCount = 0): PropietarioListItem {
  return {
    id: row.id,
    nombre: row.nombre,
    cedula: row.cedula,
    telefono: row.telefono,
    email: row.email,
    fechaNacimiento: row.fecha_nacimiento,
    direccion: row.direccion,
    activo: row.activo,
    createdAt: row.created_at,
    expedientesCount,
  };
}

async function requireTallerAuth() {
  const user = await getUser();
  if (!user) return { error: "Debes iniciar sesión" as const, taller: null };
  const { taller } = await ensureTallerForUser(user.id);
  if (!taller) return { error: "No se encontró tu taller" as const, taller: null };
  return { error: null, taller };
}

function revalidatePropietario(propietarioId?: string, vehiculoId?: string) {
  revalidatePath("/smartimport");
  revalidatePath("/smartimport/propietarios");
  if (propietarioId) {
    revalidatePath(`/smartimport/propietarios/${propietarioId}`);
  }
  if (vehiculoId) {
    revalidatePath(`/smartimport/${vehiculoId}`);
    revalidatePath(`/smartimport/${vehiculoId}/planilla`);
    revalidatePath(`/smartimport/${vehiculoId}/propietario`);
  }
}

async function countExpedientesByPropietario(
  admin: ReturnType<typeof createAdminClient>,
  tallerId: string,
  ids: string[]
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (ids.length === 0) return counts;
  const { data, error } = await admin
    .from("vehiculos")
    .select("propietario_id")
    .eq("taller_id", tallerId)
    .in("propietario_id", ids);
  if (error || !data) return counts;
  for (const row of data) {
    const id = row.propietario_id as string | null;
    if (!id) continue;
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return counts;
}

export async function listPropietariosAction(): Promise<
  ActionOk<{ propietarios: PropietarioListItem[] }> | ActionErr
> {
  const auth = await requireTallerAuth();
  if (auth.error || !auth.taller) {
    return { success: false, error: auth.error ?? "No autorizado" };
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("propietarios")
    .select(PROPIETARIO_SELECT)
    .eq("taller_id", auth.taller.id)
    .eq("activo", true)
    .order("nombre", { ascending: true })
    .limit(300);

  if (error) {
    if (isMissingRelation(error)) {
      return { success: true, propietarios: [] };
    }
    return { success: false, error: error.message };
  }

  const rows = (data ?? []) as PropietarioRow[];
  const counts = await countExpedientesByPropietario(
    admin,
    auth.taller.id,
    rows.map((r) => r.id)
  );
  return {
    success: true,
    propietarios: rows.map((row) => mapRow(row, counts.get(row.id) ?? 0)),
  };
}

export async function getPropietarioAction(
  id: string
): Promise<ActionOk<{ propietario: PropietarioListItem }> | ActionErr> {
  const auth = await requireTallerAuth();
  if (auth.error || !auth.taller) {
    return { success: false, error: auth.error ?? "No autorizado" };
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("propietarios")
    .select(PROPIETARIO_SELECT)
    .eq("id", id)
    .eq("taller_id", auth.taller.id)
    .maybeSingle();

  if (error) {
    if (isMissingRelation(error)) {
      return {
        success: false,
        error: "Aplica la migración de propietarios en Supabase.",
      };
    }
    return { success: false, error: error.message };
  }
  if (!data) return { success: false, error: "Ficha no encontrada" };

  const row = data as PropietarioRow;
  const counts = await countExpedientesByPropietario(admin, auth.taller.id, [
    row.id,
  ]);
  return { success: true, propietario: mapRow(row, counts.get(row.id) ?? 0) };
}

export async function upsertPropietarioAction(
  raw: unknown
): Promise<ActionOk<{ propietario: PropietarioListItem }> | ActionErr> {
  const auth = await requireTallerAuth();
  if (auth.error || !auth.taller) {
    return { success: false, error: auth.error ?? "No autorizado" };
  }

  const parsed = propietarioUpsertSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.errors[0]?.message ?? "Datos inválidos",
    };
  }

  const admin = createAdminClient();
  const payload = {
    taller_id: auth.taller.id,
    nombre: parsed.data.nombre,
    cedula: parsed.data.cedula,
    telefono: parsed.data.telefono,
    email: parsed.data.email,
    fecha_nacimiento: parsed.data.fechaNacimiento,
    direccion: parsed.data.direccion,
    activo: true,
    updated_at: new Date().toISOString(),
  };

  const query = parsed.data.id
    ? admin
        .from("propietarios")
        .update(payload)
        .eq("id", parsed.data.id)
        .eq("taller_id", auth.taller.id)
        .select(PROPIETARIO_SELECT)
        .maybeSingle()
    : admin
        .from("propietarios")
        .insert(payload)
        .select(PROPIETARIO_SELECT)
        .maybeSingle();

  const { data, error } = await query;
  if (error) {
    if (isMissingRelation(error)) {
      return {
        success: false,
        error: "Aplica la migración de propietarios en Supabase.",
      };
    }
    if (error.code === "23505") {
      return { success: false, error: "Ya existe una ficha con esa cédula." };
    }
    return { success: false, error: error.message };
  }
  if (!data) return { success: false, error: "No se pudo guardar la ficha." };

  const row = data as PropietarioRow;
  revalidatePropietario(row.id);
  return { success: true, propietario: mapRow(row) };
}

function expedienteLabel(importacion: unknown, placa: string | null): string {
  const parsed = parseImportacion(importacion);
  return (
    resolveCodigoExpediente({
      codigoExpediente: parsed.codigoExpediente,
      placa,
    }) ??
    placa?.trim() ??
    "Expediente"
  );
}

export async function listExpedientesAsignablesAction(params?: {
  propietarioId?: string;
}): Promise<ActionOk<{ expedientes: ExpedienteAsignable[] }> | ActionErr> {
  const auth = await requireTallerAuth();
  if (auth.error || !auth.taller) {
    return { success: false, error: auth.error ?? "No autorizado" };
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("vehiculos")
    .select(
      "id, placa, marca, modelo, nombre_cliente, propietario_id, importacion, created_at"
    )
    .eq("taller_id", auth.taller.id)
    .not("importacion", "is", null)
    .order("created_at", { ascending: false })
    .limit(400);

  if (error) {
    if (isMissingRelation(error)) {
      return { success: true, expedientes: [] };
    }
    return { success: false, error: error.message };
  }

  const mine = params?.propietarioId;
  const expedientes: ExpedienteAsignable[] = (data ?? []).map((row) => ({
    id: row.id as string,
    codigoExpediente: expedienteLabel(row.importacion, row.placa as string | null),
    marca: (row.marca as string | null) ?? null,
    modelo: (row.modelo as string | null) ?? null,
    propietarioId: (row.propietario_id as string | null) ?? null,
    nombreCliente: (row.nombre_cliente as string | null) ?? null,
  }));

  expedientes.sort((a, b) => {
    const aMine = mine && a.propietarioId === mine ? 0 : 1;
    const bMine = mine && b.propietarioId === mine ? 0 : 1;
    if (aMine !== bMine) return aMine - bMine;
    const aFree = a.propietarioId ? 1 : 0;
    const bFree = b.propietarioId ? 1 : 0;
    if (aFree !== bFree) return aFree - bFree;
    return a.codigoExpediente.localeCompare(b.codigoExpediente);
  });

  return { success: true, expedientes };
}

export async function asignarExpedientePropietarioAction(
  raw: unknown
): Promise<ActionOk<{ vehiculoId: string }> | ActionErr> {
  const auth = await requireTallerAuth();
  if (auth.error || !auth.taller) {
    return { success: false, error: auth.error ?? "No autorizado" };
  }

  const parsed = asignarExpedienteSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.errors[0]?.message ?? "Datos inválidos",
    };
  }

  const admin = createAdminClient();
  const { data: propietario, error: propErr } = await admin
    .from("propietarios")
    .select(PROPIETARIO_SELECT)
    .eq("id", parsed.data.propietarioId)
    .eq("taller_id", auth.taller.id)
    .maybeSingle();

  if (propErr) {
    if (isMissingRelation(propErr)) {
      return {
        success: false,
        error: "Aplica la migración de propietarios en Supabase.",
      };
    }
    return { success: false, error: propErr.message };
  }
  if (!propietario) return { success: false, error: "Ficha no encontrada" };

  const { data: vehiculo, error: vehErr } = await admin
    .from("vehiculos")
    .select("id, taller_id, importacion")
    .eq("id", parsed.data.vehiculoId)
    .maybeSingle();

  if (vehErr) return { success: false, error: vehErr.message };
  if (!vehiculo || vehiculo.taller_id !== auth.taller.id) {
    return { success: false, error: "Expediente no encontrado" };
  }

  const row = propietario as PropietarioRow;
  const patch = vehiculoPatchFromPropietario(
    row.id,
    {
      nombre: row.nombre,
      cedula: row.cedula,
      telefono: row.telefono,
      email: row.email,
      fechaNacimiento: row.fecha_nacimiento,
      direccion: row.direccion,
    },
    vehiculo.importacion
  );

  const { error } = await admin
    .from("vehiculos")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", parsed.data.vehiculoId)
    .eq("taller_id", auth.taller.id);

  if (error) {
    if (isMissingRelation(error)) {
      return {
        success: false,
        error: "Aplica la migración de propietarios en Supabase.",
      };
    }
    return { success: false, error: error.message };
  }

  revalidatePropietario(row.id, parsed.data.vehiculoId);
  return { success: true, vehiculoId: parsed.data.vehiculoId };
}

export async function listExpedientesDePropietarioAction(
  propietarioId: string
): Promise<ActionOk<{ expedientes: ExpedienteAsignable[] }> | ActionErr> {
  const listed = await listExpedientesAsignablesAction({ propietarioId });
  if (!listed.success) return listed;
  return {
    success: true,
    expedientes: listed.expedientes.filter(
      (e) => e.propietarioId === propietarioId
    ),
  };
}
