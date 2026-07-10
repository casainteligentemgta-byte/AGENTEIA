import { waitUntil } from "@vercel/functions";
import { NextResponse } from "next/server";
import { processInspeccionTelegramPhoto } from "@/lib/process-inspeccion-telegram";
import { vincularTelegramPorCodigo } from "@/lib/taller";
import {
  getImageFileId,
  isInspeccionPhotoRequest,
  parseVincularCommand,
  parseInspeccionCommand,
  sendTelegramMessage,
  type TelegramUpdate,
} from "@/lib/telegram";

export const runtime = "nodejs";
export const maxDuration = 60;

async function handleTextMessage(update: TelegramUpdate): Promise<void> {
  const message = update.message;
  if (!message) return;

  const codigo = parseVincularCommand(message);
  if (codigo) {
    const result = await vincularTelegramPorCodigo(codigo, message.chat.id);
    if (result.ok) {
      await sendTelegramMessage(
        message.chat.id,
        `✅ Taller "${result.nombre}" vinculado correctamente.\n\n` +
          "• Inspección: envía foto del vehículo con la palabra *inspeccion* en el pie de foto"
      );
    } else {
      await sendTelegramMessage(message.chat.id, `❌ ${result.error}`);
    }
    return;
  }

  if (parseInspeccionCommand(message)) {
    await sendTelegramMessage(
      message.chat.id,
      "📷 Envía ahora la foto del vehículo mostrando la placa.\n" +
        "Escribe *inspeccion* en el pie de foto (caption) para abrir la planilla de ingreso."
    );
    return;
  }

  if (!getImageFileId(message)) {
    await sendTelegramMessage(
      message.chat.id,
      "Comandos disponibles:\n\n" +
        "🔍 Inspección — foto del vehículo con pie de foto: inspeccion\n" +
        "   (o escribe /inspeccion y luego la foto)\n\n" +
        "🔗 Vincular taller: /vincular TU_CODIGO\n" +
        "(Código en Dashboard → Configuración)"
    );
  }
}

async function processTelegramPhoto(update: TelegramUpdate): Promise<void> {
  const message = update.message;
  if (!message) return;

  if (isInspeccionPhotoRequest(message)) {
    await processInspeccionTelegramPhoto(update);
    return;
  }

  await sendTelegramMessage(
    message.chat.id,
    "📷 Para abrir la planilla de inspección, envía la foto del vehículo con pie de foto:\n" +
      "inspeccion\n\n" +
      "También puedes escribir /inspeccion y luego enviar la foto."
  );
}

export async function POST(req: Request) {
  try {
    const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
    const isProd = process.env.NODE_ENV === "production";

    if (!secret) {
      if (isProd) {
        console.error("TELEGRAM_WEBHOOK_SECRET no configurado en producción");
        return NextResponse.json({ error: "Webhook no configurado" }, { status: 503 });
      }
    } else {
      const headerSecret = req.headers.get("x-telegram-bot-api-secret-token");
      if (headerSecret !== secret) {
        return NextResponse.json({ error: "No autorizado" }, { status: 401 });
      }
    }

    const update = (await req.json()) as TelegramUpdate;

    if (!update.message) {
      return NextResponse.json({ ok: true, skipped: "sin mensaje" });
    }

    const fileId = getImageFileId(update.message);

    waitUntil(
      (fileId ? processTelegramPhoto(update) : handleTextMessage(update)).catch(async (err) => {
        console.error("Error en telegram-webhook:", err);
        const msg = err instanceof Error ? err.message : "Error interno";
        try {
          await sendTelegramMessage(update.message!.chat.id, `❌ Error: ${msg}`);
        } catch {
          /* ignore */
        }
      })
    );

    return NextResponse.json({ ok: true, accepted: true, update_id: update.update_id });
  } catch (err) {
    console.error("Error en telegram-webhook:", err);
    const message = err instanceof Error ? err.message : "Error interno";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ status: "telegram-webhook activo" });
}
