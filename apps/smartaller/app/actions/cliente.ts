"use server";

import {
  buscarVehiculoCliente,
  CLIENTE_ERROR_GENERICO,
  clienteBusquedaSchema,
  type ClienteHistorialPublico,
} from "@/lib/data/cliente";

export type ClienteBusquedaResult =
  | { success: true; data: ClienteHistorialPublico }
  | { success: false; error: string };

export async function buscarHistorialCliente(
  formData: FormData
): Promise<ClienteBusquedaResult> {
  const raw = {
    placa: String(formData.get("placa") ?? ""),
    telefonoUltimos4: String(formData.get("telefonoUltimos4") ?? ""),
  };

  const parsed = clienteBusquedaSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, error: CLIENTE_ERROR_GENERICO };
  }

  return buscarVehiculoCliente(parsed.data);
}
