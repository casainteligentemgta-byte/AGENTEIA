import { NextResponse } from "next/server";
import { getPuertoLibreFicha } from "@/app/actions/nfc/puerto-libre-vehiculo";
import {
  buildExpedientePdf,
  expedientePdfFileName,
} from "@/lib/puerto-libre/expediente-pdf";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Params = { params: { vehiculoId: string } };

/** GET — descarga PDF completo del expediente (datos + docs + fotos). */
export async function GET(_request: Request, { params }: Params) {
  const result = await getPuertoLibreFicha(params.vehiculoId);
  if (!result.success) {
    const status =
      result.error === "Vehículo no encontrado"
        ? 404
        : result.error === "Debes iniciar sesión" || result.error === "No autorizado"
          ? 401
          : 400;
    return NextResponse.json({ error: result.error }, { status });
  }

  try {
    const bytes = await buildExpedientePdf(result.ficha);
    const fileName = expedientePdfFileName(
      result.ficha.codigoExpediente,
      result.ficha.placa
    );

    return new NextResponse(Buffer.from(bytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "No se pudo generar el PDF del expediente";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
