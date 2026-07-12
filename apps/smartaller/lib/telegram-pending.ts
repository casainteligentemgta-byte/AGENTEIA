import { createAdminClient } from "@/lib/supabase/admin";

export type TelegramPendingAction = "recepcion_foto_frontal";

const TTL_MS = 15 * 60 * 1000;

export async function setTelegramPendingAction(
  chatId: number,
  action: TelegramPendingAction
): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase.from("telegram_pending_actions").upsert(
    {
      chat_id: chatId,
      action,
      created_at: new Date().toISOString(),
    },
    { onConflict: "chat_id" }
  );

  if (error) {
    console.error("[telegram-pending] set:", error.message);
    throw new Error(
      "Falta la tabla telegram_pending_actions en Supabase. Aplica la migración 20250715100000."
    );
  }
}

export async function getTelegramPendingAction(
  chatId: number
): Promise<TelegramPendingAction | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("telegram_pending_actions")
    .select("action, created_at")
    .eq("chat_id", chatId)
    .maybeSingle();

  if (error) {
    console.error("[telegram-pending] get:", error.message);
    return null;
  }

  if (!data) return null;

  const createdAt = new Date(data.created_at).getTime();
  if (Date.now() - createdAt > TTL_MS) {
    await clearTelegramPendingAction(chatId);
    return null;
  }

  return data.action as TelegramPendingAction;
}

export async function clearTelegramPendingAction(chatId: number): Promise<void> {
  const supabase = createAdminClient();
  await supabase.from("telegram_pending_actions").delete().eq("chat_id", chatId);
}
