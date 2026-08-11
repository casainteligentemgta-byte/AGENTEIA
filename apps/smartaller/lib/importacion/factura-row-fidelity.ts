/**
 * Normalización y fidelidad de filas extraídas de facturas multi-vehículo
 * (hoja anexa MAV, carátulas Chery, etc.).
 */

import type { PuertoLibreRegistroScanFields } from "@/lib/extract-puerto-libre-docs";
import { anioFromVin } from "@/lib/ai/image-orient";

const VIN_RE = /\b([A-HJ-NPR-Z0-9]{17})\b/gi;

export type FacturaMultiLike = {
  shared: PuertoLibreRegistroScanFields;
  vehiculos: PuertoLibreRegistroScanFields[];
};

export function compactAlnum(raw: string | null | undefined): string {
  return (raw ?? "").replace(/[^A-Za-z0-9]/g, "").toUpperCase();
}

/** VIN: 17 chars, sin I/O/Q. */
export function normalizeVin(raw: string | null | undefined): string | null {
  let v = compactAlnum(raw);
  if (!v) return null;
  // Correcciones OCR frecuentes en VIN
  v = v.replace(/[IOQ]/g, (ch) => (ch === "O" ? "0" : ch === "I" ? "1" : "0"));
  if (v.length !== 17) return v.length >= 11 ? v : null;
  if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(v)) return null;
  return v;
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
  return t;
}

export function normalizeCodigoModelo(raw: string | null | undefined): string | null {
  const t = compactAlnum(raw);
  if (!t) return null;
  if (t.length === 17 && /^[A-HJ-NPR-Z0-9]{17}$/.test(t)) return null; // es VIN
  if (t.length < 8) return null;
  return t;
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
  const vin = normalizeVin(row.serialCarroceria ?? row.vin);
  const motor = normalizeMotor(row.serialMotor);
  const color = normalizeColorCelda(row.color);
  const next: PuertoLibreRegistroScanFields = { ...row };
  if (vin) {
    next.serialCarroceria = vin;
    next.vin = vin;
  }
  if (motor) next.serialMotor = motor;
  else if (row.serialMotor?.toUpperCase() === "POR-COMPLETAR") {
    next.serialMotor = "POR-COMPLETAR";
  }
  if (color) next.color = color;
  if (!next.anio && vin) {
    const y = anioFromVin(vin);
    if (y != null) next.anio = String(y);
  }
  if (!next.condicion) next.condicion = "nuevo";
  if (next.kilometraje == null || next.kilometraje === "") next.kilometraje = "0";
  return next;
}

export function sanitizeFacturaMulti(extracted: FacturaMultiLike): FacturaMultiLike {
  const vehiculos = extracted.vehiculos
    .map(sanitizeVehiculoRow)
    .filter((v) => Boolean(normalizeVin(v.serialCarroceria ?? v.vin)));
  return { shared: extracted.shared, vehiculos };
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
        marca: preferField(prev.marca, clean.marca),
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
  if (!/HOJA\s*ANEXA|ATTACHED\s*SHEET|NO\.\s*DE\s*CHASIS|VIN\s*NUMBER/i.test(text)) {
    // Aún así intentar si hay varios VIN tipo MF3…
  }

  const vins = [...cleaned.matchAll(VIN_RE)].map((m) => m[1]!);
  const uniqueVins = [...new Set(vins.map((v) => normalizeVin(v)).filter(Boolean))] as string[];
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
