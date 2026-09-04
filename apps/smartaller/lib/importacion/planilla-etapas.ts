/**
 * Revisión del mapa de etapas de planilla Puerto Libre.
 *
 * rev 1 (histórico): 1 registro … 4 desaduanamiento, 5 propietario … 8 placa, 9 completa.
 * rev 2: inserta 5 pago impuesto y 6 inspección; propietario…placa pasan a 7–10; completa = 11.
 */
export const PLANILLA_ETAPAS_REV_ACTUAL = 2;
export const PLANILLA_FASE_COMPLETA = 11;
export const PLANILLA_FASE_UI_MAX = 10;

const FASE_INSERTADAS_REV2 = 2;
const PRIMERA_FASE_DESPLAZADA_REV2 = 5;

export function migratePlanillaFase(
  fase: number,
  rev: number | undefined,
): number {
  if (!Number.isFinite(fase) || fase < 1) return 1;
  const r = rev ?? 1;
  if (r >= PLANILLA_ETAPAS_REV_ACTUAL) {
    return Math.min(PLANILLA_FASE_COMPLETA, Math.max(1, Math.trunc(fase)));
  }
  if (fase >= PRIMERA_FASE_DESPLAZADA_REV2) {
    return Math.min(PLANILLA_FASE_COMPLETA, fase + FASE_INSERTADAS_REV2);
  }
  return Math.min(PLANILLA_FASE_COMPLETA, fase);
}

export function esPlanillaCompleta(fase: number): boolean {
  return fase >= PLANILLA_FASE_COMPLETA;
}

export type PlanillaFaseUi = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

export function toPlanillaFaseUi(fase: number): PlanillaFaseUi {
  if (!Number.isFinite(fase) || fase < 1) return 1;
  if (fase >= PLANILLA_FASE_UI_MAX) return PLANILLA_FASE_UI_MAX;
  return Math.trunc(fase) as PlanillaFaseUi;
}

export function parsePlanillaFaseQuery(
  raw: string | undefined
): PlanillaFaseUi | undefined {
  if (raw === "1" || raw === "registro") return 1;
  if (raw === "1a" || raw === "1A" || raw === "2") return 2;
  const n = Number(raw);
  if (Number.isInteger(n) && n >= 1 && n <= PLANILLA_FASE_UI_MAX) {
    return n as PlanillaFaseUi;
  }
  return undefined;
}
