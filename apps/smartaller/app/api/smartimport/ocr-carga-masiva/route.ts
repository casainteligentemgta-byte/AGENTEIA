import { NextResponse } from "next/server";
import { extractCargaMasivaEtapaAction } from "@/app/actions/nfc/importacion-carga-masiva";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET() {
  return NextResponse.json({ ok: true, service: "ocr-carga-masiva" });
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const result = await extractCargaMasivaEtapaAction(formData);
    return NextResponse.json(result);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "No se pudo extraer la carga masiva";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
