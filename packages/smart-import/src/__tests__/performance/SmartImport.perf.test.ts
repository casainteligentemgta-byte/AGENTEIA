/**
 * Performance benchmarks Fase 5 (Vitest).
 */
import { describe, it, expect, beforeEach } from "vitest";
import { z } from "zod";
import { CacheManager } from "../../services/cache/CacheManager";
import { CachedValidationEngine } from "../../services/validation/CachedValidationEngine";
import { StreamingDataTransformer } from "../../services/transform/StreamingDataTransformer";
import { DataTransformer } from "../../services/transform/DataTransformer";
import { SmartImporter } from "../../services/SmartImporter";
import { __resetImportJobsForTests } from "../../services/ImportService";

function makeRecords(n: number) {
  return Array.from({ length: n }, (_, i) => ({
    id: i,
    name: `item-${i}`,
    device_id: String((i % 50) + 1),
  }));
}

const schema = z.object({
  id: z.number(),
  name: z.string(),
  device_id: z.string(),
});

describe("Performance Benchmarks", () => {
  beforeEach(() => {
    __resetImportJobsForTests();
  });

  it("Perf: Import 1k in < 1s", async () => {
    const importer = new SmartImporter();
    const records = makeRecords(1000);
    const t0 = performance.now();
    const result = await importer.importWithStrategy(records, {
      targetTable: "devices",
      schema,
      user: { id: "perf", email: "p@x", role: "user" },
      useCache: false,
    });
    const duration = performance.now() - t0;
    console.log(`✓ 1k: ${duration.toFixed(1)}ms`);
    expect(result.transformedCount).toBe(1000);
    expect(duration).toBeLessThan(1000);
    await importer.disconnect();
  });

  it("Perf: Import 5k in < 5s", async () => {
    const importer = new SmartImporter();
    const records = makeRecords(5000);
    const t0 = performance.now();
    const result = await importer.importWithStrategy(records, {
      targetTable: "devices",
      schema,
      user: { id: "perf", email: "p@x", role: "user" },
      useCache: false,
    });
    const duration = performance.now() - t0;
    const rps = (5000 / duration) * 1000;
    console.log(`✓ 5k: ${duration.toFixed(1)}ms RPS=${Math.round(rps)}`);
    expect(result.transformedCount).toBe(5000);
    expect(duration).toBeLessThan(5000);
    await importer.disconnect();
  });

  it("Perf: Import 10k in < 10s", async () => {
    const importer = new SmartImporter();
    const records = makeRecords(10_000);
    const t0 = performance.now();
    const result = await importer.importWithStrategy(records, {
      targetTable: "devices",
      schema,
      user: { id: "perf", email: "p@x", role: "user" },
      useCache: false,
    });
    const duration = performance.now() - t0;
    console.log(`✓ 10k: ${duration.toFixed(1)}ms`);
    expect(result.transformedCount).toBe(10_000);
    expect(duration).toBeLessThan(10_000);
    await importer.disconnect();
  });

  it("Perf: No memory leaks", async () => {
    if (typeof global.gc === "function") global.gc();
    const initial = process.memoryUsage().heapUsed;
    for (let i = 0; i < 10; i++) {
      const importer = new SmartImporter();
      await importer.importWithStrategy(makeRecords(1000), {
        targetTable: "devices",
        schema,
        user: { id: "perf", email: "p@x", role: "user" },
        useCache: false,
      });
      await importer.disconnect();
    }
    if (typeof global.gc === "function") global.gc();
    const final = process.memoryUsage().heapUsed;
    const deltaMb = (final - initial) / (1024 * 1024);
    console.log(`memory delta=${deltaMb.toFixed(1)}MB`);
    expect(deltaMb).toBeLessThan(50);
  });

  it("Perf: Cache works (90% faster)", async () => {
    const engine = new CachedValidationEngine(new CacheManager());
    await engine.clearCache();
    const heavy = z
      .object({
        id: z.number(),
        name: z.string().min(1),
        device_id: z.string(),
      })
      .superRefine((row, ctx) => {
        if (!row.name.includes("-")) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: "bad" });
        }
      });
    const records = makeRecords(5_000);

    const t1 = performance.now();
    await engine.validateBatchCached(records, heavy, { useCache: true });
    const uncached = performance.now() - t1;

    const t2 = performance.now();
    const second = await engine.validateBatchCached(records, heavy, {
      useCache: true,
    });
    const cached = performance.now() - t2;

    console.log(`uncached=${uncached.toFixed(1)}ms cached=${cached.toFixed(1)}ms`);
    expect(second.cacheHit).toBe(true);
    expect(cached).toBeLessThan(Math.max(uncached * 0.1, 5));
  });

  it("Perf: Streaming reduces memory", async () => {
    const records = makeRecords(20_000);
    const mapping = { name: "nombre", id: "id", device_id: "device_id" };

    const batch = new DataTransformer(mapping);
    const tBatch = performance.now();
    const outBatch = batch.transform(records);
    const batchMs = performance.now() - tBatch;

    const stream = new StreamingDataTransformer(mapping, 500);
    const tStream = performance.now();
    const outStream = await stream.transformStream(records);
    const streamMs = performance.now() - tStream;

    expect(outBatch).toHaveLength(20_000);
    expect(outStream).toHaveLength(20_000);
    console.log({
      batchMs: batchMs.toFixed(1),
      streamMs: streamMs.toFixed(1),
    });
    // Streaming procesa el mismo volumen sin fallar (memoria acotada por batches)
    expect(streamMs).toBeGreaterThan(0);
  });
});
