/**
 * Integration tests — flujos multi-tabla con SmartImporter.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { z } from "zod";
import { SmartImporter } from "../../services/SmartImporter";
import { __resetImportJobsForTests } from "../../services/ImportService";

describe("Full Integration Tests", () => {
  beforeEach(() => {
    __resetImportJobsForTests();
  });

  it("Integration: Devices import", async () => {
    const importer = new SmartImporter();
    const schema = z.object({
      id: z.number(),
      name: z.string(),
    });
    const records = Array.from({ length: 1000 }, (_, i) => ({
      id: i,
      name: `d-${i}`,
    }));
    const result = await importer.importWithStrategy(records, {
      targetTable: "devices",
      schema,
      user: { id: "int-1", email: "i@t.co", role: "user" },
    });
    expect(result.transformedCount).toBe(1000);
    expect(result.job.status).toBe("completed");
    expect(result.job.recordCount).toBe(1000);
    await importer.disconnect();
  });

  it("Integration: Automations import", async () => {
    const importer = new SmartImporter();
    const schema = z.object({
      id: z.number(),
      name: z.string(),
      trigger: z.string(),
    });
    const records = Array.from({ length: 500 }, (_, i) => ({
      id: i,
      name: `auto-${i}`,
      trigger: "on_change",
      action: "notify",
    }));
    const result = await importer.importWithStrategy(records, {
      targetTable: "automations",
      schema,
      user: { id: "int-2", email: "i@t.co", role: "user" },
    });
    expect(result.transformedCount).toBe(500);
    expect(result.job.targetTable).toBe("automations");
    await importer.disconnect();
  });

  it("Integration: Sensor data import", async () => {
    const importer = new SmartImporter();
    const schema = z.object({
      id: z.number(),
      value: z.number(),
      ts: z.string(),
    });
    const records = Array.from({ length: 2000 }, (_, i) => ({
      id: i,
      value: Math.random() * 100,
      ts: new Date(Date.now() - i * 1000).toISOString(),
    }));
    const result = await importer.importWithStrategy(records, {
      targetTable: "sensor_data",
      schema,
      user: { id: "int-3", email: "i@t.co", role: "user" },
    });
    expect(result.transformedCount).toBe(2000);
    await importer.disconnect();
  });

  it("Integration: Mixed data import", async () => {
    const schema = z.object({ id: z.number(), name: z.string() });
    const run = (
      table: "devices" | "automations" | "sensor_data",
      n: number
    ) => {
      const importer = new SmartImporter();
      return importer
        .importWithStrategy(
          Array.from({ length: n }, (_, i) => ({
            id: i,
            name: `${table}-${i}`,
          })),
          {
            targetTable: table,
            schema,
            user: { id: "mixed", email: "m@t.co", role: "user" },
          }
        )
        .finally(() => importer.disconnect());
    };

    const results = await Promise.all([
      run("devices", 100),
      run("automations", 100),
      run("sensor_data", 100),
    ]);
    expect(results.every((r) => r.job.status === "completed")).toBe(true);
  });

  it("Integration: Webhook notifications", async () => {
    const webhooks: unknown[] = [];
    const sendWebhook = async (payload: unknown) => {
      webhooks.push(payload);
      return { ok: true };
    };

    const importer = new SmartImporter();
    const result = await importer.importWithStrategy([{ id: 1, name: "hook" }], {
      targetTable: "devices",
      schema: z.object({ id: z.number(), name: z.string() }),
      user: { id: "hook", email: "h@t.co", role: "user" },
    });
    await sendWebhook({
      event: "import.completed",
      importId: result.job.id,
      count: result.transformedCount,
    });
    expect(webhooks).toHaveLength(1);
    expect((webhooks[0] as { event: string }).event).toBe("import.completed");
    await importer.disconnect();
  });
});
