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

/** Formatos habituales Colombia, Venezuela y LATAM. */
const PATRONES_PLACA_CO = [
  /^[A-Z]{3}\d{3}$/, // ABC123 Colombia
  /^[A-Z]{2}\d{2}[A-Z]\d{2}$/, // AA90N90 Venezuela / caribe
  /^[A-Z]{3}\d{2}[A-Z]$/, // ABC12D motos nuevas
  /^[A-Z]{2}\d{3}[A-Z]$/, // AB123C motos
  /^[A-Z]\d{3}[A-Z]{2}$/, // A123BC
  /^[A-Z]{2}\d{4}$/, // AB1234 antiguas
  /^[A-Z]{3}\d{2}$/, // ABC12 antiguas
  /^\d{3}[A-Z]{3}$/, // 123ABC antiguas
  /^[A-Z0-9]{5,8}$/, // fallback alfanumérico
];

export function esPlacaPlausible(placa: string): boolean {
  const p = compactarPlaca(placa);
  if (p.length < 5 || p.length > 8) return false;
  return PATRONES_PLACA_CO.some((re) => re.test(p));
}

/** Mayor puntaje = patrón más específico (preferir AA90N90 sobre fallback genérico). */
export function puntajeEspecificidadPlaca(placa: string): number {
  const p = compactarPlaca(placa);
  for (let i = 0; i < PATRONES_PLACA_CO.length; i++) {
    if (PATRONES_PLACA_CO[i].test(p)) return PATRONES_PLACA_CO.length - i;
  }
  return 0;
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
  M: ["N", "W"],
  N: ["M", "H"],
};

/** Placa Venezuela/caribe: LL NN L NN (ej. AA90N90). */
const PATRON_VENEZUELA = /^[A-Z]{2}\d{2}[A-Z]\d{2}$/;

/** Letras que el OCR confunde con dígitos en la posición central (índice 4). */
const LETRAS_CENTRO_VENEZUELA = ["N", "M", "H", "I", "O", "Z", "S", "B", "G"];

function variantesOcrPlacaVenezuela(base: string): string[] {
  if (base.length !== 7) return [];

  const variantes: string[] = [];
  const posicionesDigito = [2, 3, 5, 6] as const;

  for (const idx of posicionesDigito) {
    const char = base[idx];
    const alts = SUSTITUCIONES_OCR[char];
    if (!alts) continue;
    for (const alt of alts) {
      variantes.push(base.slice(0, idx) + alt + base.slice(idx + 1));
    }
  }

  const centro = base[4];
  if (/[0-9]/.test(centro) || centro === "O" || centro === "Q" || centro === "D") {
    for (const letra of LETRAS_CENTRO_VENEZUELA) {
      variantes.push(base.slice(0, 4) + letra + base.slice(5));
    }
  }

  return variantes;
}

/** Genera variantes por confusiones típicas de OCR (máx. 32). */
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
    if (variantes.size > 32) break;
  }

  for (const variante of variantesOcrPlacaVenezuela(base)) {
    variantes.add(variante);
    if (variantes.size > 32) break;
  }

  return [...variantes].filter(esPlacaPlausible);
}

export function esPlacaFormatoVenezuela(placa: string): boolean {
  return PATRON_VENEZUELA.test(compactarPlaca(placa));
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
