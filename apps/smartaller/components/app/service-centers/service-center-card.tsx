"use client";

import { Navigation } from "lucide-react";
import { StarRating } from "@/components/app/service-centers/star-rating";
import { ServiceTags } from "@/components/app/service-centers/service-tags";
import { buildMapsDirectionsUrl, formatDistancia } from "@/lib/service-centers/distance";
import type { CentroServicioConDistancia } from "@/lib/service-centers/types";
import { cn } from "@/lib/utils";

type ServiceCenterCardProps = {
  centro: CentroServicioConDistancia;
  selected?: boolean;
  onSelect?: () => void;
  showDistance?: boolean;
};

export function ServiceCenterCard({
  centro,
  selected,
  onSelect,
  showDistance = true,
}: ServiceCenterCardProps) {
  const mapsUrl = buildMapsDirectionsUrl(centro.lat, centro.lng);

  return (
    <article
      className={cn(
        "overflow-hidden rounded-2xl border bg-white shadow-sm transition",
        selected ? "border-brand-400 ring-2 ring-brand-100" : "border-zinc-200"
      )}
    >
      <button type="button" onClick={onSelect} className="block w-full text-left">
        <div className="relative h-36 bg-gradient-to-br from-zinc-200 to-zinc-300">
          {centro.imagen_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={centro.imagen_url}
              alt={centro.nombre}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full items-center justify-center">
              <span className="text-3xl font-bold tracking-wider text-zinc-500/80">
                {centro.nombre.slice(0, 4)}
              </span>
            </div>
          )}
          {showDistance && centro.distanciaKm != null && (
            <span className="absolute left-3 top-3 rounded-full bg-black/60 px-2.5 py-1 text-xs font-medium text-white">
              {formatDistancia(centro.distanciaKm)}
            </span>
          )}
        </div>

        <div className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <StarRating rating={centro.rating_promedio} count={centro.rating_cantidad} />
              <h3 className="mt-2 truncate text-base font-bold text-zinc-900">{centro.nombre}</h3>
              <p className="mt-1 line-clamp-2 text-sm text-zinc-500">{centro.direccion}</p>
            </div>
            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600 transition hover:bg-brand-100"
              aria-label={`Cómo llegar a ${centro.nombre}`}
            >
              <Navigation className="h-5 w-5" />
            </a>
          </div>

          <div className="mt-3">
            <ServiceTags servicios={centro.servicios} compact />
          </div>
        </div>
      </button>
    </article>
  );
}
