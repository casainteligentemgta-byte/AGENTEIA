import { randomUUID } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { z } from "zod";
import type { ForeignKey, ValidationResult } from "../types/validation";
import { CacheManager } from "./cache/CacheManager";
import { CachedValidationEngine } from "./validation/CachedValidationEngine";
import { OptimizedReferenceValidator } from "./validation/OptimizedReferenceValidator";
import { StreamingDataTransformer } from "./transform/StreamingDataTransformer";
import { enqueueImport, type ImportJob } from "./ImportService";
import type { SmartImportUser } from "../api/middleware/auth";
import {
  RetryPolicy,
  isTransientError,
} from "./retry/RetryPolicy";
import { CircuitBreaker } from "./circuitbreaker/CircuitBreaker";
import {
  TransactionManager,
  type TransactionImportResult,
} from "./transaction/TransactionManager";
import { logger } from "./logging/Logger";
import { metricsCollector } from "./metrics/MetricsCollector";
import { tracer } from "./tracing/Tracer";

export type ImportStrategyOptions = {
  targetTable: string;
  schema: z.ZodSchema;
  mapping?: Record<string, string>;
  foreignKeys?: ForeignKey[];
  supabase?: SupabaseClient;
  useCache?: boolean;
  streaming?: boolean;
  batchSize?: number;
  useTransactions?: boolean;
  onProgress?: (processed: number, phase: string) => void;
  user: SmartImportUser;
};

export type ImportStrategyResult = {
  job: ImportJob;
  validation: ValidationResult;
  transformedCount: number;
  referenceErrors: number;
  transaction?: TransactionImportResult;
};

export type ImportMetrics = {
  duration: number;
  queriesCount: number;
  cacheHits: number;
  validationMs: number;
  transformMs: number;
  insertMs: number;
};

export type ImportWithMetricsResult = {
  result: ImportStrategyResult;
  metrics: ImportMetrics;
};

export type ResilienceMetrics = {
  retries: number;
  rollbacks: number;
  circuitBreakerOpenings: number;
};

export type ImportWithResilienceResult = {
  result: ImportStrategyResult;
  metrics: ResilienceMetrics & Partial<ImportMetrics>;
};

/**
 * Orquestador Fase 2+3: caché/streaming + retry/circuit breaker/transacciones.
 */
export class SmartImporter {
  private readonly cache: CacheManager;
  private readonly validationEngine: CachedValidationEngine;
  private readonly referenceValidator: OptimizedReferenceValidator;
  private readonly transformer: StreamingDataTransformer;
  private readonly circuitBreaker: CircuitBreaker;
  private transactionManager: TransactionManager | null;
  private retries = 0;
  private circuitBreakerOpenings = 0;

  constructor(options?: {
    cache?: CacheManager;
    mapping?: Record<string, string>;
    batchSize?: number;
    supabase?: SupabaseClient;
    circuitBreaker?: CircuitBreaker;
  }) {
    this.cache = options?.cache ?? new CacheManager();
    this.validationEngine = new CachedValidationEngine(this.cache);
    this.referenceValidator = new OptimizedReferenceValidator(this.cache);
    this.transformer = new StreamingDataTransformer(
      options?.mapping ?? {},
      options?.batchSize ?? 1000
    );
    this.circuitBreaker =
      options?.circuitBreaker ?? new CircuitBreaker("smartimport");
    this.transactionManager = options?.supabase
      ? new TransactionManager(options.supabase)
      : null;
  }

  async importWithStrategy(
    records: Record<string, unknown>[],
    options: ImportStrategyOptions
  ): Promise<ImportStrategyResult> {
    const {
      targetTable,
      schema,
      mapping,
      foreignKeys = [],
      supabase,
      useCache = true,
      streaming = true,
      useTransactions = false,
      batchSize = 100,
      onProgress,
      user,
    } = options;

    const importId = randomUUID();
    const startedAt = performance.now();
    const span = tracer.startSpan("import.execute", {
      importId,
      table: targetTable,
      recordCount: records.length,
    });
    metricsCollector.incActiveImports();
    logger.info("Import started", {
      importId,
      table: targetTable,
      recordCount: records.length,
      userId: user.id,
    });

    try {
      if (mapping) {
        this.transformer.setMapping(mapping);
      }
      if (supabase && !this.transactionManager) {
        this.transactionManager = new TransactionManager(supabase);
      }

      onProgress?.(0, "validation");
      logger.debug("Processing batch", {
        importId,
        batchNumber: 1,
        recordCount: records.length,
        phase: "validation",
      });
      const validationStarted = performance.now();
      const validation = await this.validationEngine.validateBatchCached(
        records,
        schema,
        { useCache }
      );
      const validationSec =
        (performance.now() - validationStarted) / 1000;
      metricsCollector.recordValidationDuration(
        records.length,
        validationSec
      );

      if (!validation.valid) {
        metricsCollector.recordError("validation", targetTable);
        throw new Error(
          `Validación fallida: ${validation.errors[0]?.message ?? "datos inválidos"}`
        );
      }

      if (validation.cacheHit) {
        metricsCollector.recordCacheHit();
      } else {
        metricsCollector.recordCacheMiss();
      }

      let referenceErrors = 0;
      if (foreignKeys.length > 0 && supabase) {
        onProgress?.(records.length, "references");
        const refStarted = performance.now();
        const refErrors = await this.withResilience(() =>
          this.referenceValidator.validateReferencesOptimized(
            records,
            foreignKeys,
            supabase
          )
        );
        metricsCollector.recordDBQuery(
          "validate_refs",
          targetTable,
          (performance.now() - refStarted) / 1000
        );
        referenceErrors = refErrors.length;
        if (refErrors.length > 0) {
          metricsCollector.recordError("reference", targetTable);
          throw new Error(refErrors[0]!.message);
        }
      }

      onProgress?.(0, "transform");
      logger.debug("Processing batch", {
        importId,
        batchNumber: 1,
        recordCount: records.length,
        phase: "transform",
      });
      const t0 = performance.now();
      const transformed = streaming
        ? await this.transformer.transformStream(records, (n) =>
            onProgress?.(n, "transform")
          )
        : this.transformer.transformBatch(records);
      const transformMs = performance.now() - t0;
      metricsCollector.recordTransformDuration(transformMs / 1000);
      logger.info("Transform completed", {
        importId,
        rows: transformed.length,
        duration_ms: Number(transformMs.toFixed(1)),
        cacheHit: Boolean(validation.cacheHit),
      });

      onProgress?.(transformed.length, "insert");
      let transaction: TransactionImportResult | undefined;

      if (useTransactions && this.transactionManager && supabase) {
        const insertStarted = performance.now();
        transaction = await this.withResilience(() =>
          this.transactionManager!.importWithTransactions(
            transformed,
            targetTable,
            batchSize
          )
        );
        metricsCollector.recordDBQuery(
          "insert",
          targetTable,
          (performance.now() - insertStarted) / 1000
        );
        logger.info("Transaction import completed", {
          importId,
          imported: transaction.imported,
          failed: transaction.failed,
          rollbacks: transaction.rollbacks,
        });
      }

      const job = await this.withResilience(() =>
        enqueueImport({
          user,
          targetTable,
          data: transformed,
        })
      );

      const durationSec = (performance.now() - startedAt) / 1000;
      const imported = transaction?.imported ?? transformed.length;
      const failed = transaction?.failed ?? 0;
      const success = failed === 0;
      metricsCollector.recordImport(
        targetTable,
        success ? "success" : "failure",
        imported,
        durationSec
      );
      logger.info("Import completed", {
        importId,
        table: targetTable,
        imported,
        failed,
        duration_ms: Number((durationSec * 1000).toFixed(1)),
        jobId: job.id,
      });

      return {
        job,
        validation,
        transformedCount: transformed.length,
        referenceErrors,
        transaction,
      };
    } catch (err) {
      const durationSec = (performance.now() - startedAt) / 1000;
      metricsCollector.recordImport(
        targetTable,
        "failure",
        0,
        durationSec
      );
      metricsCollector.recordError("import", targetTable);
      logger.error(
        "Import failed",
        err instanceof Error ? err : new Error(String(err)),
        { importId, table: targetTable }
      );
      span.recordException(
        err instanceof Error ? err : new Error(String(err))
      );
      throw err;
    } finally {
      metricsCollector.decActiveImports();
      span.end();
    }
  }

  /**
   * Retry + circuit breaker alrededor de una operación.
   */
  private async withResilience<T>(fn: () => Promise<T>): Promise<T> {
    return RetryPolicy.execute(
      async () => {
        try {
          return await this.circuitBreaker.call(fn);
        } catch (err) {
          if (
            err instanceof Error &&
            err.message.includes("CircuitBreaker is OPEN")
          ) {
            this.circuitBreakerOpenings += 1;
          }
          throw err;
        }
      },
      {
        maxAttempts: 3,
        initialDelayMs: 1000,
        shouldRetry: (error) => {
          if (error.message.includes("CircuitBreaker is OPEN")) return false;
          const ok = isTransientError(error);
          if (ok) this.retries += 1;
          return ok;
        },
        onRetry: (attempt, error) => {
          console.log(
            `[smart-import.resilience] retry #${attempt}: ${error.message}`
          );
        },
      }
    );
  }

  async importWithMetrics(
    records: Record<string, unknown>[],
    options: ImportStrategyOptions
  ): Promise<ImportWithMetricsResult> {
    const start = performance.now();
    const result = await this.importWithStrategy(records, options);
    const duration = performance.now() - start;
    return {
      result,
      metrics: {
        duration,
        queriesCount: 1 + (result.transaction?.batches ?? 0),
        cacheHits: result.validation.cacheHit ? 1 : 0,
        validationMs: 0,
        transformMs: 0,
        insertMs: duration,
      },
    };
  }

  /**
   * Importación con métricas de resiliencia (retries / rollbacks / CB).
   */
  async importWithResilience(
    records: Record<string, unknown>[],
    options: ImportStrategyOptions
  ): Promise<ImportWithResilienceResult> {
    this.retries = 0;
    this.circuitBreakerOpenings = 0;
    const beforeOpenings = this.circuitBreaker.getMetrics().failureCount;

    const start = performance.now();
    const result = await this.importWithStrategy(records, {
      ...options,
      useTransactions: options.useTransactions ?? Boolean(options.supabase),
    });
    const duration = performance.now() - start;

    const metrics: ResilienceMetrics & Partial<ImportMetrics> = {
      retries: this.retries,
      rollbacks: result.transaction?.rollbacks ?? 0,
      circuitBreakerOpenings: this.circuitBreakerOpenings,
      duration,
    };

    console.log(
      `[smart-import.resilience] duration=${duration.toFixed(1)}ms retries=${metrics.retries} rollbacks=${metrics.rollbacks} cbOpenings=${metrics.circuitBreakerOpenings} failuresBefore=${beforeOpenings}`
    );

    return { result, metrics };
  }

  getValidationEngine(): CachedValidationEngine {
    return this.validationEngine;
  }

  getReferenceValidator(): OptimizedReferenceValidator {
    return this.referenceValidator;
  }

  getTransformer(): StreamingDataTransformer {
    return this.transformer;
  }

  getCircuitBreaker(): CircuitBreaker {
    return this.circuitBreaker;
  }

  getTransactionManager(): TransactionManager | null {
    return this.transactionManager;
  }

  async disconnect(): Promise<void> {
    await this.cache.disconnect();
  }
}
