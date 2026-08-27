import { randomUUID } from "crypto";
import {
  context,
  propagation,
  trace,
  type Span,
  type Tracer as OtelTracer,
} from "@opentelemetry/api";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { JaegerExporter } from "@opentelemetry/exporter-jaeger";
import { ExpressInstrumentation } from "@opentelemetry/instrumentation-express";
import { PgInstrumentation } from "@opentelemetry/instrumentation-pg";
import { IORedisInstrumentation } from "@opentelemetry/instrumentation-ioredis";
import { logger } from "../logging/Logger";

/**
 * Tracing OpenTelemetry → Jaeger (opcional; no falla si Jaeger no está).
 */
export class TracerService {
  private sdk: NodeSDK | null = null;
  private started = false;

  constructor() {
    if (process.env.OTEL_ENABLED === "0") {
      logger.info("OpenTelemetry deshabilitado (OTEL_ENABLED=0)");
      return;
    }

    try {
      const host = process.env.JAEGER_HOST ?? "localhost";
      const port = Number(process.env.JAEGER_PORT ?? 6831);
      // JaegerExporter usa endpoint HTTP collector por defecto; UDP agent vía endpoint.
      const endpoint =
        process.env.JAEGER_ENDPOINT ??
        `http://${host}:${process.env.JAEGER_HTTP_PORT ?? 14268}/api/traces`;

      const exporter = new JaegerExporter({ endpoint });
      this.sdk = new NodeSDK({
        traceExporter: exporter,
        serviceName: process.env.OTEL_SERVICE_NAME ?? "smartimport",
        instrumentations: [
          new ExpressInstrumentation(),
          new PgInstrumentation(),
          new IORedisInstrumentation(),
        ],
      });
      this.sdk.start();
      this.started = true;
      logger.info("OpenTelemetry iniciado", {
        jaeger: endpoint,
        agentPort: port,
      });
    } catch (err) {
      logger.warn("OpenTelemetry no disponible", {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  getTracer(name = "smartimport"): OtelTracer {
    return trace.getTracer(name);
  }

  startSpan(
    name: string,
    attributes?: Record<string, string | number | boolean>
  ): Span {
    const tracer = this.getTracer();
    const span = tracer.startSpan(name);
    if (attributes) {
      for (const [key, value] of Object.entries(attributes)) {
        span.setAttribute(key, value);
      }
    }
    return span;
  }

  createTraceId(): string {
    return randomUUID().replace(/-/g, "");
  }

  injectTraceHeaders(
    headers: Record<string, string> = {}
  ): Record<string, string> {
    const carrier: Record<string, string> = { ...headers };
    propagation.inject(context.active(), carrier);
    return carrier;
  }

  async shutdown(): Promise<void> {
    if (this.sdk && this.started) {
      await this.sdk.shutdown();
      this.started = false;
    }
  }
}

export const tracer = new TracerService();
