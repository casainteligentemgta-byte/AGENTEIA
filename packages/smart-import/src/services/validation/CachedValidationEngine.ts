import { createHash } from "crypto";
import type { z } from "zod";
import type { ValidationResult } from "../../types/validation";
import { CacheManager } from "../cache/CacheManager";
import { ValidationEngine } from "./ValidationEngine";

export type CachedValidateOptions = {
  cacheKey?: string;
  cacheTTL?: number;
  useCache?: boolean;
};

/**
 * ValidationEngine con caché Redis/memoria (cache-aside).
 */
export class CachedValidationEngine extends ValidationEngine {
  private readonly cache: CacheManager;

  constructor(cache?: CacheManager) {
    super();
    this.cache = cache ?? new CacheManager();
  }

  private generateHash(data: unknown): string {
    return createHash("sha256").update(JSON.stringify(data)).digest("hex");
  }

  async validateBatchCached(
    records: unknown[],
    schema: z.ZodSchema,
    options: CachedValidateOptions = {}
  ): Promise<ValidationResult> {
    const { cacheKey, cacheTTL = 3600, useCache = true } = options;

    if (useCache) {
      const key =
        cacheKey ?? `validation:${this.generateHash(records)}`;
      try {
        const cached = await this.cache.get<ValidationResult>(key);
        if (cached) {
          console.log(
            "[smart-import.validation] ✓ Validación obtenida del caché"
          );
          return { ...cached, cacheHit: true };
        }
      } catch (err) {
        console.warn(
          "[smart-import.validation] Caché falló; fallback a validación:",
          err instanceof Error ? err.message : err
        );
      }

      console.log(
        `[smart-import.validation] ⚙️ Validando ${records.length} registros...`
      );
      const result = await super.validateBatch(records, schema);
      try {
        await this.cache.set(key, result, cacheTTL);
      } catch {
        /* fallback graceful */
      }
      return { ...result, cacheHit: false };
    }

    const result = await super.validateBatch(records, schema);
    return { ...result, cacheHit: false };
  }

  async invalidateValidationCache(
    pattern = "validation:*"
  ): Promise<void> {
    await this.cache.invalidatePattern(pattern);
  }

  async clearCache(): Promise<void> {
    await this.cache.clear();
  }

  getCacheManager(): CacheManager {
    return this.cache;
  }
}
