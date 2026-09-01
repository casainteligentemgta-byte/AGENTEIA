/** Etapa pendiente según planillaFase (1–8). La 9 ya está completa. */
export const PLANILLA_ETAPA_LABELS = {
  1: "registro",
  2: "embarque",
  3: "llegada",
  4: "desaduanamiento",
  5: "propietario",
  6: "seguro",
  7: "matrícula",
  8: "placa",
} as const;

export type PlanillaEtapaNumero = keyof typeof PLANILLA_ETAPA_LABELS;

export function resolvePlanillaEtapaPendiente(
  fase: number | null | undefined
): PlanillaEtapaNumero {
  if (fase == null || !Number.isFinite(fase) || fase < 1) return 1;
  if (fase >= 8) return 8;
  return fase as PlanillaEtapaNumero;
}

/** Botón del dashboard: Completar registro, Completar embarque, … */
export function completarEtapaLabel(
  fase: number | null | undefined
): `Completar ${string}` {
  const etapa = PLANILLA_ETAPA_LABELS[resolvePlanillaEtapaPendiente(fase)];
  return `Completar ${etapa}`;
}

/** Título de cola: Por completar registro, Por completar embarque, … */
export function porCompletarEtapaTitle(
  fase: number | null | undefined
): `Por completar ${string}` {
  const etapa = PLANILLA_ETAPA_LABELS[resolvePlanillaEtapaPendiente(fase)];
  return `Por completar ${etapa}`;
}
