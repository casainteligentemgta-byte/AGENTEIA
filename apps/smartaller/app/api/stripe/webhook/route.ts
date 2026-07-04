import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripeClient } from "@/lib/stripe/client";
import { getStripeWebhookSecret } from "@/lib/stripe/config";

export const runtime = "nodejs";

function activarPremium(userId: string, vencimiento: Date) {
  const admin = createAdminClient();
  return admin.from("perfiles").upsert(
    {
      id: userId,
      tipo_plan: "premium",
      suscripcion_activa: true,
      vencimiento_plan: vencimiento.toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" }
  );
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
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.supabase_user_id;
      if (userId) {
        const vencimiento = new Date();
        vencimiento.setMonth(vencimiento.getMonth() + 1);
        const { error } = await activarPremium(userId, vencimiento);
        if (error) {
          console.error("Stripe webhook activar premium:", error.message);
          return NextResponse.json({ error: error.message }, { status: 500 });
        }
      }
    }

    if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
      const subscription = event.data.object as Stripe.Subscription;
      const userId = subscription.metadata?.supabase_user_id;
      if (userId) {
        const activa =
          event.type !== "customer.subscription.deleted" &&
          (subscription.status === "active" || subscription.status === "trialing");

        const vencimiento = subscription.current_period_end
          ? new Date(subscription.current_period_end * 1000)
          : new Date();

        const admin = createAdminClient();
        const { error } = await admin.from("perfiles").upsert(
          {
            id: userId,
            tipo_plan: activa ? "premium" : "free",
            suscripcion_activa: activa,
            vencimiento_plan: activa ? vencimiento.toISOString() : null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "id" }
        );

        if (error) {
          console.error("Stripe webhook subscription:", error.message);
          return NextResponse.json({ error: error.message }, { status: 500 });
        }
      }
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error interno";
    console.error("Stripe webhook handler:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
