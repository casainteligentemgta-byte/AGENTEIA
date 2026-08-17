import { z } from "zod";

export const updateTallerNombreSchema = z
  .string()
  .trim()
  .min(2, "El nombre debe tener al menos 2 caracteres")
  .max(80, "Máximo 80 caracteres");

export function parseTallerNombre(raw: string): { ok: true; nombre: string } | { ok: false; error: string } {
  const parsed = updateTallerNombreSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0]?.message ?? "Nombre inválido" };
  }
  return { ok: true, nombre: parsed.data };
}
