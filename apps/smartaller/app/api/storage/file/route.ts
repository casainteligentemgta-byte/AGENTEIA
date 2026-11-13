import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUser } from "@/lib/supabase/server";
import { canAccessPrivateStoragePath } from "@/lib/storage/authorize";
import { isPrivateStorageBucket } from "@/lib/storage/buckets";
import { createSignedStorageUrl, isSafeStoragePath } from "@/lib/storage/signed-url";

export const dynamic = "force-dynamic";

/**
 * Sirve archivos de buckets privados: autoriza al usuario y redirige a un signed URL corto.
 * Los paths almacenados siguen funcionando; no se usan URLs públicas de Storage.
 */
export async function GET(request: NextRequest) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const bucket = request.nextUrl.searchParams.get("bucket") ?? "";
  const path = request.nextUrl.searchParams.get("path") ?? "";

  if (!isPrivateStorageBucket(bucket) || !isSafeStoragePath(path)) {
    return NextResponse.json({ error: "Ruta no válida." }, { status: 400 });
  }

  const allowed = await canAccessPrivateStoragePath(bucket, path);
  if (!allowed) {
    return NextResponse.json({ error: "Acceso denegado al archivo." }, { status: 403 });
  }

  const signed = await createSignedStorageUrl(createAdminClient(), bucket, path);
  if (!signed) {
    return NextResponse.json({ error: "No se pudo firmar el archivo." }, { status: 404 });
  }

  return NextResponse.redirect(signed);
}
