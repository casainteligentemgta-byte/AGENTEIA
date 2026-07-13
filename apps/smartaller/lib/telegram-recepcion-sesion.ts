import { createAdminClient } from "@/lib/supabase/admin";

const TTL_MS = 2 * 60 * 60 * 1000;

export type TelegramRecepcionSesion = {
  token: string;
  vehiculoId: string;
  tallerId: string;
  frontalUrl: string;
  frontalPath: string;
  placa: string;
};

export async function crearTelegramRecepcionSesion(params: {
  vehiculoId: string;
  tallerId: string;
  frontalUrl: string;
  frontalPath: string;
  placa: string;
}): Promise<string> {
  const supabase = createAdminClient();
  const expiresAt = new Date(Date.now() + TTL_MS).toISOString();

  const { data, error } = await supabase
    .from("telegram_recepcion_sesiones")
    .insert({
      vehiculo_id: params.vehiculoId,
      taller_id: params.tallerId,
      frontal_url: params.frontalUrl,
      frontal_path: params.frontalPath,
      placa: params.placa,
      expires_at: expiresAt,
    })
    .select("token")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "No se pudo crear la sesión de recepción");
  }

  return data.token as string;
}

export async function obtenerTelegramRecepcionSesion(
  token: string,
  vehiculoId: string
): Promise<TelegramRecepcionSesion | null> {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("telegram_recepcion_sesiones")
      .select("token, vehiculo_id, taller_id, frontal_url, frontal_path, placa, expires_at")
      .eq("token", token)
      .eq("vehiculo_id", vehiculoId)
      .maybeSingle();

    if (error || !data) return null;

    if (new Date(data.expires_at).getTime() < Date.now()) {
      return null;
    }

    return {
      token: data.token,
      vehiculoId: data.vehiculo_id,
      tallerId: data.taller_id,
      frontalUrl: data.frontal_url,
      frontalPath: data.frontal_path,
      placa: data.placa,
    };
  } catch (err) {
    console.error(
      "obtenerTelegramRecepcionSesion:",
      err instanceof Error ? err.message : err
    );
    return null;
  }
}
