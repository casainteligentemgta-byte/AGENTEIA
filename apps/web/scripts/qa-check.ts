/**
 * D13 — QA automatizado del agente.
 * Uso: npm run qa
 *      npm run qa -- --url http://localhost:3002
 */
import { config } from "dotenv";
import { resolve } from "path";
import { execSync } from "child_process";
import { existsSync } from "fs";

config({ path: resolve(process.cwd(), ".env.local") });

type QaResult = { name: string; ok: boolean; detail?: string };

const args = process.argv.slice(2);
const urlIdx = args.indexOf("--url");
const baseUrl = urlIdx >= 0 ? args[urlIdx + 1] : process.env.QA_BASE_URL ?? "";

const results: QaResult[] = [];

function check(name: string, ok: boolean, detail?: string) {
  results.push({ name, ok, detail });
  const icon = ok ? "✓" : "✗";
  console.log(`${icon} ${name}${detail ? ` — ${detail}` : ""}`);
}

import { isLlmConfigured, isOpenRouterKey } from "../lib/ai/openai-config";

function isRealKey(value: string | undefined, placeholders: string[] = ["sk-...", "..."]): boolean {
  if (!value?.trim()) return false;
  return !placeholders.some((p) => value.trim() === p || value.trim().endsWith("..."));
}

async function probeHttp(path: string, expectStatus?: number): Promise<{ ok: boolean; detail: string }> {
  try {
    const res = await fetch(`${baseUrl}${path}`, { signal: AbortSignal.timeout(30_000) });
    const ct = res.headers.get("content-type") ?? "";
    if (expectStatus != null && res.status !== expectStatus) {
      return { ok: false, detail: `HTTP ${res.status} (esperado ${expectStatus})` };
    }
    if (path.includes("/api/") && !ct.includes("json")) {
      return { ok: false, detail: `HTTP ${res.status}, content-type: ${ct}` };
    }
    return { ok: res.ok || res.status === 503, detail: `HTTP ${res.status}` };
  } catch (e) {
    return { ok: false, detail: `${e instanceof Error ? e.message : "fetch error"} (¿dev server listo? npm run dev)` };
  }
}

async function main() {
  console.log("\n=== QA AGENTE IA (D13) ===\n");

  // 1. Archivos críticos
  const criticalFiles = [
    "app/page.tsx",
    "app/agente/page.tsx",
    "app/login/page.tsx",
    "app/api/chat/route.ts",
    "app/api/agent-check/route.ts",
    "lib/ai/memory.ts",
    "lib/ai/web-search.ts",
    "lib/ai/system-prompt.ts",
    "supabase/setup-completo.sql",
    "supabase/migrations/20250703160000_missions_rls_by_user.sql",
  ];
  for (const f of criticalFiles) {
    check(`Archivo: ${f}`, existsSync(resolve(process.cwd(), f)));
  }

  // 2. Variables de entorno
  check("NEXT_PUBLIC_SUPABASE_URL", isRealKey(process.env.NEXT_PUBLIC_SUPABASE_URL, ["..."]));
  check("NEXT_PUBLIC_SUPABASE_ANON_KEY", isRealKey(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, ["eyJ...", "..."]));
  check("NEXT_PUBLIC_AGENT_NAME", Boolean(process.env.NEXT_PUBLIC_AGENT_NAME?.trim()));
  check(
    "OPENAI_API_KEY",
    isLlmConfigured(),
    isLlmConfigured()
      ? isOpenRouterKey()
        ? "OpenRouter (sk-or-v1)"
        : "OpenAI directo"
      : "falta o placeholder"
  );
  check(
    "SERPER_API_KEY (opcional)",
    true,
    isRealKey(process.env.SERPER_API_KEY) ? "definida" : "no configurada"
  );

  // 3. TypeScript
  try {
    execSync("npx tsc --noEmit", { stdio: "pipe", cwd: process.cwd() });
    check("TypeScript (tsc --noEmit)", true);
  } catch {
    check("TypeScript (tsc --noEmit)", false, "errores de tipos");
  }

  // 4. Rutas HTTP (si hay servidor)
  if (baseUrl) {
    console.log(`\n--- Probes HTTP (${baseUrl}) ---\n`);
    for (const route of ["/", "/agente", "/login", "/api/agent-check"]) {
      const r = await probeHttp(route, route.startsWith("/api") ? undefined : 200);
      check(`GET ${route}`, r.ok, r.detail);
    }
    try {
      const agentCheck = await fetch(`${baseUrl}/api/agent-check`, {
        signal: AbortSignal.timeout(30_000),
      });
      if (agentCheck.ok || agentCheck.status === 503) {
        const body = (await agentCheck.json()) as { ok?: boolean; checks?: QaResult[] };
        check("agent-check JSON", Array.isArray(body.checks), `${body.checks?.length ?? 0} checks`);
      } else {
        check("agent-check JSON", false, `HTTP ${agentCheck.status}`);
      }
    } catch (e) {
      check(
        "agent-check JSON",
        false,
        e instanceof Error ? e.message : "timeout — espera a que Next muestre Ready"
      );
    }
  } else {
    console.log("\n(Omitiendo probes HTTP — pasa --url http://localhost:3002 con el dev server activo)\n");
  }

  // 5. Resumen
  const failed = results.filter((r) => !r.ok);
  const blocking = failed.filter(
    (r) =>
      !r.name.includes("opcional") &&
      !r.name.includes("SERPER") &&
      r.name !== "OPENAI_API_KEY" &&
      !r.name.startsWith("GET ") &&
      r.name !== "agent-check JSON"
  );

  console.log("\n--- Resumen ---");
  console.log(`Total: ${results.length} | OK: ${results.length - failed.length} | Fallos: ${failed.length}`);

  if (failed.length > 0) {
    console.log("\nPendientes manuales:");
    if (!isLlmConfigured()) console.log("  • OPENAI_API_KEY real → chat y seed memoria");
    if (!isRealKey(process.env.SERPER_API_KEY)) console.log("  • SERPER_API_KEY → búsqueda web");
    console.log("  • Ejecutar SQL RLS: supabase/migrations/20250703160000_missions_rls_by_user.sql");
    console.log("  • npm run seed:memory (con OpenAI real)");
  }

  const exitCode = blocking.length > 0 ? 1 : 0;
  process.exit(exitCode);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
