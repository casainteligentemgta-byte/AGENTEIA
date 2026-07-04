"use server";

import { buscarVehiculoCliente, clienteBusquedaSchema } from "@/lib/data/cliente";
import type { VehiculoConHistorial } from "@/lib/types";

export type ClienteBusquedaResult =
  | { success: true; data: VehiculoConHistorial }
  | { success: false; error: string };

export async function buscarHistorialCliente(
  formData: FormData
): Promise<ClienteBusquedaResult> {
  const raw = {
    placa: String(formData.get("placa") ?? ""),
    telefonoUltimos4: String(formData.get("telefonoUltimos4") ?? "").trim() || undefined,
  };

  const parsed = clienteBusquedaSchema.safeParse(raw);
  if (!parsed.success) {
    const msg = parsed.error.errors[0]?.message ?? "Datos inválidos";
    return { success: false, error: msg };
  }

  return buscarVehiculoCliente(parsed.data);
}
