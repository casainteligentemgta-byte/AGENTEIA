import { Bike, Building2, Car } from "lucide-react";
import { INDUSTRIA_LABELS } from "@/lib/platform/types";

const industries = [
  {
    key: "concesionario" as const,
    icon: Car,
    highlights: ["Aceite, frenos, neumáticos", "Historial por placa", "Recordatorios automáticos"],
  },
  {
    key: "bicicletas" as const,
    icon: Bike,
    highlights: ["SmartBike + Strava", "Protocolo de cierre", "Alertas de componentes"],
  },
  {
    key: "constructora" as const,
    icon: Building2,
    highlights: ["Tractores y maquinaria", "Horas de motor", "Flota pesada"],
  },
];

export function B2bIndustries() {
  return (
    <section id="industrias" className="border-t border-zinc-800/60 py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mb-16 text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Adaptado a tu industria
          </h2>
          <p className="mt-4 text-zinc-400">
            Elige tu tipo de negocio al configurar el taller y los formularios se ajustan solos.
          </p>
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          {industries.map(({ key, icon: Icon, highlights }) => (
            <article
              key={key}
              className="glass rounded-2xl p-8 transition hover:border-blue-500/30"
            >
              <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600/15 text-blue-400">
                <Icon className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-semibold text-zinc-100">{INDUSTRIA_LABELS[key]}</h3>
              <ul className="mt-4 space-y-2">
                {highlights.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm text-zinc-400">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500" />
                    {item}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
