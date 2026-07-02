import type { SupabaseClient } from "@supabase/supabase-js";
import type { FacturaExtraida } from "@/lib/extract-invoice";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildConfirmacionWhatsApp, enviarWhatsApp } from "@/lib/whatsapp";
import { sendTelegramMessage } from "@/lib/telegram";

const MESES_PROXIMO_SERVICIO = 6;
const KM_PROXIMO_SERVICIO = 5000;

export type ProcessInvoiceInput = {
  extraido: FacturaExtraida;
  telegramChatId: number;
  telegramMessageId: number;
  telegramFileId: string;
};

export type ProcessInvoiceResult = {
  mantenimientoId: string;
  vehiculoId: string;
  recordatorioId: string;
  fechaProximoServicio: string;
  whatsappEnviado: boolean;
};

function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
}

function formatFecha(date: Date): string {
  return date.toLocaleDateString("es-CO", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function toISODate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

async function findOrCreateVehiculo(
  supabase: SupabaseClient,
  params: {
    placa: string;
    telegramChatId: number;
    nombreCliente: string | null;
    telefonoCliente: string | null;
    kilometraje: number | null;
  }
): Promise<{ id: string; nombre_cliente: string | null; telefono_cliente: string | null }> {
  const { data: existing } = await supabase
    .from("vehiculos")
    .select("id, nombre_cliente, telefono_cliente")
    .eq("placa", params.placa)
    .eq("telegram_chat_id", params.telegramChatId)
    .maybeSingle();

  if (existing) {
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (params.nombreCliente) updates.nombre_cliente = params.nombreCliente;
    if (params.telefonoCliente) updates.telefono_cliente = params.telefonoCliente;
    if (params.kilometraje != null) updates.kilometraje_ultimo = params.kilometraje;

    if (Object.keys(updates).length > 1) {
      await supabase.from("vehiculos").update(updates).eq("id", existing.id);
    }

    return {
      id: existing.id,
      nombre_cliente: params.nombreCliente ?? existing.nombre_cliente,
      telefono_cliente: params.telefonoCliente ?? existing.telefono_cliente,
    };
  }

  const { data: created, error } = await supabase
    .from("vehiculos")
    .insert({
      placa: params.placa,
      telegram_chat_id: params.telegramChatId,
      nombre_cliente: params.nombreCliente,
      telefono_cliente: params.telefonoCliente,
      kilometraje_ultimo: params.kilometraje,
    })
    .select("id, nombre_cliente, telefono_cliente")
    .single();

  if (error || !created) {
    throw new Error(error?.message ?? "No se pudo crear el vehículo");
  }

  return created;
}

export async function processInvoice(input: ProcessInvoiceInput): Promise<ProcessInvoiceResult> {
  const { extraido, telegramChatId, telegramMessageId, telegramFileId } = input;

  if (!extraido.placa) {
    throw new Error("No se pudo extraer la placa de la factura");
  }

  const supabase = createAdminClient();

  const vehiculo = await findOrCreateVehiculo(supabase, {
    placa: extraido.placa,
    telegramChatId,
    nombreCliente: extraido.nombre_cliente,
    telefonoCliente: extraido.telefono_cliente,
    kilometraje: extraido.kilometraje,
  });

  const { data: mantenimiento, error: mantError } = await supabase
    .from("mantenimientos")
    .insert({
      vehiculo_id: vehiculo.id,
      placa: extraido.placa,
      kilometraje: extraido.kilometraje,
      descripcion: extraido.descripcion,
      descripcion_servicio: extraido.descripcion,
      costo: extraido.costo,
      nombre_cliente: extraido.nombre_cliente ?? vehiculo.nombre_cliente,
      telefono_cliente: extraido.telefono_cliente ?? vehiculo.telefono_cliente,
      telegram_chat_id: telegramChatId,
      telegram_message_id: telegramMessageId,
      telegram_file_id: telegramFileId,
    })
    .select("id")
    .single();

  if (mantError || !mantenimiento) {
    throw new Error(mantError?.message ?? "No se pudo insertar el mantenimiento");
  }

  const hoy = new Date();
  const fechaProximo = addMonths(hoy, MESES_PROXIMO_SERVICIO);
  const kilometrajeObjetivo =
    extraido.kilometraje != null ? extraido.kilometraje + KM_PROXIMO_SERVICIO : null;

  const { data: recordatorio, error: recError } = await supabase
    .from("recordatorios")
    .insert({
      vehiculo_id: vehiculo.id,
      mantenimiento_id: mantenimiento.id,
      fecha_programada: toISODate(fechaProximo),
      kilometraje_objetivo: kilometrajeObjetivo,
      estado: "pendiente",
    })
    .select("id")
    .single();

  if (recError || !recordatorio) {
    throw new Error(recError?.message ?? "No se pudo crear el recordatorio");
  }

  const fechaFormateada = formatFecha(fechaProximo);
  const telefono = extraido.telefono_cliente ?? vehiculo.telefono_cliente;
  const nombre = extraido.nombre_cliente ?? vehiculo.nombre_cliente ?? "cliente";

  let whatsappEnviado = false;
  if (telefono) {
    const mensaje = buildConfirmacionWhatsApp({
      nombre,
      placa: extraido.placa,
      fechaProximoServicio: fechaFormateada,
    });
    const { ok, error } = await enviarWhatsApp(telefono, mensaje);
    whatsappEnviado = ok;
    if (!ok) {
      console.error("WhatsApp no enviado:", error);
    } else {
      await supabase.from("recordatorios").update({ estado: "enviado" }).eq("id", recordatorio.id);
    }
  }

  const resumen = [
    "✅ Mantenimiento registrado",
    `Placa: ${extraido.placa}`,
    extraido.kilometraje != null ? `Km: ${extraido.kilometraje.toLocaleString("es-CO")}` : null,
    extraido.descripcion ? `Servicio: ${extraido.descripcion}` : null,
    extraido.costo != null ? `Costo: $${extraido.costo.toLocaleString("es-CO")}` : null,
    extraido.nombre_cliente ? `Cliente: ${extraido.nombre_cliente}` : null,
    `Próximo servicio: ${fechaFormateada}`,
    kilometrajeObjetivo != null ? `Km objetivo: ${kilometrajeObjetivo.toLocaleString("es-CO")}` : null,
    whatsappEnviado ? "📱 WhatsApp enviado al cliente" : telefono ? "⚠️ WhatsApp no enviado" : null,
    `ID: ${mantenimiento.id}`,
  ]
    .filter(Boolean)
    .join("\n");

  await sendTelegramMessage(telegramChatId, resumen);

  return {
    mantenimientoId: mantenimiento.id,
    vehiculoId: vehiculo.id,
    recordatorioId: recordatorio.id,
    fechaProximoServicio: fechaFormateada,
    whatsappEnviado,
  };
}

export async function processInvoiceSafe(input: ProcessInvoiceInput): Promise<void> {
  try {
    await processInvoice(input);
  } catch (err) {
    console.error("Error procesando factura:", err);
    const msg = err instanceof Error ? err.message : "Error interno";
    try {
      await sendTelegramMessage(
        input.telegramChatId,
        `❌ No pude procesar la factura: ${msg}`
      );
    } catch (notifyErr) {
      console.error("Error notificando a Telegram:", notifyErr);
    }
  }
}
