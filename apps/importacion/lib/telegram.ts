import { resolveImageMimeType } from "@/lib/mime-image";

const TELEGRAM_API = "https://api.telegram.org";

function getBotToken(): string {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    throw new Error("Falta TELEGRAM_BOT_TOKEN en las variables de entorno");
  }
  return token;
}

export type TelegramPhotoSize = {
  file_id: string;
  file_unique_id: string;
  width: number;
  height: number;
  file_size?: number;
};

export type TelegramMessage = {
  message_id: number;
  chat: { id: number; type: string };
  text?: string;
  caption?: string;
  photo?: TelegramPhotoSize[];
  document?: {
    file_id: string;
    file_name?: string;
    mime_type?: string;
  };
};

export type TelegramUpdate = {
  update_id: number;
  message?: TelegramMessage;
};

/** Devuelve el file_id de la imagen más grande del mensaje (foto o documento imagen). */
export function getImageFileId(message: TelegramMessage): string | null {
  if (message.photo?.length) {
    return message.photo[message.photo.length - 1].file_id;
  }

  const doc = message.document;
  if (doc?.mime_type?.startsWith("image/")) {
    return doc.file_id;
  }

  return null;
}

/** Indica si la foto es recepción (foto frontal del vehículo). */
export function isRecepcionPhotoCaption(message: TelegramMessage): boolean {
  const caption = message.caption?.trim().toLowerCase() ?? "";
  return /\b(recepcion|recepción)\b/i.test(caption);
}

/** Indica si la foto es para inspección por placa (primer plano). */
export function isInspeccionPhotoRequest(message: TelegramMessage): boolean {
  const caption = message.caption?.trim().toLowerCase() ?? "";
  if (isRecepcionPhotoCaption(message) && !/\b(inspeccion|inspección)\b/i.test(caption)) {
    return false;
  }
  if (/\b(inspeccion|inspección|placa)\b/i.test(caption)) {
    return true;
  }
  const text = message.text?.trim().toLowerCase() ?? "";
  return /^\/inspeccion(?:@\w+)?$/i.test(text);
}

/** Comando /recepcion — inicia flujo de foto frontal. */
export function parseRecepcionCommand(message: TelegramMessage): boolean {
  const text = message.text?.trim() ?? "";
  return /^\/recepcion(?:@\w+)?$/i.test(text);
}

/** Comando /inspeccion sin foto adjunta. */
export function parseInspeccionCommand(message: TelegramMessage): boolean {
  const text = message.text?.trim() ?? "";
  return /^\/inspeccion(?:@\w+)?$/i.test(text);
}

/** /inspeccion ABC123 — abre planilla por placa escrita */
export function parseInspeccionPlacaCommand(message: TelegramMessage): string | null {
  const text = message.text?.trim();
  if (!text) return null;
  const match = text.match(/^\/inspeccion(?:@\w+)?\s+([A-Za-z0-9-]{2,12})$/i);
  return match ? match[1].toUpperCase().replace(/\s/g, "") : null;
}

/** Parsea /vincular CODIGO del mensaje de texto. */
export function parseVincularCommand(message: TelegramMessage): string | null {
  const text = message.text?.trim();
  if (!text) return null;
  const match = text.match(/^\/vincular(?:@\w+)?\s+([A-Za-z0-9]{6,12})$/i);
  return match ? match[1].toUpperCase() : null;
}

export async function getTelegramFileUrl(fileId: string): Promise<string> {
  const token = getBotToken();

  const fileRes = await fetch(`${TELEGRAM_API}/bot${token}/getFile?file_id=${encodeURIComponent(fileId)}`);
  if (!fileRes.ok) {
    const text = await fileRes.text();
    throw new Error(`Telegram getFile falló: ${fileRes.status} ${text}`);
  }

  const fileData = (await fileRes.json()) as {
    ok: boolean;
    result?: { file_path: string };
    description?: string;
  };

  if (!fileData.ok || !fileData.result?.file_path) {
    throw new Error(fileData.description ?? "No se pudo obtener file_path de Telegram");
  }

  return `${TELEGRAM_API}/file/bot${token}/${fileData.result.file_path}`;
}

export async function downloadTelegramFile(fileId: string): Promise<{ buffer: Buffer; mimeType: string }> {
  const token = getBotToken();

  const fileRes = await fetch(`${TELEGRAM_API}/bot${token}/getFile?file_id=${encodeURIComponent(fileId)}`);
  if (!fileRes.ok) {
    const text = await fileRes.text();
    throw new Error(`Telegram getFile falló: ${fileRes.status} ${text}`);
  }

  const fileData = (await fileRes.json()) as {
    ok: boolean;
    result?: { file_path: string };
    description?: string;
  };

  if (!fileData.ok || !fileData.result?.file_path) {
    throw new Error(fileData.description ?? "No se pudo obtener file_path de Telegram");
  }

  const filePath = fileData.result.file_path;
  const fileUrl = `${TELEGRAM_API}/file/bot${token}/${filePath}`;
  const downloadRes = await fetch(fileUrl);
  if (!downloadRes.ok) {
    throw new Error(`Descarga de archivo Telegram falló: ${downloadRes.status}`);
  }

  const arrayBuffer = await downloadRes.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const mimeType =
    resolveImageMimeType({
      declaredMime: downloadRes.headers.get("content-type"),
      fileName: filePath,
      buffer,
    }) ?? "image/jpeg";

  return { buffer, mimeType };
}

export async function sendTelegramMessage(chatId: number, text: string): Promise<void> {
  const token = getBotToken();

  const res = await fetch(`${TELEGRAM_API}/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Telegram sendMessage falló: ${res.status} ${body.slice(0, 200)}`);
  }
}
