/** Texto de RSS/HTML/correo es no confiable: se escapa y se recorta. Nunca se ejecuta. */

const ENTITY_MAP: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

export function decodeEntities(input: string): string {
  return input.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (full, entity: string) => {
    if (entity[0] === "#") {
      const isHex = entity[1] === "x" || entity[1] === "X";
      const code = Number.parseInt(entity.slice(isHex ? 2 : 1), isHex ? 16 : 10);
      if (!Number.isFinite(code) || code <= 0) return "";
      try {
        return String.fromCodePoint(code);
      } catch {
        return "";
      }
    }
    return ENTITY_MAP[entity] ?? "";
  });
}

export function stripTags(input: string): string {
  return input.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<[^>]*>/g, " ");
}

export function unwrapCdata(input: string): string {
  return input.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1");
}

export function sanitizeText(input: string, maxLen = 280): string {
  const raw = unwrapCdata(input);
  const once = decodeEntities(stripTags(raw));
  const twice = stripTags(once);
  return twice.replace(/\s+/g, " ").trim().slice(0, maxLen);
}

export function isSafeHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

export function toHttpsUrl(value: string): string | null {
  if (!isSafeHttpUrl(value)) return null;
  const url = new URL(value);
  if (url.username || url.password) return null;
  if (url.protocol === "http:") url.protocol = "https:";
  if (url.protocol !== "https:") return null;
  return url.toString();
}

/** Quita secretos obvios de un objeto serializable (red de seguridad para logs/respuestas). */
export function assertNoSecrets(payload: unknown, denylist: string[]): void {
  const blob = JSON.stringify(payload) ?? "";
  for (const secret of denylist) {
    if (!secret) continue;
    if (blob.includes(secret)) {
      throw new Error("Respuesta interna filtró un secreto");
    }
  }
}
