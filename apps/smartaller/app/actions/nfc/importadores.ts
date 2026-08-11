"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  IMPORTADOR_TIPO_LABELS,
  importadorUpsertSchema,
  type ImportadorRow,
  type ImportadorTipo,
} from "@/lib/schemas/importador";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUser } from "@/lib/supabase/server";
import { getMyTaller } from "@/lib/taller";

export type ImportadorListItem = {
  id: string;
  tipo: ImportadorTipo;
  tipoLabel: string;
  nombre: string;
  documento: string;
  telefono: string | null;
  email: string | null;
  direccion: string | null;
  activo: boolean;
  createdAt: string;
};

type ActionOk<T> = { success: true } & T;
type ActionErr = { success: false; error: string };

async function requireTallerAuth() {
  const user = await getUser();
  if (!user) return { error: "Debes iniciar sesión" as const, taller: null };
  const taller = await getMyTaller();
  if (!taller) return { error: "No se encontró tu taller" as const, taller: null };
  return { error: null, taller };
}

function mapRow(row: ImportadorRow): ImportadorListItem {
  return {
    id: row.id,
    tipo: row.tipo,
    tipoLabel: IMPORTADOR_TIPO_LABELS[row.tipo],
    nombre: row.nombre,
    documento: row.documento,
    telefono: row.telefono,
    email: row.email,
    direccion: row.direccion,
    activo: row.activo,
    createdAt: row.created_at,
  };
}

export async function listImportadoresAction(params?: {
  q?: string;
  soloActivos?: boolean;
}): Promise<ActionOk<{ importadores: ImportadorListItem[] }> | ActionErr> {
  const auth = await requireTallerAuth();
  if (auth.error || !auth.taller) {
    return { success: false, error: auth.error ?? "No autorizado" };
  }

  const admin = createAdminClient();
  let query = admin
    .from("importadores")
    .select(
      "id, taller_id, tipo, nombre, documento, telefono, email, direccion, activo, created_at, updated_at"
    )
    .eq("taller_id", auth.taller.id)
    .order("nombre", { ascending: true })
    .limit(300);

  if (params?.soloActivos !== false) {
    query = query.eq("activo", true);
  }

  const q = params?.q?.trim();
  if (q) {
    query = query.or(
      `nombre.ilike.%${q}%,documento.ilike.%${q}%,telefono.ilike.%${q}%`
    );
  }

  const { data, error } = await query;
  if (error) return { success: false, error: error.message };

  return {
    success: true,
    importadores: (data as ImportadorRow[] | null)?.map(mapRow) ?? [],
  };
}

export async function getImportadorAction(
  importadorId: string
): Promise<ActionOk<{ importador: ImportadorListItem }> | ActionErr> {
  const auth = await requireTallerAuth();
  if (auth.error || !auth.taller) {
    return { success: false, error: auth.error ?? "No autorizado" };
  }

  const idParsed = z.string().uuid().safeParse(importadorId);
  if (!idParsed.success) return { success: false, error: "ID inválido" };

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("importadores")
    .select(
      "id, taller_id, tipo, nombre, documento, telefono, email, direccion, activo, created_at, updated_at"
    )
    .eq("id", idParsed.data)
    .eq("taller_id", auth.taller.id)
    .maybeSingle();

  if (error) return { success: false, error: error.message };
  if (!data) return { success: false, error: "Cliente no encontrado" };

  return { success: true, importador: mapRow(data as ImportadorRow) };
}

export async function upsertImportadorAction(
  raw: unknown
): Promise<ActionOk<{ importador: ImportadorListItem }> | ActionErr> {
  const auth = await requireTallerAuth();
  if (auth.error || !auth.taller) {
    return { success: false, error: auth.error ?? "No autorizado" };
  }

  const parsed = importadorUpsertSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.errors[0]?.message ?? "Datos inválidos",
    };
  }

  const data = parsed.data;
  const admin = createAdminClient();
  const payload = {
    taller_id: auth.taller.id,
    tipo: data.tipo,
    nombre: data.nombre.trim(),
    documento: data.documento,
    telefono: data.telefono?.trim() || null,
    email: data.email?.trim() || null,
    direccion: data.direccion?.trim() || null,
    activo: data.activo ?? true,
    updated_at: new Date().toISOString(),
  };

  if (data.id) {
    const { data: updated, error } = await admin
      .from("importadores")
      .update(payload)
      .eq("id", data.id)
      .eq("taller_id", auth.taller.id)
      .select(
        "id, taller_id, tipo, nombre, documento, telefono, email, direccion, activo, created_at, updated_at"
      )
      .maybeSingle();

    if (error) {
      if (error.code === "23505") {
        return {
          success: false,
          error: "Ya existe un cliente con ese documento en tu taller",
        };
      }
      return { success: false, error: error.message };
    }
    if (!updated) return { success: false, error: "Cliente no encontrado" };

    revalidatePath("/importacion/clientes");
    revalidatePath("/importacion/importaciones/nueva");
    return { success: true, importador: mapRow(updated as ImportadorRow) };
  }

  const { data: created, error } = await admin
    .from("importadores")
    .insert(payload)
    .select(
      "id, taller_id, tipo, nombre, documento, telefono, email, direccion, activo, created_at, updated_at"
    )
    .single();

  if (error || !created) {
    if (error?.code === "23505") {
      return {
        success: false,
        error: "Ya existe un cliente con ese documento en tu taller",
      };
    }
    return { success: false, error: error?.message ?? "No se pudo guardar" };
  }

  revalidatePath("/importacion/clientes");
  revalidatePath("/importacion/importaciones/nueva");
  return { success: true, importador: mapRow(created as ImportadorRow) };
}

/**
 * Busca por documento o crea importador (carga masiva / migraciones).
 * Auth de taller obligatoria; `tallerId` debe coincidir con el taller de la sesión.
 */
export async function ensureImportadorForTaller(params: {
  tallerId: string;
  nombre: string;
  documento: string;
  telefono?: string | null;
  email?: string | null;
  direccion?: string | null;
  tipo?: ImportadorTipo;
}): Promise<
  | { ok: true; importadorId: string }
  | { ok: false; error: string }
> {
  const auth = await requireTallerAuth();
  if (auth.error || !auth.taller) {
    return { ok: false, error: auth.error ?? "No autorizado" };
  }
  if (auth.taller.id !== params.tallerId) {
    return { ok: false, error: "Taller no autorizado" };
  }

  const parsed = importadorUpsertSchema.safeParse({
    tipo:
      params.tipo ??
      (params.documento.trim().toUpperCase().startsWith("J") ||
      params.documento.trim().toUpperCase().startsWith("G") ||
      params.documento.trim().toUpperCase().startsWith("C") ||
      params.documento.trim().toUpperCase().startsWith("P")
        ? "juridica"
        : "natural"),
    nombre: params.nombre,
    documento: params.documento,
    telefono: params.telefono ?? "",
    email: params.email ?? "",
    direccion: params.direccion ?? "",
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.errors[0]?.message ?? "Cliente inválido",
    };
  }

  const tallerId = auth.taller.id;
  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("importadores")
    .select("id")
    .eq("taller_id", tallerId)
    .eq("documento", parsed.data.documento)
    .maybeSingle();

  if (existing?.id) {
    return { ok: true, importadorId: existing.id as string };
  }

  const { data: created, error } = await admin
    .from("importadores")
    .insert({
      taller_id: tallerId,
      tipo: parsed.data.tipo,
      nombre: parsed.data.nombre,
      documento: parsed.data.documento,
      telefono: parsed.data.telefono?.trim() || null,
      email: parsed.data.email?.trim() || null,
      direccion: parsed.data.direccion?.trim() || null,
      activo: true,
      updated_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error || !created) {
    if (error?.code === "23505") {
      const { data: again } = await admin
        .from("importadores")
        .select("id")
        .eq("taller_id", tallerId)
        .eq("documento", parsed.data.documento)
        .maybeSingle();
      if (again?.id) return { ok: true, importadorId: again.id as string };
    }
    return { ok: false, error: error?.message ?? "No se pudo crear el cliente" };
  }

  return { ok: true, importadorId: created.id as string };
}

export async function setImportadorActivoAction(raw: unknown): Promise<
  ActionOk<{ importador: ImportadorListItem }> | ActionErr
> {
  const auth = await requireTallerAuth();
  if (auth.error || !auth.taller) {
    return { success: false, error: auth.error ?? "No autorizado" };
  }

  const parsed = z
    .object({
      importadorId: z.string().uuid(),
      activo: z.boolean(),
    })
    .safeParse(raw);
  if (!parsed.success) {
    return { success: false, error: "Datos inválidos" };
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("importadores")
    .update({
      activo: parsed.data.activo,
      updated_at: new Date().toISOString(),
    })
    .eq("id", parsed.data.importadorId)
    .eq("taller_id", auth.taller.id)
    .select(
      "id, taller_id, tipo, nombre, documento, telefono, email, direccion, activo, created_at, updated_at"
    )
    .maybeSingle();

  if (error) return { success: false, error: error.message };
  if (!data) return { success: false, error: "Cliente no encontrado" };

  revalidatePath("/importacion/clientes");
  return { success: true, importador: mapRow(data as ImportadorRow) };
}
