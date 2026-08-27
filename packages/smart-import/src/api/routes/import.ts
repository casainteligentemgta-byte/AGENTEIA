import { Router, type Response, type NextFunction } from "express";
import {
  requireAuth,
  requireBodyTablePermission,
  requireRole,
  requireTablePermission,
  type AuthenticatedRequest,
} from "../middleware/auth";
import { apiLimiter, importLimiter } from "../middleware/rateLimit";
import {
  analyzeRecords,
  enqueueImport,
  getImportJob,
  isExecuteTargetTable,
  transformRecords,
  validateRecords,
} from "../../services/ImportService";
import type { ParsedRecord } from "../../services/FileParser";
import { FILE_CONFIG } from "../../config/fileConfig";

const router = Router();

/** Rate limit general (100 req/min) en todas las rutas de importación. */
router.use(apiLimiter);

function asAuth(req: AuthenticatedRequest): AuthenticatedRequest {
  return req;
}

function readDataArray(body: unknown): ParsedRecord[] | null {
  if (!body || typeof body !== "object") return null;
  const data = (body as { data?: unknown }).data;
  if (!Array.isArray(data)) return null;
  return data as ParsedRecord[];
}

function safeErrorMessage(err: unknown, fallback: string): string {
  if (
    err instanceof Error &&
    err.message &&
    !/token|password|secret/i.test(err.message)
  ) {
    return err.message;
  }
  return fallback;
}

/**
 * POST /api/import/execute
 * Middlewares: requireAuth → importLimiter → permiso de tabla (body).
 * targetTable ∈ devices | automations | sensor_data.
 */
router.post(
  "/execute",
  requireAuth,
  importLimiter,
  requireBodyTablePermission("targetTable"),
  async (req, res: Response) => {
    try {
      const authReq = asAuth(req as AuthenticatedRequest);
      const data = readDataArray(req.body);
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

      const targetTable = String(req.body?.targetTable ?? "").trim();
      if (!isExecuteTargetTable(targetTable)) {
        res.status(400).json({
          success: false,
          error:
            "targetTable debe ser una de: devices, automations, sensor_data",
        });
        return;
      }

      const validation = validateRecords(data);
      if (!validation.valid) {
        res.status(400).json({
          success: false,
          error: validation.errors[0] ?? "Datos inválidos",
        });
        return;
      }

      console.log(
        `[smart-import.execute] user=${authReq.user.id} table=${targetTable} rows=${data.length}`
      );

      const result = await enqueueImport({
        user: authReq.user,
        targetTable,
        data,
      });

      res.status(200).json({ success: true, import: result });
    } catch (err) {
      console.error(
        "[smart-import.execute] Error:",
        err instanceof Error ? err.message : "unknown"
      );
      res.status(500).json({
        success: false,
        error: safeErrorMessage(err, "No se pudo ejecutar la importación"),
      });
    }
  }
);

/**
 * POST /api/import/analyze
 */
router.post("/analyze", requireAuth, async (req, res: Response) => {
  try {
    const data = readDataArray(req.body);
    if (!data || data.length === 0) {
      res.status(400).json({
        success: false,
        error: "data debe ser un arreglo con al menos un registro",
      });
      return;
    }
    const analysis = analyzeRecords(data);
    res.status(200).json({ success: true, analysis });
  } catch (err) {
    console.error(
      "[smart-import.analyze] Error:",
      err instanceof Error ? err.message : "unknown"
    );
    res.status(500).json({
      success: false,
      error: safeErrorMessage(err, "No se pudo analizar el lote"),
    });
  }
});

/**
 * POST /api/import/validate
 */
router.post("/validate", requireAuth, async (req, res: Response) => {
  try {
    const data = readDataArray(req.body);
    if (!data) {
      res.status(400).json({
        success: false,
        error: "data debe ser un arreglo",
      });
      return;
    }
    const result = validateRecords(data);
    res.status(200).json({ success: result.valid, ...result });
  } catch (err) {
    console.error(
      "[smart-import.validate] Error:",
      err instanceof Error ? err.message : "unknown"
    );
    res.status(500).json({
      success: false,
      error: safeErrorMessage(err, "No se pudo validar el lote"),
    });
  }
});

/**
 * POST /api/import/transform
 */
router.post("/transform", requireAuth, async (req, res: Response) => {
  try {
    const data = readDataArray(req.body);
    if (!data || data.length === 0) {
      res.status(400).json({
        success: false,
        error: "data debe ser un arreglo con al menos un registro",
      });
      return;
    }
    const mapping =
      req.body?.mapping && typeof req.body.mapping === "object"
        ? (req.body.mapping as Record<string, string>)
        : undefined;
    const transformed = transformRecords(data, mapping);
    res.status(200).json({ success: true, data: transformed });
  } catch (err) {
    console.error(
      "[smart-import.transform] Error:",
      err instanceof Error ? err.message : "unknown"
    );
    res.status(500).json({
      success: false,
      error: safeErrorMessage(err, "No se pudo transformar el lote"),
    });
  }
});

/**
 * GET /api/import/status/:importId
 * Solo el dueño del import (o admin) puede consultarlo.
 */
router.get(
  "/status/:importId",
  requireAuth,
  async (req, res: Response, _next: NextFunction) => {
    try {
      const authReq = asAuth(req as AuthenticatedRequest);
      const importId = String(req.params.importId ?? "");
      const job = getImportJob(importId);
      if (!job) {
        res
          .status(404)
          .json({ success: false, error: "Importación no encontrada" });
        return;
      }
      if (job.userId !== authReq.user.id && authReq.user.role !== "admin") {
        res.status(403).json({
          success: false,
          error: "No puedes ver importaciones de otros usuarios",
        });
        return;
      }
      res.status(200).json({ success: true, import: job });
    } catch (err) {
      console.error(
        "[smart-import.status] Error:",
        err instanceof Error ? err.message : "unknown"
      );
      res.status(500).json({
        success: false,
        error: safeErrorMessage(err, "No se pudo obtener el estado"),
      });
    }
  }
);

/**
 * GET /api/import/admin/users-meta
 * Ejemplo admin: requireRole + requireTablePermission fijo.
 */
router.get(
  "/admin/users-meta",
  requireAuth,
  requireRole(["admin"]),
  requireTablePermission("users"),
  (_req, res: Response) => {
    res.status(200).json({
      success: true,
      tables: ["devices", "automations", "sensor_data", "users"],
    });
  }
);

export default router;
