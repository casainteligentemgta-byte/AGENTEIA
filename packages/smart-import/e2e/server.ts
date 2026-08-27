/**
 * Servidor E2E standalone (sin Supabase). Expone la misma superficie API.
 */
import http from "http";
import express, { type Request, type Response, type NextFunction } from "express";
import { randomUUID } from "crypto";
import {
  analyzeRecords,
  enqueueImport,
  getImportJob,
  isExecuteTargetTable,
  transformRecords,
  validateRecords,
  __resetImportJobsForTests,
} from "../src/services/ImportService";
import type { ParsedRecord } from "../src/services/FileParser";
import { FILE_CONFIG, MAX_FILE_SIZE } from "../src/config/fileConfig";
import { FileParser } from "../src/services/FileParser";
import type { SmartImportRole, SmartImportUser } from "../src/api/middleware/auth";
import { TABLE_PERMISSIONS } from "../src/api/middleware/auth";

const PORT = Number(process.env.E2E_PORT ?? 3100);

type AuthedRequest = Request & { user: SmartImportUser };

const requestCounts = new Map<string, { count: number; resetAt: number }>();

function getUser(req: Request): SmartImportUser {
  const roleHeader = req.headers["x-e2e-role"];
  const role: SmartImportRole =
    roleHeader === "admin"
      ? "admin"
      : roleHeader === "viewer"
        ? "user" // viewer simulado: se deniega en middleware de escritura
        : "user";
  const id =
    typeof req.headers["x-e2e-user-id"] === "string"
      ? req.headers["x-e2e-user-id"]
      : "e2e-user";
  return {
    id,
    email: `${id}@e2e.local`,
    role: roleHeader === "viewer" ? "user" : role,
  };
}

function isViewer(req: Request): boolean {
  return req.headers["x-e2e-role"] === "viewer";
}

function readData(body: unknown): ParsedRecord[] | null {
  if (!body || typeof body !== "object") return null;
  const data = (body as { data?: unknown }).data;
  if (!Array.isArray(data)) return null;
  return data as ParsedRecord[];
}

function createApp() {
  const app = express();
  app.use(express.json({ limit: "2mb" }));

  // Rate limit simulado: 10 execute / ventana corta por user
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (!req.path.startsWith("/api/import/execute") || req.method !== "POST") {
      next();
      return;
    }
    const user = getUser(req);
    const key = `user:${user.id}`;
    const now = Date.now();
    const entry = requestCounts.get(key);
    if (!entry || entry.resetAt < now) {
      requestCounts.set(key, { count: 1, resetAt: now + 15 * 60_000 });
      next();
      return;
    }
    entry.count += 1;
    if (user.role !== "admin" && entry.count > 10) {
      res.status(429).json({
        success: false,
        error: "Demasiadas importaciones. Máximo 10 cada 15 minutos",
      });
      return;
    }
    next();
  });

  app.use((req: Request, _res: Response, next: NextFunction) => {
    (req as AuthedRequest).user = getUser(req);
    next();
  });

  app.get("/health", (_req, res) => {
    res.json({
      status: "healthy",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      services: { database: "up", redis: "up", memory: "40%", disk: "50%" },
    });
  });
  app.get("/health/liveness", (_req, res) => {
    res.status(200).json({ alive: true, uptime: process.uptime() });
  });
  app.get("/health/readiness", (_req, res) => {
    res.status(200).json({ ready: true });
  });

  app.post("/api/import/analyze", (req, res) => {
    if (isViewer(req)) {
      res.status(403).json({ success: false, error: "Acceso denegado (viewer)" });
      return;
    }
    const data = readData(req.body);
    if (!data || data.length === 0) {
      res.status(400).json({ success: false, error: "data requerido" });
      return;
    }
    const analysis = analyzeRecords(data);
    res.json({
      success: true,
      status: 200,
      importId: randomUUID(),
      recordCount: analysis.recordCount,
      estimatedTime: Math.ceil(analysis.recordCount / 1000),
      fileName: (req.body as { fileName?: string }).fileName ?? "upload.csv",
      analysis,
    });
  });

  app.post("/api/import/validate", (req, res) => {
    if (isViewer(req)) {
      res.status(403).json({ success: false, error: "Acceso denegado (viewer)" });
      return;
    }
    const data = (req.body as { data?: unknown }).data;
    if (!Array.isArray(data)) {
      res.status(400).json({ success: false, error: "data debe ser arreglo" });
      return;
    }
    const result = validateRecords(data);
    res.json({
      success: result.valid,
      valid: result.valid,
      errors: result.errors,
    });
  });

  app.post("/api/import/transform", (req, res) => {
    const data = readData(req.body);
    if (!data) {
      res.status(400).json({ success: false, error: "data requerido" });
      return;
    }
    const mapping = (req.body as { mapping?: Record<string, string> }).mapping;
    res.json({ success: true, data: transformRecords(data, mapping) });
  });

  app.post("/api/import/execute", async (req, res) => {
    if (isViewer(req)) {
      res.status(403).json({ success: false, error: "Acceso denegado (viewer)" });
      return;
    }
    const user = (req as AuthedRequest).user;
    const data = readData(req.body);
    const targetTable = (req.body as { targetTable?: string }).targetTable;

    if (!data || data.length === 0) {
      res.status(400).json({
        success: false,
        error: "data debe ser un arreglo con al menos un registro",
      });
      return;
    }
    if (data.length > FILE_CONFIG.MAX_BATCH_SIZE) {
      res.status(400).json({
        success: false,
        error: `Máximo ${FILE_CONFIG.MAX_BATCH_SIZE} registros por importación`,
      });
      return;
    }
    if (!isExecuteTargetTable(targetTable)) {
      res.status(400).json({ success: false, error: "targetTable inválida" });
      return;
    }
    const allowed = TABLE_PERMISSIONS[user.role];
    if (!allowed.includes(targetTable)) {
      res.status(403).json({ success: false, error: "Sin permiso sobre la tabla" });
      return;
    }

    const validation = validateRecords(data);
    if (!validation.valid) {
      res.status(400).json({
        success: false,
        error: validation.errors[0] ?? "Validación fallida",
        errors: validation.errors,
      });
      return;
    }

    // Simular progreso vía header opcional
    const cancelAfter = Number(req.headers["x-e2e-cancel-after-ms"] ?? 0);
    if (cancelAfter > 0) {
      await new Promise((r) => setTimeout(r, cancelAfter));
      const partial = data.slice(0, Math.max(1, Math.floor(data.length / 10)));
      const job = await enqueueImport({ user, targetTable, data: partial });
      res.status(200).json({
        success: true,
        status: "partial",
        imported: partial.length,
        failed: 0,
        cancelled: true,
        import: job,
        duration: cancelAfter,
      });
      return;
    }

    const t0 = Date.now();
    const job = await enqueueImport({ user, targetTable, data });
    res.json({
      success: true,
      status: "completed",
      imported: data.length,
      failed: 0,
      failedRecords: [],
      duration: Date.now() - t0,
      import: job,
      message: `${data.length} imported`,
    });
  });

  app.get("/api/import/status/:importId", (req, res) => {
    const job = getImportJob(req.params.importId!);
    if (!job) {
      res.status(404).json({ success: false, error: "Import no encontrado" });
      return;
    }
    const user = (req as AuthedRequest).user;
    if (job.userId !== user.id && user.role !== "admin") {
      res.status(403).json({ success: false, error: "Forbidden" });
      return;
    }
    res.json({ success: true, import: job });
  });

  app.get("/api/import/history", (req, res) => {
    if (isViewer(req)) {
      res.status(403).json({ success: false, error: "Acceso denegado" });
      return;
    }
    // Historial en memoria: devolver jobs del usuario vía scan no expuesto —
    // endpoint de prueba con últimos IDs enviados en body session.
    const ids = (req.query.ids as string | undefined)?.split(",").filter(Boolean) ?? [];
    const items = ids
      .map((id) => getImportJob(id))
      .filter(Boolean);
    res.json({ success: true, history: items });
  });

  app.get("/admin", (req, res) => {
    if (isViewer(req) || (req as AuthedRequest).user.role !== "admin") {
      res.status(403).json({ success: false, error: "Denied" });
      return;
    }
    res.json({ success: true, admin: true });
  });

  app.post("/api/import/upload", express.raw({ type: "*/*", limit: MAX_FILE_SIZE + 1024 }), async (req, res) => {
    if (isViewer(req)) {
      res.status(403).json({ success: false, error: "Acceso denegado" });
      return;
    }
    const size = Buffer.isBuffer(req.body) ? req.body.length : 0;
    if (size > MAX_FILE_SIZE) {
      res.status(413).json({
        success: false,
        error: `Archivo demasiado grande. Máximo ${MAX_FILE_SIZE} bytes`,
      });
      return;
    }
    const name = String(req.headers["x-filename"] ?? "upload.bin");
    const type = String(
      req.headers["x-content-type-hint"] ??
        req.headers["content-type"] ??
        "application/octet-stream"
    );
    try {
      const parser = new FileParser();
      const records = await parser.parseFile({
        name,
        size,
        type,
        buffer: Buffer.isBuffer(req.body) ? req.body : Buffer.from([]),
      });
      res.json({ success: true, recordCount: records.length, records: records.slice(0, 5) });
    } catch (err) {
      res.status(400).json({
        success: false,
        error: err instanceof Error ? err.message : "Parse error",
      });
    }
  });

  app.post("/api/e2e/reset", (_req, res) => {
    __resetImportJobsForTests();
    requestCounts.clear();
    res.json({ success: true });
  });

  return app;
}

export function startE2EServer(): Promise<http.Server> {
  const app = createApp();
  return new Promise((resolve) => {
    const server = app.listen(PORT, "127.0.0.1", () => {
      // eslint-disable-next-line no-console
      console.log(`[e2e] listening on http://127.0.0.1:${PORT}`);
      resolve(server);
    });
  });
}

if (require.main === module) {
  void startE2EServer();
}
