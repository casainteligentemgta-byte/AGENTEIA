import { z } from "zod";
import { compactAlnumVin, normalizeVinLoose } from "@/lib/importacion/vin-text";

export const VEHICLE_IMPORT_MAX = 50;

/** MIME aceptados en el paso 1. iOS a menudo manda type vacío: ahí vale la extensión. */
export const VEHICLE_IMPORT_DOC_MIMES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
] as const;

const DOC_MIME = new Set<string>(VEHICLE_IMPORT_DOC_MIMES);

/** iOS / WhatsApp etiquetan PDFs como json u octet-stream. */
const UNRELIABLE_DOC_MIMES = new Set([
  "",
  "application/octet-stream",
  "application/binary",
  "binary/octet-stream",
  "application/json",
  "text/plain",
  "text/html",
]);

function mimeOf(file: File): string {
  const raw = (file.type || "").split(";")[0].trim().toLowerCase();
  if (raw === "image/jpg" || raw === "image/pjpeg") return "image/jpeg";
  return raw;
}

function hasPdfName(fileName: string): boolean {
  return /\.pdf$/i.test(fileName);
}

function hasImageName(fileName: string): boolean {
  return /\.(jpe?g|png|webp|heic|heif)$/i.test(fileName);
}

export function isPdfOrImageFile(file: unknown): file is File {
  if (typeof File === "undefined" || !(file instanceof File)) return false;
  if (/\.(json|html?|txt|xml)$/i.test(file.name)) return false;
  const mime = mimeOf(file);
  if (DOC_MIME.has(mime)) return true;
  if (hasPdfName(file.name) || hasImageName(file.name)) return true;
  return UNRELIABLE_DOC_MIMES.has(mime) && file.size > 0;
}

export function isPdfFile(file: File): boolean {
  if (hasPdfName(file.name)) return true;
  const mime = mimeOf(file);
  if (mime === "application/pdf") return true;
  return UNRELIABLE_DOC_MIMES.has(mime) && !hasImageName(file.name);
}

/** Content-Type real para Storage. Nunca application/json. */
export function contentTypeForImportDoc(file: File): string {
  const mime = mimeOf(file);
  if (DOC_MIME.has(mime)) return mime;
  if (hasImageName(file.name)) {
    if (/\.png$/i.test(file.name)) return "image/png";
    if (/\.webp$/i.test(file.name)) return "image/webp";
    if (/\.heic$/i.test(file.name)) return "image/heic";
    if (/\.heif$/i.test(file.name)) return "image/heif";
    return "image/jpeg";
  }
  return "application/pdf";
}

const fileLike = z.custom<File>(
  (value) => typeof File !== "undefined" && value instanceof File,
  { message: "Archivo requerido" }
);

/** Paso 1, antes del OCR: solo archivos. Sin detectedVehicleCount. PDF o foto. */
export const vehicleImportUploadSchema = z.object({
  factura: fileLike.refine(
    (file) => isPdfOrImageFile(file),
    "La factura debe ser PDF o una foto nítida"
  ),
  certificados: z
    .array(fileLike)
    .min(1, "Al menos 1 certificado de origen")
    .refine(
      (files) => files.every(isPdfOrImageFile),
      "Los certificados deben ser PDF o foto"
    ),
});

export const vehicleImportCountSchema = z
  .number()
  .int()
  .min(1, "No se detectó ningún vehículo")
  .max(VEHICLE_IMPORT_MAX, `Máximo ${VEHICLE_IMPORT_MAX} vehículos por carga`);

const optionalText = z.string().optional().default("");

/** Campos que el OCR puede devolver incompletos (el VIN se endurece en review). */
export const vehicleImportExtractedVehicleSchema = z
  .object({
    marca: optionalText,
    modelo: optionalText,
    color: optionalText,
    anio: optionalText,
    vin: optionalText,
    serialCarroceria: optionalText,
    serialMotor: optionalText,
  })
  .passthrough();

/** Tras el OCR: conteo 1–50 + vehículos extraídos. No incluye File. */
export const vehicleImportExtractedSchema = z
  .object({
    detectedVehicleCount: vehicleImportCountSchema,
    vehicles: z
      .array(vehicleImportExtractedVehicleSchema)
      .min(1, "No se detectó ningún vehículo")
      .max(VEHICLE_IMPORT_MAX, `Máximo ${VEHICLE_IMPORT_MAX} vehículos por carga`),
  })
  .refine((data) => data.vehicles.length === data.detectedVehicleCount, {
    message: "La cantidad detectada no coincide con los vehículos extraídos",
    path: ["detectedVehicleCount"],
  });

const vinReviewSchema = z
  .string()
  .trim()
  .transform((raw) => normalizeVinLoose(raw, { strict: true }) ?? compactAlnumVin(raw).toUpperCase())
  .refine((value) => value.length === 17, "VIN debe tener 17 caracteres")
  .refine(
    (value) => /^[A-HJ-NPR-Z0-9]{17}$/.test(value),
    "VIN inválido (17 caracteres, sin I/O/Q)"
  );

/** Paso 2/3: VIN obligatorio 17 uppercase. Serial motor recomendado. Serial carrocería opcional. */
export const vehicleImportReviewSchema = z.object({
  marca: z.string().trim().optional().default(""),
  modelo: z.string().trim().optional().default(""),
  anio: z.string().trim().optional().default(""),
  color: z.string().trim().optional().default(""),
  vin: vinReviewSchema,
  serialMotor: z
    .string()
    .trim()
    .max(80)
    .optional()
    .default(""),
  serialCarroceria: z.string().trim().max(80).optional().default(""),
});

export function serialMotorRecommendedMissing(serialMotor: string | undefined): boolean {
  return !serialMotor?.trim();
}

export type VehicleImportUploadInput = z.infer<typeof vehicleImportUploadSchema>;
export type VehicleImportExtractedInput = z.infer<typeof vehicleImportExtractedSchema>;
export type VehicleImportReviewInput = z.infer<typeof vehicleImportReviewSchema>;

const vehicleDraftRowSchema = z
  .object({
    id: z.string().min(1),
    marca: z.string().optional(),
    modelo: z.string().optional(),
    vin: z.string().optional(),
  })
  .passthrough();

export const vehicleDraftInputSchema = z.object({
  importadorId: z.string().min(1, "Falta el cliente de la importación"),
  step: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  currentVehicleIndex: z.number().int().min(0),
  facturaName: z.string().nullable(),
  certificadoNames: z.array(z.string()),
  rows: z
    .array(vehicleDraftRowSchema)
    .max(VEHICLE_IMPORT_MAX, `Máximo ${VEHICLE_IMPORT_MAX} vehículos por carga`),
  extractedFieldKeys: z.record(z.array(z.string())).default({}),
  vinSources: z.record(z.unknown()).default({}),
  updatedAt: z.string().optional(),
});

export type VehicleDraftInput = z.infer<typeof vehicleDraftInputSchema>;
