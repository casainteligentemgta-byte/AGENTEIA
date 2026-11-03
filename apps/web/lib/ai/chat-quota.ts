import { createClient } from "@/lib/supabase/server";

export type ChatQuotaResult = {
  allowed: boolean;
  currentCount: number;
  dailyLimit: number;
};

type QuotaRow = {
  allowed: boolean;
  current_count: number;
  daily_limit: number;
};

function normalizeRow(row: QuotaRow | null | undefined): ChatQuotaResult | null {
  if (!row || typeof row.allowed !== "boolean") return null;
  return {
    allowed: row.allowed,
    currentCount: Number(row.current_count) || 0,
    dailyLimit: Number(row.daily_limit) || 0,
  };
}

/**
 * Consume 1 mensaje del tope diario del usuario autenticado (UTC).
 * Si la migración aún no está aplicada, no bloquea el chat (fail-open).
 */
export async function consumeDailyChatQuota(dailyLimit: number): Promise<ChatQuotaResult> {
  if (dailyLimit <= 0) {
    return { allowed: true, currentCount: 0, dailyLimit: 0 };
  }

  const supabase = createClient();
  const { data, error } = await supabase.rpc("consume_chat_quota", {
    p_daily_limit: dailyLimit,
  });

  if (!error) {
    const row = Array.isArray(data) ? data[0] : data;
    const parsed = normalizeRow(row as QuotaRow | undefined);
    if (parsed) return parsed;
  }

  console.warn(
    "[chat-quota] No se pudo aplicar el tope diario (¿migración 20261103120000 pendiente?):",
    error?.message ?? "respuesta vacía"
  );
  return { allowed: true, currentCount: 0, dailyLimit };
}

export function chatQuotaExceededMessage(dailyLimit: number): string {
  return `Has alcanzado el límite de ${dailyLimit} mensajes de hoy. Vuelve mañana o pide al propietario que suba CHAT_DAILY_MESSAGE_LIMIT.`;
}
