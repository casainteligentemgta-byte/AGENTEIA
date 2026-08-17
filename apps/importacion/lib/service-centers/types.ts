export const SERVICIOS_CENTRO = [
  "aceite",
  "filtros",
  "escaner",
  "balanceo",
  "neumaticos",
  "bateria",
  "alineacion",
  "limpieza_inyectores",
] as const;

export type ServicioCentroId = (typeof SERVICIOS_CENTRO)[number];

export type CentroServicio = {
  id: string;
  nombre: string;
  direccion: string;
  ciudad: string | null;
  lat: number;
  lng: number;
  imagen_url: string | null;
  rating_promedio: number;
  rating_cantidad: number;
  servicios: ServicioCentroId[];
};

export type CentroServicioConDistancia = CentroServicio & {
  distanciaKm: number | null;
};

export type Coordenadas = {
  lat: number;
  lng: number;
};
