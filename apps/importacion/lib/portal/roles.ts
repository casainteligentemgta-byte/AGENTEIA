import { createAdminClient } from "@/lib/supabase/admin";
import { getUser } from "@/lib/supabase/server";
import type { Taller } from "@/lib/taller";
import { IMPORTACION_BASE } from "@/lib/importacion/paths";

export const PORTAL_ROLES = [
  "master",
  "admin",
  "aduanera",
  "taller",
  "concesionario",
  "usuario",
] as const;

export type PortalRole = (typeof PORTAL_ROLES)[number];

export type PortalAccess = {
  userId: string;
  email: string | null;
  roles: PortalRole[];
  verTodo: boolean;
  tallerIds: string[];
  orgNombre: string | null;
  tallerPropio: Taller | null;
};

export const PORTAL_META: Record<
  PortalRole,
  {
    title: string;
    description: string;
    href: string;
    accent: string;
  }
> = {
  master: {
    title: "Administrador máster",
    description:
      "Ve y modifica todo, supervisa el módulo e ingresos (logs). Alcance global con autorización.",
    href: `${IMPORTACION_BASE}/admin/ingresos`,
    accent: "border-amber-500/40 bg-amber-950/30 text-amber-100",
  },
  admin: {
    title: "Administrador",
    description:
      "Ve y modifica toda la data de importación. No accede a logs de supervisión.",
    href: IMPORTACION_BASE,
    accent: "border-orange-500/40 bg-orange-950/30 text-orange-100",
  },
  aduanera: {
    title: "Aduanera",
    description: "Monitoreo de expedientes Puerto Libre e importaciones.",
    href: IMPORTACION_BASE,
    accent: "border-sky-500/40 bg-sky-950/30 text-sky-100",
  },
  taller: {
    title: "Taller",
    description:
      "Operación del taller y módulo Importación: solo la data de tus clientes.",
    href: IMPORTACION_BASE,
    accent: "border-cyan-500/40 bg-cyan-950/30 text-cyan-100",
  },
  concesionario: {
    title: "Concesionario",
    description:
      "Carga y modifica la data de tus clientes en Importación. No ves otros concesionarios.",
    href: IMPORTACION_BASE,
    accent: "border-violet-500/40 bg-violet-950/30 text-violet-100",
  },
  usuario: {
    title: "Usuario",
    description:
      "Solo ves los vehículos de tu propiedad o los que un administrador te comparta.",
    href: IMPORTACION_BASE,
    accent: "border-emerald-500/40 bg-emerald-950/30 text-emerald-100",
  },
};

function asPortalRole(value: string): PortalRole | null {
  return (PORTAL_ROLES as readonly string[]).includes(value)
    ? (value as PortalRole)
    : null;
}

function parseRoles(raw: unknown): PortalRole[] {
  if (!Array.isArray(raw)) return [];
  const out: PortalRole[] = [];
  for (const item of raw) {
    if (typeof item !== "string") continue;
    const role = asPortalRole(item);
    if (role && !out.includes(role)) out.push(role);
  }
  return out;
}

/**
 * Resuelve roles del usuario: fila portal_accesos + inferencia (taller owner → taller, etc.).
 * No crea taller automáticamente (evita convertir usuarios en talleres al abrir Portales).
 */
export async function resolvePortalAccess(): Promise<PortalAccess | null> {
  const user = await getUser();
  if (!user) return null;

  const admin = createAdminClient();

  let tallerPropio: Taller | null = null;
  {
    const withAislado = await admin
      .from("talleres")
      .select(
        "id, nombre, owner_user_id, telegram_chat_id, codigo_vinculo, tipo_industria, created_at, aislado_at"
      )
      .eq("owner_user_id", user.id)
      .is("aislado_at", null)
      .maybeSingle();

    if (withAislado.error?.message?.toLowerCase().includes("aislado_at")) {
      const legacy = await admin
        .from("talleres")
        .select(
          "id, nombre, owner_user_id, telegram_chat_id, codigo_vinculo, tipo_industria, created_at"
        )
        .eq("owner_user_id", user.id)
        .maybeSingle();
      tallerPropio = (legacy.data as Taller | null) ?? null;
    } else {
      tallerPropio = (withAislado.data as Taller | null) ?? null;
    }
  }

  let roles: PortalRole[] = [];
  let verTodo = false;
  let tallerIds: string[] = [];
  let orgNombre: string | null = null;

  const { data: row, error: portalError } = await admin
    .from("portal_accesos")
    .select("roles, ver_todo, taller_ids, org_nombre, aislado_at")
    .eq("user_id", user.id)
    .maybeSingle();

  // Soft-fail: columna aislado_at aún no migrada.
  let portalRow: {
    roles?: unknown;
    ver_todo?: boolean;
    taller_ids?: unknown;
    org_nombre?: unknown;
    aislado_at?: string | null;
  } | null = row as {
    roles?: unknown;
    ver_todo?: boolean;
    taller_ids?: unknown;
    org_nombre?: unknown;
    aislado_at?: string | null;
  } | null;
  let portalErr = portalError;
  if (portalError?.message?.toLowerCase().includes("aislado_at")) {
    const legacy = await admin
      .from("portal_accesos")
      .select("roles, ver_todo, taller_ids, org_nombre")
      .eq("user_id", user.id)
      .maybeSingle();
    portalRow = legacy.data
      ? { ...(legacy.data as object), aislado_at: null }
      : null;
    portalErr = legacy.error;
  }

  const portalAislado =
    !portalErr &&
    portalRow &&
    (portalRow as { aislado_at?: string | null }).aislado_at != null;

  if (!portalErr && portalRow && !portalAislado) {
    roles = parseRoles((portalRow as { roles?: unknown }).roles);
    verTodo = Boolean((portalRow as { ver_todo?: boolean }).ver_todo);
    const ids = (portalRow as { taller_ids?: unknown }).taller_ids;
    tallerIds = Array.isArray(ids)
      ? ids.filter((id): id is string => typeof id === "string")
      : [];
    orgNombre =
      typeof (portalRow as { org_nombre?: unknown }).org_nombre === "string"
        ? ((portalRow as { org_nombre: string }).org_nombre.trim() || null)
        : null;
  }

  // Acceso aislado: sin roles de portal (ni inferencia de taller).
  if (portalAislado) {
    return {
      userId: user.id,
      email: user.email ?? null,
      roles: [],
      verTodo: false,
      tallerIds: [],
      orgNombre: null,
      tallerPropio: null,
    };
  }

  // Inferencia sin fila (o complementar): dueño de taller / dueño de vehículos.
  if (tallerPropio && !roles.includes("taller")) {
    roles.push("taller");
  }
  if (
    tallerPropio?.tipo_industria === "concesionario" &&
    !roles.includes("concesionario")
  ) {
    roles.push("concesionario");
  }

  const { count } = await admin
    .from("vehiculos")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);

  if ((count ?? 0) > 0 && !roles.includes("usuario")) {
    roles.push("usuario");
  }

  // Todo usuario autenticado puede abrir el portal Usuario (vincular/consultar los suyos).
  if (!roles.includes("usuario")) {
    roles.push("usuario");
  }

  if (tallerPropio && !tallerIds.includes(tallerPropio.id)) {
    tallerIds = [...tallerIds, tallerPropio.id];
  }

  return {
    userId: user.id,
    email: user.email ?? null,
    roles,
    verTodo,
    tallerIds,
    orgNombre,
    tallerPropio,
  };
}

export function hasPortalRole(access: PortalAccess, role: PortalRole): boolean {
  if (access.roles.includes(role)) return true;
  // El máster puede abrir Administración y Aduanera.
  if (
    access.roles.includes("master") &&
    (role === "admin" || role === "aduanera")
  ) {
    return true;
  }
  return false;
}

export function requirePortalRole(
  access: PortalAccess | null,
  role: PortalRole
): { ok: true; access: PortalAccess } | { ok: false; error: string } {
  if (!access) return { ok: false, error: "No autenticado" };
  if (!hasPortalRole(access, role)) {
    return { ok: false, error: `No tienes acceso al portal ${PORTAL_META[role].title}` };
  }
  if (
    (role === "master" || role === "admin" || role === "aduanera") &&
    !access.verTodo &&
    access.tallerIds.length === 0
  ) {
    return {
      ok: false,
      error:
        role === "master"
          ? "Administrador máster sin alcance: activa ver_todo o asigna talleres."
          : role === "admin"
            ? "Administrador sin alcance: activa ver_todo o asigna talleres."
            : "Aduanera sin alcance: activa ver_todo o asigna talleres.",
    };
  }
  return { ok: true, access };
}

/** IDs de taller visibles según rol y flags. */
export function resolveVisibleTallerIds(
  access: PortalAccess,
  role: PortalRole
): { all: boolean; ids: string[] } {
  if (role === "master" || role === "admin" || role === "aduanera") {
    if (access.verTodo) return { all: true, ids: [] };
    return { all: false, ids: access.tallerIds };
  }
  if (role === "concesionario" || role === "taller") {
    return { all: false, ids: access.tallerIds };
  }
  return { all: false, ids: [] };
}

export function defaultHomeForAccess(access: PortalAccess): string {
  if (access.roles.includes("master") && access.verTodo) return "/portales/master";
  if (access.roles.includes("admin")) return IMPORTACION_BASE;
  if (access.roles.includes("aduanera")) return "/portales/aduanera";
  if (access.roles.includes("concesionario") && !access.roles.includes("taller")) {
    return IMPORTACION_BASE;
  }
  if (access.roles.includes("taller")) return "/dashboard";
  return IMPORTACION_BASE;
}
