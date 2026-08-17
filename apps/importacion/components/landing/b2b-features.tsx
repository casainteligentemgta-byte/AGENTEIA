import {
  Bike,
  Camera,
  ClipboardList,
  MessageCircle,
  Monitor,
  Package,
  Sparkles,
  Users,
} from "lucide-react";

const features = [
  {
    icon: MessageCircle,
    title: "Telegram + IA",
    desc: "Foto de factura → datos extraídos automáticamente. Sin formularios ni apps extra para el equipo.",
  },
  {
    icon: ClipboardList,
    title: "Órdenes y flota",
    desc: "Historial por vehículo, revisiones manuales, recordatorios y métricas de ingresos en un solo panel.",
  },
  {
    icon: Camera,
    title: "Diagnóstico visual",
    desc: "Sube fotos y videos en la revisión. El dueño los ve en su app con total transparencia.",
  },
  {
    icon: Package,
    title: "Repuestos por OS",
    desc: "Catálogo de inventario y líneas de repuesto en cada orden. Stock y precios bajo control.",
  },
  {
    icon: Bike,
    title: "SmartBike",
    desc: "Para tiendas de ciclismo: desgaste por km (Strava), alertas al ciclista y protocolo de cierre.",
  },
  {
    icon: Monitor,
    title: "Presidencia",
    desc: "Pantalla de recepción con tu logo y estado del taller. Ideal para mostrar en el mostrador.",
  },
  {
    icon: Users,
    title: "App del dueño",
    desc: "Tus clientes ven historial, semáforos de salud y alertas. Más confianza, más retorno.",
  },
  {
    icon: Sparkles,
    title: "Multivehículo",
    desc: "Auto, moto, bicicleta, patinete, tractor y maquinaria. Plantillas de mantenimiento por tipo.",
  },
];

export function B2bFeatures() {
  return (
    <section id="funciones" className="border-t border-zinc-800/60 py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mb-16 max-w-2xl">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Todo lo que tu taller necesita
          </h2>
          <p className="mt-4 text-lg text-zinc-400">
            Desde la recepción hasta el seguimiento post-servicio. Un solo sistema para el equipo
            y para tus clientes.
          </p>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {features.map(({ icon: Icon, title, desc }) => (
            <div
              key={title}
              className="glass group rounded-2xl p-6 transition hover:border-blue-500/30"
            >
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-zinc-800 text-zinc-300 transition group-hover:bg-blue-600/20 group-hover:text-blue-400">
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
