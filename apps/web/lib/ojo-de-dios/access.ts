import { isAuthRequired, isOjoDeDiosEnabled } from "@/lib/auth/flags";
import type { OjoDeDiosAccess } from "./types";

export type SessionUser = {
  id: string;
  email?: string | null;
};

export function configuredSecret(value: string | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed === "..." || trimmed.endsWith("...")) return null;
  return trimmed;
}

/**
 * Gmail/Garmin solo se leen si la sesión coincide con el dueño personal.
 * Sin owner configurado, nunca se usan tokens de entorno (evita filtrar a otros usuarios).
 */
export function isPersonalOwner(user: SessionUser | null): boolean {
  if (!user) return false;
  const ownerId = configuredSecret(process.env.OJO_DE_DIOS_OWNER_USER_ID);
  const ownerEmail = configuredSecret(process.env.OJO_DE_DIOS_OWNER_EMAIL)?.toLowerCase();
  if (ownerId && user.id === ownerId) return true;
  if (ownerEmail && user.email?.trim().toLowerCase() === ownerEmail) return true;
  return false;
}

export function resolveOjoDeDiosAccess(input: {
  enabled: boolean;
  authRequired: boolean;
  user: SessionUser | null;
}): OjoDeDiosAccess {
  if (!input.enabled) return { ok: false, status: 404 };
  if (input.authRequired && !input.user) return { ok: false, status: 401 };
  return {
    ok: true,
    userId: input.user?.id ?? null,
    email: input.user?.email ?? null,
  };
}

export function resolveOjoDeDiosAccessFromEnv(user: SessionUser | null): OjoDeDiosAccess {
  return resolveOjoDeDiosAccess({
    enabled: isOjoDeDiosEnabled(),
    authRequired: isAuthRequired(),
    user,
  });
}

export function collectConfiguredSecrets(): string[] {
  return [
    configuredSecret(process.env.GMAIL_CLIENT_SECRET),
    configuredSecret(process.env.GMAIL_REFRESH_TOKEN),
    configuredSecret(process.env.GARMIN_ACCESS_TOKEN),
    configuredSecret(process.env.X_BEARER_TOKEN),
    configuredSecret(process.env.GMAIL_CLIENT_ID),
  ].filter((value): value is string => Boolean(value));
}
