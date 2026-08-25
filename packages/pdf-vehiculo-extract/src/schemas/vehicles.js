import { z } from "zod";

/** Semáforo de completitud / consistencia por vehículo. */
export const validationStatusSchema = z.enum(["verde", "ambar", "rojo"]);

export const vehicleSchema = z.object({
  vin: z.string().min(1),
  marca: z.string(),
  modelo: z.string(),
  año: z.number().int().min(1980).max(2100).nullable(),
  color: z.string(),
  numeroMotor: z.string(),
  /** Rara en factura de importación. */
  numeroPlaca: z.string().nullable(),
  precio: z.number().finite().nullable(),
  validationStatus: validationStatusSchema,
});

export const certificadoSchema = z.object({
  vin: z.string(),
  paisOrigen: z.string(),
  fechaEmision: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Usar YYYY-MM-DD")
    .nullable(),
  autoridadEmisora: z.string().nullable().optional(),
  tipoCertificado: z.string().nullable().optional(),
  numerocertificado: z.string(),
  estado: z.string().nullable(),
});

export const pdfExtractResultSchema = z.object({
  status: z.enum(["success", "processing", "error"]),
  vehicles: z.array(vehicleSchema),
  certificados: z.array(certificadoSchema),
  errores: z.array(z.string()),
});

/**
 * @typedef {z.infer<typeof vehicleSchema>} Vehicle
 * @typedef {z.infer<typeof certificadoSchema>} Certificado
 * @typedef {z.infer<typeof pdfExtractResultSchema>} PdfExtractResult
 */

/**
 * Valida el DTO de extracción. Lanza ZodError si no cumple el contrato.
 * @param {unknown} data
 * @returns {import("zod").infer<typeof pdfExtractResultSchema>}
 */
export function parsePdfExtractResult(data) {
  return pdfExtractResultSchema.parse(data);
}

/**
 * Validación segura (no lanza).
 * @param {unknown} data
 */
export function safeParsePdfExtractResult(data) {
  return pdfExtractResultSchema.safeParse(data);
}

/**
 * Normaliza VIN (alfanumérico mayúsculas; corrige prefijos LWV→LVV frecuentes en OCR).
 * @param {string | null | undefined} raw
 */
export function normalizeVin(raw) {
  let v = String(raw ?? "")
    .replace(/[^A-Za-z0-9]/g, "")
    .toUpperCase();
  if (/^LWV|^LV[WY]|^LYV|^LWW/.test(v)) v = `LVV${v.slice(3)}`;
  return v;
}

/**
 * @param {string | null | undefined} raw
 */
export function isVinValid(raw) {
  const v = normalizeVin(raw);
  return v.length === 17 && /^[A-HJ-NPR-Z0-9]{17}$/.test(v);
}

/**
 * Calcula semáforo a partir de campos del vehículo (sin match de certificado).
 * @param {{ marca?: string, modelo?: string, color?: string, año?: number|null, numeroMotor?: string, vin?: string }} v
 * @returns {"verde"|"ambar"|"rojo"}
 */
export function computeValidationStatus(v) {
  const vin = normalizeVin(v.vin);
  const marca = String(v.marca ?? "").trim();
  const modelo = String(v.modelo ?? "").trim();
  const color = String(v.color ?? "").trim();
  const motor = String(v.numeroMotor ?? "").trim();
  const anio = v.año;

  if (!isVinValid(vin) || !marca || !modelo) return "rojo";
  if (!color || !motor || anio == null) return "ambar";
  return "verde";
}
