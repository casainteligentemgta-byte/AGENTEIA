import { createAdminClient } from "@/lib/supabase/admin";
import { extractPlacaFromImage } from "@/lib/extract-placa";
import { getAppBaseUrl, getInspeccionVehiculoUrl, formatDate } from "@/lib/format";
import { getTallerByTelegramChat } from "@/lib/taller";
import { downloadTelegramFile, sendTelegramMessage, type TelegramUpdate } from "@/lib/telegram";
import { normalizarPlaca } from "@/lib/vehicles/link";

export async function processInspeccionTelegramPhoto(update: TelegramUpdate): Promise<void> {
  const message = update.message;
  if (!message?.photo?.length && !message?.document) return;

  const chatId = message.chat.id;
  const taller = await getTallerByTelegramChat(chatId);

  if (!taller) {
    await sendTelegramMessage(
      chatId,
      "❌ Este Telegram no está vinculado a un taller.\nUsa /vincular TU_CODIGO (código en Dashboard → Configuración)."
    );
    return;
  }

  const fileId =
    message.photo?.[message.photo.length - 1]?.file_id ??
    (message.document?.mime_type?.startsWith("image/") ? message.document.file_id : null);

  if (!fileId) {
    await sendTelegramMessage(chatId, "❌ Envía una foto del vehículo (JPG o PNG).");
    return;
  }

  await sendTelegramMessage(chatId, "🔍 Leyendo placa del vehículo…");

  const { buffer, mimeType } = await downloadTelegramFile(fileId);
  const { placa, confianza } = await extractPlacaFromImage(buffer, mimeType);

  if (!placa || placa.length < 2) {
    await sendTelegramMessage(
      chatId,
      "❌ No pude leer la placa. Toma una foto más cercana donde se vea claramente la matrícula."
    );
    return;
  }

  const placaNorm = normalizarPlaca(placa);
  const supabase = createAdminClient();

  const { data: vehiculo, error } = await supabase
    .from("vehiculos")
    .select("id, placa, nombre_cliente, marca, modelo, created_at, ultima_orden_recepcion_id")
    .eq("taller_id", taller.id)
    .eq("placa", placaNorm)
    .maybeSingle();

  if (error || !vehiculo) {
    await sendTelegramMessage(
      chatId,
      `❌ No encontré el vehículo ${placaNorm} en tu flota.\nRegístralo primero: ${getAppBaseUrl()}/dashboard/vehiculos/nuevo`
    );
    return;
  }

  const url = getInspeccionVehiculoUrl(vehiculo.id);
  const nombre = vehiculo.nombre_cliente ?? "Sin propietario";
  const modelo =
    vehiculo.marca && vehiculo.modelo ? `${vehiculo.marca} ${vehiculo.modelo}` : "";
  const registrado = formatDate(vehiculo.created_at);
  const avisoConfianza =
    confianza === "baja" ? "\n⚠️ Placa detectada con baja confianza — verifica antes de inspeccionar." : "";

  await sendTelegramMessage(
    chatId,
    `✅ Vehículo encontrado: ${vehiculo.placa}\n` +
      `👤 ${nombre}${modelo ? `\n🚗 ${modelo}` : ""}\n` +
      `📅 Registrado: ${registrado}${avisoConfianza}\n\n` +
      `Abre la planilla de inspección:\n${url}`
  );
}
