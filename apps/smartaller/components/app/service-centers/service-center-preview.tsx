"use client";

import { Navigation } from "lucide-react";
import { StarRating } from "@/components/app/service-centers/star-rating";
import { buildMapsDirectionsUrl } from "@/lib/service-centers/distance";
import type { CentroServicioConDistancia } from "@/lib/service-centers/types";

type ServiceCenterPreviewProps = {
  centro: CentroServicioConDistancia;
};

export function ServiceCenterPreview({ centro }: ServiceCenterPreviewProps) {
  const mapsUrl = buildMapsDirectionsUrl(centro.lat, centro.lng);

  return (
    <div className="pointer-events-auto absolute left-3 right-3 top-3 z-[1000] overflow-hidden rounded-2xl bg-white shadow-xl">
      <div className="flex gap-3 p-3">
        <div className="h-20 w-24 shrink-0 overflow-hidden rounded-xl bg-gradient-to-br from-zinc-200 to-zinc-300">
          {centro.imagen_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={centro.imagen_url}
              alt={centro.nombre}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-xs font-bold text-zinc-500">
              {centro.nombre.slice(0, 6)}
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <StarRating rating={centro.rating_promedio} count={centro.rating_cantidad} />
          <h3 className="mt-1 truncate text-sm font-bold text-zinc-900">{centro.nombre}</h3>
          <p className="mt-0.5 line-clamp-2 text-xs text-zinc-500">{centro.direccion}</p>
        </div>
        <a
          href={mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex h-9 w-9 shrink-0 items-center justify-center self-center rounded-full bg-brand-600 text-white"
          aria-label={`Navegar a ${centro.nombre}`}
        >
          <Navigation className="h-4 w-4" />
        </a>
      </div>
    </div>
  );
}
