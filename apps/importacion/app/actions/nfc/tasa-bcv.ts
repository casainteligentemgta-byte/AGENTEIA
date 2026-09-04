"use server";

import { getUser } from "@/lib/supabase/server";
import {
  formatTasaBcvInput,
  hintTasaBcv,
  lookupTasaBcv,
  todayYmdCaracas,
} from "@/lib/importacion/tasa-bcv";

export type TasaBcvActionResult =
  | { success: true; tasa: string; hint: string; fechaVigente: string }
  | { success: false; error: string };

export async function getTasaBcvAction(
  fecha: string
): Promise<TasaBcvActionResult> {
  const user = await getUser();
  if (!user) return { success: false, error: "No autorizado" };

  const lookup = await lookupTasaBcv(fecha);
  if (!lookup) {
    return {
      success: false,
      error: "No se pudo leer la tasa BCV de esa fecha",
    };
  }

  return {
    success: true,
    tasa: formatTasaBcvInput(lookup.tasa),
    hint: hintTasaBcv(lookup),
    fechaVigente: lookup.fechaVigente,
  };
}

/** Tasa oficial SENIAT/BCV del día civil en Venezuela. */
export async function getTasaOficialHoyAction(): Promise<TasaBcvActionResult> {
  return getTasaBcvAction(todayYmdCaracas());
}
