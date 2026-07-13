import { createAdminClient } from "@/lib/supabase/admin";
import { formatLlmAuthError } from "@/lib/ai/openai-config";
import { getInspeccionVehiculoUrl } from "@/lib/format";
import { resolverVehiculoDesdeFotoFrontal } from "@/lib/ordenes-recepcion/resolver-vehiculo-placa";
import { uploadEstadoVisualFotoBuffer } from "@/lib/ordenes-recepcion/upload-estado-visual";
import { crearTelegramRecepcionSesion } from "@/lib/telegram-recepcion-sesion";
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
      "La IA leerá la placa y te enviará el enlace para completar la hoja de inspección en la app (fotos restantes + checklist).\n\n" +
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

    const fotoFrontal = await uploadEstadoVisualFotoBuffer(supabase, {
      tallerId: taller.id,
      vista: "frontal",
      buffer,
      mimeType,
      vehiculoId: vehiculo.id,
    });

    const sesionToken = await crearTelegramRecepcionSesion({
      vehiculoId: vehiculo.id,
      tallerId: taller.id,
      frontalUrl: fotoFrontal.url,
      frontalPath: fotoFrontal.path,
      placa: vehiculo.placa,
    });

    const url = getInspeccionVehiculoUrl(vehiculo.id, { sesionToken });
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

    texto +=
      `\nAbre el enlace para continuar (fotos restantes + hoja de inspección):\n${url}`;

    await sendTelegramMessage(chatId, texto);
  } catch (err) {
    await clearTelegramPendingAction(chatId);
    const msg = formatLlmAuthError(err);
    await sendTelegramMessage(chatId, `❌ ${msg}`);
  }
}
