import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit, clientIpFromHeaders } from "@/lib/security/rate-limit";
import {
  CLIENTE_ERROR_GENERICO,
  CLIENTE_ERROR_RATE_LIMIT,
  CLIENTE_RATE_MAX,
  CLIENTE_RATE_WINDOW_MS,
  type ClienteBusquedaInput,
  type ClienteHistorialPublico,
  type VehiculoLookupRow,
  proyectarHistorialCliente,
  telefonoUltimos4Igual,
} from "@/lib/data/cliente-lookup";

export {
  CLIENTE_ERROR_GENERICO,
  CLIENTE_ERROR_RATE_LIMIT,
  clienteBusquedaSchema,
  proyectarHistorialCliente,
  telefonoUltimos4Igual,
  type ClienteBusquedaInput,
  type ClienteHistorialPublico,
} from "@/lib/data/cliente-lookup";

export function checkClienteLookupRateLimit(ip: string, placa: string) {
  return checkRateLimit(`cliente:${ip}:${placa}`, {
    windowMs: CLIENTE_RATE_WINDOW_MS,
    max: CLIENTE_RATE_MAX,
  });
}

export async function buscarVehiculoCliente(
  input: ClienteBusquedaInput
): Promise<{ success: true; data: ClienteHistorialPublico } | { success: false; error: string }> {
  const ip = clientIpFromHeaders(headers());
  const limited = checkClienteLookupRateLimit(ip, input.placa);
  if (!limited.ok) {
    return { success: false, error: CLIENTE_ERROR_RATE_LIMIT };
  }

  const supabase = createAdminClient();
  const { placa, telefonoUltimos4 } = input;

  const { data: vehiculos, error: vehError } = await supabase
    .from("vehiculos")
    .select(
      "id, placa, nombre_cliente, telefono_cliente, kilometraje_ultimo, marca, modelo, color"
    )
    .eq("placa", placa);

  if (vehError) {
    return { success: false, error: CLIENTE_ERROR_GENERICO };
  }

  const candidatos = (vehiculos ?? []) as VehiculoLookupRow[];

  // Trabajo constante aunque no haya filas (no enumerar existencia).
  const dummy = telefonoUltimos4Igual("0000000000", telefonoUltimos4);
  void dummy;

  const coincidencias = candidatos.filter((v) =>
    telefonoUltimos4Igual(v.telefono_cliente, telefonoUltimos4)
  );

  if (coincidencias.length !== 1) {
    return { success: false, error: CLIENTE_ERROR_GENERICO };
  }

  const vehiculo = coincidencias[0];

  const [mantRes, recRes] = await Promise.all([
    supabase
      .from("mantenimientos")
      .select("id, created_at, descripcion, costo, kilometraje")
      .eq("vehiculo_id", vehiculo.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("recordatorios")
      .select("id, fecha_programada, kilometraje_objetivo")
      .eq("vehiculo_id", vehiculo.id)
      .in("estado", ["pendiente", "enviado"])
      .order("fecha_programada", { ascending: true }),
  ]);

  if (mantRes.error || recRes.error) {
    return { success: false, error: CLIENTE_ERROR_GENERICO };
  }

  return {
    success: true,
    data: proyectarHistorialCliente(
      vehiculo,
      (mantRes.data ?? []) as Array<{
        id: string;
        created_at: string;
        descripcion?: string | null;
        descripcion_servicio?: string | null;
        costo: number | null;
        kilometraje: number | null;
      }>,
      (recRes.data ?? []) as Array<{
        id: string;
        fecha_programada: string;
        kilometraje_objetivo: number | null;
      }>
    ),
  };
}
