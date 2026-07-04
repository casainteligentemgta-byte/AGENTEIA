import { createAdminClient } from "@/lib/supabase/admin";
import { getUser } from "@/lib/supabase/server";
import { parseTallerNombre } from "@/lib/validations/taller";

import type { TipoIndustria } from "@/lib/platform/types";

export type Taller = {
  id: string;
  nombre: string;
  owner_user_id: string;
  telegram_chat_id: number | null;
  codigo_vinculo: string;
  tipo_industria?: TipoIndustria;
  created_at: string;
};

export type TallerResult = {
  taller: Taller | null;
  error?: string;
};

function generateCodigo(): string {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase();
}

const TALLER_SELECT =
  "id, nombre, owner_user_id, telegram_chat_id, codigo_vinculo, tipo_industria, created_at";

function mapTallerError(error: { message: string; code?: string }): string {
  if (error.code === "42P01" || /relation.*talleres.*does not exist/i.test(error.message)) {
    return "Falta la tabla talleres en Supabase. Ejecuta la migración multi-taller en SQL Editor.";
  }
  if (
    error.code === "23502" ||
    /telegram_chat_id.*not-null|null value in column "telegram_chat_id"/i.test(error.message)
  ) {
    return "La columna telegram_chat_id en talleres tiene NOT NULL incorrecto. Ejecuta en Supabase SQL Editor: alter table public.talleres alter column telegram_chat_id drop not null;";
  }
  if (error.code === "23503") {
    return "Tu usuario de auth no está sincronizado. Cierra sesión, vuelve a entrar e intenta de nuevo.";
  }
  if (/ByteString|character at index/i.test(error.message)) {
    return "SUPABASE_SERVICE_ROLE_KEY tiene caracteres inválidos (• viñeta u otros). En Vercel, bórrala y pégala de nuevo desde Supabase → Settings → API → service_role.";
  }
  return error.message;
}

/** Obtiene o crea el taller del usuario autenticado (dashboard). Usa service role tras validar sesión. */
export async function ensureTallerForUser(userId: string): Promise<TallerResult> {
  if (!userId) {
    return { taller: null, error: "Usuario no autenticado" };
  }

  try {
    const supabase = createAdminClient();

    const { data: existing, error: findError } = await supabase
      .from("talleres")
      .select(TALLER_SELECT)
      .eq("owner_user_id", userId)
      .maybeSingle();

    if (findError) {
      return { taller: null, error: mapTallerError(findError) };
    }

    if (existing) {
      if (!existing.codigo_vinculo) {
        const codigo = generateCodigo();
        const { data: fixed, error: fixError } = await supabase
          .from("talleres")
          .update({ codigo_vinculo: codigo, updated_at: new Date().toISOString() })
          .eq("id", existing.id)
          .select(TALLER_SELECT)
          .single();

        if (fixError) {
          return { taller: null, error: mapTallerError(fixError) };
        }
        return { taller: fixed as Taller };
      }
      return { taller: existing as Taller };
    }

    const codigo = generateCodigo();
    const { data: created, error: createError } = await supabase
      .from("talleres")
      .insert({
        owner_user_id: userId,
        nombre: "Mi Taller",
        codigo_vinculo: codigo,
      })
      .select(TALLER_SELECT)
      .single();

    if (createError) {
      return { taller: null, error: mapTallerError(createError) };
    }

    return { taller: created as Taller };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    if (/ByteString|character at index/i.test(message)) {
      return {
        taller: null,
        error:
          "SUPABASE_SERVICE_ROLE_KEY tiene caracteres inválidos (• viñeta u otros). En Vercel → Settings → Environment Variables: bórrala y pégala de nuevo desde Supabase → Settings → API → service_role (debe empezar por eyJ).",
      };
    }
    return { taller: null, error: message };
  }
}

/** Taller del usuario autenticado. */
export async function getMyTaller(): Promise<Taller | null> {
  const user = await getUser();
  if (!user) return null;

  const { taller } = await ensureTallerForUser(user.id);
  return taller;
}

/** Busca taller por chat de Telegram (webhook). */
export async function getTallerByTelegramChat(chatId: number): Promise<Taller | null> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("talleres")
    .select(TALLER_SELECT)
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
  const user = await getUser();
  if (!user) return { ok: false, error: "No autenticado" };

  const parsed = parseTallerNombre(nombre);
  if (!parsed.ok) return { ok: false, error: parsed.error };

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("talleres")
    .update({ nombre: parsed.nombre, updated_at: new Date().toISOString() })
    .eq("owner_user_id", user.id);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function updateTallerTipoIndustria(
  tipoIndustria: TipoIndustria
): Promise<{ ok: boolean; error?: string }> {
  const user = await getUser();
  if (!user) return { ok: false, error: "No autenticado" };

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("talleres")
    .update({ tipo_industria: tipoIndustria, updated_at: new Date().toISOString() })
    .eq("owner_user_id", user.id);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function regenerarCodigoVinculo(): Promise<{ codigo?: string; error?: string }> {
  const user = await getUser();
  if (!user) return { error: "No autenticado" };

  const nuevoCodigo = generateCodigo();
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("talleres")
    .update({ codigo_vinculo: nuevoCodigo, updated_at: new Date().toISOString() })
    .eq("owner_user_id", user.id);

  if (error) return { error: error.message };
  return { codigo: nuevoCodigo };
}
