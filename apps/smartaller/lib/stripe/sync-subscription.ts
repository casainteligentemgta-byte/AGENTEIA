import type Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import type { TipoPlan } from "@/lib/platform/types";

const ESTADOS_ACTIVOS = new Set<Stripe.Subscription.Status>(["active", "trialing"]);

export type SyncPerfilResult = { ok: true } | { ok: false; error: string };

export function subscriptionEstaActiva(subscription: Stripe.Subscription): boolean {
  return ESTADOS_ACTIVOS.has(subscription.status);
}

export function vencimientoDesdeSubscription(subscription: Stripe.Subscription): Date {
  return new Date(subscription.current_period_end * 1000);
}

export async function syncPerfilFromSubscription(params: {
  userId: string;
  subscription: Stripe.Subscription;
  customerId?: string | null;
}): Promise<SyncPerfilResult> {
  const { userId, subscription, customerId } = params;
  const activa = subscriptionEstaActiva(subscription);
  const customer =
    typeof customerId === "string"
      ? customerId
      : typeof subscription.customer === "string"
        ? subscription.customer
        : subscription.customer?.id ?? null;

  const admin = createAdminClient();
  const { error } = await admin.from("perfiles").upsert(
    {
      id: userId,
      tipo_plan: (activa ? "premium" : "free") satisfies TipoPlan,
      suscripcion_activa: activa,
      vencimiento_plan: activa ? vencimientoDesdeSubscription(subscription).toISOString() : null,
      stripe_customer_id: customer,
      stripe_subscription_id: subscription.id,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" }
  );

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true };
}

export async function desactivarPremium(userId: string): Promise<SyncPerfilResult> {
  const admin = createAdminClient();
  const { error } = await admin
    .from("perfiles")
    .update({
      tipo_plan: "free",
      suscripcion_activa: false,
      vencimiento_plan: null,
      stripe_subscription_id: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId);

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true };
}
