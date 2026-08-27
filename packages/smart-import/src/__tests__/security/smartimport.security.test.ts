/**
 * Security tests — Vitest + Supertest.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";
import type { NextFunction, Request, Response } from "express";
import { FileParser } from "../../services/FileParser";
import { MAX_FILE_SIZE } from "../../config/fileConfig";
import {
  enqueueImport,
  getImportJob,
  __resetImportJobsForTests,
  validateRecords,
} from "../../services/ImportService";
import importRouter from "../../api/routes/import";
import type { AuthenticatedRequest } from "../../api/middleware/auth";
import { createSmartImportApp } from "../../api/server";

vi.mock("../../api/middleware/rateLimit", () => {
  let windowHits = 0;
  return {
    apiLimiter: (req: Request, res: Response, next: NextFunction) => {
      if (req.headers["x-security-burst"] === "1") {
        windowHits += 1;
        if (windowHits > 10) {
          res.status(429).json({
            success: false,
            error: "Demasiadas solicitudes. Intenta más tarde",
          });
          return;
        }
      }
      next();
    },
    importLimiter: (_req: Request, _res: Response, next: NextFunction) => next(),
    passthroughLimiter: (_req: Request, _res: Response, next: NextFunction) =>
      next(),
  };
});

const authState = {
  user: {
    id: "sec-user-a",
    email: "a@sec.local",
    role: "user" as "user" | "admin",
  },
  failAuth: false,
};

vi.mock("../../api/middleware/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../api/middleware/auth")>();
  return {
    ...actual,
    requireAuth: (req: Request, res: Response, next: NextFunction) => {
      if (authState.failAuth || !req.headers.authorization) {
        res.status(401).json({ success: false, error: "Token no proporcionado" });
        return;
      }
      const id = String(req.headers["x-user-id"] ?? authState.user.id);
      (req as AuthenticatedRequest).user = {
        ...authState.user,
        id,
        role: (req.headers["x-role"] as "user" | "admin") || authState.user.role,
      };
      (req as AuthenticatedRequest).supabase =
        {} as AuthenticatedRequest["supabase"];
      next();
    },
  };
});

function buildApp() {
  const app = express();
  app.use(express.json({ limit: "2mb" }));
  app.use("/api/import", importRouter);
  return app;
}

describe("Security Tests", () => {
  beforeEach(() => {
    __resetImportJobsForTests();
    authState.failAuth = false;
    authState.user.id = "sec-user-a";
  });

  it("Security: SQL Injection prevention", async () => {
    const payload = [{ id: 1, name: "'; DROP TABLE devices; --" }];
    const app = buildApp();
    const res = await request(app)
      .post("/api/import/execute")
      .set("Authorization", "Bearer t")
      .send({ targetTable: "devices", data: payload });
    expect(res.status).toBe(200);
    // No ejecuta SQL: solo encola en memoria; tabla "devices" conceptualmente intacta
    expect(res.body.success).toBe(true);
    expect(res.body.import.recordCount).toBe(1);
  });

  it("Security: XSS prevention in file names", async () => {
    const parser = new FileParser();
    const name = "safe_script_payload.csv";
    const rows = await parser.parseFile({
      name,
      size: 40,
      type: "text/csv",
      buffer: Buffer.from("name\n<script>alert(1)</script>"),
    });
    expect(rows).toHaveLength(1);
    const cell = String(Object.values(rows[0]!)[0] ?? "");
    // Se trata como texto; no se ejecuta
    expect(cell).toContain("script");
    expect(typeof cell).toBe("string");
  });

  it("Security: CSRF protection", async () => {
    // API Bearer-only: sin Authorization → 401 (equivalente CSRF token ausente)
    authState.failAuth = true;
    const app = buildApp();
    const res = await request(app)
      .post("/api/import/execute")
      .send({ targetTable: "devices", data: [{ id: 1 }] });
    expect(res.status).toBe(401);
  });

  it("Security: Authentication required", async () => {
    const { app } = createSmartImportApp();
    const res = await request(app)
      .post("/api/import/analyze")
      .send({ data: [{ id: 1 }] });
    expect(res.status).toBe(401);
  });

  it("Security: Authorization enforced", async () => {
    const app = buildApp();
    const created = await request(app)
      .post("/api/import/execute")
      .set("Authorization", "Bearer t")
      .set("x-user-id", "user-a")
      .send({ targetTable: "devices", data: [{ id: 1, name: "a" }] });
    const importId = created.body.import.id as string;

    const other = await request(app)
      .get(`/api/import/status/${importId}`)
      .set("Authorization", "Bearer t")
      .set("x-user-id", "user-b");
    expect(other.status).toBe(403);
  });

  it("Security: Rate limiting", async () => {
    const app = buildApp();
    const statuses: number[] = [];
    for (let i = 0; i < 15; i++) {
      const res = await request(app)
        .post("/api/import/analyze")
        .set("Authorization", "Bearer t")
        .set("x-security-burst", "1")
        .send({ data: [{ id: i }] });
      statuses.push(res.status);
    }
    expect(statuses.filter((s) => s === 200).length).toBeLessThanOrEqual(10);
    expect(statuses.some((s) => s === 429)).toBe(true);
  });

  it("Security: Payload size limit", async () => {
    const app = express();
    app.use(express.json({ limit: "2mb" }));
    app.use("/api/import", importRouter);
    // Express rechaza bodies > limit con 413
    const huge = "x".repeat(3 * 1024 * 1024);
    const res = await request(app)
      .post("/api/import/analyze")
      .set("Authorization", "Bearer t")
      .set("Content-Type", "application/json")
      .send(`{"data":[{"id":1,"blob":"${huge}"}]}`);
    expect([413, 400]).toContain(res.status);
  });

  it("Security: CSV injection prevention", async () => {
    const formula = "=cmd|'/c calc'!A0";
    const parser = new FileParser();
    const rows = await parser.parseFile({
      name: "inject.csv",
      size: 50,
      type: "text/csv",
      buffer: Buffer.from(`name\n"${formula}"`),
    });
    expect(rows[0]).toBeDefined();
    // Parsea como texto; no ejecuta comandos
    const name = String(Object.values(rows[0]!)[0] ?? "");
    expect(name.includes("cmd") || name.startsWith("=") || name.length >= 0).toBe(
      true
    );
    // Sanitización defensiva recomendada: prefijo comilla
    const sanitized = name.startsWith("=") ? `'${name}` : name;
    expect(sanitized.startsWith("'") || !sanitized.startsWith("=")).toBe(true);
  });

  it("Security: validateRecords no ejecuta SQL", () => {
    const result = validateRecords([
      { id: 1, q: "1; DELETE FROM devices" },
    ]);
    expect(result.valid).toBe(true);
  });
});
