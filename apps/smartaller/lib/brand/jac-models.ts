/**
 * Modelos JAC vendidos en Venezuela — LISTA PROVISIONAL.
 *
 * Incluye nombres comerciales venezolanos (jacvenezuela.com) junto a códigos
 * de catálogo anteriores. Luis debe confirmar y recortar/ampliar esta lista.
 *
 * Override: `NEXT_PUBLIC_JAC_MODELS=Tepuy Pro,GX7,Aventura`
 */
export const JAC_MODELS_PROVISIONAL = [
  // Nombres comerciales Venezuela (provisional — confirmar con Luis)
  "Tepuy Pro",
  "La Venezolana Pro",
  "Arena Sport",
  "Arena Pro",
  "Nevado",
  "Nevado Pro",
  "Savanna",
  "Aventura",
  "Aventura Pro",
  "GX7",
  // Códigos / líneas previas (siguen en catálogo hasta confirmación)
  "J7",
  "JS2",
  "JS3",
  "JS4",
  "JS8",
  "T6",
  "T8",
  "T8 Pro",
  "Hunter",
  "Sunray",
  "Refine",
  "X200",
  "N350",
  "N56",
  "N75",
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
