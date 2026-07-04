/**
 * Limpia variables de entorno copiadas con caracteres invisibles o viñetas (•).
 * Evita: "Cannot convert argument to a ByteString... character 8226"
 */
export function sanitizeEnvValue(value: string | undefined): string | undefined {
  if (value == null) return undefined;

  let cleaned = value
    .trim()
    .replace(/^\uFEFF/, "")
    .replace(/^[\s\u2022\u2023\u25E6\u2043\u00B7]+/, "")
    .replace(/[\u200B-\u200D\uFEFF]/g, "");

  if (/[^\x00-\x7F]/.test(cleaned)) {
    cleaned = cleaned.replace(/[^\x00-\x7F]/g, "");
  }

  return cleaned || undefined;
}

export function getSupabaseUrl(): string | undefined {
  return sanitizeEnvValue(process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL);
}

export function getSupabaseAnonKey(): string | undefined {
  return sanitizeEnvValue(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

export function getSupabaseServiceRoleKey(): string | undefined {
  return sanitizeEnvValue(process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export function envKeyError(name: string): string {
  return `La variable ${name} tiene caracteres inválidos (viñeta •, espacios extra, etc.). Cópiala de nuevo desde Supabase → Settings → API, sin formato.`;
}

export function isLikelyJwtKey(key: string): boolean {
  return key.startsWith("eyJ") && key.length > 100;
}
