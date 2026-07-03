import { createBrowserClient } from "@supabase/ssr";

/** Cliente de Supabase para componentes cliente (navegador). Usar para Realtime y auth en UI. */
export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error(
      "Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY. " +
        "Local: revisa apps/web/.env.local y reinicia npm run dev. " +
        "Producción: añádelas en Vercel → Environment Variables y haz Redeploy."
    );
  }
  return createBrowserClient(url, key);
}
