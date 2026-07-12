import { createAdminClient } from "@/lib/supabase/admin";
import { getInspeccionVehiculoUrl } from "@/lib/format";
import { resolverVehiculoDesdeFotoFrontal } from "@/lib/ordenes-recepcion/resolver-vehiculo-placa";
import { getTallerByTelegramChat } from "@/lib/taller";
import { downloadTelegramFile, sendTelegramMessage } from "@/lib/telegram";
import {
  clearTelegramPendingAction,
  setTelegramPendingAction,
} from "@/lib/telegram-pending";

export async function solicitarFotoFrontalRecepcion(chatId: number): Promise<void> {
  const taller = await getTallerByTelegramChat(chatId);

  if (!taller) {
    await sendTelegramMessage(
      chatId,
      "❌ Este Telegram no está vinculado a un taller.\nUsa /vincular TU_CODIGO (código en Dashboard → Configuración)."
    );
    return;
  }

  await setTelegramPendingAction(chatId, "recepcion_foto_frontal");

  await sendTelegramMessage(
    chatId,
    "📷 Recepción de vehículo\n\n" +
      "Envía la foto frontal del vehículo (parachoques o portaplacas visible).\n\n" +
      "La IA leerá la placa, buscará el vehículo en tu flota y te enviará el enlace para continuar la inspección en la app.\n\n" +
      "Tienes 15 minutos para enviar la foto."
  );
}

export async function processRecepcionTelegramPhoto(
  update: import("@/lib/telegram").TelegramUpdate
): Promise<void> {
  const message = update.message;
  if (!message) return;

  const chatId = message.chat.id;
  const fileId =
    message.photo?.[message.photo.length - 1]?.file_id ??
    (message.document?.mime_type?.startsWith("image/") ? message.document.file_id : null);

  if (!fileId) {
    await sendTelegramMessage(chatId, "❌ Envía una imagen con la foto frontal del vehículo.");
    return;
  }

  const taller = await getTallerByTelegramChat(chatId);
  if (!taller) {
    await clearTelegramPendingAction(chatId);
    await sendTelegramMessage(
      chatId,
      "❌ Este Telegram no está vinculado a un taller.\nUsa /vincular TU_CODIGO"
    );
    return;
  }

  await sendTelegramMessage(chatId, "🔍 Leyendo placa en la foto frontal…");

  try {
    const { buffer, mimeType } = await downloadTelegramFile(fileId);
    const supabase = createAdminClient();

    const resolucion = await resolverVehiculoDesdeFotoFrontal(supabase, {
      tallerId: taller.id,
      imageBuffer: buffer,
      mimeType,
    });

    await clearTelegramPendingAction(chatId);

    if (!resolucion.ok) {
      const detalle = resolucion.placaDetectada
        ? ` (leída: ${resolucion.placaDetectada})`
        : "";
      await sendTelegramMessage(
        chatId,
        `❌ ${resolucion.error}${detalle}\n\n` +
          "Intenta de nuevo con /recepcion — acerca más la placa en el encuadre."
      );
      return;
    }

    const { vehiculo, placaDetectada, aviso } = resolucion;
    const url = getInspeccionVehiculoUrl(vehiculo.id);
    const nombre = vehiculo.nombre_cliente ?? "Sin propietario";
    const modelo =
      vehiculo.marca && vehiculo.modelo ? `${vehiculo.marca} ${vehiculo.modelo}` : "";

    let texto =
      `✅ Foto frontal recibida\n` +
      `🚗 Vehículo: ${vehiculo.placa}\n` +
      `👤 ${nombre}${modelo ? `\n📋 ${modelo}` : ""}\n`;

    if (placaDetectada && placaDetectada !== vehiculo.placa.replace(/\s/g, "")) {
      texto += `📷 Placa leída: ${placaDetectada}\n`;
    }
    if (aviso) {
      texto += `ℹ️ ${aviso}\n`;
    }

    texto += `\nContinúa en la app (laterales, tablero y checklist):\n${url}`;

    await sendTelegramMessage(chatId, texto);
  } catch (err) {
    await clearTelegramPendingAction(chatId);
    const msg = err instanceof Error ? err.message : "Error al procesar la foto";
    await sendTelegramMessage(chatId, `❌ ${msg}`);
  }
}
