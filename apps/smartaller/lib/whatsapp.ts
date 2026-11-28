import { getBrand } from "@/lib/brand";

/**
 * Envío de WhatsApp vía Twilio (REST).
 *
 * Dormant por defecto: no envía nada a menos que WHATSAPP_ENABLED=true
 * y existan TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN y TWILIO_WHATSAPP_FROM.
 * Guía: docs/WHATSAPP-TWILIO.md
 */

export const DEFAULT_COUNTRY_CODE = "58";

export const WHATSAPP_DISABLED_LOG = "whatsapp disabled";

export type WhatsAppMessageType = "recordatorio" | "confirmacion" | "pago";

export type EnviarWhatsAppResult = {
  ok: boolean;
  skipped?: boolean;
  error?: string;
};

export type EnviarWhatsAppOptions = {
  type?: WhatsAppMessageType;
  /** Placeholders del template Meta/Twilio. Array → {{1}}, {{2}}, … */
  variables?: Record<string, string> | string[];
};

type TwilioConfig = {
  accountSid: string;
  authToken: string;
  from: string;
};

const CONTENT_SID_ENV: Record<WhatsAppMessageType, string> = {
  recordatorio: "TWILIO_CONTENT_SID_RECORDATORIO",
  confirmacion: "TWILIO_CONTENT_SID_CONFIRMACION",
  pago: "TWILIO_CONTENT_SID_PAGO",
};

function trimEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

function getTwilioConfig(): TwilioConfig | null {
  const accountSid = trimEnv("TWILIO_ACCOUNT_SID");
  const authToken = trimEnv("TWILIO_AUTH_TOKEN");
  const from = trimEnv("TWILIO_WHATSAPP_FROM");
  if (!accountSid || !authToken || !from) return null;
  return { accountSid, authToken, from };
}

/** Kill switch: exige el literal 'true' y credenciales Twilio completas. */
export function isWhatsAppEnabled(): boolean {
  return process.env.WHATSAPP_ENABLED === "true" && getTwilioConfig() !== null;
}

export function whatsappHealthStatus(): "ok" | "skipped" {
  return isWhatsAppEnabled() ? "ok" : "skipped";
}

/**
 * Normaliza a dígitos E.164 sin '+'. Prefijo por defecto: 58 (Venezuela).
 * Acepta 0414xxxxxxx, 414xxxxxxx, +58…, 58… y el 0 de tronco tras +58.
 */
export function normalizeTelefono(telefono: string): string {
  let digits = telefono.replace(/\D/g, "");
  if (!digits) {
    throw new Error("Teléfono inválido");
  }

  if (digits.startsWith("00")) {
    digits = digits.slice(2);
  }
  if (!digits) {
    throw new Error("Teléfono inválido");
  }

  if (digits.startsWith(DEFAULT_COUNTRY_CODE)) {
    let rest = digits.slice(DEFAULT_COUNTRY_CODE.length);
    if (rest.startsWith("0")) {
      rest = rest.slice(1);
    }
    if (rest.length < 7) {
      throw new Error("Teléfono inválido");
    }
    return `${DEFAULT_COUNTRY_CODE}${rest}`;
  }

  if (digits.startsWith("0")) {
    digits = digits.slice(1);
  }
  if (digits.length < 7) {
    throw new Error("Teléfono inválido");
  }

  // Ya viene con otro código de país (p. ej. 57 Colombia).
  if (digits.length >= 11) {
    return digits;
  }

  return `${DEFAULT_COUNTRY_CODE}${digits}`;
}

function toWhatsAppAddress(value: string): string {
  const trimmed = value.trim();
  if (trimmed.toLowerCase().startsWith("whatsapp:")) {
    return trimmed;
  }
  return `whatsapp:+${normalizeTelefono(trimmed)}`;
}

function toContentVariables(
  variables?: Record<string, string> | string[]
): string | undefined {
  if (!variables) return undefined;
  if (Array.isArray(variables)) {
    if (variables.length === 0) return undefined;
    const obj: Record<string, string> = {};
    variables.forEach((value, index) => {
      obj[String(index + 1)] = value;
    });
    return JSON.stringify(obj);
  }
  if (Object.keys(variables).length === 0) return undefined;
  return JSON.stringify(variables);
}

function contentSidFor(type: WhatsAppMessageType | undefined): string | undefined {
  if (!type) return undefined;
  return trimEnv(CONTENT_SID_ENV[type]);
}

export function waMeHref(telefono: string, text: string): string | null {
  try {
    const phone = normalizeTelefono(telefono);
    return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
  } catch {
    return null;
  }
}

export function buildReclamoWhatsApp(params: {
  nombre: string;
  placa: string;
  tallerNombre: string;
  codigo: string;
  appUrl: string;
}): string {
  const loginUrl = `${params.appUrl.replace(/\/$/, "")}/login?redirectTo=/app`;
  return [
    `Hola ${params.nombre},`,
    `Tu vehículo ${params.placa} ya tiene inspección en ${params.tallerNombre}.`,
    "",
    getBrand().copy.whatsappReclamoLine,
    loginUrl,
    "",
    `Código de este vehículo: ${params.codigo}`,
    "(Es solo para este auto; no lo compartas.)",
  ].join("\n");
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

export function buildAvisoPagoWhatsApp(params: {
  nombre: string;
  dias: number;
  fechaVencimiento: string;
  portalUrl?: string;
}): string {
  const diaLabel = params.dias === 1 ? "1 día" : `${params.dias} días`;
  const base = `Hola ${params.nombre}, tu suscripción SmartTaller vence en ${diaLabel} (${params.fechaVencimiento}). Renueva con Pago Móvil para no perder el acceso.`;
  if (params.portalUrl) {
    return `${base}\n\nRenueva aquí: ${params.portalUrl}`;
  }
  return base;
}

function skippedDisabled(): EnviarWhatsAppResult {
  console.log(WHATSAPP_DISABLED_LOG);
  return { ok: false, skipped: true };
}

async function enviarWhatsAppTwilio(
  config: TwilioConfig,
  telefono: string,
  mensaje: string,
  options?: EnviarWhatsAppOptions
): Promise<EnviarWhatsAppResult> {
  const to = toWhatsAppAddress(telefono);
  const from = toWhatsAppAddress(config.from);
  const contentSid = contentSidFor(options?.type);
  const body = new URLSearchParams();
  body.set("To", to);
  body.set("From", from);

  if (contentSid) {
    body.set("ContentSid", contentSid);
    const variables = toContentVariables(options?.variables);
    if (variables) {
      body.set("ContentVariables", variables);
    }
  } else {
    body.set("Body", mensaje);
  }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(config.accountSid)}/Messages.json`;
  const auth = Buffer.from(`${config.accountSid}:${config.authToken}`).toString("base64");

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
    signal: AbortSignal.timeout(15_000),
  });

  const raw = await res.text();
  if (!res.ok) {
    let detail = raw.slice(0, 300);
    try {
      const parsed = JSON.parse(raw) as { message?: string; code?: number };
      if (parsed.message) {
        detail = parsed.code ? `${parsed.code}: ${parsed.message}` : parsed.message;
      }
    } catch {
      // cuerpo no JSON
    }
    return { ok: false, error: `Twilio ${res.status}: ${detail}` };
  }

  return { ok: true };
}

/** Envía WhatsApp al cliente. No lanza: callers y crons siguen aunque esté apagado. */
export async function enviarWhatsApp(
  telefono: string,
  mensaje: string,
  options?: EnviarWhatsAppOptions
): Promise<EnviarWhatsAppResult> {
  try {
    if (!isWhatsAppEnabled()) {
      return skippedDisabled();
    }

    const config = getTwilioConfig();
    if (!config) {
      return skippedDisabled();
    }

    return await enviarWhatsAppTwilio(config, telefono, mensaje, options);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error enviando WhatsApp" };
  }
}
