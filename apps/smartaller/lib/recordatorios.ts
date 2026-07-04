import { createAdminClient } from "@/lib/supabase/admin";
import { formatDate, formatKilometraje, getClientePortalUrl } from "@/lib/format";
import { buildRecordatorioWhatsApp, enviarWhatsApp } from "@/lib/whatsapp";

type RecordatorioConVehiculo = {
  id: string;
  fecha_programada: string;
  kilometraje_objetivo: number | null;
  vehiculos: {
    placa: string;
    nombre_cliente: string | null;
    telefono_cliente: string | null;
  } | null;
};

export type ProcesarRecordatoriosResult = {
  procesados: number;
  enviados: number;
  sinTelefono: number;
  errores: number;
};

export async function procesarRecordatoriosVencidos(): Promise<ProcesarRecordatoriosResult> {
  const supabase = createAdminClient();
  const hoy = new Date().toISOString().slice(0, 10);

  const { data: rows, error } = await supabase
    .from("recordatorios")
    .select(
      "id, fecha_programada, kilometraje_objetivo, vehiculos(placa, nombre_cliente, telefono_cliente)"
    )
    .eq("estado", "pendiente")
    .lte("fecha_programada", hoy);

  if (error) {
    throw new Error(error.message);
  }

  const result: ProcesarRecordatoriosResult = {
    procesados: 0,
    enviados: 0,
    sinTelefono: 0,
    errores: 0,
  };

  for (const row of (rows ?? []) as RecordatorioConVehiculo[]) {
    result.procesados++;
    const vehiculo = Array.isArray(row.vehiculos) ? row.vehiculos[0] : row.vehiculos;

    if (!vehiculo?.telefono_cliente) {
      result.sinTelefono++;
      continue;
    }

    const nombre = vehiculo.nombre_cliente ?? "cliente";
    const mensaje = buildRecordatorioWhatsApp({
      nombre,
      placa: vehiculo.placa,
      fechaProgramada: formatDate(row.fecha_programada),
      kilometrajeObjetivo:
        row.kilometraje_objetivo != null
          ? formatKilometraje(row.kilometraje_objetivo)
          : undefined,
      portalUrl: getClientePortalUrl(vehiculo.placa),
    });

    const { ok, error: waError } = await enviarWhatsApp(vehiculo.telefono_cliente, mensaje);

    if (!ok) {
      console.error(`Recordatorio ${row.id} WhatsApp falló:`, waError);
      result.errores++;
      continue;
    }

    const { error: updateError } = await supabase
      .from("recordatorios")
      .update({ estado: "enviado" })
      .eq("id", row.id);

    if (updateError) {
      console.error(`Recordatorio ${row.id} update falló:`, updateError.message);
      result.errores++;
      continue;
    }

    result.enviados++;
  }

  return result;
}
