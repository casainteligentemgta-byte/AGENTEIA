/**
 * Normalización y fidelidad de filas extraídas de facturas multi-vehículo
 * (hoja anexa MAV, carátulas Chery, etc.).
 */

import type { PuertoLibreRegistroScanFields } from "@/lib/importacion/scan-fields";
import { anioFromVin } from "@/lib/ai/image-orient";
import {
  compactAlnumVin,
  normalizeVinLoose,
} from "@/lib/importacion/vin-text";
import {
  inferCheryModelo,
  isModeloFragmentInColor,
  looksLikeCheryModelName,
  looksLikeCheryVin,
  repairCheryMarcaModelo,
} from "@/lib/importacion/chery-modelo";

export { extractVinStringsFromText } from "@/lib/importacion/vin-text";
export {
  inferCheryModelo,
  isModeloFragmentInColor,
  looksLikeCheryModelName,
  looksLikeCheryVin,
  repairCheryMarcaModelo,
} from "@/lib/importacion/chery-modelo";

const VIN_RE = /\b([A-HJ-NPR-Z0-9]{17})\b/gi;

export type FacturaMultiLike = {
  shared: PuertoLibreRegistroScanFields;
  vehiculos: PuertoLibreRegistroScanFields[];
};

export function compactAlnum(raw: string | null | undefined): string {
  return compactAlnumVin(raw);
}

/** VIN: 17 chars, sin I/O/Q. Por defecto exige 17 (carga masiva). */
export function normalizeVin(
  raw: string | null | undefined,
  options?: { strict?: boolean }
): string | null {
  return normalizeVinLoose(raw, { strict: options?.strict ?? true });
}

export function normalizeMotor(raw: string | null | undefined): string | null {
  let m = compactAlnum(raw);
  if (!m) return null;
  if (m === "PORCOMPLETAR" || m === "POR-COMPLETAR") return null;
  // OCR: O→0 en tramos numéricos finales
  if (m.length < 6 || m.length > 20) return m.length >= 6 ? m : null;
  return m;
}

export function normalizeLlave(raw: string | null | undefined): string | null {
  const t = (raw ?? "").trim().toUpperCase().replace(/\s+/g, "");
  if (!t) return null;
  const m = t.match(/^M?\d{3,5}$/);
  if (!m) return t.startsWith("M") ? t : null;
  return t.startsWith("M") ? t : `M${t}`;
}

export function normalizeColorCelda(raw: string | null | undefined): string | null {
  const t = (raw ?? "").trim().replace(/\s+/g, " ").toUpperCase();
  if (!t) return null;
  // Evitar que un código largo se meta como color
  if (/^SB[A-Z0-9]{8,}$/i.test(t.replace(/\s/g, ""))) return null;
  if (t.replace(/\s/g, "").length > 24) return null;
  // "PRO MAX" / "TIGGO 7" no son color
  if (isModeloFragmentInColor(t)) return null;
  return t;
}

export function normalizeCodigoModelo(raw: string | null | undefined): string | null {
  const t = compactAlnum(raw);
  if (!t) return null;
  if (t.length === 17 && /^[A-HJ-NPR-Z0-9]{17}$/.test(t)) return null; // es VIN
  if (t.length < 8) return null;
  return t;
}

const MARCA_EMISORA_INVALIDA_RE =
  /mav\s*trade|holdings\s*corp|intercontinental|consignee|buyer|importador|shipper\s*to|sold\s*to|notify\s*party/i;

/** Marcas conocidas en membrete de factura (no modelo comercial). */
const MARCA_MEMBRETE_RE =
  /\b(CHERY(?:\s+AUTOMOBILE)?(?:\s+CO\.?,?\s*LTD\.?)?|NISSAN|TOYOTA|HYUNDAI|KIA|MITSUBISHI|CHEVROLET|FORD|HONDA|MAZDA|SUZUKI|RENAULT|PEUGEOT|FIAT|JEEP|GMC|BYD|GEELY|HAVAL|GREAT\s+WALL|DONGFENG|JAC|BAIC|FOTON|ISUZU|SUBARU|VOLKSWAGEN|VW|BMW|MERCEDES|AUDI)\b/i;

/**
 * Marca de fabricante válida (no modelo tipo Tiggo, no emisora MAV).
 */
export function isPlausibleMarcaFabricante(
  raw: string | null | undefined
): boolean {
  const t = (raw ?? "").trim();
  if (!t || t.length < 2 || t.length > 40) return false;
  if (MARCA_EMISORA_INVALIDA_RE.test(t)) return false;
  if (looksLikeCheryModelName(t)) return false;
  if (/^(marks|description|qty|unit|amount|code|total)$/i.test(t)) return false;
  return true;
}

/** Normaliza typo OCR y recorta ruido de membrete. */
export function normalizeMarcaFabricante(
  raw: string | null | undefined
): string | null {
  const t = (raw ?? "").trim().replace(/\s+/g, " ");
  if (!t) return null;
  if (/^cherr?y\b/i.test(t)) return "Chery";
  const m = t.match(MARCA_MEMBRETE_RE);
  if (m) {
    const brand = m[1]!.trim();
    if (/^chery/i.test(brand)) return "Chery";
    if (/^great\s+wall/i.test(brand)) return "Great Wall";
    return brand.replace(/\b\w/g, (c) => c.toUpperCase()).replace(/\s+/g, " ");
  }
  if (!isPlausibleMarcaFabricante(t)) return null;
  return t;
}

/**
 * En facturas Chery/Intercontinental la marca va en el MEMBRETE (cabecera),
 * no en la columna «Marks and numbers» (modelo) ni en el consignatario.
 */
export function extractMarcaFromFacturaText(text: string): string | null {
  if (!text.trim()) return null;
  const tableStart = text.search(
    /marks\s+and\s+numbers|description\s+of\s+goods|\bqty\b|\bunit\s+price\b|no\.\s*de\s+chasis|attached\s+sheet/i
  );
  const header =
    tableStart > 80 ? text.slice(0, tableStart) : text.slice(0, 2800);

  const labeled = header.match(
    /\b(?:MANUFACTURER|EXPORTER|SELLER|SUPPLIER|SHIPPER|BRAND|MARCA|MAKE)[:\s]+([A-Z][A-Za-z0-9\s&.,\-]{2,40})/i
  );
  if (labeled?.[1]) {
    const fromLabel = normalizeMarcaFabricante(labeled[1].split(/[,;|\n]/)[0]);
    if (fromLabel) return fromLabel;
  }

  const fromMembrete = header.match(MARCA_MEMBRETE_RE);
  if (fromMembrete) {
    return normalizeMarcaFabricante(fromMembrete[1] ?? fromMembrete[0]);
  }
  return null;
}

/** Prioriza marca del membrete de factura sobre fila/COO mal leídos. */
export function resolveMarcaFromFacturaSources(
  sharedMarca: string | null | undefined,
  rowMarca: string | null | undefined,
  plainText?: string | null,
  vin?: string | null
): string | null {
  const fromShared = normalizeMarcaFabricante(sharedMarca);
  if (fromShared) return fromShared;

  if (plainText) {
    const fromText = extractMarcaFromFacturaText(plainText);
    if (fromText) return fromText;
  }

  const fromRow = normalizeMarcaFabricante(rowMarca);
  if (fromRow && isPlausibleMarcaFabricante(fromRow)) return fromRow;

  if (looksLikeCheryVin(vin)) return "Chery";
  return null;
}

/** Propaga marca de cabecera a todas las filas; «Marks and numbers» → modelo. */
export function applyFacturaHeaderMarca(
  extracted: FacturaMultiLike,
  plainText?: string | null
): FacturaMultiLike {
  const sampleVin =
    extracted.vehiculos.find((v) => v.serialCarroceria ?? v.vin)?.serialCarroceria ??
    extracted.vehiculos.find((v) => v.vin)?.vin;
  const headerMarca = resolveMarcaFromFacturaSources(
    extracted.shared.marca,
    null,
    plainText,
    sampleVin ?? null
  );
  if (!headerMarca) return extracted;

  const shared = { ...extracted.shared, marca: headerMarca };
  const vehiculos = extracted.vehiculos.map((v) => {
    const rawMarca = v.marca?.trim() ?? "";
    const wrongMarca =
      rawMarca && (!isPlausibleMarcaFabricante(rawMarca) || looksLikeCheryModelName(rawMarca));
    const modeloFromWrongMarca =
      wrongMarca && looksLikeCheryModelName(rawMarca)
        ? inferCheryModelo(rawMarca, v.modelo) || rawMarca
        : null;
    return {
      ...v,
      marca: headerMarca,
      modelo: v.modelo?.trim() || modeloFromWrongMarca || v.modelo,
    };
  });
  return { shared, vehiculos };
}

/** Tras mapear filas OCR: marca desde cabecera/VIN; modelo desde Marks and numbers. */
export function finalizeFacturaMarcaModelo(
  shared: PuertoLibreRegistroScanFields,
  vehiculos: PuertoLibreRegistroScanFields[]
): { shared: PuertoLibreRegistroScanFields; vehiculos: PuertoLibreRegistroScanFields[] } {
  const sampleVin =
    vehiculos.find((v) => v.serialCarroceria?.trim())?.serialCarroceria ??
    vehiculos.find((v) => v.vin?.trim())?.vin;
  const headerMarca = resolveMarcaFromFacturaSources(
    shared.marca,
    null,
    undefined,
    sampleVin ?? null
  );
  const sharedOut = headerMarca ? { ...shared, marca: headerMarca } : { ...shared };

  const vehiculosOut = vehiculos.map((v) => {
    const rawMarca = v.marca?.trim() ?? "";
    const marcaInvalida = rawMarca && !isPlausibleMarcaFabricante(rawMarca);
    const fixed = repairCheryMarcaModelo(
      marcaInvalida ? null : v.marca,
      v.modelo || (marcaInvalida && looksLikeCheryModelName(rawMarca) ? rawMarca : null)
    );
    const marca =
      (rawMarca && isPlausibleMarcaFabricante(rawMarca)
        ? normalizeMarcaFabricante(rawMarca)
        : null) ||
      headerMarca ||
      fixed.marca ||
      (looksLikeCheryVin(v.serialCarroceria ?? v.vin) ? "Chery" : null);
    const modelo =
      fixed.modelo ||
      v.modelo ||
      (marcaInvalida && looksLikeCheryModelName(rawMarca)
        ? inferCheryModelo(rawMarca, v.modelo)
        : null);
    return sanitizeVehiculoRow({
      ...v,
      ...(marca ? { marca } : {}),
      ...(modelo ? { modelo } : {}),
    });
  });

  return { shared: sharedOut, vehiculos: vehiculosOut };
}

/**
 * Puntuación de fidelidad: prioriza filas con VIN válido + motor + color.
 */
export function scoreFacturaMulti(extracted: FacturaMultiLike): number {
  let score = 0;
  const seen = new Set<string>();
  for (const v of extracted.vehiculos) {
    const vin = normalizeVin(v.serialCarroceria ?? v.vin);
    if (!vin) continue;
    if (seen.has(vin)) continue;
    seen.add(vin);
    score += 10;
    if (normalizeMotor(v.serialMotor)) score += 4;
    if (normalizeColorCelda(v.color)) score += 2;
    if (v.observaciones && /llave|código|codigo/i.test(v.observaciones)) score += 1;
    if (v.anio) score += 1;
  }
  return score;
}

export function sanitizeVehiculoRow(
  row: PuertoLibreRegistroScanFields
): PuertoLibreRegistroScanFields {
  const rawColor = row.color?.trim() ?? "";
  const colorWasModelo = isModeloFragmentInColor(rawColor);
  const vin = normalizeVin(row.serialCarroceria ?? row.vin);
  const motor = normalizeMotor(row.serialMotor);
  const color = colorWasModelo ? null : normalizeColorCelda(row.color);
  const next: PuertoLibreRegistroScanFields = { ...row };

  if (vin) {
    next.serialCarroceria = vin;
    next.vin = vin;
  } else {
    // Limpiar basura OCR (":", "-") aunque el VIN quede incompleto
    const compact = compactAlnum(row.serialCarroceria ?? row.vin);
    if (compact) {
      next.serialCarroceria = compact;
      next.vin = compact;
    }
  }

  if (motor) next.serialMotor = motor;
  else if (row.serialMotor?.toUpperCase() === "POR-COMPLETAR") {
    next.serialMotor = "POR-COMPLETAR";
  }

  if (color) next.color = color;
  else if (colorWasModelo) delete next.color;

  const isChery =
    looksLikeCheryVin(vin ?? next.serialCarroceria) ||
    /^cherr?y$/i.test(row.marca?.trim() ?? "") ||
    looksLikeCheryModelName(row.marca);

  if (isChery) {
    const fixed = repairCheryMarcaModelo(next.marca ?? row.marca, next.modelo ?? row.modelo);
    next.marca = fixed.marca || "Chery";
    const inferred =
      inferCheryModelo(fixed.modelo, colorWasModelo ? rawColor : null) ||
      fixed.modelo;
    if (inferred) next.modelo = inferred;
  } else if (colorWasModelo && !next.modelo?.trim()) {
    next.modelo = rawColor;
  }

  if (!next.anio && vin) {
    const y = anioFromVin(vin);
    if (y != null) next.anio = String(y);
  }
  if (!next.condicion) next.condicion = "nuevo";
  if (next.kilometraje == null || next.kilometraje === "") next.kilometraje = "0";
  return next;
}

/**
 * Propaga marca/modelo Chery a filas incompletas del mismo lote.
 */
export function healCheryFacturaRows(
  extracted: FacturaMultiLike
): FacturaMultiLike {
  const vehiculos = extracted.vehiculos.map(sanitizeVehiculoRow);
  const anyChery = vehiculos.some(
    (v) =>
      looksLikeCheryVin(v.serialCarroceria ?? v.vin) ||
      /^cherr?y$/i.test(v.marca ?? "") ||
      looksLikeCheryModelName(v.marca)
  );
  if (!anyChery) {
    return { shared: extracted.shared, vehiculos };
  }

  const shared = { ...extracted.shared };
  if (!shared.marca?.trim() || /mav\s*trade/i.test(shared.marca)) {
    shared.marca = "Chery";
  }

  const bestModelo =
    inferCheryModelo(shared.modelo) ||
    vehiculos
      .map((v) => inferCheryModelo(v.modelo))
      .filter(Boolean)
      .sort((a, b) => (b?.length ?? 0) - (a?.length ?? 0))[0] ||
    null;

  if (bestModelo && !shared.modelo?.trim()) shared.modelo = bestModelo;

  const healed = vehiculos.map((v) => {
    const next = { ...v };
    const fixed = repairCheryMarcaModelo(next.marca, next.modelo);
    next.marca = fixed.marca || "Chery";
    if (!next.modelo?.trim() && bestModelo) next.modelo = bestModelo;
    else {
      const inferred =
        inferCheryModelo(fixed.modelo) ||
        inferCheryModelo(next.modelo) ||
        fixed.modelo;
      if (inferred) next.modelo = inferred;
    }
    if (isModeloFragmentInColor(next.color)) delete next.color;
    return next;
  });

  return {
    shared,
    vehiculos: healed,
  };
}

export function sanitizeFacturaMulti(
  extracted: FacturaMultiLike,
  plainText?: string | null
): FacturaMultiLike {
  const healed = healCheryFacturaRows(applyFacturaHeaderMarca(extracted, plainText));
  const vehiculos = healed.vehiculos.filter((v) =>
    Boolean(normalizeVin(v.serialCarroceria ?? v.vin))
  );
  return { shared: healed.shared, vehiculos };
}

function preferField(a: string | undefined, b: string | undefined): string | undefined {
  const aa = a?.trim();
  const bb = b?.trim();
  if (aa && bb) {
    // Preferir el más largo si uno parece truncado
    if (aa.toUpperCase() === "POR-COMPLETAR" && bb) return bb;
    if (bb.toUpperCase() === "POR-COMPLETAR" && aa) return aa;
    return aa.length >= bb.length ? aa : bb;
  }
  return aa || bb || undefined;
}

export function mergeFacturaMultiByVin(
  primary: FacturaMultiLike,
  secondary: FacturaMultiLike
): FacturaMultiLike {
  const byVin = new Map<string, PuertoLibreRegistroScanFields>();

  const ingest = (rows: PuertoLibreRegistroScanFields[]) => {
    for (const row of rows) {
      const clean = sanitizeVehiculoRow(row);
      const vin = normalizeVin(clean.serialCarroceria ?? clean.vin);
      if (!vin) continue;
      const prev = byVin.get(vin);
      if (!prev) {
        byVin.set(vin, clean);
        continue;
      }
      byVin.set(vin, {
        ...prev,
        ...clean,
        marca: preferField(
          isPlausibleMarcaFabricante(prev.marca) ? prev.marca : undefined,
          isPlausibleMarcaFabricante(clean.marca) ? clean.marca : undefined
        ),
        modelo: preferField(prev.modelo, clean.modelo),
        color: preferField(prev.color, clean.color),
        anio: preferField(prev.anio, clean.anio),
        serialMotor: preferField(prev.serialMotor, clean.serialMotor),
        serialCarroceria: vin,
        vin,
        observaciones: preferField(prev.observaciones, clean.observaciones),
        valorCif: preferField(prev.valorCif, clean.valorCif),
        paisOrigen: preferField(prev.paisOrigen, clean.paisOrigen),
      });
    }
  };

  ingest(primary.vehiculos);
  ingest(secondary.vehiculos);

  const shared: PuertoLibreRegistroScanFields = {
    ...secondary.shared,
    ...primary.shared,
  };
  for (const key of Object.keys(shared) as (keyof PuertoLibreRegistroScanFields)[]) {
    const a = primary.shared[key];
    const b = secondary.shared[key];
    if (typeof a === "string" || typeof b === "string") {
      const preferred = preferField(
        typeof a === "string" ? a : undefined,
        typeof b === "string" ? b : undefined
      );
      if (preferred) (shared as Record<string, string>)[key] = preferred;
    }
  }

  return {
    shared,
    vehiculos: [...byVin.values()],
  };
}

/**
 * Parser determinista de texto de hoja anexa MAV cuando el OCR/LLM
 * deja el texto en orden: unidad, VIN, motor, llave, color, código.
 */
export function parseMavHojaAnexaFromText(text: string): FacturaMultiLike | null {
  const cleaned = text.replace(/\s+/g, " ").toUpperCase();

  // VIN con o sin espacios (OCR pega "00001MF3PB…")
  const vinsFromBoundary = [...cleaned.matchAll(VIN_RE)].map((m) => m[1]!);
  const compact = cleaned.replace(/[^A-Z0-9]/g, "");
  const vinsEmbedded: string[] = [];
  let searchFrom = 0;
  while (searchFrom < compact.length) {
    const idx = compact.indexOf("MF3", searchFrom);
    if (idx < 0) break;
    vinsEmbedded.push(compact.slice(idx, idx + 17));
    searchFrom = idx + 1;
  }
  const uniqueVins = [
    ...new Set(
      [...vinsFromBoundary, ...vinsEmbedded]
        .map((v) => normalizeVin(v))
        .filter((v): v is string => !!v && v.length === 17 && v.startsWith("MF3"))
    ),
  ];
  if (uniqueVins.length < 2) return null;

  const vehiculos: PuertoLibreRegistroScanFields[] = [];

  // Intento fila completa: 00001 VIN MOTOR LLAVE COLOR COLOR2 CODIGO
  const rowRe =
    /(000\d{2}|\d{1,5})\s+([A-HJ-NPR-Z0-9]{17})\s+([A-Z0-9]{6,16})\s+(M\d{3,5})\s+([A-Z0-9]{2,4})\s+([A-Z]{2,4})\s+([A-Z0-9]{10,})/gi;
  let match: RegExpExecArray | null;
  const seen = new Set<string>();
  while ((match = rowRe.exec(cleaned)) !== null) {
    const vin = normalizeVin(match[2]);
    if (!vin || seen.has(vin)) continue;
    seen.add(vin);
    const color = normalizeColorCelda(`${match[5]} ${match[6]}`);
    const codigo = normalizeCodigoModelo(match[7]);
    const llave = normalizeLlave(match[4]);
    const motor = normalizeMotor(match[3]);
    const unidad = match[1];
    const obs = [
      unidad ? `Unidad ${unidad.padStart(5, "0")}` : null,
      llave ? `Llave ${llave}` : null,
      codigo ? `Código ${codigo}` : null,
    ]
      .filter(Boolean)
      .join(" · ");
    vehiculos.push(
      sanitizeVehiculoRow({
        serialCarroceria: vin,
        vin,
        serialMotor: motor ?? "POR-COMPLETAR",
        color: color ?? undefined,
        observaciones: obs || undefined,
        condicion: "nuevo",
        kilometraje: "0",
        anio: anioFromVin(vin)?.toString(),
      })
    );
  }

  // Fallback: emparejar VIN + motor cercanos en el texto
  if (vehiculos.length < uniqueVins.length) {
    for (const vin of uniqueVins) {
      if (seen.has(vin)) continue;
      const idx = cleaned.indexOf(vin);
      if (idx < 0) continue;
      const window = cleaned.slice(Math.max(0, idx - 30), idx + 80);
      const motorM = window.match(/\b([A-Z]{2,6}\d{5,10})\b/);
      const llaveM = window.match(/\b(M\d{3,5})\b/);
      const colorM = window.match(/\b([A-Z0-9]{2,4}\s+[A-Z]{2,4})\b/);
      const codigoM = window.match(/\b(SB[A-Z0-9]{10,})\b/);
      seen.add(vin);
      vehiculos.push(
        sanitizeVehiculoRow({
          serialCarroceria: vin,
          vin,
          serialMotor: normalizeMotor(motorM?.[1] ?? null) ?? "POR-COMPLETAR",
          color: normalizeColorCelda(colorM?.[1] ?? null) ?? undefined,
          observaciones: [
            llaveM?.[1] ? `Llave ${llaveM[1]}` : null,
            codigoM?.[1] ? `Código ${codigoM[1]}` : null,
          ]
            .filter(Boolean)
            .join(" · ") || undefined,
          condicion: "nuevo",
          kilometraje: "0",
        })
      );
    }
  }

  if (vehiculos.length === 0) return null;

  const facturaM = text.match(
    /(?:Factura|Invoice)\s*No\.?\s*[:#]?\s*([A-Z0-9._\-]+)/i
  );

  return {
    shared: {
      observaciones: facturaM?.[1] ? `Factura ${facturaM[1]}` : undefined,
    },
    vehiculos,
  };
}

export function countValidVinsInText(text: string): number {
  const vins = [...text.toUpperCase().matchAll(VIN_RE)]
    .map((m) => normalizeVin(m[1]))
    .filter(Boolean);
  return new Set(vins).size;
}
