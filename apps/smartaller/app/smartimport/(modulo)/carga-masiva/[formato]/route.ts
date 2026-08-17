import { NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { getMyTaller } from "@/lib/taller";
import { buildCargaMasivaCsvTemplate } from "@/lib/importacion/carga-masiva-template";
import { buildCargaMasivaXlsxBuffer } from "@/lib/importacion/parse-spreadsheet";

export const dynamic = "force-dynamic";

type Params = { params: { formato: string } };

export async function GET(_req: Request, { params }: Params) {
  const user = await getUser();
  if (!user) {
    return NextResponse.redirect(new URL("/login?next=/smartimport/carga-masiva", _req.url));
  }
  const taller = await getMyTaller();
  if (!taller) {
    return NextResponse.json({ error: "Sin taller" }, { status: 403 });
  }

  const formato = params.formato?.toLowerCase() ?? "";

  if (formato === "plantilla.csv") {
    const csv = buildCargaMasivaCsvTemplate();
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition":
          'attachment; filename="plantilla-carga-masiva-puerto-libre.csv"',
        "Cache-Control": "no-store",
      },
    });
  }

  if (formato === "plantilla.xlsx") {
    const buf = buildCargaMasivaXlsxBuffer();
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition":
          'attachment; filename="plantilla-carga-masiva-puerto-libre.xlsx"',
        "Cache-Control": "no-store",
      },
    });
  }

  return NextResponse.json({ error: "Formato no encontrado" }, { status: 404 });
}
