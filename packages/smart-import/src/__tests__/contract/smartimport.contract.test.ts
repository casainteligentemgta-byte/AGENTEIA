/**
 * Contract tests — schemas Zod de respuestas API.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { z } from "zod";
import express from "express";
import request from "supertest";
import type { NextFunction, Request, Response } from "express";
import importRouter from "../../api/routes/import";
import type { AuthenticatedRequest } from "../../api/middleware/auth";
import { __resetImportJobsForTests } from "../../services/ImportService";

vi.mock("../../api/middleware/rateLimit", () => ({
  apiLimiter: (_req: Request, _res: Response, next: NextFunction) => next(),
  importLimiter: (_req: Request, _res: Response, next: NextFunction) => next(),
  passthroughLimiter: (_req: Request, _res: Response, next: NextFunction) =>
    next(),
}));

vi.mock("../../api/middleware/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../api/middleware/auth")>();
  return {
    ...actual,
    requireAuth: (req: Request, _res: Response, next: NextFunction) => {
      (req as AuthenticatedRequest).user = {
        id: "contract-user",
        email: "c@t.local",
        role: "user",
      };
      (req as AuthenticatedRequest).supabase =
        {} as AuthenticatedRequest["supabase"];
      next();
    },
  };
});

const analyzeResponseSchema = z.object({
  success: z.literal(true),
  analysis: z.object({
    recordCount: z.number(),
    fields: z.array(z.string()),
    sample: z.array(z.record(z.string(), z.unknown())),
  }),
});

const executeResponseSchema = z.object({
  success: z.literal(true),
  import: z.object({
    id: z.string().uuid(),
    userId: z.string(),
    targetTable: z.string(),
    status: z.enum(["queued", "running", "completed", "failed"]),
    recordCount: z.number(),
    createdAt: z.string(),
  }),
});

const errorResponseSchema = z.object({
  success: z.literal(false),
  error: z.string(),
});

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/import", importRouter);
  // Alias v1 (compat)
  app.use("/api/v1/import", importRouter);
  return app;
}

describe("Contract Tests", () => {
  beforeEach(() => {
    __resetImportJobsForTests();
  });

  it("Contract: POST /api/import/analyze response", async () => {
    const res = await request(buildApp())
      .post("/api/import/analyze")
      .send({ data: [{ id: 1, name: "a" }] });
    expect(res.status).toBe(200);
    const parsed = analyzeResponseSchema.safeParse(res.body);
    expect(parsed.success).toBe(true);
  });

  it("Contract: POST /api/import/execute response", async () => {
    const res = await request(buildApp())
      .post("/api/import/execute")
      .send({
        targetTable: "devices",
        data: [{ id: 1, name: "dev" }],
      });
    expect(res.status).toBe(200);
    const parsed = executeResponseSchema.safeParse(res.body);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.import.status).toBe("completed");
    }
  });

  it("Contract: Error responses", async () => {
    const res = await request(buildApp())
      .post("/api/import/execute")
      .send({ targetTable: "devices", data: [] });
    expect(res.status).toBe(400);
    const parsed = errorResponseSchema.safeParse(res.body);
    expect(parsed.success).toBe(true);
    expect(typeof res.body.error).toBe("string");
  });

  it("Contract: Versioning", async () => {
    const res = await request(buildApp())
      .post("/api/v1/import/execute")
      .send({
        targetTable: "devices",
        data: [{ id: 2, name: "v1" }],
      });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.import.id).toMatch(
      /^[0-9a-f-]{36}$/i
    );
  });
});
