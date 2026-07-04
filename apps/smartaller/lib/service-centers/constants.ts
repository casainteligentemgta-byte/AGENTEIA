import type { LucideIcon } from "lucide-react";
import {
  Battery,
  CircleDot,
  Droplets,
  Filter,
  ScanLine,
  Settings2,
  SprayCan,
  Wrench,
} from "lucide-react";
import type { ServicioCentroId } from "@/lib/service-centers/types";

export type ServicioCentroConfig = {
  id: ServicioCentroId;
  label: string;
  icon: LucideIcon;
};

export const SERVICIOS_CENTRO_CONFIG: Record<ServicioCentroId, ServicioCentroConfig> = {
  aceite: { id: "aceite", label: "Aceite", icon: Droplets },
  filtros: { id: "filtros", label: "Filtros", icon: Filter },
  escaner: { id: "escaner", label: "Escáner automotriz", icon: ScanLine },
  balanceo: { id: "balanceo", label: "Balanceo", icon: Settings2 },
  neumaticos: { id: "neumaticos", label: "Neumáticos", icon: CircleDot },
  bateria: { id: "bateria", label: "Batería", icon: Battery },
  alineacion: { id: "alineacion", label: "Alineación", icon: Wrench },
  limpieza_inyectores: {
    id: "limpieza_inyectores",
    label: "Limpieza de inyectores",
    icon: SprayCan,
  },
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
