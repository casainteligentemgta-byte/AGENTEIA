import express from "express";
import { importRouter } from "./index";

const PORT = Number(process.env.PORT ?? 3000);

const app = express();
app.set("trust proxy", 1);
app.use(express.json({ limit: "2mb" }));

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "@agenteia/smart-import" });
});

app.use("/api/import", importRouter);

app.use(
  (
    err: unknown,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    console.error(
      "[smart-import.dev] Error:",
      err instanceof Error ? err.message : err
    );
    res.status(500).json({ success: false, error: "Error interno" });
  }
);

app.listen(PORT, () => {
  console.log(`[smart-import] listening on http://localhost:${PORT}`);
  console.log(`  POST /api/import/execute`);
  console.log(`  POST /api/import/analyze`);
  console.log(`  POST /api/import/validate`);
  console.log(`  POST /api/import/transform`);
  console.log(`  GET  /api/import/status/:importId`);
});
