import { NextResponse } from "next/server";
import { extractMantenimientoFromImage } from "@/lib/extract-invoice";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  downloadTelegramFile,
  getImageFileId,
  sendTelegramMessage,
  type TelegramUpdate,
} from "@/lib/telegram";

export const runtime = "nodejs";

/**
 * Webhook de Telegram para recibir fotos de facturas de mantenimiento.
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
      await sendTelegramMessage(
        message.chat.id,
        "Envía una foto de la factura u orden de mantenimiento para registrarla."
      );
      return NextResponse.json({ ok: true, skipped: "sin imagen" });
    }

    const { buffer, mimeType } = await downloadTelegramFile(fileId);
    const extraido = await extractMantenimientoFromImage(buffer, mimeType);

    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("mantenimientos")
      .insert({
        placa: extraido.placa,
        kilometraje: extraido.kilometraje,
        descripcion_servicio: extraido.descripcion_servicio,
        costo: extraido.costo,
        telegram_chat_id: message.chat.id,
        telegram_message_id: message.message_id,
        telegram_file_id: fileId,
      })
      .select("id")
      .single();

    if (error) {
      console.error("Error insertando mantenimiento:", error);
      await sendTelegramMessage(
        message.chat.id,
        "No pude guardar el mantenimiento. Intenta de nuevo más tarde."
      );
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    const resumen = [
      "✅ Mantenimiento registrado",
      extraido.placa ? `Placa: ${extraido.placa}` : null,
      extraido.kilometraje != null ? `Km: ${extraido.kilometraje.toLocaleString("es-CO")}` : null,
      extraido.descripcion_servicio ? `Servicio: ${extraido.descripcion_servicio}` : null,
      extraido.costo != null ? `Costo: $${extraido.costo.toLocaleString("es-CO")}` : null,
      `ID: ${data.id}`,
    ]
      .filter(Boolean)
      .join("\n");

    await sendTelegramMessage(message.chat.id, resumen);

    return NextResponse.json({ ok: true, id: data.id, extraido });
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
