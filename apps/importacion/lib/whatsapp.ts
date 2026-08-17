/**
 * Envío de WhatsApp.
 *
 * Proveedor actual: CallMeBot (solo pruebas — envía al número que activó la key).
 * TODO: Integrar Twilio WhatsApp Business API para producción.
 * Docs Twilio: https://www.twilio.com/docs/whatsapp
 */

function normalizeTelefono(telefono: string): string {
  const digits = telefono.replace(/\D/g, "");
  if (!digits) {
    throw new Error("Teléfono inválido");
  }
  return digits.startsWith("57") || digits.length > 10 ? digits : `57${digits}`;
}

/** Envía WhatsApp al cliente. Hoy usa CallMeBot; migrar a Twilio. */
export async function enviarWhatsApp(telefono: string, mensaje: string): Promise<{ ok: boolean; error?: string }> {
  // TODO(twilio): if (process.env.TWILIO_ACCOUNT_SID) return enviarWhatsAppTwilio(...)
  const apiKey = process.env.CALLMEBOT_API_KEY;
  if (!apiKey) {
    return { ok: false, error: "WhatsApp no configurado (Twilio pendiente, CallMeBot opcional para pruebas)" };
  }

  try {
    const phone = normalizeTelefono(telefono);
    const params = new URLSearchParams({
      phone,
      text: mensaje,
      apikey: apiKey,
    });

    const res = await fetch(`https://api.callmebot.com/whatsapp.php?${params.toString()}`);
    const body = await res.text();

    if (!res.ok) {
      return { ok: false, error: `CallMeBot ${res.status}: ${body.slice(0, 200)}` };
    }

    if (/error|invalid/i.test(body)) {
      return { ok: false, error: body.slice(0, 200) };
    }

    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error enviando WhatsApp" };
  }
}

export function buildConfirmacionWhatsApp(params: {
  nombre: string;
  placa: string;
  fechaProximoServicio: string;
  portalUrl?: string;
}): string {
  const base = `Hola ${params.nombre}, tu vehículo ${params.placa} ha sido registrado en el taller. Tu próximo servicio está programado para el ${params.fechaProximoServicio}.`;
  if (params.portalUrl) {
    return `${base}\n\nConsulta tu historial aquí: ${params.portalUrl}`;
  }
  return base;
}

export function buildRecordatorioWhatsApp(params: {
  nombre: string;
  placa: string;
  fechaProgramada: string;
  kilometrajeObjetivo?: string;
  portalUrl?: string;
}): string {
  const km =
    params.kilometrajeObjetivo != null
      ? ` o al llegar a ${params.kilometrajeObjetivo}`
      : "";
  const base = `Hola ${params.nombre}, te recordamos el mantenimiento de tu vehículo ${params.placa}. Fecha recomendada: ${params.fechaProgramada}${km}.`;
  if (params.portalUrl) {
    return `${base}\n\nConsulta tu historial: ${params.portalUrl}`;
  }
  return base;
}
