import type {
  CentroServicio,
  CentroServicioConDistancia,
  Coordenadas,
} from "@/lib/service-centers/types";

const RADIO_TIERRA_KM = 6371;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

export function calcularDistanciaKm(origen: Coordenadas, destino: Coordenadas): number {
  const dLat = toRad(destino.lat - origen.lat);
  const dLng = toRad(destino.lng - origen.lng);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(origen.lat)) * Math.cos(toRad(destino.lat)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return RADIO_TIERRA_KM * c;
}

export function formatDistancia(km: number | null): string {
  if (km == null) return "";
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1)} km`;
}

export function buildMapsDirectionsUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
}

export function ordenarCentrosPorDistancia(
  centros: CentroServicio[],
  origen: Coordenadas | null
): CentroServicioConDistancia[] {
  const conDistancia = centros.map((centro) => ({
    ...centro,
    distanciaKm: origen
      ? calcularDistanciaKm(origen, { lat: centro.lat, lng: centro.lng })
      : null,
  }));

  return conDistancia.sort((a, b) => {
    if (a.distanciaKm == null && b.distanciaKm == null) return a.nombre.localeCompare(b.nombre);
    if (a.distanciaKm == null) return 1;
    if (b.distanciaKm == null) return -1;
    return a.distanciaKm - b.distanciaKm;
  });
}
