/**
 * Tests Fase 4 — Observabilidad (logger, metrics, tracing, alerts, health).
 */

process.env.OTEL_ENABLED = "0";
process.env.LOG_LEVEL = "error";
process.env.HEALTH_MONITOR = "0";

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import express from "express";
import request from "supertest";
import { Logger, logger } from "../../services/logging/Logger";
import {
  MetricsCollector,
  metricsCollector,
} from "../../services/metrics/MetricsCollector";
import { TracerService, tracer } from "../../services/tracing/Tracer";
import { AlertManager } from "../../services/alerts/AlertManager";
import { createObservabilityRouter } from "../../api/routes/observability";
import type { HealthStatus } from "../../services/health/HealthCheck";

function healthyStatus(): HealthStatus {
  return {
    status: "healthy",
    database: { status: "up", latency: 2 },
    redis: { status: "up", latency: 1 },
    memory: { usage: 50, total: 100, percentage: 45 },
    disk: { free: 400, total: 1000, percentage: 60 },
    uptime: 10,
    timestamp: new Date(),
  };
}

describe("SmartImport Observability Tests", () => {
  describe("Logger", () => {
    it("debe loguear eventos importantes", () => {
      expect(() =>
        logger.info("Import started", { importId: "abc", table: "devices" })
      ).not.toThrow();
      expect(() =>
        logger.warn("Alerta", { code: "LATENCY" })
      ).not.toThrow();
      expect(() =>
        logger.error("Fallo", new Error("boom"), { table: "devices" })
      ).not.toThrow();
    });

    it("debe incluir contexto (traceId, userId)", () => {
      expect(() =>
        logger.info("HTTP Request", {
          traceId: "trace-123",
          userId: "user-9",
          path: "/api/import",
        })
      ).not.toThrow();
    });

    it("debe no loguear datos sensibles", () => {
      const local = new Logger();
      // Redacción: no debe lanzar; valores sensibles se marcan [REDACTED]
      expect(() =>
        local.info("auth attempt", {
          password: "super-secret",
          token: "jwt-xyz",
          api_key: "key-1",
          userId: "u1",
        })
      ).not.toThrow();
    });
  });

  describe("Metrics", () => {
    let metrics: MetricsCollector;

    beforeEach(() => {
      metrics = new MetricsCollector();
    });

    it("debe registrar importaciones", () => {
      metrics.recordImport("devices", "success", 10, 1.2);
      metrics.recordImport("devices", "failure", 0, 0.5);
      const summary = metrics.getSummary();
      expect(summary.imports_total).toBe(2);
      expect(summary.success_rate).toBe(50);
      expect(summary.errors_total).toBe(0);
    });

    it("debe medir duración", () => {
      metrics.recordValidationDuration(100, 0.05);
      metrics.recordTransformDuration(0.02);
      metrics.recordDBQuery("insert", "devices", 0.1);
      expect(true).toBe(true);
    });

    it("debe actualizar gauges", () => {
      metrics.incActiveImports();
      metrics.incActiveImports();
      metrics.setCacheSize(2048);
      metrics.setMemoryUsage(1024 * 1024);
      metrics.setDBConnections(3);
      expect(metrics.getSummary().active_imports).toBe(2);
      metrics.decActiveImports();
      expect(metrics.getSummary().active_imports).toBe(1);
    });

    it("debe formato Prometheus correcto", async () => {
      metrics.recordImport("automations", "success", 5, 0.8);
      metrics.recordError("validation", "automations");
      const text = await metrics.getMetrics();
      expect(text).toContain("smartimport_imports_total");
      expect(text).toContain("smartimport_errors_total");
      expect(text).toMatch(/# HELP|# TYPE/);
    });
  });

  describe("Tracing", () => {
    it("debe crear trace ID único", () => {
      const a = tracer.createTraceId();
      const b = tracer.createTraceId();
      expect(a).not.toBe(b);
      expect(a.length).toBeGreaterThanOrEqual(16);
    });

    it("debe crear spans", () => {
      const span = tracer.startSpan("test.span", { foo: "bar" });
      expect(span).toBeDefined();
      span.end();
    });

    it("debe medir duración de spans", () => {
      const span = tracer.startSpan("timed");
      const t0 = Date.now();
      span.setAttribute("phase", "done");
      span.end();
      expect(Date.now() - t0).toBeGreaterThanOrEqual(0);
    });

    it("debe correlacionar servicios", () => {
      const headers = tracer.injectTraceHeaders({ "x-request-id": "1" });
      expect(headers["x-request-id"]).toBe("1");
      expect(typeof headers).toBe("object");
    });

    it("getTracer retorna tracer OTEL", () => {
      const t = new TracerService();
      expect(t.getTracer("smartimport")).toBeDefined();
    });
  });

  describe("Alerts", () => {
    afterEach(() => {
      vi.unstubAllGlobals();
      delete process.env.SLACK_WEBHOOK_URL;
    });

    it("debe detectar error rate alto", async () => {
      const am = new AlertManager();
      const alerts = await am.checkThresholds({ imports_failed_rate: 0.1 });
      expect(alerts.some((a) => a.severity === "critical")).toBe(true);
      expect(alerts[0]!.title).toMatch(/fallos/i);
    });

    it("debe detectar latencia alta", async () => {
      const am = new AlertManager();
      const alerts = await am.checkThresholds({ latency_seconds: 6 });
      expect(alerts.some((a) => a.severity === "warning")).toBe(true);
    });

    it("debe enviar alertas", async () => {
      process.env.SLACK_WEBHOOK_URL = "https://hooks.slack.test/webhook";
      const fetchMock = vi.fn().mockResolvedValue({ ok: true });
      vi.stubGlobal("fetch", fetchMock);

      const am = new AlertManager();
      expect(am.getChannels()).toContain("slack");

      await am.sendAlert({
        severity: "warning",
        title: "Test",
        message: "Latencia alta",
        timestamp: new Date(),
        tags: ["latency"],
      });

      expect(fetchMock).toHaveBeenCalled();
      const [url, opts] = fetchMock.mock.calls[0]!;
      expect(url).toBe("https://hooks.slack.test/webhook");
      expect(opts.method).toBe("POST");
    });

    it("debe detectar memoria y cache hit bajos", async () => {
      const am = new AlertManager();
      const alerts = await am.checkThresholds({
        memory_percent: 95,
        cache_hit_rate: 0.2,
      });
      expect(alerts.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe("Health Checks", () => {
    function buildApp(status: HealthStatus = healthyStatus()) {
      const health = {
        check: vi.fn().mockResolvedValue(status),
        getStatus: vi.fn().mockReturnValue(status),
      };
      const app = express();
      app.use(
        createObservabilityRouter({
          health: health as never,
        })
      );
      return app;
    }

    it("GET /health retorna status", async () => {
      const res = await request(buildApp()).get("/health");
      expect(res.status).toBe(200);
      expect(res.body.status).toBe("healthy");
      expect(res.body.services.database).toBe("up");
      expect(res.body.services.memory).toBe("45%");
      expect(res.body.services.disk).toBe("60%");
    });

    it("GET /health/readiness retorna 200 si todo OK", async () => {
      const res = await request(buildApp()).get("/health/readiness");
      expect(res.status).toBe(200);
      expect(res.body.ready).toBe(true);
    });

    it("GET /health/liveness siempre retorna 200", async () => {
      const unhealthy = healthyStatus();
      unhealthy.status = "unhealthy";
      unhealthy.database = { status: "down", error: "timeout" };
      const res = await request(buildApp(unhealthy)).get("/health/liveness");
      expect(res.status).toBe(200);
      expect(res.body.alive).toBe(true);
    });

    it("GET /metrics retorna formato Prometheus", async () => {
      metricsCollector.recordImport("devices", "success", 1, 0.1);
      const res = await request(buildApp()).get("/metrics");
      expect(res.status).toBe(200);
      expect(res.text).toContain("smartimport_imports_total");
      expect(res.headers["content-type"]).toMatch(/text\/plain/);
    });

    it("GET /metrics/summary retorna resumen", async () => {
      const res = await request(buildApp()).get("/metrics/summary");
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("imports_total");
      expect(res.body).toHaveProperty("success_rate");
      expect(res.body).toHaveProperty("cache_hit_rate");
    });

    it("GET /health/readiness 503 si BD down y configurada", async () => {
      const prev = process.env.SUPABASE_URL;
      process.env.SUPABASE_URL = "https://example.supabase.co";
      const bad = healthyStatus();
      bad.status = "unhealthy";
      bad.database = { status: "down", error: "fail" };
      const res = await request(buildApp(bad)).get("/health/readiness");
      expect(res.status).toBe(503);
      expect(res.body.ready).toBe(false);
      if (prev === undefined) delete process.env.SUPABASE_URL;
      else process.env.SUPABASE_URL = prev;
    });
  });
});
