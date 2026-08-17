import { createClient } from "@supabase/supabase-js";
import {
  envKeyError,
  getSupabaseServiceRoleKey,
  getSupabaseUrl,
  isLikelyJwtKey,
} from "@/lib/supabase/env";

/**
 * Cliente Supabase con service role para operaciones de servidor (webhook).
 * No usar en el cliente.
 */
export function createAdminClient() {
  const url = getSupabaseUrl();
  const key = getSupabaseServiceRoleKey();

  if (!url || !key) {
    throw new Error(
      "Faltan SUPABASE_URL (o NEXT_PUBLIC_SUPABASE_URL) o SUPABASE_SERVICE_ROLE_KEY en las variables de entorno"
    );
  }

  if (!isLikelyJwtKey(key)) {
    throw new Error(envKeyError("SUPABASE_SERVICE_ROLE_KEY"));
  }

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
