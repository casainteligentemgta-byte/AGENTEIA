"use server";

import { cookies } from "next/headers";
import { z } from "zod";
import {
  getPresidenciaPin,
  PRESIDENCIA_PIN_MISSING_MSG,
  presidenciaAllowsOpenAccess,
  presidenciaPinConfigured,
} from "@/lib/presidencia/pin";

const PIN_MAX_AGE = 60 * 60 * 24 * 7;

const pinSchema = z.object({
  pin: z.string().min(4).max(32),
  tallerId: z.string().uuid(),
});

function pinCookieName(tallerId: string): string {
  return `presidencia_auth_${tallerId}`;
}

export async function verificarPinPresidencia(
  pin: string,
  tallerId: string
): Promise<{ ok: boolean; error?: string }> {
  if (!presidenciaPinConfigured()) {
    if (presidenciaAllowsOpenAccess()) {
      return { ok: true };
    }
    return { ok: false, error: PRESIDENCIA_PIN_MISSING_MSG };
  }

  const parsed = pinSchema.safeParse({ pin, tallerId });
  if (!parsed.success) {
    return { ok: false, error: "PIN inválido" };
  }

  if (parsed.data.pin !== getPresidenciaPin()) {
    return { ok: false, error: "PIN incorrecto" };
  }

  cookies().set(pinCookieName(tallerId), "1", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: PIN_MAX_AGE,
    path: `/presidencia/${tallerId}`,
  });

  return { ok: true };
}

export async function presidenciaAutorizada(tallerId: string): Promise<boolean> {
  if (presidenciaAllowsOpenAccess()) return true;
  if (!presidenciaPinConfigured()) return false;
  return cookies().get(pinCookieName(tallerId))?.value === "1";
}

export async function presidenciaPinMissingInProduction(): Promise<boolean> {
  return !presidenciaPinConfigured() && !presidenciaAllowsOpenAccess();
}
