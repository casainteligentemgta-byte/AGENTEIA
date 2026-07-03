import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Check = { name: string; ok: boolean; detail?: string };

/**
 * GET /api/agent-check — Comprueba que el agente y sus dependencias están bien configurados.
 * Abre en el navegador: http://localhost:3002/api/agent-check
 */
export async function GET() {
  const checks: Check[] = [];

  // 1. Variables de entorno
  const hasSupabaseUrl = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const hasSupabaseKey = Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  const hasOpenAiKey = Boolean(process.env.OPENAI_API_KEY);

  checks.push({
    name: "Supabase URL",
    ok: hasSupabaseUrl,
    detail: hasSupabaseUrl ? "definida" : "falta NEXT_PUBLIC_SUPABASE_URL",
  });
  checks.push({
    name: "Supabase Anon Key",
    ok: hasSupabaseKey,
    detail: hasSupabaseKey ? "definida" : "falta NEXT_PUBLIC_SUPABASE_ANON_KEY",
  });
  checks.push({
    name: "OpenAI API Key",
    ok: hasOpenAiKey,
    detail: hasOpenAiKey ? "definida" : "falta OPENAI_API_KEY en .env.local",
  });

  // 2. Conexión a Supabase (solo si tenemos env)
  let supabaseOk = false;
  if (hasSupabaseUrl && hasSupabaseKey) {
    try {
      const supabase = createClient();
      const { error } = await supabase.from("agent_missions").select("id").limit(1);
      supabaseOk = !error;
      checks.push({
        name: "Conexión Supabase",
        ok: !error,
        detail: error ? error.message : "conexión OK",
      });
    } catch (e) {
      checks.push({
        name: "Conexión Supabase",
        ok: false,
        detail: e instanceof Error ? e.message : "Error al conectar",
      });
    }
  } else {
    checks.push({ name: "Conexión Supabase", ok: false, detail: "Faltan variables de entorno" });
  }

  // 3. Resumen
  const allOk = checks.every((c) => c.ok);

  return NextResponse.json(
    {
      ok: allOk,
      message: allOk
        ? "Agente correctamente configurado. Puedes usar el chat."
        : "Revisa los puntos que fallen arriba (env, Supabase).",
      checks,
    },
    { status: allOk ? 200 : 503 }
  );
}
