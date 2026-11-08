/** Auth y límites del chat. Flags leídos en servidor (y NEXT_PUBLIC_* también en cliente). */

function parseFlag(value: string | undefined): boolean | undefined {
  if (value == null) return undefined;
  const normalized = value.trim().toLowerCase();
  if (normalized === "") return undefined;
  if (normalized === "true" || normalized === "1" || normalized === "on") return true;
  if (normalized === "false" || normalized === "0" || normalized === "off") return false;
  return undefined;
}

/**
 * Auth obligatoria por defecto. Solo se desactiva con NEXT_PUBLIC_REQUIRE_AUTH=false.
 */
export function isAuthRequired(): boolean {
  return parseFlag(process.env.NEXT_PUBLIC_REQUIRE_AUTH) ?? true;
}

/**
 * createFile escribe al disco: en Vercel es de solo lectura y no persiste.
 * Activo en desarrollo local; en production hace falta ENABLE_CREATE_FILE=true.
 */
export function isCreateFileEnabled(): boolean {
  const explicit = parseFlag(process.env.ENABLE_CREATE_FILE);
  if (explicit !== undefined) return explicit;
  return process.env.NODE_ENV !== "production";
}

/**
 * Panel personal Ojo de Dios. Apagado por defecto (también en development)
 * para poder revertir sin tocar código: OJO_DE_DIOS_ENABLED=false o sin definir.
 */
export function isOjoDeDiosEnabled(): boolean {
  return parseFlag(process.env.OJO_DE_DIOS_ENABLED) ?? false;
}

/** Tope diario de mensajes por usuario. 0 o negativo = ilimitado. Default 50. */
export function getChatDailyMessageLimit(): number {
  const raw = process.env.CHAT_DAILY_MESSAGE_LIMIT?.trim();
  if (!raw) return 50;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) return 50;
  return parsed;
}
