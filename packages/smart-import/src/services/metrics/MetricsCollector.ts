import client from "prom-client";

/**
 * Métricas Prometheus para SmartImport.
 */
export class MetricsCollector {
  readonly register: client.Registry;

  private readonly importCounter: client.Counter<string>;
  private readonly recordsCounter: client.Counter<string>;
  private readonly errorsCounter: client.Counter<string>;
  private readonly importDuration: client.Histogram<string>;
  private readonly validationDuration: client.Histogram<string>;
  private readonly transformDuration: client.Histogram<string>;
  private readonly dbQueryDuration: client.Histogram<string>;
  private readonly activeImports: client.Gauge<string>;
  private readonly cacheSize: client.Gauge<string>;
  private readonly memoryUsage: client.Gauge<string>;
  private readonly dbConnections: client.Gauge<string>;
  private readonly cacheHits: client.Counter<string>;
  private readonly cacheMisses: client.Counter<string>;

  private activeImportsCount = 0;

  /** Resumen en memoria para /metrics/summary */
  private summary = {
    importsTotal: 0,
    importsSuccess: 0,
    importsFailure: 0,
    errorsTotal: 0,
    durationSum: 0,
    durationCount: 0,
    cacheHits: 0,
    cacheMisses: 0,
  };

  constructor() {
    this.register = new client.Registry();
    client.collectDefaultMetrics({ register: this.register });

    this.importCounter = new client.Counter({
      name: "smartimport_imports_total",
      help: "Total de importaciones",
      labelNames: ["status", "table"],
      registers: [this.register],
    });
    this.recordsCounter = new client.Counter({
      name: "smartimport_records_total",
      help: "Total de registros procesados",
      labelNames: ["status", "table"],
      registers: [this.register],
    });
    this.errorsCounter = new client.Counter({
      name: "smartimport_errors_total",
      help: "Total de errores",
      labelNames: ["type", "table"],
      registers: [this.register],
    });
    this.importDuration = new client.Histogram({
      name: "smartimport_import_duration_seconds",
      help: "Duración de importación",
      labelNames: ["table"],
      buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60],
      registers: [this.register],
    });
    this.validationDuration = new client.Histogram({
      name: "smartimport_validation_duration_seconds",
      help: "Duración de validación",
      labelNames: ["recordCount"],
      buckets: [0.01, 0.05, 0.1, 0.5, 1, 5],
      registers: [this.register],
    });
    this.transformDuration = new client.Histogram({
      name: "smartimport_transform_duration_seconds",
      help: "Duración de transformación",
      buckets: [0.01, 0.05, 0.1, 0.5, 1, 5],
      registers: [this.register],
    });
    this.dbQueryDuration = new client.Histogram({
      name: "smartimport_db_query_duration_seconds",
      help: "Duración de queries / HTTP",
      labelNames: ["operation", "table"],
      buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5],
      registers: [this.register],
    });
    this.activeImports = new client.Gauge({
      name: "smartimport_active_imports",
      help: "Importaciones activas",
      registers: [this.register],
    });
    this.cacheSize = new client.Gauge({
      name: "smartimport_cache_size_bytes",
      help: "Tamaño estimado de caché",
      registers: [this.register],
    });
    this.memoryUsage = new client.Gauge({
      name: "smartimport_memory_usage_bytes",
      help: "Heap usado",
      registers: [this.register],
    });
    this.dbConnections = new client.Gauge({
      name: "smartimport_db_connections",
      help: "Conexiones BD (estimadas)",
      registers: [this.register],
    });
    this.cacheHits = new client.Counter({
      name: "smartimport_cache_hits_total",
      help: "Cache hits",
      registers: [this.register],
    });
    this.cacheMisses = new client.Counter({
      name: "smartimport_cache_misses_total",
      help: "Cache misses",
      registers: [this.register],
    });
  }

  recordImport(
    table: string,
    status: "success" | "failure",
    recordCount: number,
    durationSeconds?: number
  ): void {
    this.importCounter.inc({ status, table });
    this.recordsCounter.inc({ status, table }, recordCount);
    this.summary.importsTotal += 1;
    if (status === "success") this.summary.importsSuccess += 1;
    else this.summary.importsFailure += 1;
    if (durationSeconds != null) {
      this.importDuration.observe({ table }, durationSeconds);
      this.summary.durationSum += durationSeconds;
      this.summary.durationCount += 1;
    }
  }

  recordError(type: string, table: string): void {
    this.errorsCounter.inc({ type, table });
    this.summary.errorsTotal += 1;
  }

  recordValidationDuration(recordCount: number, durationSeconds: number): void {
    const bucket =
      recordCount <= 100
        ? "le100"
        : recordCount <= 1000
          ? "le1000"
          : recordCount <= 5000
            ? "le5000"
            : "gt5000";
    this.validationDuration.observe(
      { recordCount: bucket },
      durationSeconds
    );
  }

  recordTransformDuration(durationSeconds: number): void {
    this.transformDuration.observe(durationSeconds);
  }

  recordDBQuery(
    operation: string,
    table: string,
    durationSeconds: number
  ): void {
    this.dbQueryDuration.observe({ operation, table }, durationSeconds);
  }

  setActiveImports(count: number): void {
    this.activeImportsCount = Math.max(0, count);
    this.activeImports.set(this.activeImportsCount);
  }

  /** Incrementa importaciones activas (+1). */
  incActiveImports(): void {
    this.setActiveImports(this.activeImportsCount + 1);
  }

  /** Decrementa importaciones activas (−1). */
  decActiveImports(): void {
    this.setActiveImports(this.activeImportsCount - 1);
  }

  setCacheSize(bytes: number): void {
    this.cacheSize.set(bytes);
  }

  setMemoryUsage(bytes: number): void {
    this.memoryUsage.set(bytes);
  }

  setDBConnections(count: number): void {
    this.dbConnections.set(count);
  }

  recordCacheHit(): void {
    this.cacheHits.inc();
    this.summary.cacheHits += 1;
  }

  recordCacheMiss(): void {
    this.cacheMisses.inc();
    this.summary.cacheMisses += 1;
  }

  async getMetrics(): Promise<string> {
    this.setMemoryUsage(process.memoryUsage().heapUsed);
    return this.register.metrics();
  }

  getSummary(): {
    imports_total: number;
    success_rate: number;
    avg_duration_ms: number;
    errors_total: number;
    active_imports: number;
    cache_hit_rate: number;
  } {
    const total = this.summary.importsTotal || 0;
    const successRate =
      total > 0 ? (this.summary.importsSuccess / total) * 100 : 100;
    const avgDurationMs =
      this.summary.durationCount > 0
        ? (this.summary.durationSum / this.summary.durationCount) * 1000
        : 0;
    const cacheTotal =
      this.summary.cacheHits + this.summary.cacheMisses;
    const cacheHitRate =
      cacheTotal > 0
        ? (this.summary.cacheHits / cacheTotal) * 100
        : 0;

    return {
      imports_total: total,
      success_rate: Number(successRate.toFixed(2)),
      avg_duration_ms: Number(avgDurationMs.toFixed(2)),
      errors_total: this.summary.errorsTotal,
      active_imports: this.activeImportsCount,
      cache_hit_rate: Number(cacheHitRate.toFixed(2)),
    };
  }

  /** Solo tests: reinicia contadores de resumen. */
  __resetSummaryForTests(): void {
    this.summary = {
      importsTotal: 0,
      importsSuccess: 0,
      importsFailure: 0,
      errorsTotal: 0,
      durationSum: 0,
      durationCount: 0,
      cacheHits: 0,
      cacheMisses: 0,
    };
    this.activeImportsCount = 0;
    this.register.resetMetrics();
  }
}

export const metricsCollector = new MetricsCollector();
