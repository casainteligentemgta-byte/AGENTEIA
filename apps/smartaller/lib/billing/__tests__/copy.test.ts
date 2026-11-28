import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");

function read(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}

describe("copy de pagos", () => {
  it("el paywall ya no habla de Stripe ni de modo demo", () => {
    const paywall = read("components/app/paywall-screen.tsx");
    const form = read("components/pagos/reporte-pago-form.tsx");
    const joined = `${paywall}\n${form}`;
    assert.doesNotMatch(joined, /Stripe Checkout/i);
    assert.doesNotMatch(joined, /Modo demo/i);
    assert.doesNotMatch(joined, /próximamente/i);
    assert.match(form, /Pago Móvil/);
  });

  it("el FAQ de talleres explica Pago Móvil y precios", () => {
    const faq = read("components/landing/b2b-faq.tsx");
    assert.doesNotMatch(faq, /Stripe/);
    assert.doesNotMatch(faq, /próximamente/);
    assert.match(faq, /Pago Móvil/);
    assert.match(faq, /2\.99/);
    assert.match(faq, /100/);
  });
});
