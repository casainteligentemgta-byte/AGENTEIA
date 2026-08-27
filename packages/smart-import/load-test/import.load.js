/**
 * Load test k6 — SmartImport import API.
 * Ejecutar: k6 run load-test/import.load.js
 * (k6 no ejecuta TypeScript nativo; este .js es la fuente canónica)
 */
import http from "k6/http";
import { check, sleep, group } from "k6";
import { Counter, Trend, Gauge } from "k6/metrics";
import { scenarios } from "./scenarios.js";

const BASE_URL = __ENV.BASE_URL || "http://127.0.0.1:3100";
const TOKEN = __ENV.TOKEN || "e2e-test-token";

const batchesImported = new Counter("batches_imported");
const importDuration = new Trend("import_duration_ms");
const activeUsers = new Gauge("active_vus_custom");

const selected = __ENV.SCENARIO || "gradual";

export const options = scenarios[selected] || scenarios.gradual;

function makeBatch(n) {
  const data = [];
  for (let i = 0; i < n; i++) {
    data.push({
      id: i + 1,
      name: `dev-${__VU}-${__ITER}-${i}`,
      type: "sensor",
    });
  }
  return data;
}

export default function () {
  activeUsers.add(__VU);
  const headers = {
    Authorization: `Bearer ${TOKEN}`,
    "Content-Type": "application/json",
    "x-e2e-role": "admin",
    "x-e2e-user-id": `load-${__VU}`,
  };
  const batch = makeBatch(100);

  group("Analyze Phase", () => {
    const res = http.post(
      `${BASE_URL}/api/import/analyze`,
      JSON.stringify({ data: batch, fileName: "load.json" }),
      { headers }
    );
    check(res, {
      "analyze status 200": (r) => r.status === 200,
    });
  });

  group("Validation Phase", () => {
    const res = http.post(
      `${BASE_URL}/api/import/validate`,
      JSON.stringify({ data: batch }),
      { headers }
    );
    check(res, {
      "validate status 200": (r) => r.status === 200,
      "validate valid": (r) => {
        try {
          return r.json("valid") === true;
        } catch {
          return false;
        }
      },
    });
  });

  group("Execute Phase", () => {
    const t0 = Date.now();
    const res = http.post(
      `${BASE_URL}/api/import/execute`,
      JSON.stringify({ targetTable: "devices", data: batch }),
      { headers }
    );
    const ms = Date.now() - t0;
    importDuration.add(ms);
    const ok = check(res, {
      "execute status 200": (r) => r.status === 200,
      "imported > 0": (r) => {
        try {
          return (r.json("imported") || 0) > 0;
        } catch {
          return false;
        }
      },
    });
    if (ok) batchesImported.add(1);
  });

  sleep(1);
}
