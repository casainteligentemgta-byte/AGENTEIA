"use server";

import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolvePortalAccess } from "@/lib/portal/roles";
import { canViewLoginLogs } from "@/lib/importacion/access";

export type PortalLoginLogRow = {
  id: string;
  userId: string;
  email: string | null;
  roles: string[];
  path: string | null;
  userAgent: string | null;
  createdAt: string;
};

/**
 * Registra un ingreso tras login exitoso.
 * Soft-fail si la tabla aún no existe (migración pendiente).
 */
export async function recordPortalLoginAction(
  path?: string | null
): Promise<{ success: true } | { success: false; error: string }> {
  const access = await resolvePortalAccess();
  if (!access) return { success: false, error: "No autenticado" };

  const headerStore = headers();
  const userAgent = headerStore.get("user-agent");

  try {
    const admin = createAdminClient();
    const { error } = await admin.from("portal_login_logs").insert({
      user_id: access.userId,
      email: access.email,
      roles: access.roles,
      path: path?.slice(0, 500) ?? null,
      user_agent: userAgent?.slice(0, 500) ?? null,
    });

    if (error) {
      // Tabla ausente u otro error no bloqueante para el login.
      if (
        error.code === "42P01" ||
        /portal_login_logs/i.test(error.message)
      ) {
        return { success: true };
      }
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "No se pudo registrar el ingreso",
    };
  }
}

/** Lista ingresos recientes — solo administrador máster. */
export async function listPortalLoginLogsAction(limit = 100): Promise<
  | { success: true; logs: PortalLoginLogRow[] }
  | { success: false; error: string }
> {
  const access = await resolvePortalAccess();
  if (!canViewLoginLogs(access)) {
    return {
      success: false,
      error: "Solo el administrador máster puede ver el registro de ingresos.",
    };
  }

  const safeLimit = Math.min(Math.max(limit, 1), 500);
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("portal_login_logs")
    .select("id, user_id, email, roles, path, user_agent, created_at")
    .order("created_at", { ascending: false })
    .limit(safeLimit);

  if (error) {
    if (error.code === "42P01") {
      return {
        success: false,
        error:
          "Falta la tabla portal_login_logs. Ejecuta la migración 20260809120000_importacion_roles_login_logs.sql.",
      };
    }
    return { success: false, error: error.message };
  }

  return {
    success: true,
    logs: (data ?? []).map((row) => ({
      id: row.id as string,
      userId: row.user_id as string,
      email: (row.email as string | null) ?? null,
      roles: Array.isArray(row.roles)
        ? (row.roles as unknown[]).filter((r): r is string => typeof r === "string")
        : [],
      path: (row.path as string | null) ?? null,
      userAgent: (row.user_agent as string | null) ?? null,
      createdAt: String(row.created_at ?? ""),
    })),
  };
}
