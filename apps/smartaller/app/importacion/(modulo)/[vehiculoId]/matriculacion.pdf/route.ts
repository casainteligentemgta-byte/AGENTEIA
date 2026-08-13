import { NextResponse } from "next/server";
import { getPuertoLibreFicha } from "@/app/actions/nfc/importacion-vehiculo";
import {
  buildMatriculacionPdf,
  matriculacionPdfFileName,
} from "@/lib/importacion/expediente-pdf";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Params = { params: { vehiculoId: string } };

/** GET — PDF de carpeta INTT (Matriculación). */
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
    const bytes = await buildMatriculacionPdf(result.ficha);
    const fileName = matriculacionPdfFileName(
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
      err instanceof Error
        ? err.message
        : "No se pudo generar el PDF de matriculación";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
