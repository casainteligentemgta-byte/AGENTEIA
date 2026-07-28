import { NextResponse } from "next/server";
import { z } from "zod";
import { getUser } from "@/lib/supabase/server";
import { createClient } from "@/lib/supabase/server";
import { getMyTaller } from "@/lib/taller";
import { getAppBaseUrl } from "@/lib/app-url";
import { nfcTokenSchema } from "@/lib/validations/nfc";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  token: nfcTokenSchema.optional(),
  id: z.string().uuid().optional(),
  format: z.enum(["json", "ndef", "txt"]).default("json"),
});

/**
 * Descarga payload NFC (URI) para grabar en el sticker.
 * Auth + ownership del taller. Asume RLS en nfc_stickers.
 */
export async function GET(req: Request) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const taller = await getMyTaller();
  if (!taller) {
    return NextResponse.json({ error: "No se encontró tu taller" }, { status: 403 });
  }

  const url = new URL(req.url);
  const parsed = querySchema.safeParse({
    token: url.searchParams.get("token") ?? undefined,
    id: url.searchParams.get("id") ?? undefined,
    format: url.searchParams.get("format") ?? "json",
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? "Parámetros inválidos" },
      { status: 400 }
    );
  }

  if (!parsed.data.token && !parsed.data.id) {
    return NextResponse.json({ error: "Indica token o id" }, { status: 400 });
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
