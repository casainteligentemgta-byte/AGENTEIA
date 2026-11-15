/**
 * Modelos JAC vendidos en Venezuela — LISTA PROVISIONAL.
 *
 * Fuente: catálogo público de JAC Motors / concesionarios en Venezuela
 * (SUVs JS, sedán J7, pickups T/Hunter y línea comercial N/Sunray).
 * Luis debe confirmar y recortar/ampliar esta lista antes del lanzamiento.
 *
 * Override en runtime: `NEXT_PUBLIC_JAC_MODELS=JS4,T8 Pro,Hunter`
 * (lista separada por comas).
 */
export const JAC_MODELS_PROVISIONAL = [
  // Pasajeros / SUV
  "J7",
  "JS2",
  "JS3",
  "JS4",
  "JS8",
  // Pickups
  "T6",
  "T8",
  "T8 Pro",
  "Hunter",
  // Comercial / van
  "Sunray",
  "Refine",
  "X200",
  // Camiones livianos
  "N350",
  "N56",
  "N75",
  // Eléctricos (presencia limitada)
  "iEVS4",
  "E-JS4",
] as const;

export type JacModelo = (typeof JAC_MODELS_PROVISIONAL)[number];

export function parseJacModelsFromEnv(raw: string | undefined): string[] | null {
  if (!raw?.trim()) return null;
  const models = raw
    .split(",")
    .map((m) => m.trim())
    .filter(Boolean);
  return models.length > 0 ? models : null;
}

export function getJacModels(): string[] {
  return parseJacModelsFromEnv(process.env.NEXT_PUBLIC_JAC_MODELS) ?? [
    ...JAC_MODELS_PROVISIONAL,
  ];
}
