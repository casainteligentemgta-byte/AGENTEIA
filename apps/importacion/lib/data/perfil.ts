import { createClient } from "@/lib/supabase/server";
import type { PerfilUsuario } from "@/lib/platform/types";

export async function getOrEnsurePerfil(): Promise<PerfilUsuario | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: existing } = await supabase
    .from("perfiles")
    .select(
      "id, tipo_plan, suscripcion_activa, vencimiento_plan, stripe_customer_id, stripe_subscription_id, created_at, updated_at"
    )
    .eq("id", user.id)
    .maybeSingle();

  if (existing) {
    return existing as PerfilUsuario;
  }

  const { data: created, error } = await supabase
    .from("perfiles")
    .insert({ id: user.id })
    .select(
      "id, tipo_plan, suscripcion_activa, vencimiento_plan, stripe_customer_id, stripe_subscription_id, created_at, updated_at"
    )
    .single();

  if (error) {
    console.error("getOrEnsurePerfil insert:", error.message);
    return {
      id: user.id,
      tipo_plan: "free",
      suscripcion_activa: false,
      vencimiento_plan: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }

  return created as PerfilUsuario;
}

export async function usuarioTieneVehiculoTaller(): Promise<boolean> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return false;

  const { count, error } = await supabase
    .from("vehiculos")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .not("taller_id", "is", null);

  if (error) {
    console.error("usuarioTieneVehiculoTaller:", error.message);
    return false;
  }

  return (count ?? 0) > 0;
}

export function perfilSuscripcionVigente(perfil: PerfilUsuario): boolean {
  if (!perfil.suscripcion_activa) return false;
  if (!perfil.vencimiento_plan) return true;
  return new Date(perfil.vencimiento_plan) > new Date();
}
