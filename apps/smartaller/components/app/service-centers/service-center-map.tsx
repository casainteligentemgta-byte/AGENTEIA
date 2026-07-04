"use client";

import { useEffect } from "react";
import { MapContainer, Marker, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { CENTRO_MAPA_DEFAULT } from "@/lib/service-centers/constants";
import type { CentroServicioConDistancia, Coordenadas } from "@/lib/service-centers/types";

const pinIcon = L.divIcon({
  className: "",
  html: `<div style="
    width: 28px;
    height: 28px;
    background: #ef4444;
    border: 3px solid white;
    border-radius: 50% 50% 50% 0;
    transform: rotate(-45deg);
    box-shadow: 0 2px 8px rgba(0,0,0,0.35);
  "></div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 28],
});

const pinSelectedIcon = L.divIcon({
  className: "",
  html: `<div style="
    width: 34px;
    height: 34px;
    background: #2563eb;
    border: 3px solid white;
    border-radius: 50% 50% 50% 0;
    transform: rotate(-45deg);
    box-shadow: 0 4px 12px rgba(37,99,235,0.5);
  "></div>`,
  iconSize: [34, 34],
  iconAnchor: [17, 34],
});

type MapControllerProps = {
  selected: CentroServicioConDistancia | null;
  userLocation: Coordenadas | null;
};

function MapController({ selected, userLocation }: MapControllerProps) {
  const map = useMap();

  useEffect(() => {
    if (selected) {
      map.flyTo([selected.lat, selected.lng], 15, { duration: 0.8 });
      return;
    }
    if (userLocation) {
      map.flyTo([userLocation.lat, userLocation.lng], 13, { duration: 0.8 });
    }
  }, [selected, userLocation, map]);

  return null;
}

type ServiceCenterMapProps = {
  centros: CentroServicioConDistancia[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  userLocation: Coordenadas | null;
  className?: string;
};

export function ServiceCenterMap({
  centros,
  selectedId,
  onSelect,
  userLocation,
  className,
}: ServiceCenterMapProps) {
  const center = userLocation ?? {
    lat: CENTRO_MAPA_DEFAULT.lat,
    lng: CENTRO_MAPA_DEFAULT.lng,
  };

  return (
    <MapContainer
      center={[center.lat, center.lng]}
      zoom={CENTRO_MAPA_DEFAULT.zoom}
      className={className ?? "h-full w-full"}
      scrollWheelZoom
      zoomControl={false}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <MapController
        selected={centros.find((c) => c.id === selectedId) ?? null}
        userLocation={userLocation}
      />
      {centros.map((centro) => (
        <Marker
          key={centro.id}
          position={[centro.lat, centro.lng]}
          icon={centro.id === selectedId ? pinSelectedIcon : pinIcon}
          eventHandlers={{
            click: () => onSelect(centro.id),
          }}
        />
      ))}
    </MapContainer>
  );
}
