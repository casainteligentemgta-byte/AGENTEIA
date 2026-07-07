import { NextResponse } from "next/server";
import { stravaWebhookPayloadSchema } from "@/lib/validations/smartbike";
import { processStravaActivity } from "@/lib/smartbike/strava";

export const dynamic = "force-dynamic";

/**
 * Webhook ficticio Strava — recibe actividad y actualiza km de componentes.
 * Protegido con STRAVA_WEBHOOK_SECRET (header x-strava-webhook-secret).
 */
export async function POST(request: Request) {
  const secret = process.env.STRAVA_WEBHOOK_SECRET?.trim();
  if (secret) {
    const header = request.headers.get("x-strava-webhook-secret");
    if (header !== secret) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const parsed = stravaWebhookPayloadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? "Payload inválido" },
      { status: 400 }
    );
  }

  const { distance, bicycle_id } = parsed.data.data;
  const result = await processStravaActivity(bicycle_id, distance);

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    bikeId: result.bikeId,
    kmAdded: result.kmAdded,
    updatedComponents: result.updatedComponents,
  });
}

/** Health / verificación del endpoint */
export async function GET() {
  return NextResponse.json({
    service: "smartbike-strava-webhook",
    status: "ok",
    usage: "POST { data: { distance: metros, bicycle_id: uuid (bike o vehiculo) } }",
  });
}
