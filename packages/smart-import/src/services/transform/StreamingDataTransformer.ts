import { DataTransformer } from "./DataTransformer";

export type TransformMetrics = {
  duration: number;
  perRecord: number;
  memoryUsed: number;
};

export type TransformWithMetricsResult = {
  transformed: Record<string, unknown>[];
  metrics: TransformMetrics;
};

/**
 * Transformación por lotes / streaming para no bloquear ni spikear memoria.
 */
export class StreamingDataTransformer extends DataTransformer {
  batchSize: number;

  constructor(mapping: Record<string, string> = {}, batchSize = 1000) {
    super(mapping);
    this.batchSize = batchSize;
  }

  /**
   * Procesa records por lotes síncronos de `batchSize`.
   */
  transformBatch(records: Record<string, unknown>[]): Record<string, unknown>[] {
    const out: Record<string, unknown>[] = [];
    for (let i = 0; i < records.length; i += this.batchSize) {
      const chunk = records.slice(i, i + this.batchSize);
      out.push(...chunk.map((row) => this.transformRecord(row)));
    }
    return out;
  }

  /**
   * Streaming con callback de progreso y yield al event loop entre chunks.
   */
  async transformStream(
    records: Record<string, unknown>[],
    onProgress?: (processed: number) => void
  ): Promise<Record<string, unknown>[]> {
    const out: Record<string, unknown>[] = [];
    let processed = 0;

    for (let i = 0; i < records.length; i += this.batchSize) {
      const chunk = records.slice(i, i + this.batchSize);
      const transformedChunk = await Promise.all(
        chunk.map(async (row) => this.transformRecord(row))
      );
      out.push(...transformedChunk);
      processed += chunk.length;
      onProgress?.(processed);
      // Cede el event loop para no bloquear.
      await new Promise((resolve) => setImmediate(resolve));
    }

    return out;
  }

  transformWithMetrics(
    records: Record<string, unknown>[]
  ): TransformWithMetricsResult {
    const start = performance.now();
    const memBefore = process.memoryUsage().heapUsed;
    const transformed = this.transformBatch(records);
    const duration = performance.now() - start;
    const memAfter = process.memoryUsage().heapUsed;
    const memoryUsed = (memAfter - memBefore) / (1024 * 1024);

    return {
      transformed,
      metrics: {
        duration,
        perRecord: records.length > 0 ? duration / records.length : 0,
        memoryUsed,
      },
    };
  }
}
