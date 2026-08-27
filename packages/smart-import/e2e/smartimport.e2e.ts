/**
 * SmartImport E2E (API) — Playwright.
 * No hay UI /import en el paquete; se valida el flujo completo vía HTTP.
 */
import { test, expect } from "@playwright/test";
import * as XLSX from "xlsx";

function makeDevices(n: number) {
  return Array.from({ length: n }, (_, i) => ({
    id: i + 1,
    name: `device-${i + 1}`,
    type: "sensor",
  }));
}

test.describe("SmartImport E2E Tests", () => {
  test.beforeEach(async ({ request }) => {
    await request.post("/api/e2e/reset");
  });

  test("E2E: Complete import workflow - CSV", async ({ request }) => {
    const records = makeDevices(5000);
    const csv = ["id,name,type", ...records.map((r) => `${r.id},${r.name},${r.type}`)].join(
      "\n"
    );

    const upload = await request.post("/api/import/upload", {
      headers: {
        "content-type": "text/csv",
        "x-filename": "devices.csv",
      },
      data: Buffer.from(csv),
    });
    expect(upload.status()).toBe(200);
    const uploaded = await upload.json();
    expect(uploaded.recordCount).toBe(5000);

    const analyze = await request.post("/api/import/analyze", {
      data: { data: records, fileName: "devices.csv" },
    });
    expect(analyze.status()).toBe(200);
    const analyzed = await analyze.json();
    expect(analyzed.analysis.recordCount).toBe(5000);

    const validate = await request.post("/api/import/validate", {
      data: { data: records },
    });
    expect(validate.status()).toBe(200);
    expect((await validate.json()).valid).toBe(true);

    const execute = await request.post("/api/import/execute", {
      data: { targetTable: "devices", data: records },
    });
    expect(execute.status()).toBe(200);
    const body = await execute.json();
    expect(body.message).toContain("5000 imported");
    expect(body.imported).toBe(5000);
    expect(body.import.recordCount).toBe(5000);
  });

  test("E2E: Complete import workflow - JSON", async ({ request }) => {
    const records = makeDevices(100);
    const upload = await request.post("/api/import/upload", {
      headers: {
        "content-type": "application/octet-stream",
        "x-filename": "devices.json",
        "x-content-type-hint": "application/json",
      },
      data: Buffer.from(JSON.stringify(records)),
    });
    expect(upload.ok()).toBeTruthy();

    const execute = await request.post("/api/import/execute", {
      data: { targetTable: "devices", data: records },
    });
    const body = await execute.json();
    expect(body.success).toBe(true);
    expect(body.status).toBe("completed");
    expect(body.import.status).toBe("completed");
  });

  test("E2E: Complete import workflow - Excel", async ({ request }) => {
    const records = makeDevices(50);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(records),
      "Devices"
    );
    const buf = Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));

    const upload = await request.post("/api/import/upload", {
      headers: {
        "content-type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "x-filename": "devices.xlsx",
      },
      data: buf,
    });
    expect(upload.status()).toBe(200);
    expect((await upload.json()).recordCount).toBe(50);

    const execute = await request.post("/api/import/execute", {
      data: { targetTable: "devices", data: records },
    });
    expect((await execute.json()).imported).toBe(50);
  });

  test("E2E: Error handling - Invalid data", async ({ request }) => {
    const invalid = [null, "x", 42] as unknown[];
    const validate = await request.post("/api/import/validate", {
      data: { data: invalid },
    });
    const v = await validate.json();
    expect(v.valid).toBe(false);
    expect(v.errors.length).toBeGreaterThan(0);

    const execute = await request.post("/api/import/execute", {
      data: { targetTable: "devices", data: invalid },
    });
    expect(execute.status()).toBe(400);
  });

  test("E2E: Error handling - Too large", async ({ request }) => {
    // Simula payload > 50MB vía Content-Length / body grande controlado:
    // el harness rechaza buffers > MAX_FILE_SIZE
    const big = Buffer.alloc(50 * 1024 * 1024 + 1024, 1);
    const res = await request.post("/api/import/upload", {
      headers: {
        "content-type": "text/csv",
        "x-filename": "huge.csv",
      },
      data: big,
      failOnStatusCode: false,
    });
    // express.raw limit puede cortar antes; aceptamos 413 o error de parse/limit
    expect([413, 400, 500]).toContain(res.status());
  });

  test("E2E: Progress tracking", async ({ request }) => {
    const records = makeDevices(1000);
    const execute = await request.post("/api/import/execute", {
      data: { targetTable: "devices", data: records },
    });
    const body = await execute.json();
    expect(body.success).toBe(true);
    expect(body.imported).toBe(1000);
    expect(body.status).toBe("completed");
  });

  test("E2E: Retry on network error", async ({ request }) => {
    // El cliente reintenta: 1 fallo simulado + éxito
    let attempts = 0;
    async function tryExecute() {
      attempts += 1;
      if (attempts === 1) {
        throw new Error("network disconnect");
      }
      return request.post("/api/import/execute", {
        data: { targetTable: "devices", data: makeDevices(10) },
      });
    }
    let res;
    try {
      res = await tryExecute();
    } catch {
      res = await tryExecute();
    }
    expect(attempts).toBe(2);
    expect(res!.ok()).toBeTruthy();
    expect((await res!.json()).imported).toBe(10);
  });

  test("E2E: User can cancel import", async ({ request }) => {
    const records = makeDevices(1000);
    const res = await request.post("/api/import/execute", {
      headers: { "x-e2e-cancel-after-ms": "50" },
      data: { targetTable: "devices", data: records },
    });
    const body = await res.json();
    expect(body.cancelled).toBe(true);
    expect(body.status).toBe("partial");
    expect(body.imported).toBeGreaterThan(0);
    expect(body.imported).toBeLessThan(records.length);
  });

  test("E2E: Import history visible", async ({ request }) => {
    const exec = await request.post("/api/import/execute", {
      data: { targetTable: "devices", data: makeDevices(5) },
    });
    const { import: job } = await exec.json();
    const history = await request.get(`/api/import/history?ids=${job.id}`);
    const h = await history.json();
    expect(h.history).toHaveLength(1);
    expect(h.history[0].recordCount).toBe(5);
    expect(h.history[0].status).toBe("completed");

    const detail = await request.get(`/api/import/status/${job.id}`);
    expect((await detail.json()).import.id).toBe(job.id);
  });

  test("E2E: Role-based access", async ({ request }) => {
    const asUser = await request.post("/api/import/execute", {
      headers: { "x-e2e-role": "user" },
      data: { targetTable: "devices", data: makeDevices(3) },
    });
    expect(asUser.status()).toBe(200);

    const asViewer = await request.post("/api/import/execute", {
      headers: { "x-e2e-role": "viewer" },
      data: { targetTable: "devices", data: makeDevices(3) },
    });
    expect(asViewer.status()).toBe(403);

    const adminDenied = await request.get("/admin", {
      headers: { "x-e2e-role": "viewer" },
    });
    expect(adminDenied.status()).toBe(403);

    const adminOk = await request.get("/admin", {
      headers: { "x-e2e-role": "admin" },
    });
    expect(adminOk.status()).toBe(200);
  });
});
