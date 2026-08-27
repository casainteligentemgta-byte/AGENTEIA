/**
 * Middleware HTTP: traceId + span + log estructurado + duración.
 */

import type { NextFunction, Request, Response } from 'express';
import { logger } from '../../services/logging/Logger';
import { metricsCollector } from '../../services/metrics/MetricsCollector';
import { tracer } from '../../services/tracing/Tracer';

export interface RequestWithObservability extends Request {
  traceId?: string;
  span?: ReturnType<typeof tracer.startSpan>;
  user?: { id?: string };
}

export function requestLogger(
  req: RequestWithObservability,
  res: Response,
  next: NextFunction,
): void {
  const traceId = tracer.createTraceId();
  req.traceId = traceId;

  const span = tracer.startSpan('http.request', {
    method: req.method,
    path: req.path,
    traceId,
  });
  req.span = span;

  const startTime = Date.now();

  res.on('finish', () => {
    const durationMs = Date.now() - startTime;
    const durationSec = durationMs / 1000;

    logger.info('HTTP Request', {
      traceId,
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration_ms: durationMs,
      user_id: req.user?.id,
      ip: req.ip,
    });

    // Histograma de latencia HTTP reutilizando etiqueta operation=http
    metricsCollector.recordDBQuery('http', req.method, durationSec);

    span.setAttribute('http.status_code', res.statusCode);
    span.setAttribute('http.duration_ms', durationMs);
    span.end();
  });

  next();
}
