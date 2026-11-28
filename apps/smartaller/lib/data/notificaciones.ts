import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/supabase/server";
import { isBillingSchemaMissing } from "@/lib/billing/schema";

export type NotificacionUsuario = {
  id: string;
  created_at: string;
  user_id: string;
  tipo: string;
  titulo: string;
  cuerpo: string;
  leida: boolean;
};

export async function getNotificacionesUsuario(
  limite = 8
): Promise<NotificacionUsuario[]> {
  const user = await getUser();
  if (!user) return [];
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("notificaciones_usuario")
      .select("id, created_at, user_id, tipo, titulo, cuerpo, leida")
      .eq("user_id", user.id)
      .eq("leida", false)
      .order("created_at", { ascending: false })
      .limit(limite);
    if (error) {
      if (!isBillingSchemaMissing(error)) {
        console.error("getNotificacionesUsuario:", error.message);
      }
      return [];
    }
    return (data ?? []) as NotificacionUsuario[];
  } catch {
    return [];
  }
}

export async function crearNotificacionUsuario(params: {
  userId: string;
  titulo: string;
  cuerpo: string;
  tipo?: string;
}): Promise<boolean> {
  try {
    const admin = createAdminClient();
    const { error } = await admin.from("notificaciones_usuario").insert({
      user_id: params.userId,
      titulo: params.titulo,
      cuerpo: params.cuerpo,
      tipo: params.tipo ?? "suscripcion",
    });
    if (error) {
      if (!isBillingSchemaMissing(error)) {
        console.error("crearNotificacionUsuario:", error.message);
      }
      return false;
    }
    return true;
  } catch {
    return false;
  }
}
