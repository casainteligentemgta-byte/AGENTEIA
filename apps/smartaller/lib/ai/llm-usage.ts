import { AsyncLocalStorage } from "node:async_hooks";
import { createAdminClient } from "@/lib/supabase/admin";

/** Contexto por request (Server Action / API) para etiquetar el gasto. */
export type LlmUsageContext = {
  action: string;
  tallerId?: string | null;
  userId?: string | null;
};

export type LlmTokenUsage = {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
};

export type LlmUsageSummary = {
  periodStart: string;
  periodEnd: string;
  calls: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCostUsd: number;
  budgetUsd: number | null;
  budgetUsedPct: number | null;
  overBudget: boolean;
  byAction: Array<{
    action: string;
    calls: number;
    totalTokens: number;
    estimatedCostUsd: number;
  }>;
};

const storage = new AsyncLocalStorage<LlmUsageContext>();

export function runWithLlmUsageContext<T>(
  ctx: LlmUsageContext,
  fn: () => Promise<T>
): Promise<T> {
  return storage.run(ctx, fn);
}

/** Enlaza contexto al resto del Server Action (async). */
export function bindLlmUsageContext(ctx: LlmUsageContext): void {
  storage.enterWith(ctx);
}

export function getLlmUsageContext(): LlmUsageContext | undefined {
  return storage.getStore();
}

/** Precio estimado USD por 1M tokens (input / output). Aprox. públicos 2026. */
const MODEL_PRICES_PER_M: Record<string, { input: number; output: number }> = {
  "gpt-4o-mini": { input: 0.15, output: 0.6 },
  "openai/gpt-4o-mini": { input: 0.15, output: 0.6 },
  "gpt-4o": { input: 2.5, output: 10 },
  "openai/gpt-4o": { input: 2.5, output: 10 },
  "gemini-2.0-flash": { input: 0.1, output: 0.4 },
  "gemini-2.0-flash-lite": { input: 0.075, output: 0.3 },
  "gemini-2.5-flash": { input: 0.15, output: 0.6 },
  "google/gemini-2.0-flash": { input: 0.1, output: 0.4 },
  "google/gemini-2.0-flash-exp:free": { input: 0, output: 0 },
};

function normalizeModelKey(model: string): string {
  return model.trim().toLowerCase();
}

export function estimateCostUsd(
  model: string,
  promptTokens: number,
  completionTokens: number
): number {
  const key = normalizeModelKey(model);
  const prices =
    MODEL_PRICES_PER_M[key] ??
    MODEL_PRICES_PER_M[key.replace(/^openai\//, "")] ??
    (key.includes("gemini")
      ? { input: 0.1, output: 0.4 }
      : key.includes("4o-mini")
        ? { input: 0.15, output: 0.6 }
        : { input: 0.5, output: 1.5 });

  const cost =
    (promptTokens / 1_000_000) * prices.input +
    (completionTokens / 1_000_000) * prices.output;
  return Math.round(cost * 1_000_000) / 1_000_000;
}

export function resolveLlmProvider(model: string): string {
  const m = normalizeModelKey(model);
  if (m.includes("gemini") || m.startsWith("google/")) return "gemini";
  if (m.includes("/") || process.env.OPENAI_API_KEY?.startsWith("sk-or-")) {
    return "openrouter";
  }
  return "openai";
}

/** Tope mensual opcional (USD). Vacío = sin corte duro. */
export function getLlmMonthlyBudgetUsd(): number | null {
  const raw = process.env.LLM_MONTHLY_BUDGET_USD?.trim();
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function parseProviderUsage(usage: unknown): LlmTokenUsage | null {
  if (!usage || typeof usage !== "object") return null;
  const u = usage as Record<string, unknown>;
  const prompt =
    num(u.prompt_tokens) ??
    num(u.promptTokens) ??
    num(u.input_tokens) ??
    num(u.inputTokens) ??
    0;
  const completion =
    num(u.completion_tokens) ??
    num(u.completionTokens) ??
    num(u.output_tokens) ??
    num(u.outputTokens) ??
    0;
  const total =
    num(u.total_tokens) ??
    num(u.totalTokens) ??
    prompt + completion;
  if (prompt === 0 && completion === 0 && total === 0) return null;
  return {
    promptTokens: prompt,
    completionTokens: completion,
    totalTokens: total > 0 ? total : prompt + completion,
  };
}

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v) && v >= 0) return Math.round(v);
  if (typeof v === "string" && v.trim()) {
    const n = Number(v);
    if (Number.isFinite(n) && n >= 0) return Math.round(n);
  }
  return null;
}

/**
 * Registra uso tras una completion. Fire-and-forget (no bloquea OCR).
 * Requiere contexto ALS o tallerId explícito.
 */
export function trackLlmUsage(params: {
  model: string;
  usage: unknown;
  action?: string;
  tallerId?: string | null;
  userId?: string | null;
  meta?: Record<string, unknown>;
}): void {
  const parsed = parseProviderUsage(params.usage);
  if (!parsed) return;

  const ctx = getLlmUsageContext();
  const tallerId = params.tallerId ?? ctx?.tallerId ?? null;
  const userId = params.userId ?? ctx?.userId ?? null;
  const action = params.action ?? ctx?.action ?? "unknown";
  const model = params.model || "unknown";
  const estimated = estimateCostUsd(
    model,
    parsed.promptTokens,
    parsed.completionTokens
  );

  void persistLlmUsage({
    tallerId,
    userId,
    action,
    provider: resolveLlmProvider(model),
    model,
    promptTokens: parsed.promptTokens,
    completionTokens: parsed.completionTokens,
    totalTokens: parsed.totalTokens,
    estimatedCostUsd: estimated,
    meta: params.meta ?? {},
  }).catch((err) => {
    console.error("[llm_usage] persist failed:", err);
  });
}

async function persistLlmUsage(row: {
  tallerId: string | null;
  userId: string | null;
  action: string;
  provider: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCostUsd: number;
  meta: Record<string, unknown>;
}): Promise<void> {
  try {
    const admin = createAdminClient();
    const { error } = await admin.from("llm_usage").insert({
      taller_id: row.tallerId,
      user_id: row.userId,
      action: row.action.slice(0, 80),
      provider: row.provider.slice(0, 40),
      model: row.model.slice(0, 120),
      prompt_tokens: row.promptTokens,
      completion_tokens: row.completionTokens,
      total_tokens: row.totalTokens,
      estimated_cost_usd: row.estimatedCostUsd,
      meta: row.meta,
    });
    if (error) {
      console.error("[llm_usage] insert:", error.message);
    }
  } catch (err) {
    console.error("[llm_usage]", err);
  }
}

function monthBounds(now = new Date()): { start: Date; end: Date } {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)
  );
  return { start, end };
}

export async function getLlmUsageSummaryForTaller(
  tallerId: string
): Promise<LlmUsageSummary> {
  const { start, end } = monthBounds();
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("llm_usage")
    .select(
      "action, prompt_tokens, completion_tokens, total_tokens, estimated_cost_usd"
    )
    .eq("taller_id", tallerId)
    .gte("created_at", start.toISOString())
    .lt("created_at", end.toISOString());

  if (error) {
    throw new Error(error.message);
  }

  const rows = data ?? [];
  let promptTokens = 0;
  let completionTokens = 0;
  let totalTokens = 0;
  let estimatedCostUsd = 0;
  const byActionMap = new Map<
    string,
    { calls: number; totalTokens: number; estimatedCostUsd: number }
  >();

  for (const r of rows) {
    const p = Number(r.prompt_tokens) || 0;
    const c = Number(r.completion_tokens) || 0;
    const t = Number(r.total_tokens) || p + c;
    const cost = Number(r.estimated_cost_usd) || 0;
    promptTokens += p;
    completionTokens += c;
    totalTokens += t;
    estimatedCostUsd += cost;
    const action = String(r.action || "unknown");
    const prev = byActionMap.get(action) ?? {
      calls: 0,
      totalTokens: 0,
      estimatedCostUsd: 0,
    };
    prev.calls += 1;
    prev.totalTokens += t;
    prev.estimatedCostUsd += cost;
    byActionMap.set(action, prev);
  }

  const budgetUsd = getLlmMonthlyBudgetUsd();
  const roundedCost = Math.round(estimatedCostUsd * 1_000_000) / 1_000_000;
  const budgetUsedPct =
    budgetUsd != null && budgetUsd > 0
      ? Math.round((roundedCost / budgetUsd) * 1000) / 10
      : null;

  return {
    periodStart: start.toISOString(),
    periodEnd: end.toISOString(),
    calls: rows.length,
    promptTokens,
    completionTokens,
    totalTokens,
    estimatedCostUsd: roundedCost,
    budgetUsd,
    budgetUsedPct,
    overBudget: budgetUsd != null ? roundedCost >= budgetUsd : false,
    byAction: [...byActionMap.entries()]
      .map(([action, v]) => ({
        action,
        calls: v.calls,
        totalTokens: v.totalTokens,
        estimatedCostUsd:
          Math.round(v.estimatedCostUsd * 1_000_000) / 1_000_000,
      }))
      .sort((a, b) => b.estimatedCostUsd - a.estimatedCostUsd),
  };
}

/** Corte duro opcional antes de OCR costoso. */
export async function assertLlmBudgetAllows(
  tallerId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const budget = getLlmMonthlyBudgetUsd();
  if (budget == null) return { ok: true };
  try {
    const summary = await getLlmUsageSummaryForTaller(tallerId);
    if (!summary.overBudget) return { ok: true };
    return {
      ok: false,
      error: `Tope mensual de IA alcanzado (~$${summary.estimatedCostUsd.toFixed(2)} / $${budget.toFixed(2)}). Sube LLM_MONTHLY_BUDGET_USD o espera al próximo mes.`,
    };
  } catch {
    return { ok: true };
  }
}
