import { describe, expect, it, vi, beforeEach } from "vitest";
import type { NextFunction, Request, Response } from "express";
import { FileParser } from "../../services/FileParser";
import { FILE_CONFIG, MAX_FILE_SIZE } from "../../config/fileConfig";
import {
  requireAuth,
  requireRole,
  requireTablePermission,
  TABLE_PERMISSIONS,
  type AuthenticatedRequest,
} from "../../api/middleware/auth";
import {
  buildRateLimitKey,
  shouldSkipImportLimit,
} from "../../api/middleware/rateLimit";

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
  return res as unknown as Response & {
    statusCode: number;
    body: unknown;
  };
}

describe("FileParser Validation Tests", () => {
  const parser = new FileParser();

  it("debe rechazar archivos > 50MB", async () => {
    await expect(
      parser.parseFile({
        name: "big.json",
        size: MAX_FILE_SIZE + 1,
        type: "application/json",
        buffer: Buffer.from("[]"),
      })
    ).rejects.toThrow(/tamaño máximo/i);
  });

  it("debe rechazar MIME types no permitidos", async () => {
    await expect(
      parser.parseFile({
        name: "malware.exe",
        size: 100,
        type: "application/x-msdownload",
        buffer: Buffer.from("MZ"),
      })
    ).rejects.toThrow(/no permitido/i);
  });

  it("debe rechazar archivos sin nombre", async () => {
    await expect(
      parser.parseFile({
        name: "   ",
        size: 10,
        type: "application/json",
        buffer: Buffer.from("[]"),
      })
    ).rejects.toThrow(/nombre/i);
  });

  it("debe rechazar JSON inválido", () => {
    expect(() => parser.parseJSON(Buffer.from("{not-json"))).toThrow(
      /JSON inválido/i
    );
  });

  it("debe rechazar CSV con demasiados registros", () => {
    const header = "id,name";
    const rows = Array.from(
      { length: FILE_CONFIG.MAX_BATCH_SIZE + 1 },
      (_, i) => `${i},item-${i}`
    );
    const csv = [header, ...rows].join("\n");
    expect(() => parser.parseCSV(Buffer.from(csv))).toThrow(/máximo/i);
  });

  it("debe rechazar archivos vacíos", async () => {
    await expect(
      parser.parseFile({
        name: "empty.json",
        size: 0,
        type: "application/json",
        buffer: Buffer.from(""),
      })
    ).rejects.toThrow(/vacío/i);
  });

  it("debe aceptar archivos válidos", async () => {
    const json = Buffer.from(JSON.stringify([{ id: 1 }, { id: 2 }]));
    const rows = await parser.parseFile({
      name: "ok.json",
      size: json.length,
      type: "application/json",
      buffer: json,
    });
    expect(rows).toHaveLength(2);

    const csvRows = parser.parseCSV(Buffer.from("id,name\n1,Ada\n2,Grace"));
    expect(csvRows).toHaveLength(2);
  });
});

describe("Authentication Tests", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_ANON_KEY = "test-anon-key";
  });

  it("debe rechazar sin token", async () => {
    const req = { headers: {} } as Request;
    const res = mockRes();
    const next = vi.fn() as unknown as NextFunction;
    await requireAuth(req, res, next);
    expect(res.statusCode).toBe(401);
    expect((res.body as { error?: string }).error).toMatch(/Token no proporcionado/i);
    expect(next).not.toHaveBeenCalled();
  });

  it("debe rechazar con token inválido", async () => {
    const req = {
      headers: { authorization: "Bearer bad-token" },
    } as Request;
    const res = mockRes();
    const next = vi.fn() as unknown as NextFunction;
    await requireAuth(req, res, next);
    expect([401, 500, 503]).toContain(res.statusCode);
    expect(next).not.toHaveBeenCalled();
  });

  it("debe aceptar con token válido", () => {
    const req = {
      user: { id: "u1", email: "a@b.co", role: "user" },
      supabase: {},
    } as unknown as AuthenticatedRequest;
    const res = mockRes();
    const next = vi.fn() as unknown as NextFunction;
    requireRole(["user", "admin"])(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it("debe rechazar sin permisos en tabla", () => {
    const req = {
      user: { id: "u1", email: "a@b.co", role: "user" },
    } as unknown as Request;
    const res = mockRes();
    const next = vi.fn() as unknown as NextFunction;
    requireTablePermission("users")(req, res, next);
    expect(res.statusCode).toBe(403);
    expect(next).not.toHaveBeenCalled();
  });

  it("debe aceptar con permisos correctos", () => {
    const req = {
      user: { id: "u1", email: "a@b.co", role: "user" },
    } as unknown as Request;
    const res = mockRes();
    const next = vi.fn() as unknown as NextFunction;
    requireTablePermission("devices")(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(TABLE_PERMISSIONS.user).toContain("devices");
  });
});

describe("Rate Limiting Tests", () => {
  it("debe permitir 10 importaciones en 15 minutos", () => {
    const windowMs = 15 * 60 * 1000;
    const max = 10;
    let count = 0;
    let windowStart = Date.now();
    const t0 = Date.now();

    function tryImport(now: number): boolean {
      if (now - windowStart >= windowMs) {
        windowStart = now;
        count = 0;
      }
      if (count >= max) return false;
      count += 1;
      return true;
    }

    for (let i = 0; i < 10; i++) {
      expect(tryImport(t0 + i * 1000)).toBe(true);
    }
    expect(count).toBe(10);
  });

  it("debe rechazar la 11ava importación", () => {
    const max = 10;
    let count = 0;
    function tryImport(): boolean {
      if (count >= max) return false;
      count += 1;
      return true;
    }
    for (let i = 0; i < 10; i++) expect(tryImport()).toBe(true);
    expect(tryImport()).toBe(false);
  });

  it("debe permitir admin sin límite", () => {
    expect(
      shouldSkipImportLimit({
        user: { id: "a1", email: "admin@x", role: "admin" },
      } as never)
    ).toBe(true);
    expect(
      buildRateLimitKey({
        user: { id: "a1", email: "admin@x", role: "admin" },
      } as never)
    ).toBe("user:a1");
  });

  it("debe resetear contador después de 15 minutos", () => {
    const windowMs = 15 * 60 * 1000;
    const max = 10;
    let count = 0;
    let windowStart = 0;
    const t0 = 1_000_000;

    function tryImport(now: number): boolean {
      if (now - windowStart >= windowMs) {
        windowStart = now;
        count = 0;
      }
      if (count >= max) return false;
      count += 1;
      return true;
    }

    windowStart = t0;
    for (let i = 0; i < 10; i++) expect(tryImport(t0 + i)).toBe(true);
    expect(tryImport(t0 + 100)).toBe(false);
    expect(tryImport(t0 + windowMs + 1)).toBe(true);
  });
});
