/**
 * Escenarios k6 para SmartImport.
 */
export const scenarios = {
  gradual: {
    stages: [
      { duration: "1m", target: 10 },
      { duration: "2m", target: 50 },
      { duration: "3m", target: 100 },
      { duration: "2m", target: 50 },
      { duration: "1m", target: 0 },
    ],
    thresholds: {
      http_req_duration: ["p(95)<500", "p(99)<1000"],
      http_req_failed: ["rate<0.1"],
      http_reqs: ["rate>10"],
    },
  },
  burst: {
    scenarios: {
      burst: {
        executor: "constant-arrival-rate",
        rate: 1000,
        timeUnit: "1s",
        duration: "30s",
        preAllocatedVUs: 100,
        maxVUs: 1000,
      },
    },
    thresholds: {
      http_req_failed: ["rate<0.2"],
    },
  },
  spike: {
    stages: [
      { duration: "30s", target: 20 },
      { duration: "10s", target: 500 },
      { duration: "30s", target: 20 },
      { duration: "10s", target: 0 },
    ],
    thresholds: {
      http_req_failed: ["rate<0.25"],
    },
  },
  endurance: {
    stages: [
      { duration: "5m", target: 10 },
      { duration: "50m", target: 20 },
      { duration: "5m", target: 0 },
    ],
    thresholds: {
      http_req_failed: ["rate<0.05"],
      http_req_duration: ["p(95)<800"],
    },
  },
  /** Escenario corto para CI / smoke local */
  smoke: {
    vus: 2,
    duration: "10s",
    thresholds: {
      http_req_failed: ["rate<0.5"],
    },
  },
};

/** Alias TypeScript-friendly (documentación). */
export function scenario(name) {
  return scenarios[name];
}
