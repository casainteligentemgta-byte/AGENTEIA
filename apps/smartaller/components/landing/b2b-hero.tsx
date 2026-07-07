import Link from "next/link";
import { ArrowRight, Camera, LayoutDashboard, Sparkles } from "lucide-react";

export function B2bHero() {
  return (
    <section className="relative overflow-hidden pt-32 pb-20 sm:pt-40 sm:pb-28">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-900/25 via-zinc-950 to-zinc-950" />
      <div className="pointer-events-none absolute -top-24 right-0 h-[28rem] w-[28rem] rounded-full bg-blue-600/10 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 left-0 h-64 w-64 rounded-full bg-cyan-500/5 blur-3xl" />

      <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <div className="animate-fade-in">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-blue-500/30 bg-blue-500/10 px-4 py-1.5 text-sm text-blue-300">
              <Sparkles className="h-4 w-4" />
              Plataforma B2B para talleres y tiendas
            </div>
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
              Digitaliza tu taller sin cambiar cómo{" "}
              <span className="gradient-text">trabajas</span>
            </h1>
            <p className="mt-6 text-lg leading-relaxed text-zinc-400">
              El mecánico sigue enviando la factura por Telegram. SmartTaller registra la orden,
              actualiza la flota, avisa al cliente y deja todo visible en tu dashboard — auto, moto,
              bici o maquinaria.
            </p>
            <div className="mt-10 flex flex-col gap-4 sm:flex-row">
              <Link
                href="/login?redirectTo=/dashboard"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-3.5 text-base font-medium text-white shadow-lg shadow-blue-600/25 transition hover:bg-blue-500"
              >
                Crear cuenta de taller
                <ArrowRight className="h-5 w-5" />
              </Link>
              <a
                href="#funciones"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-700 px-6 py-3.5 text-base text-zinc-300 transition hover:border-zinc-500 hover:text-white"
              >
                Ver funciones
              </a>
            </div>
            <p className="mt-4 text-sm text-zinc-500">
              Gratis para empezar · Sin tarjeta · Listo en minutos
            </p>
          </div>

          <div className="relative animate-slide-up">
            <div className="glass rounded-3xl p-6 sm:p-8">
              <div className="mb-6 flex items-center justify-between">
                <span className="text-sm font-medium text-zinc-400">Panel del taller</span>
                <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-semibold text-emerald-400">
                  En vivo
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "Vehículos", value: "128", sub: "en flota" },
                  { label: "OS este mes", value: "47", sub: "+12% vs anterior" },
                  { label: "Recordatorios", value: "23", sub: "próximos 30 días" },
                  { label: "Ingresos", value: "$4.2M", sub: "estimado mes" },
                ].map((stat) => (
                  <div
                    key={stat.label}
                    className="rounded-2xl border border-zinc-800/80 bg-zinc-900/50 p-4"
                  >
                    <p className="text-xs text-zinc-500">{stat.label}</p>
                    <p className="mt-1 text-2xl font-bold text-zinc-100">{stat.value}</p>
                    <p className="mt-0.5 text-[11px] text-zinc-600">{stat.sub}</p>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex items-center gap-3 rounded-2xl border border-blue-500/20 bg-blue-950/30 p-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600/20 text-blue-400">
                  <Camera className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-zinc-200">
                    Nueva OS · ABC-123 · Cambio de aceite
                  </p>
                  <p className="text-xs text-zinc-500">Registrada desde Telegram hace 2 min</p>
                </div>
              </div>
            </div>
            <div className="absolute -bottom-4 -left-4 hidden rounded-2xl border border-zinc-800 bg-zinc-900 px-4 py-3 shadow-xl sm:block">
              <div className="flex items-center gap-2 text-sm text-zinc-300">
                <LayoutDashboard className="h-4 w-4 text-blue-400" />
                Dashboard + app cliente sincronizados
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
