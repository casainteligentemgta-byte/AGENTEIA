import Link from "next/link";
import { ArrowRight, Camera, MessageCircle, Sparkles } from "lucide-react";

export function Hero() {
  return (
    <section className="relative overflow-hidden pt-32 pb-20 sm:pt-40 sm:pb-28">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-900/20 via-zinc-950 to-zinc-950" />
      <div className="pointer-events-none absolute -top-24 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-blue-600/10 blur-3xl" />

      <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mx-auto max-w-3xl text-center animate-fade-in">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-blue-500/30 bg-blue-500/10 px-4 py-1.5 text-sm text-blue-300">
            <Sparkles className="h-4 w-4" />
            IA + Telegram para talleres mecánicos
          </div>
          <h1 className="text-4xl font-bold tracking-tight sm:text-6xl lg:text-7xl">
            Tu taller,{" "}
            <span className="gradient-text">inteligente</span>
          </h1>
          <p className="mt-6 text-lg text-zinc-400 sm:text-xl">
            El mecánico envía una foto de la factura por Telegram. SmartTaller extrae los datos,
            registra el mantenimiento y programa el próximo servicio automáticamente.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              href="/login?redirectTo=/dashboard"
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-base font-medium text-white shadow-lg shadow-blue-600/25 transition hover:bg-blue-500"
            >
              Panel del taller
              <ArrowRight className="h-5 w-5" />
            </Link>
            <Link
              href="/login?redirectTo=/app"
              className="inline-flex items-center gap-2 rounded-xl border border-blue-500/40 bg-blue-500/10 px-6 py-3 text-base font-medium text-blue-200 transition hover:border-blue-400 hover:bg-blue-500/20"
            >
              App para dueños
            </Link>
            <a
              href="#como-funciona"
              className="inline-flex items-center gap-2 rounded-xl border border-zinc-700 px-6 py-3 text-base text-zinc-300 transition hover:border-zinc-500 hover:text-white"
            >
              Cómo funciona
            </a>
          </div>
        </div>

        <div className="mx-auto mt-16 grid max-w-4xl gap-4 sm:grid-cols-3 animate-slide-up">
          {[
            { icon: Camera, label: "Foto por Telegram", desc: "Sin apps extra" },
            { icon: Sparkles, label: "IA lee la factura", desc: "GPT-4o mini" },
            { icon: MessageCircle, label: "WhatsApp al cliente", desc: "Fidelización" },
          ].map(({ icon: Icon, label, desc }) => (
            <div key={label} className="glass rounded-2xl p-5 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-800 text-blue-400">
                <Icon className="h-6 w-6" />
              </div>
              <p className="font-medium text-zinc-100">{label}</p>
              <p className="mt-1 text-sm text-zinc-500">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
