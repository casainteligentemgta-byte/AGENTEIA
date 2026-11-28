import { NextResponse } from "next/server";
import { procesarRecordatoriosSuscripcion } from "@/lib/billing/recordatorios-suscripcion";
import { persistirTasaBcv, getTasaBcvDelDia } from "@/lib/billing/tasa-bcv";
import { lookupTasaBcv, todayYmdCaracas } from "@/lib/importacion/tasa-bcv";

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

/** Vercel Cron diario: recordatorios 7/3 días + refresco de tasa BCV. */
export async function GET(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const hoy = todayYmdCaracas();
    const lookup = await lookupTasaBcv(hoy);
    if (lookup) {
      await persistirTasaBcv(lookup);
    } else {
      await getTasaBcvDelDia();
    }
    const result = await procesarRecordatoriosSuscripcion();
    return NextResponse.json({ ok: result.errors.length === 0, ...result });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Error procesando recordatorios de suscripción";
    console.error("[cron/suscripciones]", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
