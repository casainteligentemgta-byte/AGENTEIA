import Stripe from "stripe";
import { getStripeSecretKey } from "@/lib/stripe/config";

let stripeClient: Stripe | null = null;

export function getStripeClient(): Stripe {
  if (!stripeClient) {
    stripeClient = new Stripe(getStripeSecretKey(), {
      apiVersion: "2025-02-24.acacia",
    });
  }
  return stripeClient;
}
