/** Checklist de llegada del vehículo a Puerto Libre (fase 2). */

export const LLEGADA_CHECKLIST_ITEMS = [
  { id: "cristales_parabrisas", etiqueta: "Cristales / parabrisas" },
  { id: "llantas_rines", etiqueta: "Llantas y rines" },
  { id: "luces_exteriores", etiqueta: "Luces exteriores" },
  { id: "sin_fuga_fluidos", etiqueta: "Sin fuga visible de fluidos" },
  { id: "llaves", etiqueta: "Llaves" },
  { id: "controles", etiqueta: "Controles" },
  { id: "manuales", etiqueta: "Manuales" },
  { id: "rueda_repuesto", etiqueta: "Rueda de repuesto" },
  { id: "gato", etiqueta: "Gato" },
  { id: "triangulo_seguridad", etiqueta: "Triángulo de seguridad" },
  { id: "documentos_carpeta", etiqueta: "Documentos del vehículo en carpeta" },
  { id: "alarma", etiqueta: "Alarma" },
  { id: "gps_rastreador", etiqueta: "GPS / rastreador" },
  { id: "inmovilizador", etiqueta: "Inmovilizador" },
] as const;

export type LlegadaChecklistItemId = (typeof LLEGADA_CHECKLIST_ITEMS)[number]["id"];

export type LlegadaChecklistRespuesta = "sin_dano" | "falla" | "na";

export type LlegadaChecklistState = Partial<
  Record<LlegadaChecklistItemId, LlegadaChecklistRespuesta | "">
>;

export type LlegadaChecklistNotasState = Partial<Record<LlegadaChecklistItemId, string>>;
