import { Resend } from "resend";

let client: Resend | null = null;

export function getResendClient(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) return null;
  if (!client) client = new Resend(apiKey);
  return client;
}

/** Remitente verificado en Resend (ej. alertas@notificaciones.smarttaller.xyz). */
export function getResendFrom(): string {
  return (
    process.env.RESEND_FROM?.trim() ||
    "SmartTaller Alertas <alertas@notificaciones.smarttaller.xyz>"
  );
}

export async function sendResendEmail(params: {
  to: string | string[];
  subject: string;
  html: string;
}): Promise<{ ok: true; id?: string } | { ok: false; skipped?: boolean; error: string }> {
  const resend = getResendClient();
  if (!resend) {
    return { ok: false, skipped: true, error: "RESEND_API_KEY no configurada" };
  }

  const to = Array.isArray(params.to) ? params.to : [params.to];
  const filtered = to.map((e) => e.trim()).filter(Boolean);
  if (filtered.length === 0) {
    return { ok: false, error: "Sin destinatarios" };
  }

  try {
    const { data, error } = await resend.emails.send({
      from: getResendFrom(),
      to: filtered,
      subject: params.subject,
      html: params.html,
    });
    if (error) {
      return { ok: false, error: error.message };
    }
    return { ok: true, id: data?.id };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Error enviando email",
    };
  }
}
