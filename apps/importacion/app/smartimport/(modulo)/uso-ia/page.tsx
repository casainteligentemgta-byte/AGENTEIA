import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getLlmUsageSummaryAction } from "@/app/actions/nfc/llm-usage";
import { LlmUsagePanel } from "@/components/nfc/LlmUsagePanel";
import { getUser } from "@/lib/supabase/server";
import { getMyTaller } from "@/lib/taller";

export const dynamic = "force-dynamic";

export default async function UsoIaPage() {
  const user = await getUser();
  if (!user) redirect("/smartimport/login?redirectTo=/smartimport/uso-ia");

  const taller = await getMyTaller();
  if (!taller) {
    return (
      <main className="min-h-screen bg-zinc-950 px-4 py-8">
        <p className="text-sm text-amber-200">No se encontró tu taller.</p>
      </main>
    );
  }

  const result = await getLlmUsageSummaryAction();

  return (
    <main className="min-h-screen bg-[radial-gradient(ellipse_at_top,_rgba(8,145,178,0.12),_transparent_50%),linear-gradient(180deg,#070b12_0%,#0a1628_45%,#070b12_100%)] px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-lg space-y-4">
        <div className="flex items-center gap-3">
          <Link
            href="/smartimport"
            className="inline-flex rounded-full p-2 text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100"
            aria-label="Volver"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-lg font-semibold text-zinc-50">Uso de IA</h1>
            <p className="text-sm text-zinc-400">
              Tokens y coste estimado del mes (tu taller)
            </p>
          </div>
        </div>

        {result.success ? (
          <LlmUsagePanel summary={result.summary} compact />
        ) : (
          <div className="rounded-2xl border border-amber-900/50 bg-amber-950/30 px-4 py-3 text-sm text-amber-200">
            {result.error}
          </div>
        )}

        <div className="rounded-2xl border border-slate-800 bg-slate-950/40 px-4 py-3 text-xs leading-relaxed text-zinc-400">
          <p>
            El coste es una estimación según precios públicos del modelo. La
            factura real la ves en OpenAI, OpenRouter o Google AI Studio.
          </p>
          <p className="mt-2">
            Tope opcional en Vercel:{" "}
            <code className="text-zinc-300">LLM_MONTHLY_BUDGET_USD=5</code>{" "}
            (bloquea OCR al superar el mes).
          </p>
        </div>
      </div>
    </main>
  );
}
