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
import {
  activarDemoGenericoSchema,
  cerrarAccesoDemoSchema,
  crearAccesoDemoSchema,
} from "@/lib/validations/portal-demo";
import {
  DEMO_ROLES_DEFAULT,
  demoExpiresAtFromNow,
  generateDemoPassword,
  getDemoCredentialsFromEnv,
  isDemoExpired,
  shouldShowDemoCredentialsOnLogin,
} from "@/lib/portal/demo-access";
import { IMPORTACION_BASE } from "@/lib/importacion/paths";
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
  esDemo: boolean;
  demoExpiresAt: string | null;
  demoClosedAt: string | null;
};

type ActionResult = { ok: true } | { ok: false; error: string };

export type CrearAccesoDemoResult =
  | {
      ok: true;
      userId: string;
      email: string;
      password: string;
      expiresAt: string;
      loginPath: string;
    }
  | { ok: false; error: string };

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
  const withDemo = await admin
    .from("portal_accesos")
    .select(
      "user_id, roles, ver_todo, taller_ids, org_nombre, aislado_at, es_demo, demo_expires_at, demo_closed_at"
    )
    .order("updated_at", { ascending: false });

  let portalRows = withDemo.data as
    | Array<Record<string, unknown>>
    | null;
  let error = withDemo.error;

  if (error?.message?.toLowerCase().includes("es_demo")) {
    const legacy = await admin
      .from("portal_accesos")
      .select("user_id, roles, ver_todo, taller_ids, org_nombre, aislado_at")
      .order("updated_at", { ascending: false });
    portalRows = (legacy.data ?? []).map((row) => ({
      ...row,
      es_demo: false,
      demo_expires_at: null,
      demo_closed_at: null,
    }));
    error = legacy.error;
  }

  if (error) return { success: false, error: error.message };

  const rows: MasterPortalUserRow[] = [];
  for (const row of portalRows ?? []) {
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
      esDemo: Boolean(row.es_demo),
      demoExpiresAt: (row.demo_expires_at as string | null) ?? null,
      demoClosedAt: (row.demo_closed_at as string | null) ?? null,
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

export type DemoGenericoEstado = {
  configured: boolean;
  email: string | null;
  password: string | null;
  loginPath: string;
  userId: string | null;
  activo: boolean;
  expiresAt: string | null;
  closedAt: string | null;
};

/** Estado de la cuenta demo fija (mismo usuario/clave siempre). */
export async function getDemoGenericoEstadoAction(): Promise<
  | { ok: true; estado: DemoGenericoEstado }
  | { ok: false; error: string }
> {
  const gate = await requireMaster();
  if (!gate.ok) return gate;

  const creds = getDemoCredentialsFromEnv();
  const loginPath = `${IMPORTACION_BASE}/login`;
  if (!creds) {
    return {
      ok: true,
      estado: {
        configured: false,
        email: null,
        password: null,
        loginPath,
        userId: null,
        activo: false,
        expiresAt: null,
        closedAt: null,
      },
    };
  }

  const admin = createAdminClient();
  const found = await findAuthUserIdByEmail(admin, creds.email);
  if (!found.ok) {
    return {
      ok: true,
      estado: {
        configured: true,
        email: creds.email,
        password: creds.password,
        loginPath,
        userId: null,
        activo: false,
        expiresAt: null,
        closedAt: null,
      },
    };
  }

  const { data: row } = await admin
    .from("portal_accesos")
    .select("aislado_at, es_demo, demo_expires_at, demo_closed_at")
    .eq("user_id", found.userId)
    .maybeSingle();

  const expiresAt = (row?.demo_expires_at as string | null) ?? null;
  const closedAt = (row?.demo_closed_at as string | null) ?? null;
  const aislado = Boolean(row?.aislado_at);
  const activo =
    Boolean(row?.es_demo) &&
    !aislado &&
    !closedAt &&
    !isDemoExpired(expiresAt);

  return {
    ok: true,
    estado: {
      configured: true,
      email: creds.email,
      password: creds.password,
      loginPath,
      userId: found.userId,
      activo,
      expiresAt,
      closedAt,
    },
  };
}

/**
 * Hint público para la pantalla de login (solo si la demo genérica está abierta
 * y NEXT_PUBLIC_DEMO_SHOW_ON_LOGIN=1).
 */
export async function getDemoLoginHintAction(): Promise<{
  email: string;
  password: string;
} | null> {
  if (!shouldShowDemoCredentialsOnLogin()) return null;
  const creds = getDemoCredentialsFromEnv();
  if (!creds) return null;

  try {
    const admin = createAdminClient();
    const found = await findAuthUserIdByEmail(admin, creds.email);
    if (!found.ok) return null;
    const { data: row } = await admin
      .from("portal_accesos")
      .select("aislado_at, es_demo, demo_expires_at, demo_closed_at")
      .eq("user_id", found.userId)
      .maybeSingle();
    if (!row?.es_demo) return null;
    if (row.aislado_at || row.demo_closed_at) return null;
    if (isDemoExpired(row.demo_expires_at as string | null)) return null;
    return creds;
  } catch {
    return null;
  }
}

/**
 * Activa (o reabre) la cuenta demo fija: siempre el mismo usuario y clave
 * definidos en DEMO_EMAIL / DEMO_PASSWORD.
 */
export async function activarDemoGenericoAction(input: {
  duracionHoras: number;
}): Promise<CrearAccesoDemoResult> {
  const gate = await requireMaster();
  if (!gate.ok) return gate;

  const parsed = activarDemoGenericoSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.errors[0]?.message ?? "Datos inválidos",
    };
  }

  const creds = getDemoCredentialsFromEnv();
  if (!creds) {
    return {
      ok: false,
      error:
        "Configura DEMO_EMAIL y DEMO_PASSWORD en las variables de entorno (mín. 8 caracteres en la clave).",
    };
  }

  const expiresIso = demoExpiresAtFromNow(
    parsed.data.duracionHoras
  ).toISOString();
  const orgNombre = "Cuenta demo";
  const roles = [...DEMO_ROLES_DEFAULT];
  const admin = createAdminClient();
  const now = new Date().toISOString();

  let userId: string;
  const existing = await findAuthUserIdByEmail(admin, creds.email);
  if (existing.ok) {
    userId = existing.userId;
    const { error: updateError } = await admin.auth.admin.updateUserById(
      userId,
      {
        password: creds.password,
        ban_duration: "none",
        email_confirm: true,
        app_metadata: {
          es_demo: true,
          demo_expires_at: expiresIso,
          demo_closed: false,
          demo_generico: true,
        },
        user_metadata: {
          es_demo: true,
          demo_expires_at: expiresIso,
          org_nombre: orgNombre,
        },
      }
    );
    if (updateError) return { ok: false, error: updateError.message };
  } else {
    const { data: created, error: createError } =
      await admin.auth.admin.createUser({
        email: creds.email,
        password: creds.password,
        email_confirm: true,
        app_metadata: {
          es_demo: true,
          demo_expires_at: expiresIso,
          demo_closed: false,
          demo_generico: true,
        },
        user_metadata: {
          es_demo: true,
          demo_expires_at: expiresIso,
          org_nombre: orgNombre,
        },
      });
    if (createError || !created.user) {
      return {
        ok: false,
        error: createError?.message ?? "No se pudo crear el usuario demo",
      };
    }
    userId = created.user.id;
  }

  let tallerId: string | null = null;
  const { data: tallerExistente } = await admin
    .from("talleres")
    .select("id, aislado_at")
    .eq("owner_user_id", userId)
    .maybeSingle();

  if (tallerExistente) {
    tallerId = tallerExistente.id as string;
    if (tallerExistente.aislado_at) {
      await admin
        .from("talleres")
        .update({
          aislado_at: null,
          aislado_por: null,
          updated_at: now,
        })
        .eq("id", tallerId);
    }
  } else {
    const codigo = crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase();
    const tipoIndustria: TipoIndustria = "concesionario";
    const { data: taller, error: tallerError } = await admin
      .from("talleres")
      .insert({
        owner_user_id: userId,
        nombre: orgNombre,
        codigo_vinculo: codigo,
        tipo_industria: tipoIndustria,
      })
      .select("id")
      .single();
    if (tallerError || !taller) {
      return {
        ok: false,
        error: tallerError?.message ?? "No se pudo crear el espacio demo",
      };
    }
    tallerId = taller.id as string;
  }

  const { error: portalError } = await admin.from("portal_accesos").upsert(
    {
      user_id: userId,
      roles,
      ver_todo: false,
      taller_ids: tallerId ? [tallerId] : [],
      org_nombre: orgNombre,
      es_demo: true,
      demo_expires_at: expiresIso,
      demo_closed_at: null,
      aislado_at: null,
      aislado_por: null,
      updated_at: now,
    },
    { onConflict: "user_id" }
  );

  if (portalError?.message?.toLowerCase().includes("es_demo")) {
    return {
      ok: false,
      error:
        "Falta la migración de acceso demo (`20260907230000_portal_acceso_demo.sql`). Ejecútala en Supabase SQL Editor.",
    };
  }
  if (portalError) return { ok: false, error: portalError.message };

  revalidateMaster();
  return {
    ok: true,
    userId,
    email: creds.email,
    password: creds.password,
    expiresAt: expiresIso,
    loginPath: `${IMPORTACION_BASE}/login`,
  };
}

/**
 * Crea un usuario Auth + acceso portal demo con clave y caducidad.
 * Devuelve la clave una sola vez para compartirla con quien revisa la app.
 */
export async function crearAccesoDemoAction(input: {
  email: string;
  duracionHoras: number;
  roles: Array<"concesionario" | "taller" | "usuario" | "aduanera">;
  orgNombre?: string | null;
  password?: string | null;
}): Promise<CrearAccesoDemoResult> {
  const gate = await requireMaster();
  if (!gate.ok) return gate;

  const parsed = crearAccesoDemoSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.errors[0]?.message ?? "Datos inválidos",
    };
  }

  const email = parsed.data.email.trim().toLowerCase();
  const password =
    parsed.data.password?.trim() && parsed.data.password.trim().length >= 8
      ? parsed.data.password.trim()
      : generateDemoPassword(12);
  const expiresAt = demoExpiresAtFromNow(parsed.data.duracionHoras);
  const expiresIso = expiresAt.toISOString();
  const orgNombre =
    parsed.data.orgNombre?.trim() ||
    `Demo ${parsed.data.duracionHoras}h`;
  const roles = [...parsed.data.roles];
  if (!roles.includes("usuario")) roles.push("usuario");

  const admin = createAdminClient();
  const existing = await findAuthUserIdByEmail(admin, email);
  if (existing.ok) {
    return {
      ok: false,
      error:
        "Ese correo ya tiene cuenta. Usa otro email demo o aísla/cierra la cuenta existente.",
    };
  }

  const { data: created, error: createError } =
    await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      app_metadata: {
        es_demo: true,
        demo_expires_at: expiresIso,
      },
      user_metadata: {
        es_demo: true,
        demo_expires_at: expiresIso,
        org_nombre: orgNombre,
      },
    });

  if (createError || !created.user) {
    return {
      ok: false,
      error: createError?.message ?? "No se pudo crear el usuario demo",
    };
  }

  const userId = created.user.id;
  const now = new Date().toISOString();

  // Espacio propio aislado (taller/concesionario) para que revisen sin ver data ajena.
  const codigo = crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase();
  const tipoIndustria: TipoIndustria = "concesionario";
  const { data: taller, error: tallerError } = await admin
    .from("talleres")
    .insert({
      owner_user_id: userId,
      nombre: orgNombre.slice(0, 80),
      codigo_vinculo: codigo,
      tipo_industria: tipoIndustria,
    })
    .select("id")
    .single();

  if (tallerError || !taller) {
    await admin.auth.admin.deleteUser(userId);
    return {
      ok: false,
      error: tallerError?.message ?? "No se pudo crear el espacio demo",
    };
  }

  const portalPayload = {
    user_id: userId,
    roles,
    ver_todo: false,
    taller_ids: [taller.id as string],
    org_nombre: orgNombre,
    es_demo: true,
    demo_expires_at: expiresIso,
    demo_closed_at: null,
    updated_at: now,
  };

  const { error: portalError } = await admin
    .from("portal_accesos")
    .upsert(portalPayload, { onConflict: "user_id" });

  if (portalError?.message?.toLowerCase().includes("es_demo")) {
    await admin.auth.admin.deleteUser(userId);
    return {
      ok: false,
      error:
        "Falta la migración de acceso demo (`20260907230000_portal_acceso_demo.sql`). Ejecútala en Supabase SQL Editor.",
    };
  }

  if (portalError) {
    await admin.auth.admin.deleteUser(userId);
    return { ok: false, error: portalError.message };
  }

  revalidateMaster();
  return {
    ok: true,
    userId,
    email,
    password,
    expiresAt: expiresIso,
    loginPath: `${IMPORTACION_BASE}/login`,
  };
}

/**
 * Cierra la demo: aísla acceso, invalida sesiones y bloquea el login.
 */
export async function cerrarAccesoDemoAction(
  userId: string
): Promise<ActionResult> {
  const gate = await requireMaster();
  if (!gate.ok) return gate;

  const parsed = cerrarAccesoDemoSchema.safeParse({ userId });
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.errors[0]?.message ?? "Usuario inválido",
    };
  }
  if (parsed.data.userId === gate.access.userId) {
    return { ok: false, error: "No puedes cerrar tu propia cuenta máster." };
  }

  const admin = createAdminClient();
  const { data: existing, error: findError } = await admin
    .from("portal_accesos")
    .select("user_id, roles, es_demo, aislado_at")
    .eq("user_id", parsed.data.userId)
    .maybeSingle();

  if (findError?.message?.toLowerCase().includes("es_demo")) {
    return {
      ok: false,
      error:
        "Falta la migración de acceso demo (`20260907230000_portal_acceso_demo.sql`).",
    };
  }
  if (findError) return { ok: false, error: findError.message };
  if (!existing) {
    return { ok: false, error: "No hay acceso de portal para ese usuario." };
  }

  const roles = parseRoleList(existing.roles);
  if (roles.includes("master")) {
    return { ok: false, error: "No se puede cerrar una cuenta máster." };
  }
  if (!existing.es_demo) {
    return {
      ok: false,
      error: "Ese usuario no es una cuenta demo. Usa Aislar si quieres desactivarlo.",
    };
  }

  const now = new Date().toISOString();
  const { error: portalError } = await admin
    .from("portal_accesos")
    .update({
      aislado_at: existing.aislado_at ?? now,
      aislado_por: gate.access.userId,
      demo_closed_at: now,
      demo_expires_at: now,
      updated_at: now,
    })
    .eq("user_id", parsed.data.userId);

  if (portalError) return { ok: false, error: portalError.message };

  await admin
    .from("talleres")
    .update({
      aislado_at: now,
      aislado_por: gate.access.userId,
      updated_at: now,
    })
    .eq("owner_user_id", parsed.data.userId)
    .is("aislado_at", null);

  // Invalida sesiones activas y bloquea nuevos logins.
  // La cuenta genérica conserva la misma clave (DEMO_PASSWORD) para reabrir después.
  await admin.auth.admin.signOut(parsed.data.userId).catch(() => undefined);

  const creds = getDemoCredentialsFromEnv();
  const { data: authUser } = await admin.auth.admin.getUserById(
    parsed.data.userId
  );
  const esGenerico =
    Boolean(authUser.user?.app_metadata?.demo_generico) ||
    (creds != null &&
      authUser.user?.email?.toLowerCase() === creds.email.toLowerCase());

  if (esGenerico && creds) {
    await admin.auth.admin
      .updateUserById(parsed.data.userId, {
        password: creds.password,
        ban_duration: "876600h",
        app_metadata: {
          es_demo: true,
          demo_expires_at: now,
          demo_closed: true,
          demo_generico: true,
        },
      })
      .catch(() => undefined);
  } else {
    const newPassword = generateDemoPassword(16);
    await admin.auth.admin
      .updateUserById(parsed.data.userId, {
        password: newPassword,
        ban_duration: "876600h",
        app_metadata: {
          es_demo: true,
          demo_expires_at: now,
          demo_closed: true,
        },
      })
      .catch(() => undefined);
  }

  revalidateMaster();
  return { ok: true };
}

/** Extiende o acorta la caducidad de una demo activa. */
export async function renovarAccesoDemoAction(input: {
  userId: string;
  duracionHoras: number;
}): Promise<ActionResult> {
  const gate = await requireMaster();
  if (!gate.ok) return gate;

  const schema = z.object({
    userId: z.string().uuid(),
    duracionHoras: crearAccesoDemoSchema.shape.duracionHoras,
  });
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.errors[0]?.message ?? "Datos inválidos",
    };
  }

  const admin = createAdminClient();
  const expiresIso = demoExpiresAtFromNow(parsed.data.duracionHoras).toISOString();
  const now = new Date().toISOString();

  const { data: existing, error: findError } = await admin
    .from("portal_accesos")
    .select("user_id, es_demo, aislado_at")
    .eq("user_id", parsed.data.userId)
    .maybeSingle();

  if (findError) return { ok: false, error: findError.message };
  if (!existing?.es_demo) {
    return { ok: false, error: "No es una cuenta demo." };
  }
  if (existing.aislado_at) {
    return {
      ok: false,
      error: "La demo está cerrada/aislada. Crea una nueva si hace falta.",
    };
  }

  const { error } = await admin
    .from("portal_accesos")
    .update({
      demo_expires_at: expiresIso,
      demo_closed_at: null,
      updated_at: now,
    })
    .eq("user_id", parsed.data.userId);

  if (error) return { ok: false, error: error.message };

  await admin.auth.admin
    .updateUserById(parsed.data.userId, {
      ban_duration: "none",
      app_metadata: {
        es_demo: true,
        demo_expires_at: expiresIso,
        demo_closed: false,
      },
      user_metadata: {
        es_demo: true,
        demo_expires_at: expiresIso,
      },
    })
    .catch(() => undefined);

  revalidateMaster();
  return { ok: true };
}
