#!/usr/bin/env node
/**
 * Docker / K8s healthcheck — GET /health must return 2xx.
 */
const port = process.env.PORT || "3000";
const host = process.env.HEALTHCHECK_HOST || "127.0.0.1";

const req = require("http").get(
  `http://${host}:${port}/health`,
  { timeout: 2500 },
  (res) => {
    const ok = res.statusCode >= 200 && res.statusCode < 400;
    process.exit(ok ? 0 : 1);
  }
);

req.on("error", () => process.exit(1));
req.on("timeout", () => {
  req.destroy();
  process.exit(1);
});
