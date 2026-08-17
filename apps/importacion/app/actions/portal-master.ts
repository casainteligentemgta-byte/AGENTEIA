"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  resolvePortalAccess,
  requirePortalRole,
} from "@/lib/portal/roles";
import { deleteVehiculoConDependencias } from "@/lib/vehicles/delete-cascade";

export type MasterTallerRow = {
  id: string;
  nombre: string;
  tipoIndustria: string | null;
  ownerUserId: string;
  ownerEmail: string | null;
  vehiculosCount: number;
  aisladoAt: string | null;
};

export type MasterPortalUserRow = {
  userId: string;
  email: string | null;
  roles: string[];
  orgNombre: string | null;
  verTodo: boolean;
  aisladoAt: string | null;
};

type ActionResult = { ok: true } | { ok: false; error: string };

async function requireMaster() {
  const access = await resolvePortalAccess();
  const gate = requirePortalRole(access, "master");
  if (!gate.ok) return { ok: false as const, error: gate.error };
  if (!gate.access.verTodo) {
    return {
      ok: false as const,
      error: "Solo el máster con visión global (ver_todo) puede aislar o borrar.",
    };
  }
  return { ok: true as const, access: gate.access };
}

function revalidateMaster() {
  revalidatePath("/portales/master");
  revalidatePath("/portales");
}

export async function listMasterTalleresAction(): Promise<
  | { success: true; activos: MasterTallerRow[]; aislados: MasterTallerRow[] }
  | { success: false; error: string }
> {
  const gate = await requireMaster();
  if (!gate.ok) return { success: false, error: gate.error };

  const admin = createAdminClient();
  const { data: talleres, error } = await admin
    .from("talleres")
    .select("id, nombre, tipo_industria, owner_user_id, aislado_at")
    .order("nombre");

  if (error) return { success: false, error: error.message };

  const ownerIds = [
    ...new Set((talleres ?? []).map((t) => t.owner_user_id as string)),
  ];
  const emailByUser = new Map<string, string | null>();
  for (const ownerId of ownerIds) {
    const { data } = await admin.auth.admin.getUserById(ownerId);
    emailByUser.set(ownerId, data.user?.email ?? null);
  }

  const ids = (talleres ?? []).map((t) => t.id as string);
  const counts = new Map<string, number>();
  if (ids.length > 0) {
    const { data: vehs } = await admin
      .from("vehiculos")
      .select("taller_id")
      .in("taller_id", ids);
    for (const v of vehs ?? []) {
      const tid = v.taller_id as string | null;
      if (!tid) continue;
      counts.set(tid, (counts.get(tid) ?? 0) + 1);
    }
  }

  const rows: MasterTallerRow[] = (talleres ?? []).map((t) => ({
    id: t.id as string,
    nombre: String(t.nombre ?? "Taller"),
    tipoIndustria: (t.tipo_industria as string | null) ?? null,
    ownerUserId: t.owner_user_id as string,
    ownerEmail: emailByUser.get(t.owner_user_id as string) ?? null,
    vehiculosCount: counts.get(t.id as string) ?? 0,
    aisladoAt: (t.aislado_at as string | null) ?? null,
  }));

  return {
    success: true,
    activos: rows.filter((r) => !r.aisladoAt),
    aislados: rows.filter((r) => Boolean(r.aisladoAt)),
  };
}

export async function listMasterPortalUsersAction(): Promise<
  | {
      success: true;
      activos: MasterPortalUserRow[];
      aislados: MasterPortalUserRow[];
    }
  | { success: false; error: string }
> {
  const gate = await requireMaster();
  if (!gate.ok) return { success: false, error: gate.error };

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("portal_accesos")
    .select("user_id, roles, ver_todo, org_nombre, aislado_at")
    .order("updated_at", { ascending: false });

  if (error) return { success: false, error: error.message };

  const rows: MasterPortalUserRow[] = [];
  for (const row of data ?? []) {
    const userId = row.user_id as string;
    const { data: authData } = await admin.auth.admin.getUserById(userId);
    const roles = Array.isArray(row.roles)
      ? (row.roles as string[]).filter((r) => typeof r === "string")
      : [];
    rows.push({
      userId,
      email: authData.user?.email ?? null,
      roles,
      orgNombre: (row.org_nombre as string | null) ?? null,
      verTodo: Boolean(row.ver_todo),
      aisladoAt: (row.aislado_at as string | null) ?? null,
    });
  }

  return {
    success: true,
    activos: rows.filter((r) => !r.aisladoAt),
    aislados: rows.filter((r) => Boolean(r.aisladoAt)),
  };
}

export async function aislarTallerAction(tallerId: string): Promise<ActionResult> {
  const gate = await requireMaster();
  if (!gate.ok) return gate;

  const parsed = z.string().uuid().safeParse(tallerId);
  if (!parsed.success) return { ok: false, error: "Taller inválido" };

  const admin = createAdminClient();
  const { error } = await admin
    .from("talleres")
    .update({
      aislado_at: new Date().toISOString(),
      aislado_por: gate.access.userId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", parsed.data)
    .is("aislado_at", null);

  if (error) return { ok: false, error: error.message };
  revalidateMaster();
  return { ok: true };
}

export async function restaurarTallerAction(tallerId: string): Promise<ActionResult> {
  const gate = await requireMaster();
  if (!gate.ok) return gate;

  const parsed = z.string().uuid().safeParse(tallerId);
  if (!parsed.success) return { ok: false, error: "Taller inválido" };

  const admin = createAdminClient();
  const { error } = await admin
    .from("talleres")
    .update({
      aislado_at: null,
      aislado_por: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", parsed.data)
    .not("aislado_at", "is", null);

  if (error) return { ok: false, error: error.message };
  revalidateMaster();
  return { ok: true };
}

export async function borrarTallerDefinitivoAction(
  tallerId: string
): Promise<ActionResult> {
  const gate = await requireMaster();
  if (!gate.ok) return gate;

  const parsed = z.string().uuid().safeParse(tallerId);
  if (!parsed.success) return { ok: false, error: "Taller inválido" };

  const admin = createAdminClient();
  const { data: taller, error: findError } = await admin
    .from("talleres")
    .select("id, aislado_at")
    .eq("id", parsed.data)
    .maybeSingle();

  if (findError) return { ok: false, error: findError.message };
  if (!taller) return { ok: false, error: "Taller no encontrado" };
  if (!taller.aislado_at) {
    return {
      ok: false,
      error: "Primero aísla el taller antes del borrado definitivo.",
    };
  }

  const { data: vehiculos } = await admin
    .from("vehiculos")
    .select("id")
    .eq("taller_id", parsed.data);

  for (const v of vehiculos ?? []) {
    const deleted = await deleteVehiculoConDependencias(admin, {
      vehiculoId: v.id as string,
      tallerId: parsed.data,
    });
    if (!deleted.ok) return deleted;
  }

  await admin.from("ordenes_recepcion").delete().eq("taller_id", parsed.data);
  await admin.from("mantenimientos").delete().eq("taller_id", parsed.data);
  await admin.from("repuestos").delete().eq("taller_id", parsed.data);
  await admin.from("nfc_stickers").delete().eq("taller_id", parsed.data);

  const { error } = await admin.from("talleres").delete().eq("id", parsed.data);
  if (error) return { ok: false, error: error.message };

  revalidateMaster();
  return { ok: true };
}

export async function aislarPortalUsuarioAction(
  userId: string
): Promise<ActionResult> {
  const gate = await requireMaster();
  if (!gate.ok) return gate;

  const parsed = z.string().uuid().safeParse(userId);
  if (!parsed.success) return { ok: false, error: "Usuario inválido" };
  if (parsed.data === gate.access.userId) {
    return { ok: false, error: "No puedes aislar tu propia cuenta máster." };
  }

  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("portal_accesos")
    .select("user_id, roles")
    .eq("user_id", parsed.data)
    .maybeSingle();

  if (!existing) {
    return { ok: false, error: "No hay acceso de portal para ese usuario." };
  }

  const roles = Array.isArray(existing.roles) ? (existing.roles as string[]) : [];
  if (roles.includes("master")) {
    return { ok: false, error: "No se puede aislar a otro administrador máster." };
  }

  const { error } = await admin
    .from("portal_accesos")
    .update({
      aislado_at: new Date().toISOString(),
      aislado_por: gate.access.userId,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", parsed.data)
    .is("aislado_at", null);

  if (error) return { ok: false, error: error.message };
  revalidateMaster();
  return { ok: true };
}

export async function restaurarPortalUsuarioAction(
  userId: string
): Promise<ActionResult> {
  const gate = await requireMaster();
  if (!gate.ok) return gate;

  const parsed = z.string().uuid().safeParse(userId);
  if (!parsed.success) return { ok: false, error: "Usuario inválido" };

  const admin = createAdminClient();
  const { error } = await admin
    .from("portal_accesos")
    .update({
      aislado_at: null,
      aislado_por: null,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", parsed.data)
    .not("aislado_at", "is", null);

  if (error) return { ok: false, error: error.message };
  revalidateMaster();
  return { ok: true };
}

export async function borrarPortalUsuarioDefinitivoAction(
  userId: string
): Promise<ActionResult> {
  const gate = await requireMaster();
  if (!gate.ok) return gate;

  const parsed = z.string().uuid().safeParse(userId);
  if (!parsed.success) return { ok: false, error: "Usuario inválido" };
  if (parsed.data === gate.access.userId) {
    return { ok: false, error: "No puedes borrar tu propia cuenta máster." };
  }

  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("portal_accesos")
    .select("user_id, roles, aislado_at")
    .eq("user_id", parsed.data)
    .maybeSingle();

  if (!existing) return { ok: false, error: "Acceso de portal no encontrado" };
  if (!existing.aislado_at) {
    return {
      ok: false,
      error: "Primero aísla el acceso antes del borrado definitivo.",
    };
  }

  const roles = Array.isArray(existing.roles) ? (existing.roles as string[]) : [];
  if (roles.includes("master")) {
    return { ok: false, error: "No se puede borrar a otro administrador máster." };
  }

  await admin.from("vehiculo_compartidos").delete().eq("user_id", parsed.data);
  await admin.from("portal_login_logs").delete().eq("user_id", parsed.data);

  const { error } = await admin
    .from("portal_accesos")
    .delete()
    .eq("user_id", parsed.data);

  if (error) return { ok: false, error: error.message };
  revalidateMaster();
  return { ok: true };
}
