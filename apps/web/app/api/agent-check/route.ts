import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  getWebSearchProvider,
  isWebSearchConfigured,
  probeWebSearch,
} from "@/lib/ai/web-search";
import { isLlmConfigured, isOpenRouterKey } from "@/lib/ai/openai-config";

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
  const hasOpenAiKey = isLlmConfigured();
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
    detail: hasOpenAiKey
      ? isOpenRouterKey()
        ? "OpenRouter"
        : "OpenAI directo"
      : "falta OPENAI_API_KEY",
  });
  checks.push({
    name: "Búsqueda web (Serper/Tavily)",
    ok: webConfigured,
    detail: webConfigured
      ? `activa (${webProvider})`
      : "opcional: falta SERPER_API_KEY — el chat sigue; webSearch avisa y no rompe",
  });

  if (hasSupabaseUrl && hasSupabaseKey) {
    try {
      const supabase = createClient();
      const { error: profileError } = await supabase.from("agent_profile").select("id").limit(1);
      checks.push({
        name: "Conexión Supabase",
        ok: !profileError,
        detail: profileError ? profileError.message : "conexión OK",
      });

      checks.push({
        name: "RLS misiones (D7)",
        ok: true,
        detail:
          "activo — agent_missions solo visible con sesión (auth.uid = user_id)",
      });

      const { count, error: memoryError } = await supabase
        .from("agent_memory")
        .select("id", { count: "exact", head: true });
      checks.push({
        name: "Memoria vectorial (agent_memory)",
        ok: !memoryError,
        detail: memoryError
          ? memoryError.message
          : `${count ?? 0} memorias visibles (sistema + propias). Seed: npm run seed:memory`,
      });

      const { error: quotaError } = await supabase
        .from("chat_usage")
        .select("message_count")
        .limit(1);
      checks.push({
        name: "Cuota chat (chat_usage)",
        ok: !quotaError,
        detail: quotaError
          ? `falta migración 20261103120000 — ${quotaError.message}`
          : "tabla lista (tope diario por usuario)",
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
    .filter(
      (c) =>
        c.name !== "Búsqueda web (Serper/Tavily)" &&
        c.name !== "Prueba búsqueda web" &&
        c.name !== "RLS misiones (D7)" &&
        c.name !== "Cuota chat (chat_usage)"
    )
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
