/**
 * Recaudos sacados de la fase Desaduanamiento (2026-09-04).
 * Siguen existiendo como tipos de documento: si ya están cargados no se
 * pierden, y se pueden reponer a la carpeta cuando el operador los pida.
 */
export const PL_DESADUANAMIENTO_RESERVADOS = [
  "sencamer",
  "registro_puerto_libre",
  "agente_aduanal_doc",
  "constancia_edi_reconocimiento",
  "planilla_liquidacion_aduanera",
  "constancia_residencia_permanencia",
] as const;

export type DesaduanamientoReservado =
  (typeof PL_DESADUANAMIENTO_RESERVADOS)[number];
