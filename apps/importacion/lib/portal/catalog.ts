import { IMPORTACION_BASE } from "@/lib/importacion/paths";

export const PORTAL_ROLES = [
  "master",
  "admin",
  "aduanera",
  "taller",
  "concesionario",
  "usuario",
] as const;

export type PortalRole = (typeof PORTAL_ROLES)[number];

export const PORTAL_META: Record<
  PortalRole,
  {
    title: string;
    description: string;
    href: string;
    accent: string;
  }
> = {
  master: {
    title: "Administrador máster",
    description:
      "Ve y modifica todo, supervisa el módulo e ingresos (logs). Alcance global con autorización.",
    href: `${IMPORTACION_BASE}/admin/ingresos`,
    accent: "border-amber-500/40 bg-amber-950/30 text-amber-100",
  },
  admin: {
    title: "Administrador",
    description:
      "Ve y modifica toda la data de importación. No accede a logs de supervisión.",
    href: IMPORTACION_BASE,
    accent: "border-orange-500/40 bg-orange-950/30 text-orange-100",
  },
  aduanera: {
    title: "Aduanera",
    description: "Monitoreo de expedientes Puerto Libre e importaciones.",
    href: IMPORTACION_BASE,
    accent: "border-sky-500/40 bg-sky-950/30 text-sky-100",
  },
  taller: {
    title: "Taller",
    description:
      "Operación del taller y módulo Importación: solo la data de tus clientes.",
    href: IMPORTACION_BASE,
    accent: "border-cyan-500/40 bg-cyan-950/30 text-cyan-100",
  },
  concesionario: {
    title: "Concesionario",
    description:
      "Carga y modifica la data de tus clientes en Importación. No ves otros concesionarios.",
    href: IMPORTACION_BASE,
    accent: "border-violet-500/40 bg-violet-950/30 text-violet-100",
  },
  usuario: {
    title: "Usuario",
    description:
      "Solo ves los vehículos de tu propiedad o los que un administrador te comparta.",
    href: IMPORTACION_BASE,
    accent: "border-emerald-500/40 bg-emerald-950/30 text-emerald-100",
  },
};

export const ROLES_CON_ALCANCE = ["master", "admin", "aduanera"] as const;
