import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient, getUser } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getMyTaller } from "@/lib/taller";
import { getAppBaseUrl } from "@/lib/app-url";
import { VEHICULOS_DOCUMENTOS_BUCKET } from "@/lib/storage/buckets";
import { canAccessPrivateStoragePath } from "@/lib/storage/authorize";
import { createSignedStorageUrl } from "@/lib/storage/signed-url";
import { nfcTokenSchema } from "@/lib/validations/nfc";

export const dynamic = "force-dynamic";

const stickerQuerySchema = z.object({
  token: nfcTokenSchema.optional(),
  id: z.string().uuid().optional(),
  format: z.enum(["json", "ndef", "txt"]).default("json"),
});

/**
 * GET /api/nfc/download
 * - ?path=... → enlace firmado (60s) al documento en storage
 * - ?id=... | ?token=... → payload URI/NDEF del sticker NFC
 */
export async function GET(request: NextRequest) {
  const filePath = request.nextUrl.searchParams.get("path");

  if (filePath) {
    return downloadSignedDocument(filePath);
  }

  return downloadNfcPayload(request);
}

async function downloadSignedDocument(filePath: string) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const allowed = await canAccessPrivateStoragePath(VEHICULOS_DOCUMENTOS_BUCKET, filePath);
  if (!allowed) {
    return NextResponse.json({ error: "Acceso denegado al archivo." }, { status: 403 });
  }

  const signed = await createSignedStorageUrl(
    createAdminClient(),
    VEHICULOS_DOCUMENTOS_BUCKET,
    filePath
  );
  if (!signed) {
    return NextResponse.json({ error: "Acceso denegado al archivo." }, { status: 403 });
  }

  return NextResponse.redirect(signed);
}

async function downloadNfcPayload(request: NextRequest) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const taller = await getMyTaller();
  if (!taller) {
    return NextResponse.json({ error: "No se encontró tu taller" }, { status: 403 });
  }

  const parsed = stickerQuerySchema.safeParse({
    token: request.nextUrl.searchParams.get("token") ?? undefined,
    id: request.nextUrl.searchParams.get("id") ?? undefined,
    format: request.nextUrl.searchParams.get("format") ?? "json",
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? "Parámetros inválidos" },
      { status: 400 }
    );
  }

  if (!parsed.data.token && !parsed.data.id) {
    return NextResponse.json({ error: "Ruta no especificada." }, { status: 400 });
  }

  const supabase = createClient();
  let query = supabase
    .from("nfc_stickers")
    .select("id, token, etiqueta, placa, activo")
    .eq("taller_id", taller.id);

  if (parsed.data.id) {
    query = query.eq("id", parsed.data.id);
  } else if (parsed.data.token) {
    query = query.eq("token", parsed.data.token);
  }

  const { data, error } = await query.maybeSingle();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Sticker no encontrado" }, { status: 404 });
  }

  const publicUrl = `${getAppBaseUrl()}/v/${data.token}`;
  const payload = {
    type: "URI",
    url: publicUrl,
    token: data.token,
    etiqueta: data.etiqueta,
    placa: data.placa,
    activo: data.activo,
    ndef: {
      tnf: "well-known",
      type: "U",
      payload: publicUrl,
    },
  };

  if (parsed.data.format === "txt" || parsed.data.format === "ndef") {
    const body = [
      `SmartTaller NFC Puerto Libre`,
      `URL=${publicUrl}`,
      `TOKEN=${data.token}`,
      data.placa ? `PLACA=${data.placa}` : null,
      data.etiqueta ? `ETIQUETA=${data.etiqueta}` : null,
    ]
      .filter(Boolean)
      .join("\n");

    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Disposition": `attachment; filename="nfc-${data.token.slice(0, 8)}.txt"`,
      },
    });
  }

  return NextResponse.json(payload);
}
