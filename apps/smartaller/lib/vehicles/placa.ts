/**
 * Normalización y búsqueda de placas (Colombia / LATAM).
 */

/** Compacta: mayúsculas, sin espacios ni guiones. */
export function compactarPlaca(placa: string): string {
  return placa.trim().toUpperCase().replace(/[\s\-.]/g, "");
}

/** Alias usado en el resto del proyecto. */
export function normalizarPlaca(placa: string): string {
  return compactarPlaca(placa);
}

/** Formatos habituales en Colombia (autos, motos, antiguas). */
const PATRONES_PLACA_CO = [
  /^[A-Z]{3}\d{3}$/, // ABC123
  /^[A-Z]{3}\d{2}[A-Z]$/, // ABC12D motos nuevas
  /^[A-Z]{2}\d{3}[A-Z]$/, // AB123C
  /^[A-Z]\d{3}[A-Z]{2}$/, // A123BC
  /^[A-Z]{2}\d{4}$/, // AB1234 antiguas
  /^[A-Z]{3}\d{2}$/, // ABC12 antiguas
  /^\d{3}[A-Z]{3}$/, // 123ABC antiguas
  /^[A-Z0-9]{5,7}$/, // fallback alfanumérico corto
];

export function esPlacaPlausible(placa: string): boolean {
  const p = compactarPlaca(placa);
  if (p.length < 5 || p.length > 8) return false;
  return PATRONES_PLACA_CO.some((re) => re.test(p));
}

const SUSTITUCIONES_OCR: Record<string, string[]> = {
  "0": ["O", "Q", "D"],
  O: ["0", "Q", "D"],
  Q: ["0", "O"],
  "1": ["I", "L"],
  I: ["1", "L"],
  L: ["1", "I"],
  "2": ["Z"],
  Z: ["2"],
  "5": ["S"],
  S: ["5"],
  "6": ["G"],
  G: ["6"],
  "8": ["B"],
  B: ["8"],
};

/** Genera variantes por confusiones típicas de OCR (máx. 24). */
export function generarVariantesOcrPlaca(placa: string): string[] {
  const base = compactarPlaca(placa);
  const variantes = new Set<string>([base]);

  for (let i = 0; i < base.length; i++) {
    const char = base[i];
    const alts = SUSTITUCIONES_OCR[char];
    if (!alts) continue;

    for (const alt of alts) {
      variantes.add(base.slice(0, i) + alt + base.slice(i + 1));
    }
    if (variantes.size > 24) break;
  }

  return [...variantes].filter(esPlacaPlausible);
}

export function distanciaLevenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }

  return dp[m][n];
}

export type CoincidenciaPlacaFlota = {
  placa: string;
  distancia: number;
  metodo: "exacta" | "variante_ocr" | "aproximada";
};

/**
 * Busca la mejor placa de la flota para un texto OCR.
 * Prioridad: exacta → variante OCR → Levenshtein ≤ 2 (solo si longitud similar).
 */
export function resolverPlacaEnFlota(
  placaOcr: string,
  placasFlota: string[]
): CoincidenciaPlacaFlota | null {
  const ocr = compactarPlaca(placaOcr);
  if (!ocr) return null;

  const flota = placasFlota.map((p) => compactarPlaca(p)).filter(Boolean);
  const flotaUnica = [...new Set(flota)];

  const exacta = flotaUnica.find((p) => p === ocr);
  if (exacta) return { placa: exacta, distancia: 0, metodo: "exacta" };

  for (const variante of generarVariantesOcrPlaca(ocr)) {
    const hit = flotaUnica.find((p) => p === variante);
    if (hit) return { placa: hit, distancia: 1, metodo: "variante_ocr" };
  }

  let mejor: CoincidenciaPlacaFlota | null = null;
  for (const p of flotaUnica) {
    if (Math.abs(p.length - ocr.length) > 2) continue;
    const dist = distanciaLevenshtein(ocr, p);
    if (dist > 2) continue;
    if (!mejor || dist < mejor.distancia) {
      mejor = { placa: p, distancia: dist, metodo: "aproximada" };
    }
  }

  return mejor;
}

export function placasCoinciden(a: string, b: string): boolean {
  return compactarPlaca(a) === compactarPlaca(b);
}
