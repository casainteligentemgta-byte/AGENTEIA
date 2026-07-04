"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUser } from "@/lib/supabase/server";
import { getStripeClient } from "@/lib/stripe/client";
import {
  getAppBaseUrl,
  getStripePriceId,
  isStripeConfigured,
} from "@/lib/stripe/config";

export type SubscriptionActionResult =
  | { success: true; checkoutUrl?: string }
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

  if (isStripeConfigured()) {
    try {
      const stripe = getStripeClient();
      const baseUrl = getAppBaseUrl();

      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        payment_method_types: ["card"],
        line_items: [{ price: getStripePriceId(), quantity: 1 }],
        success_url: `${baseUrl}/app?subscribed=1`,
        cancel_url: `${baseUrl}/app?subscribed=0`,
        client_reference_id: user.id,
        metadata: { supabase_user_id: user.id },
        subscription_data: {
          metadata: { supabase_user_id: user.id },
        },
        customer_email: user.email ?? undefined,
      });

      if (!session.url) {
        return { success: false, error: "No se pudo crear la sesión de pago" };
      }

      return { success: true, checkoutUrl: session.url };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error con Stripe";
      console.error("Stripe checkout:", message);
      return { success: false, error: message };
    }
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
