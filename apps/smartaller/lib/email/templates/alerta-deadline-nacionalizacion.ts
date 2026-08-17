import { getAppBaseUrl } from "@/lib/app-url";

export type AlertaDeadlineParams = {
  destinatarioNombre?: string | null;
  placa: string;
  codigoExpediente?: string | null;
  serialCarroceria?: string | null;
  fechaLimite: string;
  diasRestantes: number;
  vehiculoId: string;
};

export function buildAlertaDeadlineNacionalizacionEmail(
  params: AlertaDeadlineParams
): { subject: string; html: string } {
  const label =
    params.codigoExpediente?.trim() ||
    params.placa?.trim() ||
    params.vehiculoId.slice(0, 8);
  const link = `${getAppBaseUrl()}/smartimport/${params.vehiculoId}`;
  const diasTxt =
    params.diasRestantes < 0
      ? `venció hace ${Math.abs(params.diasRestantes)} día(s)`
      : params.diasRestantes === 0
        ? "vence hoy"
        : `vence en ${params.diasRestantes} día(s)`;

  const subject = `Alerta nacionalización — ${label} ${diasTxt}`;
  const saludo = params.destinatarioNombre?.trim()
    ? `Hola ${params.destinatarioNombre.trim()},`
    : "Hola,";

  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:520px;color:#18181b;line-height:1.5">
      <h2 style="color:#0e7490;margin:0 0 12px">Plazo de nacionalización</h2>
      <p style="margin:0 0 12px">${saludo}</p>
      <p style="margin:0 0 12px">
        El expediente <strong>${label}</strong>
        ${params.placa ? `(placa/ref. <strong>${params.placa}</strong>)` : ""}
        ${params.serialCarroceria ? `· serial <strong>${params.serialCarroceria}</strong>` : ""}
        tiene fecha límite de nacionalización el
        <strong>${params.fechaLimite}</strong> (${diasTxt}).
      </p>
      <p style="margin:0 0 16px">
        <a href="${link}" style="display:inline-block;background:#0891b2;color:#fff;text-decoration:none;padding:10px 16px;border-radius:10px;font-weight:600">
          Abrir expediente
        </a>
      </p>
      <p style="font-size:12px;color:#71717a;margin:0">SmartTaller · Puerto Libre</p>
    </div>
  `.trim();

  return { subject, html };
}
