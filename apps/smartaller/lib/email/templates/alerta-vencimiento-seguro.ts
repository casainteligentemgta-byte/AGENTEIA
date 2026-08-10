import { getAppBaseUrl } from "@/lib/app-url";

export type AlertaSeguroParams = {
  destinatarioNombre?: string | null;
  placa: string;
  codigoExpediente?: string | null;
  vigenciaHasta: string;
  diasRestantes: number;
  vehiculoId: string;
  aseguradora?: string | null;
};

export function buildAlertaVencimientoSeguroEmail(
  params: AlertaSeguroParams
): { subject: string; html: string } {
  const label =
    params.codigoExpediente?.trim() ||
    params.placa?.trim() ||
    params.vehiculoId.slice(0, 8);
  const link = `${getAppBaseUrl()}/importacion/${params.vehiculoId}`;
  const diasTxt =
    params.diasRestantes < 0
      ? `venció hace ${Math.abs(params.diasRestantes)} día(s)`
      : params.diasRestantes === 0
        ? "vence hoy"
        : `vence en ${params.diasRestantes} día(s)`;

  const subject = `Alerta póliza — ${label} ${diasTxt}`;
  const saludo = params.destinatarioNombre?.trim()
    ? `Hola ${params.destinatarioNombre.trim()},`
    : "Hola,";

  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:520px;color:#18181b;line-height:1.5">
      <h2 style="color:#0e7490;margin:0 0 12px">Vencimiento de seguro</h2>
      <p style="margin:0 0 12px">${saludo}</p>
      <p style="margin:0 0 12px">
        La póliza del expediente <strong>${label}</strong>
        ${params.placa ? `(placa/ref. <strong>${params.placa}</strong>)` : ""}
        ${params.aseguradora ? `· ${params.aseguradora}` : ""}
        ${diasTxt} (<strong>${params.vigenciaHasta}</strong>).
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
