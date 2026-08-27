import type { SupabaseClient } from "@supabase/supabase-js";
import type { ForeignKey, ValidationError } from "../../types/validation";
import { CacheManager } from "../cache/CacheManager";

/**
 * Valida FKs en bulk (1 query por FK) con caché de IDs existentes.
 * Evita el patrón N+1 de consultar fila a fila.
 */
export class OptimizedReferenceValidator {
  private readonly cache: CacheManager;

  constructor(cache?: CacheManager) {
    this.cache = cache ?? new CacheManager();
  }

  async validateReferencesOptimized(
    records: Record<string, unknown>[],
    foreignKeys: ForeignKey[],
    supabase: SupabaseClient
  ): Promise<ValidationError[]> {
    const errors: ValidationError[] = [];

    for (const fk of foreignKeys) {
      const uniqueValues = [
        ...new Set(
          records
            .map((row) => row[fk.field])
            .filter((v) => v !== null && v !== undefined && v !== "")
        ),
      ];

      if (uniqueValues.length === 0) continue;

      const cacheKey = `refs:${fk.table}:${fk.column}`;
      let existingIds = await this.cache.get<unknown[]>(cacheKey);

      if (!existingIds) {
        // Query única (BULK) en lugar de N selects.
        const { data, error } = await supabase
          .from(fk.table)
          .select(fk.column)
          .in(fk.column, uniqueValues as (string | number)[]);

        if (error) {
          errors.push({
            field: fk.field,
            message: `No se pudieron validar referencias en ${fk.table}: ${error.message}`,
            code: "REF_QUERY_FAILED",
          });
          continue;
        }

        existingIds = (data ?? []).map((row) => {
          const record = row as unknown as Record<string, unknown>;
          return record[fk.column];
        });
        await this.cache.set(cacheKey, existingIds, 3600);
      }

      const existingSet = new Set(
        existingIds.map((id) => String(id))
      );

      records.forEach((row, rowIndex) => {
        const value = row[fk.field];
        if (value === null || value === undefined || value === "") return;
        if (!existingSet.has(String(value))) {
          errors.push({
            rowIndex,
            field: fk.field,
            value,
            message: `Referencia inválida: ${fk.field}=${String(value)} no existe en ${fk.table}.${fk.column}`,
            code: "INVALID_REFERENCE",
          });
        }
      });
    }

    return errors;
  }

  /**
   * Variante en memoria para benchmarks / tests sin Supabase.
   * Simula N+1 vs bulk sobre un Set de IDs válidos.
   */
  validateReferencesInMemory(
    records: Record<string, unknown>[],
    field: string,
    validIds: Set<string>,
    mode: "bulk" | "n1"
  ): ValidationError[] {
    const errors: ValidationError[] = [];

    if (mode === "n1") {
      for (let i = 0; i < records.length; i++) {
        const value = records[i]?.[field];
        if (value == null || value === "") continue;
        // Simula coste de lookup individual.
        const ok = validIds.has(String(value));
        if (!ok) {
          errors.push({
            rowIndex: i,
            field,
            value,
            message: "Referencia inválida",
            code: "INVALID_REFERENCE",
          });
        }
      }
      return errors;
    }

    const unique = [
      ...new Set(
        records
          .map((r) => r[field])
          .filter((v) => v !== null && v !== undefined && v !== "")
          .map(String)
      ),
    ];
    const existing = new Set(unique.filter((id) => validIds.has(id)));
    records.forEach((row, rowIndex) => {
      const value = row[field];
      if (value == null || value === "") return;
      if (!existing.has(String(value))) {
        errors.push({
          rowIndex,
          field,
          value,
          message: "Referencia inválida",
          code: "INVALID_REFERENCE",
        });
      }
    });
    return errors;
  }

  async invalidateReferenceCache(table: string): Promise<void> {
    await this.cache.invalidatePattern(`refs:${table}:*`);
  }

  getCacheManager(): CacheManager {
    return this.cache;
  }
}
