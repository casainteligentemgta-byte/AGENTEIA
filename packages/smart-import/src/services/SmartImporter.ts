import type { SupabaseClient } from "@supabase/supabase-js";
import type { z } from "zod";
import type { ForeignKey, ValidationResult } from "../types/validation";
import { CacheManager } from "./cache/CacheManager";
import { CachedValidationEngine } from "./validation/CachedValidationEngine";
import { OptimizedReferenceValidator } from "./validation/OptimizedReferenceValidator";
import { StreamingDataTransformer } from "./transform/StreamingDataTransformer";
import { enqueueImport, type ImportJob } from "./ImportService";
import type { SmartImportUser } from "../api/middleware/auth";

export type ImportStrategyOptions = {
  targetTable: string;
  schema: z.ZodSchema;
  mapping?: Record<string, string>;
  foreignKeys?: ForeignKey[];
  supabase?: SupabaseClient;
  useCache?: boolean;
  streaming?: boolean;
  onProgress?: (processed: number, phase: string) => void;
  user: SmartImportUser;
};

export type ImportStrategyResult = {
  job: ImportJob;
  validation: ValidationResult;
  transformedCount: number;
  referenceErrors: number;
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

/**
 * Orquestador Fase 2: validación cacheada + refs bulk + transform streaming.
 */
export class SmartImporter {
  private readonly cache: CacheManager;
  private readonly validationEngine: CachedValidationEngine;
  private readonly referenceValidator: OptimizedReferenceValidator;
  private readonly transformer: StreamingDataTransformer;

  constructor(options?: {
    cache?: CacheManager;
    mapping?: Record<string, string>;
    batchSize?: number;
  }) {
    this.cache = options?.cache ?? new CacheManager();
    this.validationEngine = new CachedValidationEngine(this.cache);
    this.referenceValidator = new OptimizedReferenceValidator(this.cache);
    this.transformer = new StreamingDataTransformer(
      options?.mapping ?? {},
      options?.batchSize ?? 1000
    );
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
      onProgress,
      user,
    } = options;

    if (mapping) {
      this.transformer.setMapping(mapping);
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
      const refErrors =
        await this.referenceValidator.validateReferencesOptimized(
          records,
          foreignKeys,
          supabase
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
    const job = await enqueueImport({
      user,
      targetTable,
      data: transformed,
    });

    return {
      job,
      validation,
      transformedCount: transformed.length,
      referenceErrors,
    };
  }

  async importWithMetrics(
    records: Record<string, unknown>[],
    options: ImportStrategyOptions
  ): Promise<ImportWithMetricsResult> {
    const start = performance.now();
    let validationMs = 0;
    let transformMs = 0;
    let insertMs = 0;
    let cacheHits = 0;
    let queriesCount = 0;

    const tVal = performance.now();
    const validation = await this.validationEngine.validateBatchCached(
      records,
      options.schema,
      { useCache: options.useCache ?? true }
    );
    validationMs = performance.now() - tVal;
    if (validation.cacheHit) cacheHits += 1;
    else queriesCount += 1;

    if (!validation.valid) {
      throw new Error(
        `Validación fallida: ${validation.errors[0]?.message ?? "datos inválidos"}`
      );
    }

    if (options.foreignKeys?.length && options.supabase) {
      queriesCount += options.foreignKeys.length;
      const refErrors =
        await this.referenceValidator.validateReferencesOptimized(
          records,
          options.foreignKeys,
          options.supabase
        );
      if (refErrors.length > 0) throw new Error(refErrors[0]!.message);
    }

    const tTr = performance.now();
    const transformed =
      options.streaming === false
        ? this.transformer.transformBatch(records)
        : await this.transformer.transformStream(records);
    transformMs = performance.now() - tTr;

    const tIns = performance.now();
    const job = await enqueueImport({
      user: options.user,
      targetTable: options.targetTable,
      data: transformed,
    });
    insertMs = performance.now() - tIns;
    queriesCount += 1;

    const duration = performance.now() - start;
    console.log(
      `[smart-import.metrics] duration=${duration.toFixed(1)}ms val=${validationMs.toFixed(1)}ms tr=${transformMs.toFixed(1)}ms ins=${insertMs.toFixed(1)}ms cacheHits=${cacheHits} queries=${queriesCount}`
    );

    return {
      result: {
        job,
        validation,
        transformedCount: transformed.length,
        referenceErrors: 0,
      },
      metrics: {
        duration,
        queriesCount,
        cacheHits,
        validationMs,
        transformMs,
        insertMs,
      },
    };
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

  async disconnect(): Promise<void> {
    await this.cache.disconnect();
  }
}
