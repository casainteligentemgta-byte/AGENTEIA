import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripeClient } from "@/lib/stripe/client";
import { getStripeWebhookSecret } from "@/lib/stripe/config";
import {
  desactivarPremium,
  syncPerfilFromSubscription,
} from "@/lib/stripe/sync-subscription";

export const runtime = "nodejs";

async function resolveUserIdFromSubscription(
  subscription: Stripe.Subscription
): Promise<string | null> {
  if (subscription.metadata?.supabase_user_id) {
    return subscription.metadata.supabase_user_id;
  }

  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer?.id;

  if (!customerId) return null;

  const stripe = getStripeClient();
  const customer = await stripe.customers.retrieve(customerId);
  if (customer.deleted) return null;

  return customer.metadata?.supabase_user_id ?? null;
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session): Promise<void> {
  const userId = session.metadata?.supabase_user_id ?? session.client_reference_id;
  if (!userId) {
    console.warn("Stripe checkout.session.completed sin userId");
    return;
  }

  const stripe = getStripeClient();
  const subscriptionId =
    typeof session.subscription === "string" ? session.subscription : session.subscription?.id;

  if (subscriptionId) {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    const result = await syncPerfilFromSubscription({
      userId,
      subscription,
      customerId:
        typeof session.customer === "string" ? session.customer : session.customer?.id,
    });
    if (!result.ok) {
      throw new Error(result.error);
    }
    return;
  }

  // Fallback: pago único o sesión sin subscription object aún
  const vencimiento = new Date();
  vencimiento.setMonth(vencimiento.getMonth() + 1);
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const admin = createAdminClient();
  const { error } = await admin.from("perfiles").upsert(
    {
      id: userId,
      tipo_plan: "premium",
      suscripcion_activa: true,
      vencimiento_plan: vencimiento.toISOString(),
      stripe_customer_id:
        typeof session.customer === "string" ? session.customer : session.customer?.id ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" }
  );
  if (error) throw new Error(error.message);
}

async function handleSubscriptionChange(subscription: Stripe.Subscription): Promise<void> {
  const userId = await resolveUserIdFromSubscription(subscription);
  if (!userId) {
    console.warn("Stripe subscription sin supabase_user_id:", subscription.id);
    return;
  }

  if (subscription.status === "canceled" || subscription.status === "unpaid") {
    const result = await desactivarPremium(userId);
    if (!result.ok) throw new Error(result.error);
    return;
  }

  const result = await syncPerfilFromSubscription({ userId, subscription });
  if (!result.ok) throw new Error(result.error);
}

export async function POST(req: Request) {
  const body = await req.text();
  const signature = req.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Firma ausente" }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = getStripeClient().webhooks.constructEvent(
      body,
      signature,
      getStripeWebhookSecret()
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Firma inválida";
    console.error("Stripe webhook:", message);
    return NextResponse.json({ error: message }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;

      case "customer.subscription.created":
      case "customer.subscription.updated":
        await handleSubscriptionChange(event.data.object as Stripe.Subscription);
        break;

      case "customer.subscription.deleted":
        {
          const subscription = event.data.object as Stripe.Subscription;
          const userId = await resolveUserIdFromSubscription(subscription);
          if (userId) {
            const result = await desactivarPremium(userId);
            if (!result.ok) throw new Error(result.error);
          }
        }
        break;

      case "invoice.payment_failed":
        {
          const invoice = event.data.object as Stripe.Invoice;
          const subId =
            typeof invoice.subscription === "string"
              ? invoice.subscription
              : invoice.subscription?.id;
          if (subId) {
            const subscription = await getStripeClient().subscriptions.retrieve(subId);
            await handleSubscriptionChange(subscription);
          }
        }
        break;

      default:
        break;
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error interno";
    console.error("Stripe webhook handler:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
