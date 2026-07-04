import Link from "next/link";
import { MapPin, Plus } from "lucide-react";

export function AppActionButtons() {
  return (
    <div className="grid grid-cols-2 gap-3">
      <Link
        href="/app/centros"
        className="app-cta-btn flex flex-col items-center justify-center gap-2 px-3 py-4 text-center text-sm font-medium"
      >
        <MapPin className="h-5 w-5" strokeWidth={2.5} />
        Centros de Servicios
      </Link>
      <Link
        href="/app/vehiculos/nuevo"
        className="app-cta-btn flex flex-col items-center justify-center gap-2 px-3 py-4 text-center text-sm font-medium"
      >
        <Plus className="h-5 w-5" strokeWidth={2.5} />
        Agregar Vehículo
      </Link>
    </div>
  );
}
