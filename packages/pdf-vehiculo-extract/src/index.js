export {
  vehicleSchema,
  certificadoSchema,
  pdfExtractResultSchema,
  validationStatusSchema,
  parsePdfExtractResult,
  safeParsePdfExtractResult,
  normalizeVin,
  isVinValid,
  computeValidationStatus,
} from "./schemas/vehicles.js";

export {
  createSupabaseClient,
  isSupabaseConfigured,
} from "./config/supabase.js";

export {
  runPdfVehiculoExtractAgent,
  reinforceVinValidation,
  persistExtractRun,
} from "./agents/pdf-vehiculo-extract.js";
