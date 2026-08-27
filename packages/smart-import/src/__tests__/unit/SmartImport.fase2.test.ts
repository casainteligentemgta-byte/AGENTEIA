import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { CacheManager } from "../../services/cache/CacheManager";
import { CachedValidationEngine } from "../../services/validation/CachedValidationEngine";
import { OptimizedReferenceValidator } from "../../services/validation/OptimizedReferenceValidator";
import { StreamingDataTransformer } from "../../services/transform/StreamingDataTransformer";
import { FileParser } from "../../services/FileParser";
import { SmartImporter } from "../../services/SmartImporter";
import { __resetImportJobsForTests } from "../../services/ImportService";

describe("CacheManager", () => {
  let cache: CacheManager;

  beforeEach(async () => {
    cache = new CacheManager();
    await cache.clear();
  });

  it("get/set/delete funcionan", async () => {
    await cache.set("k1", { ok: true }, 60);
    expect(await cache.get<{ ok: boolean }>("k1")).toEqual({ ok: true });
    await cache.delete("k1");
    expect(await cache.get("k1")).toBeNull();
  });

  it("TTL expira correctamente", async () => {
    await cache.set("ttl", { v: 1 }, 60);
    cache.__expireMemoryKeyForTests("ttl");
    expect(await cache.get("ttl")).toBeNull();
  });

  it("Pattern invalidation funciona", async () => {
    await cache.set("validation:a", { a: 1 }, 60);
    await cache.set("validation:b", { b: 2 }, 60);
    await cache.set("other:c", { c: 3 }, 60);
    await cache.invalidatePattern("validation:*");
    expect(await cache.get("validation:a")).toBeNull();
    expect(await cache.get("validation:b")).toBeNull();
    expect(await cache.get("other:c")).toEqual({ c: 3 });
  });

  it("Error handling en Redis (get de clave inexistente)", async () => {
    expect(await cache.get("missing-key")).toBeNull();
  });

  it("getOrCreate ejecuta fn solo si no hay caché", async () => {
    let calls = 0;
    const v1 = await cache.getOrCreate("goc", async () => {
      calls += 1;
      return { n: calls };
    });
    const v2 = await cache.getOrCreate("goc", async () => {
      calls += 1;
      return { n: calls };
    });
    expect(v1).toEqual({ n: 1 });
    expect(v2).toEqual({ n: 1 });
    expect(calls).toBe(1);
  });
});

describe("CachedValidationEngine", () => {
  const schema = z.object({ id: z.number(), name: z.string() });

  it("Primera validación se guarda; segunda usa caché", async () => {
    const engine = new CachedValidationEngine(new CacheManager());
    await engine.clearCache();
    const records = [{ id: 1, name: "Ada" }];

    const first = await engine.validateBatchCached(records, schema);
    expect(first.cacheHit).toBe(false);
    expect(first.valid).toBe(true);

    const second = await engine.validateBatchCached(records, schema);
    expect(second.cacheHit).toBe(true);
    expect(second.valid).toBe(true);
  });

  it("Cache se puede invalidar", async () => {
    const engine = new CachedValidationEngine(new CacheManager());
    const records = [{ id: 2, name: "Grace" }];
    await engine.validateBatchCached(records, schema, {
      cacheKey: "validation:test-inv",
    });
    await engine.invalidateValidationCache("validation:test-inv");
    const again = await engine.validateBatchCached(records, schema, {
      cacheKey: "validation:test-inv",
    });
    expect(again.cacheHit).toBe(false);
  });

  it("Si caché falla, sigue funcionando (fallback)", async () => {
    const cache = new CacheManager();
    vi.spyOn(cache, "get").mockRejectedValueOnce(new Error("redis down"));
    const engine = new CachedValidationEngine(cache);
    const result = await engine.validateBatchCached(
      [{ id: 1, name: "ok" }],
      schema
    );
    expect(result.valid).toBe(true);
  });
});

describe("OptimizedReferenceValidator", () => {
  it("Validar referencias en bulk detecta inválidas", () => {
    const validator = new OptimizedReferenceValidator(new CacheManager());
    const validIds = new Set(["1", "2", "3"]);
    const records = [
      { device_id: "1" },
      { device_id: "9" },
      { device_id: "2" },
    ];
    const bulk = validator.validateReferencesInMemory(
      records,
      "device_id",
      validIds,
      "bulk"
    );
    const n1 = validator.validateReferencesInMemory(
      records,
      "device_id",
      validIds,
      "n1"
    );
    expect(bulk).toHaveLength(1);
    expect(n1).toHaveLength(1);
    expect(bulk[0]?.value).toBe("9");
  });

  it("Caché de referencias se invalida por tabla", async () => {
    const cache = new CacheManager();
    const validator = new OptimizedReferenceValidator(cache);
    await cache.set("refs:devices:id", ["1", "2"], 60);
    await validator.invalidateReferenceCache("devices");
    expect(await cache.get("refs:devices:id")).toBeNull();
  });
});

describe("StreamingDataTransformer", () => {
  it("Procesa en lotes con resultado igual a transformación normal", async () => {
    const t = new StreamingDataTransformer({ name: "nombre" }, 2);
    const records = [
      { id: 1, name: "A" },
      { id: 2, name: "B" },
      { id: 3, name: "C" },
    ];
    const batch = t.transformBatch(records);
    const stream = await t.transformStream(records);
    expect(batch).toEqual(stream);
    expect(batch[0]).toMatchObject({ nombre: "A", id: 1 });
  });

  it("onProgress callback funciona", async () => {
    const t = new StreamingDataTransformer({}, 2);
    const progress: number[] = [];
    await t.transformStream([{ a: 1 }, { a: 2 }, { a: 3 }], (n) =>
      progress.push(n)
    );
    expect(progress.at(-1)).toBe(3);
  });

  it("Métricas se calculan correctamente", () => {
    const t = new StreamingDataTransformer({}, 100);
    const { transformed, metrics } = t.transformWithMetrics(
      Array.from({ length: 50 }, (_, i) => ({ id: i }))
    );
    expect(transformed).toHaveLength(50);
    expect(metrics.duration).toBeGreaterThanOrEqual(0);
    expect(metrics.perRecord).toBeGreaterThanOrEqual(0);
    expect(typeof metrics.memoryUsed).toBe("number");
  });
});

describe("FileParser streaming", () => {
  it("parseFileStreaming emite chunks CSV/JSON", async () => {
    const parser = new FileParser();
    const chunks: number[] = [];
    const csv = Buffer.from("id,name\n1,A\n2,B\n3,C");
    const rows = await parser.parseFileStreaming(
      { name: "t.csv", size: csv.length, type: "text/csv", buffer: csv },
      (chunk) => chunks.push(chunk.length),
      2
    );
    expect(rows).toHaveLength(3);
    expect(chunks.length).toBeGreaterThan(0);

    const json = Buffer.from(JSON.stringify([{ id: 1 }, { id: 2 }]));
    const jrows = await parser.parseFile(
      { name: "t.json", size: json.length, type: "application/json", buffer: json },
      { streaming: true, chunkSize: 1 }
    );
    expect(jrows).toHaveLength(2);
  });
});

describe("SmartImporter", () => {
  beforeEach(() => {
    __resetImportJobsForTests();
  });

  it("importWithMetrics importa lote válido", async () => {
    const importer = new SmartImporter();
    const schema = z.object({ id: z.number() });
    const { result, metrics } = await importer.importWithMetrics(
      [{ id: 1 }, { id: 2 }],
      {
        targetTable: "devices",
        schema,
        user: { id: "u1", email: "a@b.co", role: "user" },
        useCache: true,
      }
    );
    expect(result.job.userId).toBe("u1");
    expect(result.transformedCount).toBe(2);
    expect(metrics.duration).toBeGreaterThanOrEqual(0);
    expect(metrics.queriesCount).toBeGreaterThan(0);
    await importer.disconnect();
  });
});
