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

/** Fase 3 — confiabilidad */
export { RetryPolicy, isTransientError } from "./services/retry/RetryPolicy";
export {
  CircuitBreaker,
  CircuitState,
} from "./services/circuitbreaker/CircuitBreaker";
export { TransactionManager } from "./services/transaction/TransactionManager";
export { HealthCheck } from "./services/health/HealthCheck";
export {
  GracefulShutdown,
  gracefulShutdown,
} from "./api/middleware/gracefulShutdown";
export { createSmartImportApp, main as startSmartImportServer } from "./api/server";
export type { HealthStatus } from "./services/health/HealthCheck";
export type { CircuitBreakerMetrics } from "./services/circuitbreaker/CircuitBreaker";
export type { TransactionImportResult } from "./services/transaction/TransactionManager";
export type { RetryOptions } from "./services/retry/RetryPolicy";
export type { ShutdownConfig } from "./api/middleware/gracefulShutdown";
export { mountSwagger, swaggerSpec } from "./api/swagger";
