export { FILE_CONFIG, MAX_FILE_SIZE, MAX_BATCH_SIZE } from "./config/fileConfig";
export {
  FileParser,
  fileParser,
  type ParsedRecord,
  type ParseFileInput,
  type FileValidationResult,
  type ParseFileOptions,
} from "./services/FileParser";
export {
  requireAuth,
  requireRole,
  requireTablePermission,
  requireBodyTablePermission,
  TABLE_PERMISSIONS,
  type AuthenticatedRequest,
  type SmartImportUser,
  type SmartImportRole,
} from "./api/middleware/auth";
export {
  importLimiter,
  apiLimiter,
  passthroughLimiter,
} from "./api/middleware/rateLimit";
export { default as importRouter } from "./api/routes/import";
export {
  enqueueImport,
  getImportJob,
  isValidTargetTable,
  isExecuteTargetTable,
  EXECUTE_TARGET_TABLES,
  analyzeRecords,
  validateRecords,
  transformRecords,
} from "./services/ImportService";

/** Fase 2 — caché y optimización */
export { CacheManager } from "./services/cache/CacheManager";
export { ValidationEngine } from "./services/validation/ValidationEngine";
export { CachedValidationEngine } from "./services/validation/CachedValidationEngine";
export { OptimizedReferenceValidator } from "./services/validation/OptimizedReferenceValidator";
export { DataTransformer } from "./services/transform/DataTransformer";
export { StreamingDataTransformer } from "./services/transform/StreamingDataTransformer";
export { SmartImporter } from "./services/SmartImporter";
export type {
  ValidationError,
  ValidationResult,
  ForeignKey,
} from "./types/validation";
