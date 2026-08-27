import type { SupabaseClient } from "@supabase/supabase-js";

export type SavepointConfig = {
  name: string;
  recordCount: number;
  timestamp: Date;
};

export type BatchImportResult = {
  success: boolean;
  imported: number;
  failed: number;
  failedRecords: Record<string, unknown>[];
};

export type TransactionImportResult = {
  imported: number;
  failed: number;
  failedRecords: Record<string, unknown>[];
  batches: number;
  rollbacks: number;
};

/**
 * Importación por lotes con savepoints (RPC Postgres o simulación en memoria).
 * Si las RPC no existen en el proyecto, usa tracking local para tests/dev.
 */
export class TransactionManager {
  private readonly supabase: SupabaseClient;
  private readonly savepoints: SavepointConfig[] = [];
  /** Simulación local cuando RPC no está disponible. */
  private readonly localSavepoints = new Set<string>();
  private useLocalFallback = false;

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
  }

  async createSavepoint(name: string, recordCount = 0): Promise<void> {
    if (!this.useLocalFallback) {
      const { error } = await this.supabase.rpc("create_savepoint", {
        sp_name: name,
      });
      if (error) {
        console.warn(
          `[smart-import.tx] RPC create_savepoint no disponible (${error.message}); usando fallback local`
        );
        this.useLocalFallback = true;
      }
    }

    if (this.useLocalFallback) {
      this.localSavepoints.add(name);
    }

    this.savepoints.push({
      name,
      recordCount,
      timestamp: new Date(),
    });
    console.log(`💾 Savepoint ${name} creado`);
  }

  async rollbackToSavepoint(name: string): Promise<void> {
    if (!this.useLocalFallback) {
      const { error } = await this.supabase.rpc("rollback_to_savepoint", {
        sp_name: name,
      });
      if (error) {
        console.warn(
          `[smart-import.tx] RPC rollback_to_savepoint falló: ${error.message}`
        );
        this.useLocalFallback = true;
      }
    }

    if (this.useLocalFallback) {
      this.localSavepoints.delete(name);
    }

    const idx = this.savepoints.findIndex((s) => s.name === name);
    if (idx >= 0) this.savepoints.splice(idx + 1);
    console.log(`⏮️  Rollback a savepoint ${name}`);
  }

  async importBatchWithSavepoint(
    batch: Record<string, unknown>[],
    table: string,
    batchNumber: number
  ): Promise<BatchImportResult> {
    const savepointName = `sp_batch_${batchNumber}`;
    await this.createSavepoint(savepointName, batch.length);

    try {
      const { error } = await this.supabase.from(table).insert(batch);
      if (error) throw new Error(error.message);

      console.log(
        `[smart-import.tx] Lote ${batchNumber} OK (${batch.length} filas → ${table})`
      );
      return {
        success: true,
        imported: batch.length,
        failed: 0,
        failedRecords: [],
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(
        `[smart-import.tx] Lote ${batchNumber} falló: ${message}`
      );
      await this.rollbackToSavepoint(savepointName);
      return {
        success: false,
        imported: 0,
        failed: batch.length,
        failedRecords: batch,
      };
    }
  }

  async importWithTransactions(
    data: Record<string, unknown>[],
    table: string,
    batchSize = 100
  ): Promise<TransactionImportResult> {
    const results: TransactionImportResult = {
      imported: 0,
      failed: 0,
      failedRecords: [],
      batches: 0,
      rollbacks: 0,
    };

    for (let i = 0; i < data.length; i += batchSize) {
      const batchNumber = Math.floor(i / batchSize);
      const batch = data.slice(i, i + batchSize);
      const result = await this.importBatchWithSavepoint(
        batch,
        table,
        batchNumber
      );
      results.batches += 1;
      results.imported += result.imported;
      results.failed += result.failed;
      results.failedRecords.push(...result.failedRecords);
      if (!result.success) results.rollbacks += 1;
      console.log(
        `[smart-import.tx] Progreso: imported=${results.imported} failed=${results.failed}`
      );
    }

    return results;
  }

  getSavepoints(): readonly SavepointConfig[] {
    return this.savepoints;
  }
}
