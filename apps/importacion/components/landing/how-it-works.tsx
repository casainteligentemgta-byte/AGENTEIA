import { Bell, Camera, Cloud, Zap } from "lucide-react";

const steps = [
  {
    step: "01",
    icon: Camera,
    title: "Foto y listo",
    desc: "Al llegar el vehículo, el mecánico solo le toma una foto a la placa. El sistema la procesa al instante y precarga el formato de recepción digital. Sin procesos tediosos ni equipos lentos.",
  },
  {
    step: "02",
    icon: Zap,
    title: "Reconocimiento al instante",
    desc: "SmartTaller entra en acción: la IA lee la placa en segundos, identifica el vehículo y extrae los datos clave. Adiós al registro manual y a los errores de dedo.",
  },
  {
    step: "03",
    icon: Cloud,
    title: "Todo bajo control en la nube",
    desc: "Cero papeles perdidos. Historial del vehículo, mantenimientos y costos se guardan de forma segura en Supabase. Información en tiempo real, siempre disponible para tu equipo.",
  },
  {
    step: "04",
    icon: Bell,
    title: "El taller que piensa por el cliente",
    desc: "El sistema calcula el próximo mantenimiento (a los 6 meses o por kilometraje) y envía un recordatorio automatizado al cliente por WhatsApp cuando se acerque la fecha.",
  },
];

export function HowItWorks() {
  return (
    <section id="como-funciona" className="border-t border-zinc-800/60 py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mb-16 text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Cómo funciona</h2>
          <p className="mt-4 text-zinc-400">De la foto de la placa al recordatorio al cliente</p>
        </div>
        <div className="grid gap-6 sm:grid-cols-2">
          {steps.map(({ step, icon: Icon, title, desc }) => (
            <div key={step} className="glass group rounded-2xl p-6 transition hover:border-blue-500/30">
              <span className="text-xs font-mono text-blue-400">{step}</span>
              <div className="mt-4 mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-zinc-800 text-zinc-300 transition group-hover:bg-blue-600/20 group-hover:text-blue-400">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="font-semibold text-zinc-100">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-zinc-500">{desc}</p>
            </div>
          ))}
        </div>

        <div className="glass mx-auto mt-12 max-w-3xl rounded-2xl border-blue-500/20 p-8 text-center">
          <h3 className="text-lg font-semibold text-zinc-100">
            ¿Por qué cambia el juego con SmartTaller?
          </h3>
          <p className="mt-3 text-sm leading-relaxed text-zinc-400 sm:text-base">
            Porque transformamos el papeleo lento en un proceso automatizado de segundos. Conectamos
            la practicidad de Telegram, la precisión de la IA y el alcance de WhatsApp para que tu
            taller rinda más y tus clientes siempre vuelvan.
          </p>
        </div>
      </div>
    </section>
  );
}
