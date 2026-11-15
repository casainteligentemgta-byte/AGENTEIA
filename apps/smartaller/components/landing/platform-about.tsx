import { BarChart3, ClipboardList, TrendingUp, Users } from "lucide-react";
import { getBrand } from "@/lib/brand";

const highlights = [
  {
    icon: Users,
    title: "Tu taller y tus clientes",
    desc: "Gestión interna del negocio y transparencia para quien confía en ti.",
  },
  {
    icon: ClipboardList,
    title: "Operación centralizada",
    desc: "Recepción, órdenes de servicio, repuestos y facturación en un solo lugar.",
  },
  {
    icon: BarChart3,
    title: "Equipo al día",
    desc: "Personal técnico y administrativo registra cada avance con exactitud y orden.",
  },
  {
    icon: TrendingUp,
    title: "Crecimiento continuo",
    desc: "Optimiza tiempos, productividad e ingresos mientras mejoras el servicio.",
  },
];

const paragraphs = [
  getBrand().copy.landing.aboutP1,
  "Nuestra plataforma centraliza toda la operación en un solo lugar: desde la recepción del vehículo, datos técnicos e inventario de repuestos, hasta el historial detallado de órdenes de servicio, reparaciones y facturación. El personal técnico y administrativo se encarga de registrar cada avance en el sistema, asegurando exactitud, orden y un seguimiento profesional de cada vehículo en el taller.",
  "Lo que nos distingue es la forma en que te mostramos el estado de tu negocio y de cada reparación: a través de gráficos claros, paneles visuales de estatus y una interfaz amigable que te ayuda a supervisar la productividad, los ingresos y las tareas pendientes sin complicaciones.",
  getBrand().copy.landing.aboutP4,
];

export function PlatformAbout() {
  return (
    <section id="plataforma" className="border-t border-zinc-800/60 py-16 sm:py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Gestión de taller sin complicaciones
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-zinc-400">{paragraphs[0]}</p>
        </div>

        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {highlights.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="glass rounded-2xl p-5">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600/15 text-blue-400">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="font-semibold text-zinc-100">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-zinc-500">{desc}</p>
            </div>
          ))}
        </div>

        <div className="mx-auto mt-10 max-w-3xl space-y-6 text-base leading-relaxed text-zinc-400">
          {paragraphs.slice(1).map((text) => (
            <p key={text.slice(0, 40)}>{text}</p>
          ))}
        </div>
      </div>
    </section>
  );
}
