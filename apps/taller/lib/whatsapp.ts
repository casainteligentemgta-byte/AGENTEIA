/**
 * Envío de WhatsApp vía CallMeBot API.
 * Docs: https://www.callmebot.com/blog/free-api-whatsapp-messages/
 */

function normalizeTelefono(telefono: string): string {
  const digits = telefono.replace(/\D/g, "");
  if (!digits) {
    throw new Error("Teléfono inválido");
  }
  return digits.startsWith("57") || digits.length > 10 ? digits : `57${digits}`;
}

export async function enviarWhatsApp(telefono: string, mensaje: string): Promise<{ ok: boolean; error?: string }> {
  const apiKey = process.env.CALLMEBOT_API_KEY;
  if (!apiKey) {
    return { ok: false, error: "Falta CALLMEBOT_API_KEY en las variables de entorno" };
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
}): string {
  return `Hola ${params.nombre}, tu vehículo ${params.placa} ha sido registrado en el taller. Tu próximo servicio está programado para el ${params.fechaProximoServicio}.`;
}
