import { NextResponse } from "next/server";
import { procesarTasaOficialDiaria } from "@/lib/importacion/pago-aranceles-diario";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function isAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  const isProd = process.env.NODE_ENV === "production";

  if (!secret) {
    return !isProd;
  }

  const auth = req.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

/** Vercel Cron diario: reconvierte precálculos pendientes a Bs con la tasa BCV/SENIAT. */
export async function GET(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await procesarTasaOficialDiaria();
    return NextResponse.json({ ok: result.errors.length === 0, ...result });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Error actualizando tasa oficial";
    console.error("[cron/tasa-oficial-pago]", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
