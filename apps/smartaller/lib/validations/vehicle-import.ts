import { z } from "zod";

export const VEHICLE_IMPORT_MAX = 50;

export function isPdfOrImageFile(file: File): boolean {
  if (file.type === "application/pdf" || /\.pdf$/i.test(file.name)) return true;
  if (/^image\//.test(file.type)) return true;
  return /\.(jpe?g|png|webp|heic|heif)$/i.test(file.name);
}

export function isPdfFile(file: File): boolean {
  return file.type === "application/pdf" || /\.pdf$/i.test(file.name);
}

const fileLike = z.custom<File>(
  (value) => typeof File !== "undefined" && value instanceof File,
  { message: "Archivo requerido" }
);

/** Paso 1, antes del OCR: solo archivos. PDF o foto (iOS a menudo manda MIME vacío o HEIC). El conteo va en vehicleImportExtractedSchema. */
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

/** Tras el OCR: factura + certificados + cantidad detectada (tope de carga masiva). */
export const vehicleImportExtractedSchema = vehicleImportUploadSchema.extend({
  detectedVehicleCount: vehicleImportCountSchema,
});

export type VehicleImportUploadInput = z.infer<typeof vehicleImportUploadSchema>;

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
