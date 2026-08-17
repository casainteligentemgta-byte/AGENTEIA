"use server";

import { getUser } from "@/lib/supabase/server";
import { getMyTaller } from "@/lib/taller";
import {
  getLlmUsageSummaryForTaller,
  type LlmUsageSummary,
} from "@/lib/ai/llm-usage";

export type GetLlmUsageSummaryResult =
  | { success: true; summary: LlmUsageSummary }
  | { success: false; error: string };

export async function getLlmUsageSummaryAction(): Promise<GetLlmUsageSummaryResult> {
  const user = await getUser();
  if (!user) return { success: false, error: "Debes iniciar sesión" };

  const taller = await getMyTaller();
  if (!taller) return { success: false, error: "No se encontró tu taller" };

  try {
    const summary = await getLlmUsageSummaryForTaller(taller.id);
    return { success: true, summary };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "No se pudo cargar el uso de IA";
    if (/relation .*llm_usage.* does not exist|Could not find the table/i.test(msg)) {
      return {
        success: false,
        error:
          "Falta aplicar la migración llm_usage en Supabase (20260812180000_llm_usage.sql).",
      };
    }
    return { success: false, error: msg };
  }
}
