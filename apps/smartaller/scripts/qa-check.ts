/**
 * QA estático + smoke HTTP opcional para SmartTaller.
 * Uso: npm run qa
 *      npm run qa -- --url https://tu-dominio.vercel.app
 */
import { config } from "dotenv";
import { existsSync, readFileSync } from "fs";
import { resolve } from "path";

config({ path: resolve(process.cwd(), ".env.local") });

type QaResult = { name: string; ok: boolean; detail?: string };

const args = process.argv.slice(2);
const urlIdx = args.indexOf("--url");
const strictEnv = args.includes("--strict");
const baseUrl = urlIdx >= 0 ? args[urlIdx + 1] : process.env.QA_BASE_URL ?? "";

const results: QaResult[] = [];
const warnings: QaResult[] = [];

function check(name: string, ok: boolean, detail?: string, optional = false) {
  const entry = { name, ok, detail };
  if (optional) warnings.push(entry);
  else results.push(entry);
  const icon = ok ? "✓" : optional ? "!" : "✗";
  console.log(`${icon} ${name}${detail ? ` — ${detail}` : ""}`);
}

function isRealKey(value: string | undefined, placeholders: string[] = ["...", "sk-...", "eyJ..."]): boolean {
  if (!value?.trim()) return false;
  const v = value.trim();
  return !placeholders.some((p) => v === p || v.endsWith("..."));
}

function fileContains(path: string, needle: string): boolean {
  if (!existsSync(path)) return false;
  return readFileSync(path, "utf8").includes(needle);
}

async function probeHttp(path: string): Promise<{ ok: boolean; detail: string }> {
  try {
    const res = await fetch(`${baseUrl}${path}`, { signal: AbortSignal.timeout(30_000) });
    const ct = res.headers.get("content-type") ?? "";
    if (path.includes("/api/") && !ct.includes("json")) {
      return { ok: false, detail: `HTTP ${res.status}, content-type: ${ct}` };
    }
    return { ok: res.ok || res.status === 503, detail: `HTTP ${res.status}` };
  } catch (e) {
    return {
      ok: false,
      detail: `${e instanceof Error ? e.message : "fetch error"} (¿servidor arriba?)`,
    };
  }
}

async function main() {
  console.log("\n=== QA SmartTaller ===\n");

  const criticalFiles = [
    "app/page.tsx",
    "app/para-talleres/page.tsx",
    "app/dashboard/page.tsx",
    "app/app/page.tsx",
    "app/api/health/route.ts",
    "app/api/telegram-webhook/route.ts",
    "app/error.tsx",
    "app/not-found.tsx",
    "supabase/setup-completo.sql",
    "supabase/pc-deploy/01-parche-migraciones-jul5-a-jul10.sql",
    "docs/CHECKLIST-LANZAMIENTO.md",
    "lib/smartbike/ensure-taller-bike.ts",
  ];

  for (const f of criticalFiles) {
    check(`Archivo: ${f}`, existsSync(resolve(process.cwd(), f)));
  }

  check(
    "setup-completo incluye repuestos",
    fileContains(resolve(process.cwd(), "supabase/setup-completo.sql"), "mantenimiento_repuestos")
  );
  check(
    "setup-completo incluye smartbike link",
    fileContains(resolve(process.cwd(), "supabase/setup-completo.sql"), "vehiculo_id")
  );

  check("NEXT_PUBLIC_SUPABASE_URL", isRealKey(process.env.NEXT_PUBLIC_SUPABASE_URL), undefined, !strictEnv);
  check("NEXT_PUBLIC_SUPABASE_ANON_KEY", isRealKey(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY), undefined, !strictEnv);
  check("SUPABASE_SERVICE_ROLE_KEY", isRealKey(process.env.SUPABASE_SERVICE_ROLE_KEY), undefined, !strictEnv);
  check("TELEGRAM_BOT_TOKEN", isRealKey(process.env.TELEGRAM_BOT_TOKEN), undefined, !strictEnv);
  check("TELEGRAM_WEBHOOK_SECRET", isRealKey(process.env.TELEGRAM_WEBHOOK_SECRET), undefined, !strictEnv);
  check("OPENAI_API_KEY", isRealKey(process.env.OPENAI_API_KEY), undefined, !strictEnv);
  check("CRON_SECRET", isRealKey(process.env.CRON_SECRET), undefined, !strictEnv);
  check("NEXT_PUBLIC_APP_URL", isRealKey(process.env.NEXT_PUBLIC_APP_URL, ["http://localhost:3003"]), undefined, !strictEnv);

  const stripeOk =
    isRealKey(process.env.STRIPE_SECRET_KEY) &&
    isRealKey(process.env.STRIPE_WEBHOOK_SECRET) &&
    isRealKey(process.env.STRIPE_PRICE_ID, ["price_..."]);
  check(
    "Stripe (opcional prod)",
    stripeOk,
    stripeOk ? "configurado" : "omitir en piloto sin pagos",
    true
  );

  if (baseUrl) {
    console.log(`\n--- Smoke HTTP (${baseUrl}) ---\n`);
    for (const path of ["/api/health", "/", "/para-talleres", "/login", "/cliente"]) {
      const probe = await probeHttp(path);
      check(`GET ${path}`, probe.ok, probe.detail);
    }
  } else {
    console.log("\n(Omite smoke HTTP: pasa --url https://tu-dominio o QA_BASE_URL)\n");
  }

  const failed = results.filter((r) => !r.ok).length;
  const warned = warnings.filter((r) => !r.ok).length;
  if (warned > 0) {
    console.log(`\n${warned} aviso(s) de entorno (usa --strict para fallar o configura .env.local)`);
  }
  console.log(`\n${failed === 0 ? "OK" : `FALLÓ: ${failed} check(s)`}\n`);
  process.exit(failed === 0 ? 0 : 1);
}

main();
