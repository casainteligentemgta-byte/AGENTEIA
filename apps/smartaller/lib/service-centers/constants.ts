import { getCategoriaVisual, type CategoriaIcon } from "@/components/icons/categorias";
import type { ServicioCentroId } from "@/lib/service-centers/types";

export type ServicioCentroConfig = {
  id: ServicioCentroId;
  label: string;
  icon: CategoriaIcon;
  colorClasses: string;
};

function servicio(id: ServicioCentroId, label: string): ServicioCentroConfig {
  const visual = getCategoriaVisual(id);
  return { id, label, icon: visual.Icon, colorClasses: visual.colorClasses };
}

export const SERVICIOS_CENTRO_CONFIG: Record<ServicioCentroId, ServicioCentroConfig> = {
  aceite: servicio("aceite", "Aceite"),
  filtros: servicio("filtros", "Filtros"),
  escaner: servicio("escaner", "Escáner automotriz"),
  balanceo: servicio("balanceo", "Balanceo"),
  neumaticos: servicio("neumaticos", "Neumáticos"),
  bateria: servicio("bateria", "Batería"),
  alineacion: servicio("alineacion", "Alineación"),
  limpieza_inyectores: servicio("limpieza_inyectores", "Limpieza de inyectores"),
};

export function getServicioConfig(id: string): ServicioCentroConfig | null {
  if (id in SERVICIOS_CENTRO_CONFIG) {
    return SERVICIOS_CENTRO_CONFIG[id as ServicioCentroId];
  }
  return null;
}

/** Porlamar — centro por defecto si no hay geolocalización */
export const CENTRO_MAPA_DEFAULT = {
  lat: 10.971,
  lng: -63.852,
  zoom: 13,
} as const;
