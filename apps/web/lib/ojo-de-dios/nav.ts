/** Módulos del panel. Solo navegación visual; no implica que la fuente esté conectada. */

export const OJO_MODULES = [
  { id: "clima", label: "Clima" },
  { id: "agenda", label: "Agenda" },
  { id: "salud", label: "Salud" },
  { id: "correo", label: "Correo" },
  { id: "titulares", label: "Titulares" },
  { id: "tendencias", label: "Tendencias" },
  { id: "cine", label: "Cine" },
] as const;

export type OjoModuleId = (typeof OJO_MODULES)[number]["id"];
