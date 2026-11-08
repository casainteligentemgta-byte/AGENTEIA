import { GMAIL_ALLOW_HOSTS, GMAIL_ITEM_LIMIT } from "../config";
import { configuredSecret } from "../access";
import { SafeFetchError, safeFetch, type FetchLike } from "../safe-fetch";
import { sanitizeText } from "../sanitize";
import type { GmailItem, GmailSection } from "../types";

const GMAIL_QUERY = "is:unread (is:important OR is:starred) -in:chats -category:promotions";

function gmailSection(
  status: GmailSection["status"],
  message: string | null,
  items: GmailItem[] = []
): GmailSection {
  return {
    id: "gmail",
    label: "Correos importantes",
    status,
    fetchedAt: items.length > 0 || status === "ok" ? new Date().toISOString() : null,
    sourceName: "Gmail (solo lectura)",
    sourceUrl: "https://mail.google.com/",
    message,
    items,
  };
}

export function gmailNotConnected(message = "No conectado"): GmailSection {
  return gmailSection("needsAuth", message, []);
}

function headerValue(
  headers: Array<{ name?: string; value?: string }> | undefined,
  name: string
): string {
  const found = headers?.find((header) => header.name?.toLowerCase() === name.toLowerCase());
  return found?.value ?? "";
}

async function refreshAccessToken(fetchImpl?: FetchLike): Promise<string | null> {
  const clientId = configuredSecret(process.env.GMAIL_CLIENT_ID);
  const clientSecret = configuredSecret(process.env.GMAIL_CLIENT_SECRET);
  const refreshToken = configuredSecret(process.env.GMAIL_REFRESH_TOKEN);
  if (!clientId || !clientSecret || !refreshToken) return null;

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  }).toString();

  const res = await safeFetch("https://oauth2.googleapis.com/token", {
    allowHosts: GMAIL_ALLOW_HOSTS,
    fetchImpl,
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) return null;
  const payload = JSON.parse(res.text) as { access_token?: string };
  return typeof payload.access_token === "string" ? payload.access_token : null;
}

export async function fetchGmail(options: {
  allowed: boolean;
  fetchImpl?: FetchLike;
}): Promise<GmailSection> {
  if (!options.allowed) {
    return gmailNotConnected("No conectado");
  }
  const hasCreds =
    configuredSecret(process.env.GMAIL_CLIENT_ID) &&
    configuredSecret(process.env.GMAIL_CLIENT_SECRET) &&
    configuredSecret(process.env.GMAIL_REFRESH_TOKEN);
  if (!hasCreds) {
    return gmailNotConnected("No conectado");
  }

  try {
    const accessToken = await refreshAccessToken(options.fetchImpl);
    if (!accessToken) {
      return gmailSection("error", "Gmail no autorizó la lectura. Revisa las credenciales del servidor.");
    }

    const listUrl =
      `https://gmail.googleapis.com/gmail/v1/users/me/messages` +
      `?maxResults=${GMAIL_ITEM_LIMIT}&q=${encodeURIComponent(GMAIL_QUERY)}`;
    const listRes = await safeFetch(listUrl, {
      allowHosts: GMAIL_ALLOW_HOSTS,
      fetchImpl: options.fetchImpl,
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!listRes.ok) {
      return gmailSection("error", "No se pudo listar correos (solo lectura).");
    }
    const listPayload = JSON.parse(listRes.text) as { messages?: Array<{ id?: string }> };
    const ids = (listPayload.messages ?? [])
      .map((msg) => msg.id)
      .filter((id): id is string => Boolean(id))
      .slice(0, GMAIL_ITEM_LIMIT);

    const items: GmailItem[] = [];
    for (const id of ids) {
      const msgUrl =
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(id)}` +
        `?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`;
      const msgRes = await safeFetch(msgUrl, {
        allowHosts: GMAIL_ALLOW_HOSTS,
        fetchImpl: options.fetchImpl,
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!msgRes.ok) continue;
      const msg = JSON.parse(msgRes.text) as {
        id?: string;
        snippet?: string;
        internalDate?: string;
        payload?: { headers?: Array<{ name?: string; value?: string }> };
      };
      const subject = sanitizeText(headerValue(msg.payload?.headers, "Subject") || "(sin asunto)", 180);
      const from = sanitizeText(headerValue(msg.payload?.headers, "From"), 140);
      const receivedMs = msg.internalDate ? Number(msg.internalDate) : NaN;
      items.push({
        id: msg.id ?? id,
        from: from || "Remitente oculto",
        subject,
        receivedAt: Number.isFinite(receivedMs) ? new Date(receivedMs).toISOString() : null,
        snippet: msg.snippet ? sanitizeText(msg.snippet, 140) : null,
      });
    }

    return gmailSection(
      "ok",
      items.length === 0 ? "No hay correos importantes sin leer." : null,
      items
    );
  } catch (error) {
    if (error instanceof SafeFetchError && error.code === "ssrf") throw error;
    return gmailSection("error", "Error al leer Gmail. No se modificó ningún correo.");
  }
}
