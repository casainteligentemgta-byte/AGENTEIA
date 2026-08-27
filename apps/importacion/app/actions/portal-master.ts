"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  resolvePortalAccess,
  requirePortalRole,
  type PortalRole,
} from "@/lib/portal/roles";
import { deleteVehiculoConDependencias } from "@/lib/vehicles/delete-cascade";
import {
  crearPortalAccesoPorEmailSchema,
  mensajeAlcanceInsuficiente,
  updateTallerEtiquetaSchema,
  upsertPortalAccesoSchema,
} from "@/lib/validations/portal-acceso";
import type { TipoIndustria } from "@/lib/platform/types";

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
  tallerIds: string[];
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
      error:
        "Solo el máster con visión global (ver_todo) puede gestionar roles, etiquetas, aislar o borrar.",
    };
  }
  return { ok: true as const, access: gate.access };
}

function revalidateMaster() {
  revalidatePath("/portales/master");
  revalidatePath("/portales");
  revalidatePath("/smartimport");
  revalidatePath("/dashboard");
}

function parseRoleList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((item): item is string => typeof item === "string");
}

function parseIdList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((item): item is string => typeof item === "string");
}

function isGlobalMaster(roles: readonly string[], verTodo: boolean): boolean {
  return roles.includes("master") && verTodo;
}

async function countGlobalMasters(
  admin: ReturnType<typeof createAdminClient>,
  exceptUserId?: string
): Promise<number> {
  const { data } = await admin
    .from("portal_accesos")
    .select("user_id, roles, ver_todo, aislado_at");

  return (data ?? []).filter((row) => {
    if (row.aislado_at) return false;
    if (exceptUserId && row.user_id === exceptUserId) return false;
    return isGlobalMaster(parseRoleList(row.roles), Boolean(row.ver_todo));
  }).length;
}

async function findAuthUserIdByEmail(
  admin: ReturnType<typeof createAdminClient>,
  email: string
): Promise<{ ok: true; userId: string } | { ok: false; error: string }> {
  const normalized = email.trim().toLowerCase();
  const perPage = 200;
  for (let page = 1; page <= 25; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) return { ok: false, error: error.message };
    const users = data.users ?? [];
    const found = users.find((user) => user.email?.toLowerCase() === normalized);
    if (found) return { ok: true, userId: found.id };
    if (users.length < perPage) {
      return {
        ok: false,
        error: "Ese correo no tiene cuenta. La persona debe registrarse primero.",
      };
    }
  }
  return {
    ok: false,
    error: "No se encontró el correo en las cuentas registradas.",
  };
}

async function assertMasterChangeAllowed(params: {
  admin: ReturnType<typeof createAdminClient>;
  actorUserId: string;
  targetUserId: string;
  nextRoles: readonly string[];
  nextVerTodo: boolean;
}): Promise<ActionResult | { ok: true }> {
  const { admin, actorUserId, targetUserId, nextRoles, nextVerTodo } = params;

  if (targetUserId === actorUserId) {
    if (!isGlobalMaster(nextRoles, nextVerTodo)) {
      return {
        ok: false,
        error: "No puedes quitarte el rol máster ni la visión global.",
      };
    }
  }

  const { data: current } = await admin
    .from("portal_accesos")
    .select("roles, ver_todo, aislado_at")
    .eq("user_id", targetUserId)
    .maybeSingle();

  const currentlyGlobal = current
    ? isGlobalMaster(parseRoleList(current.roles), Boolean(current.ver_todo)) &&
      current.aislado_at == null
    : false;

  if (currentlyGlobal && !isGlobalMaster(nextRoles, nextVerTodo)) {
    const remaining = await countGlobalMasters(admin, targetUserId);
    if (remaining === 0) {
      return {
        ok: false,
        error: "Debe quedar al menos un máster con visión global (ver_todo).",
      };
    }
  }

  return { ok: true };
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
    .select("user_id, roles, ver_todo, taller_ids, org_nombre, aislado_at")
    .order("updated_at", { ascending: false });

  if (error) return { success: false, error: error.message };

  const rows: MasterPortalUserRow[] = [];
  for (const row of data ?? []) {
    const userId = row.user_id as string;
    const { data: authData } = await admin.auth.admin.getUserById(userId);
    const roles = parseRoleList(row.roles);
    rows.push({
      userId,
      email: authData.user?.email ?? null,
      roles,
      orgNombre: (row.org_nombre as string | null) ?? null,
      verTodo: Boolean(row.ver_todo),
      tallerIds: parseIdList(row.taller_ids),
      aisladoAt: (row.aislado_at as string | null) ?? null,
    });
  }

  return {
    success: true,
    activos: rows.filter((r) => !r.aisladoAt),
    aislados: rows.filter((r) => Boolean(r.aisladoAt)),
  };
}

export async function updatePortalAccesoAction(input: {
  userId: string;
  roles: PortalRole[];
  verTodo: boolean;
  tallerIds: string[];
  orgNombre: string | null;
}): Promise<ActionResult> {
  const gate = await requireMaster();
  if (!gate.ok) return gate;

  const parsed = upsertPortalAccesoSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.errors[0]?.message ?? "Datos inválidos",
    };
  }

  const alcanceError = mensajeAlcanceInsuficiente(
    parsed.data.roles,
    parsed.data.verTodo,
    parsed.data.tallerIds
  );
  if (alcanceError) return { ok: false, error: alcanceError };

  const admin = createAdminClient();
  const { data: existing, error: findError } = await admin
    .from("portal_accesos")
    .select("user_id, aislado_at")
    .eq("user_id", parsed.data.userId)
    .maybeSingle();

  if (findError) return { ok: false, error: findError.message };
  if (!existing) {
    return { ok: false, error: "No hay acceso de portal para ese usuario." };
  }
  if (existing.aislado_at) {
    return {
      ok: false,
      error: "Este acceso está aislado. Restáuralo antes de editar roles.",
    };
  }

  const allowed = await assertMasterChangeAllowed({
    admin,
    actorUserId: gate.access.userId,
    targetUserId: parsed.data.userId,
    nextRoles: parsed.data.roles,
    nextVerTodo: parsed.data.verTodo,
  });
  if (!allowed.ok) return allowed;

  const orgNombre = parsed.data.orgNombre?.trim()
    ? parsed.data.orgNombre.trim()
    : null;

  const { error } = await admin
    .from("portal_accesos")
    .update({
      roles: parsed.data.roles,
      ver_todo: parsed.data.verTodo,
      taller_ids: parsed.data.tallerIds,
      org_nombre: orgNombre,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", parsed.data.userId);

  if (error) return { ok: false, error: error.message };
  revalidateMaster();
  return { ok: true };
}

export async function crearPortalAccesoPorEmailAction(input: {
  email: string;
  roles: PortalRole[];
  verTodo: boolean;
  tallerIds: string[];
  orgNombre: string | null;
}): Promise<ActionResult> {
  const gate = await requireMaster();
  if (!gate.ok) return gate;

  const parsed = crearPortalAccesoPorEmailSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.errors[0]?.message ?? "Datos inválidos",
    };
  }

  const alcanceError = mensajeAlcanceInsuficiente(
    parsed.data.roles,
    parsed.data.verTodo,
    parsed.data.tallerIds
  );
  if (alcanceError) return { ok: false, error: alcanceError };

  const admin = createAdminClient();
  const found = await findAuthUserIdByEmail(admin, parsed.data.email);
  if (!found.ok) return found;

  const { data: existing, error: findError } = await admin
    .from("portal_accesos")
    .select("user_id, aislado_at")
    .eq("user_id", found.userId)
    .maybeSingle();

  if (findError) return { ok: false, error: findError.message };
  if (existing?.aislado_at) {
    return {
      ok: false,
      error: "Este acceso está aislado. Restáuralo antes de editar roles.",
    };
  }

  const allowed = await assertMasterChangeAllowed({
    admin,
    actorUserId: gate.access.userId,
    targetUserId: found.userId,
    nextRoles: parsed.data.roles,
    nextVerTodo: parsed.data.verTodo,
  });
  if (!allowed.ok) return allowed;

  const orgNombre = parsed.data.orgNombre?.trim()
    ? parsed.data.orgNombre.trim()
    : null;
  const now = new Date().toISOString();

  const { error } = await admin.from("portal_accesos").upsert(
    {
      user_id: found.userId,
      roles: parsed.data.roles,
      ver_todo: parsed.data.verTodo,
      taller_ids: parsed.data.tallerIds,
      org_nombre: orgNombre,
      updated_at: now,
    },
    { onConflict: "user_id" }
  );

  if (error) return { ok: false, error: error.message };
  revalidateMaster();
  return { ok: true };
}

export async function updateTallerEtiquetaAction(input: {
  tallerId: string;
  tipoIndustria: TipoIndustria;
}): Promise<ActionResult> {
  const gate = await requireMaster();
  if (!gate.ok) return gate;

  const parsed = updateTallerEtiquetaSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.errors[0]?.message ?? "Datos inválidos",
    };
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("talleres")
    .update({
      tipo_industria: parsed.data.tipoIndustria,
      updated_at: new Date().toISOString(),
    })
    .eq("id", parsed.data.tallerId);

  if (error) return { ok: false, error: error.message };
  revalidateMaster();
  return { ok: true };
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
