"use server";

import { cookies } from "next/headers";
import { z } from "zod";

const PIN_COOKIE = "presidencia_auth";
const PIN_MAX_AGE = 60 * 60 * 24 * 7;

const pinSchema = z.object({
  pin: z.string().min(4).max(32),
});

export async function verificarPinPresidencia(pin: string): Promise<{ ok: boolean; error?: string }> {
  const expected = process.env.PRESIDENCIA_PIN;
  if (!expected) {
    return { ok: true };
  }

  const parsed = pinSchema.safeParse({ pin });
  if (!parsed.success) {
    return { ok: false, error: "PIN inválido" };
  }

  if (parsed.data.pin !== expected) {
    return { ok: false, error: "PIN incorrecto" };
  }

  cookies().set(PIN_COOKIE, "1", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: PIN_MAX_AGE,
    path: "/presidencia",
  });

  return { ok: true };
}

export async function presidenciaAutorizada(): Promise<boolean> {
  const expected = process.env.PRESIDENCIA_PIN;
  if (!expected) return true;
  return cookies().get(PIN_COOKIE)?.value === "1";
}

export async function cerrarSesionPresidencia(): Promise<void> {
  cookies().delete(PIN_COOKIE);
}
