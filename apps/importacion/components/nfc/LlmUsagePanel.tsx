import Link from "next/link";
import { Cpu } from "lucide-react";
import type { LlmUsageSummary } from "@/lib/ai/llm-usage";

function formatUsd(n: number): string {
  if (n < 0.01 && n > 0) return `$${n.toFixed(4)}`;
  return `$${n.toFixed(2)}`;
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

const ACTION_LABELS: Record<string, string> = {
  carga_masiva: "Carga masiva",
  carga_masiva_vins: "Carga masiva · VIN",
  carga_masiva_datos: "Carga masiva · datos",
  carga_masiva_certs: "Carga masiva · certs",
  ocr_factura_comercial: "OCR factura",
  ocr_bl_guia: "OCR BL",
  ocr_certificado_origen: "OCR certificado",
  ocr_importador_rif: "OCR RIF",
  ocr_importador_cedula: "OCR cédula",
  ocr_impronta: "OCR impronta",
  chat: "Chat",
  telegram_factura: "Telegram factura",
};

function labelAction(action: string): string {
  return ACTION_LABELS[action] ?? action.replace(/_/g, " ");
}

type Props = {
  summary: LlmUsageSummary;
  compact?: boolean;
};

export function LlmUsagePanel({ summary, compact }: Props) {
  const over = summary.overBudget;
  const warn =
    !over &&
    summary.budgetUsedPct != null &&
    summary.budgetUsedPct >= 80;

  return (
    <section
      className={`rounded-2xl border px-4 py-3 ${
        over
          ? "border-red-900/50 bg-red-950/20"
          : warn
            ? "border-amber-900/40 bg-amber-950/15"
            : "border-slate-800 bg-slate-950/40"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <Cpu className="h-4 w-4 shrink-0 text-cyan-400" />
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-zinc-100">Uso de IA (mes)</h2>
            <p className="text-xs text-zinc-500">
              Estimado · {summary.calls} llamadas
            </p>
          </div>
        </div>
        {!compact ? (
          <Link
            href="/smartimport/uso-ia"
            className="shrink-0 text-xs font-medium text-cyan-400 hover:text-cyan-300"
          >
            Detalle
          </Link>
        ) : null}
      </div>

      <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-xl bg-zinc-900/50 px-2 py-2">
          <dt className="text-[10px] uppercase tracking-wide text-zinc-500">
            Tokens
          </dt>
          <dd className="mt-0.5 text-sm font-semibold tabular-nums text-zinc-100">
            {formatTokens(summary.totalTokens)}
          </dd>
        </div>
        <div className="rounded-xl bg-zinc-900/50 px-2 py-2">
          <dt className="text-[10px] uppercase tracking-wide text-zinc-500">
            Coste ~$
          </dt>
          <dd className="mt-0.5 text-sm font-semibold tabular-nums text-zinc-100">
            {formatUsd(summary.estimatedCostUsd)}
          </dd>
        </div>
        <div className="rounded-xl bg-zinc-900/50 px-2 py-2">
          <dt className="text-[10px] uppercase tracking-wide text-zinc-500">
            Tope
          </dt>
          <dd
            className={`mt-0.5 text-sm font-semibold tabular-nums ${
              over ? "text-red-300" : warn ? "text-amber-300" : "text-zinc-100"
            }`}
          >
            {summary.budgetUsd != null
              ? `${summary.budgetUsedPct ?? 0}%`
              : "—"}
          </dd>
        </div>
      </dl>

      {summary.budgetUsd != null ? (
        <p className="mt-2 text-xs text-zinc-500">
          Tope mensual: {formatUsd(summary.budgetUsd)}
          {over ? " · OCR bloqueado hasta el próximo mes o subir el tope." : null}
        </p>
      ) : (
        <p className="mt-2 text-xs text-zinc-500">
          Sin tope. Opcional:{" "}
          <code className="text-zinc-400">LLM_MONTHLY_BUDGET_USD</code> en Vercel.
        </p>
      )}

      {!compact && summary.byAction.length > 0 ? (
        <ul className="mt-3 space-y-1 border-t border-zinc-800/80 pt-3">
          {summary.byAction.slice(0, 6).map((row) => (
            <li
              key={row.action}
              className="flex items-center justify-between gap-2 text-xs"
            >
              <span className="truncate text-zinc-400">
                {labelAction(row.action)}
              </span>
              <span className="shrink-0 tabular-nums text-zinc-300">
                {formatTokens(row.totalTokens)} · {formatUsd(row.estimatedCostUsd)}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
