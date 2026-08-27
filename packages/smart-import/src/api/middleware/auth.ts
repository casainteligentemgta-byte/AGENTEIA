import type { NextFunction, Request, Response } from "express";
import {
  createClient,
  type SupabaseClient,
  type User,
} from "@supabase/supabase-js";

export type SmartImportRole = "admin" | "user";

export type SmartImportUser = {
  id: string;
  email: string;
  role: SmartImportRole;
};

export type AuthenticatedRequest = Request & {
  user: SmartImportUser;
  supabase: SupabaseClient;
};

const TABLE_PERMISSIONS: Record<SmartImportRole, readonly string[]> = {
  admin: ["devices", "automations", "sensor_data", "users"],
  user: ["devices", "automations", "sensor_data"],
};

function getBearerToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header || typeof header !== "string") return null;
  const [scheme, token] = header.split(" ");
  if (!scheme || scheme.toLowerCase() !== "bearer" || !token?.trim()) {
    return null;
  }
  return token.trim();
}

function createUserScopedClient(accessToken: string): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const anon =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY;
  if (!url || !anon) {
    throw new Error("Faltan variables SUPABASE_URL / SUPABASE_ANON_KEY");
  }
  return createClient(url, anon, {
    global: {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function resolveRole(raw: unknown): SmartImportRole {
  if (raw === "admin") return "admin";
  return "user";
}

/**
 * Exige Authorization: Bearer <token> válido de Supabase Auth.
 * Carga el perfil desde `users` y adjunta `req.user` + `req.supabase`.
 */
export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const token = getBearerToken(req);
    if (!token) {
      res.status(401).json({
        success: false,
        error: "Falta token de autenticación (Authorization: Bearer …)",
      });
      return;
    }

    const supabase = createUserScopedClient(token);
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user) {
      res.status(401).json({
        success: false,
        error: "Token inválido o expirado",
      });
      return;
    }

    const authUser: User = data.user;
    const { data: profile, error: profileError } = await supabase
      .from("users")
      .select("id, email, role")
      .eq("id", authUser.id)
      .maybeSingle();

    if (profileError) {
      console.error("[smart-import.auth] Error leyendo users:", profileError.message);
    }

    const user: SmartImportUser = {
      id: (profile?.id as string | undefined) ?? authUser.id,
      email:
        (profile?.email as string | undefined) ??
        authUser.email ??
        "",
      role: resolveRole(profile?.role),
    };

    (req as AuthenticatedRequest).user = user;
    (req as AuthenticatedRequest).supabase = supabase;
    next();
  } catch (err) {
    console.error(
      "[smart-import.auth] Error inesperado:",
      err instanceof Error ? err.message : err
    );
    res.status(500).json({
      success: false,
      error: "Error de autenticación",
    });
  }
}

/**
 * Restringe el acceso a roles concretos (p. ej. solo admin).
 */
export function requireRole(allowedRoles: SmartImportRole[]) {
  return (
    req: Request,
    res: Response,
    next: NextFunction
  ): void => {
    const user = (req as AuthenticatedRequest).user;
    if (!user) {
      res.status(401).json({ success: false, error: "No autenticado" });
      return;
    }
    if (!allowedRoles.includes(user.role)) {
      res.status(403).json({
        success: false,
        error: "No tienes permiso",
      });
      return;
    }
    next();
  };
}

/**
 * Verifica que el rol del usuario pueda escribir en `targetTable`
 * (tomado de body, query o params).
 */
export function requireTablePermission(targetTableParam = "targetTable") {
  return (
    req: Request,
    res: Response,
    next: NextFunction
  ): void => {
    const user = (req as AuthenticatedRequest).user;
    if (!user) {
      res.status(401).json({ success: false, error: "No autenticado" });
      return;
    }

    const targetTable =
      (req.body?.[targetTableParam] as string | undefined) ??
      (req.query?.[targetTableParam] as string | undefined) ??
      (req.params?.[targetTableParam] as string | undefined);

    if (!targetTable || typeof targetTable !== "string") {
      res.status(400).json({
        success: false,
        error: "Indica la tabla destino (targetTable)",
      });
      return;
    }

    const allowed = TABLE_PERMISSIONS[user.role] ?? [];
    if (!allowed.includes(targetTable)) {
      res.status(403).json({
        success: false,
        error: `No tienes permiso para importar en la tabla "${targetTable}"`,
      });
      return;
    }

    next();
  };
}

export { TABLE_PERMISSIONS };
