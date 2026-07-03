import { waitUntil } from "@vercel/functions";
import { NextResponse } from "next/server";
import {
  extractMantenimientoFromUrl,
  buildFacturaProcesadaMessage,
} from "@/lib/extract-invoice";
import { processInvoiceSafe } from "@/lib/process-invoice";
import {
  getImageFileId,
  getTelegramFileUrl,
  sendTelegramMessage,
  type TelegramUpdate,
} from "@/lib/telegram";

export const runtime = "nodejs";
export const maxDuration = 60;

async function processTelegramPhoto(update: TelegramUpdate): Promise<void> {
  const message = update.message;
  if (!message) return;

  const fileId = getImageFileId(message);
  if (!fileId) {
    await sendTelegramMessage(
      message.chat.id,
      "Envía una foto de la factura u orden de mantenimiento para registrarla."
    );
    return;
  }

  const fileUrl = await getTelegramFileUrl(fileId);
  const extraido = await extractMantenimientoFromUrl(fileUrl);

  await processInvoiceSafe({
    extraido,
    telegramChatId: message.chat.id,
    telegramMessageId: message.message_id,
    telegramFileId: fileId,
    confirmationMessage: buildFacturaProcesadaMessage(extraido),
  });
}

/**
 * Webhook de Telegram — SmartTaller
 * POST /api/telegram-webhook
 */
export async function POST(req: Request) {
  try {
    const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
    if (secret) {
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
    if (!fileId) {
      waitUntil(processTelegramPhoto(update));
      return NextResponse.json({ ok: true, skipped: "sin imagen" });
    }

    // Responder de inmediato; procesamiento pesado en background
    waitUntil(
      processTelegramPhoto(update).catch(async (err) => {
        console.error("Error en telegram-webhook:", err);
        const msg = err instanceof Error ? err.message : "Error interno";
        try {
          await sendTelegramMessage(
            update.message!.chat.id,
            `❌ No pude procesar la factura: ${msg}`
          );
        } catch (notifyErr) {
          console.error("Error notificando a Telegram:", notifyErr);
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
