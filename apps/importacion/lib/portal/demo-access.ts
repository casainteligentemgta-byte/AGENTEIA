import { randomBytes } from "crypto";
import { sanitizeEnvValue } from "@/lib/supabase/env";

/** Duraciones permitidas (horas) para una cuenta demo. */
export const DEMO_DURACION_HORAS = [1, 4, 24, 72, 168] as const;

export type DemoDuracionHoras = (typeof DEMO_DURACION_HORAS)[number];

export const DEMO_DURACION_LABELS: Record<DemoDuracionHoras, string> = {
  1: "1 hora",
  4: "4 horas",
  24: "1 día",
  72: "3 días",
  168: "7 días",
};

/** Roles por defecto de la cuenta demo genérica. */
export const DEMO_ROLES_DEFAULT = ["concesionario", "usuario"] as const;

/** Roles permitidos al crear una demo (sin máster ni admin global). */
export const DEMO_ROLES_PERMITIDOS = [
  "concesionario",
  "taller",
  "usuario",
  "aduanera",
] as const;

export type DemoRolePermitido = (typeof DEMO_ROLES_PERMITIDOS)[number];

const PASSWORD_ALPHABET =
  "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@$%";

/** Genera una clave legible para copiar/pegar (sin caracteres ambiguos). */
export function generateDemoPassword(length = 12): string {
  const size = Math.max(8, Math.min(64, length));
  const bytes = randomBytes(size);
  let out = "";
  for (let i = 0; i < size; i += 1) {
    out += PASSWORD_ALPHABET[bytes[i]! % PASSWORD_ALPHABET.length];
  }
  return out;
}

export function demoExpiresAtFromNow(
  horas: DemoDuracionHoras,
  now = new Date()
): Date {
  return new Date(now.getTime() + horas * 60 * 60 * 1000);
}

export function isDemoExpired(
  expiresAt: string | Date | null | undefined,
  now = new Date()
): boolean {
  if (!expiresAt) return false;
  const ms =
    typeof expiresAt === "string"
      ? Date.parse(expiresAt)
      : expiresAt.getTime();
  if (Number.isNaN(ms)) return false;
  return ms <= now.getTime();
}

type DemoMeta = {
  es_demo?: unknown;
  demo_expires_at?: unknown;
  demo_closed?: unknown;
};

/** Lee metadatos de demo desde JWT (app_metadata o user_metadata). */
export function readDemoMetaFromAuthUser(user: {
  app_metadata?: Record<string, unknown> | null;
  user_metadata?: Record<string, unknown> | null;
}): { esDemo: boolean; expiresAt: string | null; closed: boolean } {
  const app = (user.app_metadata ?? {}) as DemoMeta;
  const meta = (user.user_metadata ?? {}) as DemoMeta;
  const esDemo = Boolean(app.es_demo ?? meta.es_demo);
  const raw = app.demo_expires_at ?? meta.demo_expires_at;
  const expiresAt = typeof raw === "string" && raw.trim() ? raw.trim() : null;
  const closed = Boolean(app.demo_closed ?? meta.demo_closed);
  return { esDemo, expiresAt, closed };
}

export function formatDemoExpiry(iso: string | null): string {
  if (!iso) return "Sin caducidad";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("es-VE", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export type DemoCredentials = {
  email: string;
  password: string;
};

/**
 * Credenciales fijas de la cuenta demo (siempre las mismas).
 * Configurar DEMO_EMAIL y DEMO_PASSWORD en el entorno.
 */
export function getDemoCredentialsFromEnv(): DemoCredentials | null {
  const email = sanitizeEnvValue(process.env.DEMO_EMAIL)?.toLowerCase();
  const password = sanitizeEnvValue(process.env.DEMO_PASSWORD);
  if (!email || !password) return null;
  if (password.length < 8) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return { email, password };
}

/** Si true, el login de SmartImport muestra usuario/clave cuando la demo está abierta. */
export function shouldShowDemoCredentialsOnLogin(): boolean {
  const raw = sanitizeEnvValue(process.env.NEXT_PUBLIC_DEMO_SHOW_ON_LOGIN);
  if (!raw) return false;
  return ["1", "true", "yes", "on"].includes(raw.toLowerCase());
}
