import Link from "next/link";
import { ArrowRight, MessageCircle } from "lucide-react";

export function B2bCta() {
  return (
    <section className="py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="relative overflow-hidden rounded-3xl border border-blue-500/20 bg-gradient-to-br from-blue-950/50 to-zinc-900 p-10 sm:p-16">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_70%_30%,_rgba(59,130,246,0.2),_transparent_55%)]" />
          <div className="relative grid items-center gap-10 lg:grid-cols-2">
            <div>
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                Tu primer mantenimiento registrado hoy
              </h2>
              <p className="mt-4 text-zinc-400">
                Crea tu cuenta, conecta Telegram y envía una foto de factura. Verás la orden en el
                dashboard al instante.
              </p>
              <ol className="mt-6 space-y-3 text-sm text-zinc-400">
                <li className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-600/20 text-xs font-bold text-blue-300">
                    1
                  </span>
                  Regístrate como taller (gratis)
                </li>
                <li className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-600/20 text-xs font-bold text-blue-300">
                    2
                  </span>
                  Configura nombre e industria en el panel
                </li>
                <li className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-600/20 text-xs font-bold text-blue-300">
                    3
                  </span>
                  Vincula Telegram y envía la primera factura
                </li>
              </ol>
            </div>
            <div className="flex flex-col items-center gap-4 lg:items-end">
              <Link
                href="/login?redirectTo=/dashboard"
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-white px-8 py-4 text-base font-semibold text-zinc-900 transition hover:bg-zinc-100 sm:w-auto"
              >
                Empezar gratis
                <ArrowRight className="h-5 w-5" />
              </Link>
              <Link
                href="/login?redirectTo=/dashboard"
                className="inline-flex items-center gap-2 text-sm text-zinc-400 transition hover:text-zinc-200"
              >
                <MessageCircle className="h-4 w-4" />
                Ya tengo cuenta — iniciar sesión
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
