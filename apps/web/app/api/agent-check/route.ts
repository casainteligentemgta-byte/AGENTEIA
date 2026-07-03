import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  getWebSearchProvider,
  isWebSearchConfigured,
  probeWebSearch,
} from "@/lib/ai/web-search";

export const dynamic = "force-dynamic";

type Check = { name: string; ok: boolean; detail?: string };

/**
 * GET /api/agent-check — Comprueba que el agente y sus dependencias están bien configurados.
 * GET /api/agent-check?probe=web — prueba Serper/Tavily (consume 1 crédito).
 */
export async function GET(req: NextRequest) {
  const checks: Check[] = [];
  const probeWeb = req.nextUrl.searchParams.get("probe") === "web";

  const hasSupabaseUrl = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const hasSupabaseKey = Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  const openaiKey = process.env.OPENAI_API_KEY;
  const hasOpenAiKey = Boolean(openaiKey && openaiKey !== "sk-...");
  const webConfigured = isWebSearchConfigured();
  const webProvider = getWebSearchProvider();

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
    detail: hasOpenAiKey ? "definida" : "falta OPENAI_API_KEY real (no sk-...)",
  });
  checks.push({
    name: "Búsqueda web (Serper/Tavily)",
    ok: webConfigured,
    detail: webConfigured
      ? `activa (${webProvider})`
      : "opcional: SERPER_API_KEY en serper.dev (plan gratis)",
  });

  if (hasSupabaseUrl && hasSupabaseKey) {
    try {
      const supabase = createClient();
      const { error: missionsError } = await supabase.from("agent_missions").select("id").limit(1);
      checks.push({
        name: "Conexión Supabase",
        ok: !missionsError,
        detail: missionsError ? missionsError.message : "conexión OK",
      });

      const { count, error: memoryError } = await supabase
        .from("agent_memory")
        .select("id", { count: "exact", head: true });
      checks.push({
        name: "Memoria vectorial (agent_memory)",
        ok: !memoryError,
        detail: memoryError
          ? memoryError.message
          : `${count ?? 0} memorias — ejecuta npm run seed:memory si es 0`,
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

  if (probeWeb && webConfigured) {
    const probe = await probeWebSearch();
    checks.push({
      name: "Prueba búsqueda web",
      ok: !probe.error && probe.results.length > 0,
      detail: probe.error
        ? probe.error
        : `${probe.results.length} resultado(s) vía ${probe.provider} para "${probe.query}"`,
    });
  }

  const requiredOk = checks
    .filter((c) => c.name !== "Búsqueda web (Serper/Tavily)" && c.name !== "Prueba búsqueda web")
    .every((c) => c.ok);

  return NextResponse.json(
    {
      ok: requiredOk,
      message: requiredOk
        ? "Agente correctamente configurado. Puedes usar el chat."
        : "Revisa los puntos que fallen arriba (env, Supabase, OpenAI).",
      checks,
    },
    { status: requiredOk ? 200 : 503 }
  );
}
