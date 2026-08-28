import { handleOcrCargaRun } from "@/lib/importacion/ocr-carga-masiva-http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(request: Request) {
  return handleOcrCargaRun(request);
}
