import { NextResponse } from "next/server";
import { extractPuertoLibreDocumentoAction } from "@/app/actions/nfc/importacion-extract";

export const dynamic = "force-dynamic";
/** Una pasada de visión + PDF; las Server Actions no pueden exportar maxDuration. */
export const maxDuration = 300;

export async function GET() {
  return NextResponse.json({ ok: true, service: "ocr-documento" });
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const result = await extractPuertoLibreDocumentoAction(formData);
    return NextResponse.json(result);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "No se pudo leer el documento";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
