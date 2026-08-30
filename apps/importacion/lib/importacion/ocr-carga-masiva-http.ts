import { waitUntil } from "@vercel/functions";
import { NextResponse } from "next/server";
import { extractCargaMasivaEtapaAction } from "@/app/actions/nfc/importacion-carga-masiva";
import {
  formFromSnapshot,
  readOcrCargaJob,
  snapshotCargaForm,
  writeOcrCargaJob,
  type OcrCargaJob,
} from "@/lib/importacion/ocr-carga-job";

export type OcrRouteAuth =
  | { error: string; tallerId?: undefined; userId?: undefined }
  | { error: null; tallerId: string; userId: string };

type GetAuth = () => Promise<OcrRouteAuth>;

const NO_STORE = { "Cache-Control": "no-store, max-age=0" };

export async function runOcrCargaJob(job: OcrCargaJob): Promise<void> {
  const current = await readOcrCargaJob(job.tallerId, job.id);
  if (!current) return;
  if (current.status === "done" || current.status === "error") return;
  if (current.status === "running") return;

  await writeOcrCargaJob({ ...current, status: "running" });
  try {
    const fd = formFromSnapshot(current.form);
    const result = await extractCargaMasivaEtapaAction(fd, {
      taller: { id: current.tallerId },
      userId: current.userId,
    });
    await writeOcrCargaJob({
      ...current,
      status: result.success ? "done" : "error",
      result,
      error: result.success ? undefined : result.error,
    });
  } catch (err) {
    await writeOcrCargaJob({
      ...current,
      status: "error",
      error:
        err instanceof Error ? err.message : "No se pudo extraer la carga masiva",
    });
  }
}

function json(data: unknown, status = 200): NextResponse {
  return NextResponse.json(data, { status, headers: NO_STORE });
}

export async function handleOcrCargaGet(
  request: Request,
  getAuth: GetAuth
): Promise<NextResponse> {
  const jobId = new URL(request.url).searchParams.get("job");
  if (!jobId) {
    return json({ ok: true, service: "ocr-carga-masiva" });
  }
  const auth = await getAuth();
  if (auth.error || !auth.tallerId) {
    return json({ error: auth.error ?? "No autorizado" }, 401);
  }
  const job = await readOcrCargaJob(auth.tallerId, jobId);
  if (!job || job.userId !== auth.userId) {
    return json({ error: "Trabajo no encontrado" }, 404);
  }
  return json({
    status: job.status,
    result: job.result ?? null,
    error: job.error ?? null,
  });
}

export async function handleOcrCargaRun(request: Request): Promise<NextResponse> {
  let body: { jobId?: unknown; tallerId?: unknown; runToken?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return json({ error: "JSON inválido" }, 400);
  }
  const jobId = String(body.jobId ?? "");
  const tallerId = String(body.tallerId ?? "");
  const runToken = String(body.runToken ?? "");
  if (jobId.length < 8 || !tallerId || runToken.length < 8) {
    return json({ error: "Trabajo inválido" }, 400);
  }
  const job = await readOcrCargaJob(tallerId, jobId);
  if (!job || job.runToken !== runToken) {
    return json({ error: "Trabajo no encontrado" }, 404);
  }
  await runOcrCargaJob(job);
  return json({ ok: true });
}

function kickRunHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    "content-type": "application/json",
  };
  const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
  if (bypass) headers["x-vercel-protection-bypass"] = bypass;
  return headers;
}

export async function handleOcrCargaPost(
  request: Request,
  getAuth: GetAuth
): Promise<NextResponse> {
  try {
    const auth = await getAuth();
    if (auth.error || !auth.tallerId || !auth.userId) {
      return json({ success: false, error: auth.error ?? "No autorizado" }, 401);
    }
    const formData = await request.formData();
    const form = snapshotCargaForm(formData);
    const runInline = async () =>
      extractCargaMasivaEtapaAction(formFromSnapshot(form), {
        taller: { id: auth.tallerId },
        userId: auth.userId,
      });

    const jobId = crypto.randomUUID();
    const job: OcrCargaJob = {
      id: jobId,
      tallerId: auth.tallerId,
      userId: auth.userId,
      runToken: crypto.randomUUID(),
      status: "queued",
      form,
      updatedAt: new Date().toISOString(),
    };
    try {
      await writeOcrCargaJob(job);
    } catch {
      // Bucket de documentos no admite JSON: extraer aquí (Safari/LTE igual ve filas).
      return json(await runInline());
    }

    const runUrl = new URL("/api/smartimport/ocr-carga-masiva/run", request.url);
    const payload = JSON.stringify({
      jobId: job.id,
      tallerId: job.tallerId,
      runToken: job.runToken,
    });
    waitUntil(
      fetch(runUrl, {
        method: "POST",
        headers: kickRunHeaders(),
        body: payload,
      }).then(async (res) => {
        if (res.ok) return;
        const latest = await readOcrCargaJob(job.tallerId, job.id);
        if (latest?.status === "queued") await runOcrCargaJob(job);
      }).catch(async () => {
        const latest = await readOcrCargaJob(job.tallerId, job.id);
        if (latest?.status === "queued") await runOcrCargaJob(job);
      })
    );
    waitUntil(
      (async () => {
        await new Promise((resolve) => setTimeout(resolve, 4000));
        const latest = await readOcrCargaJob(job.tallerId, job.id);
        if (latest?.status === "queued") await runOcrCargaJob(job);
      })()
    );

    return json({ pending: true, jobId: job.id });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "No se pudo extraer la carga masiva";
    return json({ success: false, error: message }, 500);
  }
}
