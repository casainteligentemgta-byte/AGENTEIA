"use server";

import { z } from "zod";
import { requireTallerAuth } from "@/lib/importacion/taller-auth";
import {
  clasificarVehiculo,
  clasificarVehiculoInputSchema,
  type ClasificarVehiculoResult,
} from "@/lib/arancel/clasificar-vehiculo";

export type SugerirPartidaResult =
  | { success: true; result: ClasificarVehiculoResult }
  | { success: false; error: string };

/**
 * Sugiere partida Cap. 87. No escribe en DB; el formulario aplica el código.
 */
export async function sugerirPartidaArancelariaAction(
  raw: unknown
): Promise<SugerirPartidaResult> {
  const auth = await requireTallerAuth();
  if (auth.error || !auth.taller) {
    return { success: false, error: auth.error ?? "No autorizado" };
  }

  const parsed = clasificarVehiculoInputSchema
    .extend({
      cilindradaCc: z.union([z.number(), z.nan(), z.null()]).optional(),
    })
    .safeParse(raw);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.errors[0]?.message ?? "Datos inválidos",
    };
  }

  const cilindradaCc =
    typeof parsed.data.cilindradaCc === "number" &&
    Number.isFinite(parsed.data.cilindradaCc)
      ? parsed.data.cilindradaCc
      : null;

  return {
    success: true,
    result: clasificarVehiculo({
      ...parsed.data,
      cilindradaCc,
    }),
  };
}
