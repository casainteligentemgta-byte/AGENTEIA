"use server";

import { notifyAdminTelegram } from "@/lib/telegram";
import { getAppBaseUrl } from "@/lib/app-url";
import { getBrand } from "@/lib/brand";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Avisa por Telegram cuando alguien se registra en /smartimport.
 * Soft-fail: nunca bloquea el flujo de signup.
 */
export async function notifySmartImportRegistrationAction(input: {
  email: string;
}): Promise<{ success: boolean }> {
  const email = (input.email ?? "").trim().toLowerCase();
  if (!EMAIL_RE.test(email) || email.length > 254) {
    return { success: false };
  }

  const when = new Date().toISOString();
  const text = [
    "🆕 Nuevo registro SmartImport",
    `📧 ${email}`,
    `🌐 ${getAppBaseUrl()}/smartimport`,
    `🤖 ${getBrand().copy.telegram.botLabel}`,
    `🕒 ${when}`,
  ].join("\n");

  const sent = await notifyAdminTelegram(text);
  return { success: sent };
}
