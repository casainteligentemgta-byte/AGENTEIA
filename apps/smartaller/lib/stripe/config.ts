export function isStripeConfigured(): boolean {
  return Boolean(
    process.env.STRIPE_SECRET_KEY?.trim() &&
      process.env.STRIPE_PRICE_ID?.trim() &&
      process.env.NEXT_PUBLIC_APP_URL?.trim()
  );
}

export function getStripeSecretKey(): string {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) {
    throw new Error("Falta STRIPE_SECRET_KEY");
  }
  return key;
}

export function getStripePriceId(): string {
  const id = process.env.STRIPE_PRICE_ID?.trim();
  if (!id) {
    throw new Error("Falta STRIPE_PRICE_ID");
  }
  return id;
}

export function getStripeWebhookSecret(): string {
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!secret) {
    throw new Error("Falta STRIPE_WEBHOOK_SECRET");
  }
  return secret;
}

export { getAppBaseUrl } from "@/lib/app-url";
