"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { ChevronDown, ChevronUp, LocateFixed, Loader2 } from "lucide-react";
import Link from "next/link";
import { ServiceCenterCard } from "@/components/app/service-centers/service-center-card";
import { ServiceCenterPreview } from "@/components/app/service-centers/service-center-preview";
import { ordenarCentrosPorDistancia } from "@/lib/service-centers/distance";
import type { CentroServicio, Coordenadas } from "@/lib/service-centers/types";

const ServiceCenterMap = dynamic(
  () =>
    import("@/components/app/service-centers/service-center-map").then(
      (m) => m.ServiceCenterMap
    ),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center bg-zinc-200">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    ),
  }
);

type ServiceCentersViewProps = {
  centros: CentroServicio[];
};

export function ServiceCentersView({ centros }: ServiceCentersViewProps) {
  const [sheetExpanded, setSheetExpanded] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(centros[0]?.id ?? null);
  const [userLocation, setUserLocation] = useState<Coordenadas | null>(null);
  const [locating, setLocating] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);

  const centrosOrdenados = ordenarCentrosPorDistancia(centros, userLocation);
  const selected = centrosOrdenados.find((c) => c.id === selectedId) ?? null;

  useEffect(() => {
    if (!selectedId && centrosOrdenados[0]) {
      setSelectedId(centrosOrdenados[0].id);
    }
  }, [centrosOrdenados, selectedId]);

  const requestLocation = () => {
    if (!navigator.geolocation) {
      setGeoError("Tu navegador no soporta geolocalización");
      return;
    }
    setLocating(true);
    setGeoError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
        setLocating(false);
      },
      () => {
        setGeoError("No pudimos obtener tu ubicación. Mostrando centros en Porlamar.");
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  useEffect(() => {
    requestLocation();
  }, []);

  return (
    <div className="relative flex h-[100dvh] flex-col bg-zinc-100">
      <div
        className={`relative shrink-0 transition-all duration-300 ${
          sheetExpanded ? "h-[38dvh]" : "h-[62dvh]"
        }`}
      >
        <ServiceCenterMap
          centros={centrosOrdenados}
          selectedId={selectedId}
          onSelect={setSelectedId}
          userLocation={userLocation}
          className="h-full w-full z-0"
        />

        <Link
          href="/app"
          className="absolute left-3 top-3 z-[1001] flex h-10 w-10 items-center justify-center rounded-full bg-white text-lg text-blue-600 shadow-md"
          aria-label="Volver"
        >
          ←
        </Link>

        <button
          type="button"
          onClick={requestLocation}
          disabled={locating}
          className="absolute right-3 top-3 z-[1001] flex h-10 w-10 items-center justify-center rounded-full bg-white text-blue-600 shadow-md disabled:opacity-60"
          aria-label="Mi ubicación"
        >
          {locating ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <LocateFixed className="h-5 w-5" />
          )}
        </button>

        {selected && !sheetExpanded && <ServiceCenterPreview centro={selected} />}
      </div>

      <div
        className={`flex min-h-0 flex-1 flex-col rounded-t-3xl bg-white shadow-[0_-8px_30px_rgba(0,0,0,0.12)] transition-all ${
          sheetExpanded ? "flex-[1]" : "h-auto shrink-0"
        }`}
      >
        <button
          type="button"
          onClick={() => setSheetExpanded((v) => !v)}
          className="flex w-full flex-col items-center px-4 pb-2 pt-3"
          aria-expanded={sheetExpanded}
        >
          <span className="mb-2 h-1 w-10 rounded-full bg-zinc-300" />
          {sheetExpanded ? (
            <ChevronDown className="h-5 w-5 text-zinc-400" />
          ) : (
            <ChevronUp className="h-5 w-5 text-zinc-400" />
          )}
          <p className="mt-1 text-center text-sm font-semibold text-zinc-800">
            Lista de Distribuidores y Centros de Servicios
          </p>
        </button>

        {sheetExpanded && (
          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6">
            {geoError && (
              <p className="mb-3 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">
                {geoError}
              </p>
            )}
            <p className="mb-3 text-xs font-medium uppercase tracking-wide text-zinc-400">
              {userLocation ? "Más cercanos" : "Disponibles en Porlamar"}
            </p>
            <div className="space-y-4">
              {centrosOrdenados.map((centro) => (
                <ServiceCenterCard
                  key={centro.id}
                  centro={centro}
                  selected={centro.id === selectedId}
                  onSelect={() => {
                    setSelectedId(centro.id);
                    setSheetExpanded(false);
                  }}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
