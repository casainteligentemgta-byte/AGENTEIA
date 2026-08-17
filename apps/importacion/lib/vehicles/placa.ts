/**
 * Normalización y búsqueda de placas (Venezuela INTT / PL y otros LATAM).
 */

/** Compacta: mayúsculas, sin espacios ni guiones. */
export function compactarPlaca(placa: string): string {
  return placa.trim().toUpperCase().replace(/[\s\-.]/g, "");
}

/** Alias usado en el resto del proyecto. */
export function normalizarPlaca(placa: string): string {
  return compactarPlaca(placa);
}

/**
 * Patrones Venezuela (prioridad) y otros LATAM.
 * Orden: más específico primero → mayor puntaje en puntajeEspecificidadPlaca.
 */
const PATRONES_PLACA = [
  /^[A-Z]{2}\d{2}[A-Z]\d[O0]$/, // PL Puerto Libre: AA90N9O (O fija = Nueva Esparta)
  /^[A-Z]{2}\d{2}[A-Z]\d{2}$/, // Particulares / serial mixto: AA90N90
  /^[A-Z]{2}\d{3}[A-Z][A-Z]$/, // INTT particulares: AB123CD (xx123xA)
  /^[A-Z]{2}\d{4}[O0]$/, // PL motos: xx1234O
  /^[A-Z]{2}\d{3}[A-Z]$/, // Motos Venezuela: xx1x23G
  /^[A-Z]\d{2}[A-Z]{2}\d[A-Z]$/, // Carga: x12xx3A
  /^[A-Z]{3}\d{3}$/, // Colombia ABC123
  /^[A-Z]{3}\d{2}[A-Z]$/, // Motos Colombia ABC12D
  /^[A-Z]{2}\d{3}[A-Z]$/, // Motos Colombia AB123C
  /^[A-Z]\d{3}[A-Z]{2}$/, // A123BC
  /^[A-Z]{2}\d{4}$/, // Antiguas AB1234
  /^[A-Z]{3}\d{2}$/, // Antiguas ABC12
  /^\d{3}[A-Z]{3}$/, // Antiguas 123ABC
  /^[A-Z0-9]{5,8}$/, // fallback alfanumérico
];

/** Particulares Venezuela: 2 letras + 2 dígitos + 1 letra + 2 dígitos/letra. */
const PATRON_VENEZUELA_SERIAL = /^[A-Z]{2}\d{2}[A-Z]\d{2}$/;

/** Puerto Libre (PL): termina en O (Nueva Esparta), no en cero. */
const PATRON_PUERTO_LIBRE = /^[A-Z]{2}\d{2}[A-Z]\d[O0]$/;

const CODIGOS_ESTADO_VE = "ABCDEFGHIJKLMNOPRSTUVWXY";

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

/** Letras que el OCR confunde con dígitos en la posición central (índice 4). */
const LETRAS_CENTRO_VENEZUELA = ["N", "M", "H", "I", "O", "Z", "S", "B", "G"];

export function esPlacaPlausible(placa: string): boolean {
  const p = compactarPlaca(placa);
  if (p.length < 5 || p.length > 8) return false;
  return PATRONES_PLACA.some((re) => re.test(p));
}

/** Mayor puntaje = patrón más específico (preferir Venezuela/PL sobre genérico). */
export function puntajeEspecificidadPlaca(placa: string): number {
  const p = compactarPlaca(placa);
  for (let i = 0; i < PATRONES_PLACA.length; i++) {
    if (PATRONES_PLACA[i].test(p)) return PATRONES_PLACA.length - i;
  }
  return 0;
}

function variantesOcrPlacaVenezuela(base: string): string[] {
  if (base.length !== 7) return [];

  const variantes: string[] = [];
  const posicionesDigito = [2, 3, 5] as const;

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

  const ultimo = base[6];
  if (ultimo === "0") {
    variantes.push(base.slice(0, 6) + "O");
    for (const estado of CODIGOS_ESTADO_VE) {
      variantes.push(base.slice(0, 6) + estado);
    }
  }
  if (ultimo === "O") {
    variantes.push(base.slice(0, 6) + "0");
  }

  const penultimo = base[5];
  if (penultimo === "0" && (ultimo === "0" || ultimo === "O")) {
    variantes.push(base.slice(0, 5) + "9O");
    variantes.push(base.slice(0, 5) + "90");
  }

  return variantes;
}

/** Genera variantes por confusiones típicas de OCR (máx. 40). */
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
    if (variantes.size > 40) break;
  }

  for (const variante of variantesOcrPlacaVenezuela(base)) {
    variantes.add(variante);
    if (variantes.size > 40) break;
  }

  return [...variantes].filter(esPlacaPlausible);
}

export function esPlacaFormatoVenezuela(placa: string): boolean {
  const p = compactarPlaca(placa);
  return PATRON_VENEZUELA_SERIAL.test(p) || PATRON_PUERTO_LIBRE.test(p);
}

export function esPlacaPuertoLibre(placa: string): boolean {
  return PATRON_PUERTO_LIBRE.test(compactarPlaca(placa));
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
