import Link from "next/link";
import { MapPin } from "lucide-react";
import { AppHeader } from "@/components/app/app-header";

export default function CentrosPage() {
  return (
    <>
      <AppHeader showBack backHref="/app" title="Centros de servicio" />
      <main className="px-4 pb-10 pt-6">
        <div className="overflow-hidden rounded-2xl bg-zinc-900">
          <div className="flex h-48 items-center justify-center bg-gradient-to-b from-blue-900/40 to-zinc-900">
            <MapPin className="h-12 w-12 text-blue-400/60" />
          </div>
          <div className="space-y-4 p-5">
            <p className="text-lg font-semibold text-white">Mapa y listado</p>
            <p className="text-sm text-zinc-400">
              Próximamente podrás ver distribuidores y centros de servicio cercanos, como en
              ABCopilot: mapa, valoraciones y servicios disponibles (aceite, neumáticos,
              escáner, etc.).
            </p>
            <Link
              href="/app"
              className="inline-block rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white"
            >
              Volver a mis vehículos
            </Link>
          </div>
        </div>
      </main>
    </>
  );
}
