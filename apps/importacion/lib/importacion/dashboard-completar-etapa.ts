/** Etapa pendiente según planillaFase (1–7). La 8 ya está completa. */
export const PLANILLA_ETAPA_LABELS = {
  1: "registro",
  2: "embarque",
  3: "llegada",
  4: "desaduanamiento",
  5: "propietario",
  6: "seguro",
  7: "matrícula",
} as const;

export type PlanillaEtapaNumero = keyof typeof PLANILLA_ETAPA_LABELS;

export function resolvePlanillaEtapaPendiente(
  fase: number | null | undefined
): PlanillaEtapaNumero {
  if (fase == null || !Number.isFinite(fase) || fase < 1) return 1;
  if (fase >= 7) return 7;
  return fase as PlanillaEtapaNumero;
}

/** Botón del dashboard: Completar registro, Completar embarque, … */
export function completarEtapaLabel(
  fase: number | null | undefined
): `Completar ${string}` {
  const etapa = PLANILLA_ETAPA_LABELS[resolvePlanillaEtapaPendiente(fase)];
  return `Completar ${etapa}`;
}
