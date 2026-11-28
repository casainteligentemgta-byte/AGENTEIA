"use server";

import type Stripe from "stripe";
import { getUser } from "@/lib/supabase/server";
import { getOrEnsurePerfil } from "@/lib/data/perfil";
import { getStripeClient } from "@/lib/stripe/client";
import {
  getAppBaseUrl,
  getStripePriceId,
  isStripeConfigured,
} from "@/lib/stripe/config";

export type SubscriptionActionResult =
  | { success: true; checkoutUrl?: string; portalUrl?: string }
  | { success: false; error: string };

export async function activarSuscripcionPremiumAction(): Promise<SubscriptionActionResult> {
  const user = await getUser();
  if (!user) {
    return { success: false, error: "Debes iniciar sesión" };
  }

  if (isStripeConfigured()) {
    try {
      const stripe = getStripeClient();
      const baseUrl = getAppBaseUrl();
      const perfil = await getOrEnsurePerfil();

      const sessionParams: Stripe.Checkout.SessionCreateParams = {
        mode: "subscription",
        payment_method_types: ["card"],
        line_items: [{ price: getStripePriceId(), quantity: 1 }],
        success_url: `${baseUrl}/app?subscribed=1`,
        cancel_url: `${baseUrl}/app?subscribed=0`,
        client_reference_id: user.id,
        locale: "es",
        metadata: { supabase_user_id: user.id },
        subscription_data: {
          metadata: { supabase_user_id: user.id },
        },
        customer_email: user.email ?? undefined,
      };

      if (perfil?.stripe_customer_id) {
        sessionParams.customer = perfil.stripe_customer_id;
        delete sessionParams.customer_email;
      }

      const session = await stripe.checkout.sessions.create(sessionParams);

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

  return {
    success: false,
    error:
      "El pago es por Pago Móvil. Reporta tu transferencia desde la pantalla de suscripción; un administrador la confirmará.",
  };
}

/** Portal de Stripe para gestionar/cancelar suscripción */
export async function abrirPortalFacturacionAction(): Promise<SubscriptionActionResult> {
  const user = await getUser();
  if (!user) {
    return { success: false, error: "Debes iniciar sesión" };
  }

  if (!isStripeConfigured()) {
    return { success: false, error: "Stripe no está configurado" };
  }

  const perfil = await getOrEnsurePerfil();
  if (!perfil?.stripe_customer_id) {
    return { success: false, error: "No tienes una suscripción de pago activa en Stripe" };
  }

  try {
    const stripe = getStripeClient();
    const session = await stripe.billingPortal.sessions.create({
      customer: perfil.stripe_customer_id,
      return_url: `${getAppBaseUrl()}/app`,
    });

    if (!session.url) {
      return { success: false, error: "No se pudo abrir el portal de facturación" };
    }

    return { success: true, portalUrl: session.url };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error con Stripe";
    console.error("Stripe portal:", message);
    return { success: false, error: message };
  }
}
