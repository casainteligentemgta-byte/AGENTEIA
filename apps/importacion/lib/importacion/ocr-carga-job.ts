import { createAdminClient } from "@/lib/supabase/admin";
import { VEHICULO_DOCS_BUCKET } from "@/lib/vehiculos/upload-documento";
import {
  isStorageMimeRejected,
  OCR_JOB_CONTENT_TYPES,
} from "@/lib/importacion/ocr-carga-job-mime";

export { isStorageMimeRejected, OCR_JOB_CONTENT_TYPES } from "@/lib/importacion/ocr-carga-job-mime";

export type OcrCargaJobStatus = "queued" | "running" | "done" | "error";

export type OcrCargaFormSnapshot = {
  etapa: string;
  storageDocs: string;
  rowsJson: string;
};

export type OcrCargaJob = {
  id: string;
  tallerId: string;
  userId: string;
  runToken: string;
  status: OcrCargaJobStatus;
  form: OcrCargaFormSnapshot;
  result?: unknown;
  error?: string;
  updatedAt: string;
};

function jobPath(tallerId: string, jobId: string): string {
  const id = jobId.replace(/[^a-fA-F0-9-]/g, "");
  if (id.length < 8) throw new Error("Job inválido");
  return `${tallerId}/carga-masiva-temp/ocr-jobs/${id}.json`;
}

export function snapshotCargaForm(fd: FormData): OcrCargaFormSnapshot {
  return {
    etapa: String(fd.get("etapa") ?? "vins"),
    storageDocs: String(fd.get("storageDocs") ?? ""),
    rowsJson: String(fd.get("rowsJson") ?? ""),
  };
}

export function formFromSnapshot(snapshot: OcrCargaFormSnapshot): FormData {
  const fd = new FormData();
  fd.set("etapa", snapshot.etapa);
  if (snapshot.storageDocs) fd.set("storageDocs", snapshot.storageDocs);
  if (snapshot.rowsJson) fd.set("rowsJson", snapshot.rowsJson);
  return fd;
}

export async function writeOcrCargaJob(job: OcrCargaJob): Promise<void> {
  const admin = createAdminClient();
  const path = jobPath(job.tallerId, job.id);
  const body = Buffer.from(
    JSON.stringify({ ...job, updatedAt: new Date().toISOString() })
  );

  let lastError = "";
  for (const contentType of OCR_JOB_CONTENT_TYPES) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      const { error } = await admin.storage
        .from(VEHICULO_DOCS_BUCKET)
        .upload(path, body, {
          upsert: true,
          contentType,
          cacheControl: "0",
        });
      if (!error) return;
      lastError = error.message;
      await admin.storage.from(VEHICULO_DOCS_BUCKET).remove([path]);
      if (isStorageMimeRejected(lastError)) break;
    }
  }
  throw new Error(lastError || "No se pudo guardar el trabajo OCR");
}

export async function readOcrCargaJob(
  tallerId: string,
  jobId: string
): Promise<OcrCargaJob | null> {
  const admin = createAdminClient();
  const { data, error } = await admin.storage
    .from(VEHICULO_DOCS_BUCKET)
    .download(jobPath(tallerId, jobId));
  if (error || !data) return null;
  const text = await data.text();
  try {
    return JSON.parse(text) as OcrCargaJob;
  } catch {
    return null;
  }
}
