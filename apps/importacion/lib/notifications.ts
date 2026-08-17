import { getAppBaseUrl, getClientePortalUrl, normalizePlaca } from "@/lib/format";

export type RecordatorioEmailParams = {
  to: string;
  nombre: string;
  placa: string;
  fechaProgramada: string;
  kilometrajeObjetivo?: string;
};

function buildRecordatorioEmailHtml(params: RecordatorioEmailParams): string {
  const portalUrl = getClientePortalUrl(normalizePlaca(params.placa));
  const kmLine = params.kilometrajeObjetivo
    ? `<p>Kilometraje objetivo: <strong>${params.kilometrajeObjetivo}</strong></p>`
    : "";

  return `
    <div style="font-family:sans-serif;max-width:480px;color:#18181b">
      <h2 style="color:#2563eb">Recordatorio de mantenimiento</h2>
      <p>Hola ${params.nombre},</p>
      <p>Tu vehículo <strong>${params.placa}</strong> tiene un servicio programado para el <strong>${params.fechaProgramada}</strong>.</p>
      ${kmLine}
      <p><a href="${portalUrl}" style="color:#2563eb">Ver historial en SmartTaller</a></p>
      <p style="font-size:12px;color:#71717a">SmartTaller — ${getAppBaseUrl()}</p>
    </div>
  `.trim();
}

/** Envía email de recordatorio vía Resend si RESEND_API_KEY está configurada. */
export async function enviarEmailRecordatorio(
  params: RecordatorioEmailParams
): Promise<{ ok: boolean; skipped?: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM ?? "SmartTaller <onboarding@resend.dev>";

  if (!apiKey) {
    return { ok: false, skipped: true };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [params.to],
        subject: `Recordatorio de mantenimiento — ${params.placa}`,
        html: buildRecordatorioEmailHtml(params),
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      return { ok: false, error: body || res.statusText };
    }

    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Error enviando email",
    };
  }
}
