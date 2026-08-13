/** Cuestionario de revisión del vehículo en fase Llegada (UI fase 3). */

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

const RESPUESTAS_VALIDAS = new Set<LlegadaChecklistRespuesta>([
  "sin_dano",
  "falla",
  "na",
]);

/** True si todos los ítems del cuestionario de revisión tienen respuesta. */
export function isLlegadaChecklistCompleto(
  checklist: Record<string, string | undefined | null> | null | undefined
): boolean {
  if (!checklist) return false;
  return LLEGADA_CHECKLIST_ITEMS.every((item) => {
    const value = checklist[item.id];
    return typeof value === "string" && RESPUESTAS_VALIDAS.has(value as LlegadaChecklistRespuesta);
  });
}
