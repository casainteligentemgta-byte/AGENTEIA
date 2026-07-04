"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUser } from "@/lib/supabase/server";

export type SubscriptionActionResult =
  | { success: true }
  | { success: false; error: string };

/**
 * MVP: activación manual de suscripción premium ($2.99/mes).
 * Reemplazar por webhook Stripe/LemonSqueezy en producción.
 */
export async function activarSuscripcionPremiumAction(): Promise<SubscriptionActionResult> {
  const user = await getUser();
  if (!user) {
    return { success: false, error: "Debes iniciar sesión" };
  }

  const vencimiento = new Date();
  vencimiento.setMonth(vencimiento.getMonth() + 1);

  const admin = createAdminClient();
  const { error } = await admin.from("perfiles").upsert(
    {
      id: user.id,
      tipo_plan: "premium",
      suscripcion_activa: true,
      vencimiento_plan: vencimiento.toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" }
  );

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/app");
  revalidatePath("/app/vehiculos/nuevo");

  return { success: true };
}
