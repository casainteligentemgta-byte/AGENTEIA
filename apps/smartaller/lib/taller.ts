import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type Taller = {
  id: string;
  nombre: string;
  owner_user_id: string;
  telegram_chat_id: number | null;
  codigo_vinculo: string;
  created_at: string;
};

function generateCodigo(): string {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase();
}

/** Obtiene o crea el taller del usuario autenticado (dashboard). */
export async function ensureTallerForUser(userId: string): Promise<Taller | null> {
  const supabase = createClient();

  const { data: existing } = await supabase
    .from("talleres")
    .select("id, nombre, owner_user_id, telegram_chat_id, codigo_vinculo, created_at")
    .eq("owner_user_id", userId)
    .maybeSingle();

  if (existing) return existing as Taller;

  const { data: created, error } = await supabase
    .from("talleres")
    .insert({
      owner_user_id: userId,
      nombre: "Mi Taller",
      codigo_vinculo: generateCodigo(),
    })
    .select("id, nombre, owner_user_id, telegram_chat_id, codigo_vinculo, created_at")
    .single();

  if (error) {
    console.error("Error creando taller:", error.message);
    return null;
  }
  return created as Taller;
}

/** Taller del usuario autenticado. */
export async function getMyTaller(): Promise<Taller | null> {
  const supabase = createClient();
  const { data } = await supabase
    .from("talleres")
    .select("id, nombre, owner_user_id, telegram_chat_id, codigo_vinculo, created_at")
    .maybeSingle();
  return (data as Taller) ?? null;
}

/** Busca taller por chat de Telegram (webhook). */
export async function getTallerByTelegramChat(chatId: number): Promise<Taller | null> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("talleres")
    .select("id, nombre, owner_user_id, telegram_chat_id, codigo_vinculo, created_at")
    .eq("telegram_chat_id", chatId)
    .maybeSingle();
  return (data as Taller) ?? null;
}

/** Vincula Telegram al taller usando código /vincular (webhook). */
export async function vincularTelegramPorCodigo(
  codigo: string,
  chatId: number
): Promise<{ ok: boolean; nombre?: string; error?: string }> {
  const supabase = createAdminClient();
  const codigoNorm = codigo.trim().toUpperCase();

  const { data: taller, error: findError } = await supabase
    .from("talleres")
    .select("id, nombre, telegram_chat_id")
    .eq("codigo_vinculo", codigoNorm)
    .maybeSingle();

  if (findError || !taller) {
    return { ok: false, error: "Código inválido. Revisa el código en tu dashboard." };
  }

  if (taller.telegram_chat_id && taller.telegram_chat_id !== chatId) {
    return { ok: false, error: "Este taller ya está vinculado a otro Telegram." };
  }

  const { data: existingLink } = await supabase
    .from("talleres")
    .select("id")
    .eq("telegram_chat_id", chatId)
    .neq("id", taller.id)
    .maybeSingle();

  if (existingLink) {
    return { ok: false, error: "Este Telegram ya está vinculado a otro taller." };
  }

  const { error: updateError } = await supabase
    .from("talleres")
    .update({
      telegram_chat_id: chatId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", taller.id);

  if (updateError) {
    return { ok: false, error: updateError.message };
  }

  // Asignar datos históricos huérfanos de este chat al taller
  await supabase
    .from("vehiculos")
    .update({ taller_id: taller.id })
    .eq("telegram_chat_id", chatId)
    .is("taller_id", null);

  await supabase
    .from("mantenimientos")
    .update({ taller_id: taller.id })
    .eq("telegram_chat_id", chatId)
    .is("taller_id", null);

  return { ok: true, nombre: taller.nombre };
}

export async function updateTallerNombre(nombre: string): Promise<{ ok: boolean; error?: string }> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "No autenticado" };

  const { error } = await supabase
    .from("talleres")
    .update({ nombre: nombre.trim(), updated_at: new Date().toISOString() })
    .eq("owner_user_id", user.id);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function regenerarCodigoVinculo(): Promise<{ codigo?: string; error?: string }> {
  const supabase = createClient();
  const userId = (await supabase.auth.getUser()).data.user?.id;
  if (!userId) return { error: "No autenticado" };

  const nuevoCodigo = generateCodigo();
  const { error } = await supabase
    .from("talleres")
    .update({ codigo_vinculo: nuevoCodigo, updated_at: new Date().toISOString() })
    .eq("owner_user_id", userId);

  if (error) return { error: error.message };
  return { codigo: nuevoCodigo };
}
