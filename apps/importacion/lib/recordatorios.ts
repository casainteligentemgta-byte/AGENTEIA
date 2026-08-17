import { createAdminClient } from "@/lib/supabase/admin";
import { formatDate, formatKilometraje, getClientePortalUrl } from "@/lib/format";
import { enviarEmailRecordatorio } from "@/lib/notifications";
import { buildRecordatorioWhatsApp, enviarWhatsApp } from "@/lib/whatsapp";

type RecordatorioConVehiculo = {
  id: string;
  fecha_programada: string;
  kilometraje_objetivo: number | null;
  vehiculos: {
    placa: string;
    nombre_cliente: string | null;
    telefono_cliente: string | null;
    user_id: string | null;
  } | null;
};

export type ProcesarRecordatoriosResult = {
  procesados: number;
  enviados: number;
  emailsEnviados: number;
  sinContacto: number;
  errores: number;
};

async function obtenerEmailUsuario(userId: string): Promise<string | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.auth.admin.getUserById(userId);
  if (error || !data.user?.email) return null;
  return data.user.email;
}

export async function procesarRecordatoriosVencidos(): Promise<ProcesarRecordatoriosResult> {
  const supabase = createAdminClient();
  const hoy = new Date().toISOString().slice(0, 10);

  const { data: rows, error } = await supabase
    .from("recordatorios")
    .select(
      "id, fecha_programada, kilometraje_objetivo, vehiculos(placa, nombre_cliente, telefono_cliente, user_id)"
    )
    .eq("estado", "pendiente")
    .lte("fecha_programada", hoy);

  if (error) {
    throw new Error(error.message);
  }

  const result: ProcesarRecordatoriosResult = {
    procesados: 0,
    enviados: 0,
    emailsEnviados: 0,
    sinContacto: 0,
    errores: 0,
  };

  for (const row of (rows ?? []) as unknown as RecordatorioConVehiculo[]) {
    result.procesados++;
    const vehiculo = Array.isArray(row.vehiculos) ? row.vehiculos[0] : row.vehiculos;

    if (!vehiculo) {
      result.sinContacto++;
      continue;
    }

    const nombre = vehiculo.nombre_cliente ?? "cliente";
    const kmFormatted =
      row.kilometraje_objetivo != null ? formatKilometraje(row.kilometraje_objetivo) : undefined;

    let enviado = false;

    if (vehiculo.telefono_cliente) {
      const mensaje = buildRecordatorioWhatsApp({
        nombre,
        placa: vehiculo.placa,
        fechaProgramada: formatDate(row.fecha_programada),
        kilometrajeObjetivo: kmFormatted,
        portalUrl: getClientePortalUrl(vehiculo.placa),
      });

      const { ok, error: waError } = await enviarWhatsApp(vehiculo.telefono_cliente, mensaje);

      if (!ok) {
        console.error(`Recordatorio ${row.id} WhatsApp falló:`, waError);
        result.errores++;
        continue;
      }

      enviado = true;
      result.enviados++;
    } else if (vehiculo.user_id) {
      const email = await obtenerEmailUsuario(vehiculo.user_id);
      if (!email) {
        result.sinContacto++;
        continue;
      }

      const { ok, skipped, error: emailError } = await enviarEmailRecordatorio({
        to: email,
        nombre,
        placa: vehiculo.placa,
        fechaProgramada: formatDate(row.fecha_programada),
        kilometrajeObjetivo: kmFormatted,
      });

      if (skipped) {
        result.sinContacto++;
        continue;
      }

      if (!ok) {
        console.error(`Recordatorio ${row.id} email falló:`, emailError);
        result.errores++;
        continue;
      }

      enviado = true;
      result.emailsEnviados++;
    } else {
      result.sinContacto++;
      continue;
    }

    if (!enviado) continue;

    const { error: updateError } = await supabase
      .from("recordatorios")
      .update({ estado: "enviado" })
      .eq("id", row.id);

    if (updateError) {
      console.error(`Recordatorio ${row.id} update falló:`, updateError.message);
      result.errores++;
    }
  }

  return result;
}
