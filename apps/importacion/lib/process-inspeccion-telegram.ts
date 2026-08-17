import { formatLlmAuthError } from "@/lib/ai/openai-config";
import { createAdminClient } from "@/lib/supabase/admin";
import { extractPlacaFromImage } from "@/lib/extract-placa";
import { getAppBaseUrl, getInspeccionVehiculoUrl, formatDate } from "@/lib/format";
import { getTallerByTelegramChat } from "@/lib/taller";
import { downloadTelegramFile, sendTelegramMessage } from "@/lib/telegram";
import { normalizarPlaca, resolverPlacaEnFlota } from "@/lib/vehicles/placa";

export async function enviarEnlaceInspeccionPorPlaca(
  chatId: number,
  placaRaw: string
): Promise<void> {
  const taller = await getTallerByTelegramChat(chatId);

  if (!taller) {
    await sendTelegramMessage(
      chatId,
      "❌ Este Telegram no está vinculado a un taller.\nUsa /vincular TU_CODIGO (código en Dashboard → Configuración)."
    );
    return;
  }

  const placaNorm = normalizarPlaca(placaRaw);
  if (placaNorm.length < 2) {
    await sendTelegramMessage(chatId, "❌ Indica una placa válida. Ej: /inspeccion ABC123");
    return;
  }

  const supabase = createAdminClient();
  const { data: vehiculo, error } = await supabase
    .from("vehiculos")
    .select("id, placa, nombre_cliente, marca, modelo, created_at")
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

  await sendTelegramMessage(
    chatId,
    `✅ Vehículo: ${vehiculo.placa}\n` +
      `👤 ${nombre}${modelo ? `\n🚗 ${modelo}` : ""}\n` +
      `📅 Registrado: ${registrado}\n\n` +
      `Abre la planilla y toma la foto frontal desde la app (se guarda al instante):\n${url}`
  );
}

export async function processInspeccionTelegramPhoto(
  update: import("@/lib/telegram").TelegramUpdate
): Promise<void> {
  const message = update.message;
  if (!message?.photo?.length && !message?.document) return;

  const chatId = message.chat.id;
  const fileId =
    message.photo?.[message.photo.length - 1]?.file_id ??
    (message.document?.mime_type?.startsWith("image/") ? message.document.file_id : null);

  if (!fileId) {
    await sendTelegramMessage(chatId, "❌ Envía una foto donde se vea la placa del vehículo.");
    return;
  }

  await sendTelegramMessage(chatId, "🔍 Leyendo placa…");

  let placa: string | null = null;
  let confianza: "alta" | "baja" | null = null;

  try {
    const { buffer, mimeType } = await downloadTelegramFile(fileId);
    const ocr = await extractPlacaFromImage(buffer, mimeType, "placa");
    placa = ocr.placa;
    confianza = ocr.confianza;
  } catch (err) {
    await sendTelegramMessage(chatId, `❌ ${formatLlmAuthError(err)}`);
    return;
  }

  if (!placa || placa.length < 2) {
    await sendTelegramMessage(
      chatId,
      "❌ No pude leer la placa. Escribe /inspeccion PLACA o envía una foto más clara con pie de foto: inspeccion"
    );
    return;
  }

  const taller = await getTallerByTelegramChat(chatId);
  if (!taller) {
    await sendTelegramMessage(
      chatId,
      "❌ Este Telegram no está vinculado a un taller.\nUsa /vincular TU_CODIGO (código en Dashboard → Configuración)."
    );
    return;
  }

  const supabase = createAdminClient();
  const { data: flota } = await supabase
    .from("vehiculos")
    .select("placa")
    .eq("taller_id", taller.id);

  const coincidencia = resolverPlacaEnFlota(
    placa,
    (flota ?? []).map((v) => v.placa)
  );
  const placaFinal = coincidencia?.placa ?? placa;

  if (confianza === "baja") {
    await sendTelegramMessage(chatId, "⚠️ Placa detectada con baja confianza — verifica al abrir la planilla.");
  }

  if (coincidencia && coincidencia.metodo !== "exacta") {
    await sendTelegramMessage(
      chatId,
      `ℹ️ Placa leída ${placa} → usando ${placaFinal} de tu flota.`
    );
  }

  await enviarEnlaceInspeccionPorPlaca(chatId, placaFinal);
}
