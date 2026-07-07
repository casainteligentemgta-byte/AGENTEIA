import { Bot, Database, Bell, Zap } from "lucide-react";

const steps = [
  {
    step: "01",
    icon: Bot,
    title: "Envía la factura",
    desc: "El mecánico manda una foto al bot de Telegram desde el taller.",
  },
  {
    step: "02",
    icon: Zap,
    title: "IA extrae los datos",
    desc: "Placa, kilometraje, servicio y costo se leen automáticamente.",
  },
  {
    step: "03",
    icon: Database,
    title: "Todo queda registrado",
    desc: "Vehículo, mantenimiento y recordatorio se guardan en Supabase.",
  },
  {
    step: "04",
    icon: Bell,
    title: "Próximo servicio",
    desc: "Se programa +6 meses y se notifica al cliente por WhatsApp.",
  },
];

export function HowItWorks() {
  return (
    <section id="como-funciona" className="border-t border-zinc-800/60 py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mb-16 text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Cómo funciona</h2>
          <p className="mt-4 text-zinc-400">De la foto al registro en segundos</p>
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map(({ step, icon: Icon, title, desc }) => (
            <div key={step} className="glass group rounded-2xl p-6 transition hover:border-brand-500/30">
              <span className="text-xs font-mono text-brand-400">{step}</span>
              <div className="mt-4 mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-zinc-800 text-zinc-300 transition group-hover:bg-brand-600/20 group-hover:text-brand-400">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="font-semibold text-zinc-100">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-zinc-500">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
