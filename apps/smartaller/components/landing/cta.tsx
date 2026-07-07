import Link from "next/link";
import { ArrowRight } from "lucide-react";

export function CTA() {
  return (
    <section className="py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="relative overflow-hidden rounded-3xl border border-brand-500/20 bg-gradient-to-br from-brand-950/50 to-zinc-900 p-10 sm:p-16 text-center">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,_rgba(59,130,246,0.15),_transparent_50%)]" />
          <div className="relative">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Empieza a digitalizar tu taller hoy
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-zinc-400">
              Conecta Telegram, envía la primera factura y mira cómo aparece en tu dashboard.
            </p>
            <Link
              href="/login"
              className="mt-8 inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3 text-base font-medium text-zinc-900 transition hover:bg-zinc-100"
            >
              Crear cuenta gratis
              <ArrowRight className="h-5 w-5" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
