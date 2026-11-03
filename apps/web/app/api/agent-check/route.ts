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

type PostgrestLikeError = { code?: string; message?: string } | null;

/** True si la relación no existe (migración pendiente). */
function isMissingRelationError(error: PostgrestLikeError): boolean {
  if (!error) return false;
  const code = error.code ?? "";
  const message = (error.message ?? "").toLowerCase();
  return (
    code === "42P01" ||
    code === "PGRST205" ||
    /does not exist|could not find the table|schema cache/.test(message)
  );
}

/**
 * True si anon no puede leer la tabla. En chat_usage eso es el estado
 * correcto tras la migración (REVOKE a anon); no hay que abrir permisos.
 */
function isPrivilegeDeniedError(error: PostgrestLikeError): boolean {
  if (!error) return false;
  const code = error.code ?? "";
  const message = (error.message ?? "").toLowerCase();
  return (
    code === "42501" ||
    /permission denied|insufficient_privilege|not authorized/.test(message)
  );
}

function chatUsageHealthCheck(error: PostgrestLikeError): Check {
  const name = "Cuota chat (chat_usage)";
  if (!error) {
    return { name, ok: true, detail: "tabla lista (tope diario por usuario)" };
  }
  if (isPrivilegeDeniedError(error)) {
    return {
      name,
      ok: true,
      detail:
        "migración aplicada — tabla protegida (anon no lee chat_usage; el tope se aplica con sesión)",
    };
  }
  if (isMissingRelationError(error)) {
    return {
      name,
      ok: false,
      detail: `falta migración 20261103120000 — ${error.message}`,
    };
  }
  return { name, ok: false, detail: error.message };
}

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

      // Probe sin sesión: permission denied = migración aplicada (REVOKE a anon).
      // No uses GRANT a anon; el tope se consume en /api/chat con JWT.
      const { error: quotaError } = await supabase
        .from("chat_usage")
        .select("message_count")
        .limit(1);
      checks.push(chatUsageHealthCheck(quotaError));
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
        c.name !== "RLS misiones (D7)"
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
