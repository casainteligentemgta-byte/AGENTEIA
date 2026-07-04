import { NextResponse } from "next/server";
import { procesarRecordatoriosVencidos } from "@/lib/recordatorios";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function isAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV === "development";

  const auth = req.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

/** Vercel Cron: envía WhatsApp de recordatorios con fecha_programada <= hoy */
export async function GET(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await procesarRecordatoriosVencidos();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error procesando recordatorios";
    console.error("[cron/recordatorios]", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
