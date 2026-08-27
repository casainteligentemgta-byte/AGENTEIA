import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import express from "express";
import request from "supertest";
import * as XLSX from "xlsx";
import { FileParser } from "../../services/FileParser";
import {
  __resetImportJobsForTests,
  analyzeRecords,
  enqueueImport,
  getImportJob,
  isExecuteTargetTable,
  isValidTargetTable,
  transformRecords,
  validateRecords,
} from "../../services/ImportService";
import {
  requireAuth,
  requireBodyTablePermission,
  requireRole,
  requireTablePermission,
  type AuthenticatedRequest,
} from "../../api/middleware/auth";
import type { NextFunction, Request, Response } from "express";

vi.mock("../../api/middleware/rateLimit", () => ({
  apiLimiter: (_req: Request, _res: Response, next: NextFunction) => next(),
  importLimiter: (_req: Request, _res: Response, next: NextFunction) => next(),
  passthroughLimiter: (_req: Request, _res: Response, next: NextFunction) =>
    next(),
  buildRateLimitKey: () => "user:test",
  shouldSkipImportLimit: () => false,
}));

const authState = {
  user: {
    id: "user-1",
    email: "user@example.com",
    role: "user" as "user" | "admin",
  },
};

vi.mock("../../api/middleware/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../api/middleware/auth")>();
  return {
    ...actual,
    requireAuth: (req: Request, _res: Response, next: NextFunction) => {
      (req as AuthenticatedRequest).user = { ...authState.user };
      (req as AuthenticatedRequest).supabase =
        {} as AuthenticatedRequest["supabase"];
      next();
    },
  };
});

describe("FileParser formatos adicionales", () => {
  const parser = new FileParser();

  it("acepta application/json, text/csv, application/xml y xlsx", async () => {
    const json = Buffer.from(JSON.stringify([{ a: 1 }]));
    await expect(
      parser.parseFile({
        name: "a.json",
        size: json.length,
        type: "application/json",
        buffer: json,
      })
    ).resolves.toHaveLength(1);

    const csv = Buffer.from("id\n1");
    await expect(
      parser.parseFile({
        name: "a.csv",
        size: csv.length,
        type: "text/csv",
        buffer: csv,
      })
    ).resolves.toHaveLength(1);

    const xml = Buffer.from("<root><item><id>1</id></item></root>");
    await expect(
      parser.parseFile({
        name: "a.xml",
        size: xml.length,
        type: "application/xml",
        buffer: xml,
      })
    ).resolves.toHaveLength(1);

    const wb = XLSX.utils.book_new();
    const sheet = XLSX.utils.json_to_sheet([{ id: 1, name: "Ada" }]);
    XLSX.utils.book_append_sheet(wb, sheet, "Sheet1");
    const xlsx = Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
    await expect(
      parser.parseFile({
        name: "a.xlsx",
        size: xlsx.length,
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        buffer: xlsx,
      })
    ).resolves.toHaveLength(1);
  });

  it("acepta JSON con envoltorio { data: [] }", () => {
    const buf = Buffer.from(JSON.stringify({ data: [{ id: 9 }] }));
    expect(parser.parseJSON(buf)).toEqual([{ id: 9 }]);
  });

  it("parseXLSX y parseXML directos", () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet([{ x: 1 }]),
      "S"
    );
    const buf = Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
    expect(parser.parseXLSX(buf)).toEqual([{ x: "1" }]);

    const xml = Buffer.from(
      "<records><record><n>1</n></record><record><n>2</n></record></records>"
    );
    expect(parser.parseXML(xml)).toHaveLength(2);
  });
});

describe("ImportService", () => {
  beforeEach(() => {
    __resetImportJobsForTests();
  });

  it("valida tablas y analiza/transforma/valida registros", () => {
    expect(isExecuteTargetTable("devices")).toBe(true);
    expect(isExecuteTargetTable("users")).toBe(false);
    expect(isValidTargetTable("users")).toBe(true);

    const data = [{ id: 1, name: "A" }, { id: 2, name: "B" }];
    expect(analyzeRecords(data).recordCount).toBe(2);
    expect(validateRecords(data).valid).toBe(true);
    expect(validateRecords([]).valid).toBe(false);
    expect(transformRecords(data, { name: "nombre" })[0]).toMatchObject({
      nombre: "A",
      id: 1,
    });
  });

  it("encola import y recupera job por id", async () => {
    const job = await enqueueImport({
      user: { id: "user-1", email: "u@e.com", role: "user" },
      targetTable: "devices",
      data: [{ id: 1 }],
    });
    expect(job.userId).toBe("user-1");
    expect(getImportJob(job.id)?.id).toBe(job.id);
    expect(getImportJob("missing")).toBeUndefined();
  });
});

describe("Rutas /api/import (integración)", () => {
  let app: express.Express;

  beforeEach(async () => {
    __resetImportJobsForTests();
    authState.user = {
      id: "user-1",
      email: "user@example.com",
      role: "user",
    };
    vi.resetModules();
    const { default: importRouter } = await import("../../api/routes/import");
    app = express();
    app.use(express.json({ limit: "10mb" }));
    app.use("/api/import", importRouter);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("POST /execute importa lote válido", async () => {
    const res = await request(app)
      .post("/api/import/execute")
      .send({
        targetTable: "devices",
        data: [{ id: 1 }, { id: 2 }],
      });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.import.userId).toBe("user-1");
  });

  it("POST /execute rechaza targetTable inválida", async () => {
    const res = await request(app)
      .post("/api/import/execute")
      .send({ targetTable: "users", data: [{ id: 1 }] });
    expect([400, 403]).toContain(res.status);
    expect(res.body.success).toBe(false);
  });

  it("POST /execute rechaza lote demasiado grande", async () => {
    const data = Array.from({ length: 10_001 }, (_, i) => ({ id: i }));
    const res = await request(app)
      .post("/api/import/execute")
      .send({ targetTable: "devices", data });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Máximo/i);
  });

  it("POST /execute rechaza tabla no ejecutable tras permiso", async () => {
    // sensor_data es permitida; usamos typo para 400 de isExecuteTargetTable
    // (si passara permiso). Aquí "devices" con data no-array.
    const res = await request(app)
      .post("/api/import/execute")
      .send({ targetTable: "devices", data: "no-array" });
    expect(res.status).toBe(400);
  });

  it("POST /analyze, /validate, /transform", async () => {
    const payload = { data: [{ id: 1, name: "x" }] };
    const analyze = await request(app).post("/api/import/analyze").send(payload);
    expect(analyze.status).toBe(200);
    expect(analyze.body.analysis.recordCount).toBe(1);

    const validate = await request(app)
      .post("/api/import/validate")
      .send(payload);
    expect(validate.status).toBe(200);
    expect(validate.body.valid).toBe(true);

    const transform = await request(app)
      .post("/api/import/transform")
      .send({ ...payload, mapping: { name: "nombre" } });
    expect(transform.status).toBe(200);
    expect(transform.body.data[0].nombre).toBe("x");
  });

  it("analyze/validate/transform rechazan entrada inválida", async () => {
    expect(
      (await request(app).post("/api/import/analyze").send({ data: [] })).status
    ).toBe(400);
    expect(
      (await request(app).post("/api/import/validate").send({})).status
    ).toBe(400);
    expect(
      (await request(app).post("/api/import/transform").send({ data: [] }))
        .status
    ).toBe(400);
  });

  it("GET /status solo dueño; 403 otro usuario; 404 si no existe", async () => {
    const created = await request(app)
      .post("/api/import/execute")
      .send({ targetTable: "automations", data: [{ a: 1 }] });
    const id = created.body.import.id as string;

    const ok = await request(app).get(`/api/import/status/${id}`);
    expect(ok.status).toBe(200);
    expect(ok.body.import.id).toBe(id);

    authState.user = {
      id: "otro-user",
      email: "otro@example.com",
      role: "user",
    };
    const forbidden = await request(app).get(`/api/import/status/${id}`);
    expect(forbidden.status).toBe(403);

    const missing = await request(app).get("/api/import/status/no-existe");
    expect(missing.status).toBe(404);
  });

  it("admin puede ver status de otro usuario y meta users", async () => {
    const created = await request(app)
      .post("/api/import/execute")
      .send({ targetTable: "sensor_data", data: [{ a: 1 }] });
    const id = created.body.import.id as string;

    authState.user = {
      id: "admin-1",
      email: "admin@example.com",
      role: "admin",
    };
    const ok = await request(app).get(`/api/import/status/${id}`);
    expect(ok.status).toBe(200);

    const meta = await request(app).get("/api/import/admin/users-meta");
    expect(meta.status).toBe(200);
    expect(meta.body.success).toBe(true);
  });

  it("POST /execute rechaza data vacía", async () => {
    const res = await request(app)
      .post("/api/import/execute")
      .send({ targetTable: "devices", data: [] });
    expect(res.status).toBe(400);
  });
});

describe("Auth helpers adicionales", () => {
  function mockRes() {
    const res = {
      statusCode: 200,
      body: null as unknown,
      status(code: number) {
        this.statusCode = code;
        return this;
      },
      json(payload: unknown) {
        this.body = payload;
        return this;
      },
    };
    return res as unknown as Response & { statusCode: number; body: unknown };
  }

  it("requireBodyTablePermission valida tabla en body", () => {
    const req = {
      user: { id: "u1", email: "a@b.co", role: "user" },
      body: { targetTable: "sensor_data" },
    } as unknown as Request;
    const res = mockRes();
    const next = vi.fn() as unknown as NextFunction;
    requireBodyTablePermission()(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it("requireBodyTablePermission rechaza sin targetTable", () => {
    const req = {
      user: { id: "u1", email: "a@b.co", role: "user" },
      body: {},
    } as unknown as Request;
    const res = mockRes();
    const next = vi.fn() as unknown as NextFunction;
    requireBodyTablePermission()(req, res, next);
    expect(res.statusCode).toBe(400);
  });

  it("requireRole rechaza rol no permitido", () => {
    const req = {
      user: { id: "u1", email: "a@b.co", role: "user" },
    } as unknown as Request;
    const res = mockRes();
    const next = vi.fn() as unknown as NextFunction;
    requireRole(["admin"])(req, res, next);
    expect(res.statusCode).toBe(403);
    expect((res.body as { error: string }).error).toMatch(/permiso/i);
  });

  it("requireAuth sigue exportado (smoke)", () => {
    expect(typeof requireAuth).toBe("function");
    expect(typeof requireTablePermission).toBe("function");
  });
});
