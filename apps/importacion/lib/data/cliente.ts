import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizePlaca } from "@/lib/format";
import type { Mantenimiento, Recordatorio, Vehiculo, VehiculoConHistorial } from "@/lib/types";

export const clienteBusquedaSchema = z.object({
  placa: z
    .string()
    .min(4, "Ingresa la placa del vehículo")
    .max(10)
    .transform(normalizePlaca),
  telefonoUltimos4: z
    .string()
    .optional()
    .transform((v) => {
      const trimmed = v?.trim() ?? "";
      return trimmed.length ? trimmed : undefined;
    })
    .pipe(
      z
        .string()
        .regex(/^\d{4}$/, "Ingresa los últimos 4 dígitos del teléfono")
        .optional()
    ),
});

export type ClienteBusquedaInput = z.infer<typeof clienteBusquedaSchema>;

function telefonoCoincide(telefono: string | null, ultimos4: string): boolean {
  if (!telefono) return false;
  const digits = telefono.replace(/\D/g, "");
  return digits.endsWith(ultimos4);
}

export async function buscarVehiculoCliente(
  input: ClienteBusquedaInput
): Promise<{ success: true; data: VehiculoConHistorial } | { success: false; error: string }> {
  const supabase = createAdminClient();
  const { placa, telefonoUltimos4 } = input;

  const { data: vehiculos, error: vehError } = await supabase
    .from("vehiculos")
    .select("*")
    .ilike("placa", placa);

  if (vehError) {
    return { success: false, error: "Error al buscar el vehículo. Intenta de nuevo." };
  }

  if (!vehiculos?.length) {
    return {
      success: false,
      error: "No encontramos un vehículo con esa placa. Verifica e intenta de nuevo.",
    };
  }

  let candidatos = vehiculos as Vehiculo[];

  if (telefonoUltimos4) {
    const filtrados = candidatos.filter((v) =>
      telefonoCoincide(v.telefono_cliente, telefonoUltimos4)
    );
    if (!filtrados.length) {
      return {
        success: false,
        error: "La placa no coincide con el teléfono ingresado.",
      };
    }
    candidatos = filtrados;
  } else if (candidatos.length > 1) {
    return {
      success: false,
      error:
        "Hay varios registros con esa placa. Ingresa los últimos 4 dígitos de tu teléfono para verificar.",
    };
  }

  const vehiculo = candidatos[0];

  const [mantRes, recRes] = await Promise.all([
    supabase
      .from("mantenimientos")
      .select("*")
      .eq("vehiculo_id", vehiculo.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("recordatorios")
      .select("*")
      .eq("vehiculo_id", vehiculo.id)
      .in("estado", ["pendiente", "enviado"])
      .order("fecha_programada", { ascending: true }),
  ]);

  if (mantRes.error || recRes.error) {
    return { success: false, error: "Error al cargar el historial." };
  }

  return {
    success: true,
    data: {
      ...vehiculo,
      mantenimientos: (mantRes.data ?? []) as Mantenimiento[],
      recordatorios: (recRes.data ?? []) as Recordatorio[],
    },
  };
}
