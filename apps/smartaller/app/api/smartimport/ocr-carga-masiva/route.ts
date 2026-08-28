import { handleOcrCargaGet, handleOcrCargaPost } from "@/lib/importacion/ocr-carga-masiva-http";
import { requireTallerAuth } from "@/lib/importacion/taller-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

async function getAuth() {
  const auth = await requireTallerAuth();
  if (auth.error || !auth.taller) {
    return { error: auth.error ?? "No autorizado" as const };
  }
  return { error: null, tallerId: auth.taller.id, userId: auth.user.id };
}

export async function GET(request: Request) {
  return handleOcrCargaGet(request, getAuth);
}

export async function POST(request: Request) {
  return handleOcrCargaPost(request, getAuth);
}
