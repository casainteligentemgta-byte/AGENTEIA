import { handleOcrCargaGet, handleOcrCargaPost } from "@/lib/importacion/ocr-carga-masiva-http";
import { getUser } from "@/lib/supabase/server";
import { getMyTaller } from "@/lib/taller";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

async function getAuth() {
  const user = await getUser();
  if (!user) return { error: "No autenticado" as const };
  const taller = await getMyTaller();
  if (!taller) return { error: "No se encontró tu taller" as const };
  return { error: null, tallerId: taller.id, userId: user.id };
}

export async function GET(request: Request) {
  return handleOcrCargaGet(request, getAuth);
}

export async function POST(request: Request) {
  return handleOcrCargaPost(request, getAuth);
}
