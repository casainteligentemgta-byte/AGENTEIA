"use server";

import { cookies } from "next/headers";
import { z } from "zod";

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
  const expected = process.env.PRESIDENCIA_PIN;
  if (!expected) {
    return { ok: true };
  }

  const parsed = pinSchema.safeParse({ pin, tallerId });
  if (!parsed.success) {
    return { ok: false, error: "PIN inválido" };
  }

  if (parsed.data.pin !== expected) {
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
  const expected = process.env.PRESIDENCIA_PIN;
  if (!expected) return true;
  return cookies().get(pinCookieName(tallerId))?.value === "1";
}
