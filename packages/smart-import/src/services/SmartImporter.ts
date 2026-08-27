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

    if (mapping) {
      this.transformer.setMapping(mapping);
    }
    if (supabase && !this.transactionManager) {
      this.transactionManager = new TransactionManager(supabase);
    }

    onProgress?.(0, "validation");
    const validation = await this.validationEngine.validateBatchCached(
      records,
      schema,
      { useCache }
    );

    if (!validation.valid) {
      throw new Error(
        `Validación fallida: ${validation.errors[0]?.message ?? "datos inválidos"}`
      );
    }

    let referenceErrors = 0;
    if (foreignKeys.length > 0 && supabase) {
      onProgress?.(records.length, "references");
      const refErrors = await this.withResilience(() =>
        this.referenceValidator.validateReferencesOptimized(
          records,
          foreignKeys,
          supabase
        )
      );
      referenceErrors = refErrors.length;
      if (refErrors.length > 0) {
        throw new Error(refErrors[0]!.message);
      }
    }

    onProgress?.(0, "transform");
    const t0 = performance.now();
    const transformed = streaming
      ? await this.transformer.transformStream(records, (n) =>
          onProgress?.(n, "transform")
        )
      : this.transformer.transformBatch(records);
    const transformMs = performance.now() - t0;
    console.log(
      `[smart-import] Transform ${transformed.length} rows in ${transformMs.toFixed(1)}ms` +
        (validation.cacheHit ? " (validation cache hit)" : "")
    );

    onProgress?.(transformed.length, "insert");
    let transaction: TransactionImportResult | undefined;

    if (useTransactions && this.transactionManager && supabase) {
      transaction = await this.withResilience(() =>
        this.transactionManager!.importWithTransactions(
          transformed,
          targetTable,
          batchSize
        )
      );
      console.log(
        `[smart-import.resilience] tx imported=${transaction.imported} failed=${transaction.failed} rollbacks=${transaction.rollbacks}`
      );
    }

    const job = await this.withResilience(() =>
      enqueueImport({
        user,
        targetTable,
        data: transformed,
      })
    );

    return {
      job,
      validation,
      transformedCount: transformed.length,
      referenceErrors,
      transaction,
    };
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
