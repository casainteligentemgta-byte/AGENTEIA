import { waitUntil } from "@vercel/functions";
import { NextResponse } from "next/server";
import { extractMantenimientoFromImage } from "@/lib/extract-invoice";
import { processInvoiceSafe } from "@/lib/process-invoice";
import {
  downloadTelegramFile,
  getImageFileId,
  sendTelegramMessage,
  type TelegramUpdate,
} from "@/lib/telegram";

export const runtime = "nodejs";
export const maxDuration = 60;

function runInBackground(task: Promise<void>): void {
  waitUntil(task);
}

/**
 * Webhook de Telegram para recibir fotos de facturas de mantenimiento.
 * Responde de inmediato y procesa en segundo plano (GPT-4o + Supabase + WhatsApp).
 * POST /api/webhook-telegram
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
    const message = update.message;

    if (!message) {
      return NextResponse.json({ ok: true, skipped: "sin mensaje" });
    }

    const fileId = getImageFileId(message);
    if (!fileId) {
      runInBackground(
        sendTelegramMessage(
          message.chat.id,
          "Envía una foto de la factura u orden de mantenimiento para registrarla."
        ).then(() => undefined)
      );
      return NextResponse.json({ ok: true, skipped: "sin imagen" });
    }

    // Responder rápido a Telegram; el procesamiento pesado va en background
    runInBackground(
      (async () => {
        const { buffer, mimeType } = await downloadTelegramFile(fileId);
        const extraido = await extractMantenimientoFromImage(buffer, mimeType);
        await processInvoiceSafe({
          extraido,
          telegramChatId: message.chat.id,
          telegramMessageId: message.message_id,
          telegramFileId: fileId,
        });
      })()
    );

    return NextResponse.json({ ok: true, accepted: true, update_id: update.update_id });
  } catch (err) {
    console.error("Error en webhook-telegram:", err);
    const message = err instanceof Error ? err.message : "Error interno";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

/** Telegram puede validar la URL con GET al configurar el webhook. */
export async function GET() {
  return NextResponse.json({ status: "webhook-telegram activo" });
}
