import { createClient } from "@supabase/supabase-js";

/**
 * Cliente Supabase para el agente de extracción.
 *
 * Env:
 * - NEXT_PUBLIC_SUPABASE_URL | SUPABASE_URL
 * - SUPABASE_SERVICE_ROLE_KEY (preferido en servidor/agente)
 * - NEXT_PUBLIC_SUPABASE_ANON_KEY | SUPABASE_ANON_KEY (fallback; sujeto a RLS)
 *
 * RLS: si usas anon key, las políticas deben permitir las operaciones del taller.
 * Con service role se saltan RLS — restringe uso a backend/agente autenticado.
 *
 * @param {{ url?: string, key?: string } | undefined} overrides
 */
export function createSupabaseClient(overrides = {}) {
  const url =
    overrides.url ||
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    "";
  const key =
    overrides.key ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    "";

  if (!url || !key) {
    throw new Error(
      "Faltan SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY (o ANON) para el agente PDF"
    );
  }

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

/**
 * Indica si hay credenciales suficientes sin lanzar.
 */
export function isSupabaseConfigured() {
  const url =
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    "";
  return Boolean(url && key);
}
